import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Download, FileText, BarChart3, Calendar, TrendingUp } from "lucide-react";
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
} from "@/lib/types";

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState("2024");

  const { data: disaggregatedRevenue, isLoading: disaggLoading } = useQuery<DisaggregatedRevenue[]>({
    queryKey: ["/api/reports/disaggregated-revenue", selectedPeriod],
  });

  const { data: contractBalances, isLoading: balancesLoading } = useQuery<ContractBalanceSummary[]>({
    queryKey: ["/api/reports/contract-balances", selectedPeriod],
  });

  const { data: remainingObligations, isLoading: obligationsLoading } = useQuery<RemainingObligations[]>({
    queryKey: ["/api/reports/remaining-obligations"],
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
          <Button variant="outline" data-testid="button-export-pdf">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="disaggregated" className="space-y-6">
        <TabsList>
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
      </Tabs>
    </div>
  );
}
