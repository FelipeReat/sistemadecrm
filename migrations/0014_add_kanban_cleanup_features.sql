-- Migration: Add Kanban Cleanup Features
-- Description: Adds backup table and functions for clearing Kanban cards safely

-- Create backups table for storing card backups before clearing
CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    backup_type VARCHAR(50) NOT NULL DEFAULT 'opportunities',
    backup_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    restored_at TIMESTAMP WITH TIME ZONE NULL,
    is_active BOOLEAN DEFAULT true
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(backup_type);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);
CREATE INDEX IF NOT EXISTS idx_backups_created_by ON backups(created_by);
CREATE INDEX IF NOT EXISTS idx_backups_is_active ON backups(is_active);

-- Function to create opportunities backup
CREATE OR REPLACE FUNCTION create_opportunities_backup(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    backup_id INTEGER;
    opportunities_data JSONB;
BEGIN
    -- Get all opportunities data
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', o.id,
            'title', o.title,
            'description', o.description,
            'value', o.value,
            'stage', o.stage,
            'priority', o.priority,
            'company', o.company,
            'contact_name', o.contact_name,
            'contact_email', o.contact_email,
            'contact_phone', o.contact_phone,
            'expected_close_date', o.expected_close_date,
            'created_at', o.created_at,
            'updated_at', o.updated_at,
            'created_by', o.created_by,
            'created_by_name', o.created_by_name,
            'visit_date', o.visit_date,
            'is_imported', o.is_imported,
            'import_source', o.import_source,
            'import_batch_id', o.import_batch_id,
            'original_data', o.original_data
        )
    ) INTO opportunities_data
    FROM opportunities o;

    -- Insert backup record
    INSERT INTO backups (backup_type, backup_data, created_by, metadata)
    VALUES (
        'opportunities',
        COALESCE(opportunities_data, '[]'::jsonb),
        p_user_id,
        jsonb_build_object(
            'total_count', (SELECT COUNT(*) FROM opportunities),
            'backup_reason', 'clear_all_cards',
            'timestamp', NOW()
        )
    )
    RETURNING id INTO backup_id;

    RETURN backup_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clear all opportunities
CREATE OR REPLACE FUNCTION clear_all_opportunities()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Get count before deletion
    SELECT COUNT(*) INTO deleted_count FROM opportunities;
    
    -- Delete all opportunities
    DELETE FROM opportunities;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get opportunities count
CREATE OR REPLACE FUNCTION get_opportunities_count()
RETURNS INTEGER AS $$
DECLARE
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM opportunities;
    RETURN total_count;
END;
$$ LANGUAGE plpgsql;

-- Function to restore opportunities from backup
CREATE OR REPLACE FUNCTION restore_opportunities_from_backup(p_backup_id INTEGER, p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    backup_record RECORD;
    opportunity_record JSONB;
    restored_count INTEGER := 0;
BEGIN
    -- Get backup data
    SELECT * INTO backup_record 
    FROM backups 
    WHERE id = p_backup_id 
    AND backup_type = 'opportunities' 
    AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Backup not found or inactive';
    END IF;
    
    -- Clear existing opportunities
    DELETE FROM opportunities;
    
    -- Restore opportunities from backup
    FOR opportunity_record IN SELECT * FROM jsonb_array_elements(backup_record.backup_data)
    LOOP
        INSERT INTO opportunities (
            title, description, value, stage, priority, company,
            contact_name, contact_email, contact_phone, expected_close_date,
            created_at, updated_at, created_by, created_by_name, visit_date,
            is_imported, import_source, import_batch_id, original_data
        ) VALUES (
            (opportunity_record->>'title')::TEXT,
            (opportunity_record->>'description')::TEXT,
            (opportunity_record->>'value')::DECIMAL,
            (opportunity_record->>'stage')::TEXT,
            (opportunity_record->>'priority')::TEXT,
            (opportunity_record->>'company')::TEXT,
            (opportunity_record->>'contact_name')::TEXT,
            (opportunity_record->>'contact_email')::TEXT,
            (opportunity_record->>'contact_phone')::TEXT,
            (opportunity_record->>'expected_close_date')::DATE,
            (opportunity_record->>'created_at')::TIMESTAMP WITH TIME ZONE,
            NOW(), -- updated_at
            (opportunity_record->>'created_by')::INTEGER,
            (opportunity_record->>'created_by_name')::TEXT,
            (opportunity_record->>'visit_date')::DATE,
            (opportunity_record->>'is_imported')::BOOLEAN,
            (opportunity_record->>'import_source')::TEXT,
            (opportunity_record->>'import_batch_id')::TEXT,
            (opportunity_record->'original_data')::JSONB
        );
        
        restored_count := restored_count + 1;
    END LOOP;
    
    -- Mark backup as restored
    UPDATE backups 
    SET restored_at = NOW(), 
        metadata = metadata || jsonb_build_object('restored_by', p_user_id, 'restored_count', restored_count)
    WHERE id = p_backup_id;
    
    RETURN restored_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT ON backups TO authenticated;
GRANT USAGE ON SEQUENCE backups_id_seq TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_opportunities_backup(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_all_opportunities() TO authenticated;
GRANT EXECUTE ON FUNCTION get_opportunities_count() TO authenticated;
GRANT EXECUTE ON FUNCTION restore_opportunities_from_backup(INTEGER, INTEGER) TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE backups IS 'Stores backup data for various entities before bulk operations';
COMMENT ON FUNCTION create_opportunities_backup(INTEGER) IS 'Creates a backup of all opportunities before clearing';
COMMENT ON FUNCTION clear_all_opportunities() IS 'Deletes all opportunities and returns count of deleted records';
COMMENT ON FUNCTION get_opportunities_count() IS 'Returns the total count of opportunities';
COMMENT ON FUNCTION restore_opportunities_from_backup(INTEGER, INTEGER) IS 'Restores opportunities from a specific backup';