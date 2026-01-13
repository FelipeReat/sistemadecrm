const { Client } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgres://compras:Compras2025@54.232.194.197:5432/crm';
const isProduction = process.env.NODE_ENV === 'production' || dbUrl.includes('amazonaws.com');

const client = new Client({
  connectionString: dbUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

client.connect()
  .then(() => {
    console.log('Conectado ao banco de dados');
    return client.query(`
      SELECT id, email, name, role, is_active, created_at 
      FROM users 
      WHERE email = 'admin@crm.com'
    `);
  })
  .then(res => {
    console.log('Usuários admin encontrados:');
    if (res.rows.length === 0) {
      console.log('❌ Nenhum usuário admin encontrado!');
    } else {
      res.rows.forEach(row => {
        console.log(`✅ Admin encontrado:`);
        console.log(`  - ID: ${row.id}`);
        console.log(`  - Email: ${row.email}`);
        console.log(`  - Nome: ${row.name}`);
        console.log(`  - Role: ${row.role}`);
        console.log(`  - Ativo: ${row.is_active}`);
        console.log(`  - Criado em: ${row.created_at}`);
      });
    }
    client.end();
  })
  .catch(err => {
    console.error('Erro:', err.message);
    client.end();
  });