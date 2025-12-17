import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import type { BillingScheduleWithDetails, ContractWithDetails, LedgerEntryWithDetails, PerformanceObligationSummary } from "@/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    ArrowLeft,
    Calendar,
    ClockCounterClockwise,
    CurrencyDollar,
    FileText,
    Plus,
    Target,
    TrendUp
} from "@phosphor-icons/react";
import type { PerformanceObligation } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useParams } from "wouter";
import { z } from "zod";

interface ContractFullDetails extends ContractWithDetails {
  customerId: string;
  paymentTerms: string | null;
  createdAt: string;
  updatedAt: string;
  currentVersionId?: string;
  versions?: any[];
}

export default function ContractDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t } = useI18n();

  const { user } = useAuth();
  
  const { data: contract, isLoading: contractLoading } = useQuery<ContractFullDetails>({
    queryKey: ["contract", user?.tenantId, id],
    queryFn: async () => {
      if (!user?.tenantId || !id) return null;
      const { contractService, contractVersionService, customerService } = await import("@/lib/firestore-service");
      const contractData = await contractService.getById(user.tenantId, id);
      if (!contractData) return null;
      
      const versions = await contractVersionService.getAll(user.tenantId, id);
      const customer = contractData.customerId 
        ? await customerService.getById(user.tenantId, contractData.customerId)
        : null;
      
      // Usar currentVersionId do contrato, ou a primeira versão como fallback
      const currentVersionId = contractData.currentVersionId || (versions.length > 0 ? versions[0].id : undefined);
      return {
        ...contractData,
        customerName: customer?.name || "",
        versions,
        currentVersionId,
      } as any;
    },
    enabled: !!id && !!user?.tenantId,
  });

  // Validação de tenantId
  if (!user?.tenantId && !contractLoading) {
    return (
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FileText weight="duotone" className="h-16 w-16 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">Perfil incompleto</p>
          <p className="text-sm text-muted-foreground">
            Seu perfil não possui um tenant associado. Por favor, reautentique ou contate o administrador.
          </p>
          <Button variant="outline" onClick={() => setLocation("/contracts")} data-testid="button-back-contracts">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Contratos
          </Button>
        </div>
      </div>
    );
  }

  const currentVersionId = contract?.currentVersionId || (contract?.versions && contract.versions.length > 0 ? contract.versions[0].id : undefined);
  
  const { data: performanceObligations, isLoading: poLoading } = useQuery<PerformanceObligationSummary[]>({
    queryKey: ["performance-obligations", user?.tenantId, id, currentVersionId],
    queryFn: async () => {
      if (!user?.tenantId || !id || !currentVersionId) return [];
      const { performanceObligationService } = await import("@/lib/firestore-service");
      return performanceObligationService.getAll(user.tenantId, id, currentVersionId) as any;
    },
    enabled: !!id && !!user?.tenantId && !!currentVersionId,
  });

  const { data: billingSchedules, isLoading: billingLoading } = useQuery<BillingScheduleWithDetails[]>({
    queryKey: ["billing-schedules", user?.tenantId, id],
    queryFn: async () => {
      if (!user?.tenantId || !id) return [];
      const { billingScheduleService } = await import("@/lib/firestore-service");
      return billingScheduleService.getByContract(user.tenantId, id) as any;
    },
    enabled: !!id && !!user?.tenantId,
  });

  const {
    data: ledgerEntries,
    isLoading: ledgerLoading,
    error: ledgerError,
  } = useQuery<LedgerEntryWithDetails[]>({
    queryKey: ["ledger-entries", user?.tenantId, id],
    queryFn: async () => {
      if (!user?.tenantId || !id) {
        console.log("[contract-details] Query ledger entries: tenantId ou id ausente", { tenantId: user?.tenantId, id });
        return [];
      }
      console.log("[contract-details] Buscando ledger entries para contrato", { tenantId: user.tenantId, contractId: id });
      const { revenueLedgerService } = await import("@/lib/firestore-service");
      const entries = await revenueLedgerService.getByContract(user.tenantId, id) as any;
      console.log("[contract-details] Ledger entries encontrados:", entries.length, entries);
      return entries;
    },
    enabled: !!id && !!user?.tenantId,
  });

  const { toast } = useToast();
  const [poDialogOpen, setPoDialogOpen] = useState(false);

  const runEngineMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Contract ID not found");
      const { ifrs15Service } = await import("@/lib/firestore-service");
      return ifrs15Service.runEngine(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", user?.tenantId, id] });
      queryClient.invalidateQueries({ queryKey: ["performance-obligations", user?.tenantId, id] });
      queryClient.invalidateQueries({ queryKey: ["billing-schedules", user?.tenantId, id] });
      queryClient.invalidateQueries({ queryKey: ["ledger-entries", user?.tenantId, id] });
      toast({
        title: "Motor IFRS 15 executado",
        description: "Lançamentos contábeis e saldos foram recalculados para este contrato.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao executar o Motor IFRS 15",
        variant: "destructive",
      });
    },
  });

  // Se o ledger vier vazio, tenta rodar o motor automaticamente uma vez
  useEffect(() => {
    if (!id || ledgerLoading || runEngineMutation.isPending) return;
    if (ledgerEntries && ledgerEntries.length > 0) return;
    if (!contract) return;
    // Evita reentradas: marca no state local
    if ((runEngineMutation as any)._autoTriggered) return;
    (runEngineMutation as any)._autoTriggered = true;
    runEngineMutation.mutate();
  }, [id, contract, ledgerEntries, ledgerLoading, runEngineMutation]);

  const poFormSchema = z.object({
    description: z.string().min(1, "Description is required"),
    allocatedPrice: z.string().min(1, "Allocated price is required").refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be a positive number"),
    recognitionMethod: z.enum(["over_time", "point_in_time"]),
    measurementMethod: z.enum(["input", "output"]).optional(),
    percentComplete: z.string().optional().default("0"),
    // Campos condicionais baseados no recognitionMethod
    dueDate: z.string().optional(), // Para point_in_time
    startDate: z.string().optional(), // Para over_time
    endDate: z.string().optional(), // Para over_time
    frequency: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).optional(), // Para over_time
  }).refine((data) => {
    // Validação: point_in_time exige dueDate
    if (data.recognitionMethod === "point_in_time") {
      return !!data.dueDate && data.dueDate.trim() !== "";
    }
    return true;
  }, {
    message: "Due date is required for point in time recognition",
    path: ["dueDate"],
  }).refine((data) => {
    // Validação: over_time exige startDate, endDate e frequency
    if (data.recognitionMethod === "over_time") {
      return !!data.startDate && data.startDate.trim() !== "" &&
             !!data.endDate && data.endDate.trim() !== "" &&
             !!data.frequency;
    }
    return true;
  }, {
    message: "Start date, end date, and frequency are required for over time recognition",
    path: ["startDate"],
  }).refine((data) => {
    // Validação: endDate deve ser após startDate para over_time
    if (data.recognitionMethod === "over_time" && data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end > start;
    }
    return true;
  }, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

  type POFormValues = z.infer<typeof poFormSchema>;

  const poForm = useForm<POFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      description: "",
      allocatedPrice: "",
      recognitionMethod: "over_time",
      measurementMethod: undefined,
      percentComplete: "0",
      dueDate: "",
      startDate: "",
      endDate: "",
      frequency: undefined,
    },
  });

  // Mutation para criar a primeira versão do contrato
  const createInitialVersionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.tenantId || !id || !contract) {
        throw new Error("Dados do contrato ausentes");
      }
      
      const { contractVersionService, contractService } = await import("@/lib/firestore-service");
      const { Timestamp } = await import("firebase/firestore");
      
      // Criar a versão inicial (versão 1)
      // Converter startDate para Timestamp
       let effectiveDate: import("firebase/firestore").Timestamp;
       const startDateValue: unknown = (contract as any).startDate;
       if (startDateValue instanceof Date) {
         effectiveDate = Timestamp.fromDate(startDateValue);
       } else if (startDateValue && typeof (startDateValue as any).toDate === "function") {
         effectiveDate = startDateValue as import("firebase/firestore").Timestamp;
       } else if (typeof startDateValue === "string") {
         const parsed = new Date(startDateValue);
         effectiveDate = isNaN(parsed.getTime()) ? Timestamp.now() : Timestamp.fromDate(parsed);
       } else {
         effectiveDate = Timestamp.now();
       }
      
      const versionData = {
        contractId: id,
        versionNumber: 1,
        effectiveDate,
        description: "Versão inicial do contrato",
        totalValue: Number(contract.totalValue || 0),
        isProspective: true,
      };
      
      const versionId = await contractVersionService.create(user.tenantId, id, versionData);
      
      // Atualizar o contrato com a versão atual
      await contractService.update(user.tenantId, id, {
        currentVersionId: versionId,
        status: contract.status,
      });
      
      return versionId;
    },
    onSuccess: (versionId) => {
      queryClient.invalidateQueries({ queryKey: ["contract", user?.tenantId, id] });
      queryClient.invalidateQueries({ queryKey: ["performance-obligations", user?.tenantId, id] });
      toast({
        title: "Versão criada",
        description: "A versão inicial do contrato foi criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar versão do contrato",
        variant: "destructive",
      });
    },
  });

  const createPOMutation = useMutation({
    mutationFn: async (data: POFormValues) => {
      if (!user?.tenantId || !id) {
        throw new Error("Dados do contrato ausentes");
      }
      
      if (!contract) {
        throw new Error("Dados do contrato não disponíveis");
      }
      
      // VALIDAÇÃO 1: Soma dos allocatedPrice ≤ totalValue do contrato
      const { performanceObligationService } = await import("@/lib/firestore-service");
      const existingPOs = currentVersionId 
        ? await performanceObligationService.getAll(user.tenantId, id, currentVersionId)
        : [];
      
      const totalAllocated = existingPOs.reduce((sum, po) => sum + (po.allocatedPrice || 0), 0);
      const newAllocatedPrice = parseFloat(data.allocatedPrice);
      const totalAfterAdd = totalAllocated + newAllocatedPrice;
      const contractTotalValue = Number(contract.totalValue || 0);
      
      if (totalAfterAdd > contractTotalValue) {
        throw new Error(
          `A soma dos preços alocados (${totalAfterAdd.toFixed(2)}) excede o valor total do contrato (${contractTotalValue.toFixed(2)}). ` +
          `Máximo permitido: ${(contractTotalValue - totalAllocated).toFixed(2)}`
        );
      }
      
      let versionId = currentVersionId;
      
      // Se não houver versão, criar a primeira versão automaticamente
      if (!versionId) {
        const { contractVersionService, contractService } = await import("@/lib/firestore-service");
        const { Timestamp } = await import("firebase/firestore");
        
        // Criar a versão inicial (versão 1)
        // Converter startDate para Timestamp
         let effectiveDate: import("firebase/firestore").Timestamp;
         const startDateValue: unknown = (contract as any).startDate;
         if (startDateValue instanceof Date) {
           effectiveDate = Timestamp.fromDate(startDateValue);
         } else if (startDateValue && typeof (startDateValue as any).toDate === "function") {
           effectiveDate = startDateValue as import("firebase/firestore").Timestamp;
         } else if (typeof startDateValue === "string") {
           const parsed = new Date(startDateValue);
           effectiveDate = isNaN(parsed.getTime()) ? Timestamp.now() : Timestamp.fromDate(parsed);
         } else {
           effectiveDate = Timestamp.now();
         }
        
        const versionData = {
          contractId: id,
          versionNumber: 1,
          effectiveDate,
          description: "Versão inicial do contrato",
          totalValue: contractTotalValue,
          isProspective: true,
        };
        
        versionId = await contractVersionService.create(user.tenantId, id, versionData);
        
        // Atualizar o contrato com a versão atual
        await contractService.update(user.tenantId, id, {
          currentVersionId: versionId,
          status: contract.status,
        });
      }
      
      // Validação adicional: verificar se a versão ainda existe
      const { contractVersionService } = await import("@/lib/firestore-service");
      const version = await contractVersionService.getById(user.tenantId, id, versionId);
      if (!version) {
        throw new Error("A versão do contrato não foi encontrada. Por favor, recarregue a página e tente novamente.");
      }
      
      // Validar e converter allocatedPrice
      const parsedAllocatedPrice = parseFloat(data.allocatedPrice);
      if (isNaN(parsedAllocatedPrice) || parsedAllocatedPrice <= 0) {
        throw new Error("O preço alocado deve ser um número positivo");
      }
      
      // Validar e converter percentComplete
      const percentValue = data.percentComplete?.trim() || "0";
      const parsedPercent = parseFloat(percentValue);
      const finalPercent = isNaN(parsedPercent) || parsedPercent < 0 ? 0 : Math.min(parsedPercent, 100);
      
      // Calcular valores derivados
      const recognizedAmount = (parsedAllocatedPrice * finalPercent) / 100;
      const deferredAmount = parsedAllocatedPrice - recognizedAmount;
      
      // Preparar dados com tipos corretos (PerformanceObligation interface)
      const poData: Omit<PerformanceObligation, "id" | "createdAt"> = {
        contractVersionId: versionId,
        description: data.description.trim(),
        allocatedPrice: parsedAllocatedPrice,
        recognitionMethod: data.recognitionMethod as "over_time" | "point_in_time",
        percentComplete: finalPercent,
        recognizedAmount: recognizedAmount,
        deferredAmount: deferredAmount,
        isSatisfied: false,
      };
      
      // Adicionar measurementMethod apenas se tiver valor válido (e se recognitionMethod for over_time)
      if (data.recognitionMethod === "over_time" && data.measurementMethod && (data.measurementMethod === "input" || data.measurementMethod === "output")) {
        poData.measurementMethod = data.measurementMethod as "input" | "output";
      }
      
      // Criar a PO
      const poId = await performanceObligationService.create(user.tenantId, id, versionId, poData);
      
      // GERAR BILLING SCHEDULES AUTOMATICAMENTE
      const { billingScheduleService, revenueLedgerService } = await import("@/lib/firestore-service");
      const { Timestamp } = await import("firebase/firestore");
      
      if (data.recognitionMethod === "point_in_time" && data.dueDate) {
        // Point in time: parcela única na dueDate
        const dueDate = new Date(data.dueDate);
        if (isNaN(dueDate.getTime())) {
          throw new Error("Data de vencimento inválida. Por favor, verifique a data informada.");
        }
        
        const billingDate = new Date(dueDate);
        billingDate.setDate(billingDate.getDate() - 7); // 7 dias antes da dueDate
        
        if (isNaN(billingDate.getTime())) {
          throw new Error("Erro ao calcular data de faturamento. Por favor, verifique a data de vencimento.");
        }
        
        await billingScheduleService.create(user.tenantId, {
          tenantId: user.tenantId,
          contractId: id,
          performanceObligationId: poId,
          billingDate: Timestamp.fromDate(billingDate),
          dueDate: Timestamp.fromDate(dueDate),
          amount: parsedAllocatedPrice,
          currency: contract.currency || "BRL",
          frequency: "one_time",
          status: "scheduled",
          notes: `Auto-generated for PO: ${data.description.trim()}`,
        });
      } else if (data.recognitionMethod === "over_time" && data.startDate && data.endDate && data.frequency) {
        // Over time: parcelas por período do CONTRATO (não da PO) para cobrir todo o período
        // IMPORTANTE: Usar datas do contrato para garantir que todos os billings sejam gerados
        const getContractDate = (dateValue: any, fallbackDate: string): Date => {
          if (!dateValue) return new Date(fallbackDate);
          
          // Se for Date
          if (dateValue instanceof Date) {
            return dateValue;
          }
          
          // Se for Timestamp do Firestore (tem método toDate)
          if (dateValue && typeof dateValue === "object" && typeof (dateValue as any).toDate === "function") {
            return (dateValue as any).toDate();
          }
          
          // Se for string
          if (typeof dateValue === "string") {
            const parsed = new Date(dateValue);
            if (!isNaN(parsed.getTime())) {
              return parsed;
            }
          }
          
          // Fallback
          return new Date(fallbackDate);
        };
        
        const contractStartDate = getContractDate(contract.startDate, data.startDate);
        const contractEndDate = contract.endDate 
          ? getContractDate(contract.endDate, data.endDate)
          : new Date(data.endDate);
        
        // Validar datas do contrato
        if (isNaN(contractStartDate.getTime()) || isNaN(contractEndDate.getTime())) {
          throw new Error("Datas do contrato inválidas. Verifique as datas de início e fim do contrato.");
        }
        
        // Calcular número de períodos baseado na frequência
        const getPeriodMonths = (freq: string): number => {
          switch (freq) {
            case "monthly": return 1;
            case "quarterly": return 3;
            case "semi_annual": return 6;
            case "annual": return 12;
            default: return 1;
          }
        };
        
        const periodMonths = getPeriodMonths(data.frequency);
        const monthsBetween = (start: Date, end: Date): number => {
          const total = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
          return total <= 0 ? 1 : total;
        };
        
        // Usar período do CONTRATO, não da PO
        const totalMonths = monthsBetween(contractStartDate, contractEndDate);
        const numberOfPeriods = Math.max(1, Math.ceil(totalMonths / periodMonths));
        
        // Distribuir o allocatedPrice da PO proporcionalmente ao período do contrato
        // Se a PO cobre apenas parte do período, calcular proporção
        const poStartDate = new Date(data.startDate);
        const poEndDate = new Date(data.endDate);
        const poMonths = monthsBetween(poStartDate, poEndDate);
        const contractMonths = totalMonths;
        
        // Calcular valor proporcional baseado na cobertura da PO no período do contrato
        // Se PO cobre todo o período do contrato, usar allocatedPrice completo
        // Se PO cobre apenas parte, distribuir proporcionalmente
        const poCoverageRatio = contractMonths > 0 ? Math.min(1, poMonths / contractMonths) : 1;
        const amountPerPeriod = Math.round((parsedAllocatedPrice / numberOfPeriods) * 100) / 100;
        
        // Criar parcelas para TODO o período do contrato
        let currentDate = new Date(contractStartDate);
        let remainingAmount = parsedAllocatedPrice;
        
        for (let i = 0; i < numberOfPeriods; i++) {
          const billingDate = new Date(currentDate);
          const dueDate = new Date(currentDate);
          dueDate.setDate(dueDate.getDate() + 30); // 30 dias de prazo de pagamento
          
          // Validar datas antes de criar
          if (isNaN(billingDate.getTime()) || isNaN(dueDate.getTime())) {
            console.error(`Invalid dates for period ${i + 1}: billingDate=${billingDate}, dueDate=${dueDate}`);
            throw new Error(`Erro ao gerar billing schedule para período ${i + 1}. Datas inválidas.`);
          }
          
          const isLastPeriod = i === numberOfPeriods - 1;
          const amount = isLastPeriod ? remainingAmount : amountPerPeriod;
          
          // Garantir que amount é válido
          if (isNaN(amount) || amount <= 0) {
            console.error(`Invalid amount for period ${i + 1}: ${amount}`);
            throw new Error(`Erro ao calcular valor para período ${i + 1}. Valor inválido.`);
          }
          
          // Criar billing schedule para garantir que todos os períodos do contrato tenham billing
          await billingScheduleService.create(user.tenantId, {
            tenantId: user.tenantId,
            contractId: id,
            performanceObligationId: poId,
            billingDate: Timestamp.fromDate(billingDate),
            dueDate: Timestamp.fromDate(dueDate),
            amount,
            currency: contract.currency || "BRL",
            frequency: data.frequency as any,
            status: "scheduled",
            notes: `Auto-generated for PO: ${data.description.trim()} - Period ${i + 1}/${numberOfPeriods} (Contract: ${contractStartDate.toLocaleDateString()} - ${contractEndDate.toLocaleDateString()})`,
          });
          
          remainingAmount -= amountPerPeriod;
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + periodMonths, currentDate.getDate());
          
          // Validar próxima data
          if (isNaN(currentDate.getTime())) {
            console.error(`Invalid next date calculated: ${currentDate}`);
            break; // Parar se a próxima data for inválida
          }
        }
      }
      
      return poId;
    },
    onSuccess: () => {
      // Invalidar todos os caches relacionados
      queryClient.invalidateQueries({ queryKey: ["performance-obligations", user?.tenantId, id] });
      queryClient.invalidateQueries({ queryKey: ["contract", user?.tenantId, id] });
      queryClient.invalidateQueries({ queryKey: ["contracts", user?.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["billing-schedules", user?.tenantId, id] });
      queryClient.invalidateQueries({ queryKey: ["ledger-entries", user?.tenantId, id] });
      setPoDialogOpen(false);
      poForm.reset();
      toast({
        title: "Sucesso",
        description: "Obrigação de performance criada com sucesso. Billing schedules gerados automaticamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar obrigação de performance",
        variant: "destructive",
      });
    },
  });

  const handleCreatePO = (data: POFormValues) => {
    createPOMutation.mutate(data);
  };


  const formatCurrency = (amount: string | number | undefined | null, currency: string = "USD") => {
    // Tratar valores undefined, null ou vazios
    if (amount === undefined || amount === null || amount === "") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(0);
    }
    
    const numValue = typeof amount === "string" ? parseFloat(amount) : amount;
    
    // Verificar se o parse resultou em NaN
    if (isNaN(numValue)) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(0);
    }
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(numValue);
  };

  const formatDate = (value: unknown) => {
    if (!value) return "-";

    const toDate = (input: unknown): Date | null => {
      if (!input) return null;

      if (input instanceof Date) {
        return isNaN(input.getTime()) ? null : input;
      }

      if (typeof input === "string" || typeof input === "number") {
        const parsed = new Date(input);
        return isNaN(parsed.getTime()) ? null : parsed;
      }

      if (typeof input === "object" && typeof (input as any).toDate === "function") {
        const parsed = (input as any).toDate();
        return parsed instanceof Date && !isNaN(parsed.getTime()) ? parsed : null;
      }

      return null;
    };

    const date = toDate(value);
    if (!date) return "-";

    try {
      return format(date, "MMM dd, yyyy");
    } catch {
      return "-";
    }
  };

  if (contractLoading) {
    return (
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FileText weight="duotone" className="h-16 w-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">Contract not found</p>
          <Button variant="outline" onClick={() => setLocation("/contracts")} data-testid="button-back-contracts">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contracts
          </Button>
        </div>
      </div>
    );
  }

  const poColumns = [
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
      cell: (row: PerformanceObligationSummary) => formatCurrency(row.allocatedPrice, contract.currency),
    },
    {
      key: "percentComplete",
      header: "Progress",
      cell: (row: PerformanceObligationSummary) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full" 
              style={{ width: `${parseFloat(row.percentComplete)}%` }} 
            />
          </div>
          <span className="text-sm tabular-nums">{parseFloat(row.percentComplete).toFixed(0)}%</span>
        </div>
      ),
    },
    {
      key: "recognizedAmount",
      header: "Recognized",
      cell: (row: PerformanceObligationSummary) => formatCurrency(row.recognizedAmount, contract.currency),
    },
    {
      key: "isSatisfied",
      header: "Status",
      cell: (row: PerformanceObligationSummary) => (
        <Badge variant={row.isSatisfied ? "default" : "secondary"}>
          {row.isSatisfied ? "Satisfied" : "In Progress"}
        </Badge>
      ),
    },
  ];

  const billingColumns = [
    {
      key: "billingDate",
      header: "Billing Date",
      cell: (row: BillingScheduleWithDetails) => formatDate(row.billingDate),
    },
    {
      key: "dueDate",
      header: "Due Date",
      cell: (row: BillingScheduleWithDetails) => formatDate(row.dueDate),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row: BillingScheduleWithDetails) => formatCurrency(row.amount, row.currency),
    },
    {
      key: "frequency",
      header: "Frequency",
      cell: (row: BillingScheduleWithDetails) => (
        <Badge variant="outline" className="capitalize text-xs">
          {formatFrequency(row.frequency)}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: BillingScheduleWithDetails) => <StatusBadge status={row.status} />,
    },
    {
      key: "invoiceNumber",
      header: "Invoice #",
      cell: (row: BillingScheduleWithDetails) => row.invoiceNumber || "-",
    },
  ];

  const ledgerColumns = [
    {
      key: "entryDate",
      header: "Date",
      cell: (row: LedgerEntryWithDetails) => formatDate(row.entryDate),
    },
    {
      key: "entryType",
      header: "Type",
      cell: (row: LedgerEntryWithDetails) => (
        <Badge variant="outline" className="capitalize text-xs">
          {formatEntryType(row.entryType)}
        </Badge>
      ),
    },
    {
      key: "debitAccount",
      header: "Debit",
    },
    {
      key: "creditAccount",
      header: "Credit",
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row: LedgerEntryWithDetails) => formatCurrency(row.amount, row.currency),
    },
    {
      key: "isPosted",
      header: "Posted",
      cell: (row: LedgerEntryWithDetails) => (
        <Badge variant={row.isPosted ? "default" : "secondary"}>
          {row.isPosted ? "Posted" : "Pending"}
        </Badge>
      ),
    },
  ];

  const recognitionProgress = (() => {
    if (!contract) return 0;
    
    const totalValue = parseFloat(contract.totalValue || "0");
    const recognizedRevenue = parseFloat(contract.recognizedRevenue || "0");
    
    if (totalValue === 0 || isNaN(totalValue) || isNaN(recognizedRevenue)) {
      return 0;
    }
    
    return (recognizedRevenue / totalValue) * 100;
  })();

  const normalizeFrequency = (value?: string | null) => {
    switch (value) {
      case "monthly":
      case "quarterly":
      case "one_time":
        return value;
      case "semi_annual":
      case "semi_annually":
        return "semi_annual";
      case "annual":
      case "annually":
        return "annual";
      default:
        return "";
    }
  };

  const formatFrequency = (value?: string | null) => {
    const normalized = normalizeFrequency(value);
    if (!normalized) return "N/A";
    return normalized.replace(/_/g, " ");
  };

  const formatEntryType = (value?: string | null) => {
    if (!value) return "N/A";
    return value.replace(/_/g, " ");
  };

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/contracts")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                <FileText weight="fill" className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight" data-testid="text-contract-number">
                    {contract.contractNumber}
                  </h1>
                  <StatusBadge status={contract.status} />
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-contract-title">
                  {contract.title}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-premium border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/10">
                <CurrencyDollar weight="duotone" className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold tabular-nums" data-testid="text-total-value">
                {formatCurrency(contract?.totalValue || "0", contract?.currency || "BRL")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Total Contract Value</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                <TrendUp weight="duotone" className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold tabular-nums" data-testid="text-recognized">
                {formatCurrency(contract?.recognizedRevenue || "0", contract?.currency || "BRL")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Recognized Revenue</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all" 
                    style={{ width: `${Math.min(recognitionProgress, 100)}%` }} 
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {recognitionProgress.toFixed(0)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                <ClockCounterClockwise weight="duotone" className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold tabular-nums" data-testid="text-deferred">
                {formatCurrency(contract?.deferredRevenue || "0", contract?.currency || "BRL")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Deferred Revenue</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10">
                <Calendar weight="duotone" className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold" data-testid="text-dates">
                {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Contract Period</p>
              <p className="text-xs text-muted-foreground mt-2">
                Customer: <span className="font-medium">{contract.customerName}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="obligations" className="w-full">
        <TabsList className="w-auto">
          <TabsTrigger value="obligations" data-testid="tab-obligations" className="gap-2">
            <Target className="h-4 w-4" />
            Obligations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="obligations" className="mt-6">
          <Card className="card-premium border-0">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10">
                  <Target weight="duotone" className="h-4 w-4 text-purple-500" />
                </div>
                <CardTitle className="text-base font-semibold">Performance Obligations</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {performanceObligations?.length ?? 0} obligations
                </Badge>
                <Dialog open={poDialogOpen} onOpenChange={setPoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      data-testid="button-add-po"
                      disabled={!currentVersionId || !contract}
                      title={!currentVersionId ? "Crie uma versão do contrato antes de adicionar obrigações de performance" : !contract ? "Carregando dados do contrato..." : ""}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle data-testid="text-dialog-title">Add Performance Obligation</DialogTitle>
                      <DialogDescription>
                        Adicione uma nova obrigação de performance ao contrato. Certifique-se de que o contrato possui uma versão criada.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...poForm}>
                      <form onSubmit={poForm.handleSubmit(handleCreatePO)} className="grid gap-4 py-4">
                        <FormField
                          control={poForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-po-description"
                                  placeholder="e.g., Software License, Implementation Services"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={poForm.control}
                          name="allocatedPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Allocated Price</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-po-price"
                                  type="number"
                                  placeholder="0.00"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={poForm.control}
                          name="recognitionMethod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Recognition Method</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-recognition-method">
                                    <SelectValue placeholder="Select method" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="over_time">Over Time</SelectItem>
                                  <SelectItem value="point_in_time">Point in Time</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {poForm.watch("recognitionMethod") === "over_time" && (
                          <>
                            <FormField
                              control={poForm.control}
                              name="measurementMethod"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Measurement Method</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-measurement-method">
                                        <SelectValue placeholder="Select measurement" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="input">Input Method</SelectItem>
                                      <SelectItem value="output">Output Method</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={poForm.control}
                              name="startDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Start Date *</FormLabel>
                                  <FormControl>
                                    <Input
                                      data-testid="input-po-start-date"
                                      type="date"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={poForm.control}
                              name="endDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>End Date *</FormLabel>
                                  <FormControl>
                                    <Input
                                      data-testid="input-po-end-date"
                                      type="date"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={poForm.control}
                              name="frequency"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Frequency *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-po-frequency">
                                        <SelectValue placeholder="Select frequency" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="monthly">Monthly</SelectItem>
                                      <SelectItem value="quarterly">Quarterly</SelectItem>
                                      <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                                      <SelectItem value="annual">Annual</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        )}
                        {poForm.watch("recognitionMethod") === "point_in_time" && (
                          <FormField
                            control={poForm.control}
                            name="dueDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Due Date *</FormLabel>
                                <FormControl>
                                  <Input
                                    data-testid="input-po-due-date"
                                    type="date"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <FormField
                          control={poForm.control}
                          name="percentComplete"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Percent Complete (%)</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-po-percent"
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="0"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setPoDialogOpen(false)} data-testid="button-cancel-po">
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createPOMutation.isPending} data-testid="button-save-po">
                            {createPOMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {poLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !currentVersionId ? (
                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <Target weight="duotone" className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium">Nenhuma versão do contrato encontrada</p>
                  <p className="text-xs text-muted-foreground text-center max-w-md">
                    Uma versão inicial será criada automaticamente quando você adicionar a primeira obrigação de performance
                  </p>
                </div>
              ) : performanceObligations && performanceObligations.length > 0 ? (
                <DataTable columns={poColumns} data={performanceObligations} />
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Target weight="duotone" className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm">No performance obligations found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
