import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './shared/schema';
import { v4 as uuidv4 } from 'uuid';

async function testExactCreation() {
  try {
    console.log('🧪 Testando criação exata como na aplicação...\n');
    
    // Usar a mesma configuração do server/db.ts
    const isProduction = process.env.NODE_ENV === 'production';
    const databaseUrl = isProduction 
      ? process.env.PROD_DATABASE_URL 
      : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
    
    console.log(`🔗 NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`🔗 Usando URL: ${databaseUrl?.replace(/:[^:]*@/, ':***@')}`);
    
    if (!databaseUrl) {
      throw new Error('Database URL não encontrada');
    }
    
    const sql = postgres(databaseUrl, {
      max: 10,
      connect_timeout: 30,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      ssl: false
    });
    
    const db = drizzle(sql, { schema });
    
    console.log('📋 Schema importado com sucesso');
    
    // Simular exatamente os dados que vêm da API
    const insertOpportunity = {
      contact: "Teste Exato API",
      cpf: "74676083220",
      company: "Empresa Teste Exato",
      cnpj: null,
      phone: "92991793742",
      hasRegistration: false,
      proposalOrigin: "SDR",
      businessTemperature: "morno",
      needCategory: "Plataformas Elevatórias",
      clientNeeds: "Teste de necessidades exatas",
      documents: [],
      opportunityNumber: null,
      salesperson: null,
      requiresVisit: false,
      statement: null,
      visitSchedule: null,
      visitDate: null,
      visitPhotos: [],
      discount: null,
      discountDescription: null,
      validityDate: null,
      budgetNumber: null,
      budget: null,
      status: null,
      finalValue: null,
      negotiationInfo: null,
      contract: null,
      invoiceNumber: null,
      lossReason: null,
      lossObservation: null,
      phase: "prospeccao" as const,
      createdBy: "Administrador"
    };
    
    console.log('📋 Dados de entrada (simulando API):', insertOpportunity);
    
    // Replicar exatamente a lógica do createOpportunity
    const id = uuidv4();
    const now = new Date();
    
    // CRITICAL FIX: Ensure createdByName is never null, undefined, or empty
    let createdByName = insertOpportunity.createdBy;
    if (!createdByName || createdByName.trim() === '') {
      createdByName = 'Sistema Padrão';
    }
    if (!createdByName || createdByName.trim() === '') {
      createdByName = 'Sistema Emergencial';
    }
    if (!createdByName || createdByName.trim() === '') {
      createdByName = 'Sistema Crítico';
    }
    
    const opportunity = {
      id,
      // Basic contact info
      contact: insertOpportunity.contact,
      company: insertOpportunity.company,
      phone: insertOpportunity.phone || null,
      cpf: insertOpportunity.cpf || null,
      cnpj: insertOpportunity.cnpj || null,
      hasRegistration: insertOpportunity.hasRegistration || false,
      
      // Business info
      proposalOrigin: insertOpportunity.proposalOrigin || null,
      businessTemperature: insertOpportunity.businessTemperature || null,
      needCategory: insertOpportunity.needCategory || null,
      clientNeeds: insertOpportunity.clientNeeds || null,
      documents: insertOpportunity.documents || null,
      
      // Process info
      phase: insertOpportunity.phase,
      createdBy: insertOpportunity.createdBy,
      createdByName,
      opportunityNumber: insertOpportunity.opportunityNumber || null,
      salesperson: insertOpportunity.salesperson || null,
      
      // Visit info
      requiresVisit: insertOpportunity.requiresVisit || false,
      statement: insertOpportunity.statement || null,
      visitSchedule: insertOpportunity.visitSchedule || null,
      visitDate: insertOpportunity.visitDate || null,
      visitPhotos: insertOpportunity.visitPhotos || null,
      
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
      
      // Timestamps
      createdAt: now,
      updatedAt: now,
      phaseUpdatedAt: now
    };
    
    console.log('\n📋 Objeto opportunity construído:', opportunity);
    
    // CRITICAL FIX: Use the createdByName that was already properly set
    const insertData = {
      ...opportunity,
      // Map JavaScript field to database column
      created_by_name: opportunity.createdByName || insertOpportunity.createdByName || insertOpportunity.createdBy || 'Sistema'
    };
    
    // FINAL VALIDATION: Ensure created_by_name is NEVER null
    if (!insertData.created_by_name || insertData.created_by_name.trim() === '') {
      insertData.created_by_name = 'Sistema';
      console.error(`❌ [STORAGE] CRITICAL: created_by_name was null/empty, forcing to 'Sistema'`);
    }
    
    console.log(`\n🔍 [STORAGE] Final insert data: createdBy=${insertData.createdBy}, created_by_name=${insertData.created_by_name}, originalCreatedByName=${opportunity.createdByName}`);
    
    console.log('\n📝 Tentando inserção com Drizzle...');
    
    try {
      const result = await db
        .insert(schema.opportunities)
        .values(insertData)
        .returning();
      
      console.log('✅ Inserção com Drizzle funcionou perfeitamente!');
      console.log('📋 Resultado:', result[0]);
      
      // Limpeza
      console.log('\n🧹 Limpando registros de teste...');
      await sql`DELETE FROM opportunities WHERE contact LIKE 'Teste Exato%'`;
      console.log('✅ Registros de teste removidos');
      
    } catch (insertError: any) {
      console.error('❌ Erro na inserção:', insertError.message);
      console.error('📍 Código do erro:', insertError.code);
      console.error('📍 Detalhes:', insertError.detail);
      console.error('📍 Stack trace:', insertError.stack);
      
      // Vamos verificar se o problema é com alguma coluna específica
      if (insertError.message.includes('coluna') || insertError.message.includes('column')) {
        console.log('\n🔍 Analisando erro de coluna...');
        
        // Tentar inserção sem campos visit_*
        console.log('📝 Tentando inserção sem campos visit_*...');
        const { visitDate, visitSchedule, visitPhotos, ...dataWithoutVisit } = insertData;
        
        try {
          const resultWithoutVisit = await db
            .insert(schema.opportunities)
            .values(dataWithoutVisit)
            .returning();
          
          console.log('✅ Inserção sem campos visit_* funcionou:', resultWithoutVisit[0]);
          
          // Limpeza
          await sql`DELETE FROM opportunities WHERE contact LIKE 'Teste Exato%'`;
          
        } catch (secondError: any) {
          console.error('❌ Erro mesmo sem campos visit_*:', secondError.message);
        }
      }
    }
    
    await sql.end();
    
  } catch (error: any) {
    console.error('❌ Erro no teste:', error.message);
    console.error('📍 Stack trace:', error.stack);
  }
}

testExactCreation()
  .then(() => {
    console.log('\n✅ Teste de criação exata concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha no teste:', error.message);
    process.exit(1);
  });