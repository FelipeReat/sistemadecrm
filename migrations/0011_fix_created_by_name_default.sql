-- Migração para adicionar valor padrão à coluna created_by_name
-- Corrige o problema de valores nulos sendo inseridos

-- Primeiro, atualizar todos os registros nulos existentes
UPDATE opportunities 
SET created_by_name = 'Sistema' 
WHERE created_by_name IS NULL;

-- Adicionar valor padrão à coluna
ALTER TABLE opportunities 
ALTER COLUMN created_by_name SET DEFAULT 'Sistema';

-- Verificar se a constraint de não-nulo ainda existe
-- Se não existir, adicionar novamente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'opportunities_created_by_name_not_null' 
        AND table_name = 'opportunities'
    ) THEN
        ALTER TABLE opportunities 
        ALTER COLUMN created_by_name SET NOT NULL;
    END IF;
END $$;