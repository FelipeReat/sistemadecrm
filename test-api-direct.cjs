const fetch = require('node-fetch');

async function testApiDirect() {
  try {
    console.log('🧪 Testando API diretamente...\n');
    
    const baseUrl = 'http://localhost:5501';
    
    // Teste 1: Verificar se a API está respondendo
    console.log('📝 Teste 1: Verificando status da API');
    try {
      const healthResponse = await fetch(`${baseUrl}/api/stats`);
      console.log(`   Status: ${healthResponse.status}`);
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('   ✅ API está respondendo');
        console.log('   📊 Stats:', healthData);
      }
    } catch (error) {
      console.log('   ❌ API não está respondendo:', error.message);
      return;
    }
    
    // Teste 2: Tentar buscar oportunidades
    console.log('\n📝 Teste 2: Buscando oportunidades');
    try {
      const oppResponse = await fetch(`${baseUrl}/api/opportunities`);
      console.log(`   Status: ${oppResponse.status}`);
      if (oppResponse.ok) {
        const oppData = await oppResponse.json();
        console.log('   ✅ Busca de oportunidades funcionou');
        console.log(`   📊 Total encontrado: ${oppData.length}`);
      } else {
        const errorText = await oppResponse.text();
        console.log('   ❌ Erro na busca:', errorText);
      }
    } catch (error) {
      console.log('   ❌ Erro na busca de oportunidades:', error.message);
    }
    
    // Teste 3: Tentar criar uma oportunidade
    console.log('\n📝 Teste 3: Criando oportunidade de teste');
    const testOpportunity = {
      contact: 'Teste API Direct',
      company: 'Empresa API Direct',
      phase: 'prospeccao',
      cpf: '12345678901',
      phone: '11999999999',
      hasRegistration: false,
      proposalOrigin: 'API',
      businessTemperature: 'quente',
      needCategory: 'Teste',
      clientNeeds: 'Teste de necessidades',
      createdBy: 'teste-api'
    };
    
    try {
      const createResponse = await fetch(`${baseUrl}/api/opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testOpportunity)
      });
      
      console.log(`   Status: ${createResponse.status}`);
      
      if (createResponse.ok) {
        const createdOpp = await createResponse.json();
        console.log('   ✅ Criação de oportunidade funcionou');
        console.log('   📋 ID criado:', createdOpp.id);
        
        // Limpeza - tentar deletar
        console.log('\n🧹 Limpando oportunidade de teste...');
        // Note: Assumindo que há um endpoint de delete, se não houver, vamos deixar
        
      } else {
        const errorText = await createResponse.text();
        console.log('   ❌ Erro na criação:', errorText);
        
        // Tentar pegar mais detalhes do erro
        try {
          const errorJson = JSON.parse(errorText);
          console.log('   📍 Detalhes do erro:', errorJson);
        } catch (parseError) {
          console.log('   📍 Erro não é JSON válido');
        }
      }
    } catch (error) {
      console.log('   ❌ Erro na criação de oportunidade:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste da API:', error.message);
    console.error('📍 Stack trace:', error.stack);
  }
}

testApiDirect()
  .then(() => {
    console.log('\n✅ Teste da API concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha no teste da API:', error.message);
    process.exit(1);
  });