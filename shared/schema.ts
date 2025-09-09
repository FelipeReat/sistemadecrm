import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, decimal, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const opportunities = pgTable("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Fase 1: Nova oportunidade
  contact: text("contact").notNull(),
  cpf: text("cpf"),
  company: text("company").notNull(),
  cnpj: text("cnpj"),
  phone: text("phone").notNull(),
  hasRegistration: boolean("has_registration").default(false),
  proposalOrigin: text("proposal_origin"),
  businessTemperature: text("business_temperature"),
  needCategory: text("need_category").notNull(),
  clientNeeds: text("client_needs").notNull(),
  documents: text("documents").array(),

  // Fase 2: Prospecção
  opportunityNumber: text("opportunity_number"),
  salesperson: text("salesperson"),
  requiresVisit: boolean("requires_visit").default(false),
  statement: text("statement"),

  // Fase 4: Visita Técnica
  visitSchedule: text("visit_schedule"),
  visitDate: text("visit_date"),
  visitPhotos: text("visit_photos").array(),

  // Fase 5: Proposta
  discount: decimal("discount", { precision: 5, scale: 2 }),
  discountDescription: text("discount_description"),
  validityDate: timestamp("validity_date"),
  budgetNumber: text("budget_number"),
  budget: decimal("budget", { precision: 12, scale: 2 }),

  // Fase 6: Negociação
  status: text("status"),
  finalValue: decimal("final_value", { precision: 12, scale: 2 }),
  negotiationInfo: text("negotiation_info"),
  contract: text("contract"),
  invoiceNumber: text("invoice_number"),
  lossReason: text("loss_reason"),

  // Controle de fase
  phase: text("phase").notNull().default("prospeccao"),

  // Auditoria
  createdBy: text("created_by").notNull(),

  // Timestamps
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  phaseUpdatedAt: timestamp("phase_updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phase: text("phase").notNull(),
  trigger: text("trigger").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertOpportunitySchema = createInsertSchema(opportunities, {
  budget: z.coerce.string().optional(), // Decimal fields expect strings
  finalValue: z.coerce.string().optional(), // Decimal fields expect strings  
  discount: z.coerce.string().optional(), // Decimal fields expect strings
  visitSchedule: z.string().optional(),
  validityDate: z.string().optional(),
  phaseUpdatedAt: z.string().optional(),
  createdBy: z.string().optional(), // Será preenchido automaticamente no backend
  documents: z.array(z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    type: z.string(),
    url: z.string()
  })).optional().default([]),
  visitPhotos: z.array(z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    type: z.string(),
    url: z.string()
  })).optional().default([]),
  contract: z.string().nullable().optional(),
});

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  createdAt: true,
});

export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;

// Phases enum
export const PHASES = {
  PROSPECCAO: 'prospeccao',
  EM_ATENDIMENTO: 'em-atendimento',
  VISITA_TECNICA: 'visita-tecnica',
  PROPOSTA: 'proposta',
  NEGOCIACAO: 'negociacao',
  GANHO: 'ganho',
  PERDIDO: 'perdido'
} as const;

export type PhaseType = typeof PHASES[keyof typeof PHASES];

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Email notifications and templates
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  trigger: text("trigger").notNull(), // 'opportunity_created', 'phase_changed', etc.
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  template: text("template"),
  status: text("status").notNull(), // 'sent', 'failed', 'pending'
  error: text("error"),
  opportunityId: varchar("opportunity_id").references(() => opportunities.id),
  sentAt: timestamp("sent_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// User settings and preferences
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  emailNotifications: boolean("email_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  pushNotifications: boolean("push_notifications").default(false),
  autoBackup: boolean("auto_backup").default(true),
  language: text("language").default("pt-BR"),
  timezone: text("timezone").default("America/Sao_Paulo"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Audit logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  action: text("action").notNull(), // 'created', 'updated', 'deleted'
  entity: text("entity").notNull(), // 'opportunity', 'user', etc.
  entityId: text("entity_id").notNull(),
  changes: jsonb("changes"), // Old and new values
  timestamp: timestamp("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Sales performance reports
export const salesReports = pgTable("sales_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  salespersonId: text("salesperson_id").notNull(),
  period: text("period").notNull(), // 'monthly', 'quarterly', 'yearly'
  year: integer("year").notNull(),
  month: integer("month"), // null for yearly reports
  totalOpportunities: integer("total_opportunities").default(0),
  wonOpportunities: integer("won_opportunities").default(0),
  lostOpportunities: integer("lost_opportunities").default(0),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).default("0"),
  wonValue: decimal("won_value", { precision: 12, scale: 2 }).default("0"),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0"),
  avgDealSize: decimal("avg_deal_size", { precision: 12, scale: 2 }).default("0"),
  generatedAt: timestamp("generated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// System backups
export const systemBackups = pgTable("system_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  size: integer("size").notNull(),
  type: text("type").notNull(), // 'manual', 'automatic'
  status: text("status").notNull(), // 'completed', 'failed', 'in_progress'
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  name: varchar("name").notNull(),
  phone: varchar("phone"),
  bio: text("bio"),
  role: varchar("role").notNull().default("usuario"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginCredentials = z.infer<typeof loginSchema>;

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'gerente',
  USER: 'usuario'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Saved Reports table
export const savedReports = pgTable("saved_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("custom"), // custom, performance, pipeline, analysis
  filters: jsonb("filters").notNull(), // Stores filter configuration
  charts: jsonb("charts").notNull(), // Stores chart configuration
  layout: jsonb("layout").notNull(), // Stores layout configuration
  isPublic: boolean("is_public").default(false), // If report is shared with all users
  createdBy: text("created_by").notNull(),
  lastGenerated: timestamp("last_generated"),
  autoRefresh: boolean("auto_refresh").default(true),
  refreshInterval: integer("refresh_interval").default(30), // minutes
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSavedReportSchema = createInsertSchema(savedReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastGenerated: true,
});

export const updateSavedReportSchema = createInsertSchema(savedReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
}).partial();

export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;
export type UpdateSavedReport = z.infer<typeof updateSavedReportSchema>;
export type SavedReport = typeof savedReports.$inferSelect;

// Report categories
export const REPORT_CATEGORIES = {
  CUSTOM: 'custom',
  PERFORMANCE: 'performance', 
  PIPELINE: 'pipeline',
  ANALYSIS: 'analysis'
} as const;

export type ReportCategory = typeof REPORT_CATEGORIES[keyof typeof REPORT_CATEGORIES];

// Schemas for new tables
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertSalesReportSchema = createInsertSchema(salesReports).omit({
  id: true,
  generatedAt: true,
});

export const insertSystemBackupSchema = createInsertSchema(systemBackups).omit({
  id: true,
  createdAt: true,
});

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertSalesReport = z.infer<typeof insertSalesReportSchema>;
export type SalesReport = typeof salesReports.$inferSelect;
export type EmailLog = typeof emailLogs.$inferSelect;
export type SystemBackup = typeof systemBackups.$inferSelect;