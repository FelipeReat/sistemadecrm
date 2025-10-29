const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config();

// Simular o mesmo comportamento do server/db.ts
function createDatabase() {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = isProduction 
    ? process.env.PROD_DATABASE_URL 
    : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  
  console.log(`🔗 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔗 isProduction: ${isProduction}`);
  console.log(`🔗 Usando URL: ${databaseUrl?.replace(/:[^:]*@/, ':***@')}`);
  
  if (!databaseUrl) {
    const envVar = isProduction ? 'PROD_DATABASE_URL' : 'DEV_DATABASE_URL';
    throw new Error(`${envVar} must be set`);
  }
  
  // Configuração SSL consistente com db.ts
  let sslConfig;
  if (isProduction) {
    if (process.env.ALLOW_SELF_SIGNED_CERTS === 'true') {
      sslConfig = { 
        rejectUnauthorized: false,
        requestCert: true
      };
    } else {
      sslConfig = { 
        rejectUnauthorized: true,
        requestCert: true
      };
    }
  } else {
    sslConfig = false;
  }
  
  const sql = postgres(databaseUrl, {
    max: 10,
    connect_timeout: 30,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    ssl: sslConfig
  });
  
  return {
    db: drizzle(sql, { schema: {} }),
    sql
  };
}

async function testDrizzleConnection() {
  try {
    console.log('🧪 Testando conexão do Drizzle...\n');
    
    const { db, sql } = createDatabase();
    
    // Teste 1: Verificar se consegue conectar
    console.log('📝 Teste 1: Verificando conexão');
    const connectionTest = await sql`SELECT 1 as test`;
    console.log('✅ Conexão funcionou:', connectionTest[0]);
    
    // Teste 2: Verificar estrutura da tabela opportunities
    console.log('\n📝 Teste 2: Verificando estrutura da tabela opportunities');
    const tableStructure = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' 
      AND column_name LIKE '%visit%'
      ORDER BY column_name;
    `;
    
    console.log('📋 Colunas visit_* encontradas:');
    tableStructure.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });
    
    // Teste 3: Tentar inserir usando SQL direto (como o Drizzle faria)
    console.log('\n📝 Teste 3: Inserção usando postgres-js (como Drizzle)');
    const insertResult = await sql`
      INSERT INTO opportunities (
        id, contact, company, phase, visit_date, created_by, created_at, updated_at, phase_updated_at
      ) VALUES (
        gen_random_uuid(), 'Teste Drizzle', 'Empresa Drizzle', 'visita-tecnica', '2024-01-15 14:30:00', 'teste-drizzle', NOW(), NOW(), NOW()
      ) RETURNING id, contact, visit_date;
    `;
    
    console.log('✅ Inserção com postgres-js funcionou:', insertResult[0]);
    
    // Limpeza
    console.log('\n🧹 Limpando registros de teste...');
    await sql`DELETE FROM opportunities WHERE contact LIKE 'Teste Drizzle%'`;
    console.log('✅ Registros de teste removidos');
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('📍 Stack trace:', error.stack);
  }
}

testDrizzleConnection()
  .then(() => {
    console.log('\n✅ Teste do Drizzle concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha no teste do Drizzle:', error.message);
    process.exit(1);
  });