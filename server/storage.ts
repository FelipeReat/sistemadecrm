import { type Opportunity, type InsertOpportunity, type Automation, type InsertAutomation, type User, type InsertUser, type UpdateUser } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private opportunities: Map<string, Opportunity>;
  private automations: Map<string, Automation>;
  private users: Map<string, User>;

  constructor() {
    this.opportunities = new Map();
    this.automations = new Map();
    this.users = new Map();
    
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
    const opportunity: Opportunity = { 
      ...insertOpportunity,
      cpf: insertOpportunity.cpf || null,
      cnpj: insertOpportunity.cnpj || null,
      hasRegistration: insertOpportunity.hasRegistration || false,
      proposalOrigin: insertOpportunity.proposalOrigin || null,
      businessTemperature: insertOpportunity.businessTemperature || null,
      documents: insertOpportunity.documents || [],
      opportunityNumber: insertOpportunity.opportunityNumber || null,
      salesperson: insertOpportunity.salesperson || null,
      requiresVisit: insertOpportunity.requiresVisit || false,
      statement: insertOpportunity.statement || null,
      nextActivityDate: insertOpportunity.nextActivityDate || null,
      visitSchedule: insertOpportunity.visitSchedule || null,
      visitRealization: insertOpportunity.visitRealization || null,
      visitPhotos: insertOpportunity.visitPhotos || [],
      discount: insertOpportunity.discount || null,
      discountDescription: insertOpportunity.discountDescription || null,
      validityDate: insertOpportunity.validityDate || null,
      budgetNumber: insertOpportunity.budgetNumber || null,
      budget: insertOpportunity.budget || null,
      budgetFile: insertOpportunity.budgetFile || null,
      status: insertOpportunity.status || null,
      finalValue: insertOpportunity.finalValue || null,
      negotiationInfo: insertOpportunity.negotiationInfo || null,
      contract: insertOpportunity.contract || null,
      invoiceNumber: insertOpportunity.invoiceNumber || null,
      lossReason: insertOpportunity.lossReason || null,
      phase: insertOpportunity.phase || 'prospeccao',
      id,
      createdAt: now,
      updatedAt: now
    };
    this.opportunities.set(id, opportunity);
    return opportunity;
  }

  async updateOpportunity(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    const existing = this.opportunities.get(id);
    if (!existing) return undefined;
    
    const updated: Opportunity = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
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
}

export const storage = new MemStorage();
