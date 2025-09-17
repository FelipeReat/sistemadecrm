
import 'dotenv/config';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// SEMPRE usar PostgreSQL (tanto desenvolvimento quanto produção)
function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set. Configure your PostgreSQL connection string.");
  }

  // Add SSL configuration for managed PostgreSQL databases
  const ssl = !/localhost|127\.0\.0\.1/.test(databaseUrl) ? 'require' : false;
  
  const sql = postgres(databaseUrl, {
    max: 10,
    connect_timeout: 30,
    ssl: ssl === 'require' ? {
      rejectUnauthorized: false,
      requestCert: false,
      agent: false,
      checkServerIdentity: () => undefined
    } : false
  });
  
  return {
    db: drizzlePostgres(sql, { schema }),
    sql
  };
}

const { db, sql } = createDatabase();
export { db };
export const dbSql = sql;
