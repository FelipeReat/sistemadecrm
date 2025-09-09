import { db } from '../server/db';
import { emailTemplates } from '@shared/schema';

const defaultTemplates = [
  {
    name: 'Nova Oportunidade',
    subject: 'Nova Oportunidade: {{company}}',
    body: `
      <h2>🎯 Nova Oportunidade Criada!</h2>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 10px 0;">
        <p><strong>📞 Contato:</strong> {{contact}}</p>
        <p><strong>🏢 Empresa:</strong> {{company}}</p>
        <p><strong>📱 Telefone:</strong> {{phone}}</p>
        <p><strong>📋 Categoria:</strong> {{needCategory}}</p>
        <p><strong>💡 Necessidades:</strong> {{clientNeeds}}</p>
        <p><strong>📅 Criado em:</strong> {{createdAt}}</p>
      </div>
      <p>Acesse o sistema CRM para mais detalhes e acompanhe o progresso desta oportunidade.</p>
    `,
    trigger: 'opportunity_created',
    active: true,
  },
  {
    name: 'Mudança de Fase',
    subject: 'Oportunidade {{company}} - Mudança de Fase',
    body: `
      <h2>🔄 Oportunidade Atualizada!</h2>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 10px 0;">
        <p><strong>🏢 Empresa:</strong> {{company}}</p>
        <p><strong>📞 Contato:</strong> {{contact}}</p>
        <p><strong>📈 Fase Anterior:</strong> {{oldPhase}}</p>
        <p><strong>📈 Nova Fase:</strong> {{newPhase}}</p>
        <p><strong>📅 Atualizado em:</strong> {{updatedAt}}</p>
      </div>
      <p>Continue acompanhando o progresso desta oportunidade no sistema CRM.</p>
    `,
    trigger: 'phase_changed',
    active: true,
  },
  {
    name: 'Oportunidade Ganha',
    subject: '🎉 Oportunidade Ganha: {{company}}',
    body: `
      <h2>🎉 Parabéns! Oportunidade Ganha!</h2>
      <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #28a745;">
        <p><strong>🏢 Empresa:</strong> {{company}}</p>
        <p><strong>📞 Contato:</strong> {{contact}}</p>
        <p><strong>💰 Valor Final:</strong> R$ {{finalValue}}</p>
        <p><strong>📅 Fechado em:</strong> {{updatedAt}}</p>
      </div>
      <p>Excelente trabalho! Continue assim para atingir suas metas de vendas.</p>
    `,
    trigger: 'opportunity_won',
    active: true,
  },
  {
    name: 'Backup Completado',
    subject: 'Backup do Sistema CRM Completado',
    body: `
      <h2>📦 Backup do Sistema Completado</h2>
      <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #17a2b8;">
        <p><strong>📅 Data:</strong> {{date}}</p>
        <p><strong>📊 Tamanho:</strong> {{size}}</p>
        <p><strong>⏱️ Tipo:</strong> {{type}}</p>
      </div>
      <p>O backup dos dados do sistema CRM foi realizado com sucesso. Seus dados estão seguros!</p>
    `,
    trigger: 'backup_completed',
    active: true,
  },
];

async function setupEmailTemplates() {
  try {
    console.log('📧 Configurando templates de email...');

    for (const template of defaultTemplates) {
      // Check if template already exists
      const existing = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.trigger, template.trigger))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(emailTemplates).values(template);
        console.log(`✅ Template "${template.name}" criado`);
      } else {
        console.log(`⏭️ Template "${template.name}" já existe`);
      }
    }

    console.log('📧 Templates de email configurados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao configurar templates:', error);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupEmailTemplates().then(() => process.exit(0));
}

export { setupEmailTemplates };