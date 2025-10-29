const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

async function addMissingColumns() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');
    
    // Adicionar colunas que podem estar faltando
    const queries = [
      'ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS visit_description text',
      'ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS visit_realization text'
    ];
    
    for (const query of queries) {
      try {
        await client.query(query);
        console.log(`✅ Executado: ${query}`);
      } catch (error) {
        console.log(`⚠️  Erro ao executar: ${query} - ${error.message}`);
      }
    }
    
    console.log('\n🔍 Verificando estrutura atualizada...');
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' 
      AND column_name IN ('visit_description', 'visit_realization')
      ORDER BY column_name
    `);
    
    console.log('📋 Colunas de visita encontradas:');
    tableStructure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

addMissingColumns();