const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

async function createMissingUsers() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');
    
    // Buscar nomes únicos de vendedores que não são UUIDs
    const uniqueNames = await client.query(`
      SELECT DISTINCT salesperson 
      FROM opportunities 
      WHERE salesperson IS NOT NULL 
      AND salesperson != ''
      AND LENGTH(salesperson) != 36
    `);
    
    console.log(`\n📋 Encontrados ${uniqueNames.rows.length} nomes únicos de vendedores`);
    
    // Buscar usuários existentes
    const existingUsers = await client.query('SELECT name FROM users');
    const existingNames = existingUsers.rows.map(u => u.name.toLowerCase());
    
    let created = 0;
    
    for (const row of uniqueNames.rows) {
      const name = row.salesperson;
      
      if (!existingNames.includes(name.toLowerCase())) {
        const hashedPassword = await bcrypt.hash('123456', 10);
        const email = `${name.toLowerCase().replace(/\s+/g, '.')}@crm.com`;
        
        await client.query(`
          INSERT INTO users (id, name, email, password, role, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, [
          randomUUID(),
          name,
          email,
          hashedPassword,
          'usuario',
          true
        ]);
        
        console.log(`✅ Criado usuário: ${name} (${email})`);
        created++;
      } else {
        console.log(`⏭️  Usuário já existe: ${name}`);
      }
    }
    
    console.log(`\n📊 Resumo: ${created} usuários criados`);
    
    // Agora executar o script de correção novamente
    console.log('\n🔄 Executando correção de IDs...');
    
    // Recriar mapeamento
    const users = await client.query('SELECT id, name FROM users');
    const userMap = {};
    users.rows.forEach(user => {
      userMap[user.name.toLowerCase()] = user.id;
    });
    
    // Corrigir oportunidades
    const opportunities = await client.query(`
      SELECT id, contact, salesperson 
      FROM opportunities 
      WHERE salesperson IS NOT NULL 
      AND salesperson != ''
      AND LENGTH(salesperson) != 36
    `);
    
    let corrected = 0;
    
    for (const opp of opportunities.rows) {
      const salespersonName = opp.salesperson;
      const userId = userMap[salespersonName.toLowerCase()];
      
      if (userId) {
        await client.query(
          'UPDATE opportunities SET salesperson = $1 WHERE id = $2',
          [userId, opp.id]
        );
        console.log(`✅ ${opp.contact}: "${salespersonName}" -> ${userId}`);
        corrected++;
      }
    }
    
    console.log(`\n📊 Correções: ${corrected} oportunidades atualizadas`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

createMissingUsers();
