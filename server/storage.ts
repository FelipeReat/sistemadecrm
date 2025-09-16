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
    };
    
    this.opportunities.set(id, opportunity);
    return opportunity;
  }

  async updateOpportunity(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    const existing = this.opportunities.get(id);
    if (!existing) return undefined;
    
    // Preserve ALL essential data that should never be lost during phase transitions
    const preservedData: Partial<Opportunity> = {};
    
    // Core information - ALWAYS preserve unless explicitly being updated
    if (!updates.hasOwnProperty('contact') && existing.contact) {
      preservedData.contact = existing.contact;
    }
    if (!updates.hasOwnProperty('company') && existing.company) {
      preservedData.company = existing.company;
    }
    if (!updates.hasOwnProperty('phone') && existing.phone) {
      preservedData.phone = existing.phone;
    }
    if (!updates.hasOwnProperty('cpf') && existing.cpf) {
      preservedData.cpf = existing.cpf;
    }
    if (!updates.hasOwnProperty('cnpj') && existing.cnpj) {
      preservedData.cnpj = existing.cnpj;
    }
    
    // Business information - ALWAYS preserve unless explicitly being updated
    if (!updates.hasOwnProperty('businessTemperature') && existing.businessTemperature) {
      preservedData.businessTemperature = existing.businessTemperature;
    }
    if (!updates.hasOwnProperty('needCategory') && existing.needCategory) {
      preservedData.needCategory = existing.needCategory;
    }
    if (!updates.hasOwnProperty('clientNeeds') && existing.clientNeeds) {
      preservedData.clientNeeds = existing.clientNeeds;
    }
    if (!updates.hasOwnProperty('proposalOrigin') && existing.proposalOrigin) {
      preservedData.proposalOrigin = existing.proposalOrigin;
    }
    if (!updates.hasOwnProperty('hasRegistration') && existing.hasRegistration !== undefined) {
      preservedData.hasRegistration = existing.hasRegistration;
    }
    
    // Documents and files - ALWAYS preserve unless explicitly being updated
    if (!updates.hasOwnProperty('documents') && existing.documents) {
      preservedData.documents = existing.documents;
    }
    if (!updates.hasOwnProperty('visitPhotos') && existing.visitPhotos) {
      preservedData.visitPhotos = existing.visitPhotos;
    }
    
    // Audit information - ALWAYS preserve
    if (existing.createdBy) {
      preservedData.createdBy = existing.createdBy;
    }
    if (existing.createdAt) {
      preservedData.createdAt = existing.createdAt;
    }
    
    // Phase-specific data - preserve unless being updated
    if (!updates.hasOwnProperty('opportunityNumber') && existing.opportunityNumber) {
      preservedData.opportunityNumber = existing.opportunityNumber;
    }
    if (!updates.hasOwnProperty('salesperson') && existing.salesperson) {
      preservedData.salesperson = existing.salesperson;
    }
    if (!updates.hasOwnProperty('requiresVisit') && existing.requiresVisit !== undefined) {
      preservedData.requiresVisit = existing.requiresVisit;
    }
    if (!updates.hasOwnProperty('statement') && existing.statement) {
      preservedData.statement = existing.statement;
    }
    if (!updates.hasOwnProperty('visitSchedule') && existing.visitSchedule) {
      preservedData.visitSchedule = existing.visitSchedule;
    }
    if (!updates.hasOwnProperty('visitDate') && existing.visitDate) {
      preservedData.visitDate = existing.visitDate;
    }
    if (!updates.hasOwnProperty('visitDescription') && existing.visitDescription) {
      preservedData.visitDescription = existing.visitDescription;
    }
    if (!updates.hasOwnProperty('budget') && existing.budget) {
      preservedData.budget = existing.budget;
    }
    if (!updates.hasOwnProperty('budgetNumber') && existing.budgetNumber) {
      preservedData.budgetNumber = existing.budgetNumber;
    }
    if (!updates.hasOwnProperty('validityDate') && existing.validityDate) {
      preservedData.validityDate = existing.validityDate;
    }
    if (!updates.hasOwnProperty('discount') && existing.discount) {
      preservedData.discount = existing.discount;
    }
    if (!updates.hasOwnProperty('discountDescription') && existing.discountDescription) {
      preservedData.discountDescription = existing.discountDescription;
    }
    if (!updates.hasOwnProperty('finalValue') && existing.finalValue) {
      preservedData.finalValue = existing.finalValue;
    }
    if (!updates.hasOwnProperty('negotiationInfo') && existing.negotiationInfo) {
      preservedData.negotiationInfo = existing.negotiationInfo;
    }
    if (!updates.hasOwnProperty('status') && existing.status) {
      preservedData.status = existing.status;
    }
    if (!updates.hasOwnProperty('contract') && existing.contract) {
      preservedData.contract = existing.contract;
    }
    if (!updates.hasOwnProperty('invoiceNumber') && existing.invoiceNumber) {
      preservedData.invoiceNumber = existing.invoiceNumber;
    }
    if (!updates.hasOwnProperty('lossReason') && existing.lossReason) {
      preservedData.lossReason = existing.lossReason;
    }
    if (!updates.hasOwnProperty('lossObservation') && existing.lossObservation) {
      preservedData.lossObservation = existing.lossObservation;
    }
    
    const updated: Opportunity = {
      ...existing,
      ...preservedData, // Apply preserved data first
      ...updates, // Then apply updates
      phaseUpdatedAt: updates.phase !== existing.phase ? new Date() : existing.phaseUpdatedAt,
      updatedAt: new Date()
    } as Opportunity;
    
    this.opportunities.set(id, updated);
    return updated;
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    return this.opportunities.delete(id);
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
    if (!user || !user.isActive) return null;
    
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
}

export const storage = new MemStorage();
