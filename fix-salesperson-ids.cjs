const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

async function fixSalespersonIds() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');
    
    // Primeiro, vamos mapear os nomes para IDs
    const users = await client.query('SELECT id, name FROM users');
    const userMap = {};
    users.rows.forEach(user => {
      userMap[user.name.toLowerCase()] = user.id;
    });
    
    console.log('\n👥 Mapeamento de usuários:');
    Object.keys(userMap).forEach(name => {
      console.log(`${name} -> ${userMap[name]}`);
    });
    
    // Buscar oportunidades com nomes no campo salesperson
    const opportunities = await client.query(`
      SELECT id, contact, salesperson 
      FROM opportunities 
      WHERE salesperson IS NOT NULL 
      AND salesperson != ''
    `);
    
    console.log(`\n📋 Encontradas ${opportunities.rows.length} oportunidades para corrigir`);
    
    let corrected = 0;
    let notFound = 0;
    
    for (const opp of opportunities.rows) {
      const salespersonName = opp.salesperson;
      
      // Verificar se já é um UUID (36 caracteres com hífens)
      if (salespersonName && salespersonName.length === 36 && salespersonName.includes('-')) {
        console.log(`⏭️  Oportunidade ${opp.contact}: já tem UUID válido`);
        continue;
      }
      
      const userId = userMap[salespersonName.toLowerCase()];
      
      if (userId) {
        await client.query(
          'UPDATE opportunities SET salesperson = $1 WHERE id = $2',
          [userId, opp.id]
        );
        console.log(`✅ ${opp.contact}: "${salespersonName}" -> ${userId}`);
        corrected++;
      } else {
        console.log(`❌ ${opp.contact}: Nome "${salespersonName}" não encontrado nos usuários`);
        notFound++;
      }
    }
    
    console.log(`\n📊 Resumo:`);
    console.log(`✅ Corrigidas: ${corrected}`);
    console.log(`❌ Não encontradas: ${notFound}`);
    
    // Verificar resultado final
    console.log('\n🔍 Verificando resultado final...');
    const finalCheck = await client.query(`
      SELECT o.contact, o.salesperson, u.name as salesperson_name 
      FROM opportunities o 
      LEFT JOIN users u ON o.salesperson = u.id 
      WHERE o.salesperson IS NOT NULL 
      LIMIT 10
    `);
    
    finalCheck.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.contact}`);
      console.log(`   Vendedor ID: ${row.salesperson}`);
      console.log(`   Nome: ${row.salesperson_name || 'NÃO ENCONTRADO'}`);
      console.log('   ---');
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

fixSalespersonIds();