import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
    Gauge,
    Globe,
    Lightning,
    Quotes,
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
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
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

// Stats Component
const stats = [
  { value: "99.9%", label: "Uptime garantido", icon: Gauge },
  { value: "500+", label: "Empresas ativas", icon: Buildings },
  { value: "R$2B+", label: "Receita gerenciada", icon: CurrencyDollar },
  { value: "< 5min", label: "Tempo de setup", icon: ClockCounterClockwise },
];

function StatsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-16 bg-gradient-to-br from-emerald-500/5 to-purple-500/5">
      <div className="container mx-auto px-6">
        <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                className="text-center"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 mx-auto mb-4 shadow-lg">
                  <Icon weight="fill" className="h-8 w-8 text-white" />
                </div>
                <motion.div
                  className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent mb-2"
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                >
                  {stat.value}
                </motion.div>
                <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Testimonials Component
const testimonials = [
  {
    quote: "O sistema revolucionou nossa forma de reconhecer receita. Reduzimos o tempo de fechamento contábil em 70%.",
    author: "Maria Silva",
    role: "CFO",
    company: "TechCorp Brasil",
    avatar: "MS",
    rating: 5,
  },
  {
    quote: "Finalmente uma solução que entende as complexidades do IFRS 15. A trilha de auditoria é impecável.",
    author: "João Santos",
    role: "Controller",
    company: "Indústrias ABC",
    avatar: "JS",
    rating: 5,
  },
  {
    quote: "A automação dos 5 passos do IFRS 15 nos deu confiança total na conformidade contábil. Recomendo!",
    author: "Ana Oliveira",
    role: "Diretora Financeira",
    company: "Global Services",
    avatar: "AO",
    rating: 5,
  },
];

function TestimonialsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          ref={ref}
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <Badge variant="outline" className="mb-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <Quotes weight="fill" className="h-3 w-3 mr-2" />
            Depoimentos
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            O que Nossos Clientes Dizem
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Empresas de todos os tamanhos confiam no IFRS 15 Revenue Manager para automatizar seu compliance contábil.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              <Card className="card-premium border-0 h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} weight="fill" className="h-4 w-4 text-amber-500" />
                    ))}
                  </div>
                  <Quotes weight="fill" className="h-8 w-8 text-emerald-500/20 mb-4" />
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed italic">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{testimonial.author}</p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.role} • {testimonial.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// FAQ Component
const faqs = [
  {
    question: "Como funciona o registro no sistema?",
    answer: "O registro é simples e rápido. Você preenche os dados da sua empresa e recebe um email com suas credenciais de acesso. Após fazer login, você terá acesso à sua área do cliente onde pode visualizar todas as funcionalidades e, quando estiver pronto, escolher e pagar pelo plano desejado.",
  },
  {
    question: "Posso testar antes de pagar?",
    answer: "Sim! Após o registro, você terá acesso à área do cliente onde pode visualizar todas as funcionalidades disponíveis. O pagamento é opcional e pode ser feito quando você estiver pronto para começar a usar o sistema completo.",
  },
  {
    question: "Quanto tempo leva para configurar?",
    answer: "A configuração inicial leva menos de 5 minutos. Nosso sistema foi projetado para ser intuitivo e fácil de usar, permitindo que você comece a trabalhar imediatamente após o registro e pagamento.",
  },
  {
    question: "Posso cancelar minha assinatura?",
    answer: "Sim, você pode cancelar sua assinatura a qualquer momento através da sua área do cliente. Não há taxas de cancelamento e você continuará tendo acesso até o fim do período já pago.",
  },
  {
    question: "O sistema suporta múltiplos usuários?",
    answer: "Sim, dependendo do plano escolhido. O plano Professional permite até 3 usuários, enquanto o Enterprise permite usuários ilimitados. Todos os usuários da mesma empresa compartilham os dados e colaboram em projetos.",
  },
  {
    question: "Há suporte técnico disponível?",
    answer: "Sim! Oferecemos suporte por email para todos os planos e suporte prioritário para planos Professional e Enterprise. Nossa equipe está pronta para ajudar você a tirar o máximo proveito do sistema.",
  },
];

function FAQSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <motion.div
          ref={ref}
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <Badge variant="outline" className="mb-4 bg-blue-500/10 text-blue-600 border-blue-500/20">
            <FileText weight="fill" className="h-3 w-3 mr-2" />
            Perguntas Frequentes
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Dúvidas? Temos Respostas
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Encontre respostas para as perguntas mais comuns sobre o IFRS 15 Revenue Manager.
          </p>
        </motion.div>

        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg px-6 bg-background">
                <AccordionTrigger className="text-left hover:no-underline font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}

