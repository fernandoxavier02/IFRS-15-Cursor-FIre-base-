import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lightning, Lock, ArrowRight, Sparkle } from "@phosphor-icons/react";

interface UpgradePromptProps {
  title?: string;
  description?: string;
  featureName?: string;
  currentPlan?: string;
  targetPlan?: string;
  variant?: "card" | "inline" | "dialog";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const planPricing: Record<string, number> = {
  starter: 299,
  professional: 699,
  enterprise: 999,
};

export function UpgradePrompt({
  title = "Upgrade Required",
  description = "This feature requires a higher plan.",
  featureName,
  currentPlan = "starter",
  targetPlan = "professional",
  variant = "card",
  open,
  onOpenChange,
}: UpgradePromptProps) {
  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    setLocation("/subscribe");
  };

  if (variant === "dialog") {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 mx-auto mb-4">
              <Lock weight="fill" className="h-6 w-6 text-white" />
            </div>
            <AlertDialogTitle className="text-center">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {featureName && (
                <span className="block mb-2">
                  <Badge variant="secondary" className="font-normal">
                    {featureName}
                  </Badge>
                </span>
              )}
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Seu plano</p>
                <p className="font-semibold capitalize">{currentPlan}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Recomendado</p>
                <p className="font-semibold text-emerald-500 capitalize">{targetPlan}</p>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              A partir de R$ {planPricing[targetPlan] || 699}/mês
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpgrade}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600"
            >
              <Sparkle weight="fill" className="h-4 w-4 mr-2" />
              Fazer Upgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex-shrink-0">
          <Lock weight="fill" className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
        <Button size="sm" onClick={handleUpgrade}>
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <Card className="card-premium border-0 overflow-visible">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20 mx-auto mb-4">
          <Lightning weight="fill" className="h-7 w-7 text-white" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {featureName && (
          <Badge variant="outline" className="mb-4">
            {featureName}
          </Badge>
        )}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Atual</p>
            <p className="text-sm font-medium capitalize">{currentPlan}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Recomendado</p>
            <p className="text-sm font-medium text-emerald-500 capitalize">{targetPlan}</p>
          </div>
        </div>
        <Button
          onClick={handleUpgrade}
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20"
        >
          <Sparkle weight="fill" className="h-4 w-4 mr-2" />
          Fazer Upgrade para {targetPlan}
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          A partir de R$ {planPricing[targetPlan] || 699}/mês
        </p>
      </CardContent>
    </Card>
  );
}

interface FeatureGateProps {
  feature: string;
  isAvailable: boolean;
  currentPlan?: string;
  targetPlan?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({
  feature,
  isAvailable,
  currentPlan = "starter",
  targetPlan = "professional",
  children,
  fallback,
}: FeatureGateProps) {
  if (isAvailable) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <UpgradePrompt
      title="Funcionalidade Premium"
      description={`Esta funcionalidade requer o plano ${targetPlan}.`}
      featureName={feature}
      currentPlan={currentPlan}
      targetPlan={targetPlan}
    />
  );
}
