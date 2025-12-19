// Global test setup
import * as admin from 'firebase-admin';

// Mock Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'test-project',
  });
}

// Increase timeout for integration tests
jest.setTimeout(30000);
