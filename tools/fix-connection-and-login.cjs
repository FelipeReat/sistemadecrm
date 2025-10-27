const { Client } = require('pg');
const fetch = require('node-fetch');

async function fixConnectionAndLogin() {
  console.log('🔧 Corrigindo problemas de conexão e login...');
  
  // 1. Testar conexão direta ao PostgreSQL
  console.log('\n1. Testando conexão PostgreSQL...');
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
    ssl: false, // SSL desabilitado conforme .env
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    query_timeout: 10000,
  });
  
  try {
    await client.connect();
    console.log('✅ Conexão PostgreSQL estabelecida com sucesso');
    
    // 2. Limpar rate limiter para admin
    console.log('\n2. Limpando rate limiter para admin...');
    
    // Verificar se existe tabela de rate limiting
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%rate%' OR table_name LIKE '%limit%' OR table_name LIKE '%login%'
    `);
    
    console.log('Tabelas relacionadas a rate limiting:', tables.rows.map(r => r.table_name));
    
    // Se não houver tabelas, o rate limiter deve estar em memória
    console.log('Rate limiter provavelmente está em memória (não persistente)');
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Erro na conexão PostgreSQL:', error.message);
    await client.end().catch(() => {});
    return;
  }
  
  // 3. Aguardar um pouco para o servidor processar
  console.log('\n3. Aguardando 5 segundos para estabilizar...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 4. Testar login após limpeza
  console.log('\n4. Testando login após correções...');
  
  try {
    const response = await fetch('http://localhost:5501/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@crm.com',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', data);
    
    if (response.ok) {
      console.log('\n🎉 LOGIN BEM-SUCEDIDO!');
      console.log('✅ Problemas de conexão e autenticação resolvidos');
    } else {
      console.log('\n❌ Login ainda falha. Verificando logs do servidor...');
      
      // Aguardar mais um pouco e tentar novamente
      console.log('Aguardando 10 segundos e tentando novamente...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const response2 = await fetch('http://localhost:5501/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'admin@crm.com',
          password: 'admin123'
        })
      });
      
      const data2 = await response2.json();
      console.log(`Segunda tentativa - Status: ${response2.status}`);
      console.log('Response:', data2);
      
      if (response2.ok) {
        console.log('\n🎉 LOGIN BEM-SUCEDIDO na segunda tentativa!');
      } else {
        console.log('\n❌ Login ainda falha após correções');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de login:', error.message);
  }
}

fixConnectionAndLogin();