const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { opportunities } = require('./shared/schema.js');
require('dotenv').config();

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
    
    const sql = postgres(databaseUrl, {
      max: 10,
      connect_timeout: 30,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      ssl: false
    });
    
    // Importar o schema completo como na aplicação
    const schema = require('./shared/schema.js');
    const db = drizzle(sql, { schema });
    
    console.log('📋 Schema importado com sucesso');
    console.log('📋 Tabela opportunities:', !!schema.opportunities);
    
    // Verificar se as colunas estão definidas no schema
    console.log('\n📝 Verificando definições do schema:');
    const opportunitiesTable = schema.opportunities;
    
    if (opportunitiesTable && opportunitiesTable[Symbol.for('drizzle:Columns')]) {
      const columns = opportunitiesTable[Symbol.for('drizzle:Columns')];
      console.log('📋 Colunas definidas no schema:');
      Object.keys(columns).forEach(col => {
        console.log(`  ✓ ${col}`);
      });
      
      // Verificar especificamente as colunas visit_*
      const visitColumns = Object.keys(columns).filter(col => col.includes('visit') || col.includes('Visit'));
      console.log('\n📋 Colunas relacionadas a visit:');
      visitColumns.forEach(col => {
        console.log(`  ✓ ${col}`);
      });
    }
    
    // Teste 1: Inserção usando Drizzle ORM
    console.log('\n📝 Teste 1: Inserção usando Drizzle ORM');
    
    const testData = {
      contact: 'Teste Schema Drizzle',
      company: 'Empresa Schema',
      phase: 'visita-tecnica',
      visitDate: '2024-01-15 14:30:00',
      visitDescription: 'Teste de descrição da visita',
      createdBy: 'teste-schema',
      createdAt: new Date(),
      updatedAt: new Date(),
      phaseUpdatedAt: new Date()
    };
    
    console.log('📋 Dados para inserção:', testData);
    
    const insertResult = await db.insert(opportunities).values(testData).returning();
    console.log('✅ Inserção com Drizzle ORM funcionou:', insertResult[0]);
    
    // Limpeza
    console.log('\n🧹 Limpando registros de teste...');
    await sql`DELETE FROM opportunities WHERE contact LIKE 'Teste Schema%'`;
    console.log('✅ Registros de teste removidos');
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('📍 Stack trace:', error.stack);
    
    // Se for erro de coluna, mostrar detalhes
    if (error.message.includes('coluna') || error.message.includes('column')) {
      console.error('\n🔍 Detalhes do erro de coluna:');
      console.error('- Mensagem:', error.message);
      console.error('- Código:', error.code);
      console.error('- Posição:', error.position);
    }
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