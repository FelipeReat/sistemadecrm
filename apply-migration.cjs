const postgres = require('postgres');

const sql = postgres(process.env.DEV_DATABASE_URL || process.env.DATABASE_URL, { 
  ssl: false,
  max: 1
});

async function applyMigration() {
  try {
    console.log('Aplicando migração do campo cadastral_update...');
    await sql`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS cadastral_update BOOLEAN DEFAULT FALSE`;
    console.log('✅ Migração aplicada com sucesso!');
    await sql.end();
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error.message);
    process.exit(1);
  }
}

applyMigration();