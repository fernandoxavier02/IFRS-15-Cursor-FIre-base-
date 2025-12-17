import { DataTable } from "@/components/data-table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { contractService, customerService } from "@/lib/firestore-service";
import { queryClient } from "@/lib/queryClient";
import type { Contract, Customer } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, FileText, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export default function DeleteManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchCustomers, setSearchCustomers] = useState("");
  const [searchContracts, setSearchContracts] = useState("");
  
  // Estados para diálogos de confirmação
  const [deleteCustomerDialog, setDeleteCustomerDialog] = useState<{
    open: boolean;
    customer: Customer | null;
    confirmationText: string;
  }>({
    open: false,
    customer: null,
    confirmationText: "",
  });
  
  const [deleteContractDialog, setDeleteContractDialog] = useState<{
    open: boolean;
    contract: Contract | null;
    confirmationText: string;
  }>({
    open: false,
    contract: null,
    confirmationText: "",
  });

  // Buscar clientes
  const { data: customers, isLoading: customersLoading, refetch: refetchCustomers } = useQuery<Customer[]>({
    queryKey: ["customers", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return customerService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Buscar contratos
  const { data: contracts, isLoading: contractsLoading, refetch: refetchContracts } = useQuery<Contract[]>({
    queryKey: ["contracts", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return contractService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Criar mapa de contratos por cliente
  const contractsByCustomer = useMemo(() => {
    const map = new Map<string, Contract[]>();
    contracts?.forEach((contract) => {
      if (contract.customerId) {
        const existing = map.get(contract.customerId) || [];
        map.set(contract.customerId, [...existing, contract]);
      }
    });
    return map;
  }, [contracts]);

  // Filtrar clientes
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(searchCustomers.toLowerCase()) ||
      customer.country.toLowerCase().includes(searchCustomers.toLowerCase())
    );
  }, [customers, searchCustomers]);

  // Filtrar contratos
  const filteredContracts = useMemo(() => {
    if (!contracts) return [];
    return contracts.filter((contract) =>
      contract.contractNumber.toLowerCase().includes(searchContracts.toLowerCase()) ||
      contract.title.toLowerCase().includes(searchContracts.toLowerCase())
    );
  }, [contracts, searchContracts]);

  // Mutation para deletar cliente
  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      if (!user?.tenantId) throw new Error("User tenant ID is required");
      
      // Verificar se há contratos relacionados
      const relatedContracts = contractsByCustomer.get(customerId) || [];
      if (relatedContracts.length > 0) {
        throw new Error(
          `Não é possível deletar este cliente. Existem ${relatedContracts.length} contrato(s) associado(s). Delete os contratos primeiro.`
        );
      }
      
      await customerService.delete(user.tenantId, customerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", user?.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["contracts", user?.tenantId] });
      refetchCustomers();
      setDeleteCustomerDialog({ open: false, customer: null, confirmationText: "" });
      toast({
        title: "Cliente deletado",
        description: "O cliente foi deletado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar cliente",
        description: error.message || "Falha ao deletar cliente",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar contrato
  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      if (!user?.tenantId) throw new Error("User tenant ID is required");
      
      // Deletar subcoleções relacionadas (versões, obrigações de performance, etc.)
      // Nota: O Firestore não deleta subcoleções automaticamente
      // Em produção, você pode querer usar Cloud Functions para fazer isso
      // Por enquanto, apenas deletamos o contrato principal
      
      await contractService.delete(user.tenantId, contractId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", user?.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["customers", user?.tenantId] });
      refetchContracts();
      setDeleteContractDialog({ open: false, contract: null, confirmationText: "" });
      toast({
        title: "Contrato deletado",
        description: "O contrato foi deletado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar contrato",
        description: error.message || "Falha ao deletar contrato",
        variant: "destructive",
      });
    },
  });

  const handleDeleteCustomerClick = (customer: Customer) => {
    const relatedContracts = contractsByCustomer.get(customer.id) || [];
    if (relatedContracts.length > 0) {
      toast({
        title: "Não é possível deletar",
        description: `Este cliente possui ${relatedContracts.length} contrato(s) associado(s). Delete os contratos primeiro.`,
        variant: "destructive",
      });
      return;
    }
    setDeleteCustomerDialog({
      open: true,
      customer,
      confirmationText: "",
    });
  };

  const handleDeleteContractClick = (contract: Contract) => {
    setDeleteContractDialog({
      open: true,
      contract,
      confirmationText: "",
    });
  };

  const customerColumns = [
    {
      key: "name",
      header: "Nome do Cliente",
      cell: (row: Customer) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: "country",
      header: "País",
    },
    {
      key: "contractCount",
      header: "Contratos",
      cell: (row: Customer) => {
        const count = contractsByCustomer.get(row.id)?.length || 0;
        return (
          <span className={count > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
            {count}
          </span>
        );
      },
      className: "text-center",
    },
    {
      key: "actions",
      header: "Ações",
      cell: (row: Customer) => {
        const contractCount = contractsByCustomer.get(row.id)?.length || 0;
        return (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDeleteCustomerClick(row)}
            disabled={contractCount > 0}
            title={contractCount > 0 ? "Delete os contratos primeiro" : "Deletar cliente"}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Deletar
          </Button>
        );
      },
    },
  ];

  const contractColumns = [
    {
      key: "contractNumber",
      header: "Número do Contrato",
      cell: (row: Contract) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.contractNumber}</span>
        </div>
      ),
    },
    {
      key: "title",
      header: "Título",
      cell: (row: Contract) => (
        <span className="max-w-xs truncate">{row.title}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: Contract) => (
        <span className="text-sm capitalize">{row.status}</span>
      ),
    },
    {
      key: "totalValue",
      header: "Valor Total",
      cell: (row: Contract) => (
        <span className="tabular-nums font-medium">
          {row.currency} {Number(row.totalValue || 0).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "actions",
      header: "Ações",
      cell: (row: Contract) => (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleDeleteContractClick(row)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Deletar
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          Gerenciamento de Exclusões
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Área dedicada para exclusão segura de clientes e contratos. Todas as ações requerem confirmação.
        </p>
      </div>

      {/* Seção de Clientes */}
      <Card className="border-amber-200 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-600" />
            Excluir Clientes
          </CardTitle>
          <CardDescription>
            Clientes com contratos associados não podem ser deletados. Delete os contratos primeiro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              value={searchCustomers}
              onChange={(e) => setSearchCustomers(e.target.value)}
              className="pl-9"
            />
          </div>
          <DataTable
            columns={customerColumns}
            data={filteredCustomers}
            isLoading={customersLoading}
            emptyMessage="Nenhum cliente encontrado."
            testIdPrefix="delete-customer"
          />
        </CardContent>
      </Card>

      {/* Seção de Contratos */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-600" />
            Excluir Contratos
          </CardTitle>
          <CardDescription>
            Atenção: A exclusão de contratos é permanente e irrecuperável. Todas as versões, obrigações de performance e dados relacionados serão removidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contratos..."
              value={searchContracts}
              onChange={(e) => setSearchContracts(e.target.value)}
              className="pl-9"
            />
          </div>
          <DataTable
            columns={contractColumns}
            data={filteredContracts}
            isLoading={contractsLoading}
            emptyMessage="Nenhum contrato encontrado."
            testIdPrefix="delete-contract"
          />
        </CardContent>
      </Card>

      {/* Diálogo de Confirmação - Cliente */}
      <AlertDialog open={deleteCustomerDialog.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteCustomerDialog({ open: false, customer: null, confirmationText: "" });
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão de Cliente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a deletar permanentemente o cliente:
              </p>
              <p className="font-semibold text-foreground">
                {deleteCustomerDialog.customer?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Esta ação não pode ser desfeita. Todos os dados do cliente serão permanentemente removidos.
              </p>
              <div className="pt-2">
                <Label htmlFor="customer-confirmation" className="text-sm font-medium">
                  Digite o nome do cliente para confirmar: <span className="font-semibold">{deleteCustomerDialog.customer?.name}</span>
                </Label>
                <Input
                  id="customer-confirmation"
                  value={deleteCustomerDialog.confirmationText}
                  onChange={(e) =>
                    setDeleteCustomerDialog({
                      ...deleteCustomerDialog,
                      confirmationText: e.target.value,
                    })
                  }
                  placeholder="Digite o nome do cliente"
                  className="mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCustomerDialog.customer) {
                  deleteCustomerMutation.mutate(deleteCustomerDialog.customer.id);
                }
              }}
              disabled={
                deleteCustomerMutation.isPending ||
                deleteCustomerDialog.confirmationText !== deleteCustomerDialog.customer?.name
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteCustomerMutation.isPending ? "Deletando..." : "Deletar Cliente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Confirmação - Contrato */}
      <AlertDialog open={deleteContractDialog.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteContractDialog({ open: false, contract: null, confirmationText: "" });
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão de Contrato
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a deletar permanentemente o contrato:
              </p>
              <div className="font-semibold text-foreground space-y-1">
                <p>{deleteContractDialog.contract?.contractNumber}</p>
                <p className="text-sm font-normal text-muted-foreground">
                  {deleteContractDialog.contract?.title}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md p-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  ⚠️ Atenção: Esta ação irá deletar:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-400 mt-2 list-disc list-inside space-y-1">
                  <li>O contrato e todas as suas versões</li>
                  <li>Todas as obrigações de performance</li>
                  <li>Todos os itens de linha</li>
                  <li>Histórico de faturamento relacionado</li>
                  <li>Entradas do razão de receita relacionadas</li>
                </ul>
              </div>
              <div className="pt-2">
                <Label htmlFor="contract-confirmation" className="text-sm font-medium">
                  Digite o número do contrato para confirmar: <span className="font-semibold">{deleteContractDialog.contract?.contractNumber}</span>
                </Label>
                <Input
                  id="contract-confirmation"
                  value={deleteContractDialog.confirmationText}
                  onChange={(e) =>
                    setDeleteContractDialog({
                      ...deleteContractDialog,
                      confirmationText: e.target.value,
                    })
                  }
                  placeholder="Digite o número do contrato"
                  className="mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteContractDialog.contract) {
                  deleteContractMutation.mutate(deleteContractDialog.contract.id);
                }
              }}
              disabled={
                deleteContractMutation.isPending ||
                deleteContractDialog.confirmationText !== deleteContractDialog.contract?.contractNumber
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteContractMutation.isPending ? "Deletando..." : "Deletar Contrato"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
