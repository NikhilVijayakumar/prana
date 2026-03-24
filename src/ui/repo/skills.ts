import { HttpStatusCode, ServerResponse } from 'astra';

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
    const data = await window.api.skills.list();

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Skills loaded',
      data,
    } as ServerResponse<SkillEntry[]>;
  }

  async executeSkill(skillId: string): Promise<ServerResponse<SkillExecutionResult>> {
    const data = await window.api.skills.execute(skillId);

    return {
      isSuccess: data.ok,
      isError: !data.ok,
      status: HttpStatusCode.SUCCESS,
      statusMessage: data.ok ? 'Skill executed' : 'Skill execution failed',
      data,
    } as ServerResponse<SkillExecutionResult>;
  }
}
