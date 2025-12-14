import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import {
    contractService,
    contractVersionService,
    ifrs15Service,
    performanceObligationService,
} from "@/lib/firestore-service";
import { queryClient } from "@/lib/queryClient";
import type { Contract, PerformanceObligation } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    Calculator,
    CheckCircle2,
    Circle,
    Clock,
    FileText,
    Play,
    RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

interface ContractWithDetails extends Contract {
  customerName?: string;
  recognizedRevenue?: number;
  deferredRevenue?: number;
}

interface IFRS15Step {
  step: number;
  title: string;
  description: string;
  status: "completed" | "in_progress" | "pending";
  details?: string;
}

export default function IFRS15Engine() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedContract, setSelectedContract] = useState<string>("");
  const [obligations, setObligations] = useState<PerformanceObligation[]>([]);
  const [obligationsLoading, setObligationsLoading] = useState(false);

  const tenantId = user?.tenantId;

  const { data: contracts, isLoading: contractsLoading } = useQuery<ContractWithDetails[]>({
    queryKey: ["contracts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return contractService.getAll(tenantId);
    },
    enabled: !!tenantId,
  });

  // Load performance obligations when contract changes
  useEffect(() => {
    async function loadObligations() {
      if (!selectedContract || !tenantId) {
        setObligations([]);
        return;
      }

      setObligationsLoading(true);
      try {
        const contract = contracts?.find(c => c.id === selectedContract);
        if (contract?.currentVersionId) {
          const pos = await performanceObligationService.getAll(
            tenantId,
            selectedContract,
            contract.currentVersionId
          );
          setObligations(pos);
        } else {
          // Try to get the first version
          const versions = await contractVersionService.getAll(tenantId, selectedContract);
          if (versions.length > 0) {
            const pos = await performanceObligationService.getAll(
              tenantId,
              selectedContract,
              versions[0].id
            );
            setObligations(pos);
          }
        }
      } catch (error) {
        console.error("Error loading obligations:", error);
        setObligations([]);
      } finally {
        setObligationsLoading(false);
      }
    }

    loadObligations();
  }, [selectedContract, tenantId, contracts]);

  const runEngineMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return ifrs15Service.runEngine(contractId);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      
      toast({
        title: "Reconhecimento de receita completo",
        description: `IFRS 15 Engine processou o contrato. Receita reconhecida: R$ ${result?.totalRecognizedRevenue?.toLocaleString() || 0}`,
      });

      // Reload obligations
      if (selectedContract && tenantId) {
        const contract = contracts?.find(c => c.id === selectedContract);
        if (contract?.currentVersionId) {
          performanceObligationService.getAll(tenantId, selectedContract, contract.currentVersionId)
            .then(setObligations);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const ifrs15Steps: IFRS15Step[] = [
    {
      step: 1,
      title: "Identificar o Contrato",
      description: "Verificar se o contrato atende aos critérios: aprovação, termos, substância comercial, cobrabilidade",
      status: selectedContract ? "completed" : "pending",
      details: selectedContract ? "Contrato validado - todos os critérios atendidos" : undefined,
    },
    {
      step: 2,
      title: "Identificar Obrigações de Performance",
      description: "Identificar bens/serviços distintos prometidos no contrato",
      status: selectedContract && obligations?.length ? "completed" : selectedContract ? "in_progress" : "pending",
      details: obligations?.length ? `${obligations.length} obrigações de performance identificadas` : undefined,
    },
    {
      step: 3,
      title: "Determinar Preço da Transação",
      description: "Calcular a contrapartida total incluindo componentes variáveis",
      status: selectedContract ? "completed" : "pending",
    },
    {
      step: 4,
      title: "Alocar Preço da Transação",
      description: "Alocar às obrigações de performance com base nos preços de venda standalone",
      status: selectedContract && obligations?.length ? "completed" : "pending",
    },
    {
      step: 5,
      title: "Reconhecer Receita",
      description: "Reconhecer quando/conforme as obrigações de performance são satisfeitas",
      status: obligations?.some(o => Number(o.recognizedAmount) > 0) ? "completed" : "pending",
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
      header: "Descrição",
      cell: (row: PerformanceObligation) => (
        <span className="font-medium">{row.description}</span>
      ),
    },
    {
      key: "recognitionMethod",
      header: "Reconhecimento",
      cell: (row: PerformanceObligation) => (
        <Badge variant="outline" className="text-xs">
          {row.recognitionMethod === "over_time" ? "Ao Longo do Tempo" : "Ponto no Tempo"}
        </Badge>
      ),
    },
    {
      key: "allocatedPrice",
      header: "Preço Alocado",
      cell: (row: PerformanceObligation) => (
        <span className="tabular-nums">R$ {Number(row.allocatedPrice).toLocaleString()}</span>
      ),
      className: "text-right",
    },
    {
      key: "percentComplete",
      header: "Progresso",
      cell: (row: PerformanceObligation) => (
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
      header: "Reconhecido",
      cell: (row: PerformanceObligation) => (
        <span className="tabular-nums text-chart-2">
          R$ {Number(row.recognizedAmount).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "deferredAmount",
      header: "Diferido",
      cell: (row: PerformanceObligation) => (
        <span className="tabular-nums text-muted-foreground">
          R$ {Number(row.deferredAmount).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "isSatisfied",
      header: "Status",
      cell: (row: PerformanceObligation) =>
        row.isSatisfied ? (
          <Badge variant="default" className="text-xs">Satisfeita</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Em Progresso</Badge>
        ),
    },
  ];

  const selectedContractData = contracts?.find(c => c.id === selectedContract);

  // Calculate totals from obligations
  const totalRecognized = obligations.reduce((sum, o) => sum + Number(o.recognizedAmount || 0), 0);
  const totalDeferred = obligations.reduce((sum, o) => sum + Number(o.deferredAmount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Motor IFRS 15</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cálculo e análise de reconhecimento de receita
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedContract} onValueChange={setSelectedContract}>
            <SelectTrigger className="w-64" data-testid="select-contract">
              <SelectValue placeholder="Selecione um contrato" />
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
            Executar Motor
          </Button>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Modelo de 5 Passos
            </CardTitle>
            <CardDescription>
              Processo de reconhecimento de receita IFRS 15
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
                    Passo {step.step}: {step.title}
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
            <CardTitle className="text-base font-medium">Resumo do Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedContract ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-30" />
                <p>Selecione um contrato para ver a análise IFRS 15</p>
              </div>
            ) : contractsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                      {selectedContractData.contractNumber}
                    </p>
                  </div>
                  <StatusBadge status={selectedContractData.status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="rounded-md bg-muted p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Valor Total
                    </p>
                    <p className="text-xl font-semibold tabular-nums mt-1">
                      {selectedContractData.currency} {Number(selectedContractData.totalValue).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Reconhecido
                    </p>
                    <p className="text-xl font-semibold tabular-nums mt-1 text-chart-2">
                      R$ {totalRecognized.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Diferido
                    </p>
                    <p className="text-xl font-semibold tabular-nums mt-1">
                      R$ {totalDeferred.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Progresso de Reconhecimento</span>
                    <span className="text-sm font-medium tabular-nums">
                      {Number(selectedContractData.totalValue) > 0 
                        ? Math.round((totalRecognized / Number(selectedContractData.totalValue)) * 100)
                        : 0}%
                    </span>
                  </div>
                  <Progress
                    value={Number(selectedContractData.totalValue) > 0 
                      ? (totalRecognized / Number(selectedContractData.totalValue)) * 100 
                      : 0}
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
            <CardTitle className="text-base font-medium">Obrigações de Performance</CardTitle>
            <CardDescription>
              Bens/serviços distintos identificados e seu status de reconhecimento
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={obligationColumns}
              data={obligations ?? []}
              isLoading={obligationsLoading}
              emptyMessage="Nenhuma obrigação de performance definida para este contrato"
              testIdPrefix="obligation"
              className="border-0"
            />
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible className="space-y-2">
        <AccordionItem value="methodology" className="border rounded-md px-4">
          <AccordionTrigger className="text-sm font-medium">
            Metodologia de Reconhecimento de Receita
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p>
              <strong>Reconhecimento Ao Longo do Tempo:</strong> A receita é reconhecida progressivamente
              à medida que a entidade transfere o controle de bens ou serviços. Isso se aplica quando o
              cliente simultaneamente recebe e consome os benefícios, o desempenho da entidade cria ou
              melhora um ativo controlado pelo cliente, ou o desempenho da entidade não cria um ativo
              com uso alternativo e a entidade tem direito executável ao pagamento.
            </p>
            <p>
              <strong>Reconhecimento em Ponto no Tempo:</strong> A receita é reconhecida em um ponto
              específico quando o controle é transferido ao cliente. Isso é avaliado com base em
              indicadores como direito presente ao pagamento, transferência de título legal, transferência
              de posse física, transferência de riscos e recompensas significativos e aceitação do cliente.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="variable" className="border rounded-md px-4">
          <AccordionTrigger className="text-sm font-medium">
            Contraprestação Variável
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            A contraprestação variável (descontos, abatimentos, reembolsos, incentivos, bônus de
            desempenho, penalidades) é estimada usando o método do valor esperado (valores ponderados
            pela probabilidade) ou o método do valor mais provável. Uma restrição é aplicada para
            limitar a receita cumulativa reconhecida ao valor que é altamente provável de não resultar
            em uma reversão significativa.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
