import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { extractContractData, generateConfidenceScores } from "./ai-service";
import { aiModels, insertAiProviderConfigSchema } from "@shared/schema";

const DEFAULT_TENANT_ID = "default-tenant";
const ADMIN_EMAIL = "fernandocostaxavier@gmail.com";
const ADMIN_PASSWORD = "Fcxv020781@";

async function ensureDefaultData() {
  let tenant = await storage.getTenant(DEFAULT_TENANT_ID);
  if (!tenant) {
    tenant = await storage.createTenant({
      name: "Demo Organization",
      country: "United States",
      currency: "USD",
    });
  }
  
  // Ensure admin user exists
  const adminUser = await storage.getUserByEmail(ADMIN_EMAIL);
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await storage.createUser({
      username: "admin",
      email: ADMIN_EMAIL,
      password: hashedPassword,
      fullName: "System Administrator",
      role: "admin",
      tenantId: tenant.id,
      mustChangePassword: false,
      isActive: true,
    });
  }
  
  return tenant;
}

// Simple session store (in production, use Redis or database sessions)
const sessions: Map<string, { userId: string; createdAt: Date }> = new Map();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await ensureDefaultData();

  // ============ Authentication Routes ============
  
  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate session token
      const sessionToken = randomUUID();
      sessions.set(sessionToken, { userId: user.id, createdAt: new Date() });

      // Update last login
      const clientIp = getClientIp(req);
      await storage.updateUser(user.id, {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
      } as any);

      // Set session cookie
      res.cookie("session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          isActive: user.isActive,
          licenseKey: user.licenseKey,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Session expired" });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        sessions.delete(sessionToken);
        return res.status(401).json({ message: "User not found" });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          isActive: user.isActive,
          licenseKey: user.licenseKey,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const sessionToken = req.cookies?.session;
    if (sessionToken) {
      sessions.delete(sessionToken);
    }
    res.clearCookie("session");
    res.json({ success: true });
  });

  // Change password
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Session expired" });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { currentPassword, newPassword } = req.body;

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, {
        password: hashedNewPassword,
        mustChangePassword: false,
      } as any);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Activate license
  app.post("/api/licenses/activate", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Session expired" });
      }

      const { licenseKey } = req.body;
      if (!licenseKey) {
        return res.status(400).json({ message: "License key is required" });
      }

      const clientIp = getClientIp(req);
      const result = await storage.activateLicense(session.userId, licenseKey, clientIp);

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to activate license" });
    }
  });

  // ============ End Authentication Routes ============

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

  // Plan information for feature gating
  app.get("/api/plan", async (req: Request, res: Response) => {
    try {
      const tenant = await storage.getTenant(DEFAULT_TENANT_ID);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const licenses = await storage.getAllLicenses();

      res.json({
        planType: tenant.planType || "starter",
        maxContracts: tenant.maxContracts ?? 10,
        maxLicenses: tenant.maxLicenses ?? 1,
        currentContracts: contracts.length,
        currentLicenses: licenses.length,
      });
    } catch (error) {
      console.error("Error getting plan info:", error);
      res.status(500).json({ message: "Failed to get plan info" });
    }
  });

  // Subscription checkout - public route
  app.post("/api/subscribe/checkout", async (req: Request, res: Response) => {
    try {
      const { email, planId } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const stripe = await getUncachableStripeClient();

      // Pricing based on plan (BRL - Brazilian Real)
      const pricing: Record<string, { amount: number; name: string; contracts: number; licenses: number }> = {
        starter: { amount: 29900, name: "IFRS 15 Starter", contracts: 10, licenses: 1 },
        professional: { amount: 69900, name: "IFRS 15 Professional", contracts: 30, licenses: 3 },
        enterprise: { amount: 99900, name: "IFRS 15 Enterprise", contracts: -1, licenses: -1 },
      };

      const plan = pricing[planId] || pricing.professional;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: plan.name,
                description: "Full access to IFRS 15 Revenue Recognition platform",
              },
              unit_amount: plan.amount,
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${req.headers.origin}/?subscription=success`,
        cancel_url: `${req.headers.origin}/subscribe?cancelled=true`,
        metadata: {
          email,
          planId,
        },
      });

      // Track checkout session
      await storage.createCheckoutSession({
        stripeSessionId: session.id,
        email,
        status: "pending",
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Get Stripe publishable key
  app.get("/api/stripe/publishable-key", async (req: Request, res: Response) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      res.status(500).json({ message: "Stripe not configured" });
    }
  });

  // Admin: Get all licenses
  app.get("/api/admin/licenses", async (req: Request, res: Response) => {
    try {
      const licenses = await storage.getAllLicenses();
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
          email: user?.email || null,
          tenantName: null,
          lockedAt: l.lockedAt?.toISOString() || null,
          lastSeenAt: l.lastSeenAt?.toISOString() || null,
          graceUntil: l.graceUntil?.toISOString() || null,
          createdAt: l.createdAt.toISOString(),
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get licenses" });
    }
  });

  // Admin: Create license
  app.post("/api/admin/licenses", async (req: Request, res: Response) => {
    try {
      const { email, seatCount, planType } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Generate license key
      const licenseKey = `LIC-${randomUUID().substring(0, 8).toUpperCase()}`;

      // Generate random password
      const tempPassword = randomUUID().substring(0, 12);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create tenant if needed
      let tenant = await storage.getTenant(DEFAULT_TENANT_ID);
      if (!tenant) {
        tenant = await storage.createTenant({
          name: "Demo Organization",
          country: "United States",
          currency: "USD",
        });
      }

      // Create user with hashed password
      const user = await storage.createUser({
        username: email.split("@")[0],
        email,
        password: hashedPassword,
        fullName: email.split("@")[0],
        role: "finance",
        tenantId: tenant.id,
        mustChangePassword: true,
        isActive: false,
      });

      // Create license
      const license = await storage.createLicense({
        tenantId: tenant.id,
        licenseKey,
        status: "active",
        seatCount: seatCount || 1,
      });

      // Queue email with credentials (plaintext password for user, hashed in DB)
      await storage.createEmailQueueItem({
        toEmail: email,
        subject: "Your IFRS 15 Revenue Manager Access Credentials",
        body: `
          Welcome to IFRS 15 Revenue Manager!

          Your login credentials:
          Email: ${email}
          Password: ${tempPassword}
          License Key: ${licenseKey}

          Please login at: ${process.env.REPLIT_DOMAINS?.split(",")[0] || "https://app.ifrs15.com"}

          Important: For security, please change your password after first login.
          Note: Your license is locked to one IP address at a time.
        `,
        templateType: "credentials",
        status: "pending",
      });

      await storage.createAuditLog({
        tenantId: tenant.id,
        entityType: "license",
        entityId: license.id,
        action: "create",
        newValue: { licenseKey, email, seatCount },
        justification: "Admin created license",
      });

      res.status(201).json({
        license,
        user: { email: user.email },
        message: "License created and credentials queued for email",
      });
    } catch (error) {
      console.error("Error creating license:", error);
      res.status(500).json({ message: "Failed to create license" });
    }
  });

  // Admin: License actions
  app.post("/api/admin/licenses/:id/release", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const license = await storage.getLicense(id);
      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }

      await storage.endLicenseSession(license.id, "admin_force_release");
      await storage.updateLicense(id, {
        currentIp: null,
        currentUserId: null,
        lockedAt: null,
      });

      await storage.createAuditLog({
        tenantId: license.tenantId,
        entityType: "license",
        entityId: id,
        action: "update",
        justification: "Admin force released session",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to release license" });
    }
  });

  app.post("/api/admin/licenses/:id/suspend", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.updateLicense(id, { status: "suspended" });

      const license = await storage.getLicense(id);
      if (license) {
        await storage.createAuditLog({
          tenantId: license.tenantId,
          entityType: "license",
          entityId: id,
          action: "update",
          justification: "Admin suspended license",
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to suspend license" });
    }
  });

  app.post("/api/admin/licenses/:id/activate", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.updateLicense(id, { status: "active" });

      const license = await storage.getLicense(id);
      if (license) {
        await storage.createAuditLog({
          tenantId: license.tenantId,
          entityType: "license",
          entityId: id,
          action: "update",
          justification: "Admin activated license",
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to activate license" });
    }
  });

  app.post("/api/admin/licenses/:id/revoke", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.endLicenseSession(id, "admin_revoked");
      await storage.updateLicense(id, {
        status: "revoked",
        currentIp: null,
        currentUserId: null,
      });

      const license = await storage.getLicense(id);
      if (license) {
        await storage.createAuditLog({
          tenantId: license.tenantId,
          entityType: "license",
          entityId: id,
          action: "delete",
          justification: "Admin revoked license",
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to revoke license" });
    }
  });

  // ============ AI Provider Configs (BYOK) Routes ============

  // Get available AI models
  app.get("/api/ai/models", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      res.json(aiModels);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch AI models" });
    }
  });

  // Get AI provider configs for tenant
  app.get("/api/ai/providers", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const configs = await storage.getAiProviderConfigs(user.tenantId);
      // Don't return actual API keys
      const safeConfigs = configs.map(c => ({
        ...c,
        apiKey: c.apiKey ? "***" + c.apiKey.slice(-4) : "",
      }));

      res.json(safeConfigs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch AI providers" });
    }
  });

  // Create AI provider config
  app.post("/api/ai/providers", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const { provider, name, apiKey, model, baseUrl, isDefault } = req.body;

      if (!provider || !name || !apiKey || !model) {
        return res.status(400).json({ message: "Provider, name, API key, and model are required" });
      }

      const config = await storage.createAiProviderConfig({
        tenantId: user.tenantId,
        provider,
        name,
        apiKey,
        model,
        baseUrl,
        isDefault: isDefault || false,
      });

      await storage.createAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        entityType: "ai_provider_config",
        entityId: config.id,
        action: "create",
        newValue: { provider, name, model },
      });

      res.json({ ...config, apiKey: "***" + apiKey.slice(-4) });
    } catch (error) {
      console.error("Create AI provider error:", error);
      res.status(500).json({ message: "Failed to create AI provider" });
    }
  });

  // Update AI provider config
  app.patch("/api/ai/providers/:id", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const { id } = req.params;
      const { name, apiKey, model, baseUrl, isDefault, isActive } = req.body;

      const existing = await storage.getAiProviderConfig(id);
      if (!existing || existing.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Provider not found" });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (apiKey !== undefined) updateData.apiKey = apiKey;
      if (model !== undefined) updateData.model = model;
      if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
      if (isDefault !== undefined) updateData.isDefault = isDefault;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await storage.updateAiProviderConfig(id, updateData);

      await storage.createAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        entityType: "ai_provider_config",
        entityId: id,
        action: "update",
        newValue: updateData,
      });

      res.json({ ...updated, apiKey: "***" + (updated?.apiKey || "").slice(-4) });
    } catch (error) {
      res.status(500).json({ message: "Failed to update AI provider" });
    }
  });

  // Delete AI provider config
  app.delete("/api/ai/providers/:id", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const { id } = req.params;

      const existing = await storage.getAiProviderConfig(id);
      if (!existing || existing.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Provider not found" });
      }

      await storage.deleteAiProviderConfig(id);

      await storage.createAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        entityType: "ai_provider_config",
        entityId: id,
        action: "delete",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete AI provider" });
    }
  });

  // ============ AI Contract Ingestion Routes ============

  // Get ingestion jobs
  app.get("/api/ai/ingestion-jobs", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const jobs = await storage.getAiIngestionJobs(user.tenantId);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ingestion jobs" });
    }
  });

  // Get single ingestion job with extraction result
  app.get("/api/ai/ingestion-jobs/:id", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const { id } = req.params;
      const job = await storage.getAiIngestionJob(id);
      
      if (!job || job.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Job not found" });
      }

      const extractionResult = await storage.getAiExtractionResult(id);
      const reviewTasks = await storage.getAiReviewTasks(user.tenantId);
      const reviewTask = reviewTasks.find(t => t.jobId === id);

      res.json({
        job,
        extractionResult,
        reviewTask,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ingestion job" });
    }
  });

  // Upload PDF and start ingestion
  app.post("/api/ai/ingest", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const { providerId, fileName, fileContent, pdfText } = req.body;

      if (!providerId || !fileName || !pdfText) {
        return res.status(400).json({ message: "Provider ID, file name, and PDF text are required" });
      }

      // Verify provider belongs to tenant
      const provider = await storage.getAiProviderConfig(providerId);
      if (!provider || provider.tenantId !== user.tenantId) {
        return res.status(400).json({ message: "Invalid provider" });
      }

      // Create ingestion job
      const job = await storage.createAiIngestionJob({
        tenantId: user.tenantId,
        userId: user.id,
        providerId,
        fileName,
        fileSize: fileContent?.length || pdfText.length,
        filePath: fileContent || "", // Store base64 or reference
        status: "processing",
        processingStartedAt: new Date(),
      });

      // Process with AI (async)
      try {
        await storage.updateAiIngestionJob(job.id, { progress: 25 });

        const result = await extractContractData(provider, pdfText);

        if (!result.success || !result.data) {
          await storage.updateAiIngestionJob(job.id, {
            status: "failed",
            errorMessage: result.error || "Extraction failed",
            processingCompletedAt: new Date(),
          });
          return res.status(400).json({ message: result.error || "Extraction failed" });
        }

        await storage.updateAiIngestionJob(job.id, { progress: 75 });

        // Generate confidence scores
        const confidenceScores = generateConfidenceScores(result.data);

        // Save extraction result
        const extractionResult = await storage.createAiExtractionResult({
          jobId: job.id,
          extractedData: result.data,
          confidenceScores,
          tokensUsed: result.tokensUsed,
          processingTimeMs: result.processingTimeMs,
        });

        // Create review task
        const reviewTask = await storage.createAiReviewTask({
          jobId: job.id,
          extractionResultId: extractionResult.id,
          assignedTo: user.id,
          status: "pending",
        });

        // Update job status
        await storage.updateAiIngestionJob(job.id, {
          status: "awaiting_review",
          progress: 100,
          processingCompletedAt: new Date(),
        });

        // Log audit
        await storage.createAuditLog({
          tenantId: user.tenantId,
          userId: user.id,
          entityType: "ai_ingestion_job",
          entityId: job.id,
          action: "create",
          newValue: { fileName, provider: provider.provider, model: provider.model },
        });

        res.json({
          job: { ...job, status: "awaiting_review", progress: 100 },
          extractionResult,
          reviewTask,
        });
      } catch (processingError) {
        await storage.updateAiIngestionJob(job.id, {
          status: "failed",
          errorMessage: String(processingError),
          processingCompletedAt: new Date(),
        });
        throw processingError;
      }
    } catch (error) {
      console.error("Ingestion error:", error);
      res.status(500).json({ message: "Failed to process contract" });
    }
  });

  // Get pending review tasks
  app.get("/api/ai/review-tasks", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const tasks = await storage.getPendingReviewTasks(user.tenantId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review tasks" });
    }
  });

  // Approve review and create contract
  app.post("/api/ai/review-tasks/:id/approve", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const { id } = req.params;
      const { reviewedData, reviewNotes, customerId } = req.body;

      const task = await storage.getAiReviewTask(id);
      if (!task) {
        return res.status(404).json({ message: "Review task not found" });
      }

      // Get extraction result
      const extractionResult = await storage.getAiExtractionResult(task.jobId);
      if (!extractionResult) {
        return res.status(404).json({ message: "Extraction result not found" });
      }

      const contractData = reviewedData || extractionResult.extractedData;

      // Create or get customer
      let customerIdToUse = customerId;
      if (!customerIdToUse) {
        // Create customer from extracted data
        const customer = await storage.createCustomer({
          tenantId: user.tenantId,
          name: contractData.customerName,
          country: "Brasil",
          currency: contractData.currency || "BRL",
        });
        customerIdToUse = customer.id;
      }

      // Create contract
      const contract = await storage.createContract({
        tenantId: user.tenantId,
        customerId: customerIdToUse,
        contractNumber: contractData.contractNumber || `AI-${Date.now()}`,
        title: contractData.title,
        status: "draft",
        startDate: new Date(contractData.startDate),
        endDate: contractData.endDate ? new Date(contractData.endDate) : null,
        totalValue: String(contractData.totalValue),
        currency: contractData.currency || "BRL",
        paymentTerms: contractData.paymentTerms,
      });

      // Create contract version
      const version = await storage.createContractVersion({
        contractId: contract.id,
        versionNumber: 1,
        effectiveDate: new Date(contractData.startDate),
        description: "Initial version from AI extraction",
        totalValue: String(contractData.totalValue),
        createdBy: user.id,
      });

      // Create line items
      for (const item of contractData.lineItems) {
        await storage.createLineItem({
          contractVersionId: version.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          totalPrice: String(item.totalPrice),
          recognitionMethod: item.recognitionMethod || "point_in_time",
          isDistinct: true,
          distinctWithinContext: true,
          deliveryStartDate: item.deliveryStartDate ? new Date(item.deliveryStartDate) : null,
          deliveryEndDate: item.deliveryEndDate ? new Date(item.deliveryEndDate) : null,
        });
      }

      // Create performance obligations if available
      if (contractData.performanceObligations) {
        for (const po of contractData.performanceObligations) {
          await storage.createPerformanceObligation({
            contractVersionId: version.id,
            description: po.description,
            allocatedPrice: String(po.allocatedPrice),
            recognitionMethod: po.recognitionMethod,
            justification: po.justification,
          });
        }
      }

      // Update contract with current version
      await storage.updateContract(contract.id, {
        currentVersionId: version.id,
      });

      // Update review task
      await storage.updateAiReviewTask(id, {
        status: "approved",
        reviewedData: contractData,
        reviewNotes,
        contractId: contract.id,
        reviewedAt: new Date(),
        reviewedBy: user.id,
      });

      // Update ingestion job
      await storage.updateAiIngestionJob(task.jobId, {
        status: "approved",
      });

      // Audit log
      await storage.createAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        entityType: "contract",
        entityId: contract.id,
        action: "create",
        newValue: { source: "ai_ingestion", jobId: task.jobId },
        justification: "Contract created from AI extraction",
      });

      res.json({ success: true, contract });
    } catch (error) {
      console.error("Approve review error:", error);
      res.status(500).json({ message: "Failed to approve and create contract" });
    }
  });

  // Reject review task
  app.post("/api/ai/review-tasks/:id/reject", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      if (!sessionToken) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = sessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ message: "Invalid user" });
      }

      // Check enterprise plan
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant || tenant.planType !== "enterprise") {
        return res.status(403).json({ message: "AI features are only available for Enterprise plan" });
      }

      const { id } = req.params;
      const { reviewNotes } = req.body;

      const task = await storage.getAiReviewTask(id);
      if (!task) {
        return res.status(404).json({ message: "Review task not found" });
      }

      await storage.updateAiReviewTask(id, {
        status: "rejected",
        reviewNotes,
        reviewedAt: new Date(),
        reviewedBy: user.id,
      });

      await storage.updateAiIngestionJob(task.jobId, {
        status: "rejected",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to reject review" });
    }
  });

  return httpServer;
}
