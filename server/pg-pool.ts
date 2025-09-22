import pkg from 'pg';
const { Pool, Client } = pkg;

export function getPgPool() {
  let dbUrl = process.env.NODE_ENV === 'production' 
    ? process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

  // Em produção, remova qualquer parâmetro sslmode da URL
  if (process.env.NODE_ENV === 'production' && dbUrl) {
    dbUrl = dbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
  }

  // Configuração SSL baseada no ambiente e suporte do servidor
  let sslConfig;
  if (process.env.NODE_ENV === 'production') {
    // Em produção, SEMPRE usar SSL
    if (process.env.ALLOW_SELF_SIGNED_CERTS === 'true') {
      sslConfig = { 
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
      };
    } else {
      sslConfig = { 
        rejectUnauthorized: true,
        requestCert: true
      };
    }
  } else {
    // Em desenvolvimento, desabilita SSL se o servidor não suportar
    sslConfig = process.env.DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false };
  }

  return new Pool({
    connectionString: dbUrl,
    ssl: sslConfig,
    // Configurações de pool otimizadas para conexões instáveis
    max: 5,
    min: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    acquireTimeoutMillis: 5000,
    // Configurações para lidar com conexões perdidas
    keepAlive: false,
    statement_timeout: 5000,
    query_timeout: 5000,
  });
}

// Função para criar conexão direta para operações críticas
export function createDirectConnection() {
  let dbUrl = process.env.NODE_ENV === 'production' 
    ? process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

  // Em produção, remova qualquer parâmetro sslmode da URL
  if (process.env.NODE_ENV === 'production' && dbUrl) {
    dbUrl = dbUrl.replace(/[?&]ssl(mode)?=[^&]*/g, '');
  }

  // Configuração SSL baseada no ambiente e suporte do servidor
  let sslConfig;
  if (process.env.NODE_ENV === 'production') {
    // Em produção, SEMPRE usar SSL
    if (process.env.ALLOW_SELF_SIGNED_CERTS === 'true') {
      sslConfig = { 
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
      };
    } else {
      sslConfig = { 
        rejectUnauthorized: true,
        requestCert: true
      };
    }
  } else {
    // Em desenvolvimento, desabilita SSL se o servidor não suportar
    sslConfig = process.env.DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false };
  }

  return new Client({
    connectionString: dbUrl,
    ssl: sslConfig,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    query_timeout: 5000,
  });
}