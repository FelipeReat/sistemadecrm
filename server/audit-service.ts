import { db } from './db';
import { auditLogs } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { InsertAuditLog } from '@shared/schema';

export interface AuditLogData {
  userId: string;
  action: 'created' | 'updated' | 'deleted';
  entity: 'opportunity' | 'user' | 'automation' | 'report' | 'settings';
  entityId: string;
  changes?: {
    before?: any;
    after?: any;
  };
}

class AuditService {
  async logAction(data: AuditLogData): Promise<void> {
    try {
      const auditData: InsertAuditLog = {
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        changes: data.changes || null,
      };

      await db.insert(auditLogs).values(auditData);
      
      console.log(`🔍 Audit log: ${data.userId} ${data.action} ${data.entity} ${data.entityId}`);
    } catch (error) {
      console.error('🔍 Failed to create audit log:', error);
      // Don't throw error to avoid interrupting main operations
    }
  }

  async logOpportunityCreated(userId: string, opportunity: any): Promise<void> {
    await this.logAction({
      userId,
      action: 'created',
      entity: 'opportunity',
      entityId: opportunity.id,
      changes: {
        after: opportunity,
      },
    });
  }

  async logOpportunityUpdated(userId: string, opportunityId: string, before: any, after: any): Promise<void> {
    await this.logAction({
      userId,
      action: 'updated',
      entity: 'opportunity',
      entityId: opportunityId,
      changes: {
        before,
        after,
      },
    });
  }

  async logOpportunityDeleted(userId: string, opportunity: any): Promise<void> {
    await this.logAction({
      userId,
      action: 'deleted',
      entity: 'opportunity',
      entityId: opportunity.id,
      changes: {
        before: opportunity,
      },
    });
  }

  async logUserAction(userId: string, action: 'created' | 'updated' | 'deleted', targetUserId: string, before?: any, after?: any): Promise<void> {
    await this.logAction({
      userId,
      action,
      entity: 'user',
      entityId: targetUserId,
      changes: before || after ? {
        before,
        after,
      } : undefined,
    });
  }

  async logSettingsChanged(userId: string, settingsId: string, before: any, after: any): Promise<void> {
    await this.logAction({
      userId,
      action: 'updated',
      entity: 'settings',
      entityId: settingsId,
      changes: {
        before,
        after,
      },
    });
  }

  // Get audit logs for a specific entity
  async getEntityAuditLogs(entity: string, entityId: string, limit: number = 50) {
    try {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(
          eq(auditLogs.entity, entity) && 
          eq(auditLogs.entityId, entityId)
        )
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);

      return logs;
    } catch (error) {
      console.error('🔍 Failed to get audit logs:', error);
      return [];
    }
  }

  // Get recent audit logs for all entities
  async getRecentAuditLogs(limit: number = 100) {
    try {
      const logs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);

      return logs;
    } catch (error) {
      console.error('🔍 Failed to get recent audit logs:', error);
      return [];
    }
  }

  // Get audit logs for a specific user
  async getUserAuditLogs(userId: string, limit: number = 50) {
    try {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, userId))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);

      return logs;
    } catch (error) {
      console.error('🔍 Failed to get user audit logs:', error);
      return [];
    }
  }
}

export const auditService = new AuditService();