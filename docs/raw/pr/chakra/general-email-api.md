# Prana PR: General Purpose Email Sending API

## PR Title
`feat: add general-purpose email sending API with AgentMail integration`

## 1. Overview
Adds a framework-agnostic email sending API to Prana, designed to be configured by consuming applications (e.g., Chakra) via props. Supports template-based email sending using Handlebars, with all template logic and credentials owned by the consuming app.

## 2. Key Design Decisions
| Decision | Resolution |
|----------|-------------|
| General Purpose | No use-case specific logic (e.g., OTP) in Prana; only generic email sending |
| Config Via Props | API key, inbox ID, template renderer passed by consuming app (no env vars in Prana) |
| No Templates in Prana | Template loading/compilation handled by consuming app, renderer function passed as prop |
| AgentMail Only | Initial implementation uses AgentMail SDK; extensible for other providers later |

## 3. Changes to Prana
### 3.1 New Files
| File Path | Purpose |
|-----------|---------|
| `src/main/services/emailService.ts` | Core email service: AgentMail client init, `configureEmailService`, `sendEmail` methods |
| `src/main/types/email.types.ts` | Type definitions for `EmailConfig`, `SendEmailOptions`, `EmailResult` |

### 3.2 Modified Files
| File Path | Changes |
|-----------|---------|
| `package.json` | Add `agentmail` SDK to dependencies |
| `src/main/preload.ts` | Expose email API via IPC if needed for renderer access |

## 4. API Specification
### 4.1 Configure Email Service
Initialize the email service with props from consuming app:
```typescript
// In Prana's emailService.ts
export function configureEmailService(config: EmailConfig): void {
    // Store config (apiKey, inboxId, templateRenderer) in module-level state
}
```

### 4.2 Type Definitions (`email.types.ts`)
```typescript
export interface EmailConfig {
    apiKey: string; // AgentMail API key (from consuming app's env)
    inboxId: string; // Sender inbox ID (from consuming app's env)
    templateRenderer: (templateName: string, data: any) => Promise<string>; // Provided by consuming app
}

export interface SendEmailOptions {
    to: string[]; // Recipient email addresses
    subject: string; // Email subject line
    templateName: string; // Name of Handlebars template (e.g., 'otp-email')
    data: any; // Data to inject into template
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
```

### 4.3 Send Email Method
```typescript
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    // 1. Get stored config
    // 2. Call template renderer to get HTML from templateName + data
    // 3. Initialize AgentMail client with apiKey
    // 4. Send email via AgentMail SDK using inboxId as sender
    // 5. Return success/error result
}
```

## 5. Usage Example (Consuming App: Chakra)
```typescript
// Chakra main process
import { configureEmailService, sendEmail } from 'prana/main/services/emailService';
import { renderTemplate } from './chakra/services/templateRenderer';
import { AGENTMAIL_API_KEY, SYSTEM_INBOX_ID } from './chakra/config/env';

// Configure Prana email service with Chakra-owned props
configureEmailService({
    apiKey: AGENTMAIL_API_KEY,
    inboxId: SYSTEM_INBOX_ID,
    templateRenderer: renderTemplate
});

// Send OTP email (Chakra handles OTP logic)
await sendEmail({
    to: ['user@example.com'],
    subject: '[Chakra] Password Reset OTP',
    templateName: 'otp-email',
    data: { otpCode: '123456' }
});
```

## 6. Testing Steps
### 6.1 Local Development
1. Add `agentmail` SDK to Prana dependencies: `npm install agentmail`
2. Consuming app (Chakra) provides valid `AGENTMAIL_API_KEY` and `SYSTEM_INBOX_ID`
3. Test `configureEmailService` with valid props
4. Test `sendEmail` with valid template renderer and AgentMail credentials
5. Verify email received at target inbox

### 6.2 Unit Tests
- `emailService.ts` tests:
  - `configureEmailService` stores config correctly
  - `sendEmail` calls template renderer with correct args
  - `sendEmail` handles AgentMail success/error responses
- Mock AgentMail SDK to avoid actual API calls in tests

## 7. Dependencies Added
- `agentmail`: AgentMail SDK for email sending

## 8. Breaking Changes
None. This is a new feature with no impact on existing Prana functionality.

## 9. Checklist
- [ ] Add `agentmail` to Prana `package.json`
- [ ] Create `emailService.ts` and `email.types.ts`
- [ ] Implement `configureEmailService` and `sendEmail`
- [ ] Add unit tests for email service
- [ ] Update Prana README with email API docs
- [ ] Test with Chakra integration
