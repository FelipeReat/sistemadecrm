import 'dotenv/config';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import postgres from 'postgres';
import * as schema from "@shared/schema";

const isProduction = process.env.NODE_ENV === 'production';

// Create database connection based on environment
function createDatabase() {
  if (isProduction) {
    // Production: PostgreSQL (RDS)
    const productionDbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
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
  } else {
    // Development: SQLite
    const sqlite = new Database('./dev.db');
    return {
      db: drizzleSqlite(sqlite, { schema }),
      sqlite
    };
  }
}

const { db, sql } = createDatabase();
export { db };
export const dbSql = sql;