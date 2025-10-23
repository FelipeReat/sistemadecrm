const postgres = require('postgres');
require('dotenv').config({ path: '.env.development' });

const sql = postgres(process.env.DEV_DATABASE_URL || process.env.DATABASE_URL, { 
  ssl: false,
  max: 1
});

async function applyCreatedByMigration() {
  try {
    console.log('Aplicando migração do campo created_by_name...');
    
    // Adicionar coluna created_by_name à tabela opportunities
    console.log('1. Adicionando coluna created_by_name...');
    await sql`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255)`;
    
    // Criar índice para melhor performance nas consultas
    console.log('2. Criando índice para performance...');
    await sql`CREATE INDEX IF NOT EXISTS idx_opportunities_created_by_name ON opportunities(created_by_name)`;
    
    // Atualizar registros existentes com nome do usuário padrão
    console.log('3. Atualizando registros existentes...');
    await sql`UPDATE opportunities SET created_by_name = 'Sistema' WHERE created_by_name IS NULL`;
    
    // Tornar o campo obrigatório após preencher dados existentes
    console.log('4. Tornando campo obrigatório...');
    await sql`ALTER TABLE opportunities ALTER COLUMN created_by_name SET NOT NULL`;
    
    // Adicionar constraint para garantir que o nome não seja vazio
    console.log('5. Adicionando constraint de validação...');
    await sql`ALTER TABLE opportunities ADD CONSTRAINT check_created_by_name_not_empty CHECK (length(trim(created_by_name)) > 0)`;
    
    console.log('✅ Migração do campo created_by_name aplicada com sucesso!');
    await sql.end();
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

applyCreatedByMigration();