#!/usr/bin/env node

/**
 * Teste de Validação - Correções nos Relatórios PDF
 * Este script testa as correções implementadas nos relatórios PDF do sistema CRM
 * 
 * Testes incluídos:
 * 1. Verificação do servidor
 * 2. APIs de relatórios respondendo corretamente
 * 3. Dados de performance por vendedor
 * 4. Relatórios de temperatura e fase completos
 * 5. Geração de PDFs sem erros
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configurações
const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;
const BASE_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Funções utilitárias
function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function logTest(testName, passed, details = '') {
  const status = passed ? `${colors.green}✅ PASSOU` : `${colors.red}❌ FALHOU`;
  console.log(`${status}${colors.reset} - ${testName}`);
  if (details) {
    console.log(`  ${colors.yellow}Detalhes: ${details}${colors.reset}`);
  }
}

// Função para fazer requisições HTTP
async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout na requisição'));
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Função para verificar se servidor está rodando
async function checkServerStatus() {
  logSection('🔍 TESTE 1: Verificação do Servidor');
  
  try {
    const response = await makeRequest(`${BASE_URL}/health`, { method: 'GET' });
    const passed = response.status === 200;
    logTest('Servidor respondendo', passed, `Status: ${response.status}`);
    return passed;
  } catch (error) {
    logTest('Servidor respondendo', false, `Erro: ${error.message}`);
    return false;
  }
}

// Função para testar APIs de relatórios
async function testReportAPIs() {
  logSection('📊 TESTE 2: APIs de Relatórios');
  
  const reportTypes = [
    'performance-by-salesperson',
    'performance-by-creator', 
    'phase-distribution',
    'temperature-distribution',
    'business-summary'
  ];
  
  let allPassed = true;
  
  for (const reportType of reportTypes) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/reports/${reportType}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { 
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        }
      });
      
      const passed = response.status === 200;
      logTest(`API ${reportType}`, passed, `Status: ${response.status}`);
      
      if (!passed) {
        allPassed = false;
      }
      
    } catch (error) {
      logTest(`API ${reportType}`, false, `Erro: ${error.message}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Função para testar performance por vendedor
async function testSalespersonPerformance() {
  logSection('👨‍💼 TESTE 3: Performance por Vendedor');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/reports/performance-by-salesperson`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }
    });
    
    if (response.status !== 200) {
      logTest('Performance por vendedor', false, `Status: ${response.status}`);
      return false;
    }
    
    const data = response.data;
    
    // Verificar se há dados de performance
    const hasData = data.opportunities && data.opportunities.length > 0;
    const hasPerformance = data.performanceBySalesperson && data.performanceBySalesperson.length > 0;
    
    logTest('Dados de oportunidades', hasData, `Encontradas: ${data.opportunities?.length || 0}`);
    logTest('Dados de performance', hasPerformance, `Vendedores: ${data.performanceBySalesperson?.length || 0}`);
    
    if (hasPerformance) {
      // Verificar estrutura dos dados
      const firstSalesperson = data.performanceBySalesperson[0];
      const hasRequiredFields = firstSalesperson.name && 
                               typeof firstSalesperson.totalOpportunities === 'number' &&
                               typeof firstSalesperson.totalValue === 'number';
      
      logTest('Estrutura correta', hasRequiredFields, 'Campos obrigatórios presentes');
    }
    
    return hasData && hasPerformance;
    
  } catch (error) {
    logTest('Performance por vendedor', false, `Erro: ${error.message}`);
    return false;
  }
}

// Função para testar relatórios de temperatura e fase
async function testTemperatureAndPhaseReports() {
  logSection('🌡️ TESTE 4: Relatórios de Temperatura e Fase');
  
  let testsPassed = 0;
  const totalTests = 4;
  
  try {
    // Testar relatório de temperatura
    const tempResponse = await makeRequest(`${BASE_URL}/api/reports/temperature-distribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }
    });
    
    if (tempResponse.status === 200 && tempResponse.data.temperatureDistribution) {
      const tempData = tempResponse.data.temperatureDistribution;
      const hasAllTemperatures = tempData.length >= 3; // fria, morna, quente
      logTest('Temperaturas completas', hasAllTemperatures, `Temperaturas: ${tempData.length}`);
      if (hasAllTemperatures) testsPassed++;
      
      // Verificar se tem valores
      const hasValues = tempData.some(item => item.totalValue > 0);
      logTest('Temperaturas com valores', hasValues, 'Algumas temperaturas têm valores');
      if (hasValues) testsPassed++;
    }
    
    // Testar relatório de fase
    const phaseResponse = await makeRequest(`${BASE_URL}/api/reports/phase-distribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }
    });
    
    if (phaseResponse.status === 200 && phaseResponse.data.phaseDistribution) {
      const phaseData = phaseResponse.data.phaseDistribution;
      const hasAllPhases = phaseData.length >= 4; // prospecção, qualificação, proposta, negociação
      logTest('Fases completas', hasAllPhases, `Fases: ${phaseData.length}`);
      if (hasAllPhases) testsPassed++;
      
      // Verificar se tem valores
      const hasValues = phaseData.some(item => item.totalValue > 0);
      logTest('Fases com valores', hasValues, 'Algumas fases têm valores');
      if (hasValues) testsPassed++;
    }
    
  } catch (error) {
    logTest('Relatórios de temperatura e fase', false, `Erro: ${error.message}`);
  }
  
  log(`Resultado: ${testsPassed}/${totalTests} testes passaram`, testsPassed === totalTests ? 'green' : 'yellow');
  return testsPassed === totalTests;
}

// Função para testar geração de PDFs
async function testPDFGeneration() {
  logSection('📄 TESTE 5: Geração de PDFs');
  
  const reportTypes = [
    'performance-by-salesperson',
    'performance-by-creator',
    'phase-distribution', 
    'temperature-distribution'
  ];
  
  let testsPassed = 0;
  
  for (const reportType of reportTypes) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/reports/${reportType}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        }
      });
      
      // Verificar se o PDF foi gerado (deve retornar um buffer ou URL)
      const pdfGenerated = response.status === 200 && 
                          (response.headers['content-type']?.includes('application/pdf') ||
                           typeof response.data === 'string');
      
      logTest(`PDF ${reportType}`, pdfGenerated, `Status: ${response.status}`);
      if (pdfGenerated) testsPassed++;
      
    } catch (error) {
      logTest(`PDF ${reportType}`, false, `Erro: ${error.message}`);
    }
  }
  
  log(`Resultado: ${testsPassed}/${reportTypes.length} PDFs gerados com sucesso`, testsPassed === reportTypes.length ? 'green' : 'yellow');
  return testsPassed === reportTypes.length;
}

// Função principal
async function runTests() {
  logSection('🚀 INICIANDO TESTES DE VALIDAÇÃO - CORREÇÕES PDF');
  
  const startTime = Date.now();
  
  try {
    // Executar testes em sequência
    const serverOk = await checkServerStatus();
    if (!serverOk) {
      log('❌ Servidor não está respondendo. Abortando testes.', 'red');
      return;
    }
    
    // Aguardar um pouco para o servidor estabilizar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const apiOk = await testReportAPIs();
    const salesPerformanceOk = await testSalespersonPerformance();
    const tempPhaseOk = await testTemperatureAndPhaseReports();
    const pdfOk = await testPDFGeneration();
    
    // Resultado final
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    logSection('📋 RESULTADO FINAL');
    
    const allTestsPassed = serverOk && apiOk && salesPerformanceOk && tempPhaseOk && pdfOk;
    
    if (allTestsPassed) {
      log(`✅ TODOS OS TESTES PASSARAM! (${duration}s)`, 'green');
      log('As correções nos relatórios PDF foram validadas com sucesso!', 'green');
    } else {
      log(`⚠️ ALGUNS TESTES FALHARAM (${duration}s)`, 'yellow');
      log('Verifique os logs acima para identificar os problemas.', 'yellow');
    }
    
    // Resumo
    log('\n📊 RESUMO DOS TESTES:', 'cyan');
    logTest('Servidor respondendo', serverOk);
    logTest('APIs de relatórios', apiOk);
    logTest('Performance por vendedor', salesPerformanceOk);
    logTest('Temperatura e fase completos', tempPhaseOk);
    logTest('Geração de PDFs', pdfOk);
    
  } catch (error) {
    log(`❌ ERRO CRÍTICO: ${error.message}`, 'red');
    console.error(error);
  }
}

// Verificar se o servidor está configurado
function checkServerConfig() {
  log('🔍 Verificando configurações do servidor...', 'cyan');
  
  // Verificar se há variáveis de ambiente alternativas
  const envVars = ['PORT', 'HOST', 'NODE_ENV'];
  envVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      log(`  ${varName}: ${value}`, 'blue');
    }
  });
  
  // Usar porta do ambiente se disponível
  if (process.env.PORT) {
    SERVER_PORT = parseInt(process.env.PORT);
    log(`🌐 Usando porta do ambiente: ${SERVER_PORT}`, 'green');
  }
}

// Executar testes
if (require.main === module) {
  checkServerConfig();
  
  log('🎯 Iniciando validação das correções nos relatórios PDF...', 'cyan');
  log(`📡 Conectando ao servidor: ${BASE_URL}`, 'blue');
  
  runTests().catch(error => {
    log(`❌ ERRO FATAL: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  runTests,
  checkServerStatus,
  testReportAPIs,
  testSalespersonPerformance,
  testTemperatureAndPhaseReports,
  testPDFGeneration
};