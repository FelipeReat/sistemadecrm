
import 'dotenv/config';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// SEMPRE usar PostgreSQL (tanto desenvolvimento quanto produção)
function createDatabase() {
  // Determinar qual variável de ambiente usar baseado no NODE_ENV
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = isProduction 
    ? process.env.PROD_DATABASE_URL 
    : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    const envVar = isProduction ? 'PROD_DATABASE_URL' : 'DEV_DATABASE_URL';
    throw new Error(`${envVar} must be set. Configure your PostgreSQL connection string for ${isProduction ? 'production' : 'development'} environment.`);
  }
  
  console.log(`🔗 Conectando ao PostgreSQL (${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'})...`);
  console.log(`📍 Host: ${new URL(databaseUrl).hostname}`);

  // Configuração SSL consistente com pg-pool.ts
  let sslConfig: any;
  if (isProduction) {
    // Em produção, SEMPRE usar SSL
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
    // Em desenvolvimento, assumimos que o servidor NÃO usa SSL por padrão.
    // Se precisar de SSL em desenvolvimento, configure NODE_ENV=production
    // ou use uma URL de banco com SSL explícito e servidor compatível.
    sslConfig = undefined;
  }
  
  const sql = postgres(databaseUrl, {
    max: 10,
    connect_timeout: 30,
    idle_timeout: 20,
    max_lifetime: 60 * 30, // 30 minutos
    ...(sslConfig ? { ssl: sslConfig } : {}),
  });
  
  return {
    db: drizzlePostgres(sql, { schema }),
    sql
  };
}

const { db, sql } = createDatabase();
export { db };
export const dbSql = sql;
