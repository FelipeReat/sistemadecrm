const axios = require('axios');

async function testOpportunityCreation() {
  try {
    console.log('🧪 Testando criação de oportunidade...');
    
    const opportunityData = {
      contact: "Teste Cliente",
      company: "Empresa Teste",
      phone: "11999999999",
      businessTemperature: "quente",
      needCategory: "Teste",
      clientNeeds: "Necessidades de teste",
      phase: "prospeccao"
    };

    console.log('📤 Enviando dados:', JSON.stringify(opportunityData, null, 2));

    const response = await axios.post('http://localhost:3000/api/opportunities', opportunityData, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3AbMRzAnz2sE0owesrSBA8QKoC3lJbBjwv.AiatZKJpv6glRstlmnFoNerHB5oYjJ0LA6aCi519h84'
      }
    });

    console.log('✅ Oportunidade criada com sucesso!');
    console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro ao criar oportunidade:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Erro:', error.message);
    }
  }
}

testOpportunityCreation();