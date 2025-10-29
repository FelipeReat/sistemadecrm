import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './shared/schema';

async function testDrizzleSchema() {
  try {
    console.log('🧪 Testando schema do Drizzle...\n');
    
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
    console.log('📋 Tabela opportunities:', !!schema.opportunities);
    
    // Teste 1: Inserção usando Drizzle ORM
    console.log('\n📝 Teste 1: Inserção usando Drizzle ORM');
    
    const testData = {
      contact: 'Teste Schema Drizzle TS',
      company: 'Empresa Schema TS',
      phase: 'visita-tecnica' as const,
      visitDate: '2024-01-15 14:30:00',
      visitDescription: 'Teste de descrição da visita',
      createdBy: 'teste-schema-ts',
      createdAt: new Date(),
      updatedAt: new Date(),
      phaseUpdatedAt: new Date()
    };
    
    console.log('📋 Dados para inserção:', testData);
    
    try {
      const insertResult = await db.insert(schema.opportunities).values(testData).returning();
      console.log('✅ Inserção com Drizzle ORM funcionou:', insertResult[0]);
      
      // Limpeza
      console.log('\n🧹 Limpando registros de teste...');
      await sql`DELETE FROM opportunities WHERE contact LIKE 'Teste Schema%'`;
      console.log('✅ Registros de teste removidos');
      
    } catch (insertError: any) {
      console.error('❌ Erro na inserção:', insertError.message);
      console.error('📍 Código do erro:', insertError.code);
      console.error('📍 Detalhes:', insertError.detail);
      
      // Vamos tentar uma inserção mais simples
      console.log('\n📝 Tentando inserção mais simples...');
      const simpleData = {
        contact: 'Teste Simples',
        company: 'Empresa Simples',
        phase: 'visita-tecnica' as const,
        createdBy: 'teste-simples',
        createdAt: new Date(),
        updatedAt: new Date(),
        phaseUpdatedAt: new Date()
      };
      
      try {
        const simpleResult = await db.insert(schema.opportunities).values(simpleData).returning();
        console.log('✅ Inserção simples funcionou:', simpleResult[0]);
        
        // Agora tentar adicionar visit_description
        console.log('\n📝 Tentando atualizar com visit_description...');
        const updateResult = await db
          .update(schema.opportunities)
          .set({ visitDescription: 'Descrição adicionada depois' })
          .where(sql`id = ${simpleResult[0].id}`)
          .returning();
        
        console.log('✅ Atualização com visitDescription funcionou:', updateResult[0]);
        
        // Limpeza
        await sql`DELETE FROM opportunities WHERE contact LIKE 'Teste Simples%'`;
        console.log('✅ Registros de teste removidos');
        
      } catch (simpleError: any) {
        console.error('❌ Erro na inserção simples:', simpleError.message);
        console.error('📍 Stack trace:', simpleError.stack);
      }
    }
    
    await sql.end();
    
  } catch (error: any) {
    console.error('❌ Erro no teste:', error.message);
    console.error('📍 Stack trace:', error.stack);
  }
}

testDrizzleSchema()
  .then(() => {
    console.log('\n✅ Teste do schema Drizzle concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha no teste do schema:', error.message);
    process.exit(1);
  });