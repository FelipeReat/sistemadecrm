const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyRealtimeTriggers() {
  console.log('🔧 Aplicando triggers de tempo real...');
  
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
    ssl: false
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL');

    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'migrations', '0008_add_realtime_triggers.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executando SQL dos triggers...');
    await client.query(sql);
    
    console.log('✅ Triggers de tempo real aplicados com sucesso!');
    
    // Testar se os triggers foram criados
    console.log('🔍 Verificando triggers criados...');
    const result = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE event_object_table = 'opportunities'
      ORDER BY trigger_name;
    `);
    
    console.log('📋 Triggers encontrados:');
    result.rows.forEach(row => {
      console.log(`  - ${row.trigger_name} (${row.event_manipulation}) na tabela ${row.event_object_table}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao aplicar triggers:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

applyRealtimeTriggers();