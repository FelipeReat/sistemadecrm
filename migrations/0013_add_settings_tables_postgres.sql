-- Migração 0013: Adicionar tabelas para sistema de configurações completo
-- Versão para PostgreSQL padrão (sem Supabase)

-- 1. Criar tabela de configurações da empresa
CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL DEFAULT 'Minha Empresa',
    company_phone VARCHAR(50),
    company_email VARCHAR(255),
    company_address TEXT,
    company_logo TEXT, -- URL ou base64 da logo
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    timezone VARCHAR(100) NOT NULL DEFAULT 'America/Sao_Paulo',
    date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    time_format VARCHAR(10) NOT NULL DEFAULT '24h',
    language VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    auto_backup_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_backup_frequency VARCHAR(20) NOT NULL DEFAULT 'daily', -- daily, weekly, monthly
    auto_backup_time TIME NOT NULL DEFAULT '02:00:00',
    max_file_size_mb INTEGER NOT NULL DEFAULT 10,
    allowed_file_types TEXT[] NOT NULL DEFAULT ARRAY['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Adicionar colunas à tabela user_settings existente
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS session_timeout INTEGER NOT NULL DEFAULT 480, -- minutos
ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS profile_photo TEXT; -- URL ou base64 da foto

-- 3. Criar tabela de histórico de login
CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    location VARCHAR(255),
    success BOOLEAN NOT NULL DEFAULT true,
    failure_reason VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Criar tabela de sessões ativas
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- 5. Adicionar colunas à tabela email_templates existente
ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS html_content TEXT,
ADD COLUMN IF NOT EXISTS text_content TEXT,
ADD COLUMN IF NOT EXISTS variables JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);

-- 6. Criar tabela de logs do sistema
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL, -- info, warning, error, debug
    message TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- auth, database, api, system, etc.
    user_id VARCHAR REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 7. Criar tabela de webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL, -- ['opportunity.created', 'opportunity.updated', etc.]
    secret VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT true,
    retry_count INTEGER NOT NULL DEFAULT 3,
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_status VARCHAR(20), -- success, failed, timeout
    last_error TEXT,
    created_by VARCHAR NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 8. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_login_time ON login_history(login_time);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING GIN(events);

-- 9. Inserir configurações padrão da empresa
INSERT INTO company_settings (id, company_name, currency, timezone, date_format, time_format, language)
VALUES (1, 'Minha Empresa', 'BRL', 'America/Sao_Paulo', 'DD/MM/YYYY', '24h', 'pt-BR')
ON CONFLICT (id) DO NOTHING;

-- 10. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 11. Criar triggers para updated_at
DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;
CREATE TRIGGER update_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhooks_updated_at ON webhooks;
CREATE TRIGGER update_webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 12. Comentários nas tabelas
COMMENT ON TABLE company_settings IS 'Configurações gerais da empresa';
COMMENT ON TABLE login_history IS 'Histórico de tentativas de login dos usuários';
COMMENT ON TABLE user_sessions IS 'Sessões ativas dos usuários';
COMMENT ON TABLE system_logs IS 'Logs do sistema para auditoria e debugging';
COMMENT ON TABLE webhooks IS 'Configuração de webhooks para integração externa';

COMMENT ON COLUMN user_settings.two_factor_enabled IS 'Indica se o usuário tem 2FA habilitado';
COMMENT ON COLUMN user_settings.two_factor_secret IS 'Chave secreta para TOTP (criptografada)';
COMMENT ON COLUMN user_settings.backup_codes IS 'Códigos de backup para 2FA';
COMMENT ON COLUMN user_settings.session_timeout IS 'Timeout da sessão em minutos';
COMMENT ON COLUMN user_settings.password_expires_at IS 'Data de expiração da senha';
COMMENT ON COLUMN user_settings.profile_photo IS 'URL ou base64 da foto do perfil';

COMMENT ON COLUMN email_templates.html_content IS 'Conteúdo HTML do template';
COMMENT ON COLUMN email_templates.text_content IS 'Conteúdo em texto plano do template';
COMMENT ON COLUMN email_templates.variables IS 'Variáveis disponíveis no template';
COMMENT ON COLUMN email_templates.created_by IS 'ID do usuário que criou o template';