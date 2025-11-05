import { type Opportunity, type InsertOpportunity, type Automation, type InsertAutomation, type User, type UpdateUser, type SavedReport, type InsertSavedReport, type UserSettings, type InsertUserSettings, type EmailTemplate, type InsertEmailTemplate, type AuditLog, type SalesReport, type SystemBackup } from "@shared/schema";
import { db } from './db';
import { opportunities, automations, users, savedReports, userSettings, emailTemplates, auditLogs, salesReports, systemBackups, emailLogs } from '@shared/schema';
import { eq, desc, and, count, sum, sql } from 'drizzle-orm';
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { IStorage } from './storage';
import { getPgPool, createDirectConnection } from "./pg-pool";
import { log } from "./vite";

export class PostgresStorage implements IStorage {
  private adminInitialized = false;

  constructor() {
    // Inicializar admin de forma assíncrona e segura
    this.safeInitializeDefaultAdmin();
  }

  private safeInitializeDefaultAdmin() {
    // Usar setTimeout para evitar bloquear o construtor
    setTimeout(async () => {
      if (!this.adminInitialized) {
        try {
          await this.initializeDefaultAdmin();
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Erro na inicialização segura do admin:', error);
          }
          // Tenta novamente após 10 segundos com backoff exponencial
          setTimeout(() => this.safeInitializeDefaultAdmin(), 10000);
        }
      }
    }, 2000); // Aguardar 2 segundos para garantir que a conexão esteja estável
  }

  private async initializeDefaultAdmin() {
    if (this.adminInitialized) {
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries && !this.adminInitialized) {
      const client = createDirectConnection();
      try {
        // Aguarda um pouco antes de cada tentativa
        if (retryCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        }

        await client.connect();

        const result = await client.query('SELECT * FROM users WHERE role = $1', ['admin']);

        if (result.rows.length === 0) {
          const hashedPassword = await bcrypt.hash('admin123', 10);
          await client.query(
            'INSERT INTO users (id, name, email, password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
            [randomUUID(), 'Administrador', 'admin@crm.com', hashedPassword, 'admin', true]
          );
        }

        await client.end();
        this.adminInitialized = true;
        break;

      } catch (error: any) {
        await client.end().catch(() => {}); // Garantir que a conexão seja fechada
        retryCount++;
        console.error(`❌ Erro ao inicializar admin padrão (tentativa ${retryCount}/${maxRetries}):`, error.message);

        // Se é um erro de conexão, aguarda mais tempo
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
          }
        } else if (retryCount >= maxRetries) {
          console.error('Máximo de tentativas atingido. Admin não foi inicializado.');
          this.adminInitialized = false;
        }
      }
    }
  }

  // Opportunities CRUD
  async getOpportunities(): Promise<Opportunity[]> {
    try {
      const result = await db
        .select()
        .from(opportunities)
        .leftJoin(users, eq(opportunities.salesperson, users.id))
        .orderBy(desc(opportunities.createdAt));

      // Mapear o resultado para incluir o nome do vendedor
      return result.map(row => {
        const opportunity = row.opportunities;
        let salespersonName = opportunity.salesperson;

        // Se encontrou um usuário no JOIN, usar o nome do usuário
        if (row.users?.name) {
          salespersonName = row.users.name;
        } else {
          // Se não encontrou no JOIN, verificar se o salesperson já é um nome (não UUID)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opportunity.salesperson || '');
          if (!isUUID && opportunity.salesperson) {
            // Se não é UUID, provavelmente já é um nome
            salespersonName = opportunity.salesperson;
          } else {
            // Se é UUID mas não encontrou no JOIN, manter o UUID
            salespersonName = opportunity.salesperson || 'Vendedor não identificado';
          }
        }

        return {
          ...opportunity,
          salesperson: salespersonName,
        };
      });
    } catch (error) {
      console.error('Error getting opportunities:', error);
      return [];
    }
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    try {
      const result = await db
        .select()
        .from(opportunities)
        .leftJoin(users, eq(opportunities.salesperson, users.id))
        .where(eq(opportunities.id, id))
        .limit(1);

      if (!result[0]) return undefined;

      const opportunity = result[0].opportunities;
      let salespersonName = opportunity.salesperson;

      // Se encontrou um usuário no JOIN, usar o nome do usuário
      if (result[0].users?.name) {
        salespersonName = result[0].users.name;
      } else {
        // Se não encontrou no JOIN, verificar se o salesperson já é um nome (não UUID)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opportunity.salesperson || '');
        if (!isUUID && opportunity.salesperson) {
          // Se não é UUID, provavelmente já é um nome
          salespersonName = opportunity.salesperson;
        } else {
          // Se é UUID mas não encontrou no JOIN, manter o UUID
          salespersonName = opportunity.salesperson || 'Vendedor não identificado';
        }
      }

      return {
        ...opportunity,
        salesperson: salespersonName,
      };
    } catch (error) {
      console.error('Error getting opportunity:', error);
      return undefined;
    }
  }

  async createOpportunity(insertOpportunity: InsertOpportunity): Promise<Opportunity> {
    try {
      const id = randomUUID();
      const now = new Date();

      // CRITICAL FIX: Garantir que createdByName nunca seja nulo/undefined/vazio
      let finalCreatedByName = insertOpportunity.createdByName;
      
      console.log('🔍 [STORAGE] Debug createdByName:', {
        original: insertOpportunity.createdByName,
        createdBy: insertOpportunity.createdBy,
        finalCreatedByName: finalCreatedByName
      });
      
      // Múltiplos níveis de fallback com validação mais rigorosa
      if (!finalCreatedByName || typeof finalCreatedByName !== 'string' || finalCreatedByName.trim() === '' || finalCreatedByName === 'null' || finalCreatedByName === 'undefined') {
        finalCreatedByName = insertOpportunity.createdBy;
        console.log('🔄 [STORAGE] Usando createdBy como fallback:', finalCreatedByName);
      }
      
      if (!finalCreatedByName || typeof finalCreatedByName !== 'string' || finalCreatedByName.trim() === '' || finalCreatedByName === 'null' || finalCreatedByName === 'undefined') {
        finalCreatedByName = 'Sistema Padrão';
        console.log('🔄 [STORAGE] Usando Sistema Padrão como fallback');
      }
      
      // Garantia final - forçar string não vazia
      if (!finalCreatedByName || typeof finalCreatedByName !== 'string') {
        finalCreatedByName = 'Sistema Emergencial';
        console.log('🔄 [STORAGE] Usando Sistema Emergencial como fallback');
      }
      
      // Trim e validação final
      finalCreatedByName = finalCreatedByName.toString().trim();
      if (finalCreatedByName === '' || finalCreatedByName === 'null' || finalCreatedByName === 'undefined') {
        finalCreatedByName = 'Sistema Crítico';
        console.log('🔄 [STORAGE] Usando Sistema Crítico como fallback');
      }
      
      console.log('✅ [STORAGE] Nome final definido:', finalCreatedByName);

      const opportunity: Opportunity = { 
        id,
        createdAt: now,
        updatedAt: now,
        phaseUpdatedAt: now,
        // Core contact information
        contact: insertOpportunity.contact || "Não informado",
        company: insertOpportunity.company || "Não informado",
        phone: insertOpportunity.phone || null, // Preservar o telefone se fornecido
        cpf: insertOpportunity.cpf || null,
        cnpj: insertOpportunity.cnpj || null,

        // Business details
        hasRegistration: insertOpportunity.hasRegistration || false,
        proposalOrigin: insertOpportunity.proposalOrigin || null,
        businessTemperature: insertOpportunity.businessTemperature || 'morno',
        needCategory: insertOpportunity.needCategory || null,
        clientNeeds: insertOpportunity.clientNeeds || null,

        // Documents
        documents: insertOpportunity.documents ? 
          insertOpportunity.documents.map(doc => 
            typeof doc === 'string' ? doc : JSON.stringify(doc)
          ) : null,

        // Phase and workflow
        phase: insertOpportunity.phase || 'prospeccao',
        createdBy: insertOpportunity.createdBy || 'system',
        createdByName: finalCreatedByName,
        

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

        // Import tracking fields
        isImported: insertOpportunity.isImported || false,
        importBatchId: insertOpportunity.importBatchId || null,
        importSource: insertOpportunity.importSource || null,
      };

      
      // CRITICAL FIX: Use the createdByName that was already properly set in routes.ts
      const insertData = {
        ...opportunity,
        // Map JavaScript field to database column - use the value from opportunity object
        created_by_name: opportunity.createdByName || insertOpportunity.createdByName || insertOpportunity.createdBy || 'Sistema'
      };
      
      // FINAL VALIDATION: Ensure created_by_name is NEVER null
      if (!insertData.created_by_name || insertData.created_by_name.trim() === '') {
        insertData.created_by_name = 'Sistema';
        console.error(`❌ [STORAGE] CRITICAL: created_by_name was null/empty, forcing to 'Sistema'`);
      }
      
      console.log(`🔍 [STORAGE] Final insert data: createdBy=${insertData.createdBy}, created_by_name=${insertData.created_by_name}, originalCreatedByName=${opportunity.createdByName}`);
      process.stderr.write(`🔍 STDERR [STORAGE]: created_by_name=${insertData.created_by_name}, originalCreatedByName=${opportunity.createdByName}\n`);
      
      const result = await db
        .insert(opportunities)
        .values(insertData)
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error creating opportunity:', error);
      throw error;
    }
  }

  // Bulk insert method for improved import performance
  async createOpportunitiesBulk(insertOpportunities: InsertOpportunity[]): Promise<{ created: number; errors: any[] }> {
    if (!insertOpportunities || insertOpportunities.length === 0) {
      return { created: 0, errors: [] };
    }

    const errors: any[] = [];
    let created = 0;

    try {
      const now = new Date();
      const insertDataArray: any[] = [];

      // Process all opportunities and prepare for bulk insert
      for (let i = 0; i < insertOpportunities.length; i++) {
        const insertOpportunity = insertOpportunities[i];
        
        try {
          const id = randomUUID();

          // CRITICAL FIX: Garantir que createdByName nunca seja nulo/undefined/vazio
          let finalCreatedByName = insertOpportunity.createdByName;
          
          console.log(`🔍 [BULK] Processing item ${i}: createdByName="${finalCreatedByName}", createdBy="${insertOpportunity.createdBy}"`);
          
          // Múltiplos níveis de fallback com validação mais rigorosa
          if (!finalCreatedByName || typeof finalCreatedByName !== 'string' || finalCreatedByName.trim() === '' || finalCreatedByName === 'null' || finalCreatedByName === 'undefined') {
            finalCreatedByName = insertOpportunity.createdBy;
            console.log(`🔄 [BULK] Fallback 1 - usando createdBy: "${finalCreatedByName}"`);
          }
          
          if (!finalCreatedByName || typeof finalCreatedByName !== 'string' || finalCreatedByName.trim() === '' || finalCreatedByName === 'null' || finalCreatedByName === 'undefined') {
            finalCreatedByName = 'Sistema Padrão';
            console.log(`🔄 [BULK] Fallback 2 - usando Sistema Padrão`);
          }
          
          // Garantia final - forçar string não vazia
          if (!finalCreatedByName || typeof finalCreatedByName !== 'string') {
            finalCreatedByName = 'Sistema Emergencial';
            console.log(`🔄 [BULK] Fallback 3 - usando Sistema Emergencial`);
          }
          
          // Trim e validação final
          finalCreatedByName = finalCreatedByName.toString().trim();
          if (finalCreatedByName === '' || finalCreatedByName === 'null' || finalCreatedByName === 'undefined') {
            finalCreatedByName = 'Sistema Crítico';
            console.log(`🔄 [BULK] Fallback 4 - usando Sistema Crítico`);
          }
          
          // VALIDAÇÃO FINAL ABSOLUTA - NUNCA PERMITIR NULL
          if (!finalCreatedByName) {
            finalCreatedByName = 'Sistema Forçado';
            console.error(`❌ [BULK] ERRO CRÍTICO: createdByName ainda é null/undefined, forçando valor padrão`);
          }
          
          console.log(`✅ [BULK] Nome final para item ${i}: "${finalCreatedByName}"`);
          
          // VERIFICAÇÃO ADICIONAL ANTES DA INSERÇÃO
          if (!finalCreatedByName || finalCreatedByName === null || finalCreatedByName === undefined) {
            throw new Error(`ERRO CRÍTICO: created_by_name não pode ser null para o item ${i}. Valor atual: ${finalCreatedByName}`);
          }
          
          // VALIDAÇÃO FINAL ABSOLUTA ANTES DE CRIAR O OBJETO
          if (typeof finalCreatedByName !== 'string' || finalCreatedByName.trim() === '') {
            finalCreatedByName = 'Sistema Forçado Final';
            console.error(`❌ [BULK] ERRO CRÍTICO FINAL: created_by_name inválido, forçando valor final`);
          }

          const insertData = {
            id,
            createdAt: now,
            updatedAt: now,
            phaseUpdatedAt: now,
            // Core contact information
            contact: insertOpportunity.contact || "Não informado",
            company: insertOpportunity.company || "Não informado",
            phone: insertOpportunity.phone || null,
            cpf: insertOpportunity.cpf || null,
            cnpj: insertOpportunity.cnpj || null,

            // Business details
            hasRegistration: insertOpportunity.hasRegistration || false,
            proposalOrigin: insertOpportunity.proposalOrigin || null,
            businessTemperature: insertOpportunity.businessTemperature || 'morno',
            needCategory: insertOpportunity.needCategory || null,
            clientNeeds: insertOpportunity.clientNeeds || null,

            // Documents
            documents: insertOpportunity.documents ? 
              insertOpportunity.documents.map(doc => 
                typeof doc === 'string' ? doc : JSON.stringify(doc)
              ) : null,

            // Phase and workflow
            phase: insertOpportunity.phase || 'prospeccao',
            createdBy: insertOpportunity.createdBy || 'system',
            createdByName: finalCreatedByName, // Use Drizzle schema field name

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

            // Import tracking fields
            isImported: insertOpportunity.isImported || false,
            importBatchId: insertOpportunity.importBatchId || null,
            importSource: insertOpportunity.importSource || null,
          };

          insertDataArray.push(insertData);
        } catch (error: any) {
          errors.push({
            index: i,
            message: `Erro ao preparar dados: ${error.message}`,
            data: insertOpportunity
          });
        }
      }

      // OTIMIZAÇÃO CRÍTICA: Desabilitar triggers temporariamente para bulk insert
      if (insertDataArray.length > 0) {
        // Usar transação para garantir consistência e performance
        const result = await db.transaction(async (tx) => {
          // Desabilitar triggers de notificação durante bulk insert
          await tx.execute(sql`
            ALTER TABLE opportunities DISABLE TRIGGER opportunity_insert_trigger;
            ALTER TABLE opportunities DISABLE TRIGGER opportunity_update_trigger;
            ALTER TABLE opportunities DISABLE TRIGGER opportunity_update_timestamps_trigger;
          `);

          try {
            // Executar bulk insert sem triggers
            const insertResult = await tx
              .insert(opportunities)
              .values(insertDataArray)
              .returning();
            
            return insertResult;
          } finally {
            // Reabilitar triggers após bulk insert
            await tx.execute(sql`
              ALTER TABLE opportunities ENABLE TRIGGER opportunity_insert_trigger;
              ALTER TABLE opportunities ENABLE TRIGGER opportunity_update_trigger;
              ALTER TABLE opportunities ENABLE TRIGGER opportunity_update_timestamps_trigger;
            `);
          }
        });
        
        created = result.length;
        
        // Enviar uma única notificação de bulk import para o real-time
        if (created > 0) {
          try {
            await db.execute(sql`
              SELECT pg_notify('opportunity_changes', ${JSON.stringify({
                operation: 'BULK_INSERT',
                table: 'opportunities',
                count: created,
                timestamp: Date.now() / 1000,
                user_id: insertDataArray[0]?.createdBy || 'system',
                import_batch_id: insertDataArray[0]?.importBatchId
              })});
            `);
          } catch (notifyError) {
            // Não falhar o bulk insert por causa da notificação
            console.warn('Aviso: Falha ao enviar notificação de bulk insert:', notifyError);
          }
        }
      }

      return { created, errors };
    } catch (error: any) {
      console.error('Error in bulk insert:', error);
      // If bulk insert fails, add all remaining items as errors
      for (let i = 0; i < insertOpportunities.length; i++) {
        errors.push({
          index: i,
          message: `Erro no bulk insert: ${error.message}`,
          data: insertOpportunities[i]
        });
      }
      return { created, errors };
    }
  }

  async updateOpportunity(id: string, updates: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    for (let retries = 3; retries > 0; retries--) {
      try {
        const updatedData = {
          ...updates,
          updatedAt: new Date()
        };

        // Convert date fields to proper format for PostgreSQL
        // Drizzle with postgres driver needs Date objects, not ISO strings
        const convertToDate = (value: any): Date | null => {
          if (!value) return null;
          if (value instanceof Date) return value;
          if (typeof value === 'string') {
            try {
              const date = new Date(value);
              return isNaN(date.getTime()) ? null : date;
            } catch (e) {
              return null;
            }
          }
          return null;
        };

        if (updatedData.createdAt !== undefined) {
          const convertedDate = convertToDate(updatedData.createdAt);
          if (convertedDate) {
            updatedData.createdAt = convertedDate;
          } else {
            delete updatedData.createdAt;
          }
        }

        if (updatedData.validityDate !== undefined) {
          updatedData.validityDate = convertToDate(updatedData.validityDate);
        }

        if (updatedData.phaseUpdatedAt !== undefined) {
          updatedData.phaseUpdatedAt = convertToDate(updatedData.phaseUpdatedAt);
        }

        // Ensure updatedAt is a proper Date object
        if (updatedData.updatedAt && !(updatedData.updatedAt instanceof Date)) {
          updatedData.updatedAt = new Date(updatedData.updatedAt);
        }

        // Remove undefined values
        Object.keys(updatedData).forEach(key => {
          if (updatedData[key] === undefined) {
            delete updatedData[key];
          }
        });

        // Update the opportunity
        const result = await db
          .update(opportunities)
          .set(updatedData)
          .where(eq(opportunities.id, id))
          .returning();

        if (!result[0]) return undefined;

        // CORREÇÃO: Fazer JOIN para resolver o nome do vendedor imediatamente
        const updatedOpportunityWithJoin = await db
          .select()
          .from(opportunities)
          .leftJoin(users, eq(opportunities.salesperson, users.id))
          .where(eq(opportunities.id, id))
          .limit(1);

        if (!updatedOpportunityWithJoin[0]) return result[0];

        const opportunity = updatedOpportunityWithJoin[0].opportunities;
        let salespersonName = opportunity.salesperson;

        // Se encontrou um usuário no JOIN, usar o nome do usuário
        if (updatedOpportunityWithJoin[0].users?.name) {
          salespersonName = updatedOpportunityWithJoin[0].users.name;
        } else {
          // Se não encontrou no JOIN, verificar se o salesperson já é um nome (não UUID)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opportunity.salesperson || '');
          if (!isUUID && opportunity.salesperson) {
            // Se não é UUID, provavelmente já é um nome
            salespersonName = opportunity.salesperson;
          } else {
            // Se é UUID mas não encontrou no JOIN, manter o UUID
            salespersonName = opportunity.salesperson || 'Vendedor não identificado';
          }
        }

        return {
          ...opportunity,
          salesperson: salespersonName,
        };
      } catch (error: any) {
        console.error('Error updating opportunity, attempt', 4 - retries, ':', error);

        if (retries > 0 && (error?.code === 'ECONNRESET' || error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT')) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
    return undefined;
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    try {
      // Primeiro verificar se a oportunidade existe
      const existingOpportunity = await this.getOpportunity(id);
      if (!existingOpportunity) {
        return false;
      }

      const result = await db
        .delete(opportunities)
        .where(eq(opportunities.id, id));

      // Para Drizzle ORM, verificar se o resultado é truthy ou se existe rowCount
      const wasDeleted = result && (typeof result.rowCount === 'number' ? result.rowCount > 0 : true);

      return wasDeleted;
    } catch (error: any) {
      console.error(`❌ PostgresStorage: Erro ao excluir oportunidade:`, error?.message || error);
      return false;
    }
  }

  async getOpportunitiesByPhase(phase: string): Promise<Opportunity[]> {
    try {
      const result = await db
        .select()
        .from(opportunities)
        .leftJoin(users, eq(opportunities.salesperson, users.id))
        .where(eq(opportunities.phase, phase))
        .orderBy(desc(opportunities.createdAt));

      // Mapear o resultado para incluir o nome do vendedor
      return result.map(row => {
        const opportunity = row.opportunities;
        let salespersonName = opportunity.salesperson;

        // Se encontrou um usuário no JOIN, usar o nome do usuário
        if (row.users?.name) {
          salespersonName = row.users.name;
        } else {
          // Se não encontrou no JOIN, verificar se o salesperson já é um nome (não UUID)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opportunity.salesperson || '');
          if (!isUUID && opportunity.salesperson) {
            // Se não é UUID, provavelmente já é um nome
            salespersonName = opportunity.salesperson;
          } else {
            // Se é UUID mas não encontrou no JOIN, manter o UUID
            salespersonName = opportunity.salesperson || 'Vendedor não identificado';
          }
        }

        return {
          ...opportunity,
          salesperson: salespersonName,
        };
      });
    } catch (error) {
      console.error('Error getting opportunities by phase:', error);
      return [];
    }
  }

  async moveOpportunityToPhase(id: string, phase: string): Promise<Opportunity | undefined> {
    return this.updateOpportunity(id, { phase });
  }

  // Automations CRUD
  async getAutomations(): Promise<Automation[]> {
    try {
      return await db
        .select()
        .from(automations)
        .orderBy(desc(automations.createdAt));
    } catch (error) {
      console.error('Error getting automations:', error);
      return [];
    }
  }

  async getAutomationsByPhase(phase: string): Promise<Automation[]> {
    try {
      return await db
        .select()
        .from(automations)
        .where(eq(automations.phase, phase))
        .orderBy(desc(automations.createdAt));
    } catch (error) {
      console.error('Error getting automations by phase:', error);
      return [];
    }
  }

  async createAutomation(insertAutomation: InsertAutomation): Promise<Automation> {
    try {
      const id = randomUUID();
      const automation: Automation = { 
        ...insertAutomation, 
        id,
        createdAt: new Date()
      };

      const result = await db
        .insert(automations)
        .values(automation)
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error creating automation:', error);
      throw error;
    }
  }

  async deleteAutomation(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(automations)
        .where(eq(automations.id, id));

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting automation:', error);
      return false;
    }
  }

  // Users CRUD
  async getUsers(): Promise<User[]> {
    try {
      return await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt));
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    let retries = 3;
    while (retries > 0) {
      try {
        const result = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        return result[0] || undefined;
      } catch (error: any) {
        retries--;
        console.error(`Error getting user by email (${3 - retries}/3):`, error?.message || error);

        if (retries > 0 && (error?.code === 'ECONNRESET' || error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT')) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return undefined;
      }
    }
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
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

      const result = await db
        .insert(users)
        .values(user)
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    try {
      const updatedData = {
        ...updates,
        password: updates.password ? await bcrypt.hash(updates.password, 10) : undefined,
        updatedAt: new Date()
      };

      // Remove undefined values
      Object.keys(updatedData).forEach(key => {
        if (updatedData[key] === undefined) {
          delete updatedData[key];
        }
      });

      const result = await db
        .update(users)
        .set(updatedData)
        .where(eq(users.id, id))
        .returning();

      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      // Primeiro, verificar se o usuário existe
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (existingUser.length === 0) {
        return false;
      }

      // Executar a exclusão
      await db
        .delete(users)
        .where(eq(users.id, id));
      
      // Verificar se a exclusão foi bem-sucedida verificando se o usuário ainda existe
      const userAfterDelete = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return userAfterDelete.length === 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async validateUserPassword(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user || !user.isActive) return null;

      const isPasswordValid = await bcrypt.compare(password, user.password);
      return isPasswordValid ? user : null;
    } catch (error) {
      console.error('Error validating user password:', error);
      return null;
    }
  }

  // Saved Reports CRUD
  async getSavedReports(): Promise<SavedReport[]> {
    try {
      return await db
        .select()
        .from(savedReports)
        .orderBy(desc(savedReports.updatedAt));
    } catch (error) {
      console.error('Error getting saved reports:', error);
      return [];
    }
  }

  async getSavedReport(id: string): Promise<SavedReport | undefined> {
    try {
      const result = await db
        .select()
        .from(savedReports)
        .where(eq(savedReports.id, id))
        .limit(1);

      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting saved report:', error);
      return undefined;
    }
  }

  async getSavedReportsByUser(userId: string): Promise<SavedReport[]> {
    try {
      return await db
        .select()
        .from(savedReports)
        .where(and(
          eq(savedReports.createdBy, userId)
        ))
        .orderBy(desc(savedReports.updatedAt));
    } catch (error) {
      console.error('Error getting saved reports by user:', error);
      return [];
    }
  }

  async getSavedReportsByCategory(category: string): Promise<SavedReport[]> {
    try {
      return await db
        .select()
        .from(savedReports)
        .where(eq(savedReports.category, category))
        .orderBy(desc(savedReports.updatedAt));
    } catch (error) {
      console.error('Error getting saved reports by category:', error);
      return [];
    }
  }

  async createSavedReport(insertReport: InsertSavedReport): Promise<SavedReport> {
    try {
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

      const result = await db
        .insert(savedReports)
        .values(report)
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error creating saved report:', error);
      throw error;
    }
  }

  async updateSavedReport(id: string, updates: UpdateSavedReport): Promise<SavedReport | undefined> {
    try {
      const updatedData = {
        ...updates,
        updatedAt: new Date()
      };

      const result = await db
        .update(savedReports)
        .set(updatedData)
        .where(eq(savedReports.id, id))
        .returning();

      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating saved report:', error);
      return undefined;
    }
  }

  async deleteSavedReport(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(savedReports)
        .where(eq(savedReports.id, id));

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting saved report:', error);
      return false;
    }
  }

  async updateReportLastGenerated(id: string): Promise<SavedReport | null> {
    const [updated] = await db
      .update(savedReports)
      .set({ lastGenerated: new Date() })
      .where(eq(savedReports.id, id))
      .returning();
    return updated || null;
  }



  async clearAllAutomations(): Promise<number> {
    const result = await db.delete(automations);
    return result.rowCount || 0;
  }

  async clearAllSavedReports(): Promise<number> {
    const result = await db.delete(savedReports);
    return result.rowCount || 0;
  }


  // User Settings CRUD
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

  // System Settings - temporary method to handle system configurations
  async getSystemSettings(): Promise<{ settingKey: string; settingValue: string }[]> {
    try {
      // For now, return hardcoded system settings that allow editing and deletion of imported cards
      return [
        { settingKey: 'allow_imported_card_editing', settingValue: 'true' },
        { settingKey: 'allow_imported_card_deletion', settingValue: 'true' },
        { settingKey: 'imported_card_audit_enabled', settingValue: 'true' }
      ];
    } catch (error) {
      console.error('Error getting system settings:', error);
      return [];
    }
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    try {
      const result = await db
        .insert(userSettings)
        .values(settings)
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error creating user settings:', error);
      throw error;
    }
  }

  async updateUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    try {
      // Attempt update first
      const updateResult = await db
        .update(userSettings)
        .set(updates)
        .where(eq(userSettings.userId, userId))
        .returning();

      if (updateResult && updateResult[0]) {
        return updateResult[0];
      }

      // No existing row updated — create new settings (upsert behavior)
      const insertResult = await db
        .insert(userSettings)
        .values({ userId, ...(updates as any) })
        .returning();

      return insertResult[0] || undefined;
    } catch (error) {
      console.error('Error updating user settings:', error);
      return undefined;
    }
  }

  // Email Templates CRUD
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

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    try {
      const result = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, id))
        .limit(1);

      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting email template:', error);
      return undefined;
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

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    try {
      const result = await db
        .insert(emailTemplates)
        .values(template)
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error creating email template:', error);
      throw error;
    }
  }

  async updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    try {
      const result = await db
        .update(emailTemplates)
        .set(updates)
        .where(eq(emailTemplates.id, id))
        .returning();

      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating email template:', error);
      return undefined;
    }
  }

  async deleteEmailTemplate(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(emailTemplates)
        .where(eq(emailTemplates.id, id));

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting email template:', error);
      return false;
    }
  }

  // Audit Logs
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    try {
      const logs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
      
      // Filter out admin actions from audit logs for non-admin users
      // We need to check if the userId belongs to an admin user
      const adminUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'));
      
      const adminUserIds = adminUsers.map(admin => admin.id);
      
      return logs.filter(log => {
        return !log.userId || !adminUserIds.includes(log.userId);
      });
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

  async getUserAuditLogs(userId: string, limit: number = 50): Promise<AuditLog[]> {
    try {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, userId))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
      
      // Filter out admin actions from user audit logs
      const adminUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'));
      
      const adminUserIds = adminUsers.map(admin => admin.id);
      
      return logs.filter(log => {
        return !log.userId || !adminUserIds.includes(log.userId);
      });
    } catch (error) {
      console.error('Error getting user audit logs:', error);
      return [];
    }
  }

  // Sales Reports
  async getSalesReports(period?: string, year?: number, month?: number): Promise<SalesReport[]> {
    try {
      let query = db.select().from(salesReports);

      const conditions = [];
      if (period) conditions.push(eq(salesReports.period, period));
      if (year) conditions.push(eq(salesReports.year, year));
      if (month) conditions.push(eq(salesReports.month, month));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      return await query.orderBy(desc(salesReports.generatedAt));
    } catch (error) {
      console.error('Error getting sales reports:', error);
      return [];
    }
  }

  async getSalespersonReports(salespersonId: string, months: number = 12): Promise<SalesReport[]> {
    try {
      return await db
        .select()
        .from(salesReports)
        .where(eq(salesReports.salespersonId, salespersonId))
        .orderBy(desc(salesReports.generatedAt))
        .limit(months);
    } catch (error) {
      console.error('Error getting salesperson reports:', error);
      return [];
    }
  }

  async getTopPerformers(period: string = 'monthly', limit: number = 10): Promise<SalesReport[]> {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const conditions = [
        eq(salesReports.period, period),
        eq(salesReports.year, currentYear)
      ];

      if (period === 'monthly') {
        conditions.push(eq(salesReports.month, currentMonth));
      }

      return await db
        .select()
        .from(salesReports)
        .where(and(...conditions))
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

  async getSystemBackup(id: string): Promise<SystemBackup | undefined> {
    try {
      const result = await db
        .select()
        .from(systemBackups)
        .where(eq(systemBackups.id, id))
        .limit(1);

      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting system backup:', error);
      return undefined;
    }
  }

  // Company Settings
  async getCompanySettings(): Promise<any> {
    try {
      const client = createDirectConnection();
      await client.connect();
      
      const result = await client.query('SELECT * FROM company_settings LIMIT 1');
      await client.end();
      
      if (result.rows.length === 0) {
        // Return default settings if none exist
        return {
          id: null,
          companyName: '',
          phone: '',
          email: '',
          address: '',
          currency: 'BRL',
          timezone: 'America/Sao_Paulo',
          autoBackup: true,
          backupFrequency: 'daily',
          allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png'],
          maxFileSize: 10485760, // 10MB
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting company settings:', error);
      throw error;
    }
  }

  async updateCompanySettings(settings: any): Promise<any> {
    try {
      console.log('updateCompanySettings called with:', JSON.stringify(settings, null, 2));
      
      const client = createDirectConnection();
      await client.connect();
      
      // Check if settings exist
      const existingResult = await client.query('SELECT id FROM company_settings LIMIT 1');
      console.log('Existing settings found:', existingResult.rows.length > 0);
      
      let result;
      if (existingResult.rows.length === 0) {
        console.log('Inserting new company settings...');
        // Insert new settings
        result = await client.query(`
          INSERT INTO company_settings (
            id, company_name, company_phone, company_email, company_address, currency, timezone,
            date_format, time_format, language, auto_backup_enabled, auto_backup_frequency, 
            auto_backup_time, max_file_size_mb, allowed_file_types, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
          RETURNING *
        `, [
          randomUUID(),
          settings.companyName,
          settings.companyPhone,
          settings.companyEmail,
          settings.companyAddress,
          settings.currency,
          settings.timezone,
          settings.dateFormat,
          settings.timeFormat,
          settings.language,
          settings.autoBackupEnabled,
          settings.autoBackupFrequency,
          settings.autoBackupTime,
          settings.maxFileSizeMb,
          settings.allowedFileTypes
        ]);
      } else {
        console.log('Updating existing company settings...');
        // Update existing settings
        result = await client.query(`
          UPDATE company_settings SET
            company_name = $1,
            company_phone = $2,
            company_email = $3,
            company_address = $4,
            currency = $5,
            timezone = $6,
            date_format = $7,
            time_format = $8,
            language = $9,
            auto_backup_enabled = $10,
            auto_backup_frequency = $11,
            auto_backup_time = $12,
            max_file_size_mb = $13,
            allowed_file_types = $14,
            updated_at = NOW()
          WHERE id = $15
          RETURNING *
        `, [
          settings.companyName,
          settings.companyPhone,
          settings.companyEmail,
          settings.companyAddress,
          settings.currency,
          settings.timezone,
          settings.dateFormat,
          settings.timeFormat,
          settings.language,
          settings.autoBackupEnabled,
          settings.autoBackupFrequency,
          settings.autoBackupTime,
          settings.maxFileSizeMb,
          settings.allowedFileTypes,
          existingResult.rows[0].id
        ]);
      }
      
      console.log('Database operation completed successfully');
      await client.end();
      return result.rows[0];
    } catch (error) {
      console.error('Error updating company settings:', error);
      throw error;
    }
  }

  // Login History - with pagination and filters
  async getLoginHistory(
    userId: string,
    options: { limit?: number; offset?: number; filters?: { success?: boolean; device_type?: string; dateFrom?: string; dateTo?: string; search?: string } } = {}
  ): Promise<{ records: any[]; total: number; totalPages: number; currentPage: number }> {
    try {
      const { limit = 20, offset = 0, filters = {} } = options;
      const { success, device_type, dateFrom, dateTo, search } = filters;

      const client = createDirectConnection();
      await client.connect();

      // Detect available timestamp columns to avoid referencing non-existent columns
      const colsRes = await client.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'login_history' AND column_name IN ('login_time','login_at','created_at')`
      );
      const availableCols: string[] = colsRes.rows.map((r: any) => r.column_name);
      const ordered = ['login_time', 'login_at', 'created_at'].filter(c => availableCols.includes(c));
      const tsExpr = ordered.length === 0
        ? 'lh.created_at'
        : (ordered.length === 1
            ? `lh.${ordered[0]}`
            : `COALESCE(${ordered.map(c => `lh.${c}`).join(', ')})`);

      let query = `
        SELECT lh.*, u.name AS user_name, u.email AS user_email,
               ${tsExpr} AS created_at
        FROM login_history lh
        LEFT JOIN users u ON u.id = lh.user_id
        WHERE lh.user_id = $1
      `;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (typeof success === 'boolean') {
        query += ` AND lh.success = $${paramIndex}`;
        params.push(success);
        paramIndex++;
      }

      if (device_type) {
        // device_type is derived from user_agent; filter approximate using ILIKE
        if (device_type === 'mobile') {
          query += ` AND lh.user_agent ILIKE $${paramIndex}`;
          params.push('%Mobile%');
          paramIndex++;
        } else if (device_type === 'desktop') {
          query += ` AND (lh.user_agent NOT ILIKE $${paramIndex})`;
          params.push('%Mobile%');
          paramIndex++;
        } // tablet falls back to mobile-like, or no extra filter
      }

      if (search) {
        query += ` AND (
          lh.ip_address::text ILIKE $${paramIndex} OR
          lh.location ILIKE $${paramIndex} OR
          u.email ILIKE $${paramIndex} OR
          u.name ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (dateFrom) {
        query += ` AND ${tsExpr} >= $${paramIndex}`;
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        query += ` AND ${tsExpr} <= $${paramIndex}`;
        params.push(dateTo);
        paramIndex++;
      }

      const countQuery = query.replace(
        /SELECT[\s\S]*FROM/,
        'SELECT COUNT(*) AS count FROM'
      );
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count, 10) || 0;

      query += ` ORDER BY ${tsExpr} DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await client.query(query, params);
      await client.end();

      // Enrich records: device_type, browser, os, session_duration formatting placeholder
      const enriched = result.rows.map((row: any) => {
        const ua: string = row.user_agent || '';
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
        const deviceType = isMobile ? 'mobile' : 'desktop';
        let browser = '';
        if (/Chrome\//i.test(ua)) browser = 'Chrome';
        else if (/Firefox\//i.test(ua)) browser = 'Firefox';
        else if (/Safari\//i.test(ua)) browser = 'Safari';
        else if (/Edg\//i.test(ua)) browser = 'Edge';
        else browser = 'Desconhecido';

        let os = '';
        if (/Windows/i.test(ua)) os = 'Windows';
        else if (/Android/i.test(ua)) os = 'Android';
        else if (/iPhone|iPad|iOS/i.test(ua)) os = 'iOS';
        else if (/Macintosh/i.test(ua)) os = 'macOS';
        else os = 'Desconhecido';

        return {
          id: row.id,
          user_id: row.user_id,
          user_name: row.user_name || '',
          user_email: row.user_email || '',
          ip_address: row.ip_address,
          user_agent: ua,
          device_type: deviceType,
          browser,
          os,
          location: row.location,
          success: !!row.success,
          failure_reason: row.failure_reason || undefined,
          session_duration: row.session_duration || null,
          created_at: row.created_at,
        };
      });

      return {
        records: enriched,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        currentPage: Math.floor(offset / limit) + 1,
      };
    } catch (error) {
      console.error('Error getting login history:', error);
      return { records: [], total: 0, totalPages: 0, currentPage: 1 };
    }
  }

  async createLoginHistory(data: any): Promise<any> {
    try {
      const client = createDirectConnection();
      await client.connect();
      // Detect timestamp column (login_at vs login_time)
      const colRes = await client.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'login_history' AND column_name IN ('login_at','login_time') 
         ORDER BY column_name LIMIT 1`
      );
      const timestampCol = colRes.rows[0]?.column_name || 'login_at';

      const query = `
        INSERT INTO login_history (
          user_id, ip_address, user_agent, ${timestampCol}, success
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await client.query(query, [
        data.userId,
        data.ipAddress,
        data.userAgent,
        data.loginTime || new Date(),
        data.success
      ]);
      
      await client.end();
      return result.rows[0];
    } catch (error) {
      console.error('Error creating login history:', error);
      throw error;
    }
  }

  // User Sessions
  async getUserSessions(userId: string): Promise<any[]> {
    try {
      const client = createDirectConnection();
      await client.connect();
      
      const result = await client.query(`
        SELECT * FROM user_sessions 
        WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY created_at DESC
      `, [userId]);
      
      await client.end();
      return result.rows;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  async deleteUserSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const client = createDirectConnection();
      await client.connect();
      
      const result = await client.query(`
        DELETE FROM user_sessions 
        WHERE id = $1 AND user_id = $2
      `, [sessionId, userId]);
      
      await client.end();
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting user session:', error);
      return false;
    }
  }

  // System Logs
  async getSystemLogs(options: { limit?: number; offset?: number; filters?: any } = {}): Promise<{ records: any[]; total: number; totalPages: number; currentPage: number }> {
    try {
      const { limit = 100, offset = 0, filters = {} } = options;
      const { level, category, search, dateFrom, dateTo } = filters;
      
      const client = createDirectConnection();
      await client.connect();
      
      let query = 'SELECT * FROM system_logs WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (level) {
        query += ` AND level = $${paramIndex}`;
        params.push(level);
        paramIndex++;
      }
      
      if (category) {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }
      
      if (search) {
        query += ` AND (message ILIKE $${paramIndex} OR details ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      
      if (dateFrom) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(dateFrom);
        paramIndex++;
      }
      
      if (dateTo) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(dateTo);
        paramIndex++;
      }
      
      // Count total records
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);
      
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      
      const result = await client.query(query, params);
      await client.end();
      
      return {
        records: result.rows,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        currentPage: Math.floor(offset / limit) + 1,
      };
    } catch (error) {
      console.error('Error getting system logs:', error);
      return { records: [], total: 0, totalPages: 0, currentPage: 1 };
    }
  }

  async createSystemLog(data: any): Promise<any> {
    try {
      const client = createDirectConnection();
      await client.connect();
      
      const result = await client.query(`
        INSERT INTO system_logs (
          level, category, message, user_id, ip_address, user_agent, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `, [
        data.level || 'info',
        data.category || 'general',
        data.message,
        data.userId || null,
        data.ipAddress || null,
        data.userAgent || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]);
      
      await client.end();
      return result.rows[0];
    } catch (error) {
      console.error('Error creating system log:', error);
      throw error;
    }
  }

  // Password Management
  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const client = createDirectConnection();
      await client.connect();
      
      // Get current user password
      const userResult = await client.query('SELECT password FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        await client.end();
        return false;
      }
      
      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password);
      if (!isCurrentPasswordValid) {
        await client.end();
        return false;
      }
      
      // Hash new password and update
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      const updateResult = await client.query(`
        UPDATE users SET 
          password = $1, 
          updated_at = NOW() 
        WHERE id = $2
      `, [hashedNewPassword, userId]);
      
      await client.end();
      return updateResult.rowCount > 0;
    } catch (error) {
      console.error('Error updating password:', error);
      return false;
    }
  }

  // Kanban Cards Management
  async getOpportunitiesCount(): Promise<number> {
    try {
      console.log('[DEBUG] Getting opportunities count...');
      const client = createDirectConnection();
      await client.connect();
      
      // Use direct query instead of function for now
      const result = await client.query('SELECT COUNT(*) as count FROM opportunities');
      console.log('[DEBUG] Query result:', result.rows[0]);
      
      await client.end();
      const count = parseInt(result.rows[0].count) || 0;
      console.log('[DEBUG] Final count:', count);
      return count;
    } catch (error) {
      console.error('Error getting opportunities count:', error);
      return 0;
    }
  }

  async createOpportunitiesBackup(userId: string): Promise<number> {
    try {
      console.log('[DEBUG] Creating opportunities backup...');
      const client = createDirectConnection();
      await client.connect();
      
      // Create backups table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS backups (
          id SERIAL PRIMARY KEY,
          backup_type VARCHAR(50) NOT NULL DEFAULT 'opportunities',
          backup_data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by VARCHAR(255),
          metadata JSONB DEFAULT '{}',
          restored_at TIMESTAMP WITH TIME ZONE NULL,
          is_active BOOLEAN DEFAULT true
        )
      `);
      console.log('[DEBUG] Backups table created/verified');
      
      // Get all opportunities data
      const opportunitiesResult = await client.query('SELECT * FROM opportunities');
      const opportunitiesData = opportunitiesResult.rows;
      console.log(`[DEBUG] Found ${opportunitiesData.length} opportunities to backup`);
      
      // Create backup record
      const backupResult = await client.query(`
        INSERT INTO backups (backup_type, backup_data, created_by, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        'opportunities',
        JSON.stringify(opportunitiesData),
        userId,
        JSON.stringify({
          total_count: opportunitiesData.length,
          backup_reason: 'clear_all_cards',
          timestamp: new Date().toISOString()
        })
      ]);
      
      const backupId = parseInt(backupResult.rows[0].id) || 0;
      console.log(`[DEBUG] Backup created with ID: ${backupId}`);
      
      await client.end();
      return backupId;
    } catch (error) {
      console.error('Error creating opportunities backup:', error);
      throw error;
    }
  }

  async clearAllOpportunities(): Promise<number> {
    try {
      const client = createDirectConnection();
      await client.connect();
      
      // Get count before deletion
      const countResult = await client.query('SELECT COUNT(*) as count FROM opportunities');
      const deletedCount = parseInt(countResult.rows[0].count) || 0;
      
      // Delete all opportunities
      await client.query('DELETE FROM opportunities');
      
      await client.end();
      return deletedCount;
    } catch (error) {
      console.error('Error clearing all opportunities:', error);
      throw error;
    }
  }
}

export const postgresStorage = new PostgresStorage();
