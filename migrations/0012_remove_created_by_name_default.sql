-- Migração para remover valor padrão da coluna created_by_name
-- Permite que a aplicação controle completamente o valor

-- Remover o valor padrão da coluna created_by_name
ALTER TABLE opportunities 
ALTER COLUMN created_by_name DROP DEFAULT;

-- Comentário para documentação
COMMENT ON COLUMN opportunities.created_by_name IS 'Nome do usuário que criou a oportunidade - controlado pela aplicação';