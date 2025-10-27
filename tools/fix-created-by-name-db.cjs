const postgres = require('postgres');

async function fixCreatedByNameColumn() {
  const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: 'crm_db',
    username: 'postgres',
    password: 'postgres123'
  });

  try {
    console.log('🔧 Conectando ao banco de dados...');
    
    // Primeiro, atualizar todos os registros nulos existentes
    console.log('📝 Atualizando registros com created_by_name nulo...');
    const updateResult = await sql`
      UPDATE opportunities 
      SET created_by_name = 'Sistema' 
      WHERE created_by_name IS NULL
    `;
    console.log('✅ Registros atualizados:', updateResult.count);
    
    // Adicionar valor padrão à coluna
    console.log('🔧 Adicionando valor padrão à coluna...');
    await sql`
      ALTER TABLE opportunities 
      ALTER COLUMN created_by_name SET DEFAULT 'Sistema'
    `;
    console.log('✅ Valor padrão definido com sucesso!');
    
    // Verificar se há ainda registros nulos
    console.log('🔍 Verificando registros nulos restantes...');
    const nullCount = await sql`
      SELECT COUNT(*) as count 
      FROM opportunities 
      WHERE created_by_name IS NULL
    `;
    console.log('📊 Registros nulos restantes:', nullCount[0].count);
    
    console.log('✅ Correção concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir coluna:', error);
  } finally {
    await sql.end();
  }
}

fixCreatedByNameColumn();