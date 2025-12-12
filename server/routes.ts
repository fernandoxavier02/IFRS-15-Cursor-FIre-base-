import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { extractContractData, generateConfidenceScores } from "./ai-service";
import { sendEmail, generateCredentialsEmailHtml, generateCredentialsEmailText } from "./email";
import { aiModels, insertAiProviderConfigSchema, insertPerformanceObligationSchema } from "@shared/schema";
import { z } from "zod";

let DEFAULT_TENANT_ID = "default-tenant";
const ADMIN_EMAIL = "fernandocostaxavier@gmail.com";
const ADMIN_PASSWORD = "Fcxv020781@";

async function ensureDefaultData() {
  // Try to get existing tenant first
  const existingTenants = await storage.getAllTenants();
  let tenant = existingTenants.length > 0 ? existingTenants[0] : null;
  
  if (!tenant) {
    tenant = await storage.createTenant({
      name: "Demo Organization",
      country: "United States",
      currency: "USD",
    });
  }
  
  // Update DEFAULT_TENANT_ID with the actual tenant ID
  DEFAULT_TENANT_ID = tenant.id;
  
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

  // Revenue trend for dashboard - shows monthly revenue recognition amounts (not cumulative)
  app.get("/api/dashboard/revenue-trend", async (req: Request, res: Response) => {
    try {
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      
      // Helper to get calendar month difference (inclusive)
      const getCalendarMonths = (start: Date, end: Date): number => {
        return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      };
      
      const data = months.slice(0, currentMonth + 1).map((month, monthIndex) => {
        let monthlyRecognized = 0;
        let remainingDeferred = 0;
        
        for (const contract of contracts) {
          if (!contract.startDate) continue;
          
          const totalValue = Number(contract.totalValue || 0);
          const contractStart = contract.startDate;
          const contractEnd = contract.endDate || new Date(currentYear, 11, 31);
          
          // Get start/end month indices relative to calendar
          const startMonthIndex = contractStart.getFullYear() === currentYear ? contractStart.getMonth() : 0;
          const endMonthIndex = contractEnd.getFullYear() === currentYear ? contractEnd.getMonth() : 11;
          
          // Skip if contract hasn't started yet this month
          if (monthIndex < startMonthIndex) continue;
          
          // Calculate contract duration using calendar months
          const durationMonths = Math.max(1, getCalendarMonths(contractStart, contractEnd));
          const monthlyRate = totalValue / durationMonths;
          
          // Check if this month falls within contract period
          const contractActive = monthIndex >= startMonthIndex && monthIndex <= endMonthIndex;
          if (contractActive) {
            monthlyRecognized += monthlyRate;
          }
          
          // Calculate how many months have been recognized up to and including this month
          const monthsRecognized = contractActive 
            ? Math.min(monthIndex - startMonthIndex + 1, durationMonths)
            : (monthIndex > endMonthIndex ? durationMonths : 0);
          
          const recognizedToDate = monthlyRate * monthsRecognized;
          remainingDeferred += Math.max(0, totalValue - recognizedToDate);
        }
        
        return {
          period: month,
          recognized: Math.round(monthlyRecognized),
          deferred: Math.round(remainingDeferred),
        };
      });
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to get revenue trend" });
    }
  });

  // Helper function to get contract revenue data using latest version
  async function getContractRevenueData(contractId: string, totalValue: string) {
    const versions = await storage.getContractVersions(contractId);
    let recognizedRevenue = 0;
    if (versions.length > 0) {
      // Get the latest version (highest version number)
      const latestVersion = versions.reduce((latest, v) => 
        (v.versionNumber || 0) > (latest.versionNumber || 0) ? v : latest, versions[0]);
      const obligations = await storage.getPerformanceObligations(latestVersion.id);
      for (const po of obligations) {
        recognizedRevenue += Number(po.recognizedAmount || 0);
      }
    }
    const deferredRevenue = Number(totalValue || 0) - recognizedRevenue;
    return { recognizedRevenue, deferredRevenue };
  }

  // Recent contracts
  app.get("/api/contracts/recent", async (req: Request, res: Response) => {
    try {
      const contracts = await storage.getRecentContracts(DEFAULT_TENANT_ID, 5);
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      const result = await Promise.all(contracts.map(async (c) => {
        const customer = customers.find((cust) => cust.id === c.customerId);
        const revenueData = await getContractRevenueData(c.id, c.totalValue);
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
          recognizedRevenue: revenueData.recognizedRevenue.toFixed(2),
          deferredRevenue: revenueData.deferredRevenue.toFixed(2),
        };
      }));
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
      const result = await Promise.all(contracts.map(async (c) => {
        const customer = customers.find((cust) => cust.id === c.customerId);
        const revenueData = await getContractRevenueData(c.id, c.totalValue);
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
          recognizedRevenue: revenueData.recognizedRevenue.toFixed(2),
          deferredRevenue: revenueData.deferredRevenue.toFixed(2),
        };
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get contracts" });
    }
  });

  // Helper function to generate monthly revenue recognition entries (linear)
  async function generateLinearRevenueEntries(
    tenantId: string,
    contractId: string,
    totalValue: string,
    currency: string,
    startDate: Date,
    endDate: Date | null
  ) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    
    // Calculate months between start and end using year/month counters to avoid date overflow issues
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    
    const monthsDiff = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    const totalAmount = parseFloat(totalValue);
    const monthlyAmount = totalAmount / Math.max(1, monthsDiff);
    
    const entries = [];
    
    // Use year/month counters to guarantee contiguous months
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    for (let i = 0; i < monthsDiff; i++) {
      // First day of the current month
      const periodStart = new Date(currentYear, currentMonth, 1);
      // Last day of the current month
      const periodEnd = new Date(currentYear, currentMonth + 1, 0);
      
      // Create revenue recognition entry: Debit Deferred Revenue, Credit Revenue
      const entry = await storage.createRevenueLedgerEntry({
        tenantId,
        contractId,
        entryDate: periodStart,
        periodStart,
        periodEnd,
        entryType: "revenue",
        debitAccount: "Deferred Revenue",
        creditAccount: "Revenue",
        amount: monthlyAmount.toFixed(2),
        currency,
        description: `Linear revenue recognition - Month ${i + 1}`,
        isPosted: false,
      });
      
      entries.push(entry);
      
      // Advance to next month using counters
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }
    
    return entries;
  }

  app.post("/api/contracts", async (req: Request, res: Response) => {
    try {
      const { customerId, contractNumber, title, startDate, endDate, totalValue, currency, paymentTerms, generateJournalEntries } = req.body;
      
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

      // Generate linear revenue recognition entries if requested or by default
      if (generateJournalEntries !== false && endDate) {
        await generateLinearRevenueEntries(
          DEFAULT_TENANT_ID,
          contract.id,
          totalValue,
          currency || "USD",
          new Date(startDate),
          new Date(endDate)
        );
      }

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

  // Get single contract with full details
  app.get("/api/contracts/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const contract = await storage.getContract(id);
      
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      const customer = customers.find((c) => c.id === contract.customerId);
      
      // Get revenue schedule data for this contract
      const revenueSchedules = await storage.getRevenueSchedules(id);
      const recognizedRevenue = revenueSchedules
        .filter((s) => s.isRecognized)
        .reduce((sum, s) => sum + Number(s.recognizedAmount || 0), 0);
      const deferredRevenue = Number(contract.totalValue || 0) - recognizedRevenue;

      res.json({
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        status: contract.status,
        customerId: contract.customerId,
        customerName: customer?.name || "Unknown",
        totalValue: contract.totalValue,
        currency: contract.currency,
        paymentTerms: contract.paymentTerms,
        startDate: contract.startDate?.toISOString(),
        endDate: contract.endDate?.toISOString() || null,
        createdAt: contract.createdAt?.toISOString(),
        updatedAt: contract.updatedAt?.toISOString(),
        recognizedRevenue: recognizedRevenue.toFixed(2),
        deferredRevenue: deferredRevenue.toFixed(2),
      });
    } catch (error) {
      console.error("Error getting contract:", error);
      res.status(500).json({ message: "Failed to get contract" });
    }
  });

  // Performance obligations for a specific contract
  app.get("/api/contracts/:id/performance-obligations", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const versions = await storage.getContractVersions(id);
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

  // Create performance obligation for a contract
  const createPOSchema = insertPerformanceObligationSchema.omit({ contractVersionId: true }).extend({
    description: z.string().min(1, "Description is required"),
    allocatedPrice: z.union([z.string(), z.number()])
      .transform(v => String(v))
      .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Allocated price must be a positive number"),
    recognitionMethod: z.enum(["over_time", "point_in_time"]),
    measurementMethod: z.enum(["input", "output"]).optional().nullable(),
    percentComplete: z.union([z.string(), z.number()]).optional()
      .transform(v => {
        const str = v ? String(v) : "0";
        const num = parseFloat(str);
        return isNaN(num) ? "0" : str;
      }),
  });

  app.post("/api/contracts/:id/performance-obligations", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const versions = await storage.getContractVersions(id);
      if (versions.length === 0) {
        return res.status(400).json({ message: "Contract has no versions" });
      }

      const latestVersion = versions[0];
      
      const parsed = createPOSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Validation failed" });
      }

      const { description, allocatedPrice, recognitionMethod, measurementMethod, percentComplete } = parsed.data;

      const po = await storage.createPerformanceObligation({
        contractVersionId: latestVersion.id,
        description,
        allocatedPrice,
        recognitionMethod,
        measurementMethod: measurementMethod || null,
        percentComplete: percentComplete || "0",
        recognizedAmount: "0",
        deferredAmount: allocatedPrice,
        isSatisfied: false,
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "performance_obligation",
        entityId: po.id,
        action: "create",
        newValue: po,
        justification: "Performance obligation created",
      });

      res.status(201).json(po);
    } catch (error) {
      console.error("Error creating performance obligation:", error);
      res.status(500).json({ message: "Failed to create performance obligation" });
    }
  });

  // Billing schedules for a specific contract
  app.get("/api/contracts/:id/billing-schedules", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const schedules = await storage.getBillingSchedulesByContract(id);
      
      const result = schedules.map((s) => ({
        id: s.id,
        billingDate: s.billingDate?.toISOString(),
        dueDate: s.dueDate?.toISOString(),
        amount: s.amount,
        currency: contract.currency,
        frequency: s.frequency,
        status: s.status,
        invoiceNumber: s.invoiceNumber,
      }));
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get billing schedules" });
    }
  });

  // Revenue ledger entries for a specific contract
  app.get("/api/contracts/:id/ledger-entries", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const entries = await storage.getRevenueLedgerEntriesByContract(id);
      
      const result = entries.map((e) => ({
        id: e.id,
        entryDate: e.entryDate?.toISOString(),
        entryType: e.entryType,
        debitAccount: e.debitAccount,
        creditAccount: e.creditAccount,
        amount: e.amount,
        currency: contract.currency,
        isPosted: e.isPosted,
        postedAt: e.postedAt?.toISOString() || null,
        description: e.description,
      }));
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get ledger entries" });
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

  // IFRS 15 Disclosure Report
  app.get("/api/reports/disclosure", async (req: Request, res: Response) => {
    const { period } = req.query;
    const reportPeriod = (period as string) || "2024";

    const disaggregatedRevenue = [
      { category: "Software Licenses", overTime: 150000, pointInTime: 75000, total: 225000 },
      { category: "Professional Services", overTime: 120000, pointInTime: 0, total: 120000 },
      { category: "Support & Maintenance", overTime: 80000, pointInTime: 0, total: 80000 },
      { category: "Training", overTime: 30000, pointInTime: 20000, total: 50000 },
      { category: "Hardware", overTime: 0, pointInTime: 95000, total: 95000 },
    ];

    const contractBalances = [
      { period: "Q1 2024", openingAsset: 45000, openingLiability: 120000, revenueRecognized: 185000, cashReceived: 175000, closingAsset: 55000, closingLiability: 110000 },
      { period: "Q2 2024", openingAsset: 55000, openingLiability: 110000, revenueRecognized: 210000, cashReceived: 195000, closingAsset: 70000, closingLiability: 95000 },
      { period: "Q3 2024", openingAsset: 70000, openingLiability: 95000, revenueRecognized: 195000, cashReceived: 220000, closingAsset: 45000, closingLiability: 70000 },
      { period: "Q4 2024", openingAsset: 45000, openingLiability: 70000, revenueRecognized: 230000, cashReceived: 210000, closingAsset: 65000, closingLiability: 50000 },
    ];

    const remainingObligations = [
      { period: "2025 H1", amount: 280000 },
      { period: "2025 H2", amount: 195000 },
      { period: "2026", amount: 320000 },
      { period: "2027+", amount: 150000 },
    ];

    const significantJudgments = [
      {
        area: "Performance Obligation Identification",
        description: "Determining whether goods and services are distinct within the context of the contract",
        impact: "Affects timing and pattern of revenue recognition",
        methodology: "Analysis of integration, modification, and interdependency criteria per IFRS 15.27-30"
      },
      {
        area: "Transaction Price Allocation",
        description: "Allocating transaction price to performance obligations based on standalone selling prices",
        impact: "Determines revenue amount recognized for each obligation",
        methodology: "Observable prices used where available; estimation techniques applied otherwise"
      },
      {
        area: "Variable Consideration Estimation",
        description: "Estimating variable components such as discounts, rebates, and performance bonuses",
        impact: "Constrains transaction price to amounts highly probable of not reversing",
        methodology: "Expected value or most likely amount based on historical data and current conditions"
      },
      {
        area: "Over Time Recognition Measurement",
        description: "Measuring progress toward complete satisfaction of performance obligations",
        impact: "Determines timing of revenue recognition for services delivered over time",
        methodology: "Input method (cost-to-cost) or output method based on nature of obligation"
      },
      {
        area: "Contract Modification Assessment",
        description: "Determining whether modifications are separate contracts or part of existing contracts",
        impact: "Affects whether to account for prospectively or cumulatively",
        methodology: "Evaluation of scope and price changes against IFRS 15.18-21 criteria"
      }
    ];

    const accountingPolicies = [
      "Revenue is recognized when control of goods or services is transferred to the customer at an amount that reflects the consideration expected to be received.",
      "For performance obligations satisfied over time, revenue is recognized using the input method (cost-to-cost) unless output measures are more representative.",
      "For performance obligations satisfied at a point in time, revenue is recognized when indicators of transfer of control are met.",
      "Contract costs to obtain a contract are capitalized when incremental and expected to be recovered, amortized over the contract period.",
      "Contract assets represent the right to consideration for goods or services transferred when that right is conditional on something other than the passage of time.",
      "Contract liabilities represent the obligation to transfer goods or services for which consideration has been received.",
      "The significant financing component is recognized separately when the timing of payments differs significantly from the transfer of goods or services."
    ];

    const totalRecognized = disaggregatedRevenue.reduce((sum, r) => sum + r.total, 0);
    const totalRemaining = remainingObligations.reduce((sum, r) => sum + r.amount, 0);
    const lastBalance = contractBalances[contractBalances.length - 1];

    res.json({
      reportPeriod,
      generatedAt: new Date().toISOString(),
      disaggregatedRevenue,
      contractBalances,
      remainingObligations,
      significantJudgments,
      accountingPolicies,
      totalRecognizedRevenue: totalRecognized,
      totalDeferredRevenue: totalRemaining,
      totalContractAssets: lastBalance.closingAsset,
      totalContractLiabilities: lastBalance.closingLiability,
    });
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

      // Get app URL
      const appUrl = process.env.REPLIT_DOMAINS?.split(",")[0] 
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : "https://app.ifrs15.com";

      // Try to send email - but don't fail license creation if email fails
      let emailResult = { success: false, error: "Email service not configured" };
      try {
        emailResult = await sendEmail({
          to: email,
          subject: "Your IFRS 15 Revenue Manager Access Credentials",
          html: generateCredentialsEmailHtml({
            email,
            password: tempPassword,
            licenseKey,
            appUrl,
          }),
          text: generateCredentialsEmailText({
            email,
            password: tempPassword,
            licenseKey,
            appUrl,
          }),
        });
      } catch (emailError: any) {
        console.error("Email sending error:", emailError);
        emailResult = { success: false, error: emailError.message || "Unknown email error" };
      }

      // Log email status in queue for audit purposes
      try {
        await storage.createEmailQueueItem({
          toEmail: email,
          subject: "Your IFRS 15 Revenue Manager Access Credentials",
          body: `Credentials for ${email}. Password: ${tempPassword}, License: ${licenseKey}`,
          templateType: "credentials",
          status: emailResult.success ? "sent" : "pending",
        });
      } catch (queueError) {
        console.error("Email queue error:", queueError);
      }

      await storage.createAuditLog({
        tenantId: tenant.id,
        entityType: "license",
        entityId: license.id,
        action: "create",
        newValue: { licenseKey, email, seatCount, emailSent: emailResult.success },
        justification: "Admin created license",
      });

      // Always return success with license info and credentials
      res.status(201).json({
        license,
        user: { email: user.email },
        emailSent: emailResult.success,
        credentials: {
          email,
          password: tempPassword,
          licenseKey,
        },
        message: emailResult.success 
          ? "License created and credentials sent via email" 
          : `License created. Email not sent (${emailResult.error}). Credentials shown below.`,
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

  // ==================== ACCOUNTING API ROUTES (IFRS 15) ====================

  // Billing Schedules
  app.get("/api/billing-schedules", async (req: Request, res: Response) => {
    try {
      const schedules = await storage.getBillingSchedules(DEFAULT_TENANT_ID);
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      
      const result = schedules.map((s) => {
        const contract = contracts.find((c) => c.id === s.contractId);
        const customer = contract ? customers.find((cu) => cu.id === contract.customerId) : null;
        return {
          ...s,
          billingDate: s.billingDate?.toISOString(),
          dueDate: s.dueDate?.toISOString(),
          invoicedAt: s.invoicedAt?.toISOString() || null,
          paidAt: s.paidAt?.toISOString() || null,
          createdAt: s.createdAt?.toISOString(),
          contractNumber: contract?.contractNumber || null,
          contractTitle: contract?.title || null,
          customerName: customer?.name || null,
        };
      });
      res.json(result);
    } catch (error) {
      console.error("Error getting billing schedules:", error);
      res.status(500).json({ message: "Failed to get billing schedules" });
    }
  });

  app.get("/api/billing-schedules/upcoming", async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const schedules = await storage.getUpcomingBillings(DEFAULT_TENANT_ID, days);
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      
      const result = schedules.map((s) => {
        const contract = contracts.find((c) => c.id === s.contractId);
        const customer = contract ? customers.find((cu) => cu.id === contract.customerId) : null;
        return {
          ...s,
          billingDate: s.billingDate?.toISOString(),
          dueDate: s.dueDate?.toISOString(),
          contractNumber: contract?.contractNumber || null,
          contractTitle: contract?.title || null,
          customerName: customer?.name || null,
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get upcoming billings" });
    }
  });

  app.get("/api/billing-schedules/overdue", async (req: Request, res: Response) => {
    try {
      const schedules = await storage.getOverdueBillings(DEFAULT_TENANT_ID);
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      
      const result = schedules.map((s) => {
        const contract = contracts.find((c) => c.id === s.contractId);
        const customer = contract ? customers.find((cu) => cu.id === contract.customerId) : null;
        return {
          ...s,
          billingDate: s.billingDate?.toISOString(),
          dueDate: s.dueDate?.toISOString(),
          contractNumber: contract?.contractNumber || null,
          contractTitle: contract?.title || null,
          customerName: customer?.name || null,
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get overdue billings" });
    }
  });

  app.get("/api/contracts/:contractId/billing-schedules", async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const schedules = await storage.getBillingSchedulesByContract(contractId);
      const result = schedules.map((s) => ({
        ...s,
        billingDate: s.billingDate?.toISOString(),
        dueDate: s.dueDate?.toISOString(),
        invoicedAt: s.invoicedAt?.toISOString() || null,
        paidAt: s.paidAt?.toISOString() || null,
        createdAt: s.createdAt?.toISOString(),
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get billing schedules for contract" });
    }
  });

  app.post("/api/billing-schedules", async (req: Request, res: Response) => {
    try {
      const { contractId, performanceObligationId, billingDate, dueDate, amount, currency, frequency, notes } = req.body;
      
      const schedule = await storage.createBillingSchedule({
        tenantId: DEFAULT_TENANT_ID,
        contractId,
        performanceObligationId: performanceObligationId || null,
        billingDate: new Date(billingDate),
        dueDate: new Date(dueDate),
        amount,
        currency: currency || "BRL",
        frequency,
        status: "scheduled",
        notes,
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "billing_schedule",
        entityId: schedule.id,
        action: "create",
        newValue: schedule,
        justification: "Billing schedule created",
      });

      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating billing schedule:", error);
      res.status(500).json({ message: "Failed to create billing schedule" });
    }
  });

  app.patch("/api/billing-schedules/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      
      if (updateData.billingDate) {
        updateData.billingDate = new Date(updateData.billingDate);
      }
      if (updateData.dueDate) {
        updateData.dueDate = new Date(updateData.dueDate);
      }
      if (updateData.invoicedAt) {
        updateData.invoicedAt = new Date(updateData.invoicedAt);
      }
      if (updateData.paidAt) {
        updateData.paidAt = new Date(updateData.paidAt);
      }

      const schedule = await storage.updateBillingSchedule(id, updateData);
      if (!schedule) {
        return res.status(404).json({ message: "Billing schedule not found" });
      }

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "billing_schedule",
        entityId: id,
        action: "update",
        newValue: schedule,
        justification: "Billing schedule updated",
      });

      res.json(schedule);
    } catch (error) {
      res.status(500).json({ message: "Failed to update billing schedule" });
    }
  });

  // Revenue Ledger Entries
  app.get("/api/ledger-entries", async (req: Request, res: Response) => {
    try {
      const entries = await storage.getRevenueLedgerEntries(DEFAULT_TENANT_ID);
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      
      const result = entries.map((e) => {
        const contract = contracts.find((c) => c.id === e.contractId);
        const customer = contract ? customers.find((cu) => cu.id === contract.customerId) : null;
        return {
          ...e,
          entryDate: e.entryDate?.toISOString(),
          periodStart: e.periodStart?.toISOString(),
          periodEnd: e.periodEnd?.toISOString(),
          postedAt: e.postedAt?.toISOString() || null,
          createdAt: e.createdAt?.toISOString(),
          contractNumber: contract?.contractNumber || null,
          contractTitle: contract?.title || null,
          customerName: customer?.name || null,
        };
      });
      res.json(result);
    } catch (error) {
      console.error("Error getting ledger entries:", error);
      res.status(500).json({ message: "Failed to get ledger entries" });
    }
  });

  app.get("/api/ledger-entries/unposted", async (req: Request, res: Response) => {
    try {
      const entries = await storage.getUnpostedLedgerEntries(DEFAULT_TENANT_ID);
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      
      const result = entries.map((e) => {
        const contract = contracts.find((c) => c.id === e.contractId);
        return {
          ...e,
          entryDate: e.entryDate?.toISOString(),
          periodStart: e.periodStart?.toISOString(),
          periodEnd: e.periodEnd?.toISOString(),
          contractNumber: contract?.contractNumber || null,
          contractTitle: contract?.title || null,
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get unposted entries" });
    }
  });

  app.get("/api/contracts/:contractId/ledger-entries", async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const entries = await storage.getRevenueLedgerEntriesByContract(contractId);
      const result = entries.map((e) => ({
        ...e,
        entryDate: e.entryDate?.toISOString(),
        periodStart: e.periodStart?.toISOString(),
        periodEnd: e.periodEnd?.toISOString(),
        postedAt: e.postedAt?.toISOString() || null,
        createdAt: e.createdAt?.toISOString(),
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get ledger entries for contract" });
    }
  });

  app.post("/api/ledger-entries", async (req: Request, res: Response) => {
    try {
      const { 
        contractId, performanceObligationId, billingScheduleId, entryDate, 
        periodStart, periodEnd, entryType, debitAccount, creditAccount, 
        amount, currency, exchangeRate, description, referenceNumber 
      } = req.body;
      
      const entry = await storage.createRevenueLedgerEntry({
        tenantId: DEFAULT_TENANT_ID,
        contractId,
        performanceObligationId: performanceObligationId || null,
        billingScheduleId: billingScheduleId || null,
        entryDate: new Date(entryDate),
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        entryType,
        debitAccount,
        creditAccount,
        amount,
        currency: currency || "BRL",
        exchangeRate: exchangeRate || "1",
        functionalAmount: amount,
        description,
        referenceNumber,
        isPosted: false,
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "ledger_entry",
        entityId: entry.id,
        action: "create",
        newValue: entry,
        justification: "Ledger entry created",
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating ledger entry:", error);
      res.status(500).json({ message: "Failed to create ledger entry" });
    }
  });

  app.post("/api/ledger-entries/:id/post", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      const session = sessionToken ? sessions.get(sessionToken) : null;
      const userId = session?.userId || null;

      const { id } = req.params;
      const entry = await storage.updateRevenueLedgerEntry(id, {
        isPosted: true,
        postedAt: new Date(),
        postedBy: userId,
      });

      if (!entry) {
        return res.status(404).json({ message: "Ledger entry not found" });
      }

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "ledger_entry",
        entityId: id,
        action: "update",
        newValue: { isPosted: true, postedAt: entry.postedAt },
        justification: "Ledger entry posted to GL",
      });

      res.json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to post ledger entry" });
    }
  });

  app.post("/api/ledger-entries/post-all", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session;
      const session = sessionToken ? sessions.get(sessionToken) : null;
      const userId = session?.userId || null;

      const unposted = await storage.getUnpostedLedgerEntries(DEFAULT_TENANT_ID);
      const posted: string[] = [];

      for (const entry of unposted) {
        await storage.updateRevenueLedgerEntry(entry.id, {
          isPosted: true,
          postedAt: new Date(),
          postedBy: userId,
        });
        posted.push(entry.id);
      }

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "ledger_entry",
        entityId: "batch",
        action: "update",
        newValue: { postedCount: posted.length, postedIds: posted },
        justification: "Batch posted ledger entries to GL",
      });

      res.json({ success: true, postedCount: posted.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to post ledger entries" });
    }
  });

  // Update ledger entry (manual editing)
  app.patch("/api/ledger-entries/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        entryDate, periodStart, periodEnd, entryType, 
        debitAccount, creditAccount, amount, currency,
        exchangeRate, description, referenceNumber 
      } = req.body;

      // Get current entry to check if posted
      const entries = await storage.getRevenueLedgerEntries(DEFAULT_TENANT_ID);
      const currentEntry = entries.find(e => e.id === id);
      
      if (!currentEntry) {
        return res.status(404).json({ message: "Ledger entry not found" });
      }

      if (currentEntry.isPosted) {
        return res.status(400).json({ message: "Cannot edit a posted ledger entry" });
      }

      const updateData: any = {};
      if (entryDate) updateData.entryDate = new Date(entryDate);
      if (periodStart) updateData.periodStart = new Date(periodStart);
      if (periodEnd) updateData.periodEnd = new Date(periodEnd);
      if (entryType) updateData.entryType = entryType;
      if (debitAccount) updateData.debitAccount = debitAccount;
      if (creditAccount) updateData.creditAccount = creditAccount;
      if (amount) {
        updateData.amount = amount;
        updateData.functionalAmount = amount;
      }
      if (currency) updateData.currency = currency;
      if (exchangeRate) updateData.exchangeRate = exchangeRate;
      if (description !== undefined) updateData.description = description;
      if (referenceNumber !== undefined) updateData.referenceNumber = referenceNumber;

      const entry = await storage.updateRevenueLedgerEntry(id, updateData);

      if (!entry) {
        return res.status(404).json({ message: "Ledger entry not found" });
      }

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "ledger_entry",
        entityId: id,
        action: "update",
        newValue: updateData,
        justification: "Ledger entry manually updated",
      });

      res.json(entry);
    } catch (error) {
      console.error("Error updating ledger entry:", error);
      res.status(500).json({ message: "Failed to update ledger entry" });
    }
  });

  // Delete ledger entry
  app.delete("/api/ledger-entries/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get current entry to check if posted
      const entries = await storage.getRevenueLedgerEntries(DEFAULT_TENANT_ID);
      const currentEntry = entries.find(e => e.id === id);
      
      if (!currentEntry) {
        return res.status(404).json({ message: "Ledger entry not found" });
      }

      if (currentEntry.isPosted) {
        return res.status(400).json({ message: "Cannot delete a posted ledger entry" });
      }

      await storage.deleteRevenueLedgerEntry(id);

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "ledger_entry",
        entityId: id,
        action: "delete",
        justification: "Ledger entry deleted",
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting ledger entry:", error);
      res.status(500).json({ message: "Failed to delete ledger entry" });
    }
  });

  // Contract Costs
  app.get("/api/contract-costs", async (req: Request, res: Response) => {
    try {
      const costs = await storage.getContractCosts(DEFAULT_TENANT_ID);
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      
      const result = costs.map((c) => {
        const contract = contracts.find((ct) => ct.id === c.contractId);
        const customer = contract ? customers.find((cu) => cu.id === contract.customerId) : null;
        return {
          ...c,
          incurredDate: c.incurredDate?.toISOString(),
          amortizationStartDate: c.amortizationStartDate?.toISOString(),
          amortizationEndDate: c.amortizationEndDate?.toISOString(),
          createdAt: c.createdAt?.toISOString(),
          contractNumber: contract?.contractNumber || null,
          contractTitle: contract?.title || null,
          customerName: customer?.name || null,
        };
      });
      res.json(result);
    } catch (error) {
      console.error("Error getting contract costs:", error);
      res.status(500).json({ message: "Failed to get contract costs" });
    }
  });

  app.get("/api/contracts/:contractId/costs", async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const costs = await storage.getContractCostsByContract(contractId);
      const result = costs.map((c) => ({
        ...c,
        incurredDate: c.incurredDate?.toISOString(),
        amortizationStartDate: c.amortizationStartDate?.toISOString(),
        amortizationEndDate: c.amortizationEndDate?.toISOString(),
        createdAt: c.createdAt?.toISOString(),
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get costs for contract" });
    }
  });

  app.post("/api/contract-costs", async (req: Request, res: Response) => {
    try {
      const { 
        contractId, costType, description, amount, currency, 
        incurredDate, amortizationStartDate, amortizationEndDate, amortizationMethod 
      } = req.body;
      
      const cost = await storage.createContractCost({
        tenantId: DEFAULT_TENANT_ID,
        contractId,
        costType,
        description,
        amount,
        currency: currency || "BRL",
        incurredDate: new Date(incurredDate),
        amortizationStartDate: new Date(amortizationStartDate),
        amortizationEndDate: new Date(amortizationEndDate),
        amortizationMethod: amortizationMethod || "straight_line",
        totalAmortized: "0",
        remainingBalance: amount,
        isFullyAmortized: false,
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "contract_cost",
        entityId: cost.id,
        action: "create",
        newValue: cost,
        justification: "Contract cost created",
      });

      res.status(201).json(cost);
    } catch (error) {
      console.error("Error creating contract cost:", error);
      res.status(500).json({ message: "Failed to create contract cost" });
    }
  });

  app.patch("/api/contract-costs/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      
      if (updateData.incurredDate) {
        updateData.incurredDate = new Date(updateData.incurredDate);
      }
      if (updateData.amortizationStartDate) {
        updateData.amortizationStartDate = new Date(updateData.amortizationStartDate);
      }
      if (updateData.amortizationEndDate) {
        updateData.amortizationEndDate = new Date(updateData.amortizationEndDate);
      }

      const cost = await storage.updateContractCost(id, updateData);
      if (!cost) {
        return res.status(404).json({ message: "Contract cost not found" });
      }

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "contract_cost",
        entityId: id,
        action: "update",
        newValue: cost,
        justification: "Contract cost updated",
      });

      res.json(cost);
    } catch (error) {
      res.status(500).json({ message: "Failed to update contract cost" });
    }
  });

  // Exchange Rates
  app.get("/api/exchange-rates", async (req: Request, res: Response) => {
    try {
      const rates = await storage.getExchangeRates(DEFAULT_TENANT_ID);
      const result = rates.map((r) => ({
        ...r,
        effectiveDate: r.effectiveDate?.toISOString(),
        createdAt: r.createdAt?.toISOString(),
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get exchange rates" });
    }
  });

  app.post("/api/exchange-rates", async (req: Request, res: Response) => {
    try {
      const { fromCurrency, toCurrency, rate, effectiveDate, source } = req.body;
      
      const exchangeRate = await storage.createExchangeRate({
        tenantId: DEFAULT_TENANT_ID,
        fromCurrency,
        toCurrency,
        rate,
        effectiveDate: new Date(effectiveDate),
        source: source || "manual",
      });

      res.status(201).json(exchangeRate);
    } catch (error) {
      console.error("Error creating exchange rate:", error);
      res.status(500).json({ message: "Failed to create exchange rate" });
    }
  });

  // Financing Components
  app.get("/api/financing-components", async (req: Request, res: Response) => {
    try {
      const components = await storage.getFinancingComponents(DEFAULT_TENANT_ID);
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      
      const result = components.map((fc) => {
        const contract = contracts.find((c) => c.id === fc.contractId);
        return {
          ...fc,
          calculatedAt: fc.calculatedAt?.toISOString(),
          createdAt: fc.createdAt?.toISOString(),
          contractNumber: contract?.contractNumber || null,
          contractTitle: contract?.title || null,
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get financing components" });
    }
  });

  app.get("/api/contracts/:contractId/financing-components", async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const components = await storage.getFinancingComponentsByContract(contractId);
      const result = components.map((fc) => ({
        ...fc,
        calculatedAt: fc.calculatedAt?.toISOString(),
        createdAt: fc.createdAt?.toISOString(),
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get financing components for contract" });
    }
  });

  app.post("/api/financing-components", async (req: Request, res: Response) => {
    try {
      const { 
        contractId, nominalAmount, presentValue, discountRate, 
        financingPeriodMonths, totalInterest, currency 
      } = req.body;
      
      const component = await storage.createFinancingComponent({
        tenantId: DEFAULT_TENANT_ID,
        contractId,
        nominalAmount,
        presentValue,
        discountRate,
        financingPeriodMonths,
        totalInterest,
        recognizedInterest: "0",
        currency: currency || "BRL",
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "financing_component",
        entityId: component.id,
        action: "create",
        newValue: component,
        justification: "Significant financing component calculated",
      });

      res.status(201).json(component);
    } catch (error) {
      console.error("Error creating financing component:", error);
      res.status(500).json({ message: "Failed to create financing component" });
    }
  });

  // Consolidated Balances
  app.get("/api/consolidated-balances", async (req: Request, res: Response) => {
    try {
      const balances = await storage.getConsolidatedBalances(DEFAULT_TENANT_ID);
      const result = balances.map((b) => ({
        ...b,
        periodDate: b.periodDate?.toISOString(),
        createdAt: b.createdAt?.toISOString(),
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get consolidated balances" });
    }
  });

  app.get("/api/consolidated-balances/latest", async (req: Request, res: Response) => {
    try {
      const balance = await storage.getLatestConsolidatedBalance(DEFAULT_TENANT_ID);
      if (!balance) {
        return res.json(null);
      }
      res.json({
        ...balance,
        periodDate: balance.periodDate?.toISOString(),
        createdAt: balance.createdAt?.toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get latest consolidated balance" });
    }
  });

  app.post("/api/consolidated-balances", async (req: Request, res: Response) => {
    try {
      const { 
        periodDate, periodType, totalContractAssets, totalContractLiabilities,
        totalReceivables, totalDeferredRevenue, totalRecognizedRevenue,
        totalBilledAmount, totalCashReceived, totalRemainingObligations,
        contractCount, currency 
      } = req.body;
      
      const balance = await storage.createConsolidatedBalance({
        tenantId: DEFAULT_TENANT_ID,
        periodDate: new Date(periodDate),
        periodType: periodType || "monthly",
        totalContractAssets: totalContractAssets || "0",
        totalContractLiabilities: totalContractLiabilities || "0",
        totalReceivables: totalReceivables || "0",
        totalDeferredRevenue: totalDeferredRevenue || "0",
        totalRecognizedRevenue: totalRecognizedRevenue || "0",
        totalBilledAmount: totalBilledAmount || "0",
        totalCashReceived: totalCashReceived || "0",
        totalRemainingObligations: totalRemainingObligations || "0",
        contractCount: contractCount || 0,
        currency: currency || "BRL",
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "consolidated_balance",
        entityId: balance.id,
        action: "create",
        newValue: balance,
        justification: "Period balance snapshot created",
      });

      res.status(201).json(balance);
    } catch (error) {
      console.error("Error creating consolidated balance:", error);
      res.status(500).json({ message: "Failed to create consolidated balance" });
    }
  });

  // ============ IFRS 15 Accounting Control ============
  // GET /api/ifrs15-accounting-control/:year/:month
  // Returns contract assets (unbilled revenue) and contract liabilities (deferred revenue)
  // with opening balance, debits, credits, movement, and closing balance per contract
  app.get("/api/ifrs15-accounting-control/:year/:month", async (req: Request, res: Response) => {
    try {
      const { year, month } = req.params;
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      
      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ message: "Invalid year or month" });
      }
      
      // Period boundaries
      const periodStart = new Date(yearNum, monthNum - 1, 1);
      const periodEnd = new Date(yearNum, monthNum, 0); // Last day of month
      const previousPeriodEnd = new Date(yearNum, monthNum - 1, 0); // Last day of previous month
      
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const customers = await storage.getCustomers(DEFAULT_TENANT_ID);
      const ledgerEntries = await storage.getRevenueLedgerEntries(DEFAULT_TENANT_ID);
      const billingSchedules = await storage.getBillingSchedules(DEFAULT_TENANT_ID);
      
      interface ContractAccountingRow {
        id: string;
        contractId: string;
        contractNumber: string;
        customerName: string;
        currency: string;
        openingBalance: number;
        debits: number;
        credits: number;
        movement: number;
        closingBalance: number;
        type: "asset" | "liability";
      }
      
      const contractAssets: ContractAccountingRow[] = [];
      const contractLiabilities: ContractAccountingRow[] = [];
      
      let totalAssetOpening = 0;
      let totalAssetDebits = 0;
      let totalAssetCredits = 0;
      let totalAssetMovement = 0;
      let totalAssetClosing = 0;
      
      let totalLiabilityOpening = 0;
      let totalLiabilityDebits = 0;
      let totalLiabilityCredits = 0;
      let totalLiabilityMovement = 0;
      let totalLiabilityClosing = 0;
      
      for (const contract of contracts) {
        const customer = customers.find(c => c.id === contract.customerId);
        const contractLedger = ledgerEntries.filter(e => e.contractId === contract.id);
        const contractBilling = billingSchedules.filter(b => b.contractId === contract.id);
        
        // Calculate revenue recognized up to previous period end
        let revenueRecognizedPrevious = 0;
        let amountsInvoicedPrevious = 0;
        
        // Calculate revenue recognized in current period
        let revenueRecognizedPeriod = 0;
        let amountsInvoicedPeriod = 0;
        
        for (const entry of contractLedger) {
          if (entry.entryType === "revenue" && entry.isPosted) {
            const entryDate = entry.entryDate ? new Date(entry.entryDate) : null;
            const amount = parseFloat(entry.amount || "0");
            
            if (entryDate && entryDate <= previousPeriodEnd) {
              revenueRecognizedPrevious += amount;
            } else if (entryDate && entryDate >= periodStart && entryDate <= periodEnd) {
              revenueRecognizedPeriod += amount;
            }
          }
        }
        
        for (const billing of contractBilling) {
          if (billing.status === "invoiced" || billing.status === "paid") {
            const billingDate = billing.invoiceDate ? new Date(billing.invoiceDate) : 
                               (billing.scheduledDate ? new Date(billing.scheduledDate) : null);
            const amount = parseFloat(billing.amount || "0");
            
            if (billingDate && billingDate <= previousPeriodEnd) {
              amountsInvoicedPrevious += amount;
            } else if (billingDate && billingDate >= periodStart && billingDate <= periodEnd) {
              amountsInvoicedPeriod += amount;
            }
          }
        }
        
        // Net Balance = Revenue Recognized - Amounts Invoiced
        // Positive = Contract Asset (unbilled revenue)
        // Negative = Contract Liability (deferred revenue)
        const openingNetBalance = revenueRecognizedPrevious - amountsInvoicedPrevious;
        const closingNetBalance = (revenueRecognizedPrevious + revenueRecognizedPeriod) - (amountsInvoicedPrevious + amountsInvoicedPeriod);
        
        // Skip contracts with no balance and no activity
        if (openingNetBalance === 0 && closingNetBalance === 0 && revenueRecognizedPeriod === 0 && amountsInvoicedPeriod === 0) continue;
        
        const contractNumber = contract.contractNumber || `C-${contract.id.slice(0, 8)}`;
        const customerName = customer?.name || "Unknown";
        const currency = contract.currency || "BRL";
        
        // Classify based on closing balance sign
        if (closingNetBalance >= 0) {
          // Contract Asset (Unbilled Revenue)
          // Debit = Revenue recognized (increases unbilled revenue)
          // Credit = Billing (decreases unbilled revenue as we invoice)
          const row: ContractAccountingRow = {
            id: contract.id,
            contractId: contract.id,
            contractNumber,
            customerName,
            currency,
            openingBalance: Math.max(0, openingNetBalance),
            debits: revenueRecognizedPeriod,
            credits: amountsInvoicedPeriod,
            movement: revenueRecognizedPeriod - amountsInvoicedPeriod,
            closingBalance: closingNetBalance,
            type: "asset",
          };
          
          contractAssets.push(row);
          totalAssetOpening += row.openingBalance;
          totalAssetDebits += row.debits;
          totalAssetCredits += row.credits;
          totalAssetMovement += row.movement;
          totalAssetClosing += row.closingBalance;
        } else {
          // Contract Liability (Deferred Revenue)
          // For liability accounts, we show positive balances
          // Debit = Revenue recognized (decreases deferred revenue)
          // Credit = Billing (increases deferred revenue)
          const row: ContractAccountingRow = {
            id: contract.id,
            contractId: contract.id,
            contractNumber,
            customerName,
            currency,
            openingBalance: Math.abs(openingNetBalance),
            debits: revenueRecognizedPeriod,
            credits: amountsInvoicedPeriod,
            movement: amountsInvoicedPeriod - revenueRecognizedPeriod, // Credit increases liability
            closingBalance: Math.abs(closingNetBalance),
            type: "liability",
          };
          
          contractLiabilities.push(row);
          totalLiabilityOpening += row.openingBalance;
          totalLiabilityDebits += row.debits;
          totalLiabilityCredits += row.credits;
          totalLiabilityMovement += row.movement;
          totalLiabilityClosing += row.closingBalance;
        }
      }
      
      res.json({
        period: `${year}-${month.padStart(2, "0")}`,
        contractAssets,
        contractLiabilities,
        totalAssetOpening,
        totalAssetDebits,
        totalAssetCredits,
        totalAssetMovement,
        totalAssetClosing,
        totalLiabilityOpening,
        totalLiabilityDebits,
        totalLiabilityCredits,
        totalLiabilityMovement,
        totalLiabilityClosing,
      });
    } catch (error) {
      console.error("Error fetching IFRS 15 accounting control data:", error);
      res.status(500).json({ message: "Failed to fetch accounting control data" });
    }
  });

  // Generate consolidated balance snapshot (compute from current data)
  app.post("/api/consolidated-balances/generate", async (req: Request, res: Response) => {
    try {
      // Use current date if not provided
      const periodDate = req.body.periodDate ? new Date(req.body.periodDate) : new Date();
      const periodType = req.body.periodType || "monthly";
      
      const contracts = await storage.getContracts(DEFAULT_TENANT_ID);
      const billingSchedules = await storage.getBillingSchedules(DEFAULT_TENANT_ID);
      const ledgerEntries = await storage.getRevenueLedgerEntries(DEFAULT_TENANT_ID);
      
      // Calculate totals from current data
      let totalRecognizedRevenue = 0;
      let totalDeferredRevenue = 0;
      let totalBilledAmount = 0;
      let totalCashReceived = 0;

      for (const entry of ledgerEntries) {
        if (entry.isPosted && entry.entryType === "revenue") {
          totalRecognizedRevenue += parseFloat(entry.amount || "0");
        }
        if (entry.entryType === "deferred_revenue") {
          totalDeferredRevenue += parseFloat(entry.amount || "0");
        }
      }

      for (const schedule of billingSchedules) {
        if (schedule.status === "invoiced" || schedule.status === "paid") {
          totalBilledAmount += parseFloat(schedule.amount || "0");
        }
        if (schedule.status === "paid") {
          totalCashReceived += parseFloat(schedule.paidAmount || schedule.amount || "0");
        }
      }

      const totalContractAssets = Math.max(0, totalRecognizedRevenue - totalBilledAmount);
      const totalContractLiabilities = Math.max(0, totalBilledAmount - totalRecognizedRevenue);

      const balance = await storage.createConsolidatedBalance({
        tenantId: DEFAULT_TENANT_ID,
        periodDate: periodDate,
        periodType: periodType,
        totalContractAssets: totalContractAssets.toFixed(2),
        totalContractLiabilities: totalContractLiabilities.toFixed(2),
        totalReceivables: (totalBilledAmount - totalCashReceived).toFixed(2),
        totalDeferredRevenue: totalDeferredRevenue.toFixed(2),
        totalRecognizedRevenue: totalRecognizedRevenue.toFixed(2),
        totalBilledAmount: totalBilledAmount.toFixed(2),
        totalCashReceived: totalCashReceived.toFixed(2),
        totalRemainingObligations: "0",
        contractCount: contracts.length,
        currency: "BRL",
      });

      await storage.createAuditLog({
        tenantId: DEFAULT_TENANT_ID,
        entityType: "consolidated_balance",
        entityId: balance.id,
        action: "create",
        newValue: balance,
        justification: "Automated period balance snapshot generated",
      });

      res.status(201).json(balance);
    } catch (error) {
      console.error("Error generating consolidated balance:", error);
      res.status(500).json({ message: "Failed to generate consolidated balance" });
    }
  });

  return httpServer;
}
