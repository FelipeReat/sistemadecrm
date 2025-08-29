# Sistema de CRM - Locador

## 🚀 Como executar o sistema

### 1. Instalar dependências
```bash
npm install
```

### 2. Fazer build do cliente
```bash
npm run build
```

### 3. Criar usuário administrador (apenas primeira vez)
```bash
npm run seed:admin
```

### 4. Executar em modo desenvolvimento
```bash
npm run dev
```

O sistema estará disponível em: http://localhost:5501

## 👤 Login padrão
- **Email:** admin@locador.com
- **Senha:** admin123

## 🔧 Correções implementadas

### Problema do certificado SSL auto-assinado
**Erro original:**
```
Error: self-signed certificate in certificate chain
```

**Soluções aplicadas:**
1. Adicionada variável `NODE_TLS_REJECT_UNAUTHORIZED=0` no arquivo `.env`
2. Configuração SSL no `auth.ts` ajustada para `requestCert: false`
3. Configuração SSL no `db.ts` com `rejectUnauthorized: false`

### Compatibilidade com Windows
- Comandos `NODE_ENV` corrigidos para usar `set NODE_ENV=` (compatível com Windows)
- Scripts do `package.json` atualizados

### Correção de caminhos
- Caminho do build corrigido no `vite.ts` para `../dist/public`

## 📁 Estrutura do projeto

- `client/` - Frontend React
- `server/` - Backend Express
- `shared/` - Schemas compartilhados
- `scripts/` - Scripts utilitários
- `migrations/` - Migrações do banco de dados

## 🗄️ Banco de dados

- **Desenvolvimento:** SQLite (`dev.db`)
- **Produção:** PostgreSQL (AWS RDS)

## 🔐 Configurações de ambiente

O arquivo `.env` contém as configurações necessárias para produção e desenvolvimento.

### Variáveis importantes:
- `NODE_ENV` - Ambiente (development/production)
- `PROD_DATABASE_URL` - URL do banco PostgreSQL
- `SESSION_SECRET` - Chave secreta para sessões
- `NODE_TLS_REJECT_UNAUTHORIZED` - Desabilita verificação SSL (para certificados auto-assinados)