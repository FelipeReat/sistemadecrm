const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false
});

async function checkTriggers() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');
    
    // Verificar triggers na tabela opportunities
    console.log('\n🔍 Verificando triggers na tabela opportunities...');
    const triggersResult = await client.query(`
      SELECT 
        trigger_name, 
        event_manipulation, 
        action_timing, 
        action_statement,
        trigger_schema,
        trigger_catalog
      FROM information_schema.triggers 
      WHERE event_object_table = 'opportunities'
      ORDER BY trigger_name
    `);
    
    if (triggersResult.rows.length === 0) {
      console.log('❌ Nenhum trigger encontrado na tabela opportunities!');
    } else {
      console.log(`✅ Encontrados ${triggersResult.rows.length} triggers:`);
      triggersResult.rows.forEach(trigger => {
        console.log(`  - ${trigger.trigger_name}`);
        console.log(`    Evento: ${trigger.event_manipulation}`);
        console.log(`    Timing: ${trigger.action_timing}`);
        console.log(`    Action: ${trigger.action_statement}`);
        console.log('');
      });
    }
    
    // Verificar se os triggers específicos existem
    console.log('\n🔍 Verificando triggers específicos mencionados no código...');
    const specificTriggers = [
      'opportunity_insert_trigger',
      'opportunity_update_trigger', 
      'opportunity_update_timestamps_trigger'
    ];
    
    for (const triggerName of specificTriggers) {
      const exists = triggersResult.rows.some(row => row.trigger_name === triggerName);
      if (exists) {
        console.log(`✅ ${triggerName} - EXISTE`);
      } else {
        console.log(`❌ ${triggerName} - NÃO EXISTE`);
      }
    }
    
    // Verificar índices na tabela opportunities
    console.log('\n🔍 Verificando índices na tabela opportunities...');
    const indexesResult = await client.query(`
      SELECT 
        indexname, 
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'opportunities'
      ORDER BY indexname
    `);
    
    console.log(`📊 Encontrados ${indexesResult.rows.length} índices:`);
    indexesResult.rows.forEach(index => {
      console.log(`  - ${index.indexname}`);
      console.log(`    Definição: ${index.indexdef}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkTriggers();