import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const isProduction = process.env.NODE_ENV === 'production';

// Create database connection based on environment
function createDatabase() {
  if (isProduction) {
    // Production: PostgreSQL
    const productionDbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
    if (!productionDbUrl) {
      throw new Error(
        "PROD_DATABASE_URL must be set in production environment",
      );
    }
    
    const pool = new Pool({ connectionString: productionDbUrl });
    return {
      db: drizzlePostgres({ client: pool, schema }),
      pool
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

const { db, pool } = createDatabase();
export { db };
export const dbPool = pool;