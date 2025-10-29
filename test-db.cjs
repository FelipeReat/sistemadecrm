const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

async function testDatabase() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');
    
    // Verificar oportunidades existentes
    const opportunities = await client.query('SELECT id, contact, salesperson FROM opportunities LIMIT 5');
    console.log('\n📋 Oportunidades encontradas:', opportunities.rows.length);
    
    if (opportunities.rows.length > 0) {
      console.log('\n🔍 Detalhes das oportunidades:');
      opportunities.rows.forEach((row, index) => {
        console.log(`${index + 1}. ID: ${row.id}`);
        console.log(`   Contato: ${row.contact}`);
        console.log(`   Vendedor ID: ${row.salesperson}`);
      });
      
      // Testar JOIN com users
      console.log('\n🔗 Testando JOIN com tabela users:');
      const joinResult = await client.query(`
        SELECT o.id, o.contact, o.salesperson, u.name as salesperson_name 
        FROM opportunities o 
        LEFT JOIN users u ON o.salesperson = u.id 
        LIMIT 5
      `);
      
      joinResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. Contato: ${row.contact}`);
        console.log(`   Vendedor ID: ${row.salesperson}`);
        console.log(`   Nome do Vendedor: ${row.salesperson_name || 'NÃO ENCONTRADO'}`);
        console.log('   ---');
      });
    }
    
    // Verificar usuários
    const users = await client.query('SELECT id, name, email FROM users');
    console.log(`\n👥 Usuários encontrados: ${users.rows.length}`);
    users.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - ID: ${user.id}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

testDatabase();