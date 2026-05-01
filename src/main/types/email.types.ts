export interface EmailProviderAdapter {
  send(params: {
    from: string;
    to: string[];
    subject: string;
    html: string;
  }): Promise<{ messageId: string }>;
}

export interface EmailConfig {
  apiKey: string;
  inboxId: string;
  templateRenderer: (templateName: string, data: any) => Promise<string>;
}

export interface SendEmailOptions {
  to: string[];
  subject: string;
  templateName: string;
  data: any;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
