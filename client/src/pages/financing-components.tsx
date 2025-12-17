import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { contractService, financingComponentService } from "@/lib/firestore-service";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import type { FinancingComponent } from "@/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, Clock, CurrencyDollar, Percent, Plus, TrendUp } from "@phosphor-icons/react";
import type { Contract } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const financingComponentSchema = z.object({
  contractId: z.string().min(1, "Contract is required"),
  nominalAmount: z.coerce.number().positive("Nominal amount must be positive"),
  discountRate: z.coerce.number().min(0).max(100, "Rate must be between 0 and 100"),
  financingPeriodMonths: z.coerce.number().int().positive("Period must be positive"),
  currency: z.string().default("BRL"),
});

type FinancingComponentFormData = z.infer<typeof financingComponentSchema>;

function calculatePresentValue(nominal: number, rate: number, months: number): number {
  const monthlyRate = rate / 100 / 12;
  return nominal / Math.pow(1 + monthlyRate, months);
}

function calculateTotalInterest(nominal: number, presentValue: number): number {
  return nominal - presentValue;
}

export default function FinancingComponentsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewPV, setPreviewPV] = useState<number | null>(null);
  const [previewInterest, setPreviewInterest] = useState<number | null>(null);

  const { user } = useAuth();
  const { data: financingComponents, isLoading } = useQuery<FinancingComponent[]>({
    queryKey: ["financing-components", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return financingComponentService.getAll(user.tenantId) as any;
    },
    enabled: !!user?.tenantId,
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["contracts", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return contractService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  const form = useForm<FinancingComponentFormData>({
    resolver: zodResolver(financingComponentSchema),
    defaultValues: {
      contractId: "",
      nominalAmount: 100000,
      discountRate: 10,
      financingPeriodMonths: 24,
      currency: "BRL",
    },
  });

  const watchNominal = form.watch("nominalAmount");
  const watchRate = form.watch("discountRate");
  const watchPeriod = form.watch("financingPeriodMonths");

  const updatePreview = () => {
    if (watchNominal > 0 && watchRate >= 0 && watchPeriod > 0) {
      const pv = calculatePresentValue(watchNominal, watchRate, watchPeriod);
      const interest = calculateTotalInterest(watchNominal, pv);
      setPreviewPV(pv);
      setPreviewInterest(interest);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: FinancingComponentFormData) => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      const presentValue = calculatePresentValue(data.nominalAmount, data.discountRate, data.financingPeriodMonths);
      const totalInterest = calculateTotalInterest(data.nominalAmount, presentValue);
      
      return financingComponentService.create(user.tenantId, {
        tenantId: user.tenantId,
        contractId: data.contractId,
        nominalAmount: data.nominalAmount.toString(),
        discountRate: data.discountRate.toString(),
        financingPeriodMonths: data.financingPeriodMonths,
        currency: data.currency,
        presentValue: presentValue.toFixed(2),
        totalInterest: totalInterest.toFixed(2),
        recognizedInterest: "0",
        calculatedAt: new Date().toISOString(),
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financing-components", user?.tenantId] });
      setIsDialogOpen(false);
      form.reset();
      setPreviewPV(null);
      setPreviewInterest(null);
      toast({
        title: t("common.success"),
        description: "Componente de financiamento calculado e salvo",
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: "Failed to create financing component",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FinancingComponentFormData) => {
    createMutation.mutate(data);
  };

  const totalNominal = financingComponents?.reduce((sum, fc) => sum + Number(fc.nominalAmount), 0) || 0;
  const totalPV = financingComponents?.reduce((sum, fc) => sum + Number(fc.presentValue), 0) || 0;
  const totalInterest = financingComponents?.reduce((sum, fc) => sum + Number(fc.totalInterest), 0) || 0;
  const totalRecognized = financingComponents?.reduce((sum, fc) => sum + Number(fc.recognizedInterest || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            {t("financingComponents.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("financingComponents.description")}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-component">
              <Plus className="mr-2 h-4 w-4" />
              {t("financingComponents.calculate")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("financingComponents.calculateNew")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="contractId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("financingComponents.contract")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contract">
                            <SelectValue placeholder="Select a contract" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contracts?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.contractNumber} - {c.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nominalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("financingComponents.nominalAmount")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(updatePreview, 0);
                          }}
                          data-testid="input-nominal-amount"
                        />
                      </FormControl>
                      <FormDescription>Total payment amount before discounting</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discountRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("financingComponents.discountRate")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setTimeout(updatePreview, 0);
                              }}
                              data-testid="input-discount-rate"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                          </div>
                        </FormControl>
                        <FormDescription>Annual rate</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="financingPeriodMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("financingComponents.period")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setTimeout(updatePreview, 0);
                              }}
                              data-testid="input-period"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">mo</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {previewPV !== null && (
                  <div className="p-4 rounded-lg bg-muted space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Preview Calculation
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Present Value:</span>
                        <div className="font-bold text-lg">
                          R$ {previewPV.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Financing Income:</span>
                        <div className="font-bold text-lg text-green-600">
                          R$ {previewInterest?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    setPreviewPV(null);
                    setPreviewInterest(null);
                  }}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending ? t("common.loading") : t("common.save")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("financingComponents.totalNominal")}</CardTitle>
            <CurrencyDollar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-nominal">
              R$ {totalNominal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Total contract amounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("financingComponents.totalPV")}</CardTitle>
            <TrendUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-pv">
              R$ {totalPV.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Discounted revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("financingComponents.totalInterest")}</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-interest">
              R$ {totalInterest.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Financing income to recognize</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("financingComponents.recognized")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-recognized">
              R$ {totalRecognized.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <Progress 
              value={totalInterest > 0 ? (totalRecognized / totalInterest) * 100 : 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("financingComponents.components")}</CardTitle>
          <CardDescription>
            Significant financing component calculations per IFRS 15.60-65
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!financingComponents || financingComponents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("financingComponents.noComponents")}</p>
              <p className="text-sm mt-2">
                Calculate financing components for contracts with payment terms over 12 months
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {financingComponents.map((fc) => {
                const contract = contracts?.find(c => c.id === fc.contractId);
                const recognitionProgress = Number(fc.totalInterest) > 0 
                  ? (Number(fc.recognizedInterest || 0) / Number(fc.totalInterest)) * 100 
                  : 0;
                
                return (
                  <div
                    key={fc.id}
                    className="p-4 rounded-lg border"
                    data-testid={`card-financing-${fc.id}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-medium">
                          {contract?.contractNumber || "Unknown Contract"} - {contract?.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Calculated: {fc.calculatedAt ? format(new Date(fc.calculatedAt), "dd MMM yyyy") : "N/A"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          {fc.financingPeriodMonths} months
                        </Badge>
                        <Badge>
                          {Number(fc.discountRate).toFixed(2)}% p.a.
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground block">Nominal Amount</span>
                        <span className="font-medium">
                          R$ {Number(fc.nominalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Present Value</span>
                        <span className="font-medium">
                          R$ {Number(fc.presentValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Total Interest</span>
                        <span className="font-medium text-green-600">
                          R$ {Number(fc.totalInterest).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Recognized</span>
                        <span className="font-medium">
                          R$ {Number(fc.recognizedInterest || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Recognition Progress</span>
                        <span>{recognitionProgress.toFixed(1)}%</span>
                      </div>
                      <Progress value={recognitionProgress} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IFRS 15 Significant Financing Component</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <p>
            Per IFRS 15.60, a contract contains a significant financing component when the timing 
            of payments agreed upon by the parties provides the customer or entity with a significant 
            benefit of financing.
          </p>
          <ul>
            <li>
              <strong>When to apply:</strong> Payment terms exceed 12 months from the point of 
              revenue recognition
            </li>
            <li>
              <strong>Calculation:</strong> Discount future cash flows to present value using an 
              appropriate discount rate (typically the entity's incremental borrowing rate or the 
              rate that would be reflected in a separate financing transaction)
            </li>
            <li>
              <strong>Revenue impact:</strong> Revenue is recognized at the present value amount; 
              the financing component (interest) is recognized separately over the payment period
            </li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Reference: IFRS 15.60-65, IFRS 15.B28-B30
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
