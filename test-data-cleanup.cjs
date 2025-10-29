const { Client } = require('pg');
require('dotenv').config();

async function testDataCleanup() {
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
    console.log('✅ Conectado ao PostgreSQL');

    // Contar registros antes da limpeza
    const countBefore = await client.query('SELECT COUNT(*) FROM opportunities');
    console.log(`📊 Oportunidades antes da limpeza: ${countBefore.rows[0].count}`);

    // Testar uma operação que pode gerar notificação (inserir e deletar um registro de teste)
    console.log('🧪 Testando inserção de registro de teste...');
    const insertResult = await client.query(`
      INSERT INTO opportunities (
        company, contact, phone, phase, final_value, 
        salesperson, created_by, created_by_name
      ) VALUES (
        'Teste Limpeza', 'Contato Teste', '11999999999',
        'prospeccao', 1000.00, 'system', 'system', 'Sistema'
      ) RETURNING id
    `);
    
    const testId = insertResult.rows[0].id;
    console.log(`✅ Registro de teste criado com ID: ${testId}`);

    // Testar atualização (que pode gerar payload grande)
    console.log('🧪 Testando atualização do registro...');
    await client.query(`
      UPDATE opportunities 
      SET phase = 'negociacao', 
          company = 'Empresa Teste Atualizada com Nome Muito Longo Para Testar Payload'
      WHERE id = $1
    `, [testId]);
    console.log('✅ Atualização realizada com sucesso');

    // Testar exclusão
    console.log('🧪 Testando exclusão do registro...');
    await client.query('DELETE FROM opportunities WHERE id = $1', [testId]);
    console.log('✅ Exclusão realizada com sucesso');

    // Agora testar uma limpeza mais ampla (deletar alguns registros antigos se existirem)
    console.log('🧪 Testando limpeza de dados em lote...');
    
    // Primeiro, vamos criar alguns registros de teste para limpar
    await client.query(`
      INSERT INTO opportunities (
        company, contact, phone, phase, final_value, 
        salesperson, created_by, created_by_name
      ) 
      SELECT 
        'Teste Limpeza ' || generate_series,
        'Contato ' || generate_series,
        '11999999999',
        'prospeccao',
        1000.00 + generate_series,
        'system',
        'system',
        'Sistema'
      FROM generate_series(1, 5)
    `);
    console.log('✅ 5 registros de teste criados');

    // Agora deletar esses registros de teste
    const deleteResult = await client.query(`
      DELETE FROM opportunities 
      WHERE company LIKE 'Teste Limpeza %'
    `);
    console.log(`✅ ${deleteResult.rowCount} registros de teste removidos`);

    // Contar registros após a limpeza
    const countAfter = await client.query('SELECT COUNT(*) FROM opportunities');
    console.log(`📊 Oportunidades após a limpeza: ${countAfter.rows[0].count}`);

    console.log('🎉 Teste de limpeza de dados concluído com sucesso!');
    console.log('✅ A função notify_opportunity_change está funcionando corretamente');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    if (error.message.includes('payload string too long') || error.message.includes('cadeia da carga é muito longa')) {
      console.error('❌ O erro de payload ainda persiste!');
    }
  } finally {
    await client.end();
  }
}

testDataCleanup();