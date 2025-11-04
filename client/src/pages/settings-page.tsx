import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings, User, Bell, Shield, Database, Building2, History, FileText, Monitor, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { CompanySettingsForm } from '@/components/settings/company-settings-form';
import { ProfilePhotoUpload } from '@/components/settings/profile-photo-upload';
import { PasswordChangeForm } from '@/components/settings/password-change-form';
import { EmailTemplateEditor } from '@/components/settings/email-template-editor';
import { LoginHistoryTable } from '@/components/settings/login-history-table';
import { SystemLogsViewer } from '@/components/settings/system-logs-viewer';
import NotificationPreferences from '@/components/settings/notification-preferences';
import ClearCardsModal from '@/components/clear-cards-modal';
import { useClearCards } from '@/hooks/use-clear-cards';

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [currentUser, setCurrentUser] = useState({
    id: '',
    name: 'Usuário',
    email: '',
    photoUrl: '',
    role: ''
  });
  const [showClearCardsModal, setShowClearCardsModal] = useState(false);
  
  // Hook para gerenciar limpeza de cards
  const { 
    cardsCount, 
    isCountLoading, 
    clearCards, 
    isClearingCards,
    createBackup,
    isCreatingBackup
  } = useClearCards();

  // Funções para gerenciar limpeza de cards
  const handleClearCards = async () => {
    try {
      await clearCards();
      setShowClearCardsModal(false);
    } catch (error) {
      console.error('Erro ao limpar cards:', error);
    }
  };

  const handleCreateBackup = async () => {
    try {
      await createBackup();
    } catch (error) {
      console.error('Erro ao criar backup:', error);
    }
  };

  // Definir abas disponíveis para cada tipo de usuário
  const getAllowedTabs = (userRole: string) => {
    const allTabs = [
      { value: 'company', label: 'Empresa', icon: Building2 },
      { value: 'profile', label: 'Perfil', icon: User },
      { value: 'security', label: 'Segurança', icon: Shield },
      { value: 'notifications', label: 'Notificações', icon: Bell },
      { value: 'system', label: 'Sistema', icon: Database },
      { value: 'email', label: 'Email', icon: FileText },
      { value: 'history', label: 'Histórico', icon: History },
      { value: 'logs', label: 'Logs', icon: FileText }
    ];

    // Para usuários com função "usuario", mostrar apenas perfil, segurança e notificações
    if (userRole === 'usuario') {
      return allTabs.filter(tab => 
        ['profile', 'security', 'notifications'].includes(tab.value)
      );
    }

    // Para admin e gerente, mostrar todas as abas
    return allTabs;
  };

  // Obter o valor padrão da aba baseado na função do usuário
  const getDefaultTabValue = (userRole: string) => {
    if (userRole === 'usuario') {
      return 'profile'; // Primeira aba disponível para usuários
    }
    return 'company'; // Primeira aba para admin/gerente
  };

  useEffect(() => {
    // Carregar dados do usuário atual
    const loadUserData = async () => {
      try {
        console.log('🔍 Carregando dados do usuário...');
        const response = await fetch('/api/user/profile', {
          credentials: 'include'
        });
        if (response.ok) {
          const userData = await response.json();
          console.log('✅ Dados do usuário carregados:', userData);
          setCurrentUser(userData);
        } else {
          console.error('❌ Erro ao carregar usuário:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
      }
    };

    loadUserData();
  }, []);

  const allowedTabs = getAllowedTabs(currentUser.role);
  const defaultTabValue = getDefaultTabValue(currentUser.role);

  // Debug logs
  console.log('🔍 Estado atual:', {
    currentUser,
    allowedTabs: allowedTabs.map(t => t.value),
    defaultTabValue,
    hasSystemTab: allowedTabs.some(tab => tab.value === 'system')
  });

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/dashboard')}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <div className="flex items-center">
              <Settings className="h-6 w-6 mr-2 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">
                Configurações do Sistema
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue={defaultTabValue} className="space-y-6">
          <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
            {allowedTabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center space-x-2 flex-shrink-0 min-w-fit px-4">
                  <IconComponent className="h-4 w-4" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Configurações da Empresa - apenas para admin/gerente */}
          {allowedTabs.some(tab => tab.value === 'company') && (
            <TabsContent value="company" className="space-y-6">
              <CompanySettingsForm />
            </TabsContent>
          )}

          {/* Configurações de Perfil - disponível para todos */}
          {allowedTabs.some(tab => tab.value === 'profile') && (
            <TabsContent value="profile" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload de Foto */}
                <ProfilePhotoUpload
                  currentPhotoUrl={currentUser.photoUrl}
                  userName={currentUser.name}
                  onPhotoUpdate={(newPhotoUrl) => 
                    setCurrentUser(prev => ({ ...prev, photoUrl: newPhotoUrl }))
                  }
                />

                {/* Informações do Perfil */}
                <Card>
                  <CardHeader>
                    <CardTitle>Informações Pessoais</CardTitle>
                    <CardDescription>
                      Atualize suas informações pessoais
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Nome</Label>
                        <Input 
                          id="firstName" 
                          placeholder="Seu nome"
                          defaultValue={currentUser.name.split(' ')[0] || ''}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Sobrenome</Label>
                        <Input 
                          id="lastName" 
                          placeholder="Seu sobrenome"
                          defaultValue={currentUser.name.split(' ').slice(1).join(' ') || ''}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="seu@email.com"
                        defaultValue={currentUser.email}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" placeholder="(11) 99999-9999" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Cargo</Label>
                      <Select defaultValue="vendedor">
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione seu cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="gerente">Gerente</SelectItem>
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full">
                      Salvar Alterações
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Configurações de Notificações - disponível para todos */}
          {allowedTabs.some(tab => tab.value === 'notifications') && (
            <TabsContent value="notifications" className="space-y-6">
              <NotificationPreferences userId={currentUser.id} />
            </TabsContent>
          )}

          {/* Configurações de Segurança - disponível para todos */}
          {allowedTabs.some(tab => tab.value === 'security') && (
            <TabsContent value="security" className="space-y-6">
              <PasswordChangeForm />
            </TabsContent>
          )}

          {/* Configurações do Sistema - apenas para admin/gerente */}
          {allowedTabs.some(tab => tab.value === 'system') && (
            <TabsContent value="system" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gerenciamento de Dados */}
                <Card>
                  <CardHeader>
                    <CardTitle>Gerenciamento de Dados</CardTitle>
                    <CardDescription>
                      Operações de backup e limpeza do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Cards no Kanban</p>
                          <p className="text-xs text-muted-foreground">
                            {isCountLoading ? 'Carregando...' : `${cardsCount} cards ativos`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCreateBackup}
                            disabled={isCreatingBackup || cardsCount === 0}
                          >
                            {isCreatingBackup ? 'Criando...' : 'Backup'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowClearCardsModal(true)}
                            disabled={isClearingCards || cardsCount === 0}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            {isClearingCards ? 'Limpando...' : 'Limpar Todos'}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded p-2">
                        <strong>Atenção:</strong> A limpeza de cards criará um backup automático antes da exclusão.
                        Esta operação não pode ser desfeita através da interface.
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Configurações Gerais do Sistema */}
                <Card>
                  <CardHeader>
                    <CardTitle>Configurações Gerais</CardTitle>
                    <CardDescription>
                      Preferências básicas do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Modo Escuro</Label>
                        <p className="text-sm text-muted-foreground">
                          Ativar tema escuro para toda a aplicação
                        </p>
                      </div>
                      <Switch
                        checked={darkMode}
                        onCheckedChange={setDarkMode}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Salvamento Automático</Label>
                        <p className="text-sm text-muted-foreground">
                          Salvar automaticamente as alterações
                        </p>
                      </div>
                      <Switch
                        checked={autoSave}
                        onCheckedChange={setAutoSave}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language">Idioma</Label>
                      <Select defaultValue="pt-br">
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o idioma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt-br">Português (Brasil)</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sessionTimeout">Timeout de Sessão (minutos)</Label>
                      <Input id="sessionTimeout" type="number" defaultValue="30" />
                    </div>
                  </CardContent>
                </Card>

                {/* Configurações Avançadas */}
                <Card>
                  <CardHeader>
                    <CardTitle>Configurações Avançadas</CardTitle>
                    <CardDescription>
                      Configurações técnicas do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Logs de Auditoria</Label>
                        <p className="text-sm text-muted-foreground">
                          Manter logs detalhados de atividades
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Notificações em Tempo Real</Label>
                        <p className="text-sm text-muted-foreground">
                          Ativar notificações WebSocket
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxFileSize">Tamanho Máximo de Arquivo (MB)</Label>
                      <Input id="maxFileSize" type="number" defaultValue="10" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cacheTimeout">Cache Timeout (minutos)</Label>
                      <Input id="cacheTimeout" type="number" defaultValue="60" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Configurações de Email - apenas para admin/gerente */}
          {allowedTabs.some(tab => tab.value === 'email') && (
            <TabsContent value="email" className="space-y-6">
              <EmailTemplateEditor />
            </TabsContent>
          )}

          {/* Histórico de Login - apenas para admin/gerente */}
          {allowedTabs.some(tab => tab.value === 'history') && (
            <TabsContent value="history" className="space-y-6">
              <LoginHistoryTable />
            </TabsContent>
          )}

          {/* Logs do Sistema - apenas para admin/gerente */}
          {allowedTabs.some(tab => tab.value === 'logs') && (
            <TabsContent value="logs" className="space-y-6">
              <SystemLogsViewer />
            </TabsContent>
          )}
        </Tabs>

        {/* Modal de Confirmação para Limpeza de Cards */}
        <ClearCardsModal
          open={showClearCardsModal}
          onOpenChange={setShowClearCardsModal}
          onConfirm={handleClearCards}
          isLoading={isClearingCards}
          cardsCount={cardsCount}
        />

      </main>
    </div>
  );
}