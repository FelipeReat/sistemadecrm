
import 'dotenv/config';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function runMigrations() {
  const dbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error('PROD_DATABASE_URL ou DATABASE_URL deve estar definida');
  }

  console.log('Conectando ao banco de dados de produção...');
  
  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzle({ client: pool });

  console.log('Executando migrações...');
  
  try {
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('✅ Migrações executadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar migrações:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('Conexão fechada.');
  }
}

runMigrations().catch((error) => {
  console.error('Falha na migração:', error);
  process.exit(1);
});
