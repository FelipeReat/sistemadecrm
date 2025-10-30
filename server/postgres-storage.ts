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

  async clearAllOpportunities(): Promise<number> {
    const result = await db.delete(opportunities);
    return result.rowCount || 0;
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
}

export const postgresStorage = new PostgresStorage();