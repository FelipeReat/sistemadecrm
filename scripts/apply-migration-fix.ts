import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigrationFix() {
  // Determinar qual variável de ambiente usar baseado no NODE_ENV
  const isProduction = process.env.NODE_ENV === 'production';
  const dbUrl = isProduction 
    ? process.env.PROD_DATABASE_URL 
    : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    const envVar = isProduction ? 'PROD_DATABASE_URL' : 'DEV_DATABASE_URL';
    console.error(`❌ Erro: ${envVar} não está definida!`);
    throw new Error(`${envVar} deve estar definida`);
  }
  
  console.log(`🚀 Aplicando correção do payload no ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
  console.log('🔗 URL do banco:', dbUrl.replace(/:[^:]*@/, ':***@'));

  // Configurar conexão SSL
  let cleanDbUrl = dbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
  cleanDbUrl += cleanDbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
  
  const sql = postgres(cleanDbUrl, { 
    max: 1,
    ssl: { 
      rejectUnauthorized: false,
      requestCert: false,
      agent: false,
      checkServerIdentity: () => undefined
    },
    connect_timeout: 30
  });

  try {
    console.log('Conectando ao banco de dados...');
    
    // Ler o arquivo SQL da correção
    const sqlFilePath = join(process.cwd(), 'server', 'migrations', '0009_fix_realtime_payload.sql');
    const sqlContent = readFileSync(sqlFilePath, 'utf-8');
    
    console.log('Executando correção do payload...');
    
    // Executar o SQL
    await sql.unsafe(sqlContent);
    
    console.log('✅ Correção do payload aplicada com sucesso!');
    console.log('🔧 A função notify_opportunity_change() foi otimizada para enviar apenas campos essenciais');
    console.log('📦 O payload agora inclui apenas: id, phase, company, contact, finalValue, createdBy, updatedAt');
    
  } catch (error) {
    console.error('❌ Erro ao aplicar correção:', error);
    throw error;
  } finally {
    console.log('Fechando conexão...');
    await sql.end();
  }
}

applyMigrationFix().catch((error) => {
  console.error('Falha na aplicação da correção:', error);
  process.exit(1);
});