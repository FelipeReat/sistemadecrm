import puppeteer from 'puppeteer';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PDFGenerationOptions {
  title: string;
  type: string;
  data: any;
  filters?: string;
  summary?: Array<{ label: string; value: string }>;
}

// Função para instalar Chrome automaticamente via Puppeteer
async function installChromeAutomatically(): Promise<boolean> {
  try {
    console.log('🔄 Tentando instalar Chrome automaticamente via Puppeteer...');
    
    // Tenta instalar o Chrome usando npx puppeteer browsers install chrome
    const command = 'npx puppeteer browsers install chrome';
    console.log(`📦 Executando: ${command}`);
    
    execSync(command, { 
      stdio: 'inherit',
      timeout: 300000, // 5 minutos timeout
      cwd: process.cwd()
    });
    
    console.log('✅ Chrome instalado com sucesso via Puppeteer!');
    return true;
  } catch (error) {
    console.error('❌ Falha ao instalar Chrome automaticamente:', error);
    
    // Tenta método alternativo usando o próprio puppeteer
    try {
      console.log('🔄 Tentando método alternativo de instalação...');
      const { execSync: exec } = await import('child_process');
      exec('npm install puppeteer --force', { 
        stdio: 'inherit',
        timeout: 300000,
        cwd: process.cwd()
      });
      console.log('✅ Puppeteer reinstalado com sucesso!');
      return true;
    } catch (altError) {
      console.error('❌ Método alternativo também falhou:', altError);
      return false;
    }
  }
}

