import puppeteer from 'puppeteer';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PDFGenerationOptions {
  title: string;
  type: string;
  data: any;
  filters?: string;
  summary?: Array<{ label: string; value: string }>;
}

// Função para detectar navegadores disponíveis no Windows
function detectAvailableBrowser(): string | null {
  const browsers = [
    {
      name: 'Brave',
      paths: [
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
      ]
    },
    {
      name: 'Microsoft Edge',
      paths: [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    },
    {
      name: 'Google Chrome',
      paths: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      ]
    }
  ];

  for (const browser of browsers) {
    for (const path of browser.paths) {
      if (existsSync(path)) {
        console.log(`✅ Navegador detectado: ${browser.name} em ${path}`);
        return path;
      }
    }
  }

  console.warn('⚠️ Nenhum navegador compatível encontrado nos caminhos padrão');
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

  private getPuppeteerConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    const tempDir = this.createTempDirectory();
    
    // Detecta navegador disponível automaticamente
    const browserExecutable = detectAvailableBrowser();
    
    // Argumentos robustos para Windows - baseado na documentação oficial do Puppeteer
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--disable-features=TranslateUI',
      '--disable-features=VizDisplayCompositor',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-features=VizServiceDisplayCompositor',
      '--disable-web-security',
      '--disable-features=site-per-process',
      '--single-process', // Crítico para Windows em produção
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-networking',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-report-upload',
      '--mute-audio',
      '--disable-logging',
      '--disable-permissions-api'
    ];

    const config: any = {
      headless: true,
      args: baseArgs,
      ignoreDefaultArgs: ['--disable-extensions'], // Permite extensões se necessário
      timeout: 60000, // Timeout aumentado para Windows
      protocolTimeout: 60000
    };

    // Configura o executável do navegador se encontrado
    if (browserExecutable) {
      config.executablePath = browserExecutable;
      console.log(`🚀 Usando navegador personalizado: ${browserExecutable}`);
    } else {
      console.log('🔄 Usando Puppeteer padrão (tentará baixar Chrome automaticamente)');
    }

    // Em produção, adiciona configurações específicas para Windows
    if (isProduction) {
      config.args.push(
        `--user-data-dir=${tempDir}`,
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript'
      );
      
      // Para Windows, permite extensões se necessário (resolve problemas de política)
      config.ignoreDefaultArgs = false;
      config.args.push('--disable-extensions-except=');
    }

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

  private async launchBrowserWithRetry(config: any, maxRetries: number = 3): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Tentativa ${attempt}/${maxRetries} de inicializar o navegador...`);
        console.log('Configuração do Puppeteer:', {
          args: config.args?.length || 0,
          headless: config.headless,
          executablePath: config.executablePath || 'padrão',
          timeout: config.timeout,
          protocolTimeout: config.protocolTimeout
        });
        
        const browser = await puppeteer.launch(config);
        console.log(`✅ Navegador inicializado com sucesso na tentativa ${attempt}`);
        return browser;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Falha na tentativa ${attempt}/${maxRetries}:`, error);
        
        if (attempt < maxRetries) {
          // Aguarda antes da próxima tentativa (backoff exponencial)
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
          console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Modifica a configuração para a próxima tentativa
          if (attempt === 1) {
            // Segunda tentativa: remove --single-process que pode causar problemas
            config.args = config.args.filter((arg: string) => arg !== '--single-process');
            console.log('🔄 Removendo --single-process para segunda tentativa');
          } else if (attempt === 2) {
            // Terceira tentativa: usa configuração mínima
            config.args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
            config.ignoreDefaultArgs = false;
            console.log('🔄 Usando configuração mínima para terceira tentativa');
          }
        }
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    const errorMessage = `Falha ao inicializar o navegador após ${maxRetries} tentativas. Último erro: ${lastError?.message}`;
    console.error('💥', errorMessage);
    throw new Error(errorMessage);
  }

  async generatePDF(options: PDFGenerationOptions): Promise<Buffer> {
    const { title, type, data, filters } = options;
    
    console.log('PDF Generation - Type:', type);
    console.log('PDF Generation - Data keys:', Object.keys(data || {}));
    
    // Gerar conteúdo específico do tipo
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
    const html = await this.replaceTemplateVariables(this.baseTemplate, templateVariables);

    // Gerar PDF com Puppeteer usando configuração robusta e retry
    const puppeteerConfig = this.getPuppeteerConfig();
    
    let browser;
    try {
      browser = await this.launchBrowserWithRetry(puppeteerConfig);
    } catch (launchError) {
      console.error('💥 Erro crítico ao inicializar navegador:', launchError);
      throw new Error(`Erro ao inicializar navegador: ${launchError instanceof Error ? launchError.message : 'Erro desconhecido'}`);
    }

    try {
      const page = await browser.newPage();
      
      // Configurações de timeout e otimização para produção
      await page.setDefaultTimeout(45000); // Timeout aumentado
      await page.setDefaultNavigationTimeout(45000);
      
      // Desabilita imagens e CSS para melhor performance em produção
      if (process.env.NODE_ENV === 'production') {
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
      
      await page.setContent(html, { 
        waitUntil: 'domcontentloaded', // Mais rápido que networkidle0
        timeout: 45000 
      });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        timeout: 45000
      });

      console.log('✅ PDF gerado com sucesso');
      return pdf;
      
    } catch (error) {
      console.error('💥 Erro durante geração do PDF:', error);
      throw new Error(`Falha na geração do PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      try {
        if (browser) {
          await browser.close();
          console.log('🔒 Navegador fechado com sucesso');
        }
      } catch (closeError) {
        console.warn('⚠️ Aviso: Erro ao fechar browser do Puppeteer:', closeError);
      }
    }
  }
}

export const pdfService = new PDFService();