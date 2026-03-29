import { HttpStatusCode, ServerResponse } from 'astra';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export interface SkillManifest {
  name: string;
  description: string;
  priority?: string;
  os?: string[];
  requires?: {
    bins?: string[];
    env?: string[];
  };
}

export interface SkillEntry {
  id: string;
  manifest: SkillManifest;
  path: string;
  eligible: boolean;
  ineligibilityReasons: string[];
}

export interface SkillExecutionResult {
  ok: boolean;
  skillId: string;
  output: string;
}

export class SkillRepo {
  async listSkills(): Promise<ServerResponse<SkillEntry[]>> {
    const data = await safeIpcCall('skills.list', () => window.api.skills.list(), Array.isArray);

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Skills loaded',
      data,
    } as ServerResponse<SkillEntry[]>;
  }

  async executeSkill(skillId: string): Promise<ServerResponse<SkillExecutionResult>> {
    const data = await safeIpcCall<SkillExecutionResult>(
      'skills.execute',
      () => window.api.skills.execute(skillId),
      (value) => typeof (value as { ok?: unknown }).ok === 'boolean',
    );

    return {
      isSuccess: data.ok,
      isError: !data.ok,
      status: HttpStatusCode.SUCCESS,
      statusMessage: data.ok ? 'Skill executed' : 'Skill execution failed',
      data,
    } as ServerResponse<SkillExecutionResult>;
  }
}
