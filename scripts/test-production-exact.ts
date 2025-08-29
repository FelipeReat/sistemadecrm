import 'dotenv/config';
import session from "express-session";
import connectPg from "connect-pg-simple";
import postgres from 'postgres';

async function testProductionExact() {
  console.log('🎯 Testando configuração EXATA de produção...');
  
  // Simular exatamente o que acontece no auth.ts
  let dbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ Nenhuma URL de banco encontrada!');
    process.exit(1);
  }
    
  console.log('🔗 URL original:', dbUrl?.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
  
  // SEMPRE processar SSL em produção
  if (dbUrl) {
    // Remove qualquer configuração SSL existente da URL
    dbUrl = dbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
    // Adiciona sslmode=require para forçar SSL mas aceitar certificados auto-assinados
    dbUrl += dbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  
  console.log('🔗 URL processada:', dbUrl?.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
  
  // Teste 1: Conexão direta postgres (como em db.ts)
  console.log('\n📡 Teste 1: Conexão direta postgres...');
  try {
    const sql = postgres(dbUrl!, {
      ssl: {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false,
        checkServerIdentity: () => undefined
      },
      max: 1,
      connect_timeout: 10
    });
    
    console.log('   Configuração SSL postgres:', {
      rejectUnauthorized: false,
      requestCert: false,
      agent: false,
      checkServerIdentity: 'function'
    });
    
    const result = await sql`SELECT 1 as test, current_timestamp as now`;
    console.log('✅ Conexão direta: SUCESSO');
    console.log('   Resultado:', result[0]);
    await sql.end();
  } catch (error: any) {
    console.log('❌ Conexão direta: FALHOU');
    console.log('   Erro:', error.message);
    console.log('   Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
  }
  
  // Teste 2: connect-pg-simple (como em auth.ts)
  console.log('\n📡 Teste 2: connect-pg-simple...');
  try {
    const pgStore = connectPg(session);
    
    const sessionStore = new pgStore({
      conString: dbUrl,
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60 * 1000,
      tableName: "test_sessions_" + Date.now(),
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false
      } : false,
    });
    
    console.log('✅ connect-pg-simple: Store criado com sucesso');
    
    // Aguardar um pouco para verificar se há erros assíncronos
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ connect-pg-simple: Nenhum erro após 5 segundos');
    
  } catch (error: any) {
    console.log('❌ connect-pg-simple: FALHOU');
    console.log('   Erro:', error.message);
    console.log('   Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
  }
  
  // Teste 3: Verificar variáveis de ambiente
  console.log('\n🔍 Variáveis de ambiente:');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('   NODE_TLS_REJECT_UNAUTHORIZED:', process.env.NODE_TLS_REJECT_UNAUTHORIZED);
  console.log('   DATABASE_URL definida:', !!process.env.DATABASE_URL);
  console.log('   PROD_DATABASE_URL definida:', !!process.env.PROD_DATABASE_URL);
  
  // Teste 4: Verificar se o problema é específico do pg-pool
  console.log('\n📡 Teste 4: Testando pg-pool diretamente...');
  try {
    const pg = await import('pg');
    const Pool = pg.default.Pool || pg.Pool;
    
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false
      } : false,
      max: 1,
      connectionTimeoutMillis: 10000
    });
    
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as test, current_timestamp as now');
    console.log('✅ pg-pool: SUCESSO');
    console.log('   Resultado:', result.rows[0]);
    
    client.release();
    await pool.end();
    
  } catch (error: any) {
    console.log('❌ pg-pool: FALHOU');
    console.log('   Erro:', error.message);
    console.log('   Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
  }
  
  console.log('\n🎯 Teste concluído!');
}

// Capturar erros não tratados
process.on('unhandledRejection', (reason, promise) => {
  console.log('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.log('🚨 Uncaught Exception:', error.message);
  console.log('   Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
});

testProductionExact().catch(console.error);