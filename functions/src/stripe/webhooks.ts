import * as functions from "firebase-functions";
import Stripe from "stripe";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS } from "../utils/collections";

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// Webhook secret for verifying Stripe signatures
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

// Process Stripe webhooks
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).send("Missing stripe-signature header");
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Check for idempotency (prevent duplicate processing)
  const eventDoc = await db.collection(COLLECTIONS.STRIPE_EVENTS).doc(event.id).get();
  if (eventDoc.exists) {
    console.log("Event already processed:", event.id);
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  console.log("Processing Stripe event:", event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log("Unhandled event type:", event.type);
    }

    // Record event as processed
    await db.collection(COLLECTIONS.STRIPE_EVENTS).doc(event.id).set({
      id: event.id,
      eventType: event.type,
      processedAt: Timestamp.now(),
      data: event.data.object,
    });

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Handle checkout session completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("Checkout completed:", session.id);

  // Find checkout session in our database
  const checkoutQuery = await db
    .collection(COLLECTIONS.CHECKOUT_SESSIONS)
    .where("stripeSessionId", "==", session.id)
    .limit(1)
    .get();

  if (checkoutQuery.empty) {
    console.log("Checkout session not found in database:", session.id);
    return;
  }

  const checkoutDoc = checkoutQuery.docs[0];
  const checkoutData = checkoutDoc.data();

  // Get tenant ID from checkout data or session metadata
  let tenantId = checkoutData.tenantId || session.metadata?.tenantId;
  
  if (!tenantId && session.customer) {
    // Check if tenant exists with this Stripe customer
    const tenantQuery = await db
      .collection(COLLECTIONS.TENANTS)
      .where("stripeCustomerId", "==", session.customer)
      .limit(1)
      .get();

    if (!tenantQuery.empty) {
      tenantId = tenantQuery.docs[0].id;
    }
  }

  if (!tenantId) {
    console.error("Cannot find tenant for checkout session:", session.id);
    return;
  }

  // Get tenant document
  const tenantRef = db.collection(COLLECTIONS.TENANTS).doc(tenantId);
  const tenantDoc = await tenantRef.get();
  
  if (!tenantDoc.exists) {
    console.error("Tenant not found:", tenantId);
    return;
  }

  const tenantData = tenantDoc.data();
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  // Determine plan type from metadata or existing tenant
  let planType = session.metadata?.planId || tenantData?.planType || "starter";
  const planLimits: Record<string, { maxContracts: number; maxLicenses: number }> = {
    starter: { maxContracts: 10, maxLicenses: 1 },
    professional: { maxContracts: 30, maxLicenses: 3 },
    enterprise: { maxContracts: -1, maxLicenses: -1 },
  };
  const limits = planLimits[planType] || planLimits.starter;

  // Get subscription details from Stripe
  let subscriptionDetails: Stripe.Subscription | null = null;
  if (subscriptionId) {
    try {
      subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
      // Update plan type from subscription if available
      const priceId = subscriptionDetails.items.data[0]?.price.id;
      if (priceId) {
        const plansSnapshot = await db.collection(COLLECTIONS.SUBSCRIPTION_PLANS).get();
        for (const planDoc of plansSnapshot.docs) {
          const plan = planDoc.data();
          if (plan.stripePriceIdMonthly === priceId || plan.stripePriceIdYearly === priceId || plan.priceId === priceId) {
            planType = plan.id || plan.name?.toLowerCase() || planType;
            const updatedLimits = planLimits[planType] || limits;
            limits.maxContracts = updatedLimits.maxContracts;
            limits.maxLicenses = updatedLimits.maxLicenses;
            break;
          }
        }
      }
    } catch (subError) {
      console.error(`[handleCheckoutCompleted] Error retrieving subscription ${subscriptionId}:`, subError);
    }
  }

  // ACTIVATE TENANT - Update status to active
  const updateData: any = {
    status: "active",
    subscriptionStatus: "active",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    planType,
    maxContracts: limits.maxContracts,
    maxLicenses: limits.maxLicenses,
    cancelAtPeriodEnd: false,
  };

  if (subscriptionDetails) {
    updateData.stripePriceId = subscriptionDetails.items.data[0]?.price.id || null;
    updateData.currentPeriodStart = Timestamp.fromMillis(subscriptionDetails.current_period_start * 1000);
    updateData.currentPeriodEnd = Timestamp.fromMillis(subscriptionDetails.current_period_end * 1000);
  } else {
    // Fallback: use current time + 30 days if subscription not available yet
    updateData.currentPeriodStart = Timestamp.now();
    updateData.currentPeriodEnd = Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  await tenantRef.update(updateData);

  console.log(`[handleCheckoutCompleted] Tenant activated: ${tenantId}`);

  // ACTIVATE ALL USERS IN TENANT
  const usersSnapshot = await db
    .collection(tenantCollection(tenantId, COLLECTIONS.USERS))
    .get();

  const auth = (await import("../utils/admin")).auth;
  
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    
    // Update user document
    await userDoc.ref.update({
      isActive: true,
    });

    // Update root user collection
    await db.collection(COLLECTIONS.USERS).doc(userDoc.id).update({
      isActive: true,
    });

    // Update Firebase Auth custom claims if user is admin
    try {
      const userRecord = await auth.getUser(userDoc.id);
      await auth.setCustomUserClaims(userDoc.id, {
        ...userRecord.customClaims,
        tenantId,
        role: userData.role || "admin",
      });
    } catch (authError) {
      console.error(`[handleCheckoutCompleted] Error updating claims for user ${userDoc.id}:`, authError);
    }
  }

  console.log(`[handleCheckoutCompleted] Activated ${usersSnapshot.size} users for tenant ${tenantId}`);

  // Update checkout session
  await checkoutDoc.ref.update({
    status: "completed",
    tenantId,
    completedAt: Timestamp.now(),
  });

  // Send welcome/activation email via Trigger Email extension
  if (checkoutData.email) {
    await db.collection(COLLECTIONS.MAIL).add({
      to: checkoutData.email,
      message: {
        subject: "Pagamento Confirmado - Acesso Liberado ao IFRS 15 Revenue Manager!",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">🎉 Acesso Liberado!</h1>
            </div>
            <div style="background: white; padding: 40px; border: 1px solid #e5e7eb;">
              <h2>Olá!</h2>
              <p>Ótimas notícias! Seu pagamento foi confirmado e sua conta foi <strong>ativada com sucesso</strong>.</p>
              
              <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #059669;">✅ Sua conta está ativa!</h3>
                <p>Você agora tem acesso completo a todas as funcionalidades do <strong>IFRS 15 Revenue Manager</strong>.</p>
              </div>

              <div style="text-align: center; margin: 40px 0;">
                <a href="${process.env.APP_URL || "https://ifrs15-revenue-manager.web.app"}/" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Acessar Aplicativo Agora
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                Bem-vindo ao IFRS 15 Revenue Manager!
              </p>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">© 2024 IFRS 15 Revenue Manager</p>
            </div>
          </body>
          </html>
        `,
        text: `
Acesso Liberado!

Olá!

Ótimas notícias! Seu pagamento foi confirmado e sua conta foi ativada com sucesso.

Você agora tem acesso completo a todas as funcionalidades do IFRS 15 Revenue Manager.

Acesse: ${process.env.APP_URL || "https://ifrs15-revenue-manager.web.app"}/

Bem-vindo ao IFRS 15 Revenue Manager!
        `,
      },
    });
  }
}

// Handle subscription updates
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log("Subscription updated:", subscription.id);

  // Find tenant by subscription ID
  const tenantQuery = await db
    .collection(COLLECTIONS.TENANTS)
    .where("stripeSubscriptionId", "==", subscription.id)
    .limit(1)
    .get();

  if (tenantQuery.empty) {
    // Try finding by customer ID
    const customerQuery = await db
      .collection(COLLECTIONS.TENANTS)
      .where("stripeCustomerId", "==", subscription.customer)
      .limit(1)
      .get();

    if (customerQuery.empty) {
      console.log("Tenant not found for subscription:", subscription.id);
      return;
    }

    // Update with subscription ID
    await customerQuery.docs[0].ref.update({
      stripeSubscriptionId: subscription.id,
    });
  }

  const tenantDoc = tenantQuery.empty 
    ? (await db.collection(COLLECTIONS.TENANTS).where("stripeCustomerId", "==", subscription.customer).limit(1).get()).docs[0]
    : tenantQuery.docs[0];

  if (!tenantDoc) {
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    trialing: "trialing",
  };

  // Determine plan type from price
  let planType = "starter";
  const priceId = subscription.items.data[0]?.price.id;
  
  // Get subscription plans to match price ID
  const plansSnapshot = await db.collection(COLLECTIONS.SUBSCRIPTION_PLANS).get();
  for (const planDoc of plansSnapshot.docs) {
    const plan = planDoc.data();
    if (plan.stripePriceIdMonthly === priceId || plan.stripePriceIdYearly === priceId) {
      planType = plan.name?.toLowerCase() || "starter";
      break;
    }
  }

  // Plan limits
  const planLimits: Record<string, { contracts: number; licenses: number }> = {
    starter: { contracts: 10, licenses: 1 },
    professional: { contracts: 30, licenses: 3 },
    enterprise: { contracts: -1, licenses: -1 },
  };

  const limits = planLimits[planType] || planLimits.starter;

  await tenantDoc.ref.update({
    subscriptionStatus: statusMap[subscription.status] || subscription.status,
    stripePriceId: priceId,
    planType,
    maxContracts: limits.contracts,
    maxLicenses: limits.licenses,
    currentPeriodStart: Timestamp.fromMillis(subscription.current_period_start * 1000),
    currentPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("Subscription deleted:", subscription.id);

  const tenantQuery = await db
    .collection(COLLECTIONS.TENANTS)
    .where("stripeSubscriptionId", "==", subscription.id)
    .limit(1)
    .get();

  if (tenantQuery.empty) {
    return;
  }

  await tenantQuery.docs[0].ref.update({
    subscriptionStatus: "canceled",
    planType: "starter",
    maxContracts: 10,
    maxLicenses: 1,
  });
}

// Handle invoice paid
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log("Invoice paid:", invoice.id);
  
  // Could update billing records or send receipt email
  if (invoice.customer_email) {
    await db.collection(COLLECTIONS.MAIL).add({
      to: invoice.customer_email,
      template: {
        name: "invoice_paid",
        data: {
          invoiceNumber: invoice.number,
          amount: (invoice.amount_paid / 100).toFixed(2),
          currency: invoice.currency.toUpperCase(),
        },
      },
    });
  }
}

// Handle invoice payment failed
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log("Invoice payment failed:", invoice.id);

  if (invoice.customer_email) {
    await db.collection(COLLECTIONS.MAIL).add({
      to: invoice.customer_email,
      template: {
        name: "payment_failed",
        data: {
          invoiceNumber: invoice.number,
          amount: (invoice.amount_due / 100).toFixed(2),
          currency: invoice.currency.toUpperCase(),
        },
      },
    });
  }
}
