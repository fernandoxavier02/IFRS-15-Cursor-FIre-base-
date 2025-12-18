import * as functions from "firebase-functions";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

/**
 * Callable maintenance: ensures contracts have a current version and at least one line item
 * so the IFRS 15 engine can generate performance obligations and ledger entries.
 *
 * - If there are no versions: creates versionNumber=1 and sets currentVersionId.
 * - If currentVersionId is missing: points to latest versionNumber.
 * - If both lineItems and performanceObligations are empty in the current version:
 *   seeds a default line item for the contract totalValue.
 * - If status is missing or "draft": sets status to "active".
 */
export const fixContractVersions = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId as string | undefined;
  const userId = context.auth.uid;
  if (!tenantId) {
    throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
  }

  const contractsSnap = await db.collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS)).get();
  let fixed = 0;
  let createdVersions = 0;
  let seededLineItems = 0;

  for (const contractDoc of contractsSnap.docs) {
    const contract = contractDoc.data() as any;
    const now = Timestamp.now();
    const totalValue = Number(contract.totalValue || 0);

    let currentVersionId: string | undefined = contract.currentVersionId;
    let versionRef = currentVersionId
      ? contractDoc.ref.collection(COLLECTIONS.CONTRACT_VERSIONS).doc(currentVersionId)
      : null;

    // If currentVersionId exists, validate it points to an existing doc; otherwise clear it.
    if (versionRef) {
      const currentDoc = await versionRef.get();
      if (!currentDoc.exists) {
        currentVersionId = undefined;
        versionRef = null;
      }
    }

    // Find latest version if needed
    if (!currentVersionId) {
      const versionsSnap = await contractDoc.ref
        .collection(COLLECTIONS.CONTRACT_VERSIONS)
        .orderBy("versionNumber", "desc")
        .limit(1)
        .get();

      if (!versionsSnap.empty) {
        currentVersionId = versionsSnap.docs[0].id;
        versionRef = versionsSnap.docs[0].ref;
      }
    }

    // Create initial version if none exist
    if (!currentVersionId) {
      const effectiveDate =
        (contract.startDate && (contract.startDate as any).toDate?.()) ||
        (contract.startDate ? new Date(contract.startDate) : new Date());

      const newVersionRef = await contractDoc.ref.collection(COLLECTIONS.CONTRACT_VERSIONS).add({
        contractId: contractDoc.id,
        versionNumber: 1,
        effectiveDate: Timestamp.fromDate(effectiveDate),
        totalValue,
        isProspective: true,
        createdBy: userId,
        createdAt: now,
        description: "Initial version created by maintenance",
      });

      currentVersionId = newVersionRef.id;
      versionRef = newVersionRef;
      createdVersions++;
    }

    // Seed a default line item if there is nothing to work with
    if (versionRef) {
      const [lineItemsSnap, posSnap] = await Promise.all([
        versionRef.collection(COLLECTIONS.LINE_ITEMS).limit(1).get(),
        versionRef.collection(COLLECTIONS.PERFORMANCE_OBLIGATIONS).limit(1).get(),
      ]);

      if (lineItemsSnap.empty && posSnap.empty) {
        await versionRef.collection(COLLECTIONS.LINE_ITEMS).add({
          contractVersionId: versionRef.id,
          description: contract.title || "Default line item",
          quantity: 1,
          unitPrice: totalValue,
          totalPrice: totalValue,
          recognitionMethod: "point_in_time",
          isDistinct: true,
          distinctWithinContext: true,
          createdAt: now,
        });
        seededLineItems++;
      }
    }

    const nextStatus = !contract.status || contract.status === "draft" ? "active" : contract.status;
    if (currentVersionId !== contract.currentVersionId || nextStatus !== contract.status) {
      await contractDoc.ref.update({ currentVersionId, status: nextStatus });
      fixed++;
    }
  }

  return { fixed, createdVersions, seededLineItems, total: contractsSnap.size };
});

