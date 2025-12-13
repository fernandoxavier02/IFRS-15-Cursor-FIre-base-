import * as cors from "cors";
import * as express from "express";
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
app.use(cors({ origin: true }));
app.use(express.json());
app.use(verifyAuth as any);
app.use(requireTenant as any);

// Get all customers
app.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.user!;

    const customersSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CUSTOMERS))
      .orderBy("name")
      .get();

    const customers = customersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(customers);
  } catch (error) {
    console.error("Error getting customers:", error);
    res.status(500).json({ message: "Failed to get customers" });
  }
});

// Get single customer
app.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const customerDoc = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CUSTOMERS))
      .doc(id)
      .get();

    if (!customerDoc.exists) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({ id: customerDoc.id, ...customerDoc.data() });
  } catch (error) {
    console.error("Error getting customer:", error);
    res.status(500).json({ message: "Failed to get customer" });
  }
});

// Create customer
app.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, role, uid } = req.user!;

    if (!canWrite(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const { name, country, currency, taxId, creditRating, contactEmail, contactPhone, billingAddress } =
      req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const now = Timestamp.now();

    const customerRef = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CUSTOMERS))
      .add({
        tenantId,
        name,
        country: country || "BR",
        currency: currency || "BRL",
        taxId,
        creditRating,
        contactEmail,
        contactPhone,
        billingAddress,
        createdAt: now,
      });

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId: uid,
      entityType: "customer",
      entityId: customerRef.id,
      action: "create",
      newValue: req.body,
      createdAt: now,
    });

    res.status(201).json({ id: customerRef.id });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ message: "Failed to create customer" });
  }
});

// Update customer
app.put("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, role, uid } = req.user!;
    const { id } = req.params;

    if (!canWrite(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const customerRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.CUSTOMERS))
      .doc(id);

    const customerDoc = await customerRef.get();
    if (!customerDoc.exists) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const previousValue = customerDoc.data();
    const { name, country, currency, taxId, creditRating, contactEmail, contactPhone, billingAddress } =
      req.body;

    await customerRef.update({
      ...(name && { name }),
      ...(country && { country }),
      ...(currency && { currency }),
      ...(taxId !== undefined && { taxId }),
      ...(creditRating !== undefined && { creditRating }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(contactPhone !== undefined && { contactPhone }),
      ...(billingAddress !== undefined && { billingAddress }),
    });

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId: uid,
      entityType: "customer",
      entityId: id,
      action: "update",
      previousValue,
      newValue: req.body,
      createdAt: Timestamp.now(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ message: "Failed to update customer" });
  }
});

// Delete customer (admin only)
app.delete("/:id", requireRole("admin") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, uid } = req.user!;
    const { id } = req.params;

    const customerRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.CUSTOMERS))
      .doc(id);

    const customerDoc = await customerRef.get();
    if (!customerDoc.exists) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Check if customer has contracts
    const contractsSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .where("customerId", "==", id)
      .limit(1)
      .get();

    if (!contractsSnapshot.empty) {
      return res.status(400).json({ message: "Cannot delete customer with existing contracts" });
    }

    await customerRef.delete();

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId: uid,
      entityType: "customer",
      entityId: id,
      action: "delete",
      previousValue: customerDoc.data(),
      createdAt: Timestamp.now(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ message: "Failed to delete customer" });
  }
});

export const customersApi = functions.https.onRequest(app);
