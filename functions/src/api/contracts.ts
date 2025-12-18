import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import { db, Timestamp } from "../utils/admin";
import {
    AuthenticatedRequest,
    canWrite,
    requireRole,
    requireTenant,
    verifyAuth,
} from "../utils/auth-middleware";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

const app = express();
app.use(cors({ 
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Apply auth middleware to all routes
app.use(verifyAuth as any);
app.use(requireTenant as any);

// Get all contracts
app.get("/", async (req: any, res: any) => {
  try {
    const { tenantId } = (req as AuthenticatedRequest).user!;
    
    const contractsSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .orderBy("createdAt", "desc")
      .get();

    const contracts = contractsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(contracts);
  } catch (error) {
    console.error("Error getting contracts:", error);
    res.status(500).json({ message: "Failed to get contracts" });
  }
});

// Get single contract with details
app.get("/:id", async (req: any, res: any) => {
  try {
    const { tenantId } = (req as AuthenticatedRequest).user!;
    const { id } = req.params;

    const contractDoc = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .doc(id)
      .get();

    if (!contractDoc.exists) {
      return res.status(404).json({ message: "Contract not found" });
    }

    const contract = { id: contractDoc.id, ...contractDoc.data() };

    // Get versions
    const versionsSnapshot = await db
      .collection(`${contractDoc.ref.path}/versions`)
      .orderBy("versionNumber", "desc")
      .get();

    const versions = await Promise.all(
      versionsSnapshot.docs.map(async (versionDoc) => {
        const version = { id: versionDoc.id, ...versionDoc.data() };

        // Get line items
        const lineItemsSnapshot = await db
          .collection(`${versionDoc.ref.path}/lineItems`)
          .get();
        const lineItems = lineItemsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Get performance obligations
        const posSnapshot = await db
          .collection(`${versionDoc.ref.path}/performanceObligations`)
          .get();
        const performanceObligations = posSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        return {
          ...version,
          lineItems,
          performanceObligations,
        };
      })
    );

    // Get balances
    const balancesSnapshot = await db
      .collection(`${contractDoc.ref.path}/balances`)
      .orderBy("periodDate", "desc")
      .get();
    const balances = balancesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      ...contract,
      versions,
      balances,
    });
  } catch (error) {
    console.error("Error getting contract:", error);
    res.status(500).json({ message: "Failed to get contract" });
  }
});

// Create contract
app.post("/", async (req: any, res: any) => {
  try {
    const { tenantId, role, uid } = (req as AuthenticatedRequest).user!;

    if (!canWrite(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const {
      customerId,
      contractNumber,
      title,
      startDate,
      endDate,
      totalValue,
      currency,
      paymentTerms,
      lineItems,
      performanceObligations,
    } = req.body;

    if (!customerId || !contractNumber || !title || !startDate || !totalValue) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const now = Timestamp.now();

    // Create contract
    const contractRef = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .add({
        tenantId,
        customerId,
        contractNumber,
        title,
        status: "active",
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : null,
        totalValue: Number(totalValue),
        currency: currency || "BRL",
        paymentTerms,
        createdAt: now,
        updatedAt: now,
      });

    // Create initial version
    const versionRef = await db
      .collection(`${contractRef.path}/versions`)
      .add({
        contractId: contractRef.id,
        versionNumber: 1,
        effectiveDate: Timestamp.fromDate(new Date(startDate)),
        totalValue: Number(totalValue),
        isProspective: true,
        createdBy: uid,
        createdAt: now,
      });

    // Keep contract pointing to current version
    await contractRef.update({
      currentVersionId: versionRef.id,
    });

    // Create line items
    if (lineItems && lineItems.length > 0) {
      for (const item of lineItems) {
        await db.collection(`${versionRef.path}/lineItems`).add({
          contractVersionId: versionRef.id,
          description: item.description,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          recognitionMethod: item.recognitionMethod || "point_in_time",
          isDistinct: true,
          distinctWithinContext: true,
          createdAt: now,
        });
      }
    } else if (!performanceObligations || performanceObligations.length === 0) {
      // Seed default line item so the IFRS 15 engine can generate POs/ledger entries
      await db.collection(`${versionRef.path}/lineItems`).add({
        contractVersionId: versionRef.id,
        description: title || "Default line item",
        quantity: 1,
        unitPrice: Number(totalValue),
        totalPrice: Number(totalValue),
        recognitionMethod: "point_in_time",
        isDistinct: true,
        distinctWithinContext: true,
        createdAt: now,
      });
    }

    // Create performance obligations
    if (performanceObligations && performanceObligations.length > 0) {
      for (const po of performanceObligations) {
        await db.collection(`${versionRef.path}/performanceObligations`).add({
          contractVersionId: versionRef.id,
          description: po.description,
          allocatedPrice: Number(po.allocatedPrice),
          recognitionMethod: po.recognitionMethod,
          justification: po.justification,
          percentComplete: 0,
          recognizedAmount: 0,
          deferredAmount: Number(po.allocatedPrice),
          isSatisfied: false,
          createdAt: now,
        });
      }
    }

    // Update contract with current version
    await contractRef.update({
      currentVersionId: versionRef.id,
    });

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId: uid,
      entityType: "contract",
      entityId: contractRef.id,
      action: "create",
      newValue: req.body,
      createdAt: now,
    });

    res.status(201).json({
      id: contractRef.id,
      versionId: versionRef.id,
    });
  } catch (error) {
    console.error("Error creating contract:", error);
    res.status(500).json({ message: "Failed to create contract" });
  }
});

// Update contract
app.put("/:id", async (req: any, res: any) => {
  try {
    const { tenantId, role, uid } = (req as AuthenticatedRequest).user!;
    const { id } = req.params;

    if (!canWrite(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const contractRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .doc(id);

    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      return res.status(404).json({ message: "Contract not found" });
    }

    const previousValue = contractDoc.data();
    const { status, title, endDate, paymentTerms } = req.body;

    await contractRef.update({
      ...(status && { status }),
      ...(title && { title }),
      ...(endDate && { endDate: Timestamp.fromDate(new Date(endDate)) }),
      ...(paymentTerms !== undefined && { paymentTerms }),
      updatedAt: Timestamp.now(),
    });

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId: uid,
      entityType: "contract",
      entityId: id,
      action: "update",
      previousValue,
      newValue: req.body,
      createdAt: Timestamp.now(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating contract:", error);
    res.status(500).json({ message: "Failed to update contract" });
  }
});

// Delete contract (admin only)
app.delete("/:id", requireRole("admin") as any, async (req: any, res: any) => {
  try {
    const { tenantId, uid } = (req as AuthenticatedRequest).user!;
    const { id } = req.params;

    const contractRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .doc(id);

    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      return res.status(404).json({ message: "Contract not found" });
    }

    // Delete subcollections (versions, line items, POs, balances)
    const versionsSnapshot = await db.collection(`${contractRef.path}/versions`).get();
    for (const versionDoc of versionsSnapshot.docs) {
      // Delete line items
      const lineItemsSnapshot = await db.collection(`${versionDoc.ref.path}/lineItems`).get();
      for (const doc of lineItemsSnapshot.docs) {
        await doc.ref.delete();
      }

      // Delete performance obligations
      const posSnapshot = await db
        .collection(`${versionDoc.ref.path}/performanceObligations`)
        .get();
      for (const doc of posSnapshot.docs) {
        await doc.ref.delete();
      }

      await versionDoc.ref.delete();
    }

    // Delete balances
    const balancesSnapshot = await db.collection(`${contractRef.path}/balances`).get();
    for (const doc of balancesSnapshot.docs) {
      await doc.ref.delete();
    }

    // Delete contract
    await contractRef.delete();

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId: uid,
      entityType: "contract",
      entityId: id,
      action: "delete",
      previousValue: contractDoc.data(),
      createdAt: Timestamp.now(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting contract:", error);
    res.status(500).json({ message: "Failed to delete contract" });
  }
});

// Update performance obligation
app.put(
  "/:contractId/versions/:versionId/pos/:poId",
  async (req: any, res: any) => {
    try {
      const { tenantId, role, uid } = (req as AuthenticatedRequest).user!;
      const { contractId, versionId, poId } = req.params;

      if (!canWrite(role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const poRef = db
        .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
        .doc(contractId)
        .collection("versions")
        .doc(versionId)
        .collection("performanceObligations")
        .doc(poId);

      const poDoc = await poRef.get();
      if (!poDoc.exists) {
        return res.status(404).json({ message: "Performance obligation not found" });
      }

      const previousValue = poDoc.data();
      const { percentComplete, recognizedAmount, deferredAmount, isSatisfied } = req.body;

      await poRef.update({
        ...(percentComplete !== undefined && { percentComplete: Number(percentComplete) }),
        ...(recognizedAmount !== undefined && { recognizedAmount: Number(recognizedAmount) }),
        ...(deferredAmount !== undefined && { deferredAmount: Number(deferredAmount) }),
        ...(isSatisfied !== undefined && { isSatisfied }),
        ...(isSatisfied && { satisfiedDate: Timestamp.now() }),
      });

      // Create audit log
      await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
        tenantId,
        userId: uid,
        entityType: "performance_obligation",
        entityId: poId,
        action: "update",
        previousValue,
        newValue: req.body,
        createdAt: Timestamp.now(),
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating PO:", error);
      res.status(500).json({ message: "Failed to update performance obligation" });
    }
  }
);

export const contractsApi = functions.https.onRequest(app);
