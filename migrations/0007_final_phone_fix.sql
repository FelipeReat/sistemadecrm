
-- Remove a restrição NOT NULL da coluna phone de forma definitiva
ALTER TABLE opportunities ALTER COLUMN phone DROP NOT NULL;

-- Garante que valores NULL sejam aceitos
ALTER TABLE opportunities ALTER COLUMN phone SET DEFAULT NULL;

-- Remove qualquer constraint check que possa existir
DO $$ 
DECLARE 
    constraint_name TEXT;
BEGIN
    -- Procura por constraints relacionadas ao campo phone
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'opportunities'::regclass 
        AND contype = 'c' 
        AND pg_get_constraintdef(oid) LIKE '%phone%'
    LOOP
        EXECUTE 'ALTER TABLE opportunities DROP CONSTRAINT ' || constraint_name;
    END LOOP;
END $$;

-- Atualiza registros existentes para NULL se estiverem vazios
UPDATE opportunities SET phone = NULL WHERE phone = '' OR phone = 'null' OR phone = 'undefined';
