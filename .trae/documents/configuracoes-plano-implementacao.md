# Plano de Implementação - Sistema de Configurações Completo

## 1. Análise da Situação Atual

### 1.1 Componentes Existentes
- **settings-page.tsx**: Estrutura básica com abas, mas sem funcionalidades implementadas
- **settings-modal.tsx**: Funcionalidades parciais implementadas (perfil, notificações, dados, sistema)

### 1.2 Funcionalidades Já Implementadas
- ✅ Atualização de perfil do usuário
- ✅ Configurações básicas de notificações
- ✅ Exportação de dados
- ✅ Limpeza de dados (admin)
- ✅ Logout e informações do sistema

### 1.3 Funcionalidades Não Implementadas
- ❌ Configurações da empresa
- ❌ Upload de foto de perfil
- ❌ Alteração de senha
- ❌ Templates de email
- ❌ Webhooks
- ❌ Autenticação de dois fatores (2FA)
- ❌ Histórico de login
- ❌ Sessões ativas
- ❌ Logs do sistema
- ❌ Métricas de performance
- ❌ Importação de dados funcional
- ❌ Configurações monetárias e fuso horário

## 2. Estrutura de Implementação

### 2.1 Fase 1: Backend - Novos Endpoints e Modelos

**Novos Endpoints Necessários:**

```typescript
// Configurações da empresa
PUT /api/company/settings
GET /api/company/settings

// Upload de foto
POST /api/user/profile/photo
DELETE /api/user/profile/photo

// Alteração de senha
PUT /api/user/change-password

// Templates de email
GET /api/email/templates
POST /api/email/templates
PUT /api/email/templates/:id
DELETE /api/email/templates/:id

// Webhooks
GET /api/webhooks
POST /api/webhooks
PUT /api/webhooks/:id
DELETE /api/webhooks/:id

// Segurança
GET /api/user/login-history
GET /api/user/active-sessions
DELETE /api/user/sessions/:id
PUT /api/user/security/2fa

// Sistema
GET /api/system/logs
GET /api/system/metrics
POST /api/system/maintenance

// Importação melhorada
POST /api/import/validate
POST /api/import/execute
GET /api/import/status/:id
```

### 2.2 Fase 2: Frontend - Componentes React

**Novos Componentes a Criar:**

```
src/components/settings/
├── CompanySettingsForm.tsx
├── ProfilePhotoUpload.tsx
├── PasswordChangeForm.tsx
├── EmailTemplateEditor.tsx
├── WebhookManager.tsx
├── TwoFactorAuth.tsx
├── LoginHistoryTable.tsx
├── ActiveSessionsTable.tsx
├── SystemLogsViewer.tsx
├── PerformanceMetrics.tsx
├── DataImportWizard.tsx
└── CurrencyTimezoneSettings.tsx
```

### 2.3 Fase 3: Integração e Melhorias

**Modificações nos Componentes Existentes:**

1. **settings-page.tsx**: Integrar todos os novos componentes
2. **settings-modal.tsx**: Manter funcionalidades existentes como fallback
3. Adicionar validações e tratamento de erros
4. Implementar loading states e feedback visual

## 3. Implementação Detalhada por Aba

### 3.1 Aba Geral

**Componentes:**
- `CompanySettingsForm`: Configurações da empresa
- `CurrencyTimezoneSettings`: Moeda e fuso horário
- `BackupSettings`: Configurações de backup automático

**Funcionalidades:**
```typescript
interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: 'BRL' | 'USD' | 'EUR';
  timezone: string;
  backupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupTime: string;
}
```

### 3.2 Aba Perfil

**Componentes:**
- `ProfilePhotoUpload`: Upload com preview e crop
- `PasswordChangeForm`: Alteração de senha com validação
- Formulário de informações pessoais (já existente)

**Funcionalidades:**
```typescript
interface ProfilePhoto {
  file: File;
  preview: string;
  cropArea?: { x: number; y: number; width: number; height: number };
}

interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
```

### 3.3 Aba Notificações

**Componentes:**
- `EmailTemplateEditor`: Editor WYSIWYG para templates
- `WebhookManager`: Gerenciamento de webhooks
- Configurações de notificação (já existente)

**Funcionalidades:**
```typescript
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  variables: string[];
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
}
```

### 3.4 Aba Segurança

**Componentes:**
- `TwoFactorAuth`: Configuração de 2FA com QR code
- `LoginHistoryTable`: Histórico com filtros e paginação
- `ActiveSessionsTable`: Sessões ativas com opção de logout

**Funcionalidades:**
```typescript
interface TwoFactorSetup {
  enabled: boolean;
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

interface LoginHistoryEntry {
  id: string;
  ipAddress: string;
  location: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
}

interface ActiveSession {
  id: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  lastActivity: Date;
  current: boolean;
}
```

### 3.5 Aba Sistema

**Componentes:**
- `SystemLogsViewer`: Visualizador de logs com filtros
- `PerformanceMetrics`: Gráficos de métricas em tempo real
- `DataImportWizard`: Assistente de importação melhorado
- `MaintenanceTools`: Ferramentas de manutenção

**Funcionalidades:**
```typescript
interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  activeUsers: number;
  responseTime: number;
}

interface ImportProgress {
  id: string;
  status: 'uploading' | 'validating' | 'importing' | 'completed' | 'error';
  progress: number;
  totalRows: number;
  processedRows: number;
  errors: string[];
}
```

## 4. Validações e Segurança

### 4.1 Validações Frontend (Zod Schemas)

```typescript
// Configurações da empresa
const companySettingsSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255),
  address: z.string().max(500).optional(),
  phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).optional(),
  email: z.string().email().optional(),
  currency: z.enum(['BRL', 'USD', 'EUR']),
  timezone: z.string().min(1)
});

// Alteração de senha
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Senha deve conter maiúscula, minúscula e número"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"]
});

// Template de email
const emailTemplateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255),
  subject: z.string().min(1, "Assunto é obrigatório").max(500),
  htmlContent: z.string().min(1, "Conteúdo é obrigatório"),
  variables: z.array(z.string()).optional()
});
```

### 4.2 Middleware de Segurança

```typescript
// Middleware para upload de foto
const photoUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado'));
    }
  }
});

// Middleware para logs de auditoria
const auditMiddleware = (action: string, entityType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        auditService.log({
          userId: req.session.userId!,
          action,
          entityType,
          entityId: req.params.id || 'system',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
    });
    next();
  };
};
```

## 5. Estados de Loading e Feedback

### 5.1 Estados Globais

```typescript
interface SettingsState {
  loading: {
    company: boolean;
    profile: boolean;
    photo: boolean;
    password: boolean;
    templates: boolean;
    webhooks: boolean;
    security: boolean;
    logs: boolean;
    metrics: boolean;
    import: boolean;
  };
  errors: {
    [key: string]: string | null;
  };
  success: {
    [key: string]: string | null;
  };
}
```

### 5.2 Hooks Customizados

```typescript
// Hook para configurações da empresa
const useCompanySettings = () => {
  const { data, isLoading, error, mutate } = useSWR('/api/company/settings');
  
  const updateSettings = async (settings: CompanySettings) => {
    const response = await fetch('/api/company/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    
    if (!response.ok) throw new Error('Erro ao atualizar configurações');
    
    mutate();
    return response.json();
  };
  
  return { data, isLoading, error, updateSettings };
};

// Hook para upload de foto
const usePhotoUpload = () => {
  const [uploading, setUploading] = useState(false);
  
  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      
      const response = await fetch('/api/user/profile/photo', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Erro no upload');
      
      return response.json();
    } finally {
      setUploading(false);
    }
  };
  
  return { uploadPhoto, uploading };
};
```

## 6. Cronograma de Implementação

### Semana 1: Backend Foundation
- [ ] Criar novos modelos de dados
- [ ] Implementar endpoints básicos
- [ ] Configurar middleware de segurança
- [ ] Testes unitários dos endpoints

### Semana 2: Componentes Core
- [ ] CompanySettingsForm
- [ ] ProfilePhotoUpload
- [ ] PasswordChangeForm
- [ ] CurrencyTimezoneSettings

### Semana 3: Funcionalidades Avançadas
- [ ] EmailTemplateEditor
- [ ] WebhookManager
- [ ] TwoFactorAuth
- [ ] LoginHistoryTable

### Semana 4: Sistema e Finalização
- [ ] SystemLogsViewer
- [ ] PerformanceMetrics
- [ ] DataImportWizard
- [ ] Integração completa e testes

### Semana 5: Polimento e Deploy
- [ ] Testes de integração
- [ ] Otimizações de performance
- [ ] Documentação
- [ ] Deploy e monitoramento

## 7. Critérios de Aceitação

### 7.1 Funcionalidades Básicas
- [ ] Todos os campos e botões devem ter funcionalidade
- [ ] Validações em tempo real
- [ ] Feedback visual para todas as ações
- [ ] Responsividade em todos os dispositivos

### 7.2 Segurança
- [ ] Autenticação obrigatória para todas as operações
- [ ] Validação de permissões por papel de usuário
- [ ] Logs de auditoria para ações sensíveis
- [ ] Proteção contra uploads maliciosos

### 7.3 Performance
- [ ] Carregamento inicial < 2 segundos
- [ ] Operações de CRUD < 1 segundo
- [ ] Upload de foto < 5 segundos
- [ ] Paginação para listas grandes

### 7.4 Usabilidade
- [ ] Interface intuitiva e consistente
- [ ] Mensagens de erro claras
- [ ] Confirmações para ações destrutivas
- [ ] Atalhos de teclado para ações comuns