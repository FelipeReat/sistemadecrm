const { Pool } = require('pg');
const WebSocket = require('ws');

// Configuração do banco de dados
const pool = new Pool({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/crm',
  ssl: false,
  connectionTimeoutMillis: 10000,
});

async function testRealtimeSync() {
  console.log('🔧 Testando sincronização em tempo real...');
  
  let ws;
  let client;
  
  try {
    // 1. Conectar ao WebSocket
    console.log('📡 Conectando ao WebSocket...');
    ws = new WebSocket('ws://localhost:3000/ws');
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ WebSocket conectado!');
        resolve();
      });
      
      ws.on('error', (error) => {
        console.error('❌ Erro no WebSocket:', error);
        reject(error);
      });
    });
    
    // 2. Conectar ao banco de dados
    console.log('🗄️ Conectando ao banco de dados...');
    client = await pool.connect();
    console.log('✅ Banco de dados conectado!');
    
    // 3. Configurar listener para mensagens WebSocket
    const receivedMessages = [];
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Mensagem WebSocket recebida:', message);
        receivedMessages.push(message);
      } catch (error) {
        console.error('❌ Erro ao parsear mensagem WebSocket:', error);
      }
    });
    
    // 4. Inserir uma nova oportunidade para testar o trigger
    console.log('📝 Inserindo nova oportunidade para testar trigger...');
    const insertResult = await client.query(`
      INSERT INTO opportunities (
        contact, 
        company, 
        phone, 
        phase, 
        salesperson,
        created_by_name,
        created_at,
        updated_at
      ) VALUES (
        'Teste Sincronização RT', 
        'Empresa Teste RT', 
        '11999999999', 
        'prospecting', 
        'Vendedor Teste',
        'Sistema Teste',
        NOW(),
        NOW()
      ) RETURNING id, contact, phase
    `);
    
    const newOpportunity = insertResult.rows[0];
    console.log('✅ Oportunidade inserida:', newOpportunity);
    
    // 5. Aguardar um pouco para receber notificações
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 6. Atualizar a oportunidade para testar trigger de UPDATE
    console.log('📝 Atualizando oportunidade para testar trigger de UPDATE...');
    await client.query(`
      UPDATE opportunities 
      SET phase = 'negotiation', company = 'Empresa Atualizada RT', updated_at = NOW()
      WHERE id = $1
    `, [newOpportunity.id]);
    
    console.log('✅ Oportunidade atualizada!');
    
    // 7. Aguardar mais um pouco para receber notificações
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 8. Deletar a oportunidade para testar trigger de DELETE
    console.log('🗑️ Deletando oportunidade para testar trigger de DELETE...');
    await client.query(`
      DELETE FROM opportunities WHERE id = $1
    `, [newOpportunity.id]);
    
    console.log('✅ Oportunidade deletada!');
    
    // 9. Aguardar mais um pouco para receber notificações
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 10. Analisar resultados
    console.log('\n📊 RESULTADOS DO TESTE:');
    console.log(`Total de mensagens WebSocket recebidas: ${receivedMessages.length}`);
    
    const opportunityMessages = receivedMessages.filter(msg => 
      msg.type === 'opportunity:change' || 
      msg.type === 'database:change' ||
      (msg.data && msg.data.table === 'opportunities')
    );
    
    console.log(`Mensagens relacionadas a oportunidades: ${opportunityMessages.length}`);
    
    if (opportunityMessages.length > 0) {
      console.log('✅ SINCRONIZAÇÃO EM TEMPO REAL FUNCIONANDO!');
      opportunityMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.type || 'unknown'} - ${JSON.stringify(msg.data || msg)}`);
      });
    } else {
      console.log('❌ SINCRONIZAÇÃO EM TEMPO REAL NÃO ESTÁ FUNCIONANDO');
      console.log('Mensagens recebidas:');
      receivedMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${JSON.stringify(msg)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    // Cleanup
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('🔌 Conexões fechadas');
  }
}

testRealtimeSync();