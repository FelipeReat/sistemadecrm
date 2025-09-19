# Fluxo Completo de Dados do Sistema CRM

## Visão Geral

Este documento descreve o fluxo completo de dados do Sistema de CRM, desde a inicialização até as operações de negócio, incluindo todas as interações entre componentes, banco de dados e processamento de dados.

## 1. Processo de Inicialização do Sistema

### 1.1 Inicialização do Servidor (Backend)

**Arquivo Principal:** `server/index.ts`

1. **Configuração do Ambiente:**
   - Carregamento das variáveis de ambiente via `dotenv`
   - Definição da porta do servidor (padrão: 5000)
   - Configuração de CORS para permitir requisições do frontend

2. **Inicialização do Banco de Dados:**
   - **Arquivo:** `server/db.ts`
   - Conexão com PostgreSQL usando Drizzle ORM
   - Pool de conexões configurado via `pg-pool.ts`
   - Configuração SSL para produção
   - Variáveis de ambiente necessárias:
     ```
     DATABASE_URL=postgresql://user:password@host:port/database
     ```

3. **Configuração de Sessões:**
   - **Arquivo:** `server/auth.ts`
   - Armazenamento de sessões no PostgreSQL
   - Configuração de cookies seguros
   - Middleware de autenticação e autorização

4. **Inicialização de Serviços:**
   - **Email Service:** `server/email-service.ts` - Configuração SMTP
   - **Audit Service:** `server/audit-service.ts` - Sistema de auditoria
   - **Scheduler Service:** `server/scheduler.ts` - Tarefas agendadas
   - **Backup Service:** `server/backup-service.ts` - Backups automáticos

5. **Configuração de Middlewares:**
   - Rate limiting (`server/rate-limiter.ts`)
   - Segurança (`server/security-config.ts`)
   - Parsing de JSON e URL-encoded
   - Middleware de sessão

6. **Registro de Rotas:**
   - **Arquivo:** `server/routes.ts`
   - Rotas de autenticação (`/api/auth/*`)
   - Rotas de usuários (`/api/users/*`)
   - Rotas de oportunidades (`/api/opportunities/*`)
   - Rotas de automações (`/api/automations/*`)
   - Rotas de relatórios (`/api/reports/*`)

### 1.2 Inicialização do Cliente (Frontend)

**Arquivo Principal:** `client/src/main.tsx`

1. **Configuração do React:**
   - Renderização do componente raiz `App`
   - Configuração do StrictMode para desenvolvimento

2. **Configuração de Providers:**
   - **Arquivo:** `client/src/App.tsx`
   - `QueryClient` (React Query) para cache e sincronização
   - `TooltipProvider` para tooltips globais
   - `Toaster` para notificações

3. **Sistema de Roteamento:**
   - React Router para navegação SPA
   - Componente `ProtectedRoute` para rotas autenticadas
   - Redirecionamento automático baseado no status de autenticação

## 2. Sequência de Eventos até a Exibição da Tela Inicial

### 2.1 Fluxo de Autenticação

1. **Verificação de Sessão Existente:**
   ```typescript
   // client/src/hooks/useAuth.ts
   const { data: user, isLoading } = useQuery({
     queryKey: ['/api/user'],
     queryFn: () => fetch('/api/user').then(res => res.json())
   });
   ```

2. **Resposta do Servidor:**
   - **Endpoint:** `GET /api/user`
   - **Middleware:** `requireAuth` verifica sessão ativa
   - **Retorno:** Dados do usuário ou erro 401

3. **Decisão de Roteamento:**
   - Se autenticado: Redireciona para `/dashboard`
   - Se não autenticado: Exibe tela de login

### 2.2 Processo de Login

1. **Submissão do Formulário:**
   ```typescript
   // Dados enviados
   {
     email: string,
     password: string
   }
   ```

2. **Validação no Servidor:**
   - **Endpoint:** `POST /api/login`
   - Validação com Zod schema
   - Verificação de credenciais no banco
   - Hash comparison com bcrypt

3. **Criação de Sessão:**
   - Armazenamento da sessão no PostgreSQL
   - Cookie de sessão enviado ao cliente
   - Log de auditoria da ação de login

### 2.3 Carregamento da Tela Inicial (Dashboard)

1. **Componentes Carregados:**
   - `NavBar` com informações do usuário
   - `Dashboard` com métricas e dados

2. **Consultas Iniciais Executadas:**
   - Oportunidades recentes
   - Estatísticas do pipeline
   - Notificações pendentes

## 3. Estabelecimento da Conexão com o Banco de Dados

### 3.1 Configuração da Conexão

**Arquivo:** `server/db.ts`

```typescript
// Pool de conexões PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // máximo de conexões
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Drizzle ORM instance
export const db = drizzle(pool);
```

### 3.2 Schema do Banco de Dados

**Arquivo:** `shared/schema.ts`

**Tabelas Principais:**

1. **opportunities** - Oportunidades de negócio
2. **users** - Usuários do sistema
3. **automations** - Automações de processo
4. **user_settings** - Configurações de usuário
5. **email_templates** - Templates de email
6. **audit_logs** - Logs de auditoria
7. **sales_reports** - Relatórios de vendas
8. **system_backups** - Backups do sistema
9. **email_logs** - Logs de emails enviados

### 3.3 Estratégias de Armazenamento

**Implementações Disponíveis:**

1. **MemStorage** (`server/storage.ts`):
   - Armazenamento em memória para desenvolvimento
   - Inicialização com usuário admin padrão
   - Dados perdidos ao reiniciar o servidor

2. **DbOperations** (`server/db-storage.ts`):
   - Operações diretas no PostgreSQL
   - Persistência permanente
   - Suporte a transações

## 4. Consultas Realizadas Durante a Operação

### 4.1 Consultas de Autenticação

```sql
-- Verificação de usuário por email
SELECT * FROM users WHERE email = $1 AND "isActive" = true;

-- Validação de sessão
SELECT * FROM session WHERE sid = $1 AND expire > NOW();
```

### 4.2 Consultas de Oportunidades

```sql
-- Listar todas as oportunidades (ordenadas por data)
SELECT * FROM opportunities ORDER BY "createdAt" DESC;

-- Buscar oportunidade por ID
SELECT * FROM opportunities WHERE id = $1;

-- Oportunidades por fase
SELECT * FROM opportunities WHERE phase = $1;

-- Inserção de nova oportunidade
INSERT INTO opportunities (...) VALUES (...) RETURNING *;

-- Atualização de oportunidade
UPDATE opportunities SET ... WHERE id = $1 RETURNING *;
```

### 4.3 Consultas de Usuários

```sql
-- Listar usuários ativos
SELECT * FROM users WHERE "isActive" = true;

-- Buscar configurações do usuário
SELECT * FROM user_settings WHERE "userId" = $1;

-- Criar configurações padrão
INSERT INTO user_settings (...) VALUES (...);
```

### 4.4 Consultas de Auditoria

```sql
-- Logs recentes
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1;

-- Logs de uma entidade específica
SELECT * FROM audit_logs 
WHERE entity = $1 AND "entityId" = $2 
ORDER BY timestamp DESC;
```

### 4.5 Consultas de Relatórios

```sql
-- Relatórios de vendas por período
SELECT * FROM sales_reports 
WHERE period = $1 AND year = $2 
ORDER BY "generatedAt" DESC;

-- Top performers
SELECT * FROM sales_reports 
WHERE period = 'monthly' AND year = $1 AND month = $2
ORDER BY "wonValue" DESC LIMIT $3;
```

## 5. Interações entre Componentes do Sistema e Banco de Dados

### 5.1 Arquitetura de Camadas

```
┌─────────────────┐
│   Frontend      │ ← React + React Query
│   (Client)      │
└─────────────────┘
         ↓ HTTP/REST
┌─────────────────┐
│   API Routes    │ ← Express.js
│   (server/      │
│    routes.ts)   │
└─────────────────┘
         ↓
┌─────────────────┐
│   Storage       │ ← Interface abstrata
│   Interface     │
└─────────────────┘
         ↓
┌─────────────────┐
│   Database      │ ← PostgreSQL + Drizzle ORM
│   (PostgreSQL)  │
└─────────────────┘
```

### 5.2 Fluxo de Dados - Criação de Oportunidade

1. **Frontend → API:**
   ```typescript
   // Mutation no React Query
   const createOpportunity = useMutation({
     mutationFn: (data) => 
       fetch('/api/opportunities', {
         method: 'POST',
         body: JSON.stringify(data)
       })
   });
   ```

2. **API → Validação:**
   ```typescript
   // Validação com Zod
   const validatedData = insertOpportunitySchema.parse(req.body);
   ```

3. **API → Storage:**
   ```typescript
   // Chamada para storage
   const opportunity = await storage.createOpportunity(validatedData);
   ```

4. **Storage → Database:**
   ```typescript
   // Inserção no banco
   const result = await db.insert(opportunities)
     .values(opportunityData)
     .returning();
   ```

5. **Serviços Auxiliares:**
   - **Audit Service:** Log da criação
   - **Email Service:** Notificação por email
   - **Cache:** Invalidação do cache React Query

### 5.3 Fluxo de Dados - Autenticação

1. **Login Request:**
   ```
   POST /api/login
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```

2. **Validação de Credenciais:**
   ```typescript
   // Busca usuário no banco
   const user = await storage.getUserByEmail(email);
   
   // Verifica senha
   const isValid = await bcrypt.compare(password, user.password);
   ```

3. **Criação de Sessão:**
   ```typescript
   // Express session middleware
   req.session.userId = user.id;
   req.session.userRole = user.role;
   ```

4. **Resposta:**
   ```json
   {
     "id": "uuid",
     "email": "user@example.com",
     "name": "Nome do Usuário",
     "role": "admin"
   }
   ```

## 6. Processamento Adicional de Dados

### 6.1 Sistema de Auditoria

**Arquivo:** `server/audit-service.ts`

- **Objetivo:** Rastrear todas as ações dos usuários
- **Dados Capturados:**
  - ID do usuário
  - Ação realizada (created, updated, deleted)
  - Entidade afetada
  - Estado anterior e posterior (para updates)
  - Timestamp da ação

**Exemplo de Log:**
```json
{
  "userId": "user-uuid",
  "action": "updated",
  "entity": "opportunity",
  "entityId": "opp-uuid",
  "changes": {
    "before": { "phase": "prospeccao" },
    "after": { "phase": "proposta" }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 6.2 Sistema de Notificações por Email

**Arquivo:** `server/email-service.ts`

**Funcionalidades:**
- Templates personalizáveis
- Substituição de variáveis
- Log de emails enviados
- Configurações por usuário

**Triggers Automáticos:**
- Nova oportunidade criada
- Mudança de fase
- Lembretes de follow-up

**Configuração SMTP:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourcompany.com
```

### 6.3 Sistema de Relatórios

**Arquivo:** `server/reports-service.ts`

**Tipos de Relatórios:**
- Relatórios de vendas diários/mensais
- Performance de vendedores
- Análise de pipeline
- Métricas de conversão

**Geração Automática:**
- Relatórios diários às 6h
- Relatórios mensais no dia 1º às 7h
- Limpeza de dados antigos

### 6.4 Sistema de Backup

**Arquivo:** `server/backup-service.ts`

**Estratégias:**
- Backup diário às 2h
- Limpeza semanal (mantém 30 dias)
- Backup manual sob demanda
- Compressão e armazenamento seguro

### 6.5 Agendador de Tarefas

**Arquivo:** `server/scheduler.ts`

**Tarefas Agendadas:**
```javascript
// Backup diário às 2h
cron.schedule('0 2 * * *', backupTask);

// Limpeza semanal aos domingos às 3h
cron.schedule('0 3 * * 0', cleanupTask);

// Relatórios diários às 6h
cron.schedule('0 6 * * *', reportsTask);

// Relatórios mensais no dia 1º às 7h
cron.schedule('0 7 1 * *', monthlyReportsTask);
```

### 6.6 Cache e Otimização

**React Query (Frontend):**
- Cache automático de consultas
- Invalidação inteligente
- Background refetch
- Optimistic updates

**Configuração:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
    },
  },
});
```

### 6.7 Segurança e Rate Limiting

**Arquivo:** `server/rate-limiter.ts`

- Limite de requisições por IP
- Proteção contra ataques de força bruta
- Headers de segurança
- Validação de entrada rigorosa

## Considerações Técnicas

### Performance
- Pool de conexões do banco otimizado
- Índices apropriados nas tabelas
- Cache de consultas frequentes
- Paginação de resultados grandes

### Escalabilidade
- Arquitetura modular
- Separação de responsabilidades
- Interface de storage abstrata
- Serviços independentes

### Monitoramento
- Logs estruturados
- Sistema de auditoria completo
- Métricas de performance
- Alertas automáticos

### Manutenibilidade
- Código TypeScript tipado
- Validação de dados com Zod
- Testes automatizados
- Documentação abrangente

---

**Documento gerado em:** Janeiro 2024  
**Versão do Sistema:** 1.0  
**Última atualização:** Janeiro 2024