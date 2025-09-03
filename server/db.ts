import 'dotenv/config';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

const isDatabaseProduction = process.env.NODE_ENV === 'production';

// Create database connection based on environment
function createDatabase() {
  // Production: PostgreSQL (RDS)
  let productionDbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!isDatabaseProduction) {
    productionDbUrl = process.env.DEV_DATABASE_URL;
  }
  if (!productionDbUrl) {
    throw new Error(
      "PROD_DATABASE_URL must be set in production environment",
    );
  }
  
  // Remove configurações SSL da URL e adiciona sslmode=require
  let cleanDbUrl = productionDbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
  cleanDbUrl += cleanDbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';

  const sql = postgres(cleanDbUrl, {
    max: 10, // Pool de 10 conexões
    connect_timeout: 30
  });
  
  return {
    db: drizzlePostgres(sql, { schema }),
    sql
  };
}

const { db, sql } = createDatabase();
export { db };
export const dbSql = sql;