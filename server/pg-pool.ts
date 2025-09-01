import pkg from 'pg';
const { Pool } = pkg;

export function getPgPool() {
  let dbUrl = process.env.NODE_ENV === 'production' 
    ? process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

  // Em produção, remova qualquer parâmetro sslmode da URL
  if (process.env.NODE_ENV === 'production' && dbUrl) {
    dbUrl = dbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
  }

  return new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
}
