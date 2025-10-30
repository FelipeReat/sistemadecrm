import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PDFGenerationOptions {
  title: string;
  type: string;
  data: any;
  filters?: string;
  summary?: Array<{ label: string; value: string }>;
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

    // Gerar PDF com Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      return pdf;
    } finally {
      await browser.close();
    }
  }
}

export const pdfService = new PDFService();