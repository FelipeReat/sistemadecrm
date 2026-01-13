-- Fix "payload string too long" error in notify_opportunity_change trigger
-- This migration optimizes the payload to include essential fields and map them to camelCase
-- It excludes heavy fields like documents and visitPhotos content

DROP FUNCTION IF EXISTS notify_opportunity_change() CASCADE;

CREATE OR REPLACE FUNCTION notify_opportunity_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
    phase_changed BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        phase_changed := (OLD.phase IS DISTINCT FROM NEW.phase);
    END IF;

    IF TG_OP = 'DELETE' THEN
        payload := json_build_object(
            'operation', TG_OP,
            'table', TG_TABLE_NAME,
            'data', json_build_object(
                'id', OLD.id,
                'phase', OLD.phase,
                'contact', OLD.contact,
                'company', OLD.company
            ),
            'phase_changed', FALSE
        );
    ELSE
        payload := json_build_object(
            'operation', TG_OP,
            'table', TG_TABLE_NAME,
            'data', json_build_object(
                'id', NEW.id,
                'contact', NEW.contact,
                'cpf', NEW.cpf,
                'company', NEW.company,
                'cnpj', NEW.cnpj,
                'phone', NEW.phone,
                'hasRegistration', NEW.has_registration,
                'cadastralUpdate', NEW.cadastral_update,
                'proposalOrigin', NEW.proposal_origin,
                'businessTemperature', NEW.business_temperature,
                'needCategory', NEW.need_category,
                'clientNeeds', NEW.client_needs,
                'documents', '[]'::json, -- Empty array to avoid payload size limit
                'opportunityNumber', NEW.opportunity_number,
                'salesperson', NEW.salesperson,
                'requiresVisit', NEW.requires_visit,
                'statement', NEW.statement,
                'visitSchedule', NEW.visit_schedule,
                'visitDate', NEW.visit_date,
                'visitDescription', NEW.visit_description,
                'visitRealization', NEW.visit_realization,
                'visitPhotos', '[]'::json, -- Empty array
                'discount', NEW.discount,
                'discountDescription', NEW.discount_description,
                'validityDate', NEW.validity_date,
                'budgetNumber', NEW.budget_number,
                'budget', NEW.budget,
                'negotiationInfo', NEW.negotiation_info,
                'finalValue', NEW.final_value,
                'lossReason', NEW.loss_reason,
                'lossObservation', NEW.loss_observation,
                'phase', NEW.phase,
                'phaseUpdatedAt', NEW.phase_updated_at,
                'priority', NEW.priority,
                'createdAt', NEW.created_at,
                'updatedAt', NEW.updated_at,
                'createdBy', NEW.created_by,
                'isImported', NEW.is_imported,
                'importSource', NEW.import_source,
                'importBatchId', NEW.import_batch_id,
                'createdByName', NEW.created_by_name
            ),
            'phase_changed', phase_changed
        );
    END IF;

    PERFORM pg_notify('opportunity_changes', payload::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers (cleaning up both naming conventions to be safe)
DROP TRIGGER IF EXISTS opportunity_insert_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_update_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_delete_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_insert_notify_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_update_notify_trigger ON opportunities;
DROP TRIGGER IF EXISTS opportunity_delete_notify_trigger ON opportunities;

CREATE TRIGGER opportunity_insert_notify_trigger
    AFTER INSERT ON opportunities
    FOR EACH ROW EXECUTE FUNCTION notify_opportunity_change();

CREATE TRIGGER opportunity_update_notify_trigger
    AFTER UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION notify_opportunity_change();

CREATE TRIGGER opportunity_delete_notify_trigger
    AFTER DELETE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION notify_opportunity_change();
