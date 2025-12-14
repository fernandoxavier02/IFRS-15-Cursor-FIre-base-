import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-firebase";
import { tenantService } from "@/lib/firestore-service";

export interface PlanInfo {
  planType: "starter" | "professional" | "enterprise";
  maxContracts: number;
  maxLicenses: number;
  currentContracts: number;
  currentLicenses: number;
}

export interface PlanFeatures {
  canCreateContract: boolean;
  canCreateLicense: boolean;
  hasAdvancedReports: boolean;
  hasVariableConsideration: boolean;
  hasContractModifications: boolean;
  hasAuditTrail: boolean;
  hasCustomIntegrations: boolean;
  hasDedicatedSupport: boolean;
  contractsRemaining: number;
  licensesRemaining: number;
  isUnlimited: boolean;
}

const planFeatureMatrix = {
  starter: {
    hasAdvancedReports: false,
    hasVariableConsideration: false,
    hasContractModifications: false,
    hasAuditTrail: false,
    hasCustomIntegrations: false,
    hasDedicatedSupport: false,
  },
  professional: {
    hasAdvancedReports: true,
    hasVariableConsideration: true,
    hasContractModifications: true,
    hasAuditTrail: false,
    hasCustomIntegrations: false,
    hasDedicatedSupport: false,
  },
  enterprise: {
    hasAdvancedReports: true,
    hasVariableConsideration: true,
    hasContractModifications: true,
    hasAuditTrail: true,
    hasCustomIntegrations: true,
    hasDedicatedSupport: true,
  },
};

const MASTER_FULL_ACCESS: PlanFeatures = {
  canCreateContract: true,
  canCreateLicense: true,
  hasAdvancedReports: true,
  hasVariableConsideration: true,
  hasContractModifications: true,
  hasAuditTrail: true,
  hasCustomIntegrations: true,
  hasDedicatedSupport: true,
  contractsRemaining: -1,
  licensesRemaining: -1,
  isUnlimited: true,
};

const MASTER_USER_EMAIL = "fernandocostaxavier@gmail.com";

export function usePlan() {
  const { isAuthenticated, user } = useAuth();
  const isMasterUser = user?.email === MASTER_USER_EMAIL;

  // Fetch plan info from Firestore tenant document
  // Fallback: returns starter plan defaults if tenant not found or on error
  const { data: planInfo, isLoading } = useQuery<PlanInfo>({
    queryKey: ["plan", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) {
        // Return starter defaults if no tenantId
        return {
          planType: "starter",
          maxContracts: 10,
          maxLicenses: 3,
          currentContracts: 0,
          currentLicenses: 0,
        };
      }
      return tenantService.getPlanInfo(user.tenantId);
    },
    enabled: isAuthenticated && !!user?.tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const getPlanFeatures = (): PlanFeatures => {
    if (isMasterUser) {
      return MASTER_FULL_ACCESS;
    }

    if (!planInfo) {
      return {
        canCreateContract: false,
        canCreateLicense: false,
        hasAdvancedReports: false,
        hasVariableConsideration: false,
        hasContractModifications: false,
        hasAuditTrail: false,
        hasCustomIntegrations: false,
        hasDedicatedSupport: false,
        contractsRemaining: 0,
        licensesRemaining: 0,
        isUnlimited: false,
      };
    }

    const isUnlimited = planInfo.maxContracts === -1;
    // Use -1 for unlimited instead of Infinity to avoid issues
    const contractsRemaining = isUnlimited ? -1 : Math.max(0, planInfo.maxContracts - planInfo.currentContracts);
    const licensesRemaining = isUnlimited ? -1 : Math.max(0, planInfo.maxLicenses - planInfo.currentLicenses);

    const features = planFeatureMatrix[planInfo.planType] || planFeatureMatrix.starter;

    return {
      canCreateContract: isUnlimited || contractsRemaining > 0,
      canCreateLicense: isUnlimited || licensesRemaining > 0,
      contractsRemaining: isUnlimited ? -1 : contractsRemaining,
      licensesRemaining: isUnlimited ? -1 : licensesRemaining,
      isUnlimited,
      ...features,
    };
  };

  const getUpgradeMessage = (feature: keyof typeof planFeatureMatrix["enterprise"]): string => {
    if (!planInfo) return "";
    
    const messages: Record<string, string> = {
      hasAdvancedReports: "Faça upgrade para o plano Professional para acessar relatórios avançados.",
      hasVariableConsideration: "Faça upgrade para o plano Professional para rastrear considerações variáveis.",
      hasContractModifications: "Faça upgrade para o plano Professional para gerenciar modificações de contratos.",
      hasAuditTrail: "Faça upgrade para o plano Enterprise para acessar a trilha de auditoria completa.",
      hasCustomIntegrations: "Faça upgrade para o plano Enterprise para integrações personalizadas.",
      hasDedicatedSupport: "Faça upgrade para o plano Enterprise para suporte dedicado.",
    };

    return messages[feature] || "Faça upgrade do seu plano para acessar esta funcionalidade.";
  };

  const getPlanName = (plan: string): string => {
    const names: Record<string, string> = {
      starter: "Starter",
      professional: "Professional",
      enterprise: "Enterprise",
    };
    return names[plan] || plan;
  };

  const getNextPlan = (): "professional" | "enterprise" | null => {
    if (!planInfo) return null;
    if (planInfo.planType === "starter") return "professional";
    if (planInfo.planType === "professional") return "enterprise";
    return null;
  };

  return {
    planInfo,
    isLoading,
    features: getPlanFeatures(),
    getUpgradeMessage,
    getPlanName,
    getNextPlan,
  };
}
