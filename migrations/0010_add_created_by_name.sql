-- Migração para adicionar campo created_by_name à tabela opportunities
-- Baseado na arquitetura técnica especificada

-- Adicionar coluna created_by_name à tabela opportunities
ALTER TABLE opportunities 
ADD COLUMN created_by_name VARCHAR(255);

-- Criar índice para melhor performance nas consultas
CREATE INDEX idx_opportunities_created_by_name 
ON opportunities(created_by_name);

-- Atualizar registros existentes com nome do usuário padrão
UPDATE opportunities 
SET created_by_name = 'Sistema' 
WHERE created_by_name IS NULL;

-- Tornar o campo obrigatório após preencher dados existentes
ALTER TABLE opportunities 
ALTER COLUMN created_by_name SET NOT NULL;

-- Adicionar constraint para garantir que o nome não seja vazio
ALTER TABLE opportunities 
ADD CONSTRAINT check_created_by_name_not_empty 
CHECK (length(trim(created_by_name)) > 0);