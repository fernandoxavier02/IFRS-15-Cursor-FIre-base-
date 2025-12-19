/**
 * Testes robustos para addSeatsToSubscription
 * 
 * Testa todo o fluxo de adicionar assentos à subscription
 */

// Mock Stripe antes de importar checkout
const mockRetrieve = jest.fn();
const mockUpdate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: mockRetrieve,
      update: mockUpdate,
    },
  }));
});

// Mock Firebase Admin antes de importar checkout
jest.mock('../../src/utils/admin', () => ({
  db: {
    collection: jest.fn(),
  },
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

// Import após mocks
import testFunctions from 'firebase-functions-test';
import { addSeatsToSubscription } from '../../src/stripe/checkout';
import { db } from '../../src/utils/admin';

// Setup firebase-functions-test
const testEnv = testFunctions();

describe('addSeatsToSubscription', () => {
  let mockContext: any;
  let mockTenantDoc: any;
  let mockTenantDocRef: any;

  const mockSubscription = {
    id: 'sub_test123',
    items: {
      data: [
        {
          id: 'si_test123',
          quantity: 5,
          price: {
            id: 'price_test123',
            unit_amount: 10000,
          },
        },
      ],
    },
    status: 'active',
    customer: 'cus_test123',
  };

  let updateMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Stripe mocks
    mockRetrieve.mockImplementation(async (id: string) => {
      if (id === 'sub_notfound') throw new Error('No such subscription');
      if (id === 'sub_noitems') return { ...mockSubscription, items: { data: [] } };
      return mockSubscription;
    });

    mockUpdate.mockImplementation(async (id: string, params: any) => {
      const newQuantity = params.items[0].quantity;
      return {
        ...mockSubscription,
        items: {
          data: [
            {
              ...mockSubscription.items.data[0],
              quantity: newQuantity,
            },
          ],
        },
      };
    });

    // Setup context
    mockContext = {
      auth: {
        uid: 'user123',
        token: {
          tenantId: 'test-tenant-id',
          role: 'admin',
          email: 'admin@test.com',
        },
      },
    };

    // Setup tenant document - criar updateMock antes para poder reutilizar
    updateMock = jest.fn(() => Promise.resolve());
    
    mockTenantDoc = {
      exists: true,
      data: jest.fn(() => ({
        id: 'test-tenant-id',
        name: 'Test Company',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_test123',
        maxLicenses: 5,
        currentLicenses: 4,
        status: 'active',
      })),
      ref: {
        update: updateMock,
      },
    };

    mockTenantDocRef = {
      get: jest.fn(() => Promise.resolve(mockTenantDoc)),
      update: updateMock,
    };

    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn(() => mockTenantDocRef),
    });
  });

  // Helper para chamar a função callable usando firebase-functions-test
  let wrappedFunction: any;

  beforeAll(() => {
    wrappedFunction = testEnv.wrap(addSeatsToSubscription);
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  const callFunction = async (data: any, context: any) => {
    return wrappedFunction(data, context);
  };

  // Helper para verificar código do erro HttpsError
  const expectHttpsError = async (promise: Promise<any>, expectedCode: string) => {
    await expect(promise).rejects.toMatchObject({
      code: expectedCode,
    });
  };

  describe('✅ Validações de Autenticação', () => {
    it('deve rejeitar quando usuário não está autenticado', async () => {
      await expectHttpsError(
        callFunction({ quantity: 1 }, { auth: undefined }),
        'unauthenticated'
      );
    });

    it('deve aceitar quando usuário está autenticado', async () => {
      const result = await callFunction({ quantity: 1 }, mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('✅ Validações de Autorização (Admin)', () => {
    it('deve rejeitar quando usuário não é admin', async () => {
      const nonAdminContext = {
        ...mockContext,
        auth: {
          ...mockContext.auth,
          token: {
            ...mockContext.auth.token,
            role: 'readonly',
          },
        },
      };

      await expectHttpsError(
        callFunction({ quantity: 1 }, nonAdminContext),
        'permission-denied'
      );
    });

    it('deve aceitar quando usuário é admin', async () => {
      const result = await callFunction({ quantity: 1 }, mockContext);
      expect(result.success).toBe(true);
    });

    it('deve aceitar quando usuário é systemAdmin', async () => {
      const systemAdminContext = {
        ...mockContext,
        auth: {
          ...mockContext.auth,
          token: {
            ...mockContext.auth.token,
            role: 'readonly',
            systemAdmin: true,
          },
        },
      };

      const result = await callFunction({ quantity: 1 }, systemAdminContext);
      expect(result.success).toBe(true);
    });
  });

  describe('✅ Validações de Dados (quantity >= 1)', () => {
    it('deve rejeitar quando quantity é menor que 1', async () => {
      await expectHttpsError(
        callFunction({ quantity: 0 }, mockContext),
        'invalid-argument'
      );

      await expectHttpsError(
        callFunction({ quantity: -1 }, mockContext),
        'invalid-argument'
      );
    });

    it('deve aceitar quando quantity é 1 ou maior', async () => {
      const result1 = await callFunction({ quantity: 1 }, mockContext);
      expect(result1.success).toBe(true);

      const result2 = await callFunction({ quantity: 5 }, mockContext);
      expect(result2.success).toBe(true);
    });

    it('deve usar quantity = 1 como padrão', async () => {
      const result = await callFunction({}, mockContext);
      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        'sub_test123',
        expect.objectContaining({
          items: [{ id: 'si_test123', quantity: 6 }],
        })
      );
    });
  });

  describe('✅ Validações de Tenant', () => {
    it('deve rejeitar quando tenant não existe', async () => {
      mockTenantDoc.exists = false;

      await expectHttpsError(
        callFunction({ quantity: 1 }, mockContext),
        'not-found'
      );
    });

    it('deve aceitar quando tenant existe', async () => {
      const result = await callFunction({ quantity: 1 }, mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('✅ Validações de Subscription Status', () => {
    it('deve rejeitar quando subscriptionStatus não é "active"', async () => {
      mockTenantDoc.data = jest.fn(() => ({
        id: 'test-tenant-id',
        subscriptionStatus: 'inactive',
        stripeSubscriptionId: 'sub_test123',
        maxLicenses: 5,
      }));

      await expectHttpsError(
        callFunction({ quantity: 1 }, mockContext),
        'failed-precondition'
      );
    });

    it('deve rejeitar quando subscriptionStatus é "canceled"', async () => {
      mockTenantDoc.data = jest.fn(() => ({
        id: 'test-tenant-id',
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: 'sub_test123',
        maxLicenses: 5,
      }));

      await expectHttpsError(
        callFunction({ quantity: 1 }, mockContext),
        'failed-precondition'
      );
    });

    it('deve aceitar quando subscriptionStatus é "active"', async () => {
      const result = await callFunction({ quantity: 1 }, mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('✅ Validações de Stripe Subscription ID', () => {
    it('deve rejeitar quando stripeSubscriptionId não existe', async () => {
      mockTenantDoc.data = jest.fn(() => ({
        id: 'test-tenant-id',
        subscriptionStatus: 'active',
        stripeSubscriptionId: null,
        maxLicenses: 5,
      }));

      await expectHttpsError(
        callFunction({ quantity: 1 }, mockContext),
        'failed-precondition'
      );
    });

    it('deve aceitar quando stripeSubscriptionId existe', async () => {
      const result = await callFunction({ quantity: 1 }, mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('✅ Integração com Stripe', () => {
    it('deve buscar subscription no Stripe', async () => {
      await callFunction({ quantity: 1 }, mockContext);
      expect(mockRetrieve).toHaveBeenCalledWith('sub_test123');
    });

    it('deve rejeitar quando subscription não existe no Stripe', async () => {
      mockTenantDoc.data = jest.fn(() => ({
        id: 'test-tenant-id',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_notfound',
        maxLicenses: 5,
      }));

      mockRetrieve.mockRejectedValueOnce(new Error('No such subscription'));

      await expect(
        callFunction({ quantity: 1 }, mockContext)
      ).rejects.toThrow();
    });

    it('deve rejeitar quando subscription não tem items', async () => {
      mockTenantDoc.data = jest.fn(() => ({
        id: 'test-tenant-id',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_noitems',
        maxLicenses: 5,
      }));

      await expectHttpsError(
        callFunction({ quantity: 1 }, mockContext),
        'failed-precondition'
      );
    });

    it('deve rejeitar quando subscriptionItem.quantity é inválido (null)', async () => {
      // Mock subscription com quantity null
      mockRetrieve.mockResolvedValueOnce({
        ...mockSubscription,
        items: {
          data: [
            {
              ...mockSubscription.items.data[0],
              quantity: null as any,
            },
          ],
        },
      });

      await expectHttpsError(
        callFunction({ quantity: 1 }, mockContext),
        'failed-precondition'
      );
    });

    it('deve rejeitar quando subscriptionItem.quantity é inválido (undefined)', async () => {
      // Mock subscription com quantity undefined
      mockRetrieve.mockResolvedValueOnce({
        ...mockSubscription,
        items: {
          data: [
            {
              ...mockSubscription.items.data[0],
              quantity: undefined as any,
            },
          ],
        },
      });

      await expectHttpsError(
        callFunction({ quantity: 1 }, mockContext),
        'failed-precondition'
      );
    });

    it('deve atualizar quantity na subscription do Stripe', async () => {
      await callFunction({ quantity: 1 }, mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        'sub_test123',
        expect.objectContaining({
          items: [{ id: 'si_test123', quantity: 6 }],
          proration_behavior: 'always_invoice',
        })
      );
    });

    it('deve usar proration_behavior: always_invoice', async () => {
      await callFunction({ quantity: 2 }, mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        'sub_test123',
        expect.objectContaining({
          proration_behavior: 'always_invoice',
        })
      );
    });
  });

  describe('✅ Atualização do Firestore', () => {
    it('deve atualizar maxLicenses no Firestore', async () => {
      await callFunction({ quantity: 1 }, mockContext);

      expect(updateMock).toHaveBeenCalledWith({
        maxLicenses: 6,
      });
    });

    it('deve calcular maxLicenses corretamente ao adicionar múltiplos assentos', async () => {
      await callFunction({ quantity: 5 }, mockContext);

      expect(updateMock).toHaveBeenCalledWith({
        maxLicenses: 10,
      });
    });

    it('deve manter maxLicenses como -1 quando é ilimitado', async () => {
      mockTenantDoc.data = jest.fn(() => ({
        id: 'test-tenant-id',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_test123',
        maxLicenses: -1,
      }));
      // Garantir que ref.update ainda aponta para o mock
      mockTenantDoc.ref.update = updateMock;

      await callFunction({ quantity: 1 }, mockContext);

      expect(updateMock).toHaveBeenCalledWith({
        maxLicenses: -1,
      });
    });

    it('deve tratar maxLicenses null como 0', async () => {
      mockTenantDoc.data = jest.fn(() => ({
        id: 'test-tenant-id',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_test123',
        maxLicenses: null,
      }));
      // Garantir que ref.update ainda aponta para o mock
      mockTenantDoc.ref.update = updateMock;

      await callFunction({ quantity: 1 }, mockContext);

      expect(updateMock).toHaveBeenCalledWith({
        maxLicenses: 1, // 0 + 1
      });
    });

    it('deve tratar maxLicenses undefined como 0', async () => {
      mockTenantDoc.data = jest.fn(() => ({
        id: 'test-tenant-id',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_test123',
        // maxLicenses não definido (undefined)
      }));
      // Garantir que ref.update ainda aponta para o mock
      mockTenantDoc.ref.update = updateMock;

      await callFunction({ quantity: 1 }, mockContext);

      expect(updateMock).toHaveBeenCalledWith({
        maxLicenses: 1, // 0 + 1
      });
    });
  });

  describe('✅ Retorno da Função', () => {
    it('deve retornar success: true quando bem-sucedido', async () => {
      const result = await callFunction({ quantity: 1 }, mockContext);

      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(6);
      expect(result.newMaxLicenses).toBe(6);
      expect(result.message).toContain('Successfully added');
    });

    it('deve retornar newQuantity correto', async () => {
      const result = await callFunction({ quantity: 5 }, mockContext);

      expect(result.newQuantity).toBe(10);
    });
  });

  describe('✅ Tratamento de Erros', () => {
    it('deve tratar erros do Stripe', async () => {
      mockRetrieve.mockRejectedValueOnce(new Error('Stripe API Error'));

      await expect(
        callFunction({ quantity: 1 }, mockContext)
      ).rejects.toThrow();
    });

    it('deve preservar HttpsErrors do Firebase Functions', async () => {
      mockTenantDoc.exists = false;

      await expect(
        callFunction({ quantity: 1 }, mockContext)
      ).rejects.toThrow();
    });
  });
});
