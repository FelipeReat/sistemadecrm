const { drizzle } = require('drizzle-orm/node-postgres');
const { eq } = require('drizzle-orm');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Importar o schema (simulado)
const users = {
  id: 'id',
  email: 'email',
  password: 'password',
  name: 'name',
  role: 'role',
  isActive: 'is_active', // Mapeamento
  createdAt: 'created_at',
  updatedAt: 'updated_at'
};

const pool = new Pool({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

const db = drizzle(pool);

async function debugDrizzle() {
  try {
    console.log('🔍 Debug do Drizzle ORM...');
    
    // Simular a query do Drizzle
    console.log('\n1. Query direta no PostgreSQL...');
    const client = await pool.connect();
    const directResult = await client.query(`
      SELECT id, email, password, name, role, is_active, created_at, updated_at
      FROM users 
      WHERE email = $1
    `, ['admin@crm.com']);
    
    if (directResult.rows.length > 0) {
      const user = directResult.rows[0];
      console.log('✅ Resultado direto do PostgreSQL:');
      console.log(`  - isActive (is_active): ${user.is_active}`);
      console.log(`  - Tipo: ${typeof user.is_active}`);
      
      // Simular o que o validateUserPassword faria
      console.log('\n2. Simulando validateUserPassword...');
      console.log(`Verificando: !user.isActive = ${!user.is_active}`);
      
      if (!user.is_active) {
        console.log('❌ Usuário seria rejeitado por !user.isActive');
      } else {
        console.log('✅ Usuário passaria na verificação de isActive');
        
        // Testar senha
        const isPasswordValid = await bcrypt.compare('admin123', user.password);
        console.log(`Senha válida: ${isPasswordValid ? '✅' : '❌'}`);
        
        if (isPasswordValid) {
          console.log('✅ Login deveria ser bem-sucedido!');
        } else {
          console.log('❌ Senha inválida');
        }
      }
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

debugDrizzle();