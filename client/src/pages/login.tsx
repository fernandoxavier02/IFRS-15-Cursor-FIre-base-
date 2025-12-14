import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { useI18n } from "@/lib/i18n";
import { ChartLineUp, ClockCounterClockwise, CurrencyDollar, Eye, EyeClosed, ShieldCheck, SpinnerGap } from "@phosphor-icons/react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { login, isLoading, sendPasswordResetEmail } = useAuth();
  const [, setLocation] = useLocation();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: t("common.error"),
        description: "Please enter your email and password",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      setLocation("/");
    } else {
      toast({
        title: t("common.error"),
        description: result.error,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SpinnerGap weight="bold" className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:flex-1 sidebar-premium relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/10" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12">
          <div className="max-w-md text-center">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl shadow-emerald-500/30">
                  <CurrencyDollar weight="fill" className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-3 border-slate-900 animate-pulse" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">IFRS 15 Revenue Manager</h1>
            <p className="text-white/60 text-lg mb-12">
              Enterprise-grade revenue recognition and contract compliance
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20">
                  <ShieldCheck weight="duotone" className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Full Compliance</p>
                  <p className="text-sm text-white/50">IFRS 15 five-step revenue recognition</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20">
                  <ChartLineUp weight="duotone" className="h-6 w-6 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Real-time Analytics</p>
                  <p className="text-sm text-white/50">Advanced revenue insights and reporting</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20">
                  <ClockCounterClockwise weight="duotone" className="h-6 w-6 text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Complete Audit Trail</p>
                  <p className="text-sm text-white/50">Comprehensive logging for every change</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <CurrencyDollar weight="fill" className="h-8 w-8 text-white" />
            </div>
          </div>
          
          <Card className="card-premium border-0">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
              <CardDescription className="text-base">
                Sign in to continue to your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11"
                    data-testid="input-login-email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      className="p-0 h-auto text-xs text-muted-foreground"
                      data-testid="button-forgot-password"
                      disabled={isResettingPassword}
                      onClick={async () => {
                        if (!email) {
                          toast({
                            title: t("common.error"),
                            description: "Por favor, insira seu email primeiro.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        setIsResettingPassword(true);
                        const result = await sendPasswordResetEmail(email);
                        setIsResettingPassword(false);
                        
                        if (result.success) {
                          toast({
                            title: "Email enviado",
                            description: "Se este email estiver cadastrado, você receberá um link para redefinir sua senha.",
                          });
                        } else {
                          toast({
                            title: t("common.error"),
                            description: result.error,
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      {isResettingPassword ? "Enviando..." : "Forgot password?"}
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="h-11 pr-10"
                      data-testid="input-login-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? (
                        <EyeClosed weight="bold" className="h-4 w-4" />
                      ) : (
                        <Eye weight="bold" className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20" 
                  disabled={isSubmitting}
                  data-testid="button-login-submit"
                >
                  {isSubmitting ? (
                    <>
                      <SpinnerGap weight="bold" className="h-4 w-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
              <div className="mt-8 pt-6 border-t text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Don't have an account?
                </p>
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => setLocation("/subscribe")}
                  data-testid="link-subscribe"
                >
                  Subscribe now
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <p className="mt-8 text-center text-xs text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
