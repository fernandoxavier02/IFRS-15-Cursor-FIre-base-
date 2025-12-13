import { NextFunction, Request, Response } from "express";
import { auth } from "./admin";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    tenantId: string;
    role: string;
    systemAdmin?: boolean;
  };
}

// Middleware to verify Firebase Auth token
export async function verifyAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      tenantId: decodedToken.tenantId || "",
      role: decodedToken.role || "readonly",
      systemAdmin: decodedToken.systemAdmin || false,
    };
    
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
}

// Middleware to require specific roles
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (req.user.systemAdmin) {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      return;
    }

    next();
  };
}

// Middleware to require tenant access
export function requireTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!req.user.tenantId && !req.user.systemAdmin) {
    res.status(403).json({ message: "Forbidden: No tenant access" });
    return;
  }

  next();
}

// Helper to check if user can write (not readonly)
export function canWrite(role: string): boolean {
  return role !== "readonly";
}

// Helper to check if user is admin or finance
export function isAdminOrFinance(role: string): boolean {
  return role === "admin" || role === "finance";
}
