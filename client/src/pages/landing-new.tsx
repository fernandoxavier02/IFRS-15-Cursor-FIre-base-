import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { functions } from "@/lib/firebase";
import {
    ArrowRight,
    Buildings,
    Calculator,
    ChartLineUp,
    Check,
    CheckCircle,
    ClockCounterClockwise,
    CurrencyDollar,
    FileText,
    FileX,
    Globe,
    Lightning,
    Play,
    Rocket,
    ShieldCheck,
    SpinnerGap,
    Star,
    Target,
    Users,
    Warning
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { useState } from "react";
import { useLocation } from "wouter";

// IFRS 15 Challenges/Problems section
const problems = [
  {
    icon: FileX,
    title: "Identificação de Obrigações de Desempenho",
    description: "Dificuldade em identificar e separar obrigações distintas em contratos complexos com produtos e serviços combinados.",
    gradient: "from-red-500 to-orange-500",
  },
  {
    icon: Calculator,
    title: "Estimativa de Considerações Variáveis",
    description: "Desafio em estimar descontos, reembolsos e bônus de performance, exigindo julgamento complexo e cuidadoso.",
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    icon: Target,
    title: "Alocação do Preço da Transação",
    description: "Dificuldade em alocar preços para cada obrigação quando valores standalone não são observáveis diretamente.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: ClockCounterClockwise,
    title: "Momento do Reconhecimento",
    description: "Determinar se receita deve ser reconhecida ao longo do tempo ou em ponto específico é complexo, especialmente em construção e serviços.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: FileText,
    title: "Modificações de Contratos",
    description: "Contabilizar mudanças em contratos existentes requer avaliação cuidadosa para determinar se criam novas obrigações.",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    icon: Warning,
    title: "Mudanças de Sistema",
    description: "Adaptar sistemas legados para capturar informações detalhadas exigidas pelo IFRS 15 é caro e demorado.",
    gradient: "from-rose-500 to-red-500",
  },
];

const solutions = [
  {
    icon: Calculator,
    title: "Motor IFRS 15 Completo",
    description: "Implementação automática do modelo de 5 etapas com cálculos precisos de reconhecimento de receita",
    gradient: "from-emerald-500 to-emerald-600",
  },
  {
    icon: FileText,
    title: "Gestão Inteligente de Contratos",
    description: "Versionamento automático, rastreamento de modificações e identificação de obrigações de desempenho",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    icon: ChartLineUp,
    title: "Relatórios em Tempo Real",
    description: "Dashboards e relatórios detalhados com receita desagregada, saldos contratuais e obrigações restantes",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Garantido",
    description: "Trilha de auditoria completa para cada alteração, garantindo conformidade total com padrões contábeis",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Users,
    title: "Colaboração em Equipe",
    description: "Controle de acesso baseado em funções para equipes de finanças, auditores e operações",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: Globe,
    title: "Multi-moeda e Consolidado",
    description: "Suporte completo para múltiplas moedas com conversão automática e relatórios consolidados",
    gradient: "from-cyan-500 to-teal-500",
  },
];

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

interface RegistrationFormData {
  companyName: string;
  email: string;
  fullName: string;
  taxId: string;
  address: string;
  country: string;
  phone: string;
}

export default function LandingNew() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationFormData>({
    companyName: "",
    email: "",
    fullName: "",
    taxId: "",
    address: "",
    country: "Brasil",
    phone: "",
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationFormData & { planId: string }) => {
      const registerCompany = httpsCallable(functions, "registerCompany");
      const result = await registerCompany({
        companyName: data.companyName,
        email: data.email,
        fullName: data.fullName,
        taxId: data.taxId,
        address: data.address,
        country: data.country,
        phone: data.phone,
        planId: data.planId,
      });
      return result.data as any;
    },
    onSuccess: (data) => {
      toast({
        title: "Registro realizado com sucesso!",
        description: data.credentials 
          ? "Verifique seu email para receber suas credenciais de acesso. Você será redirecionado para o pagamento."
          : "Registro concluído. Você receberá um email com suas credenciais em instantes.",
        variant: "default",
      });
      
      // If checkout URL is available, redirect to payment
      if (data.checkoutUrl) {
        setTimeout(() => {
          window.location.href = data.checkoutUrl;
        }, 2000);
      } else {
        // Otherwise, redirect to login after showing credentials
        setTimeout(() => {
          setLocation("/login");
        }, 3000);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no registro",
        description: error.message || "Não foi possível completar o registro. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleRegister = (planId: string) => {
    // Validate required fields
    if (!registrationData.companyName || !registrationData.email || !registrationData.fullName) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios (Nome da Empresa, Email e Nome Completo).",
        variant: "destructive",
      });
      // Scroll to registration form
      document.getElementById("register")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registrationData.email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    setSelectedPlan(planId);
    registerMutation.mutate({ ...registrationData, planId });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <CurrencyDollar weight="fill" className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              IFRS 15 Revenue Manager
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/login")}>
              Entrar
            </Button>
            <Button
              onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
            >
              Começar Agora
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        
        <div className="container mx-auto px-6 py-24 relative">
          <div className="max-w-5xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              <Star weight="fill" className="h-3 w-3 mr-2" />
              Solução Completa para Compliance IFRS 15
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
              Resolva os Desafios do
              <span className="block bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 bg-clip-text text-transparent">
                IFRS 15 em Minutos
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              Automatize o reconhecimento de receita, simplifique a gestão de contratos e garanta compliance total com o padrão internacional mais rigoroso de contabilidade.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button
                size="lg"
                onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })}
                className="h-14 px-8 text-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20"
              >
                Começar Gratuitamente
                <ArrowRight weight="bold" className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg"
                onClick={() => document.getElementById("problems")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Play weight="fill" className="mr-2 h-5 w-5" />
                Ver Como Resolvemos
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle weight="fill" className="h-5 w-5 text-emerald-500" />
                <span className="font-medium">Setup em 5 minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle weight="fill" className="h-5 w-5 text-emerald-500" />
                <span className="font-medium">Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle weight="fill" className="h-5 w-5 text-emerald-500" />
                <span className="font-medium">Suporte especializado</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section id="problems" className="py-24 bg-muted/50 scroll-mt-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 bg-red-500/10 text-red-600 border-red-500/20">
              <Warning weight="fill" className="h-3 w-3 mr-2" />
              Desafios Comuns
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Você Enfrenta Estes Problemas?
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              A implementação do IFRS 15 apresenta desafios complexos que consomem tempo, recursos e aumentam o risco de não conformidade. Identifique-se com algum desses problemas?
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            {problems.map((problem, index) => {
              const Icon = problem.icon;
              return (
                <Card key={index} className="card-premium border-0 group hover:shadow-xl transition-all">
                  <CardContent className="p-6">
                    <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${problem.gradient} shadow-lg mb-4 transition-transform duration-300 group-hover:scale-110`}>
                      <Icon weight="fill" className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{problem.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{problem.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <CheckCircle weight="fill" className="h-3 w-3 mr-2" />
              Nossa Solução
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Como Resolvemos Seus Desafios
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Uma plataforma completa que automatiza todos os aspectos do IFRS 15, eliminando erros manuais e garantindo compliance total.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            {solutions.map((solution, index) => {
              const Icon = solution.icon;
              return (
                <Card key={index} className="card-premium border-0 group hover:shadow-xl transition-all">
                  <CardContent className="p-6">
                    <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${solution.gradient} shadow-lg mb-4 transition-transform duration-300 group-hover:scale-110`}>
                      <Icon weight="fill" className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{solution.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{solution.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section id="register" className="py-24 bg-gradient-to-b from-muted/50 to-background scroll-mt-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Primeiro Passo</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Registre Sua Empresa
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Preencha as informações abaixo para criar sua conta. Você precisará estar registrado antes de assinar um plano.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="card-premium border-0">
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <CardDescription>
                  Preencha todos os campos para criar sua conta corporativa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">
                      Nome da Empresa <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="companyName"
                      value={registrationData.companyName}
                      onChange={(e) => setRegistrationData({ ...registrationData, companyName: e.target.value })}
                      placeholder="Minha Empresa LTDA"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxId">
                      CNPJ / Tax ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="taxId"
                      value={registrationData.taxId}
                      onChange={(e) => setRegistrationData({ ...registrationData, taxId: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">
                    Endereço Completo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="address"
                    value={registrationData.address}
                    onChange={(e) => setRegistrationData({ ...registrationData, address: e.target.value })}
                    placeholder="Rua, Número, Bairro, Cidade - Estado"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="country">País</Label>
                    <Input
                      id="country"
                      value={registrationData.country}
                      onChange={(e) => setRegistrationData({ ...registrationData, country: e.target.value })}
                      placeholder="Brasil"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={registrationData.phone}
                      onChange={(e) => setRegistrationData({ ...registrationData, phone: e.target.value })}
                      placeholder="+55 (11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">Informações do Responsável</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">
                        Nome Completo <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="fullName"
                        value={registrationData.fullName}
                        onChange={(e) => setRegistrationData({ ...registrationData, fullName: e.target.value })}
                        placeholder="João Silva"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email Corporativo <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={registrationData.email}
                        onChange={(e) => setRegistrationData({ ...registrationData, email: e.target.value })}
                        placeholder="joao@empresa.com.br"
                        required
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <p className="text-xs text-muted-foreground text-center">
                  Ao registrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
                  As credenciais de acesso serão enviadas para o email informado após a confirmação do pagamento.
                </p>
                <Button
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                  onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
                  disabled={registerMutation.isPending}
                >
                  Continuar para Escolher Plano
                  <ArrowRight weight="bold" className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 scroll-mt-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Planos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha o Plano Ideal
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
              Selecione o plano que melhor atende às necessidades da sua empresa.
            </p>
            <div className="max-w-md mx-auto">
              <Card className="card-premium border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
                    <Warning weight="fill" className="h-4 w-4 text-amber-500" />
                    <span><strong>Obrigatório:</strong> Preencha o formulário de registro acima antes de escolher um plano.</span>
                  </p>
                </CardContent>
              </Card>
            </div>
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
                        onClick={() => handleRegister(plan.id)}
                        disabled={registerMutation.isPending && selectedPlan === plan.id}
                      >
                        {registerMutation.isPending && selectedPlan === plan.id ? (
                          <>
                            <SpinnerGap weight="bold" className="h-4 w-4 mr-2 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            Escolher Este Plano
                            <ArrowRight weight="bold" className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Card className="card-premium border-0 overflow-hidden">
              <div className="relative p-12 text-center">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10" />
                <div className="relative">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Pronto para simplificar seu compliance IFRS 15?
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                    Junte-se a centenas de empresas que já automatizaram seu reconhecimento de receita e eliminaram erros manuais.
                  </p>
                  <Button
                    size="lg"
                    onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })}
                    className="h-12 px-8 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20"
                  >
                    Começar Agora
                    <ArrowRight weight="bold" className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
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
