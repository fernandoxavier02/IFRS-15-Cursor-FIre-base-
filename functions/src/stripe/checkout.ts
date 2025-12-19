import * as functions from "firebase-functions";
import Stripe from "stripe";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS } from "../utils/collections";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// Get Stripe publishable key
export const getStripePublishableKey = functions.https.onCall(async () => {
  return {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
  };
});

// Create checkout session
export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  const { priceId, planId, email, successUrl, cancelUrl, tenantId } = data;

  if ((!priceId && !planId) || !email) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields: priceId or planId, and email");
  }

  try {
    let finalPriceId = priceId;

    // If planId provided, find priceId from subscription plans
    if (!finalPriceId && planId) {
      const plansSnapshot = await db.collection(COLLECTIONS.SUBSCRIPTION_PLANS).get();
      const plans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const plan = plans.find((p: any) => p.id === planId);
      if (!plan) {
        throw new functions.https.HttpsError("not-found", `Plan ${planId} not found`);
      }
      finalPriceId = plan.priceId || plan.stripePriceIdMonthly || plan.stripePriceIdYearly;
      if (!finalPriceId) {
        throw new functions.https.HttpsError("not-found", `Plan ${planId} has no priceId configured`);
      }
    }

    // Check if customer exists
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Get tenantId from auth if not provided
    let finalTenantId = tenantId;
    if (!finalTenantId && context.auth) {
      finalTenantId = context.auth.token.tenantId;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.APP_URL || "https://ifrs15-revenue-manager.web.app"}/customer-area?success=true`,
      cancel_url: cancelUrl || `${process.env.APP_URL || "https://ifrs15-revenue-manager.web.app"}/customer-area?canceled=true`,
      metadata: {
        email,
        ...(finalTenantId && { tenantId: finalTenantId }),
        ...(planId && { planId }),
      },
    });

    // Store checkout session in database
    await db.collection(COLLECTIONS.CHECKOUT_SESSIONS).add({
      stripeSessionId: session.id,
      email,
      tenantId: finalTenantId || null,
      planId: planId || null,
      status: "pending",
      createdAt: Timestamp.now(),
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create checkout session");
  }
});

// Create customer portal session
export const createPortalSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId;
  if (!tenantId) {
    throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
  }

  try {
    // Get tenant's Stripe customer ID
    const tenantDoc = await db.collection(COLLECTIONS.TENANTS).doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Tenant not found");
    }

    const tenant = tenantDoc.data();
    if (!tenant?.stripeCustomerId) {
      throw new functions.https.HttpsError("failed-precondition", "No Stripe customer associated");
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: data.returnUrl || process.env.APP_URL,
    });

    return {
      url: session.url,
    };
  } catch (error: any) {
    console.error("Error creating portal session:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to create portal session");
  }
});

// Get subscription plans
export const getSubscriptionPlans = functions.https.onCall(async () => {
  try {
    const plansSnapshot = await db
      .collection(COLLECTIONS.SUBSCRIPTION_PLANS)
      .where("isActive", "==", true)
      .get();

    const plans = plansSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { plans };
  } catch (error: any) {
    console.error("Error getting subscription plans:", error);
    throw new functions.https.HttpsError("internal", "Failed to get plans");
  }
});

// Cancel subscription
export const cancelSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId;
  const role = context.auth.token.role;

  if (role !== "admin" && !context.auth.token.systemAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  try {
    const tenantDoc = await db.collection(COLLECTIONS.TENANTS).doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Tenant not found");
    }

    const tenant = tenantDoc.data();
    if (!tenant?.stripeSubscriptionId) {
      throw new functions.https.HttpsError("failed-precondition", "No subscription found");
    }

    // Cancel at period end
    await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await tenantDoc.ref.update({
      cancelAtPeriodEnd: true,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error canceling subscription:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to cancel subscription");
  }
});

// Resume subscription
export const resumeSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId;
  const role = context.auth.token.role;

  if (role !== "admin" && !context.auth.token.systemAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  try {
    const tenantDoc = await db.collection(COLLECTIONS.TENANTS).doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Tenant not found");
    }

    const tenant = tenantDoc.data();
    if (!tenant?.stripeSubscriptionId) {
      throw new functions.https.HttpsError("failed-precondition", "No subscription found");
    }

    // Remove cancel at period end
    await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await tenantDoc.ref.update({
      cancelAtPeriodEnd: false,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error resuming subscription:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to resume subscription");
  }
});

// Add seats to existing subscription
export const addSeatsToSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId;
  const role = context.auth.token.role;

  if (role !== "admin" && !context.auth.token.systemAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  const { quantity = 1 } = data; // Number of additional seats to add

  if (quantity < 1) {
    throw new functions.https.HttpsError("invalid-argument", "Quantity must be at least 1");
  }

  try {
    // Get tenant
    const tenantDoc = await db.collection(COLLECTIONS.TENANTS).doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Tenant not found");
    }

    const tenant = tenantDoc.data();
    
    if (tenant?.subscriptionStatus !== "active") {
      throw new functions.https.HttpsError("failed-precondition", "Subscription must be active to add seats");
    }

    if (!tenant?.stripeSubscriptionId) {
      throw new functions.https.HttpsError("failed-precondition", "No Stripe subscription found");
    }

    // Get subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
    
    if (!subscription.items.data.length) {
      throw new functions.https.HttpsError("failed-precondition", "Subscription has no items");
    }

    // Update subscription quantity (add seats)
    const subscriptionItem = subscription.items.data[0];
    
    // Validate subscription item and quantity
    if (!subscriptionItem || typeof subscriptionItem.quantity !== 'number') {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Subscription item quantity is invalid"
      );
    }
    
    const currentQuantity = subscriptionItem.quantity ?? 1; // Default to 1 if null/undefined
    const newQuantity = currentQuantity + quantity;

    await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
      items: [{
        id: subscriptionItem.id,
        quantity: newQuantity,
      }],
      proration_behavior: "always_invoice", // Charge immediately for prorated amount
    });

    // Update tenant maxLicenses
    // Handle null/undefined: default to 0, preserve -1 for unlimited
    const currentMaxLicenses = tenant?.maxLicenses ?? 0;
    const newMaxLicenses = currentMaxLicenses === -1 ? -1 : currentMaxLicenses + quantity;

    await tenantDoc.ref.update({
      maxLicenses: newMaxLicenses,
    });

    return {
      success: true,
      newQuantity,
      newMaxLicenses,
      message: `Successfully added ${quantity} seat(s) to subscription`,
    };
  } catch (error: any) {
    console.error("Error adding seats:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to add seats");
  }
});
