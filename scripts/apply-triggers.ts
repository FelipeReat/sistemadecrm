import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyTriggers() {
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
  
  console.log(`🚀 Aplicando triggers no ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
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
    
    // Ler o arquivo SQL dos triggers
    const sqlFilePath = join(process.cwd(), 'migrations', '0008_add_realtime_triggers.sql');
    const sqlContent = readFileSync(sqlFilePath, 'utf-8');
    
    console.log('Executando triggers SQL...');
    
    // Executar o SQL
    await sql.unsafe(sqlContent);
    
    console.log('✅ Triggers aplicados com sucesso!');
    
    // Testar se os triggers foram criados
    const triggers = await sql`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE event_object_table = 'opportunities'
      ORDER BY trigger_name;
    `;
    
    console.log('📋 Triggers criados:');
    triggers.forEach(trigger => {
      console.log(`  - ${trigger.trigger_name} (${trigger.event_manipulation})`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao aplicar triggers:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('Conexão fechada.');
  }
}

applyTriggers().catch((error) => {
  console.error('Falha ao aplicar triggers:', error);
  process.exit(1);
});