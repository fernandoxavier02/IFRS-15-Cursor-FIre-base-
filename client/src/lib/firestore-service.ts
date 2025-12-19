// Firestore Service Layer for IFRS 15 Revenue Manager
import type {
    AiIngestionJob,
    AiProviderConfig,
    AiReviewTask,
    AuditLog,
    BillingSchedule,
    ConsolidatedBalance,
    Contract,
    ContractLineItem,
    ContractVersion,
    Customer,
    LedgerEntryType,
    License,
    PerformanceObligation,
    RevenueLedgerEntry
} from "@shared/firestore-types";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    QueryConstraint,
    Timestamp,
    updateDoc,
    where
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";

// Collection paths helper
const tenantPath = (tenantId: string) => `tenants/${tenantId}`;
const tenantCollection = (tenantId: string, collectionName: string) =>
  `${tenantPath(tenantId)}/${collectionName}`;

// ==================== GENERIC HELPERS ====================

async function getDocById<T>(path: string, id: string): Promise<T | null> {
  const docRef = doc(db, path, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as T;
}

async function getCollection<T>(
  path: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  console.log(`[getCollection] Buscando na coleção: ${path}`, constraints);
  try {
    const q = query(collection(db, path), ...constraints);
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map((doc) => {
      const data = { id: doc.id, ...doc.data() } as T;
      console.log(`[getCollection] Documento encontrado: ${doc.id}`, data);
      return data;
    });
    console.log(`[getCollection] Total de documentos encontrados: ${results.length}`);
    return results;
  } catch (error: any) {
    console.error(`[getCollection] ERRO ao buscar coleção ${path}:`, error);
    console.error(`[getCollection] Código do erro:`, error.code);
    console.error(`[getCollection] Mensagem:`, error.message);
    console.error(`[getCollection] Stack:`, error.stack);
    // Se for erro de índice faltando, mostrar mensagem mais clara
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      console.error(`[getCollection] ⚠️ ERRO DE ÍNDICE: A query requer um índice composto que pode não existir. Verifique o Firebase Console.`);
    }
    throw error;
  }
}

// Helper para remover campos undefined (Firestore não aceita undefined)
function removeUndefinedFields(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

function normalizeBillingFrequency(value: any): BillingSchedule["frequency"] {
  switch (value) {
    case "monthly":
    case "quarterly":
    case "milestone":
    case "one_time":
      return value;
    case "semi_annual":
    case "semi_annually":
      return "semi_annual";
    case "annual":
    case "annually":
      return "annual";
    default:
      return "monthly";
  }
}

function normalizeLedgerEntryType(value: any): LedgerEntryType {
  const allowed: LedgerEntryType[] = [
    "revenue",
    "deferred_revenue",
    "contract_asset",
    "contract_liability",
    "receivable",
    "cash",
    "financing_income",
    "commission_expense",
  ];
  return allowed.includes(value as LedgerEntryType) ? (value as LedgerEntryType) : "revenue";
}

async function addDocument<T>(path: string, data: Omit<T, "id" | "createdAt">): Promise<string> {
  // Remover campos undefined antes de enviar ao Firestore
  const cleanedData = removeUndefinedFields({
    ...data,
    createdAt: Timestamp.now(),
  });
  const docRef = await addDoc(collection(db, path), cleanedData);
  return docRef.id;
}

async function updateDocument(path: string, id: string, data: Record<string, any>): Promise<void> {
  await updateDoc(doc(db, path, id), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

async function deleteDocument(path: string, id: string): Promise<void> {
  await deleteDoc(doc(db, path, id));
}

// Helper para deletar todas as subcoleções de um documento
async function deleteSubcollections(parentPath: string, parentId: string, subcollectionNames: string[]): Promise<void> {
  for (const subcollectionName of subcollectionNames) {
    const subcollectionPath = `${parentPath}/${parentId}/${subcollectionName}`;
    const subcollectionRef = collection(db, subcollectionPath);
    const snapshot = await getDocs(subcollectionRef);
    
    // Deletar todos os documentos da subcoleção
    const deletePromises = snapshot.docs.map(async (docSnap) => {
      const docPath = `${subcollectionPath}/${docSnap.id}`;
      
      // Verificar se há subcoleções aninhadas (ex: versions/{versionId}/lineItems)
      if (subcollectionName === "versions") {
        // Deletar lineItems e performanceObligations de cada versão
        const versionId = docSnap.id;
        const lineItemsPath = `${subcollectionPath}/${versionId}/lineItems`;
        const posPath = `${subcollectionPath}/${versionId}/performanceObligations`;
        
        const lineItemsSnapshot = await getDocs(collection(db, lineItemsPath));
        const posSnapshot = await getDocs(collection(db, posPath));
        
        const lineItemsPromises = lineItemsSnapshot.docs.map(d => deleteDoc(doc(db, lineItemsPath, d.id)));
        const posPromises = posSnapshot.docs.map(d => deleteDoc(doc(db, posPath, d.id)));
        
        await Promise.all([...lineItemsPromises, ...posPromises]);
      }
      
      return deleteDoc(doc(db, docPath));
    });
    
    await Promise.all(deletePromises);
  }
}

// ==================== CUSTOMERS ====================

export const customerService = {
  async getAll(tenantId: string): Promise<Customer[]> {
    return getCollection<Customer>(
      tenantCollection(tenantId, "customers"),
      orderBy("name")
    );
  },

  async getById(tenantId: string, id: string): Promise<Customer | null> {
    return getDocById<Customer>(tenantCollection(tenantId, "customers"), id);
  },

  async create(tenantId: string, data: Omit<Customer, "id" | "createdAt" | "tenantId">): Promise<string> {
    return addDocument<Customer>(tenantCollection(tenantId, "customers"), {
      ...data,
      tenantId,
    } as any);
  },

  async update(tenantId: string, id: string, data: Partial<Customer>): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "customers"), id, data);
  },

  async delete(tenantId: string, id: string): Promise<void> {
    await deleteDocument(tenantCollection(tenantId, "customers"), id);
  },
};

// ==================== CONTRACTS ====================

export const contractService = {
  async getAll(tenantId: string): Promise<Contract[]> {
    return getCollection<Contract>(
      tenantCollection(tenantId, "contracts"),
      orderBy("createdAt", "desc")
    );
  },

  async getRecent(tenantId: string, count = 5): Promise<Contract[]> {
    return getCollection<Contract>(
      tenantCollection(tenantId, "contracts"),
      orderBy("createdAt", "desc"),
      limit(count)
    );
  },

  async getById(tenantId: string, id: string): Promise<Contract | null> {
    return getDocById<Contract>(tenantCollection(tenantId, "contracts"), id);
  },

  async getByStatus(tenantId: string, status: string): Promise<Contract[]> {
    return getCollection<Contract>(
      tenantCollection(tenantId, "contracts"),
      where("status", "==", status),
      orderBy("createdAt", "desc")
    );
  },

  async create(
    tenantId: string,
    data: Omit<Contract, "id" | "createdAt" | "updatedAt" | "tenantId">
  ): Promise<string> {
    const now = Timestamp.now();
    const status = (data as any).status ?? "active";

    const contractId = await addDocument<Contract>(tenantCollection(tenantId, "contracts"), {
      ...data,
      status,
      tenantId,
      createdAt: now,
      updatedAt: now,
    } as any);
    
    // Criar versão inicial automaticamente
    const versionId = await contractVersionService.create(tenantId, contractId, {
      contractId,
      versionNumber: 1,
      effectiveDate: data.startDate || Timestamp.now(),
      description: "Versão inicial do contrato",
      totalValue: data.totalValue || 0,
      isProspective: true,
    });
    
    // Atualizar o contrato com a versão atual
    await this.update(tenantId, contractId, {
      currentVersionId: versionId,
    } as any);
    
    return contractId;
  },

  async update(tenantId: string, id: string, data: Partial<Contract>): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "contracts"), id, data);
  },

  async delete(tenantId: string, id: string): Promise<void> {
    const contractPath = tenantCollection(tenantId, "contracts");
    
    // Deletar todas as subcoleções relacionadas ao contrato
    await deleteSubcollections(contractPath, id, ["versions"]);
    
    // Deletar também billing schedules e revenue ledger entries relacionados
    const billingSchedules = await billingScheduleService.getByContract(tenantId, id);
    const revenueEntries = await revenueLedgerService.getByContract(tenantId, id);
    
    // Deletar billing schedules relacionados
    for (const schedule of billingSchedules) {
      await billingScheduleService.delete(tenantId, schedule.id);
    }
    
    // Deletar revenue ledger entries relacionados
    for (const entry of revenueEntries) {
      await revenueLedgerService.delete(tenantId, entry.id);
    }
    
    // Finalmente, deletar o contrato principal
    await deleteDocument(contractPath, id);
  },

  // Get full contract with versions and POs
  async getWithDetails(tenantId: string, id: string) {
    const contract = await this.getById(tenantId, id);
    if (!contract) return null;

    const versions = await contractVersionService.getAll(tenantId, id);
    
    // Get details for each version
    const versionsWithDetails = await Promise.all(
      versions.map(async (version) => {
        const lineItems = await lineItemService.getAll(tenantId, id, version.id);
        const performanceObligations = await performanceObligationService.getAll(
          tenantId,
          id,
          version.id
        );
        return { ...version, lineItems, performanceObligations };
      })
    );

    return { ...contract, versions: versionsWithDetails };
  },
};

// ==================== CONTRACT VERSIONS ====================

export const contractVersionService = {
  async getAll(tenantId: string, contractId: string): Promise<ContractVersion[]> {
    return getCollection<ContractVersion>(
      `${tenantCollection(tenantId, "contracts")}/${contractId}/versions`,
      orderBy("versionNumber", "desc")
    );
  },

  async getById(
    tenantId: string,
    contractId: string,
    id: string
  ): Promise<ContractVersion | null> {
    return getDocById<ContractVersion>(
      `${tenantCollection(tenantId, "contracts")}/${contractId}/versions`,
      id
    );
  },

  async create(
    tenantId: string,
    contractId: string,
    data: Omit<ContractVersion, "id" | "createdAt">
  ): Promise<string> {
    return addDocument<ContractVersion>(
      `${tenantCollection(tenantId, "contracts")}/${contractId}/versions`,
      data as any
    );
  },
};

// ==================== LINE ITEMS ====================

export const lineItemService = {
  async getAll(
    tenantId: string,
    contractId: string,
    versionId: string
  ): Promise<ContractLineItem[]> {
    return getCollection<ContractLineItem>(
      `${tenantCollection(tenantId, "contracts")}/${contractId}/versions/${versionId}/lineItems`
    );
  },

  async create(
    tenantId: string,
    contractId: string,
    versionId: string,
    data: Omit<ContractLineItem, "id" | "createdAt">
  ): Promise<string> {
    return addDocument<ContractLineItem>(
      `${tenantCollection(tenantId, "contracts")}/${contractId}/versions/${versionId}/lineItems`,
      data as any
    );
  },
};

// ==================== PERFORMANCE OBLIGATIONS ====================

export const performanceObligationService = {
  async getAll(
    tenantId: string,
    contractId: string,
    versionId: string
  ): Promise<PerformanceObligation[]> {
    return getCollection<PerformanceObligation>(
      `${tenantCollection(tenantId, "contracts")}/${contractId}/versions/${versionId}/performanceObligations`
    );
  },

  async getById(
    tenantId: string,
    contractId: string,
    versionId: string,
    id: string
  ): Promise<PerformanceObligation | null> {
    return getDocById<PerformanceObligation>(
      `${tenantCollection(tenantId, "contracts")}/${contractId}/versions/${versionId}/performanceObligations`,
      id
    );
  },

  async create(
    tenantId: string,
    contractId: string,
    versionId: string,
    data: Omit<PerformanceObligation, "id" | "createdAt">
  ): Promise<string> {
    return addDocument<PerformanceObligation>(
      `${tenantCollection(tenantId, "contracts")}/${contractId}/versions/${versionId}/performanceObligations`,
      data as any
    );
  },

  async update(
    tenantId: string,
    contractId: string,
    versionId: string,
    id: string,
    data: Partial<PerformanceObligation>
  ): Promise<void> {
    await updateDocument(
      `${tenantCollection(tenantId, "contracts")}/${contractId}/versions/${versionId}/performanceObligations`,
      id,
      data
    );
  },
};

// ==================== LICENSES ====================

export const licenseService = {
  async getAll(tenantId: string): Promise<License[]> {
    return getCollection<License>(
      tenantCollection(tenantId, "licenses"),
      orderBy("createdAt", "desc")
    );
  },

  async getActive(tenantId: string): Promise<License[]> {
    return getCollection<License>(
      tenantCollection(tenantId, "licenses"),
      where("status", "==", "active")
    );
  },

  async getById(tenantId: string, id: string): Promise<License | null> {
    return getDocById<License>(tenantCollection(tenantId, "licenses"), id);
  },

  async update(tenantId: string, id: string, data: Partial<License>): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "licenses"), id, data);
  },

  async release(tenantId: string, id: string): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "licenses"), id, {
      currentIp: null,
      currentUserName: null,
      lockedAt: null,
      lastSeenAt: Timestamp.now(),
    });
  },

  async suspend(tenantId: string, id: string): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "licenses"), id, {
      status: "suspended",
      currentIp: null,
      currentUserName: null,
      lockedAt: null,
    });
  },

  async revoke(tenantId: string, id: string): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "licenses"), id, {
      status: "revoked",
      currentIp: null,
      currentUserName: null,
      lockedAt: null,
    });
  },
};

// ==================== AUDIT LOGS ====================

export const auditLogService = {
  async getAll(tenantId: string, limitCount = 100): Promise<AuditLog[]> {
    return getCollection<AuditLog>(
      tenantCollection(tenantId, "auditLogs"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
  },

  async getByEntity(tenantId: string, entityType: string, entityId: string): Promise<AuditLog[]> {
    return getCollection<AuditLog>(
      tenantCollection(tenantId, "auditLogs"),
      where("entityType", "==", entityType),
      where("entityId", "==", entityId),
      orderBy("createdAt", "desc")
    );
  },

  async create(tenantId: string, data: Omit<AuditLog, "id" | "createdAt">): Promise<string> {
    return addDocument<AuditLog>(tenantCollection(tenantId, "auditLogs"), data as any);
  },
};

// ==================== BILLING SCHEDULES ====================

export const billingScheduleService = {
  async getAll(tenantId: string): Promise<BillingSchedule[]> {
    return getCollection<BillingSchedule>(
      tenantCollection(tenantId, "billingSchedules"),
      orderBy("billingDate", "desc")
    );
  },

  async getByContract(tenantId: string, contractId: string): Promise<BillingSchedule[]> {
    return getCollection<BillingSchedule>(
      tenantCollection(tenantId, "billingSchedules"),
      where("contractId", "==", contractId),
      orderBy("billingDate")
    );
  },

  async getUpcoming(tenantId: string, days = 30): Promise<BillingSchedule[]> {
    const now = Timestamp.now();
    const future = Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
    
    return getCollection<BillingSchedule>(
      tenantCollection(tenantId, "billingSchedules"),
      where("status", "==", "scheduled"),
      where("billingDate", ">=", now),
      where("billingDate", "<=", future),
      orderBy("billingDate")
    );
  },

  async create(tenantId: string, data: Omit<BillingSchedule, "id" | "createdAt">): Promise<string> {
    const payload = {
      ...data,
      frequency: normalizeBillingFrequency((data as any).frequency),
    } as any;

    return addDocument<BillingSchedule>(
      tenantCollection(tenantId, "billingSchedules"),
      payload
    );
  },

  async update(tenantId: string, id: string, data: Partial<BillingSchedule>): Promise<void> {
    const payload = { ...data } as any;
    if (payload.frequency !== undefined) {
      payload.frequency = normalizeBillingFrequency(payload.frequency);
    }
    await updateDocument(tenantCollection(tenantId, "billingSchedules"), id, payload);
  },

  async delete(tenantId: string, id: string): Promise<void> {
    await deleteDocument(tenantCollection(tenantId, "billingSchedules"), id);
  },
};

// ==================== REVENUE LEDGER ====================

export const revenueLedgerService = {
  async getAll(tenantId: string): Promise<RevenueLedgerEntry[]> {
    console.log(`[revenueLedgerService.getAll] Buscando ledger entries para tenant: ${tenantId}`);
    const path = tenantCollection(tenantId, "revenueLedgerEntries");
    console.log(`[revenueLedgerService.getAll] Path da coleção: ${path}`);
    try {
      // Tentar primeiro com orderBy, se falhar, buscar sem orderBy
      let entries: RevenueLedgerEntry[];
      try {
        entries = await getCollection<RevenueLedgerEntry>(
          path,
          orderBy("entryDate", "desc")
        );
      } catch (orderByError: any) {
        console.warn(`[revenueLedgerService.getAll] Erro com orderBy, tentando sem ordenação:`, orderByError.message);
        // Se falhar por índice, buscar sem orderBy e ordenar no cliente
        entries = await getCollection<RevenueLedgerEntry>(path);
        // Ordenar por entryDate desc no cliente
        entries.sort((a, b) => {
          const dateA = (a.entryDate as any)?.toDate ? (a.entryDate as any).toDate().getTime() : 
                       (a.entryDate instanceof Date ? a.entryDate.getTime() : 0);
          const dateB = (b.entryDate as any)?.toDate ? (b.entryDate as any).toDate().getTime() : 
                       (b.entryDate instanceof Date ? b.entryDate.getTime() : 0);
          return dateB - dateA;
        });
      }
      console.log(`[revenueLedgerService.getAll] Entries encontrados: ${entries.length}`, entries);
      return entries;
    } catch (error: any) {
      console.error(`[revenueLedgerService.getAll] ERRO ao buscar entries:`, error);
      console.error(`[revenueLedgerService.getAll] Stack:`, error.stack);
      throw error;
    }
  },

  async getByContract(tenantId: string, contractId: string): Promise<RevenueLedgerEntry[]> {
    console.log(`[revenueLedgerService.getByContract] Buscando entries para contrato: ${contractId}, tenant: ${tenantId}`);
    const path = tenantCollection(tenantId, "revenueLedgerEntries");
    console.log(`[revenueLedgerService.getByContract] Path: ${path}`);
    try {
      const entries = await getCollection<RevenueLedgerEntry>(
        path,
        where("contractId", "==", contractId),
        orderBy("entryDate", "desc")
      );
      console.log(`[revenueLedgerService.getByContract] Entries encontrados: ${entries.length}`, entries);
      return entries;
    } catch (error: any) {
      console.error(`[revenueLedgerService.getByContract] ERRO:`, error);
      console.error(`[revenueLedgerService.getByContract] Stack:`, error.stack);
      throw error;
    }
  },

  async getUnposted(tenantId: string): Promise<RevenueLedgerEntry[]> {
    return getCollection<RevenueLedgerEntry>(
      tenantCollection(tenantId, "revenueLedgerEntries"),
      where("isPosted", "==", false),
      orderBy("entryDate")
    );
  },

  async create(tenantId: string, data: Omit<RevenueLedgerEntry, "id" | "createdAt">): Promise<string> {
    const payload = {
      ...data,
      entryType: normalizeLedgerEntryType((data as any).entryType),
    } as any;

    return addDocument<RevenueLedgerEntry>(
      tenantCollection(tenantId, "revenueLedgerEntries"),
      payload
    );
  },

  async update(tenantId: string, id: string, data: Partial<RevenueLedgerEntry>): Promise<void> {
    const payload = { ...data } as any;
    if (payload.entryType !== undefined) {
      payload.entryType = normalizeLedgerEntryType(payload.entryType);
    }
    await updateDocument(tenantCollection(tenantId, "revenueLedgerEntries"), id, payload);
  },

  async delete(tenantId: string, id: string): Promise<void> {
    await deleteDocument(tenantCollection(tenantId, "revenueLedgerEntries"), id);
  },
};

// ==================== AI PROVIDER CONFIGS ====================

export const aiProviderConfigService = {
  async getAll(tenantId: string): Promise<AiProviderConfig[]> {
    return getCollection<AiProviderConfig>(
      tenantCollection(tenantId, "aiProviderConfigs"),
      orderBy("createdAt", "desc")
    );
  },

  async getDefault(tenantId: string): Promise<AiProviderConfig | null> {
    const configs = await getCollection<AiProviderConfig>(
      tenantCollection(tenantId, "aiProviderConfigs"),
      where("isDefault", "==", true),
      limit(1)
    );
    return configs[0] || null;
  },

  async create(tenantId: string, data: Omit<AiProviderConfig, "id" | "createdAt" | "updatedAt">): Promise<string> {
    return addDocument<AiProviderConfig>(
      tenantCollection(tenantId, "aiProviderConfigs"),
      {
        ...data,
        updatedAt: Timestamp.now(),
      } as any
    );
  },

  async update(tenantId: string, id: string, data: Partial<AiProviderConfig>): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "aiProviderConfigs"), id, data);
  },

  async delete(tenantId: string, id: string): Promise<void> {
    await deleteDocument(tenantCollection(tenantId, "aiProviderConfigs"), id);
  },
};

// ==================== AI INGESTION JOBS ====================

export const aiIngestionJobService = {
  async getAll(tenantId: string): Promise<AiIngestionJob[]> {
    return getCollection<AiIngestionJob>(
      tenantCollection(tenantId, "aiIngestionJobs"),
      orderBy("createdAt", "desc")
    );
  },

  async getById(tenantId: string, id: string): Promise<AiIngestionJob | null> {
    return getDocById<AiIngestionJob>(tenantCollection(tenantId, "aiIngestionJobs"), id);
  },

  async create(tenantId: string, data: Omit<AiIngestionJob, "id" | "createdAt">): Promise<string> {
    return addDocument<AiIngestionJob>(
      tenantCollection(tenantId, "aiIngestionJobs"),
      data as any
    );
  },
};

// ==================== AI REVIEW TASKS ====================

export const aiReviewTaskService = {
  async getAll(tenantId: string): Promise<AiReviewTask[]> {
    return getCollection<AiReviewTask>(
      tenantCollection(tenantId, "aiReviewTasks"),
      orderBy("createdAt", "desc")
    );
  },

  async getPending(tenantId: string): Promise<AiReviewTask[]> {
    return getCollection<AiReviewTask>(
      tenantCollection(tenantId, "aiReviewTasks"),
      where("status", "==", "pending"),
      orderBy("createdAt")
    );
  },

  async approve(reviewTaskId: string, reviewedData: any, customerId: string) {
    const approveReview = httpsCallable(functions, "approveReviewAndCreateContract");
    const result = await approveReview({ reviewTaskId, reviewedData, customerId });
    return result.data as { success: boolean; contractId?: string; error?: string };
  },
};

// ==================== DASHBOARD ====================

export const dashboardService = {
  async getStats(tenantId: string) {
    // Get contracts
    const contracts = await contractService.getAll(tenantId);
    const totalContracts = contracts.length;
    const activeContracts = contracts.filter((c) => c.status === "active").length;
    const totalRevenue = contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);

    // Get licenses
    const licenses = await licenseService.getAll(tenantId);
    const activeLicenses = licenses.filter((l) => l.status === "active").length;
    const licensesInUse = licenses.filter((l) => l.currentIp).length;

    // Calculate recognized revenue (simplified)
    let recognizedRevenue = 0;
    for (const contract of contracts) {
      const versions = await contractVersionService.getAll(tenantId, contract.id);
      if (versions.length > 0) {
        const latestVersion = versions[0];
        const pos = await performanceObligationService.getAll(
          tenantId,
          contract.id,
          latestVersion.id
        );
        for (const po of pos) {
          recognizedRevenue += Number(po.recognizedAmount || 0);
        }
      }
    }

    const deferredRevenue = totalRevenue - recognizedRevenue;

    return {
      totalContracts,
      activeContracts,
      totalRevenue: totalRevenue.toFixed(2),
      recognizedRevenue: recognizedRevenue.toFixed(2),
      deferredRevenue: deferredRevenue.toFixed(2),
      activeLicenses,
      licensesInUse,
      contractAssets: "0.00",
      contractLiabilities: "0.00",
    };
  },
};

// ==================== IFRS 15 ENGINE ====================

export const ifrs15Service = {
  async runEngine(contractId: string, versionId?: string, options?: Record<string, any>) {
    const runEngine = httpsCallable(functions, "runIFRS15Engine");
    const result = await runEngine({ contractId, versionId, options });
    return result.data;
  },

  async createContractVersion(
    contractId: string,
    modificationReason: string,
    isProspective = true,
    effectiveDate?: string
  ) {
    const createVersion = httpsCallable(functions, "createContractVersion");
    const result = await createVersion({
      contractId,
      modificationReason,
      isProspective,
      effectiveDate,
    });
    return result.data as { success: boolean; versionId?: string; versionNumber?: number };
  },

  async generateBillingSchedule(
    contractId: string,
    frequency: "monthly" | "quarterly" | "semi_annual" | "annual" = "monthly",
    startDate?: string
  ) {
    const generateSchedule = httpsCallable(functions, "generateBillingSchedule");
    const result = await generateSchedule({ contractId, frequency, startDate });
    return result.data as { success: boolean; schedules?: any[] };
  },

  async syncTenantClaims() {
    const syncClaims = httpsCallable(functions, "syncTenantClaims");
    const result = await syncClaims();
    return result.data as { updated: number; skipped: number; total: number };
  },

  async forceCreateLedgerEntry(contractId?: string, amount?: number) {
    const forceCreate = httpsCallable(functions, "forceCreateLedgerEntry");
    const result = await forceCreate({ contractId, amount });
    return result.data as { success: boolean; entryId?: string; path?: string; tenantId?: string; contractId?: string; queryResult?: number; error?: string };
  },

  async calculateIFRS15All() {
    const calculate = httpsCallable(functions, "calculateIFRS15All");
    const result = await calculate({});
    return result.data as { success: boolean; processed: number; errors: number; total: number; errorDetails?: Array<{ contractId: string; error: string }> };
  },

  async deleteAllLedgerEntries() {
    const deleteFn = httpsCallable(functions, "deleteAllLedgerEntries");
    const result = await deleteFn({});
    return result.data as { success: boolean; deleted: number; message: string };
  },

  async deleteAllContractBalances() {
    const deleteFn = httpsCallable(functions, "deleteAllContractBalances");
    const result = await deleteFn({});
    return result.data as { success: boolean; deleted: number; contractsProcessed: number; message: string };
  },
};

// ==================== MAINTENANCE ====================

export const maintenanceService = {
  async fixContractVersions() {
    const fn = httpsCallable(functions, "fixContractVersions");
    const result = await fn({});
    return result.data as any;
  },

  async syncTenantClaims() {
    const fn = httpsCallable(functions, "syncTenantClaims");
    const result = await fn({});
    return result.data as any;
  },
};

// ==================== REPORTS ====================

export const reportsService = {
  async generateDisaggregatedRevenue(periodStart: string, periodEnd: string) {
    const generateReport = httpsCallable(functions, "generateDisaggregatedRevenueReport");
    const result = await generateReport({ periodStart, periodEnd });
    return result.data;
  },

  async generateContractBalances(asOfDate?: string, comparePriorPeriod = false) {
    const generateReport = httpsCallable(functions, "generateContractBalancesReport");
    const result = await generateReport({ asOfDate, comparePriorPeriod });
    return result.data;
  },

  async generateRemainingObligations(asOfDate?: string) {
    const generateReport = httpsCallable(functions, "generateRemainingObligationsReport");
    const result = await generateReport({ asOfDate });
    return result.data;
  },
};

// ==================== STRIPE FUNCTIONS ====================

export const stripeService = {
  async createCheckoutSession(priceId: string, email: string) {
    const createSession = httpsCallable(functions, "createCheckoutSession");
    const result = await createSession({
      priceId,
      email,
      successUrl: `${window.location.origin}/subscribe?success=true`,
      cancelUrl: `${window.location.origin}/subscribe?canceled=true`,
    });
    return result.data as { sessionId: string; url: string };
  },

  async createPortalSession() {
    const createPortal = httpsCallable(functions, "createPortalSession");
    const result = await createPortal({
      returnUrl: window.location.origin,
    });
    return result.data as { url: string };
  },

  async getSubscriptionPlans() {
    const getPlans = httpsCallable(functions, "getSubscriptionPlans");
    const result = await getPlans({});
    return result.data as { plans: any[] };
  },

  async cancelSubscription() {
    const cancel = httpsCallable(functions, "cancelSubscription");
    const result = await cancel({});
    return result.data as { success: boolean };
  },

  async resumeSubscription() {
    const resume = httpsCallable(functions, "resumeSubscription");
    const result = await resume({});
    return result.data as { success: boolean };
  },
};

// ==================== CONTRACT COSTS ====================

export const contractCostService = {
  async getAll(tenantId: string): Promise<any[]> {
    return getCollection(
      tenantCollection(tenantId, "contractCosts"),
      orderBy("incurredDate", "desc")
    );
  },

  async create(tenantId: string, data: any): Promise<string> {
    return addDocument(tenantCollection(tenantId, "contractCosts"), data);
  },

  async update(tenantId: string, id: string, data: any): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "contractCosts"), id, data);
  },
};

// ==================== EXCHANGE RATES ====================

export const exchangeRateService = {
  async getAll(tenantId: string): Promise<any[]> {
    return getCollection(
      tenantCollection(tenantId, "exchangeRates"),
      orderBy("effectiveDate", "desc")
    );
  },

  async create(tenantId: string, data: any): Promise<string> {
    return addDocument(tenantCollection(tenantId, "exchangeRates"), data);
  },

  async update(tenantId: string, id: string, data: any): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "exchangeRates"), id, data);
  },
};

// ==================== FINANCING COMPONENTS ====================

export const financingComponentService = {
  async getAll(tenantId: string): Promise<any[]> {
    return getCollection(
      tenantCollection(tenantId, "financingComponents"),
      orderBy("createdAt", "desc")
    );
  },

  async create(tenantId: string, data: any): Promise<string> {
    return addDocument(tenantCollection(tenantId, "financingComponents"), data);
  },

  async update(tenantId: string, id: string, data: any): Promise<void> {
    await updateDocument(tenantCollection(tenantId, "financingComponents"), id, data);
  },
};

// ==================== CONSOLIDATED BALANCES ====================

export const consolidatedBalanceService = {
  async getAll(tenantId: string): Promise<ConsolidatedBalance[]> {
    return getCollection<ConsolidatedBalance>(
      tenantCollection(tenantId, "consolidatedBalances"),
      orderBy("periodDate", "desc")
    );
  },

  async getByPeriod(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ConsolidatedBalance[]> {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    return getCollection<ConsolidatedBalance>(
      tenantCollection(tenantId, "consolidatedBalances"),
      where("periodDate", ">=", startTimestamp),
      where("periodDate", "<=", endTimestamp),
      orderBy("periodDate", "asc")
    );
  },

  async getLatest(tenantId: string): Promise<ConsolidatedBalance | null> {
    const balances = await getCollection<ConsolidatedBalance>(
      tenantCollection(tenantId, "consolidatedBalances"),
      orderBy("periodDate", "desc"),
      limit(1)
    );
    return balances.length > 0 ? balances[0] : null;
  },
};

// ==================== TENANT ====================

export const tenantService = {
  async get(tenantId: string) {
    const docRef = doc(db, `tenants/${tenantId}`);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() };
  },

  async update(tenantId: string, data: Record<string, any>): Promise<void> {
    await updateDocument(`tenants`, tenantId, data);
  },

  // Get plan info with current usage counts
  // Note: This fetches all contracts/licenses which can be expensive for large tenants.
  // TODO: Optimize by storing counts in tenant document or using aggregation queries
  // Fallback: returns starter plan defaults if tenant not found
  async getPlanInfo(tenantId: string): Promise<{
    planType: "starter" | "professional" | "enterprise";
    maxContracts: number;
    maxLicenses: number;
    currentContracts: number;
    currentLicenses: number;
  }> {
    try {
      const tenant = await this.get(tenantId);
      if (!tenant) {
        // Fallback: return starter plan defaults
        return {
          planType: "starter",
          maxContracts: 10,
          maxLicenses: 3,
          currentContracts: 0,
          currentLicenses: 0,
        };
      }

      // Get current counts
      // Performance note: For large tenants, consider caching or using tenant.currentContracts/currentLicenses fields
      const contracts = await contractService.getAll(tenantId);
      const licenses = await licenseService.getAll(tenantId);

      const tenantData = tenant as any; // Type assertion for tenant data from Firestore

      return {
        planType: (tenantData.planType as "starter" | "professional" | "enterprise") || "starter",
        maxContracts: tenantData.maxContracts ?? 10,
        maxLicenses: tenantData.maxLicenses ?? 3,
        currentContracts: contracts.length,
        currentLicenses: licenses.filter((l) => l.status === "active").length,
      };
    } catch (error) {
      console.warn("Failed to load plan info, using defaults:", error);
      // Fallback: return starter plan defaults
      return {
        planType: "starter",
        maxContracts: 10,
        maxLicenses: 3,
        currentContracts: 0,
        currentLicenses: 0,
      };
    }
  },
};

// ==================== USERS ====================

export const userService = {
  async getAll(tenantId: string) {
    return getCollection(
      tenantCollection(tenantId, "users"),
      orderBy("createdAt", "desc")
    );
  },

  async getById(tenantId: string, userId: string) {
    return getDocById(tenantCollection(tenantId, "users"), userId);
  },
};

// Export all services
export default {
  customers: customerService,
  contracts: contractService,
  contractVersions: contractVersionService,
  lineItems: lineItemService,
  performanceObligations: performanceObligationService,
  licenses: licenseService,
  auditLogs: auditLogService,
  billingSchedules: billingScheduleService,
  revenueLedger: revenueLedgerService,
  aiProviderConfigs: aiProviderConfigService,
  aiIngestionJobs: aiIngestionJobService,
  aiReviewTasks: aiReviewTaskService,
  dashboard: dashboardService,
  stripe: stripeService,
  ifrs15: ifrs15Service,
  reports: reportsService,
  tenant: tenantService,
  users: userService,
  contractCosts: contractCostService,
  exchangeRates: exchangeRateService,
  financingComponents: financingComponentService,
  consolidatedBalances: consolidatedBalanceService,
  maintenance: maintenanceService,
};
