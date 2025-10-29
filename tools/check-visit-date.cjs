const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkVisitDate() {
  try {
    console.log('🔍 Verificando coluna visit_date na tabela opportunities...\n');

    // Verificar se a coluna visit_date existe
    const visitDateQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'opportunities' 
      AND column_name = 'visit_date';
    `;
    
    const result = await pool.query(visitDateQuery);
    
    if (result.rows.length > 0) {
      console.log('✅ Coluna visit_date existe na tabela opportunities');
      console.log('Detalhes:', result.rows[0]);
    } else {
      console.log('❌ Coluna visit_date NÃO existe na tabela opportunities');
      
      // Listar todas as colunas relacionadas a visit
      console.log('\n🔍 Colunas relacionadas a "visit" na tabela opportunities:');
      const visitColumnsQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'opportunities' 
        AND column_name LIKE '%visit%'
        ORDER BY column_name;
      `;
      
      const visitColumns = await pool.query(visitColumnsQuery);
      if (visitColumns.rows.length > 0) {
        visitColumns.rows.forEach(col => {
          console.log(`  ✓ ${col.column_name} (${col.data_type})`);
        });
      } else {
        console.log('  Nenhuma coluna relacionada a "visit" encontrada');
      }
    }

    // Verificar todas as colunas da tabela opportunities
    console.log('\n📋 Todas as colunas da tabela opportunities:');
    const allColumnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'opportunities'
      ORDER BY ordinal_position;
    `;
    
    const allColumns = await pool.query(allColumnsQuery);
    allColumns.rows.forEach((col, index) => {
      console.log(`  ${index + 1}. ${col.column_name} (${col.data_type})`);
    });

  } catch (error) {
    console.error('❌ Erro ao verificar coluna visit_date:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkVisitDate()
  .then(() => {
    console.log('\n✅ Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha na verificação:', error.message);
    process.exit(1);
  });