const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

async function debugOpportunities() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');
    
    // 1. Verificar quantas oportunidades existem
    const totalOpps = await client.query('SELECT COUNT(*) as total FROM opportunities');
    console.log(`\n📊 Total de oportunidades: ${totalOpps.rows[0].total}`);
    
    // 2. Verificar se há oportunidades com salesperson como UUID
    const uuidOpps = await client.query(`
      SELECT COUNT(*) as total 
      FROM opportunities 
      WHERE salesperson IS NOT NULL 
      AND LENGTH(salesperson) = 36
      AND salesperson ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `);
    console.log(`📊 Oportunidades com UUID no salesperson: ${uuidOpps.rows[0].total}`);
    
    // 3. Verificar se há oportunidades com salesperson como nome
    const nameOpps = await client.query(`
      SELECT COUNT(*) as total 
      FROM opportunities 
      WHERE salesperson IS NOT NULL 
      AND LENGTH(salesperson) != 36
    `);
    console.log(`📊 Oportunidades com nome no salesperson: ${nameOpps.rows[0].total}`);
    
    // 4. Testar a query exata do getOpportunities
    console.log('\n🔍 Testando query do getOpportunities...');
    const testQuery = `
      SELECT 
        o.id,
        o.contact,
        o.salesperson,
        u.name as salesperson_name
      FROM opportunities o
      LEFT JOIN users u ON o.salesperson = u.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `;
    
    const testResult = await client.query(testQuery);
    console.log(`📋 Resultados da query (${testResult.rows.length} linhas):`);
    
    testResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. Contato: ${row.contact}`);
      console.log(`   Salesperson ID: ${row.salesperson}`);
      console.log(`   Nome do Vendedor: ${row.salesperson_name || 'NULL'}`);
      console.log(`   ---`);
    });
    
    // 5. Verificar se há problemas com a coluna visit_date
    try {
      const visitDateTest = await client.query('SELECT visit_date FROM opportunities LIMIT 1');
      console.log('\n✅ Coluna visit_date existe');
    } catch (error) {
      console.log('\n❌ Erro com coluna visit_date:', error.message);
    }
    
    // 6. Verificar estrutura da tabela opportunities
    console.log('\n🔍 Verificando estrutura da tabela opportunities...');
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela opportunities:');
    tableStructure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

debugOpportunities();