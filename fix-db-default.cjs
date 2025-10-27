const postgres = require('postgres');
require('dotenv').config({ path: '.env.development' });

const sql = postgres(process.env.DEV_DATABASE_URL || process.env.DATABASE_URL, { 
  ssl: false,
  max: 1
});

async function fixDbDefault() {
  try {
    console.log('🔧 Aplicando valor padrão para created_by_name...');
    
    // Primeiro, atualizar todos os registros existentes que possam ter valor nulo
    const updateResult = await sql`
      UPDATE opportunities 
      SET created_by_name = 'Sistema' 
      WHERE created_by_name IS NULL OR created_by_name = ''
    `;
    
    console.log('📝 Registros atualizados:', updateResult.count);
    
    // Adicionar valor padrão à coluna
    await sql`
      ALTER TABLE opportunities 
      ALTER COLUMN created_by_name SET DEFAULT 'Sistema'
    `;
    
    console.log('✅ Valor padrão definido como "Sistema"');
    
    // Verificar se funcionou
    const verification = await sql`
      SELECT column_name, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' 
      AND column_name = 'created_by_name'
    `;
    
    console.log('🔍 Verificação:', verification);
    
    await sql.end();
    console.log('✅ Correção concluída');
  } catch (error) {
    console.error('❌ Erro ao corrigir default:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

fixDbDefault();