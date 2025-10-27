const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

client.connect()
  .then(() => {
    console.log('Conectado ao banco de dados');
    return client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
  })
  .then(res => {
    console.log('Colunas da tabela users:');
    res.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    client.end();
  })
  .catch(err => {
    console.error('Erro:', err.message);
    client.end();
  });