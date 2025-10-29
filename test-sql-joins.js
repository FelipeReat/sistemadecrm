const { Client } = require('pg');

async function testSQLJoins() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'crm_db',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();
    console.log(' Conectado ao banco de dados');

    // Primeiro, verificar se existem dados na tabela users
    console.log('\n Verificando dados na tabela users:');
    const usersResult = await client.query('SELECT id, name, email FROM users LIMIT 5');
    console.log('Usuários encontrados:', usersResult.rows);

    // Verificar se existem oportunidades
    console.log('\n Verificando oportunidades:');
    const oppsResult = await client.query('SELECT id, contact, salesperson FROM opportunities LIMIT 5');
    console.log('Oportunidades encontradas:', oppsResult.rows);

    // Testar o JOIN que está sendo usado no código
    console.log('\n Testando JOIN entre opportunities e users:');
    const joinQuery = 
      SELECT 
        o.id,
        o.contact,
        o.salesperson as salesperson_id,
        u.name as salesperson_name
      FROM opportunities o
      LEFT JOIN users u ON o.salesperson = u.id
      LIMIT 5
    ;
    
    const joinResult = await client.query(joinQuery);
    console.log('Resultado do JOIN:', joinResult.rows);

    // Verificar se há oportunidades com salesperson que não existe na tabela users
    console.log('\n Verificando oportunidades com salesperson inválido:');
    const orphanQuery = 
      SELECT 
        o.id,
        o.contact,
        o.salesperson
      FROM opportunities o
      LEFT JOIN users u ON o.salesperson = u.id
      WHERE u.id IS NULL AND o.salesperson IS NOT NULL
      LIMIT 5
    ;
    
    const orphanResult = await client.query(orphanQuery);
    console.log('Oportunidades com salesperson inválido:', orphanResult.rows);

  } catch (error) {
    console.error(' Erro ao testar SQL:', error.message);
  } finally {
    await client.end();
  }
}

testSQLJoins();