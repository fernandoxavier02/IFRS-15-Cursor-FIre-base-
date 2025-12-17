import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { usePlan } from "@/hooks/use-plan";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { aiProviderConfigService } from "@/lib/firestore-service";
import { queryClient } from "@/lib/queryClient";
import {
    Brain,
    Check,
    CircleNotch,
    Key,
    Plus,
    Robot,
    ShieldCheck,
    Sparkle,
    Star,
    Trash,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { AiProvider, AiProviderConfig } from "@shared/firestore-types";

interface AiModel {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
}

const providerLogos: Record<string, { icon: typeof Robot; color: string }> = {
  openai: { icon: Robot, color: "from-emerald-500 to-emerald-600" },
  anthropic: { icon: Brain, color: "from-orange-500 to-red-500" },
  google: { icon: Sparkle, color: "from-blue-500 to-blue-600" },
  openrouter: { icon: Robot, color: "from-purple-500 to-pink-500" },
};

export default function AiSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { planInfo, isLoading: planLoading, features } = usePlan();
  const hasAiIngestion = features.hasCustomIntegrations; // AI features require Enterprise (custom integrations)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProviderConfig | null>(null);
  const [formData, setFormData] = useState({
    provider: "",
    name: "",
    apiKey: "",
    model: "",
    baseUrl: "",
    isDefault: false,
  });

  const { data: providers, isLoading: providersLoading } = useQuery<AiProviderConfig[]>({
    queryKey: ["ai-providers", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId || !hasAiIngestion) return [];
      const configs = await aiProviderConfigService.getAll(user.tenantId);
      // Convert baseUrl from null to undefined for compatibility
      return configs.map(c => ({
        ...c,
        baseUrl: c.baseUrl === null ? undefined : c.baseUrl,
      }));
    },
    enabled: hasAiIngestion && !!user?.tenantId,
  });

  const { data: availableModels } = useQuery<AiModel[]>({
    queryKey: ["ai-models"],
    queryFn: async () => {
      // Return static list of available models
      return [
        { id: "gpt-4", name: "GPT-4", provider: "openai", capabilities: ["text", "analysis"] },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai", capabilities: ["text"] },
        { id: "claude-3-opus", name: "Claude 3 Opus", provider: "anthropic", capabilities: ["text", "analysis"] },
        { id: "claude-3-sonnet", name: "Claude 3 Sonnet", provider: "anthropic", capabilities: ["text"] },
        { id: "gemini-pro", name: "Gemini Pro", provider: "google", capabilities: ["text", "analysis"] },
      ];
    },
    enabled: hasAiIngestion,
  });

  const createProviderMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      return aiProviderConfigService.create(user.tenantId, {
        tenantId: user.tenantId,
        provider: data.provider as AiProvider,
        name: data.name,
        apiKey: data.apiKey,
        model: data.model,
        baseUrl: data.baseUrl.trim() ? data.baseUrl.trim() : undefined,
        isDefault: data.isDefault,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers", user?.tenantId] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Provider Added",
        description: "AI provider configuration saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      const updateData: any = {};
      if (data.provider) updateData.provider = data.provider;
      if (data.name) updateData.name = data.name;
      if (data.apiKey) updateData.apiKey = data.apiKey;
      if (data.model) updateData.model = data.model;
      if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl?.trim() ? data.baseUrl.trim() : undefined;
      if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
      return aiProviderConfigService.update(user.tenantId, id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers", user?.tenantId] });
      setDialogOpen(false);
      setEditingProvider(null);
      resetForm();
      toast({
        title: "Provider Updated",
        description: "AI provider configuration updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      return aiProviderConfigService.delete(user.tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers", user?.tenantId] });
      toast({
        title: "Provider Removed",
        description: "AI provider configuration deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      // Set all providers to not default first, then set this one as default
      if (providers && Array.isArray(providers)) {
        await Promise.all(
          providers.map((p: any) => 
            p.id !== id && p.isDefault 
              ? aiProviderConfigService.update(user.tenantId!, p.id, { isDefault: false })
              : Promise.resolve()
          )
        );
      }
      return aiProviderConfigService.update(user.tenantId, id, { isDefault: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers", user?.tenantId] });
      toast({
        title: "Default Updated",
        description: "Default AI provider set successfully.",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      provider: "",
      name: "",
      apiKey: "",
      model: "",
      baseUrl: "",
      isDefault: false,
    });
  };

  const handleOpenDialog = (provider?: AiProviderConfig) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        provider: provider.provider as any,
        name: provider.name,
        apiKey: "",
        model: provider.model,
        baseUrl: provider.baseUrl || "",
        isDefault: provider.isDefault,
      });
    } else {
      setEditingProvider(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProvider) {
      const updateData: Partial<typeof formData> = { ...formData };
      if (!updateData.apiKey) {
        delete updateData.apiKey;
      }
      updateProviderMutation.mutate({ id: editingProvider.id, data: updateData });
    } else {
      createProviderMutation.mutate(formData);
    }
  };

  const getModelsForProvider = (provider: string) => {
    return availableModels?.filter((m) => m.provider === provider) || [];
  };

  if (planLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAiIngestion) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <UpgradePrompt
          title="AI Contract Ingestion"
          targetPlan="enterprise"
          currentPlan={planInfo?.planType || "starter"}
          featureName="AI Contract Ingestion"
          description="Unlock AI-powered contract extraction with support for multiple AI providers (OpenAI, Anthropic, Google Gemini, OpenRouter). Bring your own API keys for maximum flexibility and control."
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20">
            <Brain weight="fill" className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Configuration</h1>
            <p className="text-sm text-muted-foreground">
              Configure AI providers for intelligent contract extraction
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-provider" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingProvider ? "Edit AI Provider" : "Add AI Provider"}
                </DialogTitle>
                <DialogDescription>
                  Configure your AI provider credentials. API keys are encrypted at rest.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={(value) =>
                      setFormData({ ...formData, provider: value, model: "" })
                    }
                    disabled={!!editingProvider}
                  >
                    <SelectTrigger id="provider" data-testid="select-provider">
                      <SelectValue placeholder="Select AI provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google (Gemini)</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Configuration Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Production GPT-4"
                    data-testid="input-provider-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="apiKey"
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder={editingProvider ? "Leave blank to keep current" : "sk-..."}
                      className="pl-10"
                      data-testid="input-api-key"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your API key is encrypted and stored securely
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select
                    value={formData.model}
                    onValueChange={(value) => setFormData({ ...formData, model: value })}
                    disabled={!formData.provider}
                  >
                    <SelectTrigger id="model" data-testid="select-model">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {getModelsForProvider(formData.provider).map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.provider === "openrouter" && (
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">Custom Base URL (Optional)</Label>
                    <Input
                      id="baseUrl"
                      value={formData.baseUrl}
                      onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                      placeholder="https://openrouter.ai/api/v1"
                      data-testid="input-base-url"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isDefault">Set as Default</Label>
                    <p className="text-xs text-muted-foreground">
                      Use this provider for new contract ingestion
                    </p>
                  </div>
                  <Switch
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isDefault: checked })
                    }
                    data-testid="switch-is-default"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createProviderMutation.isPending ||
                    updateProviderMutation.isPending
                  }
                  data-testid="button-save-provider"
                >
                  {(createProviderMutation.isPending || updateProviderMutation.isPending) && (
                    <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingProvider ? "Update Provider" : "Add Provider"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-dashed border-2 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <ShieldCheck weight="fill" className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Bring Your Own Key (BYOK)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your API keys never leave your environment. We use secure encryption
                at rest and in transit. You maintain full control over your AI spending.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed border-2 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5">
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Robot weight="fill" className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Multi-Provider Support</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose from OpenAI, Anthropic, Google Gemini, or OpenRouter.
                Mix and match providers for different use cases.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {providersLoading ? (
        <div className="flex items-center justify-center py-12">
          <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : providers && providers.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Configured Providers</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {providers.map((provider) => {
              const providerInfo = providerLogos[provider.provider] || {
                icon: Robot,
                color: "from-gray-500 to-gray-600",
              };
              const ProviderIcon = providerInfo.icon;

              return (
                <Card key={provider.id} className="relative overflow-visible">
                  {provider.isDefault && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1 shadow-lg">
                        <Star weight="fill" className="h-3 w-3" />
                        Default
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${providerInfo.color} flex items-center justify-center`}
                      >
                        <ProviderIcon weight="fill" className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{provider.name}</CardTitle>
                        <CardDescription className="capitalize">
                          {provider.provider} - {provider.model}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={provider.isActive ? "default" : "secondary"}
                          className={
                            provider.isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : ""
                          }
                        >
                          {provider.isActive ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            "Inactive"
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Key: {provider.apiKey}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!provider.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefaultMutation.mutate(provider.id)}
                            disabled={setDefaultMutation.isPending}
                            data-testid={`button-set-default-${provider.id}`}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(provider)}
                          data-testid={`button-edit-provider-${provider.id}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProviderMutation.mutate(provider.id)}
                          disabled={deleteProviderMutation.isPending}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-provider-${provider.id}`}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Robot weight="duotone" className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No AI Providers Configured</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Add your first AI provider to start using intelligent contract extraction.
                You can add multiple providers and switch between them.
              </p>
            </div>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-provider">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Provider
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
