import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import {
  Check,
  Rocket,
  Lightning,
  Buildings,
  Star,
  SpinnerGap,
  ArrowRight,
  CurrencyDollar,
} from "@phosphor-icons/react";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 299,
    currency: "BRL",
    interval: "mês",
    description: "Para pequenas empresas iniciando com IFRS 15",
    features: [
      "Até 10 contratos",
      "1 licença de usuário",
      "Relatórios básicos IFRS 15",
      "Suporte por email",
      "Reconhecimento de receita básico",
    ],
    popular: false,
    icon: Rocket,
    gradient: "from-slate-500 to-slate-600",
  },
  {
    id: "professional",
    name: "Professional",
    price: 699,
    currency: "BRL",
    interval: "mês",
    description: "Para empresas em crescimento com necessidades complexas",
    features: [
      "Até 30 contratos",
      "3 licenças de usuário",
      "Relatórios avançados IFRS 15",
      "Rastreamento de considerações variáveis",
      "Modificações de contratos",
      "Suporte prioritário",
      "Motor IFRS 15 completo",
    ],
    popular: true,
    icon: Lightning,
    gradient: "from-emerald-500 to-emerald-600",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 999,
    currency: "BRL",
    interval: "mês",
    description: "Para grandes organizações com necessidades completas de compliance",
    features: [
      "Contratos ilimitados",
      "Licenças de usuário ilimitadas",
      "Motor IFRS 15 completo",
      "Trilha de auditoria & compliance",
      "Integrações personalizadas",
      "Gerente de conta dedicado",
      "Garantia de SLA",
      "Treinamento personalizado",
    ],
    popular: false,
    icon: Buildings,
    gradient: "from-purple-500 to-purple-600",
  },
];

export default function Subscribe() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: async (data: { email: string; planId: string }) => {
      const response = await apiRequest("POST", "/api/subscribe/checkout", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (planId: string) => {
    if (!email) {
      toast({
        title: t("common.error"),
        description: "Por favor, insira seu endereço de email",
        variant: "destructive",
      });
      return;
    }
    setSelectedPlan(planId);
    checkoutMutation.mutate({ email, planId });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <CurrencyDollar weight="fill" className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">IFRS 15</span>
          </div>
          <Button
            variant="ghost"
            onClick={() => setLocation("/login")}
            data-testid="link-login"
          >
            Já tenho conta
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">Escolha seu plano</Badge>
          <h1 className="text-4xl font-bold mb-4">IFRS 15 Revenue Manager</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Plataforma completa de compliance para reconhecimento de receita. Automatize os requisitos do IFRS 15 e simplifique seus processos contábeis.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-12">
          <Card className="card-premium border-0">
            <CardContent className="p-6">
              <Label htmlFor="email" className="text-base font-medium">
                Seu Email Corporativo
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 h-11"
                data-testid="input-email"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Suas credenciais de login serão enviadas para este email após a assinatura.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.id}
                className={`relative card-premium border-0 ${
                  plan.popular ? "ring-2 ring-emerald-500 shadow-xl shadow-emerald-500/10" : ""
                }`}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 px-4 py-1">
                      <Star weight="fill" className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4 pt-8">
                  <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${plan.gradient} shadow-lg mx-auto mb-4`}>
                    <Icon weight="fill" className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-5xl font-bold tabular-nums">{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  </div>
                  <ul className="space-y-3 text-left">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 flex-shrink-0 mt-0.5">
                          <Check weight="bold" className="h-3 w-3 text-emerald-500" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-4">
                  <Button
                    className={`w-full h-12 font-semibold ${
                      plan.popular
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20"
                        : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={checkoutMutation.isPending && selectedPlan === plan.id}
                    data-testid={`button-subscribe-${plan.id}`}
                  >
                    {checkoutMutation.isPending && selectedPlan === plan.id ? (
                      <>
                        <SpinnerGap weight="bold" className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        Assinar Agora
                        <ArrowRight weight="bold" className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todos os planos incluem 7 dias de garantia de devolução do dinheiro.
          </p>
        </div>
      </div>
    </div>
  );
}
