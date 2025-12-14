// Firebase Authentication Provider for React
import {
    EmailAuthProvider,
    sendPasswordResetEmail as firebaseSendPasswordReset,
    User as FirebaseUser,
    onAuthStateChanged,
    reauthenticateWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { auth, db, functions } from "./firebase";

interface User {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  role: "admin" | "finance" | "auditor" | "operations" | "readonly";
  tenantId: string;
  mustChangePassword: boolean;
  isActive: boolean;
  licenseKey: string | null;
}

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
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
  getIdToken: () => Promise<string | null>;
  sendPasswordResetEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    firebaseUser: null,
    isLoading: true,
    isAuthenticated: false,
    needsPasswordChange: false,
    needsLicenseActivation: false,
  });

  // Fetch user data from Firestore
  const fetchUserData = useCallback(async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
      // Get user document from Firestore
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      
      if (!userDoc.exists()) {
        console.warn("User document not found in Firestore");
        return null;
      }

      const userData = userDoc.data();
      
      // Get custom claims for role and tenant
      const tokenResult = await firebaseUser.getIdTokenResult();
      const claims = tokenResult.claims;

      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        fullName: userData.fullName || firebaseUser.displayName || "",
        role: (claims.role as User["role"]) || userData.role || "readonly",
        tenantId: (claims.tenantId as string) || userData.tenantId || "",
        mustChangePassword: userData.mustChangePassword ?? false,
        isActive: userData.isActive ?? false,
        licenseKey: userData.licenseKey || null,
      };
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setState({
        user: null,
        firebaseUser: null,
        isLoading: false,
        isAuthenticated: false,
        needsPasswordChange: false,
        needsLicenseActivation: false,
      });
      return;
    }

    try {
      // Force token refresh to get latest claims
      await currentUser.getIdToken(true);
      const userData = await fetchUserData(currentUser);

      if (userData) {
        setState({
          user: userData,
          firebaseUser: currentUser,
          isLoading: false,
          isAuthenticated: true,
          needsPasswordChange: userData.mustChangePassword,
          needsLicenseActivation: !userData.isActive,
        });
      } else {
        // User document doesn't exist
        setState({
          user: null,
          firebaseUser: currentUser,
          isLoading: false,
          isAuthenticated: false,
          needsPasswordChange: false,
          needsLicenseActivation: false,
        });
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  }, [fetchUserData]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser);

        setState({
          user: userData,
          firebaseUser,
          isLoading: false,
          isAuthenticated: !!userData,
          needsPasswordChange: userData?.mustChangePassword ?? false,
          needsLicenseActivation: userData ? !userData.isActive : false,
        });
      } else {
        setState({
          user: null,
          firebaseUser: null,
          isLoading: false,
          isAuthenticated: false,
          needsPasswordChange: false,
          needsLicenseActivation: false,
        });
      }
    });

    return () => unsubscribe();
  }, [fetchUserData]);

  // Login
  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await fetchUserData(userCredential.user);

      if (!userData) {
        await signOut(auth);
        return { success: false, error: "User data not found" };
      }

      setState({
        user: userData,
        firebaseUser: userCredential.user,
        isLoading: false,
        isAuthenticated: true,
        needsPasswordChange: userData.mustChangePassword,
        needsLicenseActivation: !userData.isActive,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Login error:", error);
      
      let errorMessage = "Login failed";
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        errorMessage = "Invalid email or password";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setState({
        user: null,
        firebaseUser: null,
        isLoading: false,
        isAuthenticated: false,
        needsPasswordChange: false,
        needsLicenseActivation: false,
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Change password
  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        return { success: false, error: "Not authenticated" };
      }

      // Reauthenticate first
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      // Update Firestore to mark password as changed
      await updateDoc(doc(db, "users", currentUser.uid), {
        mustChangePassword: false,
      });

      // Update state
      setState((prev) => ({
        ...prev,
        needsPasswordChange: false,
        user: prev.user ? { ...prev.user, mustChangePassword: false } : null,
      }));

      return { success: true };
    } catch (error: any) {
      console.error("Change password error:", error);
      
      let errorMessage = "Password change failed";
      if (error.code === "auth/wrong-password") {
        errorMessage = "Current password is incorrect";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "New password is too weak";
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Activate license
  const activateLicense = async (licenseKey: string) => {
    try {
      const activateLicenseFn = httpsCallable(functions, "activateUserLicense");
      const result = await activateLicenseFn({ licenseKey });
      const data = result.data as { success: boolean; tenantId?: string; error?: string };

      if (data.success) {
        // Refresh user to get updated claims
        await refreshUser();
        
        return { success: true };
      } else {
        return { success: false, error: data.error || "License activation failed" };
      }
    } catch (error: any) {
      console.error("License activation error:", error);
      return { 
        success: false, 
        error: error.message || "License activation failed" 
      };
    }
  };

  // Send password reset email
  const sendPasswordResetEmail = async (email: string) => {
    try {
      await firebaseSendPasswordReset(auth, email);
      return { success: true };
    } catch (error: any) {
      console.error("Password reset error:", error);
      
      let errorMessage = "Failed to send password reset email";
      if (error.code === "auth/user-not-found") {
        // For security, don't reveal if user exists
        return { success: true }; // Pretend it worked
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Get ID token for API calls
  const getIdToken = async (): Promise<string | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    
    try {
      return await currentUser.getIdToken();
    } catch (error) {
      console.error("Error getting ID token:", error);
      return null;
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
        getIdToken,
        sendPasswordResetEmail,
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

// Hook to get auth header for API calls
export function useAuthHeader() {
  const { getIdToken } = useAuth();
  
  return async () => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
}
