const { Client } = require('pg');

async function checkSchema() {
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
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' 
      ORDER BY ordinal_position
    `);
    console.log('Colunas da tabela opportunities:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
    });
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.end();
  }
}

checkSchema();