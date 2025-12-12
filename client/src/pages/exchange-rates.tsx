import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Plus, ArrowsLeftRight, TrendUp, Calendar } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import type { ExchangeRate } from "@/lib/types";

const currencies = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
];

const exchangeRateSchema = z.object({
  fromCurrency: z.string().min(1, "From currency is required"),
  toCurrency: z.string().min(1, "To currency is required"),
  rate: z.coerce.number().positive("Rate must be positive"),
  effectiveDate: z.string().min(1, "Effective date is required"),
  source: z.string().optional(),
});

type ExchangeRateFormData = z.infer<typeof exchangeRateSchema>;

export default function ExchangeRatesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: exchangeRates, isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const form = useForm<ExchangeRateFormData>({
    resolver: zodResolver(exchangeRateSchema),
    defaultValues: {
      fromCurrency: "USD",
      toCurrency: "BRL",
      rate: 5.0,
      effectiveDate: format(new Date(), "yyyy-MM-dd"),
      source: "manual",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExchangeRateFormData) => {
      return apiRequest("POST", "/api/exchange-rates", {
        ...data,
        effectiveDate: new Date(data.effectiveDate).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: t("common.success"),
        description: "Exchange rate added successfully",
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: "Failed to add exchange rate",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExchangeRateFormData) => {
    createMutation.mutate(data);
  };

  const groupedRates = exchangeRates?.reduce((acc, rate) => {
    const key = `${rate.fromCurrency}-${rate.toCurrency}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(rate);
    return acc;
  }, {} as Record<string, ExchangeRate[]>) || {};

  const latestRates = Object.entries(groupedRates).map(([key, rates]) => {
    const sorted = [...rates].sort((a, b) => 
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    );
    return sorted[0];
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            {t("exchangeRates.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("exchangeRates.description")}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-rate">
              <Plus className="mr-2 h-4 w-4" />
              {t("exchangeRates.addRate")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("exchangeRates.addRate")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fromCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("exchangeRates.fromCurrency")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-from-currency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.code} - {c.name}
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
                    name="toCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("exchangeRates.toCurrency")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-to-currency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.code} - {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("exchangeRates.rate")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.000001"
                          {...field}
                          data-testid="input-rate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="effectiveDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("exchangeRates.effectiveDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-effective-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("exchangeRates.source")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || "manual"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-source">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">Manual Entry</SelectItem>
                          <SelectItem value="api">External API</SelectItem>
                          <SelectItem value="bank">Bank Rate</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-rate">
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
            <CardTitle className="text-sm font-medium">{t("exchangeRates.totalPairs")}</CardTitle>
            <ArrowsLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-pairs">
              {Object.keys(groupedRates).length}
            </div>
            <p className="text-xs text-muted-foreground">Active currency pairs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("exchangeRates.totalRates")}</CardTitle>
            <TrendUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-rates">
              {exchangeRates?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Historical rate entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("exchangeRates.baseCurrency")}</CardTitle>
            <span className="text-lg font-bold text-primary">BRL</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$</div>
            <p className="text-xs text-muted-foreground">Brazilian Real</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("exchangeRates.lastUpdate")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestRates.length > 0 
                ? format(new Date(latestRates[0].effectiveDate), "dd/MM")
                : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Most recent rate update</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("exchangeRates.currentRates")}</CardTitle>
          <CardDescription>Latest exchange rates for each currency pair</CardDescription>
        </CardHeader>
        <CardContent>
          {latestRates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowsLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("exchangeRates.noRates")}</p>
              <p className="text-sm mt-2">Add your first exchange rate to get started</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {latestRates.map((rate) => {
                const fromCurrency = currencies.find(c => c.code === rate.fromCurrency);
                const toCurrency = currencies.find(c => c.code === rate.toCurrency);
                return (
                  <div
                    key={rate.id}
                    className="p-4 rounded-lg border bg-card"
                    data-testid={`card-rate-${rate.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{rate.fromCurrency}</Badge>
                        <ArrowsLeftRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">{rate.toCurrency}</Badge>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {rate.source || "manual"}
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold">
                      {Number(rate.rate).toFixed(4)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      1 {fromCurrency?.symbol || rate.fromCurrency} = {Number(rate.rate).toFixed(4)} {toCurrency?.symbol || rate.toCurrency}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Effective: {format(new Date(rate.effectiveDate), "dd MMM yyyy")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(groupedRates).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("exchangeRates.rateHistory")}</CardTitle>
            <CardDescription>Historical exchange rates by currency pair</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(groupedRates).map(([pair, rates]) => {
                const sortedRates = [...rates].sort((a, b) => 
                  new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
                );
                return (
                  <div key={pair} className="space-y-2">
                    <h3 className="font-medium flex items-center gap-2">
                      <Badge>{pair.split("-")[0]}</Badge>
                      <ArrowsLeftRight className="h-4 w-4" />
                      <Badge>{pair.split("-")[1]}</Badge>
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      {sortedRates.slice(0, 5).map((rate, idx) => (
                        <div
                          key={rate.id}
                          className={`text-sm px-3 py-1 rounded-md ${
                            idx === 0 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted"
                          }`}
                        >
                          {Number(rate.rate).toFixed(4)} ({format(new Date(rate.effectiveDate), "dd/MM/yy")})
                        </div>
                      ))}
                      {sortedRates.length > 5 && (
                        <div className="text-sm px-3 py-1 text-muted-foreground">
                          +{sortedRates.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
