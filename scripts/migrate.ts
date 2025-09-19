
import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

async function runMigrations() {
  // Força NODE_ENV para production se não estiver definido
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  // Determinar qual variável de ambiente usar baseado no NODE_ENV
  const isProduction = process.env.NODE_ENV === 'production';
  const dbUrl = isProduction 
    ? process.env.PROD_DATABASE_URL 
    : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    const envVar = isProduction ? 'PROD_DATABASE_URL' : 'DEV_DATABASE_URL';
    console.error(`❌ Erro: ${envVar} não está definida!`);
    console.log(`Configure a variável de ambiente ${envVar} com a string de conexão do seu banco PostgreSQL para ${isProduction ? 'produção' : 'desenvolvimento'}.`);
    console.log('Exemplo: DATABASE_URL="postgresql://user:password@host:5432/database"');
    throw new Error(`${envVar} deve estar definida`);
  }
  
  console.log(`🚀 Executando migrações no ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);

  console.log('🔗 URL do banco:', dbUrl.replace(/:[^:]*@/, ':***@')); // Oculta a senha no log

  console.log('Conectando ao banco de dados RDS...');
  
  // Remove configurações SSL da URL e adiciona sslmode=require
  let cleanDbUrl = dbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
  cleanDbUrl += cleanDbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
  
  // Use postgres-js para conectar ao RDS
  const sql = postgres(cleanDbUrl, { 
    max: 1,
    ssl: { 
      rejectUnauthorized: false,
      requestCert: false,
      agent: false,
      checkServerIdentity: () => undefined
    },
    connect_timeout: 30 // 30 segundos de timeout
  });
  
  const db = drizzle(sql);

  console.log('Executando migrações...');
  
  try {
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('✅ Migrações executadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar migrações:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('Conexão fechada.');
  }
}

runMigrations().catch((error) => {
  console.error('Falha na migração:', error);
  process.exit(1);
});
