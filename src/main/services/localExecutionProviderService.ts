/**
 * Local Execution Provider Layer
 *
 * Stores provider configuration in an encrypted local config file.
 * Sensitive values are never stored in Vault.
 */

import crypto from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAppDataRoot, mkdirSyncSafe } from './governanceRepoService';
import { wrappedFetch } from "../utils/network/globalFetchWrapper";

export type ModelProviderType = 'lm-studio' | 'openrouter' | 'gemini-cli';

export interface ModelProviderConfig {
  type: ModelProviderType;
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  port?: number;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  contextWindow?: number; // Model-specific context window in tokens (optional user override)
  reservedOutputTokens?: number; // Reserved for model output in tokens (optional user override)
  lastValidated?: string;
  validationStatus: 'UNKNOWN' | 'VALID' | 'INVALID';
  validationError?: string;
}

export interface ModelExecutionRequest {
  provider: ModelProviderType;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelExecutionResult {
  provider: ModelProviderType;
  output: string;
  tokensUsed: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

class ConfigEncryption {
  private static readonly KEY_LENGTH = 32;
  private static readonly NONCE_LENGTH = 12;
  private static readonly KDF_SALT_CURRENT = 'prana-local-config-salt';
  private static readonly KDF_SALT_LEGACY = 'dhi-local-config-salt';

  static deriveKey(masterPassword: string, saltValue = ConfigEncryption.KDF_SALT_CURRENT): Buffer {
    const salt = Buffer.from(saltValue, 'utf8');
    return crypto.pbkdf2Sync(masterPassword, salt, 100000, this.KEY_LENGTH, 'sha256');
  }

  static encrypt(plaintext: string, masterPassword: string): string {
    const key = this.deriveKey(masterPassword);
    const nonce = crypto.randomBytes(this.NONCE_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${nonce.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private static decryptWithSalt(value: string, masterPassword: string, saltValue: string): string | null {
    const [nonceHex, authTagHex, ciphertextHex] = value.split(':');
    if (!nonceHex || !authTagHex || !ciphertextHex) {
      return null;
    }

    const key = this.deriveKey(masterPassword, saltValue);
    const nonce = Buffer.from(nonceHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertextHex, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }

  static decrypt(value: string, masterPassword: string): string | null {
    try {
      return (
        this.decryptWithSalt(value, masterPassword, ConfigEncryption.KDF_SALT_CURRENT) ??
        this.decryptWithSalt(value, masterPassword, ConfigEncryption.KDF_SALT_LEGACY)
      );
    } catch {
      return null;
    }
  }
}

export class LocalExecutionProviderService {
  private readonly storageFile = 'local-model-config.json';
  private readonly providers = new Map<ModelProviderType, ModelProviderConfig>();
  private readonly usageMetrics = new Map<ModelProviderType, { callCount: number; errorCount: number; totalLatency: number }>();
  private masterPassword: string | null = null;

  constructor() {
    this.seedDefaults();
    this.loadFromStorage();
  }

  private seedDefaults(): void {
    const defaults: ModelProviderConfig[] = [
      {
        type: 'lm-studio',
        enabled: false,
        port: 1234,
        model: 'local-model',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000,
        validationStatus: 'UNKNOWN',
      },
      {
        type: 'openrouter',
        enabled: false,
        endpoint: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o-mini',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000,
        validationStatus: 'UNKNOWN',
      },
      {
        type: 'gemini-cli',
        enabled: false,
        model: 'gemini-pro',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 60000,
        validationStatus: 'UNKNOWN',
      },
    ];

    for (const item of defaults) {
      this.providers.set(item.type, item);
      this.usageMetrics.set(item.type, { callCount: 0, errorCount: 0, totalLatency: 0 });
    }
  }

  private getStoragePath(): string {
    return join(getAppDataRoot(), this.storageFile);
  }

  private saveToStorage(): void {
    const data: Record<string, ModelProviderConfig> = {};
    for (const [type, config] of this.providers.entries()) {
      data[type] = config;
    }

    mkdirSyncSafe(getAppDataRoot());
    writeFileSync(this.getStoragePath(), JSON.stringify(data, null, 2), 'utf8');
  }

  private loadFromStorage(): void {
    const path = this.getStoragePath();
    if (!existsSync(path)) {
      return;
    }

    const raw = readFileSync(path, 'utf8');
    if (!raw.trim()) {
      return;
    }

    const parsed = JSON.parse(raw) as Record<string, ModelProviderConfig>;
    for (const [type, config] of Object.entries(parsed)) {
      if (type === 'lm-studio' || type === 'openrouter' || type === 'gemini-cli') {
        this.providers.set(type, config);
      }
    }
  }

  setMasterPassword(password: string): void {
    if (password.length < 16) {
      throw new Error('Master password must be at least 16 characters');
    }
    this.masterPassword = password;
  }

  listProvidersSafe(): Array<ModelProviderConfig & { metrics: { calls: number; errors: number; avgLatency: number } | null }> {
    return Array.from(this.providers.values()).map((provider) => ({
      ...provider,
      apiKey: provider.apiKey ? '__configured__' : undefined,
      metrics: this.getMetrics(provider.type),
    }));
  }

  configureProvider(type: ModelProviderType, config: Partial<ModelProviderConfig>): void {
    const existing = this.providers.get(type);
    if (!existing) {
      throw new Error(`Unknown provider: ${type}`);
    }

    if (!this.masterPassword && config.apiKey) {
      throw new Error('Master password required before storing API key');
    }

    const next: ModelProviderConfig = {
      ...existing,
      ...config,
      type,
      validationStatus: 'UNKNOWN',
      validationError: undefined,
    };

    if (config.apiKey && this.masterPassword) {
      next.apiKey = ConfigEncryption.encrypt(config.apiKey, this.masterPassword);
    }

    this.providers.set(type, next);
    this.saveToStorage();
  }

  setProviderEnabled(type: ModelProviderType, enabled: boolean): boolean {
    const config = this.providers.get(type);
    if (!config) {
      return false;
    }

    config.enabled = enabled;
    this.saveToStorage();
    return true;
  }

  async validateProvider(type: ModelProviderType): Promise<boolean> {
    const config = this.providers.get(type);
    if (!config) {
      return false;
    }

    try {
      let ok = false;
      if (type === 'lm-studio') {
        ok = await this.validateLmStudio(config);
      } else if (type === 'openrouter') {
        ok = await this.validateOpenRouter(config);
      } else {
        ok = await this.validateGeminiCli(config);
      }

      config.validationStatus = ok ? 'VALID' : 'INVALID';
      config.validationError = ok ? undefined : 'Health check failed';
      config.lastValidated = new Date().toISOString();
      this.saveToStorage();
      return ok;
    } catch (error) {
      config.validationStatus = 'INVALID';
      config.validationError = error instanceof Error ? error.message : 'Validation error';
      config.lastValidated = new Date().toISOString();
      this.saveToStorage();
      return false;
    }
  }

  getMetrics(type: ModelProviderType): { calls: number; errors: number; avgLatency: number } | null {
    const metric = this.usageMetrics.get(type);
    if (!metric) {
      return null;
    }

    return {
      calls: metric.callCount,
      errors: metric.errorCount,
      avgLatency: metric.callCount > 0 ? metric.totalLatency / metric.callCount : 0,
    };
  }

  async executeWithProvider(req: ModelExecutionRequest): Promise<ModelExecutionResult> {
    const config = this.providers.get(req.provider);
    if (!config) {
      return { provider: req.provider, output: '', tokensUsed: 0, latencyMs: 0, success: false, error: 'Provider not found' };
    }

    if (!config.enabled) {
      return { provider: req.provider, output: '', tokensUsed: 0, latencyMs: 0, success: false, error: 'Provider disabled' };
    }

    const metrics = this.usageMetrics.get(req.provider) ?? { callCount: 0, errorCount: 0, totalLatency: 0 };
    const start = Date.now();

    try {
      let result: ModelExecutionResult;
      if (req.provider === 'lm-studio') {
        result = await this.executeLmStudio(req, config);
      } else if (req.provider === 'openrouter') {
        result = await this.executeOpenRouter(req, config);
      } else {
        result = await this.executeGeminiCli(req, config);
      }

      const latency = Date.now() - start;
      metrics.callCount += 1;
      metrics.totalLatency += latency;
      this.usageMetrics.set(req.provider, metrics);

      return { ...result, latencyMs: latency, success: true };
    } catch (error) {
      metrics.errorCount += 1;
      this.usageMetrics.set(req.provider, metrics);

      return {
        provider: req.provider,
        output: '',
        tokensUsed: 0,
        latencyMs: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Execution error',
      };
    }
  }

  private async validateLmStudio(config: ModelProviderConfig): Promise<boolean> {
    const url = `http://localhost:${config.port ?? 1234}/api/chat/completions`;
    const response = await wrappedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model ?? 'local-model',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(config.timeout ?? 5000),
    });
    return response.ok;
  }

  private async executeLmStudio(req: ModelExecutionRequest, config: ModelProviderConfig): Promise<ModelExecutionResult> {
    const url = `http://localhost:${config.port ?? 1234}/api/chat/completions`;
    const response = await wrappedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model ?? 'local-model',
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
        max_tokens: req.maxTokens ?? config.maxTokens ?? 2048,
        temperature: req.temperature ?? config.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(config.timeout ?? 30000),
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }>; usage?: { total_tokens?: number } };
    return {
      provider: 'lm-studio',
      output: data.choices[0]?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens ?? 0,
      latencyMs: 0,
      success: true,
    };
  }

  private async validateOpenRouter(config: ModelProviderConfig): Promise<boolean> {
    if (!config.apiKey || !this.masterPassword) {
      return false;
    }

    const apiKey = ConfigEncryption.decrypt(config.apiKey, this.masterPassword);
    if (!apiKey) {
      return false;
    }

    const response = await wrappedFetch(`${config.endpoint ?? 'https://openrouter.ai/api/v1'}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(config.timeout ?? 5000),
    });

    return response.ok;
  }

  private async executeOpenRouter(req: ModelExecutionRequest, config: ModelProviderConfig): Promise<ModelExecutionResult> {
    if (!config.apiKey || !this.masterPassword) {
      throw new Error('OpenRouter API key unavailable in current session');
    }

    const apiKey = ConfigEncryption.decrypt(config.apiKey, this.masterPassword);
    if (!apiKey) {
      throw new Error('Unable to decrypt OpenRouter API key');
    }

    const response = await wrappedFetch(`${config.endpoint ?? 'https://openrouter.ai/api/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model ?? 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
        max_tokens: req.maxTokens ?? config.maxTokens ?? 2048,
        temperature: req.temperature ?? config.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(config.timeout ?? 30000),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }>; usage?: { total_tokens?: number } };
    return {
      provider: 'openrouter',
      output: data.choices[0]?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens ?? 0,
      latencyMs: 0,
      success: true,
    };
  }

  private async validateGeminiCli(_config: ModelProviderConfig): Promise<boolean> {
    return true;
  }

  private async executeGeminiCli(_req: ModelExecutionRequest, _config: ModelProviderConfig): Promise<ModelExecutionResult> {
    return {
      provider: 'gemini-cli',
      output: 'Gemini CLI integration pending',
      tokensUsed: 0,
      latencyMs: 0,
      success: false,
      error: 'Gemini CLI integration pending',
    };
  }
}

export const localExecutionProviderService = new LocalExecutionProviderService();