// Função para detectar navegadores disponíveis no Windows - versão ultra-robusta
function detectAvailableBrowser(): string | null {
  const browsers = [
    {
      name: 'Google Chrome',
      paths: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        // Caminhos alternativos para instalações personalizadas
        'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\Default\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
      ]
    },
    {
      name: 'Microsoft Edge',
      paths: [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        // Edge é instalado por padrão no Windows 10/11
        'C:\\Windows\\SystemApps\\Microsoft.MicrosoftEdge_8wekyb3d8bbwe\\MicrosoftEdge.exe'
      ]
    },
    {
      name: 'Brave',
      paths: [
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        'C:\\Users\\Administrator\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
      ]
    },
    {
      name: 'Chromium',
      paths: [
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe'
      ]
    }
  ];

  console.log('🔍 Iniciando detecção de navegadores disponíveis...');
  
  for (const browser of browsers) {
    console.log(`🔎 Verificando ${browser.name}...`);
    for (const path of browser.paths) {
      try {
        if (existsSync(path)) {
          console.log(`✅ Navegador detectado: ${browser.name} em ${path}`);
          return path;
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao verificar caminho ${path}:`, error);
      }
    }
  }

  // Tenta detectar usando variáveis de ambiente
  console.log('🔍 Tentando detectar via variáveis de ambiente...');
  const envPaths = [
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    process.env.CHROMIUM_BIN
  ].filter(Boolean);

  for (const envPath of envPaths) {
    if (envPath && existsSync(envPath)) {
      console.log(`✅ Navegador detectado via variável de ambiente: ${envPath}`);
      return envPath;
    }
  }

  console.warn('⚠️ Nenhum navegador compatível encontrado nos caminhos padrão');
  console.log('💡 Puppeteer tentará usar o Chrome integrado ou baixar automaticamente');
  return null;
}

class PDFService {
  private baseTemplate: string;

  constructor() {
    // Carrega o template base
    this.baseTemplate = readFileSync(
      join(__dirname, 'pdf-templates', 'base-template.html'),
      'utf-8'
    );
  }

  private createTempDirectory(): string {
    try {
      // Cria um diretório temporário personalizado para o Puppeteer
      const tempDir = join(tmpdir(), 'puppeteer-pdf-service');
      
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }
      
      return tempDir;
    } catch (error) {
      console.warn('Não foi possível criar diretório temporário personalizado, usando padrão do sistema');
      return tmpdir();
    }
  }

  private detectProductionEnvironment(): { isProduction: boolean; isWindowsServer: boolean; customCacheDir: string } {
    const isProduction = process.env.NODE_ENV === 'production';
    const currentPath = process.cwd();
    const isWindowsServer = currentPath.includes('locador') || currentPath.includes('webapps') || process.platform === 'win32';
    
    console.log('🔍 Detectando ambiente de execução:', {
      NODE_ENV: process.env.NODE_ENV,
      isProduction,
      currentPath,
      platform: process.platform,
      isWindowsServer,
      userProfile: process.env.USERPROFILE,
      homePath: process.env.HOME
    });
    
    // Configura diretório de cache específico para produção
    let customCacheDir = '';
    if (isProduction && isWindowsServer) {
      // Usa o mesmo caminho identificado no erro: C:\locador\webapps\crm\.puppeteer-cache
      customCacheDir = join(currentPath, '.puppeteer-cache');
      try {
        if (!existsSync(customCacheDir)) {
          mkdirSync(customCacheDir, { recursive: true });
        }
        console.log(`📁 Diretório de cache Puppeteer criado: ${customCacheDir}`);
        
        // Configura também o cache do usuário Administrator se necessário
        const adminCacheDir = 'C:\\Users\\Administrator\\.cache\\puppeteer';
        try {
          if (!existsSync(adminCacheDir)) {
            mkdirSync(adminCacheDir, { recursive: true });
            console.log(`📁 Diretório de cache Administrator criado: ${adminCacheDir}`);
          }
        } catch (adminError) {
          console.warn('⚠️ Não foi possível criar cache do Administrator:', adminError);
        }
        
        // Tenta também criar cache no diretório do usuário atual
        const userCacheDir = process.env.USERPROFILE ? join(process.env.USERPROFILE, '.cache', 'puppeteer') : null;
        if (userCacheDir) {
          try {
            if (!existsSync(userCacheDir)) {
              mkdirSync(userCacheDir, { recursive: true });
              console.log(`📁 Diretório de cache do usuário criado: ${userCacheDir}`);
            }
          } catch (userError) {
            console.warn('⚠️ Não foi possível criar cache do usuário:', userError);
          }
        }
        
      } catch (error) {
        console.warn('⚠️ Não foi possível criar diretório de cache personalizado:', error);
        customCacheDir = '';
      }
    }
    
    return { isProduction, isWindowsServer, customCacheDir };
  }

  private getPuppeteerConfig() {
    const { isProduction, isWindowsServer, customCacheDir } = this.detectProductionEnvironment();
    const tempDir = this.createTempDirectory();
    
    // Detecta navegador disponível automaticamente
    const browserExecutable = detectAvailableBrowser();
    
    console.log(`🔍 Ambiente detectado: Produção=${isProduction}, WindowsServer=${isWindowsServer}, CacheDir=${customCacheDir || 'padrão'}`);
    
    // Argumentos ultra-robustos para Windows Server/Produção - baseados na análise do erro
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--disable-features=TranslateUI',
      '--disable-features=VizDisplayCompositor',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-features=VizServiceDisplayCompositor',
      '--disable-features=HttpsFirstBalancedModeAutoEnable',
      '--disable-web-security',
      '--disable-features=site-per-process',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-networking',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-report-upload',
      '--mute-audio',
      '--disable-logging',
      '--disable-permissions-api',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-domain-reliability',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-translate',
      '--disable-web-resources',
      '--hide-scrollbars',
      '--no-crash-upload',
      // Argumentos específicos para resolver "Failed to launch the browser process!"
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor,VizServiceDisplayCompositor',
      '--disable-infobars',
      '--disable-notifications',
      '--disable-popup-blocking',
      '--disable-save-password-bubble',
      '--disable-session-crashed-bubble',
      '--disable-password-generation',
      '--disable-background-mode',
      '--disable-add-to-shelf',
      '--disable-background-downloads',
      '--disable-component-cloud-policy',
      '--disable-datasaver-prompt',
      '--disable-desktop-notifications',
      '--disable-domain-blocking-for-3d-apis',
      '--disable-extensions-file-access-check',
      '--disable-extensions-http-throttling',
      '--disable-extensions-except',
      '--disable-file-system',
      '--disable-fine-grained-time-zone-detection',
      '--disable-geolocation',
      '--disable-gl-extensions',
      '--disable-histogram-customizer',
      '--disable-in-process-stack-traces',
      '--disable-lcd-text',
      '--disable-local-storage',
      '--disable-logging',
      '--disable-login-animations',
      '--disable-new-bookmark-apps',
      '--disable-new-channel-layout',
      '--disable-new-video-renderer',
      '--disable-partial-raster',
      '--disable-plugins-discovery',
      '--disable-preconnect',
      '--disable-print-preview',
      '--disable-renderer-accessibility',
      '--disable-speech-api',
      '--disable-threaded-animation',
      '--disable-threaded-scrolling',
      '--disable-v8-idle-tasks',
      '--disable-webgl',
      '--disable-webgl2'
    ];

    // Configuração específica para Windows Server/Produção
    if (isProduction && isWindowsServer) {
      baseArgs.push(
        '--single-process', // Crítico para Windows Server
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--memory-pressure-off',
        '--max_old_space_size=4096',
        '--js-flags=--max-old-space-size=4096',
        // Argumentos específicos para o ambiente C:\locador\webapps\crm
        '--disable-crash-reporter',
        '--disable-in-process-stack-traces',
        '--disable-logging',
        '--disable-dev-tools',
        '--disable-extensions-file-access-check',
        '--allow-running-insecure-content',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
        '--ignore-certificate-errors-skip-list'
      );
    }

    const config: any = {
      headless: true,
      args: baseArgs,
      timeout: 180000, // 3 minutos para produção
      protocolTimeout: 180000,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      // Configurações específicas para resolver problemas de inicialização
      slowMo: isProduction ? 100 : 0, // Adiciona delay em produção
      devtools: false,
      pipe: false // Usa WebSocket ao invés de pipe para melhor compatibilidade
    };

    // Configura cache directory se disponível
    if (customCacheDir) {
      process.env.PUPPETEER_CACHE_DIR = customCacheDir;
      console.log(`📦 PUPPETEER_CACHE_DIR configurado: ${customCacheDir}`);
    }

    // Configura o executável do navegador se encontrado
    if (browserExecutable) {
      config.executablePath = browserExecutable;
      console.log(`🚀 Usando navegador personalizado: ${browserExecutable}`);
    } else {
      console.log('🔄 Usando Puppeteer padrão (tentará baixar Chrome automaticamente)');
      // Em produção, força o download do Chrome se não encontrado
      if (isProduction) {
        console.log('🔧 Ambiente de produção detectado - forçando instalação do Chrome...');
      }
    }

    // Em produção Windows, adiciona configurações ultra-específicas
    if (isProduction && isWindowsServer) {
      config.args.push(`--user-data-dir=${tempDir}`);
      
      // Remove ignoreDefaultArgs para máximo controle
      config.ignoreDefaultArgs = false;
      
      // Configurações de memória para Windows Server
      config.args.push(
        '--memory-pressure-off',
        '--disable-background-mode',
        '--disable-add-to-shelf',
        '--disable-background-downloads'
      );
    } else {
      // Para desenvolvimento, configuração mais permissiva
      config.ignoreDefaultArgs = ['--disable-extensions'];
    }

    console.log(`⚙️ Configuração Puppeteer: ${config.args.length} argumentos, timeout: ${config.timeout}ms`);
    return config;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  private generateOpportunitiesTable(opportunities: any[]): string {
    if (!opportunities || opportunities.length === 0) {
      return '<div class="no-data">Nenhuma oportunidade encontrada</div>';
    }

    const rows = opportunities.map(opp => `
      <tr>
        <td>${opp.title || 'N/A'}</td>
        <td>${opp.company || 'N/A'}</td>
        <td><span class="status ${opp.phase?.toLowerCase() || ''}">${opp.phase || 'N/A'}</span></td>
        <td><span class="temperature ${opp.temperature?.toLowerCase() || ''}">${opp.temperature || 'N/A'}</span></td>
        <td class="currency">${this.formatCurrency(opp.value || 0)}</td>
        <td>${opp.assignedUser || 'N/A'}</td>
        <td>${opp.createdAt ? new Date(opp.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</td>
      </tr>
    `).join('');

    return `
      <table class="table">
        <thead>
          <tr>
            <th>Título</th>
            <th>Empresa</th>
            <th>Fase</th>
            <th>Temperatura</th>
            <th>Valor</th>
            <th>Responsável</th>
            <th>Data Criação</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private generatePhaseDistributionTable(phaseData: any[]): string {
    if (!phaseData || phaseData.length === 0) {
      return '<div class="no-data">Nenhum dado de fase encontrado</div>';
    }

    const rows = phaseData.map(phase => `
      <tr>
        <td><span class="status ${phase.phase?.toLowerCase() || ''}">${phase.phase || 'N/A'}</span></td>
        <td>${phase.count || 0}</td>
        <td class="percentage">${this.formatPercentage(phase.percentage || 0)}</td>
        <td class="currency">${this.formatCurrency(phase.totalValue || 0)}</td>
      </tr>
    `).join('');

    return `
      <table class="table">
        <thead>
          <tr>
            <th>Fase</th>
            <th>Quantidade</th>
            <th>Percentual</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private generateTemperatureDistributionTable(tempData: any[]): string {
    if (!tempData || tempData.length === 0) {
      return '<div class="no-data">Nenhum dado de temperatura encontrado</div>';
    }

    const rows = tempData.map(temp => `
      <tr>
        <td><span class="temperature ${temp.temperature?.toLowerCase() || ''}">${temp.temperature || 'N/A'}</span></td>
        <td>${temp.count || 0}</td>
        <td class="percentage">${this.formatPercentage(temp.percentage || 0)}</td>
        <td class="currency">${this.formatCurrency(temp.totalValue || 0)}</td>
      </tr>
    `).join('');

    return `
      <table class="table">
        <thead>
          <tr>
            <th>Temperatura</th>
            <th>Quantidade</th>
            <th>Percentual</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private generatePerformanceTable(performanceData: any[]): string {
    if (!performanceData || performanceData.length === 0) {
      return '<div class="no-data">Nenhum dado de performance encontrado</div>';
    }

    const rows = performanceData.map((perf, index) => `
      <tr>
        <td>${index + 1}º</td>
        <td>${perf.name || 'N/A'}</td>
        <td>${perf.totalOpportunities || 0}</td>
        <td>${perf.closedOpportunities || 0}</td>
        <td class="percentage">${this.formatPercentage(perf.conversionRate || 0)}</td>
        <td class="currency">${this.formatCurrency(perf.totalValue || 0)}</td>
      </tr>
    `).join('');

    return `
      <table class="table">
        <thead>
          <tr>
            <th>Posição</th>
            <th>Nome</th>
            <th>Total Oportunidades</th>
            <th>Fechadas</th>
            <th>Taxa Conversão</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private generateContent(type: string, data: any): string {
    switch (type) {
      case 'complete':
        return this.generateCompleteReport(data);
      case 'phases':
        return `
          <div class="section">
            <div class="section-title">📊 Distribuição por Fase</div>
            ${this.generatePhaseDistributionTable(data.phaseDistribution)}
          </div>
        `;
      case 'temperature':
        return `
          <div class="section">
            <div class="section-title">🌡️ Distribuição por Temperatura</div>
            ${this.generateTemperatureDistributionTable(data.temperatureDistribution)}
          </div>
        `;
      case 'performance':
        return `
          <div class="section">
            <div class="section-title">🏆 Performance por Vendedor</div>
            ${this.generatePerformanceTable(data.performanceBySalesperson)}
          </div>
        `;
      case 'opportunities':
        return `
          <div class="section">
            <div class="section-title">📋 Lista de Oportunidades</div>
            ${this.generateOpportunitiesTable(data.opportunities)}
          </div>
        `;
      default:
        return '<div class="no-data">Tipo de relatório não reconhecido</div>';
    }
  }

  private generateCompleteReport(data: any): string {
    return `
      <div class="section">
        <div class="section-title">📊 Distribuição por Fase</div>
        ${this.generatePhaseDistributionTable(data.phaseDistribution)}
      </div>
      
      <div class="page-break"></div>
      
      <div class="section">
        <div class="section-title">🌡️ Distribuição por Temperatura</div>
        ${this.generateTemperatureDistributionTable(data.temperatureDistribution)}
      </div>
      
      <div class="page-break"></div>
      
      <div class="section">
        <div class="section-title">🏆 Performance por Vendedor</div>
        ${this.generatePerformanceTable(data.performanceBySalesperson)}
      </div>
      
      <div class="page-break"></div>
      
      <div class="section">
        <div class="section-title">👤 Performance por Criador</div>
        ${this.generatePerformanceTable(data.performanceByCreator)}
      </div>
    `;
  }

  private generateSummary(data: any): Array<{ label: string; value: string }> {
    const totalOpportunities = data.opportunities?.length || 0;
    const totalValue = data.opportunities?.reduce((sum: number, opp: any) => sum + (opp.value || 0), 0) || 0;
    const closedOpportunities = data.opportunities?.filter((opp: any) => opp.phase === 'Fechamento')?.length || 0;
    const conversionRate = totalOpportunities > 0 ? (closedOpportunities / totalOpportunities) * 100 : 0;

    return [
      { label: 'Total de Oportunidades', value: totalOpportunities.toString() },
      { label: 'Valor Total', value: this.formatCurrency(totalValue) },
      { label: 'Oportunidades Fechadas', value: closedOpportunities.toString() },
      { label: 'Taxa de Conversão', value: this.formatPercentage(conversionRate) }
    ];
  }

  private async replaceTemplateVariables(template: string, variables: any): Promise<string> {
    // Use dynamic import for Handlebars
    const { default: Handlebars } = await import('handlebars');
    
    // Compile the template with Handlebars
    const compiledTemplate = Handlebars.compile(template);
    
    // Execute the template with the provided variables
    return compiledTemplate(variables);
  }

  private async launchBrowserWithRetry(config: any, maxRetries: number = 7): Promise<any> {
    let lastError: Error | null = null;
    const { isProduction, isWindowsServer } = this.detectProductionEnvironment();
    let chromeInstallAttempted = false;
    
    console.log(`🔄 Iniciando processo de retry para ambiente: Produção=${isProduction}, WindowsServer=${isWindowsServer}`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Tentativa ${attempt}/${maxRetries} de inicializar o navegador...`);
        console.log('📊 Configuração atual do Puppeteer:', {
          totalArgs: config.args?.length || 0,
          headless: config.headless,
          executablePath: config.executablePath || 'padrão do Puppeteer',
          timeout: config.timeout,
          protocolTimeout: config.protocolTimeout,
          ignoreDefaultArgs: config.ignoreDefaultArgs,
          cacheDir: process.env.PUPPETEER_CACHE_DIR || 'padrão'
        });
        
        // Log dos argumentos críticos para debugging
        const criticalArgs = config.args?.filter((arg: string) => 
          arg.includes('sandbox') || arg.includes('single-process') || arg.includes('extensions')
        ) || [];
        console.log('🔧 Argumentos críticos:', criticalArgs);
        
        const browser = await puppeteer.launch(config);
        console.log(`✅ Navegador inicializado com sucesso na tentativa ${attempt}`);
        
        // Testa se o navegador está realmente funcional
        try {
          const page = await browser.newPage();
          await page.close();
          console.log('✅ Teste de funcionalidade do navegador passou');
          return browser;
        } catch (testError) {
          console.warn('⚠️ Navegador inicializado mas falhou no teste de funcionalidade:', testError);
          await browser.close();
          throw testError;
        }
        
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Falha na tentativa ${attempt}/${maxRetries}:`);
        console.error('📋 Detalhes do erro:', {
          message: error instanceof Error ? error.message : 'Erro desconhecido',
          stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : 'N/A'
        });
        
        // Verifica se é erro de Chrome não encontrado e tenta instalar automaticamente
        const errorMessage = error instanceof Error ? error.message : '';
        const isChromeNotFoundError = errorMessage.includes('Could not find Chrome') || 
                                     errorMessage.includes('chrome') ||
                                     errorMessage.includes('browser process');
        
        if (isChromeNotFoundError && !chromeInstallAttempted && attempt <= 3) {
          console.log('🔧 Detectado erro de Chrome não encontrado. Tentando instalação automática...');
          chromeInstallAttempted = true;
          
          try {
            const installSuccess = await installChromeAutomatically();
            if (installSuccess) {
              console.log('✅ Chrome instalado! Tentando novamente...');
              // Não conta como tentativa, tenta novamente
              attempt--;
              continue;
            }
          } catch (installError) {
            console.error('❌ Falha na instalação automática do Chrome:', installError);
          }
        }
        
        if (attempt < maxRetries) {
          // Backoff exponencial mais agressivo para produção
          const baseDelay = isProduction ? 3000 : 2000;
          const delay = Math.pow(2, attempt) * baseDelay;
          console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Estratégias progressivas de fallback
          console.log(`🔄 Aplicando estratégia de fallback ${attempt}...`);
          
          if (attempt === 1) {
            // Segunda tentativa: remove --single-process e argumentos problemáticos
            config.args = config.args.filter((arg: string) => 
              !arg.includes('single-process') && 
              !arg.includes('disable-extensions') &&
              !arg.includes('disable-plugins')
            );
            config.ignoreDefaultArgs = ['--disable-extensions'];
            console.log('🔄 Estratégia 1: Removendo argumentos problemáticos');
            
          } else if (attempt === 2) {
            // Terceira tentativa: configuração intermediária
            config.args = [
              '--no-sandbox',
              '--disable-setuid-sandbox', 
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--headless',
              '--disable-web-security',
              '--disable-features=VizDisplayCompositor'
            ];
            config.ignoreDefaultArgs = false;
            config.timeout = 180000; // 3 minutos
            console.log('🔄 Estratégia 2: Configuração intermediária');
            
          } else if (attempt === 3) {
            // Quarta tentativa: configuração mínima absoluta
            config.args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
            config.ignoreDefaultArgs = false;
            config.timeout = 240000; // 4 minutos
            delete config.executablePath; // Força uso do Chrome padrão do Puppeteer
            console.log('🔄 Estratégia 3: Configuração mínima + Chrome padrão');
            
          } else if (attempt === 4) {
            // Quinta tentativa: configuração ultra-mínima
            config.args = ['--no-sandbox'];
            config.ignoreDefaultArgs = true;
            config.timeout = 300000; // 5 minutos
            console.log('🔄 Estratégia 4: Ultra-mínima');
            
          } else if (attempt === 5) {
            // Sexta tentativa: força reinstalação do Puppeteer
            console.log('🔄 Estratégia 5: Forçando reinstalação do Puppeteer...');
            try {
              execSync('npm install puppeteer --force', { 
                stdio: 'inherit',
                timeout: 180000,
                cwd: process.cwd()
              });
              console.log('✅ Puppeteer reinstalado com sucesso!');
            } catch (reinstallError) {
              console.error('❌ Falha na reinstalação do Puppeteer:', reinstallError);
            }
            
            config.args = ['--no-sandbox', '--disable-setuid-sandbox'];
            config.ignoreDefaultArgs = false;
            config.timeout = 360000; // 6 minutos
            
          } else if (attempt === 6) {
            // Sétima tentativa: última chance com configuração de emergência
            config.args = [];
            config.ignoreDefaultArgs = true;
            config.timeout = 420000; // 7 minutos
            delete config.executablePath;
            console.log('🔄 Estratégia 6: Configuração de emergência (última chance)');
          }
          
          console.log(`📊 Nova configuração (tentativa ${attempt + 1}): ${config.args?.length || 0} argumentos`);
        }
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    const errorMessage = `💥 ERRO CRÍTICO: Falha ao inicializar o navegador após ${maxRetries} tentativas em ambiente ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}. Último erro: ${lastError?.message}`;
    console.error(errorMessage);
    console.error('🔍 Informações do sistema:', {
      platform: process.platform,
      nodeVersion: process.version,
      cwd: process.cwd(),
      env: process.env.NODE_ENV,
      puppeteerCache: process.env.PUPPETEER_CACHE_DIR,
      chromeInstallAttempted: chromeInstallAttempted
    });
    
    throw new Error(errorMessage);
  }

  async generatePDF(options: PDFGenerationOptions): Promise<Buffer> {
    const { title, type, data, filters } = options;
    const { isProduction, isWindowsServer } = this.detectProductionEnvironment();
    
    console.log('🎯 Iniciando geração de PDF...');
    console.log('PDF Generation - Type:', type);
    console.log('PDF Generation - Data keys:', Object.keys(data || {}));
    console.log(`🏢 Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'} | Windows Server: ${isWindowsServer}`);
    console.log(`📁 Diretório atual: ${process.cwd()}`);
    console.log(`🔧 Node.js: ${process.version} | Plataforma: ${process.platform}`);
    
    // Log das variáveis de ambiente críticas
    console.log('🌍 Variáveis de ambiente críticas:', {
      NODE_ENV: process.env.NODE_ENV,
      PUPPETEER_CACHE_DIR: process.env.PUPPETEER_CACHE_DIR,
      PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP
    });
    
    // Gerar conteúdo específico do tipo
    console.log('📝 Gerando conteúdo do relatório...');
    const content = this.generateContent(type, data);
    console.log('PDF Generation - Content length:', content.length);
    
    // Gerar resumo se for relatório completo
    const summary = type === 'complete' ? this.generateSummary(data) : undefined;
    
    // Preparar variáveis do template
    const templateVariables = {
      title,
      generatedAt: this.formatDate(new Date()),
      filters: filters || '',
      summary,
      content
    };

    console.log('PDF Generation - Template variables:', {
      title: templateVariables.title,
      generatedAt: templateVariables.generatedAt,
      filters: templateVariables.filters,
      hasSummary: !!templateVariables.summary,
      contentPreview: templateVariables.content.substring(0, 100)
    });

    // Substituir variáveis no template
    console.log('🔄 Processando template HTML...');
    const html = await this.replaceTemplateVariables(this.baseTemplate, templateVariables);
    console.log(`📏 Tamanho do HTML gerado: ${html.length} caracteres`);

    // Gerar PDF com Puppeteer usando configuração robusta e retry
    console.log('⚙️ Obtendo configuração do Puppeteer...');
    const puppeteerConfig = this.getPuppeteerConfig();
    console.log('📋 Configuração inicial obtida:', {
      totalArgs: puppeteerConfig.args?.length || 0,
      hasExecutablePath: !!puppeteerConfig.executablePath,
      headless: puppeteerConfig.headless,
      timeout: puppeteerConfig.timeout
    });
    
    let browser;
    try {
      console.log('🚀 Iniciando processo de lançamento do navegador...');
      const startTime = Date.now();
      browser = await this.launchBrowserWithRetry(puppeteerConfig);
      const launchTime = Date.now() - startTime;
      console.log(`✅ Navegador lançado em ${launchTime}ms`);
    } catch (launchError) {
      console.error('💥 Erro crítico ao inicializar navegador:', launchError);
      throw new Error(`Erro ao inicializar navegador: ${launchError instanceof Error ? launchError.message : 'Erro desconhecido'}`);
    }

    try {
      console.log('🌐 Criando nova página...');
      const page = await browser.newPage();
      
      // Configurações de timeout e otimização para produção
      const timeout = isProduction ? 60000 : 45000;
      await page.setDefaultTimeout(timeout); // Timeout aumentado
      await page.setDefaultNavigationTimeout(timeout);
      console.log(`⏱️ Timeouts configurados para ${timeout}ms`);
      
      // Desabilita imagens e CSS para melhor performance em produção
      if (isProduction) {
        console.log('🚫 Configurando interceptação de recursos para produção...');
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          if (resourceType === 'image' || resourceType === 'font') {
            req.abort();
          } else {
            req.continue();
          }
        });
      }
      
      console.log('📄 Definindo conteúdo da página...');
      const contentStartTime = Date.now();
      await page.setContent(html, { 
        waitUntil: 'domcontentloaded', // Mais rápido que networkidle0
        timeout: timeout 
      });
      const contentTime = Date.now() - contentStartTime;
      console.log(`📄 Conteúdo definido em ${contentTime}ms`);
      
      console.log('🖨️ Gerando PDF...');
      const pdfStartTime = Date.now();
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        timeout: timeout
      });
      const pdfTime = Date.now() - pdfStartTime;
      const totalTime = Date.now() - (contentStartTime - (contentTime));
      
      console.log(`✅ PDF gerado com sucesso!`);
      console.log(`📊 Estatísticas de performance:`);
      console.log(`   - Definição de conteúdo: ${contentTime}ms`);
      console.log(`   - Geração do PDF: ${pdfTime}ms`);
      console.log(`   - Tempo total: ${totalTime}ms`);
      console.log(`   - Tamanho do PDF: ${pdf.length} bytes`);
      
      return pdf;
      
    } catch (error) {
      console.error('❌ ERRO CRÍTICO na geração de PDF:');
      console.error('📋 Detalhes do erro:', {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        name: error instanceof Error ? error.name : 'N/A',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : 'N/A'
      });
      console.error('🔍 Contexto do erro:', {
        ambiente: isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO',
        windowsServer: isWindowsServer,
        diretorio: process.cwd(),
        nodeVersion: process.version,
        plataforma: process.platform,
        memoriaUsada: process.memoryUsage(),
        tempoExecucao: process.uptime()
      });
      
      throw new Error(`Falha na geração do PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      try {
        if (browser) {
          console.log('🔒 Fechando navegador...');
          const closeStartTime = Date.now();
          await browser.close();
          const closeTime = Date.now() - closeStartTime;
          console.log(`🔒 Navegador fechado em ${closeTime}ms`);
        }
      } catch (closeError) {
        console.error('⚠️ Erro ao fechar navegador:', closeError);
      }
    }
  }
}

export const pdfService = new PDFService();