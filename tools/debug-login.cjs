const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

async function debugLogin() {
  try {
    await client.connect();
    console.log('🔍 Debug do processo de login...');
    
    // 1. Buscar usuário por email
    console.log('\n1. Buscando usuário por email...');
    const userResult = await client.query(`
      SELECT id, email, password, name, role, is_active 
      FROM users 
      WHERE email = $1
    `, ['admin@crm.com']);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Usuário não encontrado!');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ Usuário encontrado:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Nome: ${user.name}`);
    console.log(`  - Role: ${user.role}`);
    console.log(`  - Ativo: ${user.is_active}`);
    console.log(`  - Hash da senha: ${user.password}`);
    
    // 2. Verificar se está ativo
    console.log('\n2. Verificando se usuário está ativo...');
    if (!user.is_active) {
      console.log('❌ Usuário não está ativo!');
      return;
    }
    console.log('✅ Usuário está ativo');
    
    // 3. Testar comparação de senha
    console.log('\n3. Testando comparação de senha...');
    const password = 'admin123';
    console.log(`Senha testada: "${password}"`);
    console.log(`Hash armazenado: "${user.password}"`);
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`Resultado da comparação: ${isPasswordValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
    
    // 4. Testar com diferentes variações da senha
    console.log('\n4. Testando variações da senha...');
    const variations = ['admin123', 'Admin123', 'ADMIN123', 'admin123 ', ' admin123'];
    
    for (const variation of variations) {
      const result = await bcrypt.compare(variation, user.password);
      console.log(`"${variation}" -> ${result ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

debugLogin();