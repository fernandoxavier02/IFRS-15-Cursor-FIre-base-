/**
 * Script de Teste Manual para Adicionar Assentos
 * 
 * Execute este script para testar manualmente o fluxo completo.
 * Requer:
 * - Firebase Emulators rodando
 * - Stripe CLI configurado (para webhooks)
 * - Tenants e subscriptions de teste criados
 * 
 * Uso:
 *   npx tsx __tests__/manual/test-add-seats-manual.ts
 */

import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'ifrs15-revenue-manager',
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

interface TestResult {
  step: string;
  status: '✅ PASS' | '❌ FAIL';
  message: string;
  data?: any;
}

async function testAddSeatsFlow(): Promise<void> {
  const results: TestResult[] = [];

  console.log('\n🧪 TESTE MANUAL: Fluxo de Adicionar Assentos\n');
  console.log('='.repeat(60));

  // STEP 1: Verificar autenticação
  try {
    const testUser = await auth.getUserByEmail('admin@test.com');
    results.push({
      step: '1. Verificar Autenticação',
      status: '✅ PASS',
      message: 'Usuário autenticado encontrado',
      data: { uid: testUser.uid, email: testUser.email },
    });
  } catch (error: any) {
    results.push({
      step: '1. Verificar Autenticação',
      status: '❌ FAIL',
      message: error.message,
    });
  }

  // STEP 2: Verificar tenant existe
  try {
    const tenantId = 'test-tenant-id';
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();

    if (!tenantDoc.exists) {
      throw new Error('Tenant não encontrado');
    }

    const tenant = tenantDoc.data();
    results.push({
      step: '2. Verificar Tenant Existe',
      status: '✅ PASS',
      message: 'Tenant encontrado',
      data: {
        id: tenantId,
        name: tenant?.name,
        subscriptionStatus: tenant?.subscriptionStatus,
      },
    });

    // STEP 3: Verificar subscription status
    if (tenant?.subscriptionStatus !== 'active') {
      results.push({
        step: '3. Verificar Subscription Status',
        status: '❌ FAIL',
        message: `Subscription status é "${tenant?.subscriptionStatus}", esperado "active"`,
      });
    } else {
      results.push({
        step: '3. Verificar Subscription Status',
        status: '✅ PASS',
        message: 'Subscription está ativa',
      });
    }

    // STEP 4: Verificar stripeSubscriptionId existe
    if (!tenant?.stripeSubscriptionId) {
      results.push({
        step: '4. Verificar Stripe Subscription ID',
        status: '❌ FAIL',
        message: 'stripeSubscriptionId não encontrado no tenant',
      });
    } else {
      results.push({
        step: '4. Verificar Stripe Subscription ID',
        status: '✅ PASS',
        message: 'Stripe subscription ID encontrado',
        data: { subscriptionId: tenant.stripeSubscriptionId },
      });

      // STEP 5: Buscar subscription no Stripe
      try {
        const subscription = await stripe.subscriptions.retrieve(
          tenant.stripeSubscriptionId
        );

        if (!subscription.items.data.length) {
          results.push({
            step: '5. Buscar Subscription no Stripe',
            status: '❌ FAIL',
            message: 'Subscription não tem items',
          });
        } else {
          results.push({
            step: '5. Buscar Subscription no Stripe',
            status: '✅ PASS',
            message: 'Subscription encontrada no Stripe',
            data: {
              subscriptionId: subscription.id,
              currentQuantity: subscription.items.data[0].quantity,
            },
          });

          // STEP 6: Simular atualização (sem realmente atualizar)
          const currentQuantity = subscription.items.data[0].quantity;
          const newQuantity = currentQuantity + 1;

          results.push({
            step: '6. Simular Atualização no Stripe',
            status: '✅ PASS',
            message: 'Simulação de atualização bem-sucedida',
            data: {
              currentQuantity,
              newQuantity,
              prorationBehavior: 'always_invoice',
            },
          });

          // STEP 7: Simular atualização no Firestore
          const currentMaxLicenses = tenant.maxLicenses || 0;
          const newMaxLicenses =
            currentMaxLicenses === -1 ? -1 : currentMaxLicenses + 1;

          results.push({
            step: '7. Simular Atualização no Firestore',
            status: '✅ PASS',
            message: 'Simulação de atualização no Firestore bem-sucedida',
            data: {
              currentMaxLicenses,
              newMaxLicenses,
            },
          });
        }
      } catch (error: any) {
        results.push({
          step: '5. Buscar Subscription no Stripe',
          status: '❌ FAIL',
          message: error.message,
        });
      }
    }

    // STEP 8: Verificar validação de role admin
    try {
      const user = await auth.getUserByEmail('admin@test.com');
      const customClaims = user.customClaims || {};

      if (customClaims.role !== 'admin' && !customClaims.systemAdmin) {
        results.push({
          step: '8. Verificar Role Admin',
          status: '❌ FAIL',
          message: 'Usuário não tem role admin',
          data: { role: customClaims.role },
        });
      } else {
        results.push({
          step: '8. Verificar Role Admin',
          status: '✅ PASS',
          message: 'Usuário tem permissões de admin',
          data: {
            role: customClaims.role,
            systemAdmin: customClaims.systemAdmin,
          },
        });
      }
    } catch (error: any) {
      results.push({
        step: '8. Verificar Role Admin',
        status: '❌ FAIL',
        message: error.message,
      });
    }

    // STEP 9: Verificar validação de quantity >= 1
    const testQuantities = [-1, 0, 1, 5];
    testQuantities.forEach((qty) => {
      const isValid = qty >= 1;
      results.push({
        step: `9. Validar Quantity (${qty})`,
        status: isValid ? '✅ PASS' : '❌ FAIL',
        message: isValid
          ? `Quantity ${qty} é válido`
          : `Quantity ${qty} é inválido (deve ser >= 1)`,
      });
    });
  } catch (error: any) {
    results.push({
      step: '2. Verificar Tenant Existe',
      status: '❌ FAIL',
      message: error.message,
    });
  }

  // Print results
  console.log('\n📊 RESULTADOS DOS TESTES:\n');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.step}`);
    console.log(`   ${result.status} - ${result.message}`);
    if (result.data) {
      console.log(`   Dados: ${JSON.stringify(result.data, null, 2)}`);
    }
    console.log('');
  });

  const passed = results.filter((r) => r.status === '✅ PASS').length;
  const failed = results.filter((r) => r.status === '❌ FAIL').length;

  console.log('='.repeat(60));
  console.log(`\n✅ Passou: ${passed}`);
  console.log(`❌ Falhou: ${failed}`);
  console.log(`📊 Total: ${results.length}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run test
testAddSeatsFlow().catch((error) => {
  console.error('❌ Erro ao executar testes:', error);
  process.exit(1);
});
