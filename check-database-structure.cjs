const { Pool } = require('pg');
require('dotenv').config();

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Schema esperado baseado em shared/schema.ts
const expectedSchema = {
  opportunities: [
    'id', 'contact', 'cpf', 'company', 'cnpj', 'phone', 'has_registration', 
    'cadastral_update', 'proposal_origin', 'business_temperature', 'need_category', 
    'client_needs', 'documents', 'opportunity_number', 'salesperson', 'requires_visit', 
    'statement', 'visit_schedule', 'visit_date', 'visit_description', 'visit_realization', 
    'visit_photos', 'discount', 'discount_description', 'validity_date', 'budget_number', 
    'budget', 'status', 'final_value', 'negotiation_info', 'contract', 'invoice_number', 
    'loss_reason', 'loss_observation', 'phase', 'created_by', 'created_by_name', 
    'is_imported', 'import_batch_id', 'import_source', 'created_at', 'updated_at', 'phase_updated_at'
  ],
  automations: [
    'id', 'phase', 'trigger', 'action', 'created_at'
  ],
  sessions: [
    'sid', 'sess', 'expire'
  ],
  email_templates: [
    'id', 'name', 'subject', 'body', 'trigger', 'active', 'created_at', 'updated_at'
  ],
  email_logs: [
    'id', 'to', 'subject', 'template', 'status', 'error', 'opportunity_id', 'sent_at'
  ],
  user_settings: [
    'id', 'user_id', 'email_notifications', 'sms_notifications', 'push_notifications', 
    'auto_backup', 'language', 'timezone', 'updated_at'
  ],
  audit_logs: [
    'id', 'user_id', 'action', 'entity', 'entity_id', 'changes', 'timestamp'
  ],
  sales_reports: [
    'id', 'salesperson_id', 'period', 'year', 'month', 'total_opportunities', 
    'won_opportunities', 'lost_opportunities', 'total_value', 'won_value', 
    'conversion_rate', 'avg_deal_size', 'generated_at'
  ],
  system_backups: [
    'id', 'filename', 'size', 'type', 'status', 'created_at'
  ],
  users: [
    'id', 'email', 'password', 'name', 'phone', 'bio', 'role', 'is_active', 'created_at', 'updated_at'
  ],
  saved_reports: [
    'id', 'name', 'description', 'category', 'filters', 'charts', 'layout', 
    'is_public', 'created_by', 'last_generated', 'auto_refresh', 'refresh_interval', 
    'created_at', 'updated_at'
  ]
};

async function analyzeDatabase() {
  try {
    console.log('🔍 Analisando estrutura do banco de dados PostgreSQL...\n');

    // 1. Verificar quais tabelas existem
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    const existingTables = tablesResult.rows.map(row => row.table_name);
    
    console.log('📋 Tabelas existentes no banco:');
    existingTables.forEach(table => console.log(`  ✓ ${table}`));
    console.log();

    // 2. Identificar tabelas faltantes
    const expectedTables = Object.keys(expectedSchema);
    const missingTables = expectedTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log('❌ Tabelas faltantes:');
      missingTables.forEach(table => console.log(`  ✗ ${table}`));
      console.log();
    } else {
      console.log('✅ Todas as tabelas esperadas existem no banco\n');
    }

    // 3. Para cada tabela existente, verificar colunas
    const missingColumns = {};
    
    for (const tableName of expectedTables) {
      if (existingTables.includes(tableName)) {
        console.log(`🔍 Analisando colunas da tabela: ${tableName}`);
        
        // Buscar colunas existentes
        const columnsQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `;
        
        const columnsResult = await pool.query(columnsQuery, [tableName]);
        const existingColumns = columnsResult.rows.map(row => row.column_name);
        
        console.log(`  Colunas existentes: ${existingColumns.join(', ')}`);
        
        // Identificar colunas faltantes
        const expectedColumns = expectedSchema[tableName];
        const missing = expectedColumns.filter(col => !existingColumns.includes(col));
        
        if (missing.length > 0) {
          missingColumns[tableName] = missing;
          console.log(`  ❌ Colunas faltantes: ${missing.join(', ')}`);
        } else {
          console.log(`  ✅ Todas as colunas esperadas existem`);
        }
        console.log();
      }
    }

    // 4. Resumo final
    console.log('📊 RESUMO DA ANÁLISE:');
    console.log('='.repeat(50));
    
    if (missingTables.length === 0 && Object.keys(missingColumns).length === 0) {
      console.log('✅ Banco de dados está completamente sincronizado com o schema!');
    } else {
      console.log('❌ Problemas encontrados:');
      
      if (missingTables.length > 0) {
        console.log(`\n📋 ${missingTables.length} tabela(s) faltante(s):`);
        missingTables.forEach(table => console.log(`  - ${table}`));
      }
      
      if (Object.keys(missingColumns).length > 0) {
        console.log(`\n📝 Colunas faltantes por tabela:`);
        Object.entries(missingColumns).forEach(([table, columns]) => {
          console.log(`  ${table}: ${columns.join(', ')}`);
        });
      }
    }

    // 5. Verificar especificamente a coluna visit_description
    console.log('\n🎯 VERIFICAÇÃO ESPECÍFICA: visit_description');
    console.log('-'.repeat(50));
    
    if (existingTables.includes('opportunities')) {
      const visitDescQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'opportunities' 
        AND column_name = 'visit_description';
      `;
      
      const visitDescResult = await pool.query(visitDescQuery);
      
      if (visitDescResult.rows.length > 0) {
        console.log('✅ Coluna visit_description existe na tabela opportunities');
      } else {
        console.log('❌ Coluna visit_description NÃO existe na tabela opportunities');
        console.log('   Esta é provavelmente a causa do erro mencionado!');
      }
    } else {
      console.log('❌ Tabela opportunities não existe!');
    }

    return {
      missingTables,
      missingColumns,
      existingTables
    };

  } catch (error) {
    console.error('❌ Erro ao analisar banco de dados:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar análise
analyzeDatabase()
  .then((result) => {
    console.log('\n✅ Análise concluída com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha na análise:', error.message);
    process.exit(1);
  });