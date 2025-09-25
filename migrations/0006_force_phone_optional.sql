
-- Força o campo phone como opcional (allow NULL)
ALTER TABLE opportunities ALTER COLUMN phone DROP NOT NULL;

-- Remove valores vazios existentes e define como NULL
UPDATE opportunities SET phone = NULL WHERE phone = '' OR phone = 'null' OR phone = 'undefined';

-- Garante que o campo pode ser NULL
ALTER TABLE opportunities ALTER COLUMN phone DROP DEFAULT;
