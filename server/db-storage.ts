import { db } from './db';
import { 
  opportunities, users, userSettings, emailTemplates, auditLogs, 
  salesReports, systemBackups, emailLogs 
} from '@shared/schema';
import { 
  eq, desc, and, gte, lte, count, sum 
} from 'drizzle-orm';
import type { 
  UserSettings, InsertUserSettings, EmailTemplate, InsertEmailTemplate,
  AuditLog, SalesReport, SystemBackup, EmailLog
} from '@shared/schema';

// Enhanced database operations for new features
export class DbOperations {
  // User Settings
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    try {
      const result = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
      
      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting user settings:', error);
      return undefined;
    }
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings | undefined> {
    try {
      const result = await db
        .insert(userSettings)
        .values(settings)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating user settings:', error);
      return undefined;
    }
  }

  async updateUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    try {
      const result = await db
        .update(userSettings)
        .set(updates)
        .where(eq(userSettings.userId, userId))
        .returning();
      
      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating user settings:', error);
      return undefined;
    }
  }

  // Email Templates
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    try {
      return await db
        .select()
        .from(emailTemplates)
        .orderBy(desc(emailTemplates.createdAt));
    } catch (error) {
      console.error('Error getting email templates:', error);
      return [];
    }
  }

  async getEmailTemplateByTrigger(trigger: string): Promise<EmailTemplate | undefined> {
    try {
      const result = await db
        .select()
        .from(emailTemplates)
        .where(and(
          eq(emailTemplates.trigger, trigger),
          eq(emailTemplates.active, true)
        ))
        .limit(1);
      
      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting email template by trigger:', error);
      return undefined;
    }
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate | undefined> {
    try {
      const result = await db
        .insert(emailTemplates)
        .values(template)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating email template:', error);
      return undefined;
    }
  }

  // Audit Logs
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    try {
      return await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return [];
    }
  }

  async getEntityAuditLogs(entity: string, entityId: string, limit: number = 50): Promise<AuditLog[]> {
    try {
      return await db
        .select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.entity, entity),
          eq(auditLogs.entityId, entityId)
        ))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
    } catch (error) {
      console.error('Error getting entity audit logs:', error);
      return [];
    }
  }

  // Sales Reports
  async getSalesReports(period?: string, year?: number, month?: number): Promise<SalesReport[]> {
    try {
      let query = db.select().from(salesReports);
      
      if (period) {
        query = query.where(eq(salesReports.period, period));
      }
      
      if (year) {
        query = query.where(eq(salesReports.year, year));
      }
      
      if (month) {
        query = query.where(eq(salesReports.month, month));
      }
      
      return await query.orderBy(desc(salesReports.generatedAt));
    } catch (error) {
      console.error('Error getting sales reports:', error);
      return [];
    }
  }

  async getTopPerformers(period: string = 'monthly', limit: number = 10): Promise<SalesReport[]> {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      let query = db
        .select()
        .from(salesReports)
        .where(and(
          eq(salesReports.period, period),
          eq(salesReports.year, currentYear)
        ));

      if (period === 'monthly') {
        query = query.where(eq(salesReports.month, currentMonth));
      }

      return await query
        .orderBy(desc(salesReports.wonValue))
        .limit(limit);
    } catch (error) {
      console.error('Error getting top performers:', error);
      return [];
    }
  }

  // System Backups
  async getSystemBackups(limit: number = 50): Promise<SystemBackup[]> {
    try {
      return await db
        .select()
        .from(systemBackups)
        .orderBy(desc(systemBackups.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting system backups:', error);
      return [];
    }
  }

  // Email Logs
  async getEmailLogs(limit: number = 100): Promise<EmailLog[]> {
    try {
      return await db
        .select()
        .from(emailLogs)
        .orderBy(desc(emailLogs.sentAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting email logs:', error);
      return [];
    }
  }

  async getOpportunityEmailLogs(opportunityId: string): Promise<EmailLog[]> {
    try {
      return await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.opportunityId, opportunityId))
        .orderBy(desc(emailLogs.sentAt));
    } catch (error) {
      console.error('Error getting opportunity email logs:', error);
      return [];
    }
  }

  // Dashboard Statistics
  async getDashboardStats() {
    try {
      // Get total opportunities
      const totalOpportunities = await db
        .select({ count: count() })
        .from(opportunities);

      // Get won opportunities
      const wonOpportunities = await db
        .select({ count: count() })
        .from(opportunities)
        .where(eq(opportunities.phase, 'ganho'));

      // Get active opportunities (not won or lost)
      const activeOpportunities = await db
        .select({ count: count() })
        .from(opportunities)
        .where(and(
          eq(opportunities.phase, 'ganho') === false,
          eq(opportunities.phase, 'perdido') === false
        ));

      // Get total value of won opportunities
      const totalWonValue = await db
        .select({ 
          total: sum(opportunities.finalValue)
        })
        .from(opportunities)
        .where(eq(opportunities.phase, 'ganho'));

      return {
        totalOpportunities: totalOpportunities[0]?.count || 0,
        wonOpportunities: wonOpportunities[0]?.count || 0,
        activeOpportunities: activeOpportunities[0]?.count || 0,
        totalWonValue: totalWonValue[0]?.total || 0,
        conversionRate: totalOpportunities[0]?.count > 0 
          ? ((wonOpportunities[0]?.count || 0) / totalOpportunities[0]?.count) * 100 
          : 0
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return {
        totalOpportunities: 0,
        wonOpportunities: 0,
        activeOpportunities: 0,
        totalWonValue: 0,
        conversionRate: 0
      };
    }
  }
}

export const dbOperations = new DbOperations();