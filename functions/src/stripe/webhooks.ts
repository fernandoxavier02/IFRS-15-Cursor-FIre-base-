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

  // Get or create tenant
  let tenantId = checkoutData.tenantId;
  
  if (!tenantId && session.customer) {
    // Check if tenant exists with this Stripe customer
    const tenantQuery = await db
      .collection(COLLECTIONS.TENANTS)
      .where("stripeCustomerId", "==", session.customer)
      .limit(1)
      .get();

    if (!tenantQuery.empty) {
      tenantId = tenantQuery.docs[0].id;
    } else {
      // Create new tenant
      const tenantRef = db.collection(COLLECTIONS.TENANTS).doc();
      tenantId = tenantRef.id;

      await tenantRef.set({
        id: tenantId,
        name: checkoutData.email?.split("@")[0] || "New Organization",
        country: "BR",
        currency: "BRL",
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        planType: "starter",
        maxContracts: 10,
        maxLicenses: 1,
        subscriptionStatus: "active",
        cancelAtPeriodEnd: false,
        createdAt: Timestamp.now(),
      });
    }
  }

  // Update checkout session
  await checkoutDoc.ref.update({
    status: "completed",
    tenantId,
    completedAt: Timestamp.now(),
  });

  // Send welcome email via Trigger Email extension
  if (checkoutData.email) {
    await db.collection(COLLECTIONS.MAIL).add({
      to: checkoutData.email,
      template: {
        name: "welcome",
        data: {
          email: checkoutData.email,
        },
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
