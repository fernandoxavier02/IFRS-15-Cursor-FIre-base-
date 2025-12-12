import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Download,
  FileText,
  BarChart3,
  Calendar,
  TrendingUp,
  BookOpen,
  Scale,
  Printer,
  CheckCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type {
  DisaggregatedRevenue,
  ContractBalanceSummary,
  RemainingObligations,
  DisclosureReportData,
} from "@/lib/types";

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState("2024");
  const [activeTab, setActiveTab] = useState("disaggregated");
  const disclosureRef = useRef<HTMLDivElement>(null);

  const { data: disaggregatedRevenue, isLoading: disaggLoading } = useQuery<DisaggregatedRevenue[]>({
    queryKey: ["/api/reports/disaggregated-revenue", selectedPeriod],
  });

  const { data: contractBalances, isLoading: balancesLoading } = useQuery<ContractBalanceSummary[]>({
    queryKey: ["/api/reports/contract-balances", selectedPeriod],
  });

  const { data: remainingObligations, isLoading: obligationsLoading } = useQuery<RemainingObligations[]>({
    queryKey: ["/api/reports/remaining-obligations"],
  });

  const { data: disclosureData, isLoading: disclosureLoading } = useQuery<DisclosureReportData>({
    queryKey: ["/api/reports/disclosure", selectedPeriod],
  });

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  const recognitionMethodData = disaggregatedRevenue
    ? [
        {
          name: "Over Time",
          value: disaggregatedRevenue.reduce((sum, r) => sum + r.overTime, 0),
        },
        {
          name: "Point in Time",
          value: disaggregatedRevenue.reduce((sum, r) => sum + r.pointInTime, 0),
        },
      ]
    : [];

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
          <h1 className="text-2xl font-semibold">IFRS 15 Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue recognition disclosures and compliance reports
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
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="no-print">
          <TabsTrigger value="disaggregated" data-testid="tab-disaggregated">
            <BarChart3 className="h-4 w-4 mr-2" />
            Disaggregated Revenue
          </TabsTrigger>
          <TabsTrigger value="balances" data-testid="tab-balances">
            <FileText className="h-4 w-4 mr-2" />
            Contract Balances
          </TabsTrigger>
          <TabsTrigger value="obligations" data-testid="tab-obligations">
            <Calendar className="h-4 w-4 mr-2" />
            Remaining Obligations
          </TabsTrigger>
          <TabsTrigger value="disclosure" data-testid="tab-disclosure">
            <BookOpen className="h-4 w-4 mr-2" />
            Disclosure Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disaggregated" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-medium">Revenue by Category</CardTitle>
                <CardDescription>
                  Revenue disaggregated by product/service category and recognition method
                </CardDescription>
              </CardHeader>
              <CardContent>
                {disaggLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : disaggregatedRevenue && disaggregatedRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={disaggregatedRevenue}>
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
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                      />
                      <Bar
                        dataKey="overTime"
                        name="Over Time"
                        fill="hsl(var(--chart-1))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="pointInTime"
                        name="Point in Time"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No revenue data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">By Recognition Method</CardTitle>
                <CardDescription>
                  Distribution of revenue recognition timing
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
                        {recognitionMethodData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Detailed Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Over Time</TableHead>
                      <TableHead className="text-right">Point in Time</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disaggLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : disaggregatedRevenue?.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.category}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${row.overTime.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${row.pointInTime.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          ${row.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {disaggregatedRevenue && (
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${disaggregatedRevenue.reduce((s, r) => s + r.overTime, 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${disaggregatedRevenue.reduce((s, r) => s + r.pointInTime, 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${disaggregatedRevenue.reduce((s, r) => s + r.total, 0).toLocaleString()}
                        </TableCell>
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
              <CardTitle className="text-base font-medium">Contract Balances Reconciliation</CardTitle>
              <CardDescription>
                Opening and closing balances for contract assets and liabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Opening Asset</TableHead>
                      <TableHead className="text-right">Opening Liability</TableHead>
                      <TableHead className="text-right">Revenue Recognized</TableHead>
                      <TableHead className="text-right">Cash Received</TableHead>
                      <TableHead className="text-right">Closing Asset</TableHead>
                      <TableHead className="text-right">Closing Liability</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balancesLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : contractBalances?.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.period}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${row.openingAsset.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${row.openingLiability.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-chart-2">
                          ${row.revenueRecognized.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${row.cashReceived.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          ${row.closingAsset.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          ${row.closingLiability.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="obligations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Remaining Performance Obligations
              </CardTitle>
              <CardDescription>
                Transaction price allocated to unsatisfied performance obligations and expected recognition timing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {obligationsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : remainingObligations && remainingObligations.length > 0 ? (
                <div className="space-y-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={remainingObligations}>
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
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, "Expected Recognition"]}
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
                      <span className="font-medium">Total Remaining Obligations</span>
                    </div>
                    <span className="text-2xl font-semibold tabular-nums">
                      ${remainingObligations.reduce((s, r) => s + r.amount, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No remaining obligations data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disclosure" className="space-y-6">
          <div ref={disclosureRef} className="print-content space-y-6">
            {disclosureLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : disclosureData ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-xl">
                          IFRS 15 Revenue Recognition Disclosure Report
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Fiscal Year {disclosureData.reportPeriod}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="no-print">
                        Generated: {new Date(disclosureData.generatedAt).toLocaleDateString()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                      <div className="p-4 rounded-md bg-muted/50">
                        <p className="text-sm text-muted-foreground">Total Recognized Revenue</p>
                        <p className="text-2xl font-semibold tabular-nums mt-1" data-testid="text-total-recognized">
                          ${disclosureData.totalRecognizedRevenue.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-md bg-muted/50">
                        <p className="text-sm text-muted-foreground">Remaining Obligations</p>
                        <p className="text-2xl font-semibold tabular-nums mt-1" data-testid="text-total-deferred">
                          ${disclosureData.totalDeferredRevenue.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-md bg-muted/50">
                        <p className="text-sm text-muted-foreground">Contract Assets</p>
                        <p className="text-2xl font-semibold tabular-nums mt-1" data-testid="text-contract-assets">
                          ${disclosureData.totalContractAssets.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-md bg-muted/50">
                        <p className="text-sm text-muted-foreground">Contract Liabilities</p>
                        <p className="text-2xl font-semibold tabular-nums mt-1" data-testid="text-contract-liabilities">
                          ${disclosureData.totalContractLiabilities.toLocaleString()}
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
                        Disaggregation of Revenue (IFRS 15.114-115)
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Revenue disaggregated by category and recognition timing
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Over Time</TableHead>
                            <TableHead className="text-right">Point in Time</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {disclosureData.disaggregatedRevenue.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{row.category}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                ${row.overTime.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                ${row.pointInTime.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                ${row.total.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-medium">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right tabular-nums">
                              ${disclosureData.disaggregatedRevenue.reduce((s, r) => s + r.overTime, 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              ${disclosureData.disaggregatedRevenue.reduce((s, r) => s + r.pointInTime, 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              ${disclosureData.disaggregatedRevenue.reduce((s, r) => s + r.total, 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Scale className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base font-medium">
                        Contract Balances (IFRS 15.116-118)
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Opening and closing balances with period-over-period changes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Opening Asset</TableHead>
                            <TableHead className="text-right">Opening Liability</TableHead>
                            <TableHead className="text-right">Revenue Recognized</TableHead>
                            <TableHead className="text-right">Closing Asset</TableHead>
                            <TableHead className="text-right">Closing Liability</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {disclosureData.contractBalances.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{row.period}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                ${row.openingAsset.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                ${row.openingLiability.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-chart-2">
                                ${row.revenueRecognized.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                ${row.closingAsset.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                ${row.closingLiability.toLocaleString()}
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
                        Remaining Performance Obligations (IFRS 15.120-122)
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Transaction price allocated to unsatisfied obligations by expected timing
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Expected Timing</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">% of Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {disclosureData.remainingObligations.map((row, i) => {
                            const total = disclosureData.remainingObligations.reduce((s, r) => s + r.amount, 0);
                            const pct = total > 0 ? ((row.amount / total) * 100).toFixed(1) : "0.0";
                            return (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{row.period}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  ${row.amount.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {pct}%
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/50 font-medium">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right tabular-nums">
                              ${disclosureData.remainingObligations.reduce((s, r) => s + r.amount, 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">100.0%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base font-medium">
                        Significant Judgments and Estimates (IFRS 15.123-126)
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Key judgments made in applying revenue recognition policies
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full">
                      {disclosureData.significantJudgments.map((judgment, i) => (
                        <AccordionItem key={i} value={`judgment-${i}`}>
                          <AccordionTrigger className="text-left" data-testid={`accordion-judgment-${i}`}>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-chart-1 shrink-0" />
                              <span className="font-medium">{judgment.area}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 pl-6">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Description</p>
                                <p className="text-sm mt-1">{judgment.description}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Impact</p>
                                <p className="text-sm mt-1">{judgment.impact}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Methodology</p>
                                <p className="text-sm mt-1">{judgment.methodology}</p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base font-medium">
                        Accounting Policies (IFRS 15.110-113)
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Summary of significant accounting policies for revenue recognition
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {disclosureData.accountingPolicies.map((policy, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="text-chart-1 font-medium shrink-0">{i + 1}.</span>
                          <span>{policy}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                  <p>This disclosure report was prepared in accordance with IFRS 15 Revenue from Contracts with Customers.</p>
                  <p className="mt-1">Report generated on {new Date(disclosureData.generatedAt).toLocaleString()}</p>
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No disclosure data available
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
