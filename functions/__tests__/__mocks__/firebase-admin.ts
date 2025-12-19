/**
 * Mock Firebase Admin SDK for testing
 */

export const mockFirestoreDoc = {
  exists: true,
  ref: {
    update: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
  },
  data: jest.fn(),
  id: 'test-tenant-id',
};

export const mockFirestoreCollection: any = {
  doc: jest.fn(() => mockFirestoreDoc),
  add: jest.fn(),
  get: jest.fn(),
  where: jest.fn(function(this: any) {
    return this;
  }),
};

export const mockFirestore = {
  collection: jest.fn(() => mockFirestoreCollection),
  batch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn(),
  })),
};

export const mockAuth = {
  getUserByEmail: jest.fn(),
  getUser: jest.fn(),
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  setCustomUserClaims: jest.fn(),
};

export const mockAdmin = {
  firestore: jest.fn(() => mockFirestore),
  auth: jest.fn(() => mockAuth),
  apps: [],
  initializeApp: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockFirestoreDoc.exists = true;
  mockFirestoreDoc.ref.update = jest.fn();
  mockFirestoreCollection.doc = jest.fn(() => mockFirestoreDoc);
  mockFirestore.collection = jest.fn(() => mockFirestoreCollection);
});

module.exports = mockAdmin;
