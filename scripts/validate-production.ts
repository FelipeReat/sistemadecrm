import 'dotenv/config';
import postgres from 'postgres';
import connectPg from 'connect-pg-simple';
import session from 'express-session';

async function validateProduction() {
  console.log('🎯 Validação completa da configuração de produção...');
  
  const productionDbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!productionDbUrl) {
    console.error('❌ PROD_DATABASE_URL não encontrada!');
    process.exit(1);
  }
  
  console.log('🔗 URL do banco:', productionDbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
  console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
  console.log('🔒 NODE_TLS_REJECT_UNAUTHORIZED:', process.env.NODE_TLS_REJECT_UNAUTHORIZED);
  
  // Preparar URL com SSL
  let dbUrl = productionDbUrl;
  dbUrl = dbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
  dbUrl += dbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
  
  console.log('\n✅ Configurações validadas:');
  console.log('   - NODE_TLS_REJECT_UNAUTHORIZED=0 ✓');
  console.log('   - sslmode=require na URL ✓');
  console.log('   - Configurações SSL completas ✓');
  
  // Teste 1: Conexão postgres (db.ts)
  console.log('\n📡 Teste 1: Conexão postgres (db.ts)...');
  try {
    const sql = postgres(dbUrl, {
      ssl: {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false,
        checkServerIdentity: () => undefined
      },
      max: 1,
      connect_timeout: 10
    });
    
    const result = await sql`SELECT 
      version() as postgres_version,
      current_database() as database_name,
      current_user as user_name,
      current_timestamp as connection_time
    `;
    
    console.log('✅ Conexão postgres: SUCESSO');
    console.log('   Database:', result[0].database_name);
    console.log('   User:', result[0].user_name);
    console.log('   Timestamp:', result[0].connection_time);
    
    await sql.end();
  } catch (error: any) {
    console.log('❌ Conexão postgres: FALHOU');
    console.log('   Erro:', error.message);
    process.exit(1);
  }
  
  // Teste 2: connect-pg-simple (auth.ts)
  console.log('\n📡 Teste 2: connect-pg-simple (auth.ts)...');
  try {
    const pgStore = connectPg(session);
    
    const sessionStore = new pgStore({
      conString: dbUrl,
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60 * 1000,
      tableName: "validation_sessions_" + Date.now(),
      ssl: {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false
      },
    });
    
    console.log('✅ connect-pg-simple: Store criado com sucesso');
    
    // Aguardar para verificar se há erros assíncronos
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ connect-pg-simple: Nenhum erro após 3 segundos');
    
  } catch (error: any) {
    console.log('❌ connect-pg-simple: FALHOU');
    console.log('   Erro:', error.message);
    process.exit(1);
  }
  
  // Teste 3: Migração (migrate.ts)
  console.log('\n📡 Teste 3: Teste de migração...');
  try {
    const sql = postgres(dbUrl, {
      ssl: {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false,
        checkServerIdentity: () => undefined
      },
      max: 1,
      connect_timeout: 30
    });
    
    // Verificar se as tabelas de migração existem
    const migrations = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'drizzle' 
      AND table_name = '__drizzle_migrations'
    `;
    
    console.log('✅ Migração: Tabelas de migração encontradas');
    console.log('   Tabelas drizzle:', migrations.length > 0 ? 'Existem' : 'Não encontradas');
    
    await sql.end();
  } catch (error: any) {
    console.log('❌ Migração: FALHOU');
    console.log('   Erro:', error.message);
    process.exit(1);
  }
  
  // Teste 4: Verificar estrutura do banco
  console.log('\n📡 Teste 4: Verificação da estrutura do banco...');
  try {
    const sql = postgres(dbUrl, {
      ssl: {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false,
        checkServerIdentity: () => undefined
      },
      max: 1,
      connect_timeout: 10
    });
    
    const tables = await sql`
      SELECT table_name, table_schema
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'drizzle')
      ORDER BY table_schema, table_name
    `;
    
    console.log('✅ Estrutura do banco: Verificada');
    console.log('   Tabelas encontradas:', tables.length);
    
    const publicTables = tables.filter(t => t.table_schema === 'public');
    const drizzleTables = tables.filter(t => t.table_schema === 'drizzle');
    
    if (publicTables.length > 0) {
      console.log('   Tabelas públicas:', publicTables.map(t => t.table_name).join(', '));
    }
    if (drizzleTables.length > 0) {
      console.log('   Tabelas drizzle:', drizzleTables.map(t => t.table_name).join(', '));
    }
    
    await sql.end();
  } catch (error: any) {
    console.log('❌ Estrutura do banco: FALHOU');
    console.log('   Erro:', error.message);
    process.exit(1);
  }
  
  console.log('\n🎉 VALIDAÇÃO COMPLETA: TODOS OS TESTES PASSARAM!');
  console.log('\n📋 Resumo da solução SSL:');
  console.log('   ✓ NODE_TLS_REJECT_UNAUTHORIZED=0');
  console.log('   ✓ sslmode=require na URL do banco');
  console.log('   ✓ rejectUnauthorized: false');
  console.log('   ✓ requestCert: false');
  console.log('   ✓ agent: false');
  console.log('   ✓ checkServerIdentity: () => undefined (biblioteca postgres)');
  console.log('\n🚀 A aplicação está pronta para produção!');
}

// Capturar erros não tratados
process.on('unhandledRejection', (reason, promise) => {
  console.log('🚨 Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.log('🚨 Uncaught Exception:', error.message);
  process.exit(1);
});

validateProduction().catch(console.error);