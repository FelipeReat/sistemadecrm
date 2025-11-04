import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bell, Mail, MessageSquare, Smartphone, Save, RotateCcw } from 'lucide-react';

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

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ userId }) => {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [localSettings, setLocalSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    autoBackup: true,
    language: 'pt-BR',
    timezone: 'America/Sao_Paulo'
  });

  // Fetch current settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['userSettings', userId],
    queryFn: async () => {
      const response = await fetch('/api/user/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      return response.json();
    },
    enabled: !!userId,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<NotificationSettings>) => {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings', userId] });
      toast.success('Preferências de notificação atualizadas com sucesso!');
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar preferências: ' + error.message);
    },
  });

  // Load settings when fetched
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        emailNotifications: settings.emailNotifications ?? true,
        smsNotifications: settings.smsNotifications ?? false,
        pushNotifications: settings.pushNotifications ?? true,
        autoBackup: settings.autoBackup ?? true,
        language: settings.language ?? 'pt-BR',
        timezone: settings.timezone ?? 'America/Sao_Paulo'
      });
    }
  }, [settings]);

  const handleSettingChange = (key: keyof NotificationSettings, value: boolean | string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettingsMutation.mutate(localSettings);
  };

  const handleReset = () => {
    if (settings) {
      setLocalSettings({
        emailNotifications: settings.emailNotifications ?? true,
        smsNotifications: settings.smsNotifications ?? false,
        pushNotifications: settings.pushNotifications ?? true,
        autoBackup: settings.autoBackup ?? true,
        language: settings.language ?? 'pt-BR',
        timezone: settings.timezone ?? 'America/Sao_Paulo'
      });
      setHasChanges(false);
      toast.info('Configurações restauradas para os valores salvos');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preferências de Notificação
          </CardTitle>
          <CardDescription>Carregando suas preferências...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Bell className="h-5 w-5" />
            Preferências de Notificação
          </CardTitle>
          <CardDescription>Erro ao carregar preferências</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Não foi possível carregar suas preferências. Tente novamente mais tarde.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Preferências de Notificação
        </CardTitle>
        <CardDescription>Configure como você deseja receber notificações</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-600" />
            <div>
              <Label htmlFor="email-notifications" className="font-medium">
                Notificações por Email
              </Label>
              <p className="text-sm text-gray-500">
                Receba atualizações por email sobre oportunidades e atividades
              </p>
            </div>
          </div>
          <Switch
            id="email-notifications"
            checked={localSettings.emailNotifications}
            onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
          />
        </div>

        {/* Push Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-gray-600" />
            <div>
              <Label htmlFor="push-notifications" className="font-medium">
                Notificações Push
              </Label>
              <p className="text-sm text-gray-500">
                Receba notificações push no seu navegador
              </p>
            </div>
          </div>
          <Switch
            id="push-notifications"
            checked={localSettings.pushNotifications}
            onCheckedChange={(checked) => handleSettingChange('pushNotifications', checked)}
          />
        </div>

        {/* SMS Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-gray-600" />
            <div>
              <Label htmlFor="sms-notifications" className="font-medium">
                Notificações por SMS
              </Label>
              <p className="text-sm text-gray-500">
                Receba alertas importantes por mensagem de texto
              </p>
            </div>
          </div>
          <Switch
            id="sms-notifications"
            checked={localSettings.smsNotifications}
            onCheckedChange={(checked) => handleSettingChange('smsNotifications', checked)}
          />
        </div>

        {/* Auto Backup */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Save className="h-5 w-5 text-gray-600" />
            <div>
              <Label htmlFor="auto-backup" className="font-medium">
                Backup Automático
              </Label>
              <p className="text-sm text-gray-500">
                Faz backup automático dos seus dados diariamente
              </p>
            </div>
          </div>
          <Switch
            id="auto-backup"
            checked={localSettings.autoBackup}
            onCheckedChange={(checked) => handleSettingChange('autoBackup', checked)}
          />
        </div>

        {/* Action Buttons */}
        {hasChanges && (
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {updateSettingsMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar
            </Button>
          </div>
        )}
      </CardContent>