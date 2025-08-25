import { type Opportunity, type InsertOpportunity, type Automation, type InsertAutomation } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private opportunities: Map<string, Opportunity>;
  private automations: Map<string, Automation>;

  constructor() {
    this.opportunities = new Map();
    this.automations = new Map();
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
}

export const storage = new MemStorage();
