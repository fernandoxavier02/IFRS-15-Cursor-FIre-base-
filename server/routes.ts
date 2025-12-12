import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

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

  return httpServer;
}
