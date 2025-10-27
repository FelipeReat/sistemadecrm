const { Pool } = require('pg');

async function checkDatabaseSchema() {
  console.log('🔍 Verificando schema do banco de dados...');
  
  const pool = new Pool({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });
  
  try {
    const client = await pool.connect();
    
    // 1. Verificar se a tabela opportunities existe
    console.log('\n1. Verificando se a tabela opportunities existe...');
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'opportunities'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabela opportunities não existe!');
      
      // Listar todas as tabelas
      console.log('\n📋 Tabelas existentes no banco:');
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      
      tables.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
      
      client.release();
      await pool.end();
      return;
    }
    
    console.log('✅ Tabela opportunities existe!');
    
    // 2. Verificar colunas da tabela opportunities
    console.log('\n2. Verificando colunas da tabela opportunities...');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'opportunities'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Colunas da tabela opportunities:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // 3. Verificar triggers
    console.log('\n3. Verificando triggers na tabela opportunities...');
    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers 
      WHERE event_object_table = 'opportunities'
      ORDER BY trigger_name;
    `);
    
    if (triggers.rows.length > 0) {
      console.log('📋 Triggers encontrados:');
      triggers.rows.forEach(trigger => {
        console.log(`  - ${trigger.trigger_name} (${trigger.action_timing} ${trigger.event_manipulation})`);
      });
    } else {
      console.log('❌ Nenhum trigger encontrado na tabela opportunities');
    }
    
    // 4. Verificar funções relacionadas a notificações
    console.log('\n4. Verificando funções de notificação...');
    const functions = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name LIKE '%notify%'
      ORDER BY routine_name;
    `);
    
    if (functions.rows.length > 0) {
      console.log('📋 Funções de notificação encontradas:');
      functions.rows.forEach(func => {
        console.log(`  - ${func.routine_name} (${func.routine_type})`);
      });
    } else {
      console.log('❌ Nenhuma função de notificação encontrada');
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro ao verificar schema:', error);
    await pool.end();
  }
}

checkDatabaseSchema();