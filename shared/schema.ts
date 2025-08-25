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
  nextActivityDate: timestamp("next_activity_date"),
  
  // Fase 4: Visita Técnica
  visitSchedule: timestamp("visit_schedule"),
  visitRealization: timestamp("visit_realization"),
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
  
  // Timestamps
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phase: text("phase").notNull(),
  trigger: text("trigger").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  name: varchar("name").notNull(),
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
