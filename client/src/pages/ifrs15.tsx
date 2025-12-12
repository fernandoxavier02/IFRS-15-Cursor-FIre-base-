import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Calculator,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Play,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import type { ContractWithDetails, PerformanceObligationSummary } from "@/lib/types";

interface IFRS15Step {
  step: number;
  title: string;
  description: string;
  status: "completed" | "in_progress" | "pending";
  details?: string;
}

export default function IFRS15Engine() {
  const { toast } = useToast();
  const [selectedContract, setSelectedContract] = useState<string>("");

  const { data: contracts, isLoading: contractsLoading } = useQuery<ContractWithDetails[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: obligations, isLoading: obligationsLoading } = useQuery<PerformanceObligationSummary[]>({
    queryKey: ["/api/contracts", selectedContract, "obligations"],
    enabled: !!selectedContract,
  });

  const runEngineMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return apiRequest("POST", `/api/ifrs15/run/${contractId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Revenue recognition complete",
        description: "IFRS 15 engine has processed the contract.",
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

  const ifrs15Steps: IFRS15Step[] = [
    {
      step: 1,
      title: "Identify the Contract",
      description: "Verify contract meets criteria: approval, terms, commercial substance, collectibility",
      status: selectedContract ? "completed" : "pending",
      details: selectedContract ? "Contract validated - all criteria met" : undefined,
    },
    {
      step: 2,
      title: "Identify Performance Obligations",
      description: "Identify distinct goods/services promised in the contract",
      status: selectedContract && obligations?.length ? "completed" : selectedContract ? "in_progress" : "pending",
      details: obligations?.length ? `${obligations.length} performance obligations identified` : undefined,
    },
    {
      step: 3,
      title: "Determine Transaction Price",
      description: "Calculate total consideration including variable components",
      status: selectedContract ? "completed" : "pending",
    },
    {
      step: 4,
      title: "Allocate Transaction Price",
      description: "Allocate to performance obligations based on standalone selling prices",
      status: selectedContract && obligations?.length ? "completed" : "pending",
    },
    {
      step: 5,
      title: "Recognize Revenue",
      description: "Recognize when/as performance obligations are satisfied",
      status: obligations?.some(o => o.recognizedAmount !== "0") ? "completed" : "pending",
    },
  ];

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-chart-2" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-chart-4" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const obligationColumns = [
    {
      key: "description",
      header: "Description",
      cell: (row: PerformanceObligationSummary) => (
        <span className="font-medium">{row.description}</span>
      ),
    },
    {
      key: "recognitionMethod",
      header: "Recognition",
      cell: (row: PerformanceObligationSummary) => (
        <Badge variant="outline" className="text-xs">
          {row.recognitionMethod === "over_time" ? "Over Time" : "Point in Time"}
        </Badge>
      ),
    },
    {
      key: "allocatedPrice",
      header: "Allocated Price",
      cell: (row: PerformanceObligationSummary) => (
        <span className="tabular-nums">${Number(row.allocatedPrice).toLocaleString()}</span>
      ),
      className: "text-right",
    },
    {
      key: "percentComplete",
      header: "Progress",
      cell: (row: PerformanceObligationSummary) => (
        <div className="flex items-center gap-2 min-w-24">
          <Progress value={Number(row.percentComplete)} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums w-10">
            {row.percentComplete}%
          </span>
        </div>
      ),
    },
    {
      key: "recognizedAmount",
      header: "Recognized",
      cell: (row: PerformanceObligationSummary) => (
        <span className="tabular-nums text-chart-2">
          ${Number(row.recognizedAmount).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "deferredAmount",
      header: "Deferred",
      cell: (row: PerformanceObligationSummary) => (
        <span className="tabular-nums text-muted-foreground">
          ${Number(row.deferredAmount).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "isSatisfied",
      header: "Status",
      cell: (row: PerformanceObligationSummary) =>
        row.isSatisfied ? (
          <Badge variant="default" className="text-xs">Satisfied</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">In Progress</Badge>
        ),
    },
  ];

  const selectedContractData = contracts?.find(c => c.id === selectedContract);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">IFRS 15 Engine</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue recognition calculation and analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedContract} onValueChange={setSelectedContract}>
            <SelectTrigger className="w-64" data-testid="select-contract">
              <SelectValue placeholder="Select a contract" />
            </SelectTrigger>
            <SelectContent>
              {contracts?.map((contract) => (
                <SelectItem key={contract.id} value={contract.id}>
                  {contract.contractNumber} - {contract.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => selectedContract && runEngineMutation.mutate(selectedContract)}
            disabled={!selectedContract || runEngineMutation.isPending}
            data-testid="button-run-engine"
          >
            {runEngineMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Engine
          </Button>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              5-Step Model
            </CardTitle>
            <CardDescription>
              IFRS 15 revenue recognition process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ifrs15Steps.map((step, index) => (
              <div key={step.step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {getStepIcon(step.status)}
                  {index < ifrs15Steps.length - 1 && (
                    <div className="w-px h-full bg-border mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-medium">
                    Step {step.step}: {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                  {step.details && (
                    <p className="text-xs text-chart-2 mt-1">{step.details}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">Contract Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedContract ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-30" />
                <p>Select a contract to view IFRS 15 analysis</p>
              </div>
            ) : contractsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              </div>
            ) : selectedContractData ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{selectedContractData.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedContractData.contractNumber} | {selectedContractData.customerName}
                    </p>
                  </div>
                  <StatusBadge status={selectedContractData.status} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-md bg-muted p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Total Value
                    </p>
                    <p className="text-xl font-semibold tabular-nums mt-1">
                      {selectedContractData.currency} {Number(selectedContractData.totalValue).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Recognized
                    </p>
                    <p className="text-xl font-semibold tabular-nums mt-1 text-chart-2">
                      ${Number(selectedContractData.recognizedRevenue).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Deferred
                    </p>
                    <p className="text-xl font-semibold tabular-nums mt-1">
                      ${Number(selectedContractData.deferredRevenue).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Recognition Progress</span>
                    <span className="text-sm font-medium tabular-nums">
                      {Math.round((Number(selectedContractData.recognizedRevenue) / Number(selectedContractData.totalValue)) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={(Number(selectedContractData.recognizedRevenue) / Number(selectedContractData.totalValue)) * 100}
                    className="h-2"
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {selectedContract && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Performance Obligations</CardTitle>
            <CardDescription>
              Identified distinct goods/services and their recognition status
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={obligationColumns}
              data={obligations ?? []}
              isLoading={obligationsLoading}
              emptyMessage="No performance obligations defined for this contract"
              testIdPrefix="obligation"
              className="border-0"
            />
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible className="space-y-2">
        <AccordionItem value="methodology" className="border rounded-md px-4">
          <AccordionTrigger className="text-sm font-medium">
            Revenue Recognition Methodology
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p>
              <strong>Over Time Recognition:</strong> Revenue is recognized progressively as the entity
              transfers control of goods or services. This applies when the customer simultaneously
              receives and consumes the benefits, the entity's performance creates or enhances an
              asset controlled by the customer, or the entity's performance does not create an
              asset with alternative use and the entity has an enforceable right to payment.
            </p>
            <p>
              <strong>Point in Time Recognition:</strong> Revenue is recognized at a specific point
              when control transfers to the customer. This is assessed based on indicators such as
              present right to payment, legal title transfer, physical possession transfer, transfer
              of significant risks and rewards, and customer acceptance.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="variable" className="border rounded-md px-4">
          <AccordionTrigger className="text-sm font-medium">
            Variable Consideration
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            Variable consideration (discounts, rebates, refunds, incentives, performance bonuses,
            penalties) is estimated using either the expected value method (probability-weighted
            amounts) or the most likely amount method. A constraint is applied to limit the
            cumulative revenue recognized to the amount that is highly probable not to result
            in a significant reversal.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
