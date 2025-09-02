
-- Adiciona coluna createdBy na tabela opportunities
ALTER TABLE opportunities ADD COLUMN created_by text;

-- Define um valor padrão para registros existentes
UPDATE opportunities SET created_by = 'Sistema' WHERE created_by IS NULL;

-- Torna a coluna NOT NULL após definir valores
ALTER TABLE opportunities ALTER COLUMN created_by SET NOT NULL;
