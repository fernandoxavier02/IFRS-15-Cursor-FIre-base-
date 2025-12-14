/**
 * IFRS 15 Reports Cloud Functions
 * 
 * Implements required disclosures:
 * - Disaggregated Revenue (IFRS 15.114-115)
 * - Contract Balances (IFRS 15.116-118)
 * - Remaining Performance Obligations (IFRS 15.120-122)
 */

import * as functions from "firebase-functions";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

// Types
interface DisaggregatedRevenueReport {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  byCategory: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  byGeography: {
    region: string;
    amount: number;
    percentage: number;
  }[];
  byTiming: {
    timing: "point_in_time" | "over_time";
    amount: number;
    percentage: number;
  }[];
  totalRevenue: number;
}

interface ContractBalancesReport {
  tenantId: string;
  asOfDate: Date;
  generatedAt: Date;
  contractAssets: {
    opening: number;
    additions: number;
    transferred: number;
    impairment: number;
    closing: number;
  };
  contractLiabilities: {
    opening: number;
    recognized: number;
    additions: number;
    closing: number;
  };
  receivables: {
    opening: number;
    billed: number;
    collected: number;
    closing: number;
  };
  contracts: {
    contractId: string;
    contractNumber: string;
    customerName: string;
    contractAsset: number;
    contractLiability: number;
    receivable: number;
  }[];
}

interface RemainingObligationsReport {
  tenantId: string;
  asOfDate: Date;
  generatedAt: Date;
  totalRemaining: number;
  byMaturity: {
    period: string;
    amount: number;
    percentage: number;
  }[];
  byContract: {
    contractId: string;
    contractNumber: string;
    customerName: string;
    remainingAmount: number;
    expectedCompletionDate: Date | null;
  }[];
}

/**
 * Generate Disaggregated Revenue Report (IFRS 15.114-115)
 */
export const generateDisaggregatedRevenueReport = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { periodStart, periodEnd } = data;
    const tenantId = context.auth.token.tenantId;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
    }

    if (!periodStart || !periodEnd) {
      throw new functions.https.HttpsError("invalid-argument", "Period start and end dates required");
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const now = new Date();

    const report: DisaggregatedRevenueReport = {
      tenantId,
      periodStart: startDate,
      periodEnd: endDate,
      generatedAt: now,
      byCategory: [],
      byGeography: [],
      byTiming: [],
      totalRevenue: 0,
    };

    try {
      // Get all contracts with their revenue data
      const contractsSnapshot = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
        .get();

      const categoryMap = new Map<string, number>();
      const geographyMap = new Map<string, number>();
      const timingMap = new Map<string, number>();
      let totalRevenue = 0;

      for (const contractDoc of contractsSnapshot.docs) {
        const contract = contractDoc.data();
        
        // Get customer for geography
        let customerCountry = "BR";
        if (contract.customerId) {
          const customerDoc = await db
            .collection(tenantCollection(tenantId, COLLECTIONS.CUSTOMERS))
            .doc(contract.customerId)
            .get();
          if (customerDoc.exists) {
            customerCountry = customerDoc.data()?.country || "BR";
          }
        }

        // Get current version
        if (!contract.currentVersionId) continue;

        const versionDoc = await db
          .collection(`${contractDoc.ref.path}/versions`)
          .doc(contract.currentVersionId)
          .get();

        if (!versionDoc.exists) continue;

        // Get performance obligations
        const posSnapshot = await db
          .collection(`${versionDoc.ref.path}/performanceObligations`)
          .get();

        for (const poDoc of posSnapshot.docs) {
          const po = poDoc.data();

          // Get revenue schedules within period
          const schedulesSnapshot = await db
            .collection(`${poDoc.ref.path}/revenueSchedules`)
            .where("periodStart", ">=", Timestamp.fromDate(startDate))
            .where("periodStart", "<=", Timestamp.fromDate(endDate))
            .get();

          for (const scheduleDoc of schedulesSnapshot.docs) {
            const schedule = scheduleDoc.data();
            const recognizedAmount = Number(schedule.recognizedAmount || 0);

            if (recognizedAmount > 0) {
              totalRevenue += recognizedAmount;

              // By category (using PO description as category)
              const category = po.description.split(" ")[0] || "Other";
              categoryMap.set(category, (categoryMap.get(category) || 0) + recognizedAmount);

              // By geography
              geographyMap.set(customerCountry, (geographyMap.get(customerCountry) || 0) + recognizedAmount);

              // By timing
              const timing = po.recognitionMethod || "point_in_time";
              timingMap.set(timing, (timingMap.get(timing) || 0) + recognizedAmount);
            }
          }
        }
      }

      // Build report arrays
      report.totalRevenue = totalRevenue;

      for (const [category, amount] of categoryMap.entries()) {
        report.byCategory.push({
          category,
          amount,
          percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 10000) / 100 : 0,
        });
      }

      for (const [region, amount] of geographyMap.entries()) {
        report.byGeography.push({
          region,
          amount,
          percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 10000) / 100 : 0,
        });
      }

      for (const [timing, amount] of timingMap.entries()) {
        report.byTiming.push({
          timing: timing as "point_in_time" | "over_time",
          amount,
          percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 10000) / 100 : 0,
        });
      }

      // Sort by amount descending
      report.byCategory.sort((a, b) => b.amount - a.amount);
      report.byGeography.sort((a, b) => b.amount - a.amount);

      return report;
    } catch (error: any) {
      console.error("Error generating disaggregated revenue report:", error);
      throw new functions.https.HttpsError("internal", "Failed to generate report");
    }
  }
);

/**
 * Generate Contract Balances Report (IFRS 15.116-118)
 */
export const generateContractBalancesReport = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { asOfDate } = data;
    // comparePriorPeriod will be implemented in future version
    const tenantId = context.auth.token.tenantId;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
    }

    const reportDate = asOfDate ? new Date(asOfDate) : new Date();
    const now = new Date();

    const report: ContractBalancesReport = {
      tenantId,
      asOfDate: reportDate,
      generatedAt: now,
      contractAssets: { opening: 0, additions: 0, transferred: 0, impairment: 0, closing: 0 },
      contractLiabilities: { opening: 0, recognized: 0, additions: 0, closing: 0 },
      receivables: { opening: 0, billed: 0, collected: 0, closing: 0 },
      contracts: [],
    };

    try {
      // Get all contracts
      const contractsSnapshot = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
        .get();

      for (const contractDoc of contractsSnapshot.docs) {
        const contract = contractDoc.data();

        // Get customer name
        let customerName = "Unknown";
        if (contract.customerId) {
          const customerDoc = await db
            .collection(tenantCollection(tenantId, COLLECTIONS.CUSTOMERS))
            .doc(contract.customerId)
            .get();
          if (customerDoc.exists) {
            customerName = customerDoc.data()?.name || "Unknown";
          }
        }

        // Get latest balance
        const balancesSnapshot = await db
          .collection(`${contractDoc.ref.path}/balances`)
          .orderBy("periodDate", "desc")
          .limit(1)
          .get();

        let contractAsset = 0;
        let contractLiability = 0;
        let receivable = 0;

        if (!balancesSnapshot.empty) {
          const balance = balancesSnapshot.docs[0].data();
          contractAsset = Number(balance.contractAsset || 0);
          contractLiability = Number(balance.contractLiability || 0);
          receivable = Number(balance.receivable || 0);
        }

        report.contractAssets.closing += contractAsset;
        report.contractLiabilities.closing += contractLiability;
        report.receivables.closing += receivable;

        if (contractAsset > 0 || contractLiability > 0 || receivable > 0) {
          report.contracts.push({
            contractId: contractDoc.id,
            contractNumber: contract.contractNumber,
            customerName,
            contractAsset,
            contractLiability,
            receivable,
          });
        }
      }

      // Sort by total exposure descending
      report.contracts.sort((a, b) => 
        (b.contractAsset + b.contractLiability + b.receivable) - 
        (a.contractAsset + a.contractLiability + a.receivable)
      );

      return report;
    } catch (error: any) {
      console.error("Error generating contract balances report:", error);
      throw new functions.https.HttpsError("internal", "Failed to generate report");
    }
  }
);

