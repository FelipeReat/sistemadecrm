import twilio from 'twilio';

export interface SMSOptions {
  to: string;
  message: string;
  opportunityId?: string;
}

export interface WhatsAppOptions {
  to: string;
  message: string;
  opportunityId?: string;
}

class SMSService {
  private client: twilio.Twilio | null = null;
  private twilioPhoneNumber: string | undefined;
  private twilioWhatsAppNumber: string | undefined;

  constructor() {
    this.initializeTwilio();
  }

  private initializeTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      console.log('📱 SMS/WhatsApp service initialized with Twilio');
    } else {
      console.log('📱 SMS/WhatsApp service not configured - Twilio credentials required');
    }
  }

  async sendSMS(options: SMSOptions): Promise<boolean> {
    if (!this.client || !this.twilioPhoneNumber) {
      console.log('📱 SMS service not configured, logging message instead');
      console.log(`SMS to ${options.to}: ${options.message}`);
      return false;
    }

    try {
      const message = await this.client.messages.create({
        body: options.message,
        from: this.twilioPhoneNumber,
        to: options.to,
      });

      console.log(`📱 SMS sent successfully: ${message.sid}`);
      return true;
    } catch (error) {
      console.error('📱 SMS error:', error);
      return false;
    }
  }

  async sendWhatsApp(options: WhatsAppOptions): Promise<boolean> {
    if (!this.client || !this.twilioWhatsAppNumber) {
      console.log('📱 WhatsApp service not configured, logging message instead');
      console.log(`WhatsApp to ${options.to}: ${options.message}`);
      return false;
    }

    try {
      // Format numbers for WhatsApp (must include whatsapp: prefix)
      const fromNumber = `whatsapp:${this.twilioWhatsAppNumber}`;
      const toNumber = options.to.startsWith('whatsapp:') ? options.to : `whatsapp:${options.to}`;

      const message = await this.client.messages.create({
        body: options.message,
        from: fromNumber,
        to: toNumber,
      });

      console.log(`📱 WhatsApp sent successfully: ${message.sid}`);
      return true;
    } catch (error) {
      console.error('📱 WhatsApp error:', error);
      return false;
    }
  }

  // Send notification for new opportunity
  async sendOpportunityCreatedSMS(opportunity: any, phoneNumber: string) {
    const message = `🎯 Nova Oportunidade!
📞 ${opportunity.contact}
🏢 ${opportunity.company}
📱 ${opportunity.phone}
📋 ${opportunity.needCategory}
💡 ${opportunity.clientNeeds}`;

    return await this.sendSMS({
      to: phoneNumber,
      message,
      opportunityId: opportunity.id,
    });
  }

  async sendOpportunityCreatedWhatsApp(opportunity: any, phoneNumber: string) {
    const message = `🎯 *Nova Oportunidade!*

📞 *Contato:* ${opportunity.contact}
🏢 *Empresa:* ${opportunity.company}
📱 *Telefone:* ${opportunity.phone}
📋 *Categoria:* ${opportunity.needCategory}
💡 *Necessidades:* ${opportunity.clientNeeds}

Acesse o sistema para mais detalhes.`;

    return await this.sendWhatsApp({
      to: phoneNumber,
      message,
      opportunityId: opportunity.id,
    });
  }

  // Send phase change notification
  async sendPhaseChangeSMS(opportunity: any, oldPhase: string, newPhase: string, phoneNumber: string) {
    const phaseNames: Record<string, string> = {
      'prospeccao': 'Prospecção',
      'em-atendimento': 'Em Atendimento',
      'visita-tecnica': 'Visita Técnica',
      'proposta': 'Proposta',
      'negociacao': 'Negociação',
      'ganho': 'Ganho',
      'perdido': 'Perdido',
    };

    const message = `🔄 Oportunidade Atualizada!
🏢 ${opportunity.company}
📞 ${opportunity.contact}
📈 ${phaseNames[oldPhase]} → ${phaseNames[newPhase]}`;

    return await this.sendSMS({
      to: phoneNumber,
      message,
      opportunityId: opportunity.id,
    });
  }

  async sendPhaseChangeWhatsApp(opportunity: any, oldPhase: string, newPhase: string, phoneNumber: string) {
    const phaseNames: Record<string, string> = {
      'prospeccao': 'Prospecção',
      'em-atendimento': 'Em Atendimento',
      'visita-tecnica': 'Visita Técnica',
      'proposta': 'Proposta',
      'negociacao': 'Negociação',
      'ganho': 'Ganho',
      'perdido': 'Perdido',
    };

    const message = `🔄 *Oportunidade Atualizada!*

🏢 *Empresa:* ${opportunity.company}
📞 *Contato:* ${opportunity.contact}
📈 *Mudança:* ${phaseNames[oldPhase]} → ${phaseNames[newPhase]}

Acesse o sistema para mais detalhes.`;

    return await this.sendWhatsApp({
      to: phoneNumber,
      message,
      opportunityId: opportunity.id,
    });
  }

  // Send daily summary
  async sendDailySummaryWhatsApp(summary: any, phoneNumber: string) {
    const message = `📊 *Resumo Diário - CRM*

📝 *Oportunidades:* ${summary.totalOpportunities}
✅ *Ganhas:* ${summary.wonOpportunities}
❌ *Perdidas:* ${summary.lostOpportunities}
🎯 *Ativas:* ${summary.activeOpportunities}
💰 *Valor Total:* R$ ${summary.totalValue?.toLocaleString('pt-BR')}

Tenha um ótimo dia! 🚀`;

    return await this.sendWhatsApp({
      to: phoneNumber,
      message,
    });
  }

  // Check if services are configured
  isConfigured(): boolean {
    return this.client !== null;
  }

  isSMSConfigured(): boolean {
    return this.client !== null && this.twilioPhoneNumber !== undefined;
  }

  isWhatsAppConfigured(): boolean {
    return this.client !== null && this.twilioWhatsAppNumber !== undefined;
  }
}

export const smsService = new SMSService();