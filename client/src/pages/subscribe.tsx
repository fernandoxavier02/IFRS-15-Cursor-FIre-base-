import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { Check, Calculator, Shield, Users, BarChart3, Loader2 } from "lucide-react";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 99,
    interval: "month",
    description: "For small businesses starting with IFRS 15",
    features: [
      "Up to 50 contracts",
      "1 user license",
      "Basic IFRS 15 reports",
      "Email support",
    ],
    popular: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: 299,
    interval: "month",
    description: "For growing companies with complex needs",
    features: [
      "Up to 500 contracts",
      "5 user licenses",
      "Advanced IFRS 15 reports",
      "Variable consideration tracking",
      "Contract modifications",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 599,
    interval: "month",
    description: "For large organizations with full compliance needs",
    features: [
      "Unlimited contracts",
      "Unlimited user licenses",
      "Complete IFRS 15 engine",
      "Audit trail & compliance",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    popular: false,
  },
];

export default function Subscribe() {
  const { toast } = useToast();
  const { t } = useI18n();
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
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    setSelectedPlan(planId);
    checkoutMutation.mutate({ email, planId });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary shadow-lg">
              <Calculator className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">IFRS 15 Revenue Manager</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Complete revenue recognition compliance platform. Automate IFRS 15 requirements and streamline your accounting processes.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-12">
          <Card>
            <CardContent className="pt-6">
              <Label htmlFor="email" className="text-base font-medium">
                Your Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
                data-testid="input-email"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Your login credentials will be sent to this email after subscription.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/{plan.interval}</span>
                </div>
                <ul className="space-y-3 text-left">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={checkoutMutation.isPending && selectedPlan === plan.id}
                  data-testid={`button-subscribe-${plan.id}`}
                >
                  {checkoutMutation.isPending && selectedPlan === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Get Started"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Why Choose IFRS 15 Revenue Manager?
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center p-6">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-2">Full Compliance</h3>
              <p className="text-sm text-muted-foreground">
                Complete IFRS 15 five-step model implementation with audit trails
              </p>
            </div>
            <div className="text-center p-6">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-2">Team Collaboration</h3>
              <p className="text-sm text-muted-foreground">
                Role-based access control for finance, auditors, and operations
              </p>
            </div>
            <div className="text-center p-6">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-2">Real-time Reports</h3>
              <p className="text-sm text-muted-foreground">
                Disaggregated revenue, contract balances, and remaining obligations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
