-- Adiciona colunas visit_description e visit_realization na tabela opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS visit_description text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS visit_realization text;