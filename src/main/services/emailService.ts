import { EmailConfig, SendEmailOptions, EmailResult, EmailProviderAdapter } from '../types/email.types';

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

/**
 * Factory function to create an email service.
 * Eliminates module-level state for email config and adapter.
 */
export const createEmailService = () => {
  // Instance-level state (not module-level)
  let emailConfig: EmailConfig | null = null;
  let emailAdapter: EmailProviderAdapter | null = null;

  return {
    configure(config: EmailConfig): void {
      emailConfig = config;
      emailAdapter = new AgentMailAdapter(config.apiKey);
    },

    async send(options: SendEmailOptions): Promise<EmailResult> {
      if (!emailConfig || !emailAdapter) {
        return { success: false, error: 'Email service not configured. Call configure() first.' };
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
    },

    isConfigured(): boolean {
      return emailConfig !== null && emailAdapter !== null;
    },

    __resetForTesting(): void {
      emailConfig = null;
      emailAdapter = null;
    },
  };
};

// Backward compatibility - creates a default instance and exports convenience functions
const defaultEmailService = createEmailService();

export function configureEmailService(config: EmailConfig): void {
  defaultEmailService.configure(config);
}

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  return defaultEmailService.send(options);
}

// Export the default instance for direct use
export const emailService = defaultEmailService;
