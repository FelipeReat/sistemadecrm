import 'dotenv/config';
import postgres from 'postgres';

async function debugMultipleConnections() {
  try {
    console.log('🔍 Debugando múltiplas conexões...\n');
    
    // Verificar todas as variáveis de ambiente
    console.log('📋 Variáveis de ambiente:');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@')}`);
    console.log(`DEV_DATABASE_URL: ${process.env.DEV_DATABASE_URL?.replace(/:[^:]*@/, ':***@')}`);
    console.log(`PROD_DATABASE_URL: ${process.env.PROD_DATABASE_URL?.replace(/:[^:]*@/, ':***@')}`);
    
    // Testar cada conexão possível
    const connections = [
      { name: 'DATABASE_URL', url: process.env.DATABASE_URL },
      { name: 'DEV_DATABASE_URL', url: process.env.DEV_DATABASE_URL },
      { name: 'PROD_DATABASE_URL', url: process.env.PROD_DATABASE_URL }
    ];
    
    for (const conn of connections) {
      if (!conn.url) {
        console.log(`\n❌ ${conn.name}: não definida`);
        continue;
      }
      
      console.log(`\n🔗 Testando ${conn.name}:`);
      console.log(`   URL: ${conn.url.replace(/:[^:]*@/, ':***@')}`);
      
      try {
        const sql = postgres(conn.url, {
          max: 1,
          connect_timeout: 10,
          ssl: false
        });
        
        // Testar conexão básica
        const testResult = await sql`SELECT 1 as test`;
        console.log(`   ✅ Conexão: OK`);
        
        // Verificar se a tabela opportunities existe
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'opportunities'
          ) as exists;
        `;
        console.log(`   📋 Tabela opportunities: ${tableExists[0].exists ? 'EXISTS' : 'NOT EXISTS'}`);
        
        if (tableExists[0].exists) {
          // Verificar colunas visit_*
          const visitColumns = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'opportunities' 
            AND column_name LIKE '%visit%'
            ORDER BY column_name;
          `;
          
          console.log(`   📋 Colunas visit_*: ${visitColumns.map(c => c.column_name).join(', ')}`);
          
          // Verificar se visit_date existe especificamente
          const visitDateExists = await sql`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'opportunities' 
              AND column_name = 'visit_date'
            ) as exists;
          `;
          console.log(`   📋 Coluna visit_date: ${visitDateExists[0].exists ? 'EXISTS' : 'NOT EXISTS'}`);
          
          // Verificar se visit_description existe
          const visitDescExists = await sql`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'opportunities' 
              AND column_name = 'visit_description'
            ) as exists;
          `;
          console.log(`   📋 Coluna visit_description: ${visitDescExists[0].exists ? 'EXISTS' : 'NOT EXISTS'}`);
          
          // Contar registros
          const count = await sql`SELECT COUNT(*) as count FROM opportunities`;
          console.log(`   📊 Total de oportunidades: ${count[0].count}`);
        }
        
        await sql.end();
        
      } catch (error: any) {
        console.log(`   ❌ Erro: ${error.message}`);
      }
    }
    
    // Verificar qual conexão a aplicação está usando
    console.log('\n🎯 Conexão que a aplicação deveria usar:');
    const isProduction = process.env.NODE_ENV === 'production';
    const appUrl = isProduction 
      ? process.env.PROD_DATABASE_URL 
      : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
    
    console.log(`   Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
    console.log(`   URL: ${appUrl?.replace(/:[^:]*@/, ':***@')}`);
    
  } catch (error: any) {
    console.error('❌ Erro no debug:', error.message);
    console.error('📍 Stack trace:', error.stack);
  }
}

debugMultipleConnections()
  .then(() => {
    console.log('\n✅ Debug de múltiplas conexões concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha no debug:', error.message);
    process.exit(1);
  });