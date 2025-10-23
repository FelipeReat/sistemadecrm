const { Client } = require('pg');

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DEV_DATABASE_URL || "postgres://compras:Compras2025@54.232.194.197:5432/crm",
    ssl: false
  });

  try {
    console.log('🔗 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    console.log('📝 Aplicando migração...');
    await client.query('ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cadastral_update BOOLEAN DEFAULT FALSE');
    console.log('✅ Migração aplicada com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexão fechada');
  }
}

applyMigration();