import nodemailer from 'nodemailer';
import { db } from './db';
import { emailLogs, emailTemplates, userSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  opportunityId?: string;
  template?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Configure your email service here
    // For development, you can use a service like Mailtrap or Gmail
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    };

    if (emailConfig.auth.user && emailConfig.auth.pass) {
      this.transporter = nodemailer.createTransport(emailConfig);
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      await this.logEmail(options, 'failed', 'Email service not configured');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      await this.logEmail(options, 'sent');
      return true;
    } catch (error) {
      console.error('📧 Email error:', error);
      await this.logEmail(options, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  private async logEmail(options: EmailOptions, status: 'sent' | 'failed' | 'pending', error?: string) {
    try {
      await db.insert(emailLogs).values({
        to: options.to,
        subject: options.subject,
        template: options.template,
        status,
        error,
        opportunityId: options.opportunityId,
      });
    } catch (err) {
      console.error('📧 Failed to log email:', err);
    }
  }

  async getEmailTemplate(trigger: string): Promise<any> {
    try {
      const template = await db
        .select()
        .from(emailTemplates)
        .where(and(eq(emailTemplates.trigger, trigger), eq(emailTemplates.active, true)))
        .limit(1);

      return template[0] || null;
    } catch (error) {
      console.error('📧 Error fetching email template:', error);
      return null;
    }
  }

  async shouldSendNotification(userId: string): Promise<boolean> {
    try {
      const settings = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      return settings[0]?.emailNotifications ?? true;
    } catch (error) {
      console.error('📧 Error checking user settings:', error);
      return true; // Default to sending notifications
    }
  }

  // Email templates with variable substitution
  processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    }
    
    return processed;
  }

  // Send notification for new opportunity
  async sendOpportunityCreatedNotification(opportunity: any, userEmail: string) {
    if (!await this.shouldSendNotification(opportunity.createdBy)) {
      return false;
    }

    const template = await this.getEmailTemplate('opportunity_created');
    
    const subject = template?.subject || 'Nova Oportunidade Criada';
    const bodyTemplate = template?.body || `
      <h2>Nova Oportunidade Criada</h2>
      <p><strong>Empresa:</strong> {{company}}</p>
      <p><strong>Contato:</strong> {{contact}}</p>
      <p><strong>Telefone:</strong> {{phone}}</p>
      <p><strong>Categoria:</strong> {{needCategory}}</p>
      <p><strong>Necessidades:</strong> {{clientNeeds}}</p>
      <p><strong>Criado em:</strong> {{createdAt}}</p>
    `;

    const variables = {
      company: opportunity.company,
      contact: opportunity.contact,
      phone: opportunity.phone,
      needCategory: opportunity.needCategory,
      clientNeeds: opportunity.clientNeeds,
      createdAt: new Date(opportunity.createdAt).toLocaleString('pt-BR'),
    };

    const html = this.processTemplate(bodyTemplate, variables);

    return await this.sendEmail({
      to: userEmail,
      subject: this.processTemplate(subject, variables),
      html,
      opportunityId: opportunity.id,
      template: 'opportunity_created',
    });
  }

  // Send notification for phase change
  async sendPhaseChangeNotification(opportunity: any, oldPhase: string, newPhase: string, userEmail: string) {
    if (!await this.shouldSendNotification(opportunity.createdBy)) {
      return false;
    }

    const template = await this.getEmailTemplate('phase_changed');
    
    const phaseNames: Record<string, string> = {
      'prospeccao': 'Prospecção',
      'em-atendimento': 'Em Atendimento',
      'visita-tecnica': 'Visita Técnica',
      'proposta': 'Proposta',
      'negociacao': 'Negociação',
      'ganho': 'Ganho',
      'perdido': 'Perdido',
    };

    const subject = template?.subject || 'Oportunidade - Mudança de Fase';
    const bodyTemplate = template?.body || `
      <h2>Mudança de Fase na Oportunidade</h2>
      <p><strong>Empresa:</strong> {{company}}</p>
      <p><strong>Contato:</strong> {{contact}}</p>
      <p><strong>Fase Anterior:</strong> {{oldPhase}}</p>
      <p><strong>Nova Fase:</strong> {{newPhase}}</p>
      <p><strong>Atualizado em:</strong> {{updatedAt}}</p>
    `;

    const variables = {
      company: opportunity.company,
      contact: opportunity.contact,
      oldPhase: phaseNames[oldPhase] || oldPhase,
      newPhase: phaseNames[newPhase] || newPhase,
      updatedAt: new Date().toLocaleString('pt-BR'),
    };

    const html = this.processTemplate(bodyTemplate, variables);

    return await this.sendEmail({
      to: userEmail,
      subject: this.processTemplate(subject, variables),
      html,
      opportunityId: opportunity.id,
      template: 'phase_changed',
    });
  }
}

export const emailService = new EmailService();