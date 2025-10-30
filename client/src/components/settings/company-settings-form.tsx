import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Building2, Phone, Mail, MapPin, DollarSign, Clock, HardDrive, FileType, Loader2 } from 'lucide-react';

interface CompanySettings {
  id?: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  timezone: string;
  autoBackup: boolean;
  backupFrequency: string;
  allowedFileTypes: string[];
  maxFileSize: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const CURRENCY_OPTIONS = [
  { value: 'BRL', label: 'Real Brasileiro (R$)' },
  { value: 'USD', label: 'Dólar Americano ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'Libra Esterlina (£)' }
];

const TIMEZONE_OPTIONS = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
  { value: 'America/New_York', label: 'Nova York (UTC-5)' },
  { value: 'Europe/London', label: 'Londres (UTC+0)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1)' },
  { value: 'Asia/Tokyo', label: 'Tóquio (UTC+9)' }
];

const BACKUP_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' }
];

const FILE_TYPE_OPTIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg',
  'txt', 'csv', 'zip', 'rar'
];

export function CompanySettingsForm() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: '',
    phone: '',
    email: '',
    address: '',
    currency: 'BRL',
    timezone: 'America/Sao_Paulo',
    autoBackup: true,
    backupFrequency: 'daily',
    allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png'],
    maxFileSize: 10485760 // 10MB
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/company/settings', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // Map backend fields to frontend expected fields
        setSettings({
          id: data.id,
          companyName: data.companyName || data.company_name || '',
          phone: data.companyPhone || data.company_phone || data.phone || '',
          email: data.companyEmail || data.company_email || data.email || '',
          address: data.companyAddress || data.company_address || data.address || '',
          currency: data.currency || 'BRL',
          timezone: data.timezone || 'America/Sao_Paulo',
          autoBackup: data.autoBackupEnabled || data.auto_backup_enabled || data.autoBackup || true,
          backupFrequency: data.autoBackupFrequency || data.auto_backup_frequency || data.backupFrequency || 'daily',
          allowedFileTypes: Array.isArray(data.allowedFileTypes) ? data.allowedFileTypes : 
                           Array.isArray(data.allowed_file_types) ? data.allowed_file_types :
                           (typeof data.allowedFileTypes === 'string' ? JSON.parse(data.allowedFileTypes) : 
                           typeof data.allowed_file_types === 'string' ? JSON.parse(data.allowed_file_types) :
                           ['pdf', 'doc', 'docx', 'jpg', 'png']),
          maxFileSize: data.maxFileSizeMb ? data.maxFileSizeMb * 1024 * 1024 : 
                      data.max_file_size_mb ? data.max_file_size_mb * 1024 * 1024 :
                      data.maxFileSize || 10485760,
          createdAt: data.createdAt || data.created_at,
          updatedAt: data.updatedAt || data.updated_at
        });
      } else {
        console.error('Erro ao carregar configurações da empresa');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações da empresa",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Map frontend fields to backend expected fields
      const backendSettings = {
        companyName: settings.companyName,
        companyPhone: settings.phone,
        companyEmail: settings.email,
        companyAddress: settings.address,
        currency: settings.currency,
        timezone: settings.timezone,
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        language: 'pt-BR',
        autoBackupEnabled: settings.autoBackup,
        autoBackupFrequency: settings.backupFrequency,
        autoBackupTime: '02:00',
        maxFileSizeMb: Math.round(settings.maxFileSize / (1024 * 1024)),
        allowedFileTypes: settings.allowedFileTypes
      };

      const response = await fetch('/api/company/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(backendSettings)
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Configurações da empresa salvas com sucesso!"
        });
      } else {
        const error = await response.json();
        toast({
          title: "Erro",
          description: error.message || "Erro ao salvar configurações",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações da empresa",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileTypeToggle = (fileType: string) => {
    setSettings(prev => {
      const currentAllowedTypes = prev.allowedFileTypes || [];
      return {
        ...prev,
        allowedFileTypes: currentAllowedTypes.includes(fileType)
          ? currentAllowedTypes.filter(type => type !== fileType)
          : [...currentAllowedTypes, fileType]
      };
    });
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Carregando configurações...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informações da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informações da Empresa
          </CardTitle>
          <CardDescription>
            Configure as informações básicas da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome da Empresa</Label>
              <Input
                id="companyName"
                value={settings.companyName}
                onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Digite o nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                Telefone
              </Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Endereço
              </Label>
              <Textarea
                id="address"
                value={settings.address}
                onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Rua, número, bairro, cidade, estado"
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações Regionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Configurações Regionais
          </CardTitle>
          <CardDescription>
            Configure moeda e fuso horário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Moeda</Label>
              <Select
                value={settings.currency}
                onValueChange={(value) => setSettings(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a moeda" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone" className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Fuso Horário
              </Label>
              <Select
                value={settings.timezone}
                onValueChange={(value) => setSettings(prev => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fuso horário" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Configurações de Backup
          </CardTitle>
          <CardDescription>
            Configure como e quando fazer backup dos dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Backup Automático</Label>
              <p className="text-sm text-muted-foreground">
                Ativar backup automático dos dados
              </p>
            </div>
            <Switch
              checked={settings.autoBackup}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoBackup: checked }))}
            />
          </div>

          {settings.autoBackup && (
            <div className="space-y-2">
              <Label htmlFor="backupFrequency">Frequência do Backup</Label>
              <Select
                value={settings.backupFrequency}
                onValueChange={(value) => setSettings(prev => ({ ...prev, backupFrequency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a frequência" />
                </SelectTrigger>
                <SelectContent>
                  {BACKUP_FREQUENCY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurações de Arquivos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileType className="h-5 w-5" />
            Configurações de Arquivos
          </CardTitle>
          <CardDescription>
            Configure tipos de arquivo permitidos e tamanho máximo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tamanho Máximo do Arquivo</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(settings.maxFileSize / (1024 * 1024))}
                onChange={(e) => {
                  const mb = parseInt(e.target.value) || 1;
                  setSettings(prev => ({ ...prev, maxFileSize: mb * 1024 * 1024 }));
                }}
                min="1"
                max="100"
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">MB</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Tipos de Arquivo Permitidos</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {FILE_TYPE_OPTIONS.map(fileType => {
                const isSelected = (settings.allowedFileTypes || []).includes(fileType);
                return (
                  <div
                    key={fileType}
                    className={`flex items-center justify-center p-2 rounded-md border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border'
                    }`}
                    onClick={() => handleFileTypeToggle(fileType)}
                  >
                    <Badge variant={isSelected ? 'default' : 'outline'}>
                      .{fileType}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Clique nos tipos de arquivo para ativar/desativar
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}