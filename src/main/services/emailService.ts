import { EmailConfig, SendEmailOptions, EmailResult, EmailProviderAdapter } from '../types/email.types';

let emailConfig: EmailConfig | null = null;
let emailAdapter: EmailProviderAdapter | null = null;

class AgentMailAdapter implements EmailProviderAdapter {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(params: {
    from: string;
    to: string[];
    subject: string;
    html: string;
  }): Promise<{ messageId: string }> {
    const agentmail = await import('agentmail') as any;
    const AgentMail = agentmail.AgentMail || agentmail.default;
    if (!AgentMail) {
      throw new Error('AgentMail SDK not available. Ensure agentmail is installed.');
    }
    const client = new AgentMail(this.apiKey);
    const result = await client.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return { messageId: result.messageId };
  }
}

export function configureEmailService(config: EmailConfig): void {
  emailConfig = config;
  emailAdapter = new AgentMailAdapter(config.apiKey);
}

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  if (!emailConfig || !emailAdapter) {
    return { success: false, error: 'Email service not configured. Call configureEmailService first.' };
  }

  try {
    const html = await emailConfig.templateRenderer(options.templateName, options.data);
    const result = await emailAdapter.send({
      from: emailConfig.inboxId,
      to: options.to,
      subject: options.subject,
      html,
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
