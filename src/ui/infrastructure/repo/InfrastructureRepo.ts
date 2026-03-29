import { HttpStatusCode, ServerResponse } from 'astra';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export interface SystemMetric {
  id: string;
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'critical';
  threshold: string;
}

export interface InfrastructurePayload {
  crisisModeActive: boolean;
  activeAgents: string[];
  metrics: SystemMetric[];
}

export class InfrastructureRepo {
  async getSystemHealth(): Promise<ServerResponse<InfrastructurePayload>> {
    const payload = await safeIpcCall(
      'operations.getInfrastructure',
      () => window.api.operations.getInfrastructure(),
      (value) => typeof value === 'object' && value !== null,
    );

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Loaded',
      data: payload,
    } as ServerResponse<InfrastructurePayload>;
  }
}
