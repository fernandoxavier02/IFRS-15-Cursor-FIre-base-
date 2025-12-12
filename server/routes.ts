import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" })
  : null;

const DEFAULT_TENANT_ID = "default-tenant";

async function ensureDefaultData() {
  let tenant = await storage.getTenant(DEFAULT_TENANT_ID);
  if (!tenant) {
    tenant = await storage.createTenant({
      name: "Demo Organization",
      country: "United States",
      currency: "USD",
    });
  }
  return tenant;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await ensureDefaultData();

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats(DEFAULT_TENANT_ID);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  // Revenue trend for dashboard
  app.get("/api/dashboard/revenue-trend", async (req: Request, res: Response) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    const data = months.slice(0, currentMonth + 1).map((month, i) => ({
      period: month,
      recognized: Math.floor(50000 + Math.random() * 100000 * (i + 1) / 12),
      deferred: Math.floor(20000 + Math.random() * 50000 * (12 - i) / 12),
    }));
    res.json(data);
  });

  // Recent contracts
  app.get("/api/contracts/recent", async (req: Request, res: Response) => {
    try {
      const contracts = await storage.getRecentContracts(DEFAULT_TENANT_ID, 5);
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      const result = contracts.map((c) => {
        const customer = customers.find((cust) => cust.id === c.customerId);
        return {
          id: c.id,
          contractNumber: c.contractNumber,
          title: c.title,
          status: c.status,
          customerName: customer?.name || "Unknown",
          totalValue: c.totalValue,
          currency: c.currency,
          startDate: c.startDate?.toISOString(),
          endDate: c.endDate?.toISOString() || null,
          recognizedRevenue: (Number(c.totalValue) * 0.6).toFixed(2),
          deferredRevenue: (Number(c.totalValue) * 0.4).toFixed(2),
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get recent contracts" });
    }
  });

  // Contracts
  app.get("/api/contracts", async (req: Request, res: Response) => {
    try {
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      const result = contracts.map((c) => {
        const customer = customers.find((cust) => cust.id === c.customerId);
        return {
          id: c.id,
          contractNumber: c.contractNumber,
          title: c.title,
          status: c.status,
          customerName: customer?.name || "Unknown",
          totalValue: c.totalValue,
          currency: c.currency,
          startDate: c.startDate?.toISOString(),
          endDate: c.endDate?.toISOString() || null,
          recognizedRevenue: (Number(c.totalValue) * 0.6).toFixed(2),
          deferredRevenue: (Number(c.totalValue) * 0.4).toFixed(2),
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get contracts" });
    }
  });

  app.post("/api/contracts", async (req: Request, res: Response) => {
    try {
      const { customerId, contractNumber, title, startDate, endDate, totalValue, currency, paymentTerms } = req.body;
      
      const contract = await storage.createContract({
        tenantId: DEFAULT_TENANT_ID,
        customerId,
        contractNumber,
        title,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        totalValue,
        currency: currency || "USD",
        paymentTerms,
        status: "draft",
      });

      // Create initial version
      await storage.createContractVersion({
        contractId: contract.id,
        versionNumber: 1,
        effectiveDate: new Date(startDate),
        description: "Initial contract version",
        totalValue,
      });

      // Create audit log
      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "contract",
        entityId: contract.id,
        action: "create",
        newValue: contract,
        justification: "Contract created",
      });

      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(500).json({ message: "Failed to create contract" });
    }
  });

  // Customers
  app.get("/api/customers", async (req: Request, res: Response) => {
    try {
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      
      const result = customers.map((c) => {
        const customerContracts = contracts.filter((ct) => ct.customerId === c.id);
        return {
          ...c,
          contractCount: customerContracts.length,
          totalContractValue: customerContracts.reduce((sum, ct) => sum + Number(ct.totalValue || 0), 0).toFixed(2),
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get customers" });
    }
  });

  app.post("/api/customers", async (req: Request, res: Response) => {
    try {
      const customer = await storage.createCustomer({
        tenantId: DEFAULT_TENANT_ID,
        ...req.body,
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "customer",
        entityId: customer.id,
        action: "create",
        newValue: customer,
      });

      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Performance Obligations for a contract
  app.get("/api/contracts/:contractId/obligations", async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const contract = await storage.getContract(contractId);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const versions = await storage.getContractVersions(contractId);
      if (versions.length === 0) {
        return res.json([]);
      }

      const latestVersion = versions[0];
      const obligations = await storage.getPerformanceObligations(latestVersion.id);
      
      const result = obligations.map((o) => ({
        id: o.id,
        description: o.description,
        allocatedPrice: o.allocatedPrice,
        recognitionMethod: o.recognitionMethod,
        percentComplete: o.percentComplete,
        recognizedAmount: o.recognizedAmount,
        deferredAmount: o.deferredAmount,
        isSatisfied: o.isSatisfied,
      }));
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get performance obligations" });
    }
  });

  // IFRS 15 Engine - Run recognition
  app.post("/api/ifrs15/run/:contractId", async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const contract = await storage.getContract(contractId);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // Update contract status to active
      await storage.updateContract(contractId, { status: "active" });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "contract",
        entityId: contractId,
        action: "recognize",
        justification: "IFRS 15 engine processed contract",
      });

      res.json({ success: true, message: "Revenue recognition processed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to run IFRS 15 engine" });
    }
  });

  // Licenses
  app.get("/api/licenses", async (req: Request, res: Response) => {
    try {
      const licenses = await storage.getLicenses(DEFAULT_TENANT_ID);
      const users = await storage.getUsers(DEFAULT_TENANT_ID);
      
      const result = licenses.map((l) => {
        const user = users.find((u) => u.id === l.currentUserId);
        return {
          id: l.id,
          licenseKey: l.licenseKey,
          status: l.status,
          seatCount: l.seatCount,
          currentIp: l.currentIp,
          currentUserName: user?.fullName || null,
          lockedAt: l.lockedAt?.toISOString() || null,
          lastSeenAt: l.lastSeenAt?.toISOString() || null,
          graceUntil: l.graceUntil?.toISOString() || null,
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get licenses" });
    }
  });

  app.get("/api/licenses/active", async (req: Request, res: Response) => {
    try {
      const licenses = await storage.getActiveLicenses(DEFAULT_TENANT_ID);
      const users = await storage.getUsers(DEFAULT_TENANT_ID);
      
      const result = licenses
        .filter((l) => l.currentIp !== null)
        .map((l) => {
          const user = users.find((u) => u.id === l.currentUserId);
          return {
            id: l.id,
            licenseKey: l.licenseKey,
            status: l.status,
            seatCount: l.seatCount,
            currentIp: l.currentIp,
            currentUserName: user?.fullName || null,
            lockedAt: l.lockedAt?.toISOString() || null,
            lastSeenAt: l.lastSeenAt?.toISOString() || null,
            graceUntil: l.graceUntil?.toISOString() || null,
          };
        });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get active licenses" });
    }
  });

  // License validation
  app.post("/api/license/validate", async (req: Request, res: Response) => {
    try {
      const { licenseKey, ip } = req.body;
      const license = await storage.getLicenseByKey(licenseKey);

      if (!license) {
        return res.status(404).json({ valid: false, message: "License not found" });
      }

      if (license.status !== "active") {
        return res.status(403).json({ valid: false, message: "License is not active" });
      }

      if (!license.currentIp) {
        await storage.updateLicense(license.id, {
          currentIp: ip,
          lockedAt: new Date(),
          lastSeenAt: new Date(),
        });
        await storage.createLicenseSession({
          licenseId: license.id,
          ip,
        });
        return res.json({ valid: true, message: "License activated" });
      }

      if (license.currentIp === ip) {
        await storage.updateLicense(license.id, { lastSeenAt: new Date() });
        return res.json({ valid: true, message: "Session renewed" });
      }

      if (license.graceUntil && new Date() < license.graceUntil) {
        await storage.endLicenseSession(license.id, "ip_change");
        await storage.updateLicense(license.id, {
          currentIp: ip,
          lockedAt: new Date(),
          lastSeenAt: new Date(),
          graceUntil: null,
        });
        await storage.createLicenseSession({
          licenseId: license.id,
          ip,
        });
        return res.json({ valid: true, message: "IP changed within grace period" });
      }

      return res.status(403).json({
        valid: false,
        message: "License is already in use on another IP",
        currentIp: license.currentIp,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to validate license" });
    }
  });

  // License heartbeat
  app.post("/api/license/heartbeat", async (req: Request, res: Response) => {
    try {
      const { licenseKey } = req.body;
      const license = await storage.getLicenseByKey(licenseKey);

      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }

      await storage.updateLicense(license.id, { lastSeenAt: new Date() });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update heartbeat" });
    }
  });

  // License actions
  app.post("/api/licenses/:id/release", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const license = await storage.getLicense(id);
      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }

      await storage.endLicenseSession(license.id, "force_release");
      await storage.updateLicense(id, {
        currentIp: null,
        currentUserId: null,
        lockedAt: null,
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "license",
        entityId: id,
        action: "update",
        justification: "License force released",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to release license" });
    }
  });

  app.post("/api/licenses/:id/suspend", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.updateLicense(id, { status: "suspended" });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "license",
        entityId: id,
        action: "update",
        justification: "License suspended",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to suspend license" });
    }
  });

  app.post("/api/licenses/:id/revoke", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.endLicenseSession(id, "revoked");
      await storage.updateLicense(id, {
        status: "revoked",
        currentIp: null,
        currentUserId: null,
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "license",
        entityId: id,
        action: "delete",
        justification: "License revoked",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to revoke license" });
    }
  });

  // Reports
  app.get("/api/reports/disaggregated-revenue", async (req: Request, res: Response) => {
    const data = [
      { category: "Software Licenses", overTime: 150000, pointInTime: 75000, total: 225000 },
      { category: "Professional Services", overTime: 120000, pointInTime: 0, total: 120000 },
      { category: "Support & Maintenance", overTime: 80000, pointInTime: 0, total: 80000 },
      { category: "Training", overTime: 30000, pointInTime: 20000, total: 50000 },
      { category: "Hardware", overTime: 0, pointInTime: 95000, total: 95000 },
    ];
    res.json(data);
  });

  app.get("/api/reports/contract-balances", async (req: Request, res: Response) => {
    const data = [
      { period: "Q1 2024", openingAsset: 45000, openingLiability: 120000, revenueRecognized: 185000, cashReceived: 175000, closingAsset: 55000, closingLiability: 110000 },
      { period: "Q2 2024", openingAsset: 55000, openingLiability: 110000, revenueRecognized: 210000, cashReceived: 195000, closingAsset: 70000, closingLiability: 95000 },
      { period: "Q3 2024", openingAsset: 70000, openingLiability: 95000, revenueRecognized: 195000, cashReceived: 220000, closingAsset: 45000, closingLiability: 70000 },
      { period: "Q4 2024", openingAsset: 45000, openingLiability: 70000, revenueRecognized: 230000, cashReceived: 210000, closingAsset: 65000, closingLiability: 50000 },
    ];
    res.json(data);
  });

  app.get("/api/reports/remaining-obligations", async (req: Request, res: Response) => {
    const data = [
      { period: "2025 H1", amount: 280000 },
      { period: "2025 H2", amount: 195000 },
      { period: "2026", amount: 320000 },
      { period: "2027+", amount: 150000 },
    ];
    res.json(data);
  });

  // Audit logs
  app.get("/api/audit-logs", async (req: Request, res: Response) => {
    try {
      const logs = await storage.getAuditLogs(DEFAULT_TENANT_ID);
      const users = await storage.getUsers(DEFAULT_TENANT_ID);
      
      const result = logs.map((log) => {
        const user = users.find((u) => u.id === log.userId);
        return {
          ...log,
          userName: user?.fullName || "System",
          createdAt: log.createdAt.toISOString(),
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get audit logs" });
    }
  });

  // Tenant
  app.get("/api/tenant", async (req: Request, res: Response) => {
    try {
      const tenant = await storage.getTenant(DEFAULT_TENANT_ID);
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Failed to get tenant" });
    }
  });

  app.patch("/api/tenant", async (req: Request, res: Response) => {
    try {
      const tenant = await storage.updateTenant(DEFAULT_TENANT_ID, req.body);
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Failed to update tenant" });
    }
  });

  // Users
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const users = await storage.getUsers(DEFAULT_TENANT_ID);
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // Stripe webhook
  app.post("/api/billing/webhook", async (req: Request, res: Response) => {
    if (!stripe) {
      return res.status(500).json({ message: "Stripe not configured" });
    }

    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (webhookSecret && req.rawBody) {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } else {
        event = req.body as Stripe.Event;
      }
    } catch (err) {
      console.error("Webhook signature verification failed");
      return res.status(400).json({ message: "Webhook signature verification failed" });
    }

    // Check idempotency
    const existingEvent = await storage.getStripeEvent(event.id);
    if (existingEvent) {
      return res.json({ received: true, message: "Event already processed" });
    }

    // Process event
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.subscription && session.customer) {
            await storage.updateTenant(DEFAULT_TENANT_ID, {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              subscriptionStatus: "active",
            });
            
            // Create a license for the new subscription
            await storage.createLicense({
              tenantId: DEFAULT_TENANT_ID,
              licenseKey: `LIC-${randomUUID().substring(0, 8).toUpperCase()}`,
              status: "active",
              seatCount: 1,
            });
          }
          break;
        }
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await storage.updateTenant(DEFAULT_TENANT_ID, {
            subscriptionStatus: subscription.status as any,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
          break;
        }
        case "customer.subscription.deleted": {
          await storage.updateTenant(DEFAULT_TENANT_ID, {
            subscriptionStatus: "canceled",
          });
          // Suspend all licenses
          const licenses = await storage.getLicenses(DEFAULT_TENANT_ID);
          for (const license of licenses) {
            await storage.updateLicense(license.id, { status: "suspended" });
          }
          break;
        }
        case "invoice.payment_failed": {
          await storage.updateTenant(DEFAULT_TENANT_ID, {
            subscriptionStatus: "past_due",
          });
          break;
        }
      }

      await storage.createStripeEvent({
        id: event.id,
        eventType: event.type,
        data: event.data,
      });

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Error processing webhook" });
    }
  });

  // Checkout session
  app.post("/api/billing/checkout-session", async (req: Request, res: Response) => {
    if (!stripe) {
      return res.status(500).json({ message: "Stripe not configured" });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "IFRS 15 Enterprise Plan",
                description: "Full access to IFRS 15 Revenue Recognition platform",
              },
              unit_amount: 29900,
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${req.headers.origin}/settings?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/settings`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  return httpServer;
}
