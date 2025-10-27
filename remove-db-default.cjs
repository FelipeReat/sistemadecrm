const postgres = require('postgres');
require('dotenv').config({ path: '.env.development' });

const sql = postgres(process.env.DEV_DATABASE_URL || process.env.DATABASE_URL, { 
  ssl: false,
  max: 1
});

async function removeDbDefault() {
  try {
    console.log('🔧 Removendo valor padrão da coluna created_by_name...');
    
    // Remover o valor padrão da coluna
    await sql`
      ALTER TABLE opportunities 
      ALTER COLUMN created_by_name DROP DEFAULT
    `;
    
    console.log('✅ Valor padrão removido da coluna created_by_name');
    
    // Verificar se funcionou
    const verification = await sql`
      SELECT column_name, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' 
      AND column_name = 'created_by_name'
    `;
    
    console.log('🔍 Verificação:', verification);
    
    await sql.end();
    console.log('✅ Remoção do valor padrão concluída');
  } catch (error) {
    console.error('❌ Erro ao remover default:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

removeDbDefault();