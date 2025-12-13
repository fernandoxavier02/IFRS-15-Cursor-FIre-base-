import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { appConfig } from '../config/app-config.js';

export interface FirestoreDocument {
  id: string;
  [key: string]: unknown;
}

export interface QueryOptions {
  where?: Array<{
    field: string;
    operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'array-contains-any' | 'in' | 'not-in';
    value: unknown;
  }>;
  orderBy?: {
    field: string;
    direction?: 'asc' | 'desc';
  };
  limit?: number;
}

export class FirestoreClient {
  private app: App | null = null;
  private db: Firestore | null = null;
  private initialized: boolean = false;

  /**
   * Initialize Firebase Admin SDK
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Check if already initialized
    if (getApps().length > 0) {
      this.app = getApps()[0];
      this.db = getFirestore(this.app);
      this.initialized = true;
      return;
    }

    // Check for credentials
    if (!appConfig.firebaseProjectId) {
      console.warn('Firebase project ID not configured. Firestore client will not be available.');
      return;
    }

    try {
      if (appConfig.firebaseClientEmail && appConfig.firebasePrivateKey) {
        // Initialize with service account
        this.app = initializeApp({
          credential: cert({
            projectId: appConfig.firebaseProjectId,
            clientEmail: appConfig.firebaseClientEmail,
            privateKey: appConfig.firebasePrivateKey,
          }),
        });
      } else {
        // Try Application Default Credentials
        this.app = initializeApp({
          projectId: appConfig.firebaseProjectId,
        });
      }

      this.db = getFirestore(this.app);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.db !== null;
  }

  /**
   * Get Firestore instance
   */
  private getDb(): Firestore {
    if (!this.db) {
      throw new Error('Firestore not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Convert Firestore document to plain object
   */
  private documentToObject(doc: DocumentSnapshot): FirestoreDocument | null {
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    if (!data) return null;

    // Convert Timestamps to ISO strings
    const processed: Record<string, unknown> = { id: doc.id };
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Timestamp) {
        processed[key] = value.toDate().toISOString();
      } else {
        processed[key] = value;
      }
    }

    return processed as FirestoreDocument;
  }

  /**
   * Get a document by path
   */
  async getDocument(collectionPath: string, documentId: string): Promise<FirestoreDocument | null> {
    const db = this.getDb();
    const doc = await db.collection(collectionPath).doc(documentId).get();
    return this.documentToObject(doc);
  }

  /**
   * Get documents from a collection
   */
  async getCollection(collectionPath: string, options?: QueryOptions): Promise<FirestoreDocument[]> {
    const db = this.getDb();
    let query = db.collection(collectionPath) as FirebaseFirestore.Query;

    if (options?.where) {
      for (const condition of options.where) {
        query = query.where(condition.field, condition.operator, condition.value);
      }
    }

    if (options?.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs
      .map(doc => this.documentToObject(doc))
      .filter((doc): doc is FirestoreDocument => doc !== null);
  }

  /**
   * Query for documents matching specific criteria
   */
  async query(
    collectionPath: string,
    field: string,
    operator: QueryOptions['where'][0]['operator'],
    value: unknown
  ): Promise<FirestoreDocument[]> {
    return this.getCollection(collectionPath, {
      where: [{ field, operator, value }],
    });
  }

  /**
   * Check if a document exists
   */
  async documentExists(collectionPath: string, documentId: string): Promise<boolean> {
    const db = this.getDb();
    const doc = await db.collection(collectionPath).doc(documentId).get();
    return doc.exists;
  }

  /**
   * Count documents in a collection
   */
  async countDocuments(collectionPath: string, options?: QueryOptions): Promise<number> {
    const docs = await this.getCollection(collectionPath, options);
    return docs.length;
  }

  /**
   * Get documents from tenant-scoped collection
   */
  async getTenantCollection(
    tenantId: string,
    collectionName: string,
    options?: QueryOptions
  ): Promise<FirestoreDocument[]> {
    const path = `tenants/${tenantId}/${collectionName}`;
    return this.getCollection(path, options);
  }

  /**
   * Get a specific tenant document
   */
  async getTenantDocument(
    tenantId: string,
    collectionName: string,
    documentId: string
  ): Promise<FirestoreDocument | null> {
    const path = `tenants/${tenantId}/${collectionName}`;
    return this.getDocument(path, documentId);
  }

  // ==================== IFRS 15 Specific Methods ====================

  /**
   * Get all contracts for a tenant
   */
  async getContracts(tenantId: string): Promise<FirestoreDocument[]> {
    return this.getTenantCollection(tenantId, 'contracts');
  }

  /**
   * Get a specific contract
   */
  async getContract(tenantId: string, contractId: string): Promise<FirestoreDocument | null> {
    return this.getTenantDocument(tenantId, 'contracts', contractId);
  }

  /**
   * Get contracts by status
   */
  async getContractsByStatus(tenantId: string, status: string): Promise<FirestoreDocument[]> {
    return this.getTenantCollection(tenantId, 'contracts', {
      where: [{ field: 'status', operator: '==', value: status }],
    });
  }

  /**
   * Get all customers for a tenant
   */
  async getCustomers(tenantId: string): Promise<FirestoreDocument[]> {
    return this.getTenantCollection(tenantId, 'customers');
  }

  /**
   * Get a specific customer
   */
  async getCustomer(tenantId: string, customerId: string): Promise<FirestoreDocument | null> {
    return this.getTenantDocument(tenantId, 'customers', customerId);
  }

  /**
   * Find customer by name
   */
  async findCustomerByName(tenantId: string, name: string): Promise<FirestoreDocument | null> {
    const customers = await this.getTenantCollection(tenantId, 'customers', {
      where: [{ field: 'name', operator: '==', value: name }],
      limit: 1,
    });
    return customers[0] || null;
  }

  /**
   * Get performance obligations for a contract
   */
  async getPerformanceObligations(tenantId: string, contractVersionId: string): Promise<FirestoreDocument[]> {
    return this.getTenantCollection(tenantId, 'performanceObligations', {
      where: [{ field: 'contractVersionId', operator: '==', value: contractVersionId }],
    });
  }

  /**
   * Get revenue ledger entries for a contract
   */
  async getRevenueLedgerEntries(tenantId: string, contractId: string): Promise<FirestoreDocument[]> {
    return this.getTenantCollection(tenantId, 'revenueLedgerEntries', {
      where: [{ field: 'contractId', operator: '==', value: contractId }],
    });
  }

  /**
   * Get billing schedules for a contract
   */
  async getBillingSchedules(tenantId: string, contractId: string): Promise<FirestoreDocument[]> {
    return this.getTenantCollection(tenantId, 'billingSchedules', {
      where: [{ field: 'contractId', operator: '==', value: contractId }],
    });
  }

  /**
   * Get audit logs for an entity
   */
  async getAuditLogs(tenantId: string, entityType: string, entityId: string): Promise<FirestoreDocument[]> {
    return this.getTenantCollection(tenantId, 'auditLogs', {
      where: [
        { field: 'entityType', operator: '==', value: entityType },
        { field: 'entityId', operator: '==', value: entityId },
      ],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<FirestoreDocument | null> {
    const users = await this.getCollection('users', {
      where: [{ field: 'email', operator: '==', value: email }],
      limit: 1,
    });
    return users[0] || null;
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<FirestoreDocument | null> {
    return this.getDocument('tenants', tenantId);
  }

  /**
   * Verify contract was created
   */
  async verifyContractCreated(tenantId: string, contractNumber: string): Promise<{
    exists: boolean;
    contract?: FirestoreDocument;
  }> {
    const contracts = await this.getTenantCollection(tenantId, 'contracts', {
      where: [{ field: 'contractNumber', operator: '==', value: contractNumber }],
      limit: 1,
    });

    return {
      exists: contracts.length > 0,
      contract: contracts[0],
    };
  }

  /**
   * Verify customer was created
   */
  async verifyCustomerCreated(tenantId: string, customerName: string): Promise<{
    exists: boolean;
    customer?: FirestoreDocument;
  }> {
    const customer = await this.findCustomerByName(tenantId, customerName);
    
    return {
      exists: customer !== null,
      customer: customer || undefined,
    };
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantId: string): Promise<{
    contractCount: number;
    customerCount: number;
    activeContracts: number;
  }> {
    const [contracts, customers, activeContracts] = await Promise.all([
      this.countDocuments(`tenants/${tenantId}/contracts`),
      this.countDocuments(`tenants/${tenantId}/customers`),
      this.getContractsByStatus(tenantId, 'active'),
    ]);

    return {
      contractCount: contracts,
      customerCount: customers,
      activeContracts: activeContracts.length,
    };
  }
}

export default FirestoreClient;
