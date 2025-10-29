const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testInsertOpportunity() {
  try {
    console.log('🧪 Testando inserção de oportunidade...\n');
    console.log('🔗 Conectando ao banco:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@'));

    // Teste 1: Inserção básica sem visit_date
    console.log('📝 Teste 1: Inserção básica sem visit_date');
    const basicInsert = `
      INSERT INTO opportunities (
        id, contact, company, phase, created_by, created_at, updated_at, phase_updated_at
      ) VALUES (
        gen_random_uuid(), 'Teste Contato', 'Teste Empresa', 'prospeccao', 'teste', NOW(), NOW(), NOW()
      ) RETURNING id, contact, company;
    `;
    
    const basicResult = await pool.query(basicInsert);
    console.log('✅ Inserção básica funcionou:', basicResult.rows[0]);
    
    // Teste 2: Inserção com visit_date
    console.log('\n📝 Teste 2: Inserção com visit_date');
    const visitInsert = `
      INSERT INTO opportunities (
        id, contact, company, phase, visit_date, created_by, created_at, updated_at, phase_updated_at
      ) VALUES (
        gen_random_uuid(), 'Teste Visita', 'Teste Empresa Visita', 'visita-tecnica', '2024-01-15 10:00:00', 'teste', NOW(), NOW(), NOW()
      ) RETURNING id, contact, visit_date;
    `;
    
    const visitResult = await pool.query(visitInsert);
    console.log('✅ Inserção com visit_date funcionou:', visitResult.rows[0]);
    
    // Teste 3: Verificar se as colunas existem
    console.log('\n📝 Teste 3: Verificando colunas visit_*');
    const columnsCheck = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' 
      AND column_name LIKE '%visit%'
      ORDER BY column_name;
    `;
    
    const columnsResult = await pool.query(columnsCheck);
    console.log('📋 Colunas visit_* encontradas:');
    columnsResult.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });
    
    // Teste 4: Tentar reproduzir o erro exato
    console.log('\n📝 Teste 4: Tentando reproduzir o erro com dados completos');
    const fullInsert = `
      INSERT INTO opportunities (
        id, contact, cpf, company, cnpj, phone, has_registration, 
        proposal_origin, business_temperature, need_category, client_needs, 
        documents, opportunity_number, salesperson, requires_visit, statement, 
        visit_schedule, visit_date, visit_description, visit_realization, visit_photos, 
        discount, discount_description, validity_date, budget_number, budget, 
        status, final_value, negotiation_info, contract, invoice_number, 
        loss_reason, loss_observation, phase, created_by, created_by_name,
        is_imported, import_batch_id, import_source, created_at, updated_at, phase_updated_at
      ) VALUES (
        gen_random_uuid(), 'Teste Completo', '12345678901', 'Empresa Teste', null, '11999999999', false,
        'SDR', 'morno', 'Categoria Teste', 'Necessidades teste',
        '{}', null, null, false, null,
        null, null, null, null, '{}',
        null, null, null, null, null,
        null, null, null, null, null,
        null, null, 'prospeccao', 'teste', 'Teste User',
        false, null, null, NOW(), NOW(), NOW()
      ) RETURNING id, contact, visit_date;
    `;
    
    const fullResult = await pool.query(fullInsert);
    console.log('✅ Inserção completa funcionou:', fullResult.rows[0]);
    
    // Limpeza: remover registros de teste
    console.log('\n🧹 Limpando registros de teste...');
    await pool.query("DELETE FROM opportunities WHERE contact LIKE 'Teste%'");
    console.log('✅ Registros de teste removidos');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('📍 Detalhes do erro:', {
      code: error.code,
      position: error.position,
      routine: error.routine,
      file: error.file,
      line: error.line
    });
  } finally {
    await pool.end();
  }
}

testInsertOpportunity()
  .then(() => {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha no teste:', error.message);
    process.exit(1);
  });