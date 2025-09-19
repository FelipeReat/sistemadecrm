-- Adiciona coluna visit_date na tabela opportunities
ALTER TABLE opportunities ADD COLUMN visit_date text;

-- Adiciona coluna loss_observation que também está no schema mas pode estar faltando
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS loss_observation text;