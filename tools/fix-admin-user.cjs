
const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgres://compras:Compras2025@54.232.194.197:5432/crm';
const isProduction = process.env.NODE_ENV === 'production' || dbUrl.includes('amazonaws.com');

const client = new Client({
  connectionString: dbUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000,
});

async function fixAdminUser() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');
    
    // 1. Verificar se existe o usuário admin
    console.log('\n🔍 Verificando usuário admin...');
    const adminResult = await client.query(`
      SELECT id, email, name, role, is_active, password 
      FROM users 
      WHERE email = 'admin@crm.com'
    `);
    
    if (adminResult.rows.length === 0) {
      console.log('❌ Usuário admin não encontrado! Criando...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const id = require('crypto').randomUUID();
      
      await client.query(`
        INSERT INTO users (id, email, password, name, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id,
        'admin@crm.com',
        hashedPassword,
        'Administrador',
        'admin',
        true,
        new Date(),
        new Date()
      ]);
      
      console.log('✅ Usuário admin criado com sucesso!');
    } else {
      const admin = adminResult.rows[0];
      console.log('✅ Usuário admin encontrado:');
      console.log(`  - ID: ${admin.id}`);
      console.log(`  - Email: ${admin.email}`);
      console.log(`  - Nome: ${admin.name}`);
      console.log(`  - Role: ${admin.role}`);
      console.log(`  - Ativo: ${admin.is_active}`);
      
      // 2. Testar a senha atual
      console.log('\n🔐 Testando senha atual...');
      const isValidPassword = await bcrypt.compare('admin123', admin.password);
      
      if (!isValidPassword) {
        console.log('❌ Senha atual não é válida! Redefinindo...');
        const newHashedPassword = await bcrypt.hash('admin123', 10);
        
        await client.query(`
          UPDATE users 
          SET password = $1, updated_at = $2 
          WHERE email = 'admin@crm.com'
        `, [newHashedPassword, new Date()]);
        
        console.log('✅ Senha redefinida com sucesso!');
      } else {
        console.log('✅ Senha atual é válida!');
      }
      
      // 3. Garantir que está ativo
      if (!admin.is_active) {
        console.log('❌ Usuário está inativo! Ativando...');
        await client.query(`
          UPDATE users 
          SET is_active = true, updated_at = $1 
          WHERE email = 'admin@crm.com'
        `, [new Date()]);
        console.log('✅ Usuário ativado!');
      }
    }
    
    // 4. Teste final de login
    console.log('\n🧪 Teste final de validação...');
    const finalResult = await client.query(`
      SELECT * FROM users WHERE email = 'admin@crm.com'
    `);
    
    const finalUser = finalResult.rows[0];
    const finalTest = await bcrypt.compare('admin123', finalUser.password);
    
    if (finalTest && finalUser.is_active) {
      console.log('✅ SUCESSO! Usuário admin está funcionando corretamente');
      console.log('📧 Email: admin@crm.com');
      console.log('🔑 Senha: admin123');
    } else {
      console.log('❌ ERRO: Ainda há problemas com o usuário admin');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

fixAdminUser();
