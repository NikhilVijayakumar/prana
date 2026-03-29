import { HttpStatusCode, ServerResponse } from 'astra';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export type ModelProviderId = 'lmstudio' | 'openrouter' | 'gemini';

export type ModelFailureReason =
  | 'rate_limit'
  | 'overloaded'
  | 'billing'
  | 'auth'
  | 'auth_permanent'
  | 'model_not_found'
  | 'network'
  | 'unknown';

export interface ModelProviderStatus {
  provider: ModelProviderId;
  model: string;
  healthy: boolean;
  status: 'healthy' | 'cooldown' | 'unavailable';
  message: string;
  latencyMs: number | null;
  reason: ModelFailureReason | null;
  cooldownUntil: number | null;
  cooldownRemainingMs: number;
  fromCooldownProbe: boolean;
}

export interface ModelGatewayProbePayload {
  activeProvider: ModelProviderId | null;
  activeModel: string | null;
  fallbackOrder: ModelProviderId[];
  statuses: ModelProviderStatus[];
  checkedAt: string;
}

export class ModelGatewayRepo {
  async probeGateway(): Promise<ServerResponse<ModelGatewayProbePayload>> {
    const result = await safeIpcCall(
      'modelGateway.probe',
      () => window.api.modelGateway.probe(),
      (value) => typeof value === 'object' && value !== null,
    );

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Model gateway probe completed',
      data: result,
    } as ServerResponse<ModelGatewayProbePayload>;
  }
}
