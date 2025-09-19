import { defineConfig } from "drizzle-kit";

// Determinar qual variável de ambiente usar baseado no NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isProduction 
  ? process.env.PROD_DATABASE_URL 
  : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  const envVar = isProduction ? 'PROD_DATABASE_URL' : 'DEV_DATABASE_URL';
  throw new Error(`${envVar} must be set. Configure your PostgreSQL connection string for ${isProduction ? 'production' : 'development'} environment.`);
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
