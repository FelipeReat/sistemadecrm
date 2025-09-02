import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  User, 
  Settings2, 
  Bell, 
  Database, 
  Shield, 
  Palette,
  Download,
  Upload,
  Trash2,
  LogOut
} from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get current user data
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
  });
  
  // Profile settings state
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    bio: ""
  });

  // Load current user data when modal opens
  useEffect(() => {
    if (currentUser) {
      setProfileData({
        name: currentUser.name || "",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        role: currentUser.role || "",
        bio: currentUser.bio || ""
      });
    }
  }, [currentUser]);

  // System settings state
  const [systemSettings, setSystemSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    darkMode: false,
    autoSave: true,
    language: "pt-BR"
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: typeof profileData) => 
      fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive"
      });
    }
  });

  // Update system settings mutation
  const updateSystemSettingsMutation = useMutation({
    mutationFn: (data: typeof systemSettings) => 
      fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: "Configurações atualizadas",
        description: "Suas preferências foram salvas."
      });
    }
  });

  // Export data mutation
  const exportDataMutation = useMutation({
    mutationFn: () => fetch("/api/export/opportunities").then(res => res.json()),
    onSuccess: (data) => {
      // Create download link
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Dados exportados",
        description: "O arquivo foi baixado com sucesso."
      });
    }
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleSaveSystemSettings = () => {
    updateSystemSettingsMutation.mutate(systemSettings);
  };

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST" })
      .then(() => {
        queryClient.clear();
        window.location.reload();
      })
      .catch(() => {
        toast({
          title: "Erro",
          description: "Não foi possível fazer logout.",
          variant: "destructive"
        });
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="modal-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurações do Sistema
          </DialogTitle>
          <DialogDescription>
            Gerencie suas preferências e configurações do sistema
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" data-testid="tab-profile">
              <User className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="data" data-testid="tab-data">
              <Database className="h-4 w-4 mr-2" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">
              <Shield className="h-4 w-4 mr-2" />
              Sistema
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Perfil</CardTitle>
                <CardDescription>
                  Atualize suas informações pessoais e profissionais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Seu nome completo"
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="seu@email.com"
                      data-testid="input-email"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                      data-testid="input-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Cargo</Label>
                    <Select value={profileData.role} onValueChange={(value) => setProfileData(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger data-testid="select-role">
                        <SelectValue placeholder="Selecione seu cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="gerente">Gerente de Vendas</SelectItem>
                        <SelectItem value="diretor">Diretor Comercial</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio/Descrição</Label>
                  <Textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Conte um pouco sobre você..."
                    rows={3}
                    data-testid="textarea-bio"
                  />
                </div>

                <Button 
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending ? "Salvando..." : "Salvar Perfil"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Configure quando e como você quer receber notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="email-notifications">Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba emails sobre novas oportunidades e atualizações
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={systemSettings.emailNotifications}
                    onCheckedChange={(checked) => 
                      setSystemSettings(prev => ({ ...prev, emailNotifications: checked }))
                    }
                    data-testid="switch-email-notifications"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="push-notifications">Notificações Push</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações instantâneas no navegador
                    </p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={systemSettings.pushNotifications}
                    onCheckedChange={(checked) => 
                      setSystemSettings(prev => ({ ...prev, pushNotifications: checked }))
                    }
                    data-testid="switch-push-notifications"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="auto-save">Salvamento Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Salve automaticamente as alterações nos formulários
                    </p>
                  </div>
                  <Switch
                    id="auto-save"
                    checked={systemSettings.autoSave}
                    onCheckedChange={(checked) => 
                      setSystemSettings(prev => ({ ...prev, autoSave: checked }))
                    }
                    data-testid="switch-auto-save"
                  />
                </div>

                <Button 
                  onClick={handleSaveSystemSettings}
                  disabled={updateSystemSettingsMutation.isPending}
                  data-testid="button-save-notifications"
                >
                  {updateSystemSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Dados</CardTitle>
                <CardDescription>
                  Exporte, importe ou limpe seus dados do CRM
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Exportar Dados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Baixe todas as suas oportunidades em formato JSON
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => exportDataMutation.mutate()}
                        disabled={exportDataMutation.isPending}
                        data-testid="button-export-data"
                      >
                        {exportDataMutation.isPending ? "Exportando..." : "Exportar Dados"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Importar Dados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Importe oportunidades de um arquivo JSON
                      </p>
                      <Button variant="outline" disabled data-testid="button-import-data">
                        Em Breve
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <h4 className="font-medium text-destructive">Zona de Perigo</h4>
                  </div>
                  <Card className="border-destructive/20">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <h5 className="font-medium">Limpar todos os dados</h5>
                        <p className="text-sm text-muted-foreground">
                          Esta ação irá remover permanentemente todas as oportunidades. Esta ação não pode ser desfeita.
                        </p>
                        <Button variant="destructive" size="sm" disabled data-testid="button-clear-data">
                          Limpar Dados
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
                <CardDescription>
                  Configurações gerais do aplicativo e conta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Idioma</Label>
                    <Select value={systemSettings.language} onValueChange={(value) => setSystemSettings(prev => ({ ...prev, language: value }))}>
                      <SelectTrigger data-testid="select-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="es-ES">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="dark-mode">Modo Escuro</Label>
                      <p className="text-sm text-muted-foreground">
                        Ative o tema escuro do sistema
                      </p>
                    </div>
                    <Switch
                      id="dark-mode"
                      checked={systemSettings.darkMode}
                      onCheckedChange={(checked) => 
                        setSystemSettings(prev => ({ ...prev, darkMode: checked }))
                      }
                      data-testid="switch-dark-mode"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Informações do Sistema</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Versão:</span>
                      <Badge variant="secondary" className="ml-2">v1.0.0</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Última Atualização:</span>
                      <span className="ml-2">26/08/2025</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Sessão
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Encerre sua sessão atual e retorne à tela de login
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={handleLogout}
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Fazer Logout
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}