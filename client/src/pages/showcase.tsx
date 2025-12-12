import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CurrencyDollar,
  Check,
  ShieldCheck,
  ChartLineUp,
  Users,
  FileText,
  Calculator,
  Lightning,
  Rocket,
  Buildings,
  ArrowRight,
  Star,
  Play,
  Globe,
  Trophy,
  Sparkle,
  CheckCircle,
  ArrowDown,
  Quotes,
  TrendUp,
  Clock,
  Lock,
  Coins,
  PresentationChart,
  Gauge,
  Target,
  Crosshair,
} from "@phosphor-icons/react";

const stats = [
  { value: "99.9%", label: "Uptime garantido", icon: Gauge },
  { value: "500+", label: "Empresas ativas", icon: Buildings },
  { value: "R$2B+", label: "Receita gerenciada", icon: Coins },
  { value: "< 5min", label: "Tempo de setup", icon: Clock },
];

const testimonials = [
  {
    quote: "O sistema revolucionou nossa forma de reconhecer receita. Reduzimos o tempo de fechamento contábil em 70%.",
    author: "Maria Silva",
    role: "CFO",
    company: "TechCorp Brasil",
    avatar: "MS",
  },
  {
    quote: "Finalmente uma solução que entende as complexidades do IFRS 15. A trilha de auditoria é impecável.",
    author: "João Santos",
    role: "Controller",
    company: "Indústrias ABC",
    avatar: "JS",
  },
  {
    quote: "A automação dos 5 passos do IFRS 15 nos deu confiança total na conformidade contábil.",
    author: "Ana Oliveira",
    role: "Diretora Financeira",
    company: "Global Services",
    avatar: "AO",
  },
];

const ifrs15Steps = [
  {
    step: 1,
    title: "Identificar o Contrato",
    description: "Identificação automática de contratos elegíveis com validação de critérios IFRS 15",
    icon: FileText,
  },
  {
    step: 2,
    title: "Identificar Obrigações",
    description: "Mapeamento inteligente de obrigações de desempenho distintas em cada contrato",
    icon: Target,
  },
  {
    step: 3,
    title: "Determinar Preço",
    description: "Cálculo preciso do preço da transação incluindo considerações variáveis",
    icon: Coins,
  },
  {
    step: 4,
    title: "Alocar Preço",
    description: "Alocação proporcional baseada em preços de venda standalone",
    icon: Crosshair,
  },
  {
    step: 5,
    title: "Reconhecer Receita",
    description: "Reconhecimento automático ao longo do tempo ou em ponto específico",
    icon: TrendUp,
  },
];

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 299,
    description: "Para pequenas empresas",
    features: ["10 contratos", "1 usuário", "Relatórios básicos", "Suporte email"],
    icon: Rocket,
    gradient: "from-slate-500 to-slate-600",
  },
  {
    id: "professional",
    name: "Professional",
    price: 699,
    description: "Para empresas em crescimento",
    features: ["30 contratos", "3 usuários", "Motor IFRS 15 completo", "Suporte prioritário"],
    popular: true,
    icon: Lightning,
    gradient: "from-emerald-500 to-emerald-600",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 999,
    description: "Para grandes organizações",
    features: ["Ilimitado", "Ilimitado", "Trilha de auditoria", "Gerente dedicado"],
    icon: Buildings,
    gradient: "from-purple-500 to-purple-600",
  },
];

const benefits = [
  {
    icon: Clock,
    title: "70% Menos Tempo",
    description: "Reduza drasticamente o tempo de fechamento contábil",
    color: "emerald",
  },
  {
    icon: ShieldCheck,
    title: "100% Compliance",
    description: "Conformidade total com padrões IFRS 15",
    color: "blue",
  },
  {
    icon: Lock,
    title: "Auditoria Pronta",
    description: "Trilha completa para auditores externos",
    color: "purple",
  },
  {
    icon: TrendUp,
    title: "Visibilidade Total",
    description: "Dashboards em tempo real de toda receita",
    color: "amber",
  },
];

export default function Showcase() {
  const [, setLocation] = useLocation();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300" style={{
        backgroundColor: scrollY > 50 ? "hsl(var(--background) / 0.8)" : "transparent",
        backdropFilter: scrollY > 50 ? "blur(20px)" : "none",
        borderBottom: scrollY > 50 ? "1px solid hsl(var(--border) / 0.5)" : "none",
      }}>
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl shadow-emerald-500/30">
              <CurrencyDollar weight="fill" className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold">IFRS 15</span>
              <span className="text-xs text-muted-foreground block">Revenue Manager</span>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <Button variant="ghost" onClick={() => setLocation("/login")} data-testid="link-login">
              Entrar
            </Button>
            <Button
              onClick={() => setLocation("/subscribe")}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30"
              data-testid="button-subscribe-header"
            >
              <Sparkle weight="fill" className="mr-2 h-4 w-4" />
              Assinar Agora
            </Button>
          </motion.div>
        </div>
      </header>

      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10" />
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[120px]"
          />
          <motion.div 
            animate={{ 
              scale: [1.2, 1, 1.2],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px]"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{ duration: 12, repeat: Infinity }}
            className="absolute top-1/2 right-1/3 w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-[100px]"
          />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-5xl mx-auto text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge className="mb-8 px-6 py-2 text-sm bg-gradient-to-r from-emerald-500/20 to-purple-500/20 text-foreground border-emerald-500/30">
                <Trophy weight="fill" className="h-4 w-4 mr-2 text-amber-500" />
                Solução #1 em Compliance IFRS 15 no Brasil
              </Badge>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8"
            >
              Reconhecimento de
              <span className="block mt-2">
                <span className="bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                  Receita Inteligente
                </span>
              </span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              A plataforma mais completa do Brasil para automação do IFRS 15. 
              Transforme a complexidade contábil em simplicidade operacional.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16"
            >
              <Button
                size="lg"
                onClick={() => setLocation("/subscribe")}
                className="h-16 px-10 text-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-2xl shadow-emerald-500/40 transition-all duration-300 hover:scale-105"
                data-testid="button-get-started-hero"
              >
                Começar Gratuitamente
                <ArrowRight weight="bold" className="ml-3 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-16 px-10 text-lg border-2 transition-all duration-300 hover:scale-105"
                onClick={() => setLocation("/login")}
                data-testid="button-demo"
              >
                <Play weight="fill" className="mr-3 h-5 w-5" />
                Ver Demonstração
              </Button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex flex-wrap items-center justify-center gap-8 text-sm"
            >
              {["Setup em 5 minutos", "Sem cartão de crédito", "Suporte em português", "Dados no Brasil"].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle weight="fill" className="h-5 w-5 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ArrowDown className="h-6 w-6 text-muted-foreground" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="text-center"
                >
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-purple-500/10 mx-auto mb-4">
                    <Icon weight="duotone" className="h-8 w-8 text-emerald-500" />
                  </div>
                  <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-500 to-purple-500 bg-clip-text text-transparent mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="py-32 bg-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />
        <div className="container mx-auto px-6 relative">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <Badge variant="outline" className="mb-6 px-4 py-2">
              <Calculator weight="duotone" className="h-4 w-4 mr-2" />
              Metodologia IFRS 15
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Os 5 Passos do IFRS 15
              <span className="block text-2xl md:text-3xl font-normal text-muted-foreground mt-4">
                Automatizados e Auditáveis
              </span>
            </h2>
          </motion.div>

          <div className="max-w-5xl mx-auto">
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-blue-500 to-purple-500 hidden md:block" />
              
              {ifrs15Steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, x: -40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="relative flex items-start gap-8 mb-12 last:mb-0"
                  >
                    <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl shadow-emerald-500/30 text-white font-bold text-xl flex-shrink-0 z-10">
                      {step.step}
                    </div>
                    <Card className="flex-1 card-premium border-0 overflow-visible">
                      <CardContent className="p-8">
                        <div className="flex items-start gap-6">
                          <div className="md:hidden flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold flex-shrink-0">
                            {step.step}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-3">
                              <Icon weight="duotone" className="h-6 w-6 text-emerald-500" />
                              <h3 className="text-xl font-semibold">{step.title}</h3>
                            </div>
                            <p className="text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <Badge variant="outline" className="mb-6 px-4 py-2">
              <Sparkle weight="fill" className="h-4 w-4 mr-2 text-amber-500" />
              Benefícios
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Por que escolher o
              <span className="bg-gradient-to-r from-emerald-500 to-purple-500 bg-clip-text text-transparent"> IFRS 15 Manager?</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              const colors: Record<string, string> = {
                emerald: "from-emerald-500 to-emerald-600",
                blue: "from-blue-500 to-blue-600",
                purple: "from-purple-500 to-purple-600",
                amber: "from-amber-500 to-orange-500",
              };
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="card-premium border-0 h-full text-center group">
                    <CardContent className="p-8">
                      <div className={`flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${colors[benefit.color]} shadow-lg mx-auto mb-6 transition-transform duration-300 group-hover:scale-110`}>
                        <Icon weight="fill" className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                      <p className="text-muted-foreground">{benefit.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-32 bg-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-purple-500/5" />
        <div className="container mx-auto px-6 relative">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <Badge variant="outline" className="mb-6 px-4 py-2">
              <Quotes weight="fill" className="h-4 w-4 mr-2" />
              Depoimentos
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              O que nossos clientes dizem
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="card-premium border-0 h-full">
                  <CardContent className="p-8">
                    <div className="flex mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} weight="fill" className="h-5 w-5 text-amber-500" />
                      ))}
                    </div>
                    <p className="text-lg mb-6 italic">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-semibold">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <div className="font-semibold">{testimonial.author}</div>
                        <div className="text-sm text-muted-foreground">
                          {testimonial.role}, {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <Badge variant="outline" className="mb-6 px-4 py-2">
              <Coins weight="duotone" className="h-4 w-4 mr-2" />
              Preços Transparentes
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Escolha o plano ideal
              <span className="block text-2xl md:text-3xl font-normal text-muted-foreground mt-4">
                Todos os preços em Reais (BRL)
              </span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => {
              const Icon = plan.icon;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={plan.popular ? "md:-mt-8" : ""}
                >
                  <Card className={`card-premium border-0 h-full relative ${plan.popular ? "ring-2 ring-emerald-500 shadow-2xl shadow-emerald-500/20" : ""}`}>
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 px-6 py-1.5 shadow-lg">
                          <Star weight="fill" className="h-4 w-4 mr-2" />
                          Mais Popular
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-8 pt-10">
                      <div className={`flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${plan.gradient} shadow-lg mx-auto mb-6`}>
                        <Icon weight="fill" className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-center mb-2">{plan.name}</h3>
                      <p className="text-muted-foreground text-center mb-6">{plan.description}</p>
                      <div className="text-center mb-8">
                        <span className="text-lg text-muted-foreground">R$</span>
                        <span className="text-5xl font-bold">{plan.price}</span>
                        <span className="text-muted-foreground">/mês</span>
                      </div>
                      <ul className="space-y-4 mb-8">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-3">
                            <CheckCircle weight="fill" className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={() => setLocation("/subscribe")}
                        className={`w-full h-12 font-semibold ${
                          plan.popular
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30"
                            : ""
                        }`}
                        variant={plan.popular ? "default" : "outline"}
                        data-testid={`button-select-${plan.id}`}
                      >
                        Começar Agora
                        <ArrowRight weight="bold" className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="card-premium border-0 overflow-hidden max-w-5xl mx-auto">
              <div className="relative p-12 md:p-20">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-blue-500/10 to-purple-500/20" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px]" />
                
                <div className="relative text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", duration: 0.6 }}
                  >
                    <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-2xl shadow-emerald-500/40 mx-auto mb-8">
                      <Rocket weight="fill" className="h-10 w-10 text-white" />
                    </div>
                  </motion.div>
                  
                  <h2 className="text-4xl md:text-5xl font-bold mb-6">
                    Pronto para transformar seu
                    <span className="block bg-gradient-to-r from-emerald-500 to-purple-500 bg-clip-text text-transparent">
                      reconhecimento de receita?
                    </span>
                  </h2>
                  <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                    Junte-se a mais de 500 empresas que já automatizaram o compliance IFRS 15.
                    Comece hoje mesmo com 7 dias de garantia.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <Button
                      size="lg"
                      onClick={() => setLocation("/subscribe")}
                      className="h-14 px-10 text-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-2xl shadow-emerald-500/40 transition-all duration-300 hover:scale-105"
                      data-testid="button-get-started-cta"
                    >
                      <Sparkle weight="fill" className="mr-2 h-5 w-5" />
                      Começar Agora
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-14 px-10 text-lg border-2"
                      onClick={() => window.open("mailto:vendas@ifrs15.com.br")}
                    >
                      <Users weight="duotone" className="mr-2 h-5 w-5" />
                      Falar com Vendas
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      <footer className="py-16 border-t">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                <CurrencyDollar weight="fill" className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-bold">IFRS 15 Revenue Manager</span>
                <span className="text-sm text-muted-foreground block">Compliance simplificado</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
              <a href="#" className="hover:text-foreground transition-colors">Suporte</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 IFRS 15. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
