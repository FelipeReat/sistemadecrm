const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

async function checkPasswordHash() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados');
    
    // Buscar o hash da senha do admin
    const result = await client.query(`
      SELECT email, password 
      FROM users 
      WHERE email = 'admin@crm.com'
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Usuário admin não encontrado!');
      return;
    }
    
    const user = result.rows[0];
    console.log('✅ Usuário encontrado:', user.email);
    console.log('Hash armazenado:', user.password);
    
    // Testar se a senha 'admin123' bate com o hash
    const isValid = await bcrypt.compare('admin123', user.password);
    console.log('Senha "admin123" é válida?', isValid ? '✅ SIM' : '❌ NÃO');
    
    // Gerar um novo hash para comparação
    const newHash = await bcrypt.hash('admin123', 10);
    console.log('Novo hash gerado:', newHash);
    
    // Testar o novo hash
    const newHashValid = await bcrypt.compare('admin123', newHash);
    console.log('Novo hash é válido?', newHashValid ? '✅ SIM' : '❌ NÃO');
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkPasswordHash();