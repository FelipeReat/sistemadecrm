-- Add fields to track imported cards
ALTER TABLE opportunities 
ADD COLUMN is_imported BOOLEAN DEFAULT FALSE,
ADD COLUMN import_batch_id TEXT NULL,
ADD COLUMN import_source TEXT NULL;

-- Create indexes for better query performance
CREATE INDEX idx_opportunities_is_imported ON opportunities(is_imported);
CREATE INDEX idx_opportunities_import_batch ON opportunities(import_batch_id);

-- Create trigger function for auditing imported opportunities
CREATE OR REPLACE FUNCTION audit_imported_opportunities()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_imported = TRUE THEN
        INSERT INTO audit_logs (user_id, action, entity, entity_id, changes, timestamp)
        VALUES (
            COALESCE(current_setting('app.current_user_id', true), 'system'),
            TG_OP,
            'opportunity',
            NEW.id,
            jsonb_build_object(
                'old', to_jsonb(OLD),
                'new', to_jsonb(NEW)
            ),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auditing imported opportunities
CREATE TRIGGER trigger_audit_imported_opportunities
    AFTER UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION audit_imported_opportunities();

-- Insert system settings for imported cards
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES 
    ('system', 'allow_imported_card_deletion', 'true'),
    ('system', 'allow_imported_card_editing', 'true'),
    ('system', 'imported_card_audit_enabled', 'true')
ON CONFLICT (user_id, setting_key) DO NOTHING;

-- Create email template for imported opportunity notifications
INSERT INTO email_templates (name, subject, body, trigger, active)
VALUES (
    'imported_opportunity_modified',
    'Oportunidade Importada Modificada',
    'A oportunidade {{opportunity.contact}} da empresa {{opportunity.company}} foi modificada.',
    'imported_opportunity_updated',
    true
)
ON CONFLICT (name) DO NOTHING;