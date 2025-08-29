import 'dotenv/config';
import postgres from 'postgres';
import connectPg from 'connect-pg-simple';
import session from 'express-session';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function diagnoseSslIssue() {
  console.log('🔍 Diagnóstico completo do problema SSL em produção...');
  
  const productionDbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!productionDbUrl) {
    console.error('❌ PROD_DATABASE_URL não encontrada!');
    process.exit(1);
  }
  
  console.log('🔗 URL do banco:', productionDbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
  console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
  console.log('🔒 NODE_TLS_REJECT_UNAUTHORIZED:', process.env.NODE_TLS_REJECT_UNAUTHORIZED);
  
  // Teste 1: Conexão com diferentes configurações SSL
  const sslConfigs = [
    {
      name: 'SSL com rejectUnauthorized: false',
      config: {
        ssl: {
          rejectUnauthorized: false,
          requestCert: false,
          agent: false
        }
      }
    },
    {
      name: 'SSL desabilitado completamente',
      config: {
        ssl: false
      }
    },
    {
      name: 'SSL com configurações avançadas',
      config: {
        ssl: {
          rejectUnauthorized: false,
          requestCert: false,
          agent: false,
          checkServerIdentity: () => undefined,
          secureProtocol: 'TLSv1_2_method'
        }
      }
    }
  ];
  
  for (const { name, config } of sslConfigs) {
    console.log(`\n📡 Testando: ${name}`);
    
    try {
      // Preparar URL
      let testUrl = productionDbUrl;
      
      if (config.ssl === false) {
        // Para SSL desabilitado, adicionar sslmode=disable
        testUrl = testUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
        testUrl += testUrl.includes('?') ? '&sslmode=disable' : '?sslmode=disable';
      } else {
        // Para SSL habilitado, adicionar sslmode=require
        testUrl = testUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
        testUrl += testUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
      }
      
      const sql = postgres(testUrl, {
        ...config,
        max: 1,
        connect_timeout: 10
      });
      
      const result = await sql`SELECT 1 as test`;
      console.log(`✅ ${name}: SUCESSO`);
      await sql.end();
      
    } catch (error: any) {
      console.log(`❌ ${name}: FALHOU`);
      console.log(`   Erro: ${error.message}`);
      if (error.code) {
        console.log(`   Código: ${error.code}`);
      }
    }
  }
  
  // Teste 2: connect-pg-simple com diferentes configurações
  console.log('\n🔄 Testando connect-pg-simple...');
  
  const pgStore = connectPg(session);
  
  const pgConfigs = [
    {
      name: 'connect-pg-simple com SSL configurado',
      url: productionDbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '') + '?sslmode=require',
      ssl: {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false
      }
    },
    {
      name: 'connect-pg-simple sem SSL',
      url: productionDbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '') + '?sslmode=disable',
      ssl: false
    }
  ];
  
  for (const { name, url, ssl } of pgConfigs) {
    console.log(`\n📡 Testando: ${name}`);
    
    try {
      const store = new pgStore({
        conString: url,
        createTableIfMissing: true,
        ttl: 1000,
        tableName: "test_sessions_" + Date.now(),
        ssl: ssl
      });
      
      // Aguardar um pouco para a conexão
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(`✅ ${name}: SUCESSO`);
      
    } catch (error: any) {
      console.log(`❌ ${name}: FALHOU`);
      console.log(`   Erro: ${error.message}`);
      if (error.code) {
        console.log(`   Código: ${error.code}`);
      }
    }
  }
  
  // Teste 3: Verificar versões dos pacotes
  console.log('\n📦 Informações dos pacotes:');
  try {
    const pgPackage = require('pg/package.json');
    console.log(`   pg: ${pgPackage.version}`);
  } catch (e) {
    console.log('   pg: não encontrado');
  }
  
  try {
    const postgresPackage = require('postgres/package.json');
    console.log(`   postgres: ${postgresPackage.version}`);
  } catch (e) {
    console.log('   postgres: não encontrado');
  }
  
  try {
    const connectPgPackage = require('connect-pg-simple/package.json');
    console.log(`   connect-pg-simple: ${connectPgPackage.version}`);
  } catch (e) {
    console.log('   connect-pg-simple: não encontrado');
  }
  
  console.log('\n🎯 Diagnóstico concluído!');
}

diagnoseSslIssue().catch(console.error);