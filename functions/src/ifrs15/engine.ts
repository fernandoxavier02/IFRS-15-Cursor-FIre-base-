/**
 * IFRS 15 Revenue Recognition Engine
 * 
 * Implements the 5-Step Model:
 * Step 1: Identify the contract(s) with a customer
 * Step 2: Identify the performance obligations in the contract
 * Step 3: Determine the transaction price
 * Step 4: Allocate the transaction price to the performance obligations
 * Step 5: Recognize revenue when (or as) the entity satisfies a performance obligation
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

// Types
interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  standaloneSelllingPrice?: number;
  isDistinct: boolean;
  distinctWithinContext: boolean;
  recognitionMethod: "over_time" | "point_in_time";
  measurementMethod?: "input" | "output";
  deliveryStartDate?: admin.firestore.Timestamp;
  deliveryEndDate?: admin.firestore.Timestamp;
}

interface PerformanceObligation {
  id: string;
  description: string;
  lineItemIds?: string[];
  allocatedPrice: number;
  recognitionMethod: "over_time" | "point_in_time";
  measurementMethod?: "input" | "output";
  percentComplete: number;
  recognizedAmount: number;
  deferredAmount: number;
  isSatisfied: boolean;
  satisfiedDate?: admin.firestore.Timestamp;
  justification?: string;
}

interface ContractVersion {
  id: string;
  contractId: string;
  versionNumber: number;
  effectiveDate: admin.firestore.Timestamp;
  totalValue: number;
  isProspective: boolean;
}

interface Contract {
  id: string;
  tenantId: string;
  customerId: string;
  contractNumber: string;
  title: string;
  status: string;
  startDate: admin.firestore.Timestamp;
  endDate?: admin.firestore.Timestamp;
  totalValue: number;
  currency: string;
  currentVersionId?: string;
}

interface VariableConsideration {
  id: string;
  type: string;
  estimatedAmount: number;
  constraintApplied: boolean;
  constraintReason?: string;
  probability?: number;
}

interface IFRS15Result {
  contractId: string;
  versionId: string;
  calculatedAt: admin.firestore.Timestamp;
  
  // Step 1: Contract identification
  contractExists: boolean;
  contractModified: boolean;
  
  // Step 2: Performance obligations
  performanceObligations: {
    id: string;
    description: string;
    isDistinct: boolean;
    bundled: boolean;
    justification: string;
  }[];
  
  // Step 3: Transaction price
  transactionPrice: number;
  fixedPrice: number;
  variableConsideration: number;
  financingComponent: number;
  constrainedAmount: number;
  
  // Step 4: Allocation
  allocations: {
    poId: string;
    description: string;
    standaloneSelllingPrice: number;
    allocationPercentage: number;
    allocatedAmount: number;
  }[];
  
  // Step 5: Revenue recognition
  revenueSchedule: {
    poId: string;
    periods: {
      periodStart: Date;
      periodEnd: Date;
      scheduledAmount: number;
      recognizedAmount: number;
      deferredAmount: number;
    }[];
  }[];
  
  // Summary
  totalRecognizedRevenue: number;
  totalDeferredRevenue: number;
  contractAsset: number;
  contractLiability: number;
  
  // Audit
  inputs: Record<string, any>;
  warnings: string[];
  errors: string[];
}

// Helper function to calculate months between dates
function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) + 1
  );
}

// Helper to generate monthly periods
function generateMonthlyPeriods(start: Date, end: Date): { start: Date; end: Date }[] {
  const periods: { start: Date; end: Date }[] = [];
  let current = new Date(start);
  
  while (current <= end) {
    const periodStart = new Date(current);
    const periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0); // Last day of month
    
    if (periodEnd > end) {
      periods.push({ start: periodStart, end: end });
    } else {
      periods.push({ start: periodStart, end: periodEnd });
    }
    
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  
  return periods;
}

/**
 * Main IFRS 15 Engine Cloud Function
 * 
 * Executes the 5-Step revenue recognition model
 */
export const runIFRS15Engine = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { contractId, versionId, options = {} } = data;
    const tenantId = context.auth.token.tenantId;
    const userId = context.auth.uid;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
    }

    if (!contractId) {
      throw new functions.https.HttpsError("invalid-argument", "Contract ID required");
    }

    const now = Timestamp.now();
    const result: IFRS15Result = {
      contractId,
      versionId: "",
      calculatedAt: now,
      contractExists: false,
      contractModified: false,
      performanceObligations: [],
      transactionPrice: 0,
      fixedPrice: 0,
      variableConsideration: 0,
      financingComponent: 0,
      constrainedAmount: 0,
      allocations: [],
      revenueSchedule: [],
      totalRecognizedRevenue: 0,
      totalDeferredRevenue: 0,
      contractAsset: 0,
      contractLiability: 0,
      inputs: { contractId, versionId, options, tenantId },
      warnings: [],
      errors: [],
    };

    try {
      // ===============================
      // STEP 1: Identify the Contract
      // ===============================
      
      const contractRef = db
        .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
        .doc(contractId);
      
      const contractDoc = await contractRef.get();
      
      if (!contractDoc.exists) {
        result.errors.push("Contract not found");
        throw new functions.https.HttpsError("not-found", "Contract not found");
      }

      const contract = { id: contractDoc.id, ...contractDoc.data() } as Contract;
      result.contractExists = true;

      // Get version
      const targetVersionId = versionId || contract.currentVersionId;
      if (!targetVersionId) {
        result.errors.push("No contract version found");
        throw new functions.https.HttpsError("failed-precondition", "Contract has no versions");
      }

      result.versionId = targetVersionId;

      const versionRef = contractRef.collection("versions").doc(targetVersionId);
      const versionDoc = await versionRef.get();

      if (!versionDoc.exists) {
        result.errors.push("Contract version not found");
        throw new functions.https.HttpsError("not-found", "Contract version not found");
      }

      const version = { id: versionDoc.id, ...versionDoc.data() } as ContractVersion;
      
      // Check if this is a modified contract
      if (version.versionNumber > 1) {
        result.contractModified = true;
      }

      // ===============================
      // STEP 2: Identify Performance Obligations
      // ===============================
      
      // Get line items
      const lineItemsSnapshot = await versionRef.collection("lineItems").get();
      const lineItems: LineItem[] = lineItemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LineItem));

      // Get existing performance obligations
      const posSnapshot = await versionRef.collection("performanceObligations").get();
      let performanceObligations: PerformanceObligation[] = posSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PerformanceObligation));

      // If no POs exist, create them from line items
      if (performanceObligations.length === 0 && lineItems.length > 0) {
        result.warnings.push("No performance obligations found. Creating from line items.");
        
        for (const item of lineItems) {
          // Each distinct line item becomes a separate PO
          if (item.isDistinct && item.distinctWithinContext) {
            const poRef = await versionRef.collection("performanceObligations").add({
              contractVersionId: targetVersionId,
              description: item.description,
              lineItemIds: [item.id],
              allocatedPrice: item.totalPrice,
              recognitionMethod: item.recognitionMethod,
              measurementMethod: item.measurementMethod,
              percentComplete: 0,
              recognizedAmount: 0,
              deferredAmount: item.totalPrice,
              isSatisfied: false,
              justification: "Auto-generated from distinct line item",
              createdAt: now,
            });

            performanceObligations.push({
              id: poRef.id,
              description: item.description,
              lineItemIds: [item.id],
              allocatedPrice: item.totalPrice,
              recognitionMethod: item.recognitionMethod,
              measurementMethod: item.measurementMethod,
              percentComplete: 0,
              recognizedAmount: 0,
              deferredAmount: item.totalPrice,
              isSatisfied: false,
              justification: "Auto-generated from distinct line item",
            });
          }
        }
      }

      // Map POs for result
      result.performanceObligations = performanceObligations.map(po => ({
        id: po.id,
        description: po.description,
        isDistinct: true,
        bundled: (po.lineItemIds?.length || 0) > 1,
        justification: po.justification || "Deemed distinct",
      }));

      // ===============================
      // STEP 3: Determine Transaction Price
      // ===============================
      
      // Fixed price from contract
      result.fixedPrice = version.totalValue;

      // Get variable considerations
      const vcSnapshot = await versionRef.collection("variableConsiderations").get();
      const variableConsiderations: VariableConsideration[] = vcSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as VariableConsideration));

      for (const vc of variableConsiderations) {
        if (vc.constraintApplied) {
          result.constrainedAmount += vc.estimatedAmount;
          result.warnings.push(`Variable consideration constrained: ${vc.type} - ${vc.constraintReason}`);
        } else {
          result.variableConsideration += vc.estimatedAmount;
        }
      }

      // Check for significant financing component
      const contractStartDate = contract.startDate.toDate();
      const contractEndDate = contract.endDate?.toDate() || new Date(contractStartDate.getFullYear() + 1, contractStartDate.getMonth(), contractStartDate.getDate());
      const contractDurationMonths = monthsBetween(contractStartDate, contractEndDate);
      
      // If contract spans more than 12 months, may have financing component
      if (contractDurationMonths > 12) {
        result.warnings.push(`Contract spans ${contractDurationMonths} months. Consider evaluating significant financing component.`);
      }

      result.transactionPrice = result.fixedPrice + result.variableConsideration - result.constrainedAmount + result.financingComponent;

      // ===============================
      // STEP 4: Allocate Transaction Price
      // ===============================
      
      // Calculate standalone selling prices
      const totalSSP = performanceObligations.reduce((sum, po) => {
        // Use explicit SSP if available from line items, otherwise use allocated price
        const relatedLineItems = lineItems.filter(li => po.lineItemIds?.includes(li.id));
        const ssp = relatedLineItems.reduce((s, li) => s + (li.standaloneSelllingPrice || li.totalPrice), 0);
        return sum + (ssp || po.allocatedPrice);
      }, 0);

      // Allocate based on relative SSP method
      for (const po of performanceObligations) {
        const relatedLineItems = lineItems.filter(li => po.lineItemIds?.includes(li.id));
        const poSSP = relatedLineItems.reduce((s, li) => s + (li.standaloneSelllingPrice || li.totalPrice), 0) || po.allocatedPrice;
        const allocationPercentage = totalSSP > 0 ? poSSP / totalSSP : 1 / performanceObligations.length;
        const allocatedAmount = result.transactionPrice * allocationPercentage;

        result.allocations.push({
          poId: po.id,
          description: po.description,
          standaloneSelllingPrice: poSSP,
          allocationPercentage: Math.round(allocationPercentage * 10000) / 100, // Percentage with 2 decimals
          allocatedAmount: Math.round(allocatedAmount * 100) / 100,
        });

        // Update PO with allocated price
        await versionRef.collection("performanceObligations").doc(po.id).update({
          allocatedPrice: Math.round(allocatedAmount * 100) / 100,
        });
      }

      // ===============================
      // STEP 5: Recognize Revenue
      // ===============================
      
      for (const po of performanceObligations) {
        const allocation = result.allocations.find(a => a.poId === po.id);
        if (!allocation) continue;

        const poAmount = allocation.allocatedAmount;
        const revenueScheduleEntry: IFRS15Result["revenueSchedule"][0] = {
          poId: po.id,
          periods: [],
        };

        if (po.recognitionMethod === "point_in_time") {
          // Point in time - recognize immediately if satisfied
          const period = {
            periodStart: contractStartDate,
            periodEnd: contractStartDate,
            scheduledAmount: poAmount,
            recognizedAmount: po.isSatisfied ? poAmount : 0,
            deferredAmount: po.isSatisfied ? 0 : poAmount,
          };

          revenueScheduleEntry.periods.push(period);

          if (po.isSatisfied) {
            result.totalRecognizedRevenue += poAmount;
          } else {
            result.totalDeferredRevenue += poAmount;
          }
        } else {
          // Over time - generate periodic recognition schedule
          const relatedLineItems = lineItems.filter(li => po.lineItemIds?.includes(li.id));
          let poStartDate = contractStartDate;
          let poEndDate = contractEndDate;

          // Use line item dates if available
          for (const li of relatedLineItems) {
            if (li.deliveryStartDate) {
              poStartDate = li.deliveryStartDate.toDate();
            }
            if (li.deliveryEndDate) {
              poEndDate = li.deliveryEndDate.toDate();
            }
          }

          const periods = generateMonthlyPeriods(poStartDate, poEndDate);
          const totalPeriods = periods.length;
          const amountPerPeriod = Math.round((poAmount / totalPeriods) * 100) / 100;

          let remainingAmount = poAmount;
          const today = new Date();

          for (let i = 0; i < periods.length; i++) {
            const period = periods[i];
            const isLastPeriod = i === periods.length - 1;
            const periodAmount = isLastPeriod ? remainingAmount : amountPerPeriod;
            const isPast = period.end < today;

            const recognizedAmount = isPast ? periodAmount : 0;
            const deferredAmount = isPast ? 0 : periodAmount;

            revenueScheduleEntry.periods.push({
              periodStart: period.start,
              periodEnd: period.end,
              scheduledAmount: periodAmount,
              recognizedAmount,
              deferredAmount,
            });

            result.totalRecognizedRevenue += recognizedAmount;
            result.totalDeferredRevenue += deferredAmount;
            remainingAmount -= amountPerPeriod;
          }
        }

        result.revenueSchedule.push(revenueScheduleEntry);

        // Save revenue schedules to Firestore
        const poRef = versionRef.collection("performanceObligations").doc(po.id);
        
        // Delete existing schedules
        const existingSchedules = await poRef.collection("revenueSchedules").get();
        const batch = db.batch();
        existingSchedules.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Create new schedules
        for (const period of revenueScheduleEntry.periods) {
          await poRef.collection("revenueSchedules").add({
            performanceObligationId: po.id,
            periodStart: Timestamp.fromDate(period.periodStart),
            periodEnd: Timestamp.fromDate(period.periodEnd),
            scheduledAmount: period.scheduledAmount,
            recognizedAmount: period.recognizedAmount,
            isRecognized: period.recognizedAmount > 0,
            recognizedDate: period.recognizedAmount > 0 ? now : null,
            createdAt: now,
          });
        }

        // Update PO with calculated amounts
        await poRef.update({
          recognizedAmount: revenueScheduleEntry.periods.reduce((sum, p) => sum + p.recognizedAmount, 0),
          deferredAmount: revenueScheduleEntry.periods.reduce((sum, p) => sum + p.deferredAmount, 0),
          percentComplete: Math.round((revenueScheduleEntry.periods.reduce((sum, p) => sum + p.recognizedAmount, 0) / allocation.allocatedAmount) * 100),
        });
      }

      // Calculate contract balances
      // Contract Asset = Revenue recognized > Billed (billing > recognition = liability)
      // Contract Liability = Billed > Revenue recognized

      // Get billing information
      const billingsSnapshot = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
        .where("contractId", "==", contractId)
        .where("status", "in", ["invoiced", "paid"])
        .get();

      let totalBilled = 0;
      let totalCashReceived = 0;
      for (const doc of billingsSnapshot.docs) {
        const billing = doc.data();
        totalBilled += Number(billing.amount || 0);
        if (billing.status === "paid") {
          totalCashReceived += Number(billing.paidAmount || billing.amount || 0);
        }
      }

      if (result.totalRecognizedRevenue > totalBilled) {
        result.contractAsset = result.totalRecognizedRevenue - totalBilled;
        result.contractLiability = 0;
      } else {
        result.contractAsset = 0;
        result.contractLiability = totalBilled - result.totalRecognizedRevenue;
      }

      // Save contract balance
      await contractRef.collection("balances").add({
        contractId,
        periodDate: now,
        contractAsset: result.contractAsset,
        contractLiability: result.contractLiability,
        receivable: totalBilled - totalCashReceived,
        revenueRecognized: result.totalRecognizedRevenue,
        cashReceived: totalCashReceived,
        createdAt: now,
      });

      // Create audit log
      await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
        tenantId,
        userId,
        entityType: "contract",
        entityId: contractId,
        action: "recognize",
        newValue: {
          calculationType: "IFRS15_ENGINE",
          transactionPrice: result.transactionPrice,
          recognizedRevenue: result.totalRecognizedRevenue,
          deferredRevenue: result.totalDeferredRevenue,
        },
        createdAt: now,
      });

      return result;
    } catch (error: any) {
      console.error("IFRS 15 Engine error:", error);
      result.errors.push(error.message || "Unknown error");
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError("internal", "Failed to run IFRS 15 engine");
    }
  }
);

/**
 * Create new contract version (for modifications)
 */
export const createContractVersion = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { contractId, modificationReason, isProspective = true, effectiveDate } = data;
    const tenantId = context.auth.token.tenantId;
    const userId = context.auth.uid;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
    }

    if (!contractId || !modificationReason) {
      throw new functions.https.HttpsError("invalid-argument", "Contract ID and modification reason required");
    }

    const now = Timestamp.now();

    const contractRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .doc(contractId);

    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Contract not found");
    }

    const contract = contractDoc.data() as Contract;

    // Get current version to copy
    const currentVersionId = contract.currentVersionId;
    if (!currentVersionId) {
      throw new functions.https.HttpsError("failed-precondition", "Contract has no current version");
    }

    const currentVersionDoc = await contractRef.collection("versions").doc(currentVersionId).get();
    if (!currentVersionDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Current version not found");
    }

    const currentVersion = currentVersionDoc.data() as ContractVersion;

    // Create new version
    const newVersionNumber = currentVersion.versionNumber + 1;
    const newVersionRef = await contractRef.collection("versions").add({
      contractId,
      versionNumber: newVersionNumber,
      effectiveDate: effectiveDate ? Timestamp.fromDate(new Date(effectiveDate)) : now,
      description: `Version ${newVersionNumber} - ${modificationReason}`,
      totalValue: currentVersion.totalValue,
      modificationReason,
      isProspective,
      createdBy: userId,
      createdAt: now,
    });

    // Copy line items
    const lineItemsSnapshot = await contractRef.collection("versions").doc(currentVersionId).collection("lineItems").get();
    for (const doc of lineItemsSnapshot.docs) {
      await newVersionRef.collection("lineItems").add({
        ...doc.data(),
        contractVersionId: newVersionRef.id,
        createdAt: now,
      });
    }

    // Copy performance obligations
    const posSnapshot = await contractRef.collection("versions").doc(currentVersionId).collection("performanceObligations").get();
    for (const doc of posSnapshot.docs) {
      await newVersionRef.collection("performanceObligations").add({
        ...doc.data(),
        contractVersionId: newVersionRef.id,
        createdAt: now,
      });
    }

    // Update contract status and current version
    await contractRef.update({
      status: "modified",
      currentVersionId: newVersionRef.id,
      updatedAt: now,
    });

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId,
      entityType: "contract_version",
      entityId: newVersionRef.id,
      action: "create",
      newValue: {
        versionNumber: newVersionNumber,
        modificationReason,
        isProspective,
      },
      createdAt: now,
    });

    return {
      success: true,
      versionId: newVersionRef.id,
      versionNumber: newVersionNumber,
    };
  }
);

/**
 * Generate billing schedule for a contract
 */
export const generateBillingSchedule = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { contractId, frequency = "monthly", startDate } = data;
    const tenantId = context.auth.token.tenantId;
    const userId = context.auth.uid;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
    }

    if (!contractId) {
      throw new functions.https.HttpsError("invalid-argument", "Contract ID required");
    }

    const now = Timestamp.now();

    const contractRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .doc(contractId);

    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Contract not found");
    }

    const contract = contractDoc.data() as Contract;
    const contractStartDate = startDate ? new Date(startDate) : contract.startDate.toDate();
    const contractEndDate = contract.endDate?.toDate() || new Date(contractStartDate.getFullYear() + 1, contractStartDate.getMonth(), contractStartDate.getDate());

    // Calculate number of billing periods
    let periodMonths: number;
    switch (frequency) {
      case "monthly": periodMonths = 1; break;
      case "quarterly": periodMonths = 3; break;
      case "semi_annual": periodMonths = 6; break;
      case "annual": periodMonths = 12; break;
      default: periodMonths = 1;
    }

    const totalMonths = monthsBetween(contractStartDate, contractEndDate);
    const numberOfPeriods = Math.ceil(totalMonths / periodMonths);
    const amountPerPeriod = Math.round((contract.totalValue / numberOfPeriods) * 100) / 100;

    // Delete existing billing schedules for this contract
    const existingSchedules = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
      .where("contractId", "==", contractId)
      .get();

    const batch = db.batch();
    existingSchedules.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Create new billing schedules
    let currentDate = new Date(contractStartDate);
    let remainingAmount = contract.totalValue;
    const schedules = [];

    for (let i = 0; i < numberOfPeriods; i++) {
      const billingDate = new Date(currentDate);
      const dueDate = new Date(currentDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms

      const isLastPeriod = i === numberOfPeriods - 1;
      const amount = isLastPeriod ? remainingAmount : amountPerPeriod;

      const scheduleRef = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
        .add({
          tenantId,
          contractId,
          billingDate: Timestamp.fromDate(billingDate),
          dueDate: Timestamp.fromDate(dueDate),
          amount,
          currency: contract.currency,
          frequency,
          status: "scheduled",
          notes: `Billing ${i + 1} of ${numberOfPeriods}`,
          createdAt: now,
        });

      schedules.push({
        id: scheduleRef.id,
        billingDate,
        dueDate,
        amount,
      });

      remainingAmount -= amountPerPeriod;
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + periodMonths, currentDate.getDate());
    }

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId,
      entityType: "billing_schedule",
      entityId: contractId,
      action: "create",
      newValue: {
        frequency,
        numberOfPeriods,
        totalAmount: contract.totalValue,
      },
      createdAt: now,
    });

    return {
      success: true,
      schedules,
    };
  }
);
