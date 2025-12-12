import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Shield, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

export default function ActivateLicense() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { activateLicense, user } = useAuth();
  const [, setLocation] = useLocation();
  
  const [licenseKey, setLicenseKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatLicenseKey = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!licenseKey) {
      toast({
        title: t("common.error"),
        description: "Please enter your license key",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const result = await activateLicense(licenseKey);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "License activated",
        description: "Your license has been activated successfully. You can now use the application.",
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Activate Your License</CardTitle>
          <CardDescription>
            Welcome, {user?.fullName}! Enter your license key to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="licenseKey">License Key</Label>
              <Input
                id="licenseKey"
                type="text"
                placeholder="LIC-XXXXXXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(formatLicenseKey(e.target.value))}
                disabled={isSubmitting}
                className="font-mono text-center text-lg tracking-wider"
                data-testid="input-license-key"
              />
              <p className="text-sm text-muted-foreground">
                Your license key was sent to your email after subscription.
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-chart-4 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Important Information</p>
                  <ul className="list-disc list-inside mt-1 text-muted-foreground space-y-1">
                    <li>Your license will be locked to your current IP address</li>
                    <li>Only one active session per license is allowed</li>
                    <li>Contact support if you need to change devices</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || !licenseKey}
              data-testid="button-activate-license"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Activate License
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Can't find your license key?</p>
            <p>Check your email inbox or contact support.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
