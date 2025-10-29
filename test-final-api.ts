import 'dotenv/config';

async function testFinalApi() {
  try {
    console.log('🧪 Teste final da API...\n');
    
    const baseUrl = 'http://localhost:5501';
    
    // Primeiro, fazer login para obter sessão
    console.log('📝 Fazendo login...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@locador.com',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      const loginError = await loginResponse.text();
      console.error('❌ Erro no login:', loginError);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login realizado com sucesso:', loginData);
    
    // Extrair cookies da resposta
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('🍪 Cookies recebidos:', cookies);
    
    // Criar oportunidade
    console.log('\n📝 Criando oportunidade...');
    const testOpportunity = {
      contact: 'Teste Final API',
      company: 'Empresa Final API',
      phase: 'prospeccao',
      cpf: '12345678901',
      phone: '11999999999',
      hasRegistration: false,
      proposalOrigin: 'API',
      businessTemperature: 'quente',
      needCategory: 'Teste Final',
      clientNeeds: 'Teste final de necessidades',
      visitDescription: 'Descrição da visita de teste final',
      createdBy: 'Administrador'
    };
    
    const createResponse = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify(testOpportunity)
    });
    
    console.log(`Status da criação: ${createResponse.status}`);
    
    if (createResponse.ok) {
      const createdOpp = await createResponse.json();
      console.log('✅ Oportunidade criada com sucesso!');
      console.log('📋 ID:', createdOpp.id);
      console.log('📋 Contact:', createdOpp.contact);
      console.log('📋 Visit Description:', createdOpp.visitDescription);
      
      // Buscar oportunidades para confirmar
      console.log('\n📝 Buscando oportunidades...');
      const listResponse = await fetch(`${baseUrl}/api/opportunities`, {
        headers: {
          'Cookie': cookies || ''
        }
      });
      
      if (listResponse.ok) {
        const opportunities = await listResponse.json();
        console.log(`✅ Encontradas ${opportunities.length} oportunidades`);
        
        const testOpp = opportunities.find((opp: any) => opp.contact === 'Teste Final API');
        if (testOpp) {
          console.log('✅ Oportunidade de teste encontrada na lista!');
          console.log('📋 Visit Description na lista:', testOpp.visitDescription);
        }
      }
      
    } else {
      const errorText = await createResponse.text();
      console.error('❌ Erro na criação:', errorText);
    }
    
  } catch (error: any) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testFinalApi()
  .then(() => {
    console.log('\n✅ Teste final da API concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha no teste final:', error.message);
    process.exit(1);
  });