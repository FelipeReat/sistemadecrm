import { type Opportunity, type InsertOpportunity, type Automation, type InsertAutomation, type User, type InsertUser, type UpdateUser, type SavedReport, type InsertSavedReport, type UpdateSavedReport, type UserSettings, type InsertUserSettings, type EmailTemplate, type InsertEmailTemplate, type AuditLog, type SalesReport, type SystemBackup } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Opportunities CRUD
  getOpportunities(): Promise<Opportunity[]>;
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity>;
  updateOpportunity(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined>;
  deleteOpportunity(id: string): Promise<boolean>;
  getOpportunitiesByPhase(phase: string): Promise<Opportunity[]>;
  moveOpportunityToPhase(id: string, phase: string): Promise<Opportunity | undefined>;

  // Automations CRUD
  getAutomations(): Promise<Automation[]>;
  getAutomationsByPhase(phase: string): Promise<Automation[]>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  deleteAutomation(id: string): Promise<boolean>;

  // Users CRUD
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  validateUserPassword(email: string, password: string): Promise<User | null>;

  // Saved Reports CRUD
  getSavedReports(): Promise<SavedReport[]>;
  getSavedReport(id: string): Promise<SavedReport | undefined>;
  getSavedReportsByUser(userId: string): Promise<SavedReport[]>;
  getSavedReportsByCategory(category: string): Promise<SavedReport[]>;
  createSavedReport(report: InsertSavedReport): Promise<SavedReport>;
  updateSavedReport(id: string, updates: UpdateSavedReport): Promise<SavedReport | undefined>;
  deleteSavedReport(id: string): Promise<boolean>;
  updateReportLastGenerated(id: string): Promise<SavedReport | undefined>;

  // User Settings CRUD
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  getSystemSettings(): Promise<{ settingKey: string; settingValue: string }[]>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;

  // Email Templates CRUD
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateByTrigger(trigger: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: string): Promise<boolean>;

  // Audit Logs
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getEntityAuditLogs(entity: string, entityId: string, limit?: number): Promise<AuditLog[]>;
  getUserAuditLogs(userId: string, limit?: number): Promise<AuditLog[]>;

  // Sales Reports
  getSalesReports(period?: string, year?: number, month?: number): Promise<SalesReport[]>;
  getSalespersonReports(salespersonId: string, months?: number): Promise<SalesReport[]>;
  getTopPerformers(period?: string, limit?: number): Promise<SalesReport[]>;

  // System Backups
  getSystemBackups(limit?: number): Promise<SystemBackup[]>;
  getSystemBackup(id: string): Promise<SystemBackup | undefined>;

  // Methods to clear all data
  clearAllOpportunities(): Promise<number>;
  clearAllAutomations(): Promise<number>;
  clearAllSavedReports(): Promise<number>;
}

export class MemStorage implements IStorage {
  private opportunities: Map<string, Opportunity>;
  private automations: Map<string, Automation>;
  private users: Map<string, User>;
  private savedReports: Map<string, SavedReport>;

  constructor() {
    this.opportunities = new Map();
    this.automations = new Map();
    this.users = new Map();
    this.savedReports = new Map();

    // Criar usuário admin padrão
    this.initializeDefaultAdmin();
  }

  private async initializeDefaultAdmin() {
    const adminExists = Array.from(this.users.values()).some(user => user.role === 'admin');
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminUser: User = {
        id: randomUUID(),
        email: 'admin@crm.com',
        password: hashedPassword,
        name: 'Administrador',
        phone: null,
        bio: null,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(adminUser.id, adminUser);
    }
  }

  async getOpportunities(): Promise<Opportunity[]> {
    return Array.from(this.opportunities.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    return this.opportunities.get(id);
  }

  async createOpportunity(insertOpportunity: InsertOpportunity): Promise<Opportunity> {
    const id = randomUUID();
    const now = new Date();

    // Preserve all essential information passed in the insert data
    const opportunity: Opportunity = { 
      id,
      createdAt: now,
      updatedAt: now,
      phaseUpdatedAt: now,
      // Core contact information - always preserve these
      contact: insertOpportunity.contact || "Não informado",
      company: insertOpportunity.company || "Não informado",
      phone: insertOpportunity.phone || null,
      cpf: insertOpportunity.cpf || null,
      cnpj: insertOpportunity.cnpj || null,

      // Business details - preserve all provided data
      hasRegistration: insertOpportunity.hasRegistration || false,
      proposalOrigin: insertOpportunity.proposalOrigin || null,
      businessTemperature: insertOpportunity.businessTemperature || 'morno',
      needCategory: insertOpportunity.needCategory || null,
      clientNeeds: insertOpportunity.clientNeeds || null,

      // Documents - preserve properly formatted
      documents: insertOpportunity.documents ? 
        insertOpportunity.documents.map(doc => 
          typeof doc === 'string' ? doc : JSON.stringify(doc)
        ) : null,

      // Phase and workflow
      phase: insertOpportunity.phase || 'prospeccao',
      createdBy: insertOpportunity.createdBy || 'system',

      // Prospection phase data
      opportunityNumber: insertOpportunity.opportunityNumber || null,
      salesperson: insertOpportunity.salesperson || null,
      requiresVisit: insertOpportunity.requiresVisit || false,
      statement: insertOpportunity.statement || null,

      // Visit technical data
      visitSchedule: insertOpportunity.visitSchedule || null,
      visitDate: insertOpportunity.visitDate || null,
      visitPhotos: insertOpportunity.visitPhotos ? 
        insertOpportunity.visitPhotos.map(photo => 
          typeof photo === 'string' ? photo : JSON.stringify(photo)
        ) : null,

      // Proposal data
      discount: insertOpportunity.discount || null,
      discountDescription: insertOpportunity.discountDescription || null,
      validityDate: insertOpportunity.validityDate ? new Date(insertOpportunity.validityDate) : null,
      budgetNumber: insertOpportunity.budgetNumber || null,
      budget: insertOpportunity.budget || null,

      // Negotiation data
      status: insertOpportunity.status || null,
      finalValue: insertOpportunity.finalValue || null,
      negotiationInfo: insertOpportunity.negotiationInfo || null,
      contract: insertOpportunity.contract || null,
      invoiceNumber: insertOpportunity.invoiceNumber || null,
      lossReason: insertOpportunity.lossReason || null,
      lossObservation: insertOpportunity.lossObservation || null,

      // Import tracking data
      isImported: insertOpportunity.isImported || false,
      importBatchId: insertOpportunity.importBatchId || null,
      importSource: insertOpportunity.importSource || null,
    };

    this.opportunities.set(id, opportunity);
    return opportunity;
  }

  async updateOpportunity(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    const existing = this.opportunities.get(id);
    if (!existing) return undefined;

    // ESTRATÉGIA DE PRESERVAÇÃO TOTAL - nunca perder dados de fases anteriores
    const preservedData: Partial<Opportunity> = {};

    // Lista de todos os campos que devem ser preservados se já existirem
    const fieldsToPreserve = [
      'contact', 'company', 'phone', 'cpf', 'cnpj', 'hasRegistration',
      'proposalOrigin', 'businessTemperature', 'needCategory', 'clientNeeds',
      'documents', 'visitPhotos', 'createdBy', 'createdAt',
      'opportunityNumber', 'salesperson', 'requiresVisit', 'statement',
      'visitSchedule', 'visitDate', 'visitDescription', 'visitRealization',
      'budget', 'budgetNumber', 'validityDate', 'discount', 'discountDescription',
      'finalValue', 'negotiationInfo', 'status', 'contract', 'invoiceNumber',
      'lossReason', 'lossObservation', 'nextActivityDate',
      'isImported', 'importBatchId', 'importSource'
    ];

    // Preservar todos os campos que já existem e não estão sendo explicitamente atualizados
    fieldsToPreserve.forEach(field => {
      const fieldKey = field as keyof Opportunity;
      if (!updates.hasOwnProperty(field) && existing[fieldKey] !== null && existing[fieldKey] !== undefined) {
        // Para campos de array, preservar se não estiver vazio
        if (Array.isArray(existing[fieldKey])) {
          if ((existing[fieldKey] as any[]).length > 0) {
            (preservedData as any)[field] = existing[fieldKey];
          }
        } else {
          // Para outros campos, preservar se tiver valor
          if (existing[fieldKey] !== '' && existing[fieldKey] !== null && existing[fieldKey] !== undefined) {
            (preservedData as any)[field] = existing[fieldKey];
          }
        }
      }
    });

    // Lógica especial para campos críticos que nunca devem ser perdidos
    const criticalFields = ['contact', 'company', 'businessTemperature', 'needCategory', 'clientNeeds', 'documents', 'isImported', 'importBatchId', 'importSource'];
    criticalFields.forEach(field => {
      const fieldKey = field as keyof Opportunity;
      if (existing[fieldKey] && (!updates.hasOwnProperty(field) || !updates[field as keyof typeof updates])) {
        (preservedData as any)[field] = existing[fieldKey];
      }
    });

    // Preservar dados específicos por fase que devem permanecer visíveis
    const phaseSpecificData: Record<string, string[]> = {
      'prospeccao': ['opportunityNumber', 'salesperson', 'requiresVisit'],
      'em-atendimento': ['statement'],
      'visita-tecnica': ['visitSchedule', 'visitDate', 'visitDescription', 'visitRealization', 'visitPhotos'],
      'proposta': ['budget', 'budgetNumber', 'validityDate', 'discount', 'discountDescription'],
      'negociacao': ['finalValue', 'negotiationInfo', 'status', 'contract', 'invoiceNumber'],
      'perdido': ['lossReason', 'lossObservation']
    };

    // Preservar dados de todas as fases anteriores
    Object.values(phaseSpecificData).flat().forEach(field => {
      const fieldKey = field as keyof Opportunity;
      if (existing[fieldKey] && !updates.hasOwnProperty(field)) {
        (preservedData as any)[field] = existing[fieldKey];
      }
    });

    const updated: Opportunity = {
      ...existing,
      ...preservedData, // Aplicar dados preservados primeiro
      ...updates, // Depois aplicar atualizações
      phaseUpdatedAt: updates.phase !== existing.phase ? new Date() : existing.phaseUpdatedAt,
      updatedAt: new Date()
    } as Opportunity;

    // Log para debug das preservações
    console.log(`📝 Atualizando oportunidade ${id}:`);
    console.log(`- Fase: ${existing.phase} → ${updated.phase || existing.phase}`);
    console.log(`- Dados preservados: ${Object.keys(preservedData).length} campos`);
    console.log(`- Dados atualizados: ${Object.keys(updates).length} campos`);

    this.opportunities.set(id, updated);
    return updated;
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    console.log(`🗂️  MemStorage: Executando DELETE para oportunidade ${id}`);
    const existed = this.opportunities.has(id);
    const wasDeleted = this.opportunities.delete(id);
    console.log(`🗂️  MemStorage: Oportunidade existia: ${existed}, foi removida: ${wasDeleted}`);
    return wasDeleted;
  }

  async getOpportunitiesByPhase(phase: string): Promise<Opportunity[]> {
    return Array.from(this.opportunities.values())
      .filter(opportunity => opportunity.phase === phase)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async moveOpportunityToPhase(id: string, phase: string): Promise<Opportunity | undefined> {
    // Permitir movimentação para qualquer fase, incluindo "perdido" sem validação de campos
    return this.updateOpportunity(id, { phase });
  }

  async getAutomations(): Promise<Automation[]> {
    return Array.from(this.automations.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getAutomationsByPhase(phase: string): Promise<Automation[]> {
    return Array.from(this.automations.values())
      .filter(automation => automation.phase === phase)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createAutomation(insertAutomation: InsertAutomation): Promise<Automation> {
    const id = randomUUID();
    const automation: Automation = { 
      ...insertAutomation, 
      id,
      createdAt: new Date()
    };
    this.automations.set(id, automation);
    return automation;
  }

  async deleteAutomation(id: string): Promise<boolean> {
    return this.automations.delete(id);
  }

  // Users operations
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);

    const user: User = {
      id,
      email: insertUser.email,
      password: hashedPassword,
      name: insertUser.name,
      phone: insertUser.phone || null,
      bio: insertUser.bio || null,
      role: insertUser.role || 'usuario',
      isActive: insertUser.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;

    const updatedUser: User = {
      ...existing,
      ...updates,
      password: updates.password ? await bcrypt.hash(updates.password, 10) : existing.password,
      updatedAt: new Date()
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async validateUserPassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    // Removed admin login details from the login screen
    if (!user || !user.isActive || user.role === 'admin') return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    return isPasswordValid ? user : null;
  }

  // Saved Reports CRUD methods
  async getSavedReports(): Promise<SavedReport[]> {
    return Array.from(this.savedReports.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getSavedReport(id: string): Promise<SavedReport | undefined> {
    return this.savedReports.get(id);
  }

  async getSavedReportsByUser(userId: string): Promise<SavedReport[]> {
    return Array.from(this.savedReports.values())
      .filter(report => report.createdBy === userId || report.isPublic)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getSavedReportsByCategory(category: string): Promise<SavedReport[]> {
    return Array.from(this.savedReports.values())
      .filter(report => report.category === category)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async createSavedReport(insertReport: InsertSavedReport): Promise<SavedReport> {
    const id = randomUUID();
    const now = new Date();

    const report: SavedReport = {
      id,
      name: insertReport.name,
      description: insertReport.description || null,
      category: insertReport.category || 'custom',
      filters: insertReport.filters,
      charts: insertReport.charts,
      layout: insertReport.layout,
      isPublic: insertReport.isPublic || false,
      createdBy: insertReport.createdBy,
      lastGenerated: null,
      autoRefresh: insertReport.autoRefresh ?? true,
      refreshInterval: insertReport.refreshInterval || 30,
      createdAt: now,
      updatedAt: now,
    };

    this.savedReports.set(id, report);
    return report;
  }

  async updateSavedReport(id: string, updates: UpdateSavedReport): Promise<SavedReport | undefined> {
    const existing = this.savedReports.get(id);
    if (!existing) return undefined;

    const updated: SavedReport = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    this.savedReports.set(id, updated);
    return updated;
  }

  async deleteSavedReport(id: string): Promise<boolean> {
    return this.savedReports.delete(id);
  }

  async updateReportLastGenerated(id: string): Promise<SavedReport | undefined> {
    const existing = this.savedReports.get(id);
    if (!existing) return undefined;

    const updated: SavedReport = {
      ...existing,
      lastGenerated: new Date(),
      updatedAt: new Date()
    };

    this.savedReports.set(id, updated);
    return updated;
  }

  // Methods to clear all data
  async clearAllOpportunities(): Promise<number> {
    const count = this.opportunities.size;
    this.opportunities.clear();
    return count;
  }

  async clearAllAutomations(): Promise<number> {
    const count = this.automations.size;
    this.automations.clear();
    return count;
  }

  async clearAllSavedReports(): Promise<number> {
    const count = this.savedReports.size;
    this.savedReports.clear();
    return count;
  }
}

import { postgresStorage } from './postgres-storage';

export const storage = postgresStorage;