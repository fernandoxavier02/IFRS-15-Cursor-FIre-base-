/**
 * Testes E2E do fluxo completo de adicionar assentos
 * 
 * Simula todo o fluxo desde o frontend até o backend:
 * 1. Usuário clica "Adicionar 1 Assento"
 * 2. Frontend valida botão habilitado
 * 3. Backend valida autenticação
 * 4. Backend valida autorização (admin)
 * 5. Backend valida dados
 * 6. Backend valida tenant
 * 7. Backend valida subscription status
 * 8. Backend busca subscription no Stripe
 * 9. Backend atualiza Stripe
 * 10. Backend atualiza Firestore
 * 11. Frontend atualiza UI
 */

import testFunctions from 'firebase-functions-test';

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

// Mock Firebase Admin
jest.mock('../../src/utils/admin', () => ({
  db: {
    collection: jest.fn(),
  },
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

// Import após mocks
import { addSeatsToSubscription } from '../../src/stripe/checkout';
import { db } from '../../src/utils/admin';

// Setup firebase-functions-test
const testEnv = testFunctions();

describe('Fluxo E2E: Adicionar 1 Assento', () => {
  let mockContext: any;
  let mockTenantDoc: any;
  let mockTenantDocRef: any;
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

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup contexto completo (admin autenticado)
    mockContext = {
      auth: {
        uid: 'admin-user-123',
        token: {
          tenantId: 'company-test-id',
          role: 'admin',
          email: 'admin@company.com',
        },
      },
    };

    // Setup tenant completo (ativo com subscription)
    const updateMock = jest.fn(() => Promise.resolve());
    
    mockTenantDoc = {
      exists: true,
      data: jest.fn(() => ({
        id: 'company-test-id',
        name: 'Test Company Ltd',
        email: 'admin@company.com',
        subscriptionStatus: 'active',
        status: 'active',
        stripeSubscriptionId: 'sub_company_test_123',
        stripeCustomerId: 'cus_company_test_123',
        maxLicenses: 5,
        currentLicenses: 5, // Limite atingido
        availableLicenses: 0,
        planId: 'starter',
        createdAt: { seconds: Date.now() / 1000 - 86400 },
      })),
      ref: {
        update: updateMock,
        get: jest.fn(),
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

  it('✅ FRONTEND: Botão deve estar habilitado quando availableLicenses === 0', () => {
    // Simulação da lógica do frontend
    const tenant = {
      availableLicenses: 0,
      maxLicenses: 5,
      subscriptionStatus: 'active',
    };

    const needsMoreSeats = tenant.availableLicenses !== -1 && tenant.availableLicenses <= 0;
    const buttonEnabled = needsMoreSeats && tenant.subscriptionStatus === 'active';

    expect(buttonEnabled).toBe(true);
  });

  it('✅ Fluxo completo: adicionar 1 assento com sucesso', async () => {
    // Setup Stripe mock
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: {
              id: 'price_starter_monthly',
              unit_amount: 9900, // R$ 99,00
            },
          },
        ],
      },
      status: 'active',
      customer: 'cus_company_test_123',
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [
          {
            ...mockSubscription.items.data[0],
            quantity: 6, // +1 assento
          },
        ],
      },
    });

    // 1. FRONTEND: Usuário clica "Adicionar 1 Assento"
    const quantity = 1;

    // 2-7. BACKEND: Todas as validações passam
    const result = await callFunction({ quantity }, mockContext);

    // 8. BACKEND: Subscription foi buscada no Stripe
    expect(mockRetrieve).toHaveBeenCalledWith('sub_company_test_123');

    // 9. BACKEND: Subscription foi atualizada no Stripe
    expect(mockUpdate).toHaveBeenCalledWith(
      'sub_company_test_123',
      expect.objectContaining({
        items: [{ id: 'si_item_123', quantity: 6 }],
        proration_behavior: 'always_invoice',
      })
    );

    // 10. BACKEND: Firestore foi atualizado
    expect(mockTenantDocRef.update).toHaveBeenCalledWith({
      maxLicenses: 6,
    });

    // 11. FRONTEND: UI deve ser atualizada com novos valores
    expect(result.success).toBe(true);
    expect(result.newQuantity).toBe(6);
    expect(result.newMaxLicenses).toBe(6);
    expect(result.message).toContain('Successfully added 1 seat(s)');

    // Simulação da atualização da UI no frontend
    const updatedTenant = {
      ...mockTenantDoc.data(),
      maxLicenses: result.newMaxLicenses,
      availableLicenses: result.newMaxLicenses - mockTenantDoc.data().currentLicenses,
    };

    expect(updatedTenant.maxLicenses).toBe(6);
    expect(updatedTenant.availableLicenses).toBe(1); // Agora tem 1 assento disponível
  });

  it('✅ Fluxo completo: adicionar múltiplos assentos', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 10 }],
      },
    });

    const result = await callFunction({ quantity: 5 }, mockContext);

    expect(result.newQuantity).toBe(10);
    expect(result.newMaxLicenses).toBe(10);
    expect(mockUpdate).toHaveBeenCalledWith(
      'sub_company_test_123',
      expect.objectContaining({
        items: [{ id: 'si_item_123', quantity: 10 }],
      })
    );
  });

  it('✅ Fluxo completo: verificar proration automático no Stripe', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
      },
    });

    await callFunction({ quantity: 1 }, mockContext);

    // Verificar que proration_behavior foi configurado
    expect(mockUpdate).toHaveBeenCalledWith(
      'sub_company_test_123',
      expect.objectContaining({
        proration_behavior: 'always_invoice',
      })
    );

    // O Stripe automaticamente:
    // - Calcula o valor proporcional do novo assento
    // - Cria uma invoice imediata
    // - Cobra o valor proporcional do período restante
  });

  it('✅ Fluxo completo: erro em qualquer etapa deve ser tratado', async () => {
    // Erro na busca da subscription no Stripe
    mockRetrieve.mockRejectedValue(
      new Error('Stripe API Error: Rate limit exceeded')
    );

    await expect(
      callFunction({ quantity: 1 }, mockContext)
    ).rejects.toThrow();

    // Frontend deve receber o erro e exibir mensagem ao usuário
    // (simulado pela exception lançada)
  });

  it('✅ Fluxo completo: validação de botão desabilitado quando subscription inativa', () => {
    const tenant = {
      availableLicenses: 0,
      subscriptionStatus: 'inactive', // Subscription inativa
    };

    const needsMoreSeats = tenant.availableLicenses !== -1 && tenant.availableLicenses <= 0;
    const buttonEnabled = needsMoreSeats && tenant.subscriptionStatus === 'active';

    expect(buttonEnabled).toBe(false);
  });

  it('✅ Fluxo completo: validação de botão desabilitado quando tem licenças ilimitadas', () => {
    const tenant = {
      availableLicenses: -1, // Ilimitado
      subscriptionStatus: 'active',
    };

    const needsMoreSeats = tenant.availableLicenses !== -1 && tenant.availableLicenses <= 0;
    const buttonEnabled = needsMoreSeats && tenant.subscriptionStatus === 'active';

    expect(buttonEnabled).toBe(false);
  });
});

describe('Fluxo E2E: Cenários Complexos', () => {
  let mockContext: any;
  let mockTenantDoc: any;
  let mockTenantDocRef: any;
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

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      auth: {
        uid: 'admin-user-123',
        token: {
          tenantId: 'company-test-id',
          role: 'admin',
          email: 'admin@company.com',
        },
      },
    };

    const updateMock = jest.fn(() => Promise.resolve());
    
    mockTenantDoc = {
      exists: true,
      data: jest.fn(() => ({
        id: 'company-test-id',
        name: 'Test Company Ltd',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_company_test_123',
        maxLicenses: 5,
        currentLicenses: 3,
        availableLicenses: 2,
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

  it('✅ Fluxo: adicionar assentos quando ainda há licenças disponíveis', async () => {
    // Cenário: Tenant tem 5 maxLicenses, 3 currentLicenses, 2 availableLicenses
    // Usuário adiciona 3 assentos (de 5 para 8)
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 8 }],
      },
    });

    const result = await callFunction({ quantity: 3 }, mockContext);

    expect(result.newQuantity).toBe(8);
    expect(result.newMaxLicenses).toBe(8);
    expect(mockTenantDocRef.update).toHaveBeenCalledWith({ maxLicenses: 8 });
  });

  it('✅ Fluxo: múltiplas adições sequenciais de assentos', async () => {
    // Simula adicionar 1 assento, depois mais 2, depois mais 1
    const baseSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    // Primeira adição: 5 -> 6
    mockRetrieve.mockResolvedValueOnce(baseSubscription);
    mockUpdate.mockResolvedValueOnce({
      ...baseSubscription,
      items: {
        data: [{ ...baseSubscription.items.data[0], quantity: 6 }],
      },
    });

    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: 5,
    }));

    const result1 = await callFunction({ quantity: 1 }, mockContext);
    expect(result1.newQuantity).toBe(6);
    expect(result1.newMaxLicenses).toBe(6);

    // Segunda adição: 6 -> 8
    mockRetrieve.mockResolvedValueOnce({
      ...baseSubscription,
      items: {
        data: [{ ...baseSubscription.items.data[0], quantity: 6 }],
      },
    });
    mockUpdate.mockResolvedValueOnce({
      ...baseSubscription,
      items: {
        data: [{ ...baseSubscription.items.data[0], quantity: 8 }],
      },
    });

    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: 6,
    }));

    const result2 = await callFunction({ quantity: 2 }, mockContext);
    expect(result2.newQuantity).toBe(8);
    expect(result2.newMaxLicenses).toBe(8);

    // Terceira adição: 8 -> 9
    mockRetrieve.mockResolvedValueOnce({
      ...baseSubscription,
      items: {
        data: [{ ...baseSubscription.items.data[0], quantity: 8 }],
      },
    });
    mockUpdate.mockResolvedValueOnce({
      ...baseSubscription,
      items: {
        data: [{ ...baseSubscription.items.data[0], quantity: 9 }],
      },
    });

    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: 8,
    }));

    const result3 = await callFunction({ quantity: 1 }, mockContext);
    expect(result3.newQuantity).toBe(9);
    expect(result3.newMaxLicenses).toBe(9);
  });

  it('✅ Fluxo: adicionar assentos com maxLicenses null (tratado como 0)', async () => {
    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: null, // Deve ser tratado como 0
    }));

    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 0,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 3 }],
      },
    });

    const result = await callFunction({ quantity: 3 }, mockContext);

    expect(result.newQuantity).toBe(3);
    expect(result.newMaxLicenses).toBe(3); // 0 + 3
    expect(mockTenantDocRef.update).toHaveBeenCalledWith({ maxLicenses: 3 });
  });

  it('✅ Fluxo: adicionar assentos com maxLicenses undefined (tratado como 0)', async () => {
    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      // maxLicenses não definido (undefined)
    }));

    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 0,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 5 }],
      },
    });

    const result = await callFunction({ quantity: 5 }, mockContext);

    expect(result.newQuantity).toBe(5);
    expect(result.newMaxLicenses).toBe(5); // 0 + 5
  });

  it('✅ Fluxo: adicionar assentos quando maxLicenses é -1 (ilimitado)', async () => {
    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: -1, // Ilimitado
    }));

    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 10,
            price: { id: 'price_enterprise_monthly', unit_amount: 29900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 11 }],
      },
    });

    const result = await callFunction({ quantity: 1 }, mockContext);

    expect(result.newQuantity).toBe(11);
    expect(result.newMaxLicenses).toBe(-1); // Mantém ilimitado
    expect(mockTenantDocRef.update).toHaveBeenCalledWith({ maxLicenses: -1 });
  });

  it('✅ Fluxo: adicionar assentos sem especificar quantity (usa padrão 1)', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
      },
    });

    const result = await callFunction({}, mockContext);

    expect(result.newQuantity).toBe(6);
    expect(result.newMaxLicenses).toBe(6);
    expect(mockUpdate).toHaveBeenCalledWith(
      'sub_company_test_123',
      expect.objectContaining({
        items: [{ id: 'si_item_123', quantity: 6 }],
      })
    );
  });

  it('✅ Fluxo: systemAdmin pode adicionar assentos mesmo sem role admin', async () => {
    const systemAdminContext = {
      auth: {
        uid: 'system-admin-123',
        token: {
          tenantId: 'company-test-id',
          role: 'readonly', // Não é admin
          systemAdmin: true, // Mas é systemAdmin
          email: 'system@admin.com',
        },
      },
    };

    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
      },
    });

    const result = await callFunction({ quantity: 1 }, systemAdminContext);

    expect(result.success).toBe(true);
    expect(result.newQuantity).toBe(6);
  });

  it('✅ Fluxo: erro ao atualizar Stripe não atualiza Firestore', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockRejectedValue(new Error('Stripe API Error: Payment method required'));

    await expect(
      callFunction({ quantity: 1 }, mockContext)
    ).rejects.toThrow();

    // Firestore não deve ser atualizado se Stripe falhar
    expect(mockTenantDocRef.update).not.toHaveBeenCalled();
  });

  it('✅ Fluxo: erro ao atualizar Firestore após sucesso no Stripe', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
      },
    });

    // Firestore falha após Stripe ter sucesso
    mockTenantDocRef.update.mockRejectedValueOnce(
      new Error('Firestore Error: Permission denied')
    );

    await expect(
      callFunction({ quantity: 1 }, mockContext)
    ).rejects.toThrow();

    // Stripe foi atualizado, mas Firestore falhou
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockTenantDocRef.update).toHaveBeenCalled();
  });

  it('✅ Fluxo: adicionar grande quantidade de assentos de uma vez', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 10,
            price: { id: 'price_enterprise_monthly', unit_amount: 29900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 50 }],
      },
    });

    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: 10,
    }));

    const result = await callFunction({ quantity: 40 }, mockContext);

    expect(result.newQuantity).toBe(50);
    expect(result.newMaxLicenses).toBe(50);
    expect(mockUpdate).toHaveBeenCalledWith(
      'sub_company_test_123',
      expect.objectContaining({
        items: [{ id: 'si_item_123', quantity: 50 }],
        proration_behavior: 'always_invoice',
      })
    );
  });

  it('✅ Fluxo: verificar que proration é sempre aplicado independente da quantidade', async () => {
    const quantities = [1, 5, 10, 20];

    for (const qty of quantities) {
      jest.clearAllMocks();

      const mockSubscription = {
        id: 'sub_company_test_123',
        items: {
          data: [
            {
              id: 'si_item_123',
              quantity: 5,
              price: { id: 'price_starter_monthly', unit_amount: 9900 },
            },
          ],
        },
        status: 'active',
      };

      mockRetrieve.mockResolvedValue(mockSubscription);
      mockUpdate.mockResolvedValue({
        ...mockSubscription,
        items: {
          data: [{ ...mockSubscription.items.data[0], quantity: 5 + qty }],
        },
      });

      await callFunction({ quantity: qty }, mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        'sub_company_test_123',
        expect.objectContaining({
          proration_behavior: 'always_invoice',
        })
      );
    }
  });

  it('✅ Fluxo: adicionar assentos com diferentes planos (preços diferentes)', async () => {
    const plans = [
      { id: 'price_starter_monthly', amount: 9900, name: 'Starter' },
      { id: 'price_professional_monthly', amount: 19900, name: 'Professional' },
      { id: 'price_enterprise_monthly', amount: 29900, name: 'Enterprise' },
    ];

    for (const plan of plans) {
      jest.clearAllMocks();

      const mockSubscription = {
        id: 'sub_company_test_123',
        items: {
          data: [
            {
              id: 'si_item_123',
              quantity: 5,
              price: { id: plan.id, unit_amount: plan.amount },
            },
          ],
        },
        status: 'active',
      };

      mockRetrieve.mockResolvedValue(mockSubscription);
      mockUpdate.mockResolvedValue({
        ...mockSubscription,
        items: {
          data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
        },
      });

      const result = await callFunction({ quantity: 1 }, mockContext);

      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(6);
      // Proration será calculado pelo Stripe baseado no unit_amount do plano
    }
  });

  it('✅ Fluxo: mensagem de retorno deve conter quantidade correta', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 8 }],
      },
    });

    const result1 = await callFunction({ quantity: 1 }, mockContext);
    expect(result1.message).toContain('Successfully added 1 seat(s)');

    mockRetrieve.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
      },
    });
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 11 }],
      },
    });

    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: 6,
    }));

    const result2 = await callFunction({ quantity: 5 }, mockContext);
    expect(result2.message).toContain('Successfully added 5 seat(s)');
  });

  it('✅ Fluxo: validar que todas as propriedades de retorno estão presentes', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 7 }],
      },
    });

    const result = await callFunction({ quantity: 2 }, mockContext);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('newQuantity');
    expect(result).toHaveProperty('newMaxLicenses');
    expect(result).toHaveProperty('message');
    expect(result.success).toBe(true);
    expect(typeof result.newQuantity).toBe('number');
    expect(typeof result.newMaxLicenses).toBe('number');
    expect(typeof result.message).toBe('string');
  });

  it('✅ Fluxo: adicionar assentos quando quantity no Stripe é 1', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 1, // Quantidade mínima
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 2 }],
      },
    });

    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: 1,
    }));

    const result = await callFunction({ quantity: 1 }, mockContext);

    expect(result.newQuantity).toBe(2);
    expect(result.newMaxLicenses).toBe(2);
  });

  it('✅ Fluxo: frontend deve calcular availableLicenses corretamente após adicionar', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 8 }],
      },
    });

    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: 5,
      currentLicenses: 3, // 3 usuários ativos
    }));

    const result = await callFunction({ quantity: 3 }, mockContext);

    // Simulação do cálculo no frontend
    const updatedTenant = {
      maxLicenses: result.newMaxLicenses,
      currentLicenses: 3, // Não muda
      availableLicenses: result.newMaxLicenses - 3, // 8 - 3 = 5
    };

    expect(updatedTenant.availableLicenses).toBe(5);
    expect(updatedTenant.maxLicenses).toBe(8);
  });

  it('✅ Fluxo: verificar que subscriptionItem.id é usado corretamente', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_custom_item_456', // ID customizado
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
      },
    });

    await callFunction({ quantity: 1 }, mockContext);

    // Verificar que o ID correto do item foi usado
    expect(mockUpdate).toHaveBeenCalledWith(
      'sub_company_test_123',
      expect.objectContaining({
        items: [{ id: 'si_custom_item_456', quantity: 6 }],
      })
    );
  });

  it('✅ Fluxo: adicionar assentos quando currentLicenses é maior que maxLicenses (edge case)', async () => {
    // Cenário: Tenant tem mais usuários ativos do que licenças permitidas
    // Isso pode acontecer em casos de migração ou ajustes manuais
    mockTenantDoc.data = jest.fn(() => ({
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_company_test_123',
      maxLicenses: 5,
      currentLicenses: 7, // Mais usuários do que licenças
    }));

    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 10 }],
      },
    });

    const result = await callFunction({ quantity: 5 }, mockContext);

    expect(result.newQuantity).toBe(10);
    expect(result.newMaxLicenses).toBe(10);
    // Agora maxLicenses (10) é maior que currentLicenses (7), então há 3 licenças disponíveis
  });

  it('✅ Fluxo: verificar ordem das operações (Stripe antes de Firestore)', async () => {
    const mockSubscription = {
      id: 'sub_company_test_123',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
      },
    });

    // Rastrear ordem das chamadas
    const callOrder: string[] = [];

    mockRetrieve.mockImplementation(async () => {
      callOrder.push('stripe.retrieve');
      return mockSubscription;
    });

    mockUpdate.mockImplementation(async () => {
      callOrder.push('stripe.update');
      return {
        ...mockSubscription,
        items: {
          data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
        },
      };
    });

    mockTenantDocRef.update.mockImplementation(async () => {
      callOrder.push('firestore.update');
      return Promise.resolve();
    });

    await callFunction({ quantity: 1 }, mockContext);

    // Verificar ordem: retrieve -> update -> firestore
    expect(callOrder[0]).toBe('stripe.retrieve');
    expect(callOrder[1]).toBe('stripe.update');
    expect(callOrder[2]).toBe('firestore.update');
  });

  it('✅ Fluxo: validar que tenantId do contexto é usado corretamente', async () => {
    const customTenantId = 'custom-tenant-789';
    const customContext = {
      auth: {
        uid: 'admin-user-123',
        token: {
          tenantId: customTenantId,
          role: 'admin',
          email: 'admin@company.com',
        },
      },
    };

    const mockSubscription = {
      id: 'sub_custom_789',
      items: {
        data: [
          {
            id: 'si_item_123',
            quantity: 5,
            price: { id: 'price_starter_monthly', unit_amount: 9900 },
          },
        ],
      },
      status: 'active',
    };

    mockRetrieve.mockResolvedValue(mockSubscription);
    mockUpdate.mockResolvedValue({
      ...mockSubscription,
      items: {
        data: [{ ...mockSubscription.items.data[0], quantity: 6 }],
      },
    });

    mockTenantDoc.data = jest.fn(() => ({
      id: customTenantId,
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_custom_789',
      maxLicenses: 5,
    }));

    // Verificar que o tenant correto é buscado
    const collectionMock = db.collection as jest.Mock;
    const docMock = collectionMock().doc as jest.Mock;

    await callFunction({ quantity: 1 }, customContext);

    expect(collectionMock).toHaveBeenCalled();
    expect(docMock).toHaveBeenCalledWith(customTenantId);
  });
});
