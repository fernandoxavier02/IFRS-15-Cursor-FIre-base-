import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { functions } from "@/lib/firebase";
import { tenantService } from "@/lib/firestore-service";
import { queryClient } from "@/lib/queryClient";
import {
    ArrowRight,
    Calculator,
    ChartLineUp,
    CheckCircle,
    Clock,
    FileText,
    Globe,
    Lightning,
    Lock,
    Rocket,
    ShieldCheck,
    Sparkle,
    Target,
    TrendUp,
    Users
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const features = [
  {
    icon: Calculator,
    title: "Motor IFRS 15 Automatizado",
    description: "Cálculos precisos de reconhecimento de receita em tempo real",
    color: "emerald",
  },
  {
    icon: FileText,
    title: "Gestão Completa de Contratos",
    description: "Versionamento, modificações e rastreamento automático",
    color: "blue",
  },
  {
    icon: ChartLineUp,
    title: "Relatórios e Dashboards",
    description: "Análises detalhadas e visualizações em tempo real",
    color: "purple",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Garantido",
    description: "Trilha de auditoria completa e conformidade total",
    color: "amber",
  },
  {
    icon: Users,
    title: "Colaboração em Equipe",
    description: "Controle de acesso e permissões granulares",
    color: "rose",
  },
  {
    icon: Globe,
    title: "Multi-moeda",
    description: "Suporte para múltiplas moedas e consolidação",
    color: "cyan",
  },
];

const benefits = [
  {
    icon: TrendUp,
    title: "Economize Tempo",
    description: "Reduza em até 80% o tempo gasto com cálculos manuais de IFRS 15",
    stat: "80%",
  },
  {
    icon: Target,
    title: "Elimine Erros",
    description: "Automatize processos e elimine erros humanos na contabilização",
    stat: "99.9%",
  },
  {
    icon: Lightning,
    title: "Aumente Produtividade",
    description: "Foque no que realmente importa enquanto o sistema trabalha para você",
    stat: "5x",
  },
];

export default function CustomerArea() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Fetch tenant data
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      return tenantService.get(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Check subscription status
  const subscriptionStatus = (tenant as any)?.subscriptionStatus;
  // If undefined/null, check if tenant status is "active"
  const tenantStatus = (tenant as any)?.status;
  const isActive = subscriptionStatus === "active" || (subscriptionStatus === undefined && tenantStatus === "active");

  // Create checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const createCheckout = httpsCallable(functions, "createCheckoutSession");
      const result = await createCheckout({
        planId: planId, // Plan ID - will be converted to priceId internally
        email: user?.email || "",
        successUrl: `${window.location.origin}/customer-area?success=true`,
        cancelUrl: `${window.location.origin}/customer-area?canceled=true`,
      });
      return result.data as { sessionId: string; url: string };
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a sessão de pagamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleUpgrade = (planId: string) => {
    setSelectedPlan(planId);
    checkoutMutation.mutate(planId);
  };

  // Check if payment was successful
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("success") === "true") {
      toast({
        title: "Pagamento processado!",
        description: "Seu acesso será liberado em instantes. Aguarde a confirmação.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["tenant", user?.tenantId] });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get("canceled") === "true") {
      toast({
        title: "Pagamento cancelado",
        description: "Você pode tentar novamente quando estiver pronto.",
        variant: "default",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <ChartLineUp weight="fill" className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              Área do Cliente
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isActive ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <CheckCircle weight="fill" className="h-3 w-3 mr-1" />
                Conta Ativa
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                <Clock weight="fill" className="h-3 w-3 mr-1" />
                Aguardando Ativação
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 border-b bg-gradient-to-br from-emerald-500/5 via-transparent to-purple-500/5">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-6 px-4 py-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <Rocket weight="fill" className="h-3 w-3 mr-2" />
                Bem-vindo, {user?.fullName}!
              </Badge>
              
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                {isActive ? "Sua Conta Está Ativa!" : "Sua Empresa está Registrada"}
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                {isActive 
                  ? "Acesse todas as funcionalidades do IFRS 15 Revenue Manager e gerencie sua receita com confiança."
                  : "Estamos quase lá! Complete o pagamento da assinatura para desbloquear o acesso completo ao IFRS 15 Revenue Manager."
                }
              </p>

              {isActive ? (
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={() => setLocation("/")}
                    className="h-14 px-8 text-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 font-semibold"
                  >
                    <ChartLineUp weight="fill" className="mr-2 h-5 w-5" />
                    Acesse o Sistema
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <Card className="border-amber-500/20 bg-amber-500/5 max-w-2xl mx-auto">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Lock weight="fill" className="h-6 w-6 text-amber-500 flex-shrink-0 mt-1" />
                      <div className="text-left">
                        <h3 className="font-semibold mb-2">Acesso Limitado</h3>
                        <p className="text-sm text-muted-foreground">
                          Atualmente, você pode visualizar as funcionalidades disponíveis, mas o acesso completo ao aplicativo será liberado após a confirmação do pagamento.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* User & Company Information Card */}
            <Card className="mb-8 border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users weight="fill" className="h-5 w-5 text-emerald-500" />
                    Informações da Conta
                  </CardTitle>
                  {isActive && (user?.role === "admin" || user?.email === "fernandocostaxavier@gmail.com") && (
                    <Button
                      variant="outline"
                      onClick={() => setLocation("/customer-area/users")}
                      className="gap-2"
                    >
                      <Users weight="fill" className="h-4 w-4" />
                      Gerenciar Usuários
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* User Information */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados Pessoais</Label>
                      <div className="mt-2 space-y-3">
                        <div>
                          <p className="text-sm font-medium">Nome Completo</p>
                          <p className="text-base">{user?.fullName || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-base">{user?.email || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Função</p>
                          <Badge variant="outline" className="mt-1">
                            {user?.role === "admin" ? "Administrador" : user?.role || "Usuário"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Company Information */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</Label>
                      <div className="mt-2 space-y-3">
                        <div>
                          <p className="text-sm font-medium">Nome da Empresa</p>
                          <p className="text-base">{(tenant as any)?.name || "N/A"}</p>
                        </div>
                        {(tenant as any)?.taxId && (
                          <div>
                            <p className="text-sm font-medium">CNPJ/Tax ID</p>
                            <p className="text-base">{(tenant as any)?.taxId}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">Plano</p>
                          <Badge variant="outline" className="mt-1">
                            {((tenant as any)?.planType || "starter").charAt(0).toUpperCase() + ((tenant as any)?.planType || "starter").slice(1)}
                          </Badge>
                        </div>
                        {(tenant as any)?.address && (
                          <div>
                            <p className="text-sm font-medium">Endereço</p>
                            <p className="text-sm">{(tenant as any)?.address}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Veja o que você vai ganhar
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Resultados comprovados de empresas que já usam nossa plataforma
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto mb-16">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card key={index} className="border-0 card-premium">
                  <CardContent className="p-6 text-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 mx-auto mb-4">
                      <Icon weight="fill" className="h-8 w-8 text-white" />
                    </div>
                    <div className="text-4xl font-bold text-emerald-600 mb-2">{benefit.stat}</div>
                    <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Funcionalidades</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que Você Terá Acesso
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore as poderosas ferramentas que estão esperando por você
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const colorClasses: Record<string, string> = {
                emerald: "from-emerald-500 to-emerald-600",
                blue: "from-blue-500 to-blue-600",
                purple: "from-purple-500 to-purple-600",
                amber: "from-amber-500 to-amber-600",
                rose: "from-rose-500 to-rose-600",
                cyan: "from-cyan-500 to-cyan-600",
              };
              return (
                <Card key={index} className="border-0 card-premium group hover:shadow-xl transition-all">
                  <CardContent className="p-6">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[feature.color]} shadow-lg mb-4 transition-transform duration-300 group-hover:scale-110`}>
                      <Icon weight="fill" className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section - Payment (only show if not active) */}
      {!isActive && (
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 card-premium overflow-hidden">
              <div className="relative p-12">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10" />
                <div className="relative text-center">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 mx-auto mb-6 shadow-lg">
                    <Sparkle weight="fill" className="h-10 w-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Desbloqueie Seu Acesso Agora
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                    Complete o pagamento e tenha acesso imediato a todas as funcionalidades do IFRS 15 Revenue Manager.
                  </p>

                  <div className="grid gap-4 md:grid-cols-3 max-w-3xl mx-auto mb-8">
                    {[
                      { id: "starter", name: "Starter", price: "R$ 299", period: "mês" },
                      { id: "professional", name: "Professional", price: "R$ 699", period: "mês", popular: true },
                      { id: "enterprise", name: "Enterprise", price: "R$ 999", period: "mês" },
                    ].map((plan) => (
                      <Card
                        key={plan.id}
                        className={`relative ${plan.popular ? "ring-2 ring-emerald-500 shadow-xl" : ""}`}
                      >
                        <CardHeader className="text-center">
                          {plan.popular && (
                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500">
                              Popular
                            </Badge>
                          )}
                          <CardTitle>{plan.name}</CardTitle>
                          <div className="mt-4">
                            <span className="text-3xl font-bold">{plan.price}</span>
                            <span className="text-muted-foreground">/{plan.period}</span>
                          </div>
                        </CardHeader>
                        <CardFooter>
                          <Button
                            className="w-full"
                            variant={plan.popular ? "default" : "outline"}
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={checkoutMutation.isPending && selectedPlan === plan.id}
                          >
                            {checkoutMutation.isPending && selectedPlan === plan.id ? (
                              "Processando..."
                            ) : (
                              <>
                                Escolher Plano
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle weight="fill" className="h-4 w-4 text-emerald-500" />
                    <span>Pagamento seguro via Stripe</span>
                    <span>•</span>
                    <span>Cancele quando quiser</span>
                    <span>•</span>
                    <span>Acesso imediato após pagamento</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
      )}

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-muted-foreground">
            © 2024 IFRS 15 Revenue Manager. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
