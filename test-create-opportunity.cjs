const axios = require('axios');

async function testCreateOpportunity() {
  try {
    console.log('🧪 Testando criação de oportunidade...');
    
    // Dados de teste para criar uma nova oportunidade
    const opportunityData = {
      contact: 'João Silva Teste',
      company: 'Empresa Teste Ltda',
      phone: '11999887766',
      salesperson: 'Vendedor Teste',
      phase: 'prospeccao'
    };
    
    console.log('📤 Enviando dados:', JSON.stringify(opportunityData, null, 2));
    
    const response = await axios.post('http://localhost:3000/api/opportunities', opportunityData, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test-session' // Simular uma sessão
      },
      timeout: 10000
    });
    
    console.log('✅ Oportunidade criada com sucesso!');
    console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro ao criar oportunidade:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testCreateOpportunity();