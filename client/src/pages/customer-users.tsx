import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { functions } from "@/lib/firebase";
import {
    ArrowLeft,
    CheckCircle,
    User,
    UserPlus,
    Users,
    X,
    XCircle
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { useState } from "react";
import { useLocation } from "wouter";

interface TenantUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: any;
}

interface TenantInfo {
  id: string;
  name: string;
  maxLicenses: number;
  currentLicenses: number;
  availableLicenses: number;
  subscriptionStatus: string;
  status: string;
}

export default function CustomerUsers() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");

  // Fetch tenant users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["tenant-users", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      const getTenantUsers = httpsCallable(functions, "getTenantUsers");
      const result = await getTenantUsers({});
      return result.data as { users: TenantUser[]; tenant: TenantInfo };
    },
    enabled: !!user?.tenantId && (user?.role === "admin" || user?.email === "fernandocostaxavier@gmail.com"),
  });

  const users = usersData?.users || [];
  const tenant = usersData?.tenant;

  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: async () => {
      const addTenantUser = httpsCallable(functions, "addTenantUser");
      const result = await addTenantUser({
        email: newUserEmail,
        fullName: newUserFullName,
      });
      return result.data as { success: boolean; userId: string; message: string };
    },
    onSuccess: () => {
      toast({
        title: "Usuário adicionado!",
        description: "O usuário foi adicionado com sucesso. As credenciais foram enviadas por email.",
        variant: "default",
      });
      setIsAddUserDialogOpen(false);
      setNewUserEmail("");
      setNewUserFullName("");
      queryClient.invalidateQueries({ queryKey: ["tenant-users", user?.tenantId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar usuário",
        description: error.message || "Não foi possível adicionar o usuário. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Add seats mutation
  const addSeatsMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const addSeats = httpsCallable(functions, "addSeatsToSubscription");
      const result = await addSeats({ quantity });
      return result.data as { success: boolean; newMaxLicenses: number; message: string };
    },
    onSuccess: (data) => {
      toast({
        title: "Assentos adicionados!",
        description: data.message,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["tenant-users", user?.tenantId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar assentos",
        description: error.message || "Não foi possível adicionar assentos.",
        variant: "destructive",
      });
    },
  });

  const handleAddUser = () => {
    if (!newUserEmail || !newUserFullName) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha email e nome completo.",
        variant: "destructive",
      });
      return;
    }

    // Check if we have available licenses
    if (tenant && tenant.availableLicenses !== -1 && tenant.availableLicenses <= 0) {
      toast({
        title: "Sem assentos disponíveis",
        description: `Você atingiu o limite de ${tenant.maxLicenses} usuários. Adicione mais assentos primeiro.`,
        variant: "destructive",
      });
      return;
    }

    addUserMutation.mutate();
  };

  const needsMoreSeats = tenant && tenant.availableLicenses !== -1 && tenant.availableLicenses <= 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/customer-area")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                <Users weight="fill" className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                Gerenciar Usuários
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* License Summary Card */}
          {tenant && (
            <Card className="mb-6 border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users weight="fill" className="h-5 w-5 text-emerald-500" />
                  Informações de Licenças
                </CardTitle>
                <CardDescription>
                  Controle de usuários e assentos disponíveis para {tenant.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">Usuários Ativos</p>
                    <p className="text-2xl font-bold">{tenant.currentLicenses}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">Limite de Licenças</p>
                    <p className="text-2xl font-bold">
                      {tenant.maxLicenses === -1 ? "Ilimitado" : tenant.maxLicenses}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">Disponíveis</p>
                    <p className={`text-2xl font-bold ${needsMoreSeats ? "text-amber-500" : "text-emerald-500"}`}>
                      {tenant.availableLicenses === -1 ? "Ilimitado" : tenant.availableLicenses}
                    </p>
                  </div>
                </div>

                {needsMoreSeats && (
                  <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-3">
                      <XCircle weight="fill" className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                          Limite de usuários atingido
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                          Você precisa adicionar mais assentos à sua assinatura antes de adicionar novos usuários.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => addSeatsMutation.mutate(1)}
                          disabled={addSeatsMutation.isPending}
                        >
                          {addSeatsMutation.isPending ? "Processando..." : "Adicionar 1 Assento"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Add User Button */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Usuários da Empresa</h2>
              <p className="text-muted-foreground">
                Gerencie os usuários que têm acesso ao sistema da sua empresa
              </p>
            </div>
            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  disabled={needsMoreSeats}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                >
                  <UserPlus weight="bold" className="h-4 w-4" />
                  Adicionar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Adicione um novo usuário à sua empresa. As credenciais serão enviadas por email.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@empresa.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo *</Label>
                    <Input
                      id="fullName"
                      placeholder="João Silva"
                      value={newUserFullName}
                      onChange={(e) => setNewUserFullName(e.target.value)}
                    />
                  </div>
                  {tenant && tenant.availableLicenses !== -1 && (
                    <div className="p-3 rounded-lg bg-muted text-sm">
                      <p className="font-medium">Assentos disponíveis: {tenant.availableLicenses}</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAddUser}
                    disabled={addUserMutation.isPending || !newUserEmail || !newUserFullName}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                  >
                    {addUserMutation.isPending ? "Adicionando..." : "Adicionar Usuário"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Users List */}
          <div className="grid gap-4">
            {users.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                </CardContent>
              </Card>
            ) : (
              users.map((userItem) => (
                <Card key={userItem.id} className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600">
                          <User weight="fill" className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{userItem.fullName}</p>
                          <p className="text-sm text-muted-foreground">{userItem.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">
                              {userItem.role === "admin" ? "Administrador" : "Usuário"}
                            </Badge>
                            {userItem.isActive ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                <CheckCircle weight="fill" className="h-3 w-3 mr-1" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                <X weight="fill" className="h-3 w-3 mr-1" />
                                Inativo
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {userItem.id === user?.uid && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                          Você
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
