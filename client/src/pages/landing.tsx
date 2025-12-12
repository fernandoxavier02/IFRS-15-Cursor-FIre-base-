import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CurrencyDollar,
  Check,
  ShieldCheck,
  ChartLineUp,
  ClockCounterClockwise,
  Users,
  FileText,
  Calculator,
  Lightning,
  Rocket,
  Buildings,
  ArrowRight,
  Star,
  SpinnerGap,
  Play,
  Globe,
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
    limits: {
      contracts: 10,
      licenses: 1,
    },
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
    limits: {
      contracts: 30,
      licenses: 3,
    },
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
    limits: {
      contracts: -1,
      licenses: -1,
    },
    popular: false,
    icon: Buildings,
    gradient: "from-purple-500 to-purple-600",
  },
];

const features = [
  {
    icon: Calculator,
    title: "Motor IFRS 15 Completo",
    description: "Implementação completa do modelo de 5 etapas do IFRS 15 com cálculos automatizados de reconhecimento de receita",
    gradient: "from-emerald-500 to-emerald-600",
  },
  {
    icon: FileText,
    title: "Gestão de Contratos",
    description: "Gerencie todo o ciclo de vida dos contratos com versionamento, modificações e rastreamento de obrigações de desempenho",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    icon: ChartLineUp,
    title: "Relatórios em Tempo Real",
    description: "Dashboards e relatórios detalhados incluindo receita desagregada, saldos contratuais e obrigações restantes",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Garantido",
    description: "Trilha de auditoria completa para cada alteração, garantindo conformidade total com os padrões contábeis",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Users,
    title: "Controle de Acesso",
    description: "Controle de acesso baseado em funções para equipes de finanças, auditores e operações",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: Globe,
    title: "Multi-moeda",
    description: "Suporte completo para múltiplas moedas com conversão automática e relatórios consolidados",
    gradient: "from-cyan-500 to-teal-500",
  },
];

export default function Landing() {
  const { toast } = useToast();
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
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (planId: string) => {
    if (!email) {
      toast({
        title: "Email necessário",
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
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <CurrencyDollar weight="fill" className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">IFRS 15</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/login")}
              data-testid="link-login"
            >
              Entrar
            </Button>
            <Button
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
              data-testid="button-get-started-header"
            >
              Começar Agora
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-purple-500/5" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 py-24 relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              <Star weight="fill" className="h-3 w-3 mr-2" />
              Solução Completa IFRS 15
            </Badge>
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              Reconhecimento de Receita
              <span className="block gradient-text">Simplificado</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Plataforma completa de compliance IFRS 15 para gestão de contratos e reconhecimento de receita. Automatize processos contábeis e mantenha conformidade total.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button
                size="lg"
                onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
                className="h-14 px-8 text-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20"
                data-testid="button-get-started-hero"
              >
                Começar Gratuitamente
                <ArrowRight weight="bold" className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg"
                onClick={() => setLocation("/login")}
                data-testid="button-demo"
              >
                <Play weight="fill" className="mr-2 h-5 w-5" />
                Ver Demo
              </Button>
            </div>

            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check weight="bold" className="h-4 w-4 text-emerald-500" />
                <span>Setup em 5 minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <Check weight="bold" className="h-4 w-4 text-emerald-500" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <Check weight="bold" className="h-4 w-4 text-emerald-500" />
                <span>Suporte incluído</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Funcionalidades</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que você precisa para
              <span className="gradient-text"> compliance IFRS 15</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma completa para gestão de contratos e reconhecimento de receita seguindo os padrões internacionais de contabilidade.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="card-premium border-0 group">
                  <CardContent className="p-6">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg mb-4 transition-transform duration-300 group-hover:scale-105`}>
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

      <section id="pricing" className="py-24 scroll-mt-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Preços</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Planos para cada
              <span className="gradient-text"> tamanho de empresa</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para sua empresa. Todos os planos incluem atualizações gratuitas e suporte técnico.
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
                  data-testid="input-email-landing"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Suas credenciais de acesso serão enviadas para este email após a assinatura.
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
      </section>

      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Card className="card-premium border-0 overflow-hidden">
              <div className="relative p-12 text-center">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10" />
                <div className="relative">
                  <h2 className="text-3xl font-bold mb-4">
                    Pronto para simplificar seu compliance IFRS 15?
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                    Junte-se a centenas de empresas que já automatizaram seu reconhecimento de receita.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button
                      size="lg"
                      onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
                      className="h-12 px-8 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20"
                      data-testid="button-get-started-cta"
                    >
                      Começar Agora
                      <ArrowRight weight="bold" className="ml-2 h-5 w-5" />
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setLocation("/login")}
                    >
                      Falar com Vendas
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
                <CurrencyDollar weight="fill" className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold">IFRS 15 Revenue Manager</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 IFRS 15 Revenue Manager. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
