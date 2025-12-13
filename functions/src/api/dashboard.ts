import * as cors from "cors";
import * as express from "express";
import * as functions from "firebase-functions";
import { db } from "../utils/admin";
import { AuthenticatedRequest, requireTenant, verifyAuth } from "../utils/auth-middleware";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(verifyAuth as any);
app.use(requireTenant as any);

// Get dashboard stats
app.get("/stats", async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.user!;

    // Get contracts
    const contractsSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .get();

    const contracts = contractsSnapshot.docs.map((doc) => doc.data());
    const totalContracts = contracts.length;
    const activeContracts = contracts.filter((c) => c.status === "active").length;
    const totalRevenue = contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);

    // Get licenses
    const licensesSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.LICENSES))
      .get();

    const licenses = licensesSnapshot.docs.map((doc) => doc.data());
    const activeLicenses = licenses.filter((l) => l.status === "active").length;
    const licensesInUse = licenses.filter((l) => l.currentIp !== null).length;

    // Calculate recognized/deferred revenue from performance obligations
    let recognizedRevenue = 0;
    let contractAssets = 0;
    let contractLiabilities = 0;

    for (const contractDoc of contractsSnapshot.docs) {
      // Get latest version
      const versionsSnapshot = await db
        .collection(`${contractDoc.ref.path}/versions`)
        .orderBy("versionNumber", "desc")
        .limit(1)
        .get();

      if (!versionsSnapshot.empty) {
        const versionDoc = versionsSnapshot.docs[0];

        // Get performance obligations
        const posSnapshot = await db
          .collection(`${versionDoc.ref.path}/performanceObligations`)
          .get();

        for (const poDoc of posSnapshot.docs) {
          const po = poDoc.data();
          recognizedRevenue += Number(po.recognizedAmount || 0);
        }
      }

      // Get contract balances
      const balancesSnapshot = await db
        .collection(`${contractDoc.ref.path}/balances`)
        .orderBy("periodDate", "desc")
        .limit(1)
        .get();

      if (!balancesSnapshot.empty) {
        const balance = balancesSnapshot.docs[0].data();
        contractAssets += Number(balance.contractAsset || 0);
        contractLiabilities += Number(balance.contractLiability || 0);
      }
    }

    const deferredRevenue = totalRevenue - recognizedRevenue;

    res.json({
      totalContracts,
      activeContracts,
      totalRevenue: totalRevenue.toFixed(2),
      recognizedRevenue: recognizedRevenue.toFixed(2),
      deferredRevenue: deferredRevenue.toFixed(2),
      activeLicenses,
      licensesInUse,
      contractAssets: contractAssets.toFixed(2),
      contractLiabilities: contractLiabilities.toFixed(2),
    });
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ message: "Failed to get dashboard stats" });
  }
});

// Get recent contracts
app.get("/recent-contracts", async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.user!;
    const limit = Number(req.query.limit) || 5;

    const contractsSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .orderBy("createdAt", "desc")
      .limit(limit)
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
app.get("/revenue-waterfall", async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.user!;
    const { startDate, endDate, contractId } = req.query;

    let query = db
      .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
      .where("entryType", "==", "revenue");

    if (contractId) {
      query = query.where("contractId", "==", contractId);
    }

    const entriesSnapshot = await query.orderBy("periodStart").get();

    const waterfallData: Record<
      string,
      {
        period: string;
        recognized: number;
        deferred: number;
        billed: number;
      }
    > = {};

    for (const doc of entriesSnapshot.docs) {
      const entry = doc.data();
      const periodKey = entry.periodStart.toDate().toISOString().substring(0, 7); // YYYY-MM

      if (!waterfallData[periodKey]) {
        waterfallData[periodKey] = {
          period: periodKey,
          recognized: 0,
          deferred: 0,
          billed: 0,
        };
      }

      waterfallData[periodKey].recognized += Number(entry.amount || 0);
    }

    // Get billing data
    const billingsSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
      .where("status", "in", ["invoiced", "paid"])
      .get();

    for (const doc of billingsSnapshot.docs) {
      const billing = doc.data();
      const periodKey = billing.billingDate.toDate().toISOString().substring(0, 7);

      if (!waterfallData[periodKey]) {
        waterfallData[periodKey] = {
          period: periodKey,
          recognized: 0,
          deferred: 0,
          billed: 0,
        };
      }

      waterfallData[periodKey].billed += Number(billing.amount || 0);
    }

    // Calculate deferred amounts
    let cumulativeRecognized = 0;
    let cumulativeBilled = 0;

    const sortedPeriods = Object.keys(waterfallData).sort();
    for (const period of sortedPeriods) {
      cumulativeRecognized += waterfallData[period].recognized;
      cumulativeBilled += waterfallData[period].billed;
      waterfallData[period].deferred = cumulativeBilled - cumulativeRecognized;
    }

    res.json(Object.values(waterfallData));
  } catch (error) {
    console.error("Error getting revenue waterfall:", error);
    res.status(500).json({ message: "Failed to get revenue waterfall" });
  }
});

// Get consolidated balances
app.get("/consolidated-balances", async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.user!;

    const balancesSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONSOLIDATED_BALANCES))
      .orderBy("periodDate", "desc")
      .limit(12) // Last 12 periods
      .get();

    const balances = balancesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(balances);
  } catch (error) {
    console.error("Error getting consolidated balances:", error);
    res.status(500).json({ message: "Failed to get consolidated balances" });
  }
});

export const dashboardApi = functions.https.onRequest(app);