export default function LandingNew() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
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
    mutationFn: async (data: RegistrationFormData) => {
      const registerCompany = httpsCallable(functions, "registerCompany");
      const result = await registerCompany({
        companyName: data.companyName,
        email: data.email,
        fullName: data.fullName,
        taxId: data.taxId,
        address: data.address,
        country: data.country,
        phone: data.phone,
        // No planId - user will choose plan in customer area
      });
      return result.data as any;
    },
    onSuccess: (data) => {
      toast({
        title: "Registro realizado com sucesso!",
        description: "Verifique seu email para receber suas credenciais de acesso. Você será redirecionado para fazer login.",
        variant: "default",
      });
      
      // Always redirect to login - user can choose plan later in customer area
      setTimeout(() => {
        setLocation("/login");
      }, 2500);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no registro",
        description: error.message || "Não foi possível completar o registro. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleRegister = () => {
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

    // Register without plan - user will choose plan later in customer area
    registerMutation.mutate({ ...registrationData });
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
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/login")}
              className="font-semibold"
            >
              Entrar
            </Button>
            <Button
              onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 font-semibold shadow-lg shadow-emerald-500/20"
            >
              Registre-se
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10" />
        <motion.div 
          className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div 
          className="absolute bottom-20 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
        
        <div className="container mx-auto px-6 py-24 relative">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-6 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                <Star weight="fill" className="h-3 w-3 mr-2" />
                Solução Completa para Compliance IFRS 15
              </Badge>
            </motion.div>
            
            <motion.h1 
              className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Resolva os Desafios do
              <span className="block bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 bg-clip-text text-transparent">
                IFRS 15 em Minutos
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Automatize o reconhecimento de receita, simplifique a gestão de contratos e garanta compliance total com o padrão internacional mais rigoroso de contabilidade.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Button
                size="lg"
                onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })}
                className="h-14 px-8 text-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 font-semibold transition-all hover:scale-105"
              >
                Registre-se Agora
                <ArrowRight weight="bold" className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg font-semibold border-2 transition-all hover:scale-105"
                onClick={() => setLocation("/login")}
              >
                Já tem conta? Entrar
              </Button>
            </motion.div>

            <motion.div 
              className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <StatsSection />

      {/* Problems Section */}
      <section id="problems" className="py-24 bg-muted/50 scroll-mt-16">
        <div className="container mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
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
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            {problems.map((problem, index) => {
              const Icon = problem.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="card-premium border-0 group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <CardContent className="p-6">
                      <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${problem.gradient} shadow-lg mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                        <Icon weight="fill" className="h-7 w-7 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{problem.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{problem.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-24 scroll-mt-16">
        <div className="container mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
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
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            {solutions.map((solution, index) => {
              const Icon = solution.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="card-premium border-0 group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <CardContent className="p-6">
                      <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${solution.gradient} shadow-lg mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                        <Icon weight="fill" className="h-7 w-7 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{solution.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{solution.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section id="register" className="py-24 bg-gradient-to-b from-muted/50 to-background scroll-mt-16">
        <div className="container mx-auto px-6">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="outline" className="mb-4">Primeiro Passo</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Registre Sua Empresa
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Preencha as informações abaixo para criar sua conta. Você precisará estar registrado antes de assinar um plano.
            </p>
          </motion.div>

          <motion.div 
            className="max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
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
                  As credenciais de acesso serão enviadas para o email informado.
                </p>
                <Button
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 font-semibold"
                  onClick={handleRegister}
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <>
                      <SpinnerGap weight="bold" className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      Criar Minha Conta
                      <ArrowRight weight="bold" className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 scroll-mt-16">
        <div className="container mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="outline" className="mb-4">Planos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha o Plano Ideal
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
              Selecione o plano que melhor atende às necessidades da sua empresa.
            </p>
            <div className="max-w-md mx-auto">
              <Card className="card-premium border-blue-500/20 bg-blue-500/5">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center text-center">
                    <CheckCircle weight="fill" className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span>Após o registro, você terá acesso à sua área do cliente, onde poderá escolher e pagar pelo plano desejado.</span>
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
              {plans.map((plan, index) => {
                const Icon = plan.icon;
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                  >
                  <Card
                    className={`relative card-premium border-0 transition-all duration-300 hover:scale-105 ${
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
                      <p className="text-sm text-center text-muted-foreground w-full">
                        Você poderá escolher este plano após o registro, na sua área do cliente.
                      </p>
                    </CardFooter>
                  </Card>
                  </motion.div>
                );
              })}
            </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* FAQ Section */}
      <FAQSection />

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10">
        <div className="container mx-auto px-6">
          <motion.div 
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
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
                    className="h-12 px-8 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                  >
                    Começar Agora
                    <ArrowRight weight="bold" className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
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
