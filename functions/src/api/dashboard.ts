import cors from "cors";
import express from "express";
import * as functions from "firebase-functions";
import { LedgerEntryType } from "@shared/firestore-types";
import { db } from "../utils/admin";
import { AuthenticatedRequest, requireTenant, verifyAuth } from "../utils/auth-middleware";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

const app = express();
app.use(cors({ 
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(verifyAuth as any);
app.use(requireTenant as any);

// Get dashboard stats
app.get("/stats", async (req: any, res: any) => {
  try {
    const { tenantId } = (req as AuthenticatedRequest).user!;

    // Get contracts
    const contractsSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .get();

    const contracts = contractsSnapshot.docs.map((doc) => doc.data());
    const totalContracts = contracts.length;
    const activeContracts = contracts.filter((c) => c.status === "active").length;

    // Calculate revenue totals
    let totalRevenue = 0;
    let recognizedRevenue = 0;
    let deferredRevenue = 0;

    for (const contract of contracts) {
      totalRevenue += Number(contract.totalValue || 0);
    }

    // Get revenue ledger entries for recognized revenue
    const revenueEntriesSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
      .where("entryType", "==", LedgerEntryType.REVENUE)
      .where("isPosted", "==", true)
      .get();

    for (const doc of revenueEntriesSnapshot.docs) {
      recognizedRevenue += Number(doc.data().amount || 0);
    }

    deferredRevenue = totalRevenue - recognizedRevenue;

    // Get licenses
    const licensesSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.LICENSES))
      .get();

    const licenses = licensesSnapshot.docs.map((doc) => doc.data());
    const activeLicenses = licenses.filter((l) => l.status === "active").length;
    const licensesInUse = licenses.filter((l) => l.currentIp !== null).length;

    // Get contract balances for assets/liabilities
    let contractAssets = 0;
    let contractLiabilities = 0;

    const balancesSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONSOLIDATED_BALANCES))
      .orderBy("periodDate", "desc")
      .limit(1)
      .get();

    if (!balancesSnapshot.empty) {
      const latestBalance = balancesSnapshot.docs[0].data();
      contractAssets = Number(latestBalance.totalContractAssets || 0);
      contractLiabilities = Number(latestBalance.totalContractLiabilities || 0);
    }

    res.json({
      totalContracts,
      activeContracts,
      totalRevenue,
      recognizedRevenue,
      deferredRevenue,
      activeLicenses,
      licensesInUse,
      contractAssets,
      contractLiabilities,
    });
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ message: "Failed to get dashboard stats" });
  }
});

// Get recent contracts
app.get("/recent-contracts", async (req: any, res: any) => {
  try {
    const { tenantId } = (req as AuthenticatedRequest).user!;

    const contractsSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    const contracts = contractsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(contracts);
  } catch (error) {
    console.error("Error getting recent contracts:", error);
    res.status(500).json({ message: "Failed to get recent contracts" });
  }
});

// Get revenue waterfall data
app.get("/revenue-waterfall", async (req: any, res: any) => {
  try {
    const { tenantId } = (req as AuthenticatedRequest).user!;
    const { contractId } = req.query;

    let query = db
      .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
      .where("entryType", "==", LedgerEntryType.REVENUE);

    if (contractId) {
      query = query.where("contractId", "==", contractId);
    }

    const entriesSnapshot = await query.orderBy("entryDate", "asc").get();

    const entries = entriesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Group by period
    const periodMap = new Map<string, { recognized: number; deferred: number }>();

    for (const entry of entries) {
      const data = entry as any;
      const period = new Date(data.periodStart.toDate()).toISOString().slice(0, 7); // YYYY-MM
      const existing = periodMap.get(period) || { recognized: 0, deferred: 0 };
      existing.recognized += Number(data.amount || 0);
      periodMap.set(period, existing);
    }

    // Get deferred revenue entries
    const deferredSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
      .where("entryType", "==", LedgerEntryType.DEFERRED_REVENUE)
      .orderBy("entryDate", "asc")
      .get();

    for (const doc of deferredSnapshot.docs) {
      const data = doc.data();
      const period = new Date(data.periodStart.toDate()).toISOString().slice(0, 7);
      const existing = periodMap.get(period) || { recognized: 0, deferred: 0 };
      existing.deferred += Number(data.amount || 0);
      periodMap.set(period, existing);
    }

    const waterfall = Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, values]) => ({
        period,
        recognized: values.recognized,
        deferred: values.deferred,
      }));

    res.json(waterfall);
  } catch (error) {
    console.error("Error getting revenue waterfall:", error);
    res.status(500).json({ message: "Failed to get revenue waterfall" });
  }
});

// Get performance obligation summary
app.get("/po-summary", async (req: any, res: any) => {
  try {
    const { tenantId } = (req as AuthenticatedRequest).user!;

    // Get all contracts with their versions
    const contractsSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .where("status", "==", "active")
      .get();

    let totalPOs = 0;
    let satisfiedPOs = 0;
    let totalAllocated = 0;
    let totalRecognized = 0;

    for (const contractDoc of contractsSnapshot.docs) {
      const versionsSnapshot = await db
        .collection(`${contractDoc.ref.path}/versions`)
        .orderBy("versionNumber", "desc")
        .limit(1)
        .get();

      if (!versionsSnapshot.empty) {
        const versionDoc = versionsSnapshot.docs[0];
        const posSnapshot = await db
          .collection(`${versionDoc.ref.path}/performanceObligations`)
          .get();

        for (const poDoc of posSnapshot.docs) {
          const po = poDoc.data();
          totalPOs++;
          if (po.isSatisfied) satisfiedPOs++;
          totalAllocated += Number(po.allocatedPrice || 0);
          totalRecognized += Number(po.recognizedAmount || 0);
        }
      }
    }

    res.json({
      totalPOs,
      satisfiedPOs,
      pendingPOs: totalPOs - satisfiedPOs,
      totalAllocated,
      totalRecognized,
      totalDeferred: totalAllocated - totalRecognized,
    });
  } catch (error) {
    console.error("Error getting PO summary:", error);
    res.status(500).json({ message: "Failed to get PO summary" });
  }
});

export const dashboardApi = functions.https.onRequest(app);
