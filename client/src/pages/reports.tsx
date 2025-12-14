import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-firebase";
import { reportsService } from "@/lib/firestore-service";
import { useQuery } from "@tanstack/react-query";
import {
    BarChart3,
    BookOpen,
    Calendar,
    Printer,
    Scale,
    TrendingUp
} from "lucide-react";
import { useRef, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState("2024");
  const [activeTab, setActiveTab] = useState("disaggregated");
  const disclosureRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Calculate period dates based on selected year
  const periodStart = `${selectedPeriod}-01-01`;
  const periodEnd = `${selectedPeriod}-12-31`;

  const { data: disaggregatedRevenue, isLoading: disaggLoading } = useQuery({
    queryKey: ["reports", "disaggregated", selectedPeriod],
    queryFn: () => reportsService.generateDisaggregatedRevenue(periodStart, periodEnd),
    enabled: !!user?.tenantId,
  });

  const { data: contractBalances, isLoading: balancesLoading } = useQuery({
    queryKey: ["reports", "balances", selectedPeriod],
    queryFn: () => reportsService.generateContractBalances(periodEnd),
    enabled: !!user?.tenantId,
  });

  const { data: remainingObligations, isLoading: obligationsLoading } = useQuery({
    queryKey: ["reports", "obligations"],
    queryFn: () => reportsService.generateRemainingObligations(),
    enabled: !!user?.tenantId,
  });

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  // Build chart data from disaggregated revenue
  const disaggData = disaggregatedRevenue as any;
  const categoryData = disaggData?.byCategory || [];
  const timingData = disaggData?.byTiming || [];

  const recognitionMethodData = timingData.map((item: any) => ({
    name: item.timing === "over_time" ? "Ao Longo do Tempo" : "Ponto no Tempo",
    value: item.amount,
  }));

  const handleExportPDF = () => {
    setActiveTab("disclosure");
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="p-6 space-y-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        }
      `}</style>

      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios IFRS 15</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Divulgações de reconhecimento de receita e relatórios de conformidade
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2022">2022</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportPDF} data-testid="button-export-pdf">
            <Printer className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="no-print">
          <TabsTrigger value="disaggregated" data-testid="tab-disaggregated">
            <BarChart3 className="h-4 w-4 mr-2" />
            Receita Desagregada
          </TabsTrigger>
          <TabsTrigger value="balances" data-testid="tab-balances">
            <Scale className="h-4 w-4 mr-2" />
            Saldos Contratuais
          </TabsTrigger>
          <TabsTrigger value="obligations" data-testid="tab-obligations">
            <Calendar className="h-4 w-4 mr-2" />
            Obrigações Remanescentes
          </TabsTrigger>
          <TabsTrigger value="disclosure" data-testid="tab-disclosure">
            <BookOpen className="h-4 w-4 mr-2" />
            Relatório de Divulgação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disaggregated" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-medium">Receita por Categoria</CardTitle>
                <CardDescription>
                  Receita desagregada por categoria de produto/serviço
                </CardDescription>
              </CardHeader>
              <CardContent>
                {disaggLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="category"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                        formatter={(value: number) => [`R$ ${value.toLocaleString()}`, ""]}
                      />
                      <Bar
                        dataKey="amount"
                        name="Valor"
                        fill="hsl(var(--chart-1))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    Nenhum dado de receita disponível
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Por Método de Reconhecimento</CardTitle>
                <CardDescription>
                  Distribuição do momento de reconhecimento de receita
                </CardDescription>
              </CardHeader>
              <CardContent>
                {disaggLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : recognitionMethodData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={recognitionMethodData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {recognitionMethodData.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                        formatter={(value: number) => [`R$ ${value.toLocaleString()}`, ""]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Detalhamento por Categoria</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">% do Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disaggLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : categoryData.map((row: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.category}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          R$ {Number(row.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {row.percentage}%
                        </TableCell>
                      </TableRow>
                    ))}
                    {categoryData.length > 0 && (
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right tabular-nums">
                          R$ {disaggData?.totalRevenue?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">100%</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Saldos Contratuais</CardTitle>
              <CardDescription>
                Ativos e passivos de contrato por cliente/contrato
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Ativo Contratual</TableHead>
                      <TableHead className="text-right">Passivo Contratual</TableHead>
                      <TableHead className="text-right">Contas a Receber</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balancesLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (contractBalances as any)?.contracts?.map((row: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.contractNumber}</TableCell>
                        <TableCell>{row.customerName}</TableCell>
                        <TableCell className="text-right tabular-nums text-chart-2">
                          R$ {Number(row.contractAsset).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          R$ {Number(row.contractLiability).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          R$ {Number(row.receivable).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Ativos Contratuais</div>
                <div className="text-2xl font-semibold text-chart-2">
                  R$ {(contractBalances as any)?.contractAssets?.closing?.toLocaleString() || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Passivos Contratuais</div>
                <div className="text-2xl font-semibold text-destructive">
                  R$ {(contractBalances as any)?.contractLiabilities?.closing?.toLocaleString() || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Contas a Receber</div>
                <div className="text-2xl font-semibold">
                  R$ {(contractBalances as any)?.receivables?.closing?.toLocaleString() || 0}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="obligations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Obrigações de Performance Remanescentes
              </CardTitle>
              <CardDescription>
                Preço da transação alocado a obrigações não satisfeitas e prazo esperado de reconhecimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {obligationsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (remainingObligations as any)?.byMaturity?.length > 0 ? (
                <div className="space-y-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(remainingObligations as any).byMaturity}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                        formatter={(value: number) => [`R$ ${value.toLocaleString()}`, "Reconhecimento Esperado"]}
                      />
                      <Bar
                        dataKey="amount"
                        fill="hsl(var(--chart-1))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-chart-1" />
                      <span className="font-medium">Total Obrigações Remanescentes</span>
                    </div>
                    <span className="text-2xl font-semibold tabular-nums">
                      R$ {(remainingObligations as any)?.totalRemaining?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhum dado de obrigações remanescentes disponível
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Detalhamento por Contrato</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor Remanescente</TableHead>
                      <TableHead className="text-right">Data Esperada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {obligationsLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 4 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (remainingObligations as any)?.byContract?.map((row: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.contractNumber}</TableCell>
                        <TableCell>{row.customerName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          R$ {Number(row.remainingAmount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.expectedCompletionDate 
                            ? new Date(row.expectedCompletionDate).toLocaleDateString('pt-BR') 
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disclosure" className="space-y-6">
          <div ref={disclosureRef} className="print-content space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-xl">
                      Relatório de Divulgação IFRS 15
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Exercício Fiscal {selectedPeriod}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="no-print">
                    Gerado em: {new Date().toLocaleDateString('pt-BR')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">Receita Total Reconhecida</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1">
                      R$ {disaggData?.totalRevenue?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">Obrigações Remanescentes</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1">
                      R$ {(remainingObligations as any)?.totalRemaining?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">Ativos Contratuais</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1 text-chart-2">
                      R$ {(contractBalances as any)?.contractAssets?.closing?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">Passivos Contratuais</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1 text-destructive">
                      R$ {(contractBalances as any)?.contractLiabilities?.closing?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base font-medium">
                    Desagregação de Receita (IFRS 15.114-115)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryData.map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.category}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            R$ {Number(row.amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.percentage}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base font-medium">
                    Obrigações de Performance Remanescentes (IFRS 15.120-122)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prazo Esperado</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(remainingObligations as any)?.byMaturity?.map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.period}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            R$ {Number(row.amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.percentage}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground pt-4 border-t">
              <p>Este relatório de divulgação foi preparado de acordo com o IFRS 15 Receita de Contratos com Clientes.</p>
              <p className="mt-1">Relatório gerado em {new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
