-- Migração para adicionar triggers de notificação em tempo real
-- Implementa PostgreSQL LISTEN/NOTIFY para atualizações automáticas do Kanban

-- Criar função para notificação de mudanças em oportunidades
CREATE OR REPLACE FUNCTION notify_opportunity_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notificar mudanças com payload JSON detalhado
  PERFORM pg_notify(
    'opportunity_changes',
    json_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'data', CASE 
        WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)
        ELSE row_to_json(NEW)
      END,
      'old_data', CASE 
        WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)
        ELSE NULL
      END,
      'timestamp', extract(epoch from now()),
      'user_id', COALESCE(
        CASE 
          WHEN TG_OP = 'DELETE' THEN OLD.created_by
          ELSE NEW.created_by
        END, 
        'system'
      ),
      'phase_changed', CASE 
        WHEN TG_OP = 'UPDATE' AND OLD.phase IS DISTINCT FROM NEW.phase THEN true
        ELSE false
      END
    )::text
  );
  
  -- Retornar o registro apropriado
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para INSERT (nova oportunidade)
CREATE TRIGGER opportunity_insert_notify_trigger
  AFTER INSERT ON opportunities
  FOR EACH ROW EXECUTE FUNCTION notify_opportunity_change();

-- Criar trigger para UPDATE (edição de oportunidade)
CREATE TRIGGER opportunity_update_notify_trigger
  AFTER UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION notify_opportunity_change();

-- Criar trigger para DELETE (exclusão de oportunidade)
CREATE TRIGGER opportunity_delete_notify_trigger
  AFTER DELETE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION notify_opportunity_change();

-- Atualizar automaticamente o campo updated_at em UPDATEs
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  
  -- Se a fase mudou, atualizar phase_updated_at
  IF OLD.phase IS DISTINCT FROM NEW.phase THEN
    NEW.phase_updated_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar timestamps automaticamente
CREATE TRIGGER opportunity_update_timestamps_trigger
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON FUNCTION notify_opportunity_change() IS 'Função que envia notificações PostgreSQL para mudanças em oportunidades';
COMMENT ON TRIGGER opportunity_insert_notify_trigger ON opportunities IS 'Trigger para notificar inserções de oportunidades';
COMMENT ON TRIGGER opportunity_update_notify_trigger ON opportunities IS 'Trigger para notificar atualizações de oportunidades';
COMMENT ON TRIGGER opportunity_delete_notify_trigger ON opportunities IS 'Trigger para notificar exclusões de oportunidades';
COMMENT ON TRIGGER opportunity_update_timestamps_trigger ON opportunities IS 'Trigger para atualizar timestamps automaticamente';