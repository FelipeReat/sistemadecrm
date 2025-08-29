import 'dotenv/config';
import postgres from 'postgres';
import connectPg from 'connect-pg-simple';
import session from 'express-session';

async function testProductionConnection() {
  console.log('🔍 Testando conexão com PostgreSQL em produção...');
  
  const productionDbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!productionDbUrl) {
    console.error('❌ PROD_DATABASE_URL não encontrada!');
    process.exit(1);
  }
  
  console.log('🔗 URL do banco:', productionDbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
  
  try {
    // Teste 1: Conexão direta com postgres
    console.log('\n📡 Teste 1: Conexão direta com postgres...');
    
    // Remove configurações SSL da URL e adiciona sslmode=require
    let cleanDbUrl = productionDbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
    cleanDbUrl += cleanDbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
    
    const sql = postgres(cleanDbUrl, {
      ssl: { 
        rejectUnauthorized: false,
        requestCert: false,
        agent: false
      },
      max: 1,
      connect_timeout: 30
    });
    
    const result = await sql`SELECT version()`;
    console.log('✅ Conexão direta bem-sucedida!');
    console.log('📊 Versão do PostgreSQL:', result[0].version.split(' ')[0]);
    await sql.end();
    
    // Teste 2: Conexão com connect-pg-simple
    console.log('\n📡 Teste 2: Conexão com connect-pg-simple...');
    const pgStore = connectPg(session);
    
    let dbUrl = productionDbUrl;
    // Remove qualquer configuração SSL existente da URL e adiciona sslmode=require
    dbUrl = dbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
    dbUrl += dbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
    
    const sessionStore = new pgStore({
      conString: dbUrl,
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60 * 1000,
      tableName: "sessions_test",
      ssl: {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false
      },
    });
    
    // Aguardar um pouco para a conexão ser estabelecida
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Conexão com connect-pg-simple bem-sucedida!');
    console.log('🎉 Todas as conexões funcionaram corretamente!');
    
  } catch (error) {
    console.error('❌ Erro na conexão:', error);
    
    if (error.message.includes('self-signed certificate')) {
      console.log('\n🔧 Sugestões para resolver o erro de certificado SSL:');
      console.log('1. Verificar se NODE_TLS_REJECT_UNAUTHORIZED=0 está definido');
      console.log('2. Verificar configurações SSL no código');
      console.log('3. Verificar se o RDS permite conexões SSL com certificados auto-assinados');
    }
    
    process.exit(1);
  }
}

testProductionConnection();