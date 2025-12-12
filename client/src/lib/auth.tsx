import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest } from "./queryClient";

interface User {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "finance" | "auditor" | "operations" | "readonly";
  mustChangePassword: boolean;
  isActive: boolean;
  licenseKey: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsPasswordChange: boolean;
  needsLicenseActivation: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  activateLicense: (licenseKey: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    needsPasswordChange: false,
    needsLicenseActivation: false,
  });

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
          needsPasswordChange: data.user.mustChangePassword,
          needsLicenseActivation: !data.user.isActive,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          needsPasswordChange: false,
          needsLicenseActivation: false,
        });
      }
    } catch {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        needsPasswordChange: false,
        needsLicenseActivation: false,
      });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await response.json();
      
      if (response.ok) {
        setState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
          needsPasswordChange: data.user.mustChangePassword,
          needsLicenseActivation: !data.user.isActive,
        });
        return { success: true };
      } else {
        return { success: false, error: data.message || "Login failed" };
      }
    } catch (error: any) {
      return { success: false, error: error.message || "Login failed" };
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } finally {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        needsPasswordChange: false,
        needsLicenseActivation: false,
      });
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      const data = await response.json();
      
      if (response.ok) {
        setState((prev) => ({
          ...prev,
          needsPasswordChange: false,
          user: prev.user ? { ...prev.user, mustChangePassword: false } : null,
        }));
        return { success: true };
      } else {
        return { success: false, error: data.message || "Password change failed" };
      }
    } catch (error: any) {
      return { success: false, error: error.message || "Password change failed" };
    }
  };

  const activateLicense = async (licenseKey: string) => {
    try {
      const response = await apiRequest("POST", "/api/licenses/activate", { licenseKey });
      const data = await response.json();
      
      if (response.ok) {
        setState((prev) => ({
          ...prev,
          needsLicenseActivation: false,
          user: prev.user ? { ...prev.user, isActive: true, licenseKey } : null,
        }));
        return { success: true };
      } else {
        return { success: false, error: data.message || "License activation failed" };
      }
    } catch (error: any) {
      return { success: false, error: error.message || "License activation failed" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        changePassword,
        activateLicense,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