/**
 * Generate Remaining Performance Obligations Report (IFRS 15.120-122)
 */
export const generateRemainingObligationsReport = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { asOfDate } = data;
    const tenantId = context.auth.token.tenantId;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
    }

    const reportDate = asOfDate ? new Date(asOfDate) : new Date();
    const now = new Date();

    const report: RemainingObligationsReport = {
      tenantId,
      asOfDate: reportDate,
      generatedAt: now,
      totalRemaining: 0,
      byMaturity: [],
      byContract: [],
    };

    // Maturity buckets
    const maturityBuckets = {
      "0-12 months": 0,
      "1-2 years": 0,
      "2-3 years": 0,
      "3+ years": 0,
    };

    try {
      // Get all active contracts
      const contractsSnapshot = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
        .where("status", "in", ["draft", "active", "modified"])
        .get();

      for (const contractDoc of contractsSnapshot.docs) {
        const contract = contractDoc.data();

        // Get customer name
        let customerName = "Unknown";
        if (contract.customerId) {
          const customerDoc = await db
            .collection(tenantCollection(tenantId, COLLECTIONS.CUSTOMERS))
            .doc(contract.customerId)
            .get();
          if (customerDoc.exists) {
            customerName = customerDoc.data()?.name || "Unknown";
          }
        }

        // Get current version
        if (!contract.currentVersionId) continue;

        const versionDoc = await db
          .collection(`${contractDoc.ref.path}/versions`)
          .doc(contract.currentVersionId)
          .get();

        if (!versionDoc.exists) continue;

        // Get performance obligations
        const posSnapshot = await db
          .collection(`${versionDoc.ref.path}/performanceObligations`)
          .where("isSatisfied", "==", false)
          .get();

        let contractRemainingAmount = 0;
        let latestEndDate: Date | null = null;

        for (const poDoc of posSnapshot.docs) {
          const po = poDoc.data();
          const deferredAmount = Number(po.deferredAmount || 0);
          contractRemainingAmount += deferredAmount;

          // Get remaining schedules
          const schedulesSnapshot = await db
            .collection(`${poDoc.ref.path}/revenueSchedules`)
            .where("isRecognized", "==", false)
            .get();

          for (const scheduleDoc of schedulesSnapshot.docs) {
            const schedule = scheduleDoc.data();
            const periodEnd = schedule.periodEnd.toDate();
            const scheduledAmount = Number(schedule.scheduledAmount || 0);

            // Determine maturity bucket
            const monthsFromNow = Math.floor(
              (periodEnd.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            );

            if (monthsFromNow <= 12) {
              maturityBuckets["0-12 months"] += scheduledAmount;
            } else if (monthsFromNow <= 24) {
              maturityBuckets["1-2 years"] += scheduledAmount;
            } else if (monthsFromNow <= 36) {
              maturityBuckets["2-3 years"] += scheduledAmount;
            } else {
              maturityBuckets["3+ years"] += scheduledAmount;
            }

            // Track latest end date
            if (!latestEndDate || periodEnd > latestEndDate) {
              latestEndDate = periodEnd;
            }
          }
        }

        report.totalRemaining += contractRemainingAmount;

        if (contractRemainingAmount > 0) {
          report.byContract.push({
            contractId: contractDoc.id,
            contractNumber: contract.contractNumber,
            customerName,
            remainingAmount: contractRemainingAmount,
            expectedCompletionDate: latestEndDate,
          });
        }
      }

      // Build maturity array
      for (const [period, amount] of Object.entries(maturityBuckets)) {
        report.byMaturity.push({
          period,
          amount,
          percentage: report.totalRemaining > 0 
            ? Math.round((amount / report.totalRemaining) * 10000) / 100 
            : 0,
        });
      }

      // Sort contracts by remaining amount descending
      report.byContract.sort((a, b) => b.remainingAmount - a.remainingAmount);

      return report;
    } catch (error: any) {
      console.error("Error generating remaining obligations report:", error);
      throw new functions.https.HttpsError("internal", "Failed to generate report");
    }
  }
);
