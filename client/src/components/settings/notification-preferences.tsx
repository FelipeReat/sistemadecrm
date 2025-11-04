import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, Smartphone, BellRing, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  autoBackup: boolean;
  language: string;
  timezone: string;
}

interface NotificationPreferencesProps {
  userId: string;
}

export default function NotificationPreferences({ userId }: NotificationPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current notification settings
  const { data: settings, isLoading, error } = useQuery<NotificationSettings>({
    queryKey: ['/api/user/settings'],
    queryFn: async () => {
      const response = await fetch('/api/user/settings');
      if (!response.ok) {
        throw new Error('Erro ao carregar configurações');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Local state for form controls
  const [formData, setFormData] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: false,
    autoBackup: true,
    language: 'pt-BR',
    timezone: 'America/Sao_Paulo'
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Save notification settings mutation
  const saveMutation = useMutation({
    mutationFn: async (data: NotificationSettings) => {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao salvar configurações');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Configurações salvas',
        description: 'Suas preferências de notificação foram atualizadas com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleReset = () => {
    if (settings) {
      setFormData(settings);
      toast({
        title: 'Configurações restauradas',
        description: 'As configurações foram restauradas para os valores salvos.',
      });
    }
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(settings);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando configurações...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-destructive mb-4">Erro ao carregar configurações de notificação</p>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] })}
            variant="outline"
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notificações por Email */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Notificações por Email</CardTitle>
          </div>
          <CardDescription>
            Configure quais emails você deseja receber
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Email de Oportunidades</Label>
              <p className="text-sm text-muted-foreground">
                Receber emails sobre novas oportunidades criadas
              </p>
            </div>
            <Switch
              checked={formData.emailNotifications}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, emailNotifications: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Relatórios Semanais</Label>
              <p className="text-sm text-muted-foreground">
                Receber relatórios semanais por email com resumo de atividades
              </p>
            </div>
            <Switch
              checked={formData.emailNotifications} // Using same setting for now
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, emailNotifications: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Atualizações de Fase</Label>
              <p className="text-sm text-muted-foreground">
                Receber emails quando oportunidades mudarem de fase
              </p>
            </div>
            <Switch
              checked={formData.emailNotifications} // Using same setting for now
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, emailNotifications: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Notificações Push */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <CardTitle>Notificações Push</CardTitle>
          </div>
          <CardDescription>
            Configure notificações instantâneas no navegador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Notificações no Navegador</Label>
              <p className="text-sm text-muted-foreground">
                Receber notificações push quando houver novas atividades
              </p>
            </div>
            <Switch
              checked={formData.pushNotifications}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, pushNotifications: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Lembretes de Follow-up</Label>
              <p className="text-sm text-muted-foreground">
                Receber lembretes sobre follow-ups pendentes
              </p>
            </div>
            <Switch
              checked={formData.pushNotifications} // Using same setting for now
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, pushNotifications: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Configurações Gerais */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <CardTitle>Configurações Gerais</CardTitle>
          </div>
          <CardDescription>
            Outras preferências de notificação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Backup Automático</Label>
              <p className="text-sm text-muted-foreground">
                Receber notificações sobre backups automáticos
              </p>
            </div>
            <Switch
              checked={formData.autoBackup}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, autoBackup: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Notificações SMS</Label>
              <p className="text-sm text-muted-foreground">
                Receber notificações por SMS (requer configuração adicional)
              </p>
            </div>
            <Switch
              checked={formData.smsNotifications}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, smsNotifications: checked }))
              }
              disabled // Disabled until SMS functionality is implemented
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges || saveMutation.isPending}
        >
          Restaurar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}