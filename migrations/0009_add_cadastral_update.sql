-- Adiciona coluna cadastral_update na tabela opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cadastral_update BOOLEAN DEFAULT FALSE;

-- Comentário para documentação
COMMENT ON COLUMN opportunities.cadastral_update IS 'Indica se o cliente precisa de atualização cadastral';