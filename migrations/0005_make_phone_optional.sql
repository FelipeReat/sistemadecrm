
-- Make phone field optional (allow NULL)
ALTER TABLE opportunities ALTER COLUMN phone DROP NOT NULL;

-- Update any existing records with empty phone to NULL
UPDATE opportunities SET phone = NULL WHERE phone = '';

-- Add index for better query performance on phone field
CREATE INDEX IF NOT EXISTS idx_opportunities_phone ON opportunities(phone) WHERE phone IS NOT NULL;
