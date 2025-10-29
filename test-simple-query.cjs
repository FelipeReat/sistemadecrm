const { Client } = require('pg');

async function testSimpleQuery() {
  const client = new Client({
    host: '54.232.194.197',
    port: 5432,
    database: 'crm',
    user: 'compras',
    password: 'Compras2025',
    ssl: false
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    // Teste 1: Contar oportunidades
    const countResult = await client.query('SELECT COUNT(*) FROM opportunities');
    console.log(`📊 Total de oportunidades: ${countResult.rows[0].count}`);

    // Teste 2: Buscar oportunidades com JOIN simples
    const joinQuery = `
      SELECT 
        o.id,
        o.contact,
        o.salesperson,
        u.name as salesperson_name
      FROM opportunities o
      LEFT JOIN users u ON o.salesperson = u.id
      LIMIT 5
    `;
    
    const joinResult = await client.query(joinQuery);
    console.log('\n🔍 Oportunidades com JOIN:');
    joinResult.rows.forEach(row => {
      console.log(`- ${row.contact}: Vendedor ID = ${row.salesperson}, Nome = ${row.salesperson_name || 'NÃO ENCONTRADO'}`);
    });

    // Teste 3: Verificar usuários
    const usersResult = await client.query('SELECT id, name FROM users LIMIT 10');
    console.log('\n👥 Usuários disponíveis:');
    usersResult.rows.forEach(user => {
      console.log(`- ID: ${user.id}, Nome: ${user.name}`);
    });

    // Teste 4: Verificar se há correspondência
    const matchQuery = `
      SELECT 
        o.salesperson,
        COUNT(*) as count,
        MAX(u.name) as matched_name
      FROM opportunities o
      LEFT JOIN users u ON o.salesperson = u.id
      GROUP BY o.salesperson
    `;
    
    const matchResult = await client.query(matchQuery);
    console.log('\n🎯 Análise de correspondências:');
    matchResult.rows.forEach(row => {
      console.log(`- Vendedor ID: ${row.salesperson}, Oportunidades: ${row.count}, Nome encontrado: ${row.matched_name || 'NÃO'}`);
    });

    // Teste 5: Verificar tipos de dados
    const typeQuery = `
      SELECT 
        o.salesperson,
        pg_typeof(o.salesperson) as salesperson_type,
        u.id,
        pg_typeof(u.id) as user_id_type
      FROM opportunities o
      LEFT JOIN users u ON o.salesperson = u.id
      LIMIT 3
    `;
    
    const typeResult = await client.query(typeQuery);
    console.log('\n🔍 Tipos de dados:');
    typeResult.rows.forEach(row => {
      console.log(`- Salesperson: ${row.salesperson} (${row.salesperson_type}), User ID: ${row.id} (${row.user_id_type})`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await client.end();
  }
}

testSimpleQuery();