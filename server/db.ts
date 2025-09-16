import 'dotenv/config';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

const isDatabaseProduction = process.env.NODE_ENV === 'production';

// Create database connection based on environment
function createDatabase() {
  // Use the Replit-provided DATABASE_URL for both development and production
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set");
  }

  // Add SSL configuration for managed PostgreSQL databases (like Neon, Supabase, etc.)
  const ssl = !/localhost|127\.0\.0\.1/.test(databaseUrl) ? 'require' : false;
  
  const sql = postgres(databaseUrl, {
    max: 10, // Pool de 10 conexões
    connect_timeout: 30,
    ssl: ssl
  });
  
  return {
    db: drizzlePostgres(sql, { schema }),
    sql
  };
}

const { db, sql } = createDatabase();
export { db };
export const dbSql = sql;