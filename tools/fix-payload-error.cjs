const { Client } = require('pg');
require('dotenv').config();

async function fixPayloadError() {
  const client = new Client({
    host: '54.232.194.197',
    port: 5432,
    database: 'crm',
    user: 'compras',
    password: 'Compras2025',
    ssl: false
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL');

    // Aplicar a correção da função notify_opportunity_change
    const fixSQL = `
-- Fix "payload string too long" error in notify_opportunity_change trigger
-- This migration optimizes the payload to include only essential fields

-- Drop the existing function first
DROP FUNCTION IF EXISTS notify_opportunity_change() CASCADE;

-- Create the optimized function with minimal payload
CREATE OR REPLACE FUNCTION notify_opportunity_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
    phase_changed BOOLEAN := FALSE;
BEGIN
    -- Check if phase changed (for UPDATE operations)
    IF TG_OP = 'UPDATE' THEN
        phase_changed := (OLD.phase IS DISTINCT FROM NEW.phase);
    END IF;

    -- Build minimal payload with only essential fields
    IF TG_OP = 'DELETE' THEN
        payload := json_build_object(
            'operation', TG_OP,
            'table', TG_TABLE_NAME,
            'data', json_build_object(
                'id', OLD.id,
                'phase', OLD.phase,
                'company', COALESCE(LEFT(OLD.company, 100), ''),
                'contact', COALESCE(LEFT(OLD.contact, 50), ''),
                'finalValue', OLD.final_value,
                'createdBy', OLD.created_by,
                'updatedAt', OLD.updated_at
            ),
            'phase_changed', FALSE
        );
    ELSE
        payload := json_build_object(
            'operation', TG_OP,
            'table', TG_TABLE_NAME,
            'data', json_build_object(
                'id', NEW.id,
                'phase', NEW.phase,
                'company', COALESCE(LEFT(NEW.company, 100), ''),
                'contact', COALESCE(LEFT(NEW.contact, 50), ''),
                'finalValue', NEW.final_value,
                'createdBy', NEW.created_by,
                'updatedAt', NEW.updated_at,
                'phaseUpdatedAt', NEW.phase_updated_at
            ),
            'phase_changed', phase_changed
        );
    END IF;

    -- Send notification with optimized payload
    PERFORM pg_notify('opportunity_changes', payload::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers for opportunities table
DROP TRIGGER IF EXISTS opportunity_insert_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_update_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_delete_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_insert_notify_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_update_notify_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_delete_notify_trigger ON opportunities;

CREATE TRIGGER opportunity_insert_trigger
    AFTER INSERT ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION notify_opportunity_change();

CREATE TRIGGER opportunity_update_trigger
    AFTER UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION notify_opportunity_change();

CREATE TRIGGER opportunity_delete_trigger
    AFTER DELETE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION notify_opportunity_change();
`;

    console.log('🔧 Aplicando correção da função notify_opportunity_change...');
    await client.query(fixSQL);
    console.log('✅ Função notify_opportunity_change corrigida com sucesso!');

    // Verificar se a função foi criada corretamente
    const checkResult = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'notify_opportunity_change'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Função notify_opportunity_change está ativa');
    } else {
      console.log('❌ Função notify_opportunity_change não foi encontrada');
    }

    // Verificar triggers
    const triggerResult = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers 
      WHERE event_object_table = 'opportunities'
      AND trigger_name LIKE '%opportunity%'
    `);

    console.log('📋 Triggers ativos na tabela opportunities:');
    triggerResult.rows.forEach(row => {
      console.log(`  - ${row.trigger_name}: ${row.action_timing} ${row.event_manipulation}`);
    });

  } catch (error) {
    console.error('❌ Erro ao aplicar correção:', error);
  } finally {
    await client.end();
  }
}

fixPayloadError();