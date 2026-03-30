import { app } from 'electron';
import { constants } from 'node:fs';
import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { modelGatewayService } from './modelGatewayService';
import { vaultService } from './vaultService';
import { sqliteConfigStoreService } from './sqliteConfigStoreService';
import { getPranaPlatformRuntime } from './pranaPlatformRuntime';

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

const FRONTMATTER_START = '---';

const getSkillRootPath = (): string => {
  const override = sqliteConfigStoreService.readSnapshotSync()?.config?.skills?.path;
  if (override) {
    return override;
  }

  return join(app.getAppPath(), 'skills');
};

const parseInlineArray = (value: string): string[] => {
  return value
    .trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((item) => item.trim())
    .map((item) => item.replace(/^['\"]/, '').replace(/['\"]$/, ''))
    .filter((item) => item.length > 0);
};

const parseFrontmatter = (content: string): SkillManifest | null => {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== FRONTMATTER_START) {
    return null;
  }

  let index = 1;
  const parsed: SkillManifest = {
    name: '',
    description: '',
  };

  let currentRootKey = '';
  let currentNestedKey = '';

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (line === FRONTMATTER_START) {
      break;
    }

    if (!line || line.startsWith('#')) {
      index += 1;
      continue;
    }

    if (rawLine.startsWith('  - ') || rawLine.startsWith('- ')) {
      const value = line.replace(/^-\s*/, '').trim().replace(/^['\"]/, '').replace(/['\"]$/, '');
      if (currentRootKey === 'os') {
        parsed.os = [...(parsed.os ?? []), value.toLowerCase()];
      } else if (currentRootKey === 'requires' && currentNestedKey === 'bins') {
        parsed.requires = {
          ...(parsed.requires ?? {}),
          bins: [...(parsed.requires?.bins ?? []), value],
        };
      } else if (currentRootKey === 'requires' && currentNestedKey === 'env') {
        parsed.requires = {
          ...(parsed.requires ?? {}),
          env: [...(parsed.requires?.env ?? []), value],
        };
      }
      index += 1;
      continue;
    }

    const rootMatch = rawLine.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (rootMatch) {
      const key = rootMatch[1].trim();
      const value = rootMatch[2].trim();

      currentRootKey = key;
      currentNestedKey = '';

      if (key === 'name') {
        parsed.name = value.replace(/^['\"]/, '').replace(/['\"]$/, '');
      } else if (key === 'description') {
        parsed.description = value.replace(/^['\"]/, '').replace(/['\"]$/, '');
      } else if (key === 'priority' && value) {
        parsed.priority = value.replace(/^['\"]/, '').replace(/['\"]$/, '');
      } else if (key === 'os' && value.startsWith('[')) {
        parsed.os = parseInlineArray(value).map((item) => item.toLowerCase());
      } else if (key === 'requires') {
        parsed.requires = parsed.requires ?? {};
      }

      index += 1;
      continue;
    }

    const nestedMatch = rawLine.match(/^\s{2}([a-zA-Z0-9_]+):\s*(.*)$/);
    if (nestedMatch) {
      currentNestedKey = nestedMatch[1].trim();
      const nestedValue = nestedMatch[2].trim();

      if (currentRootKey === 'requires' && currentNestedKey === 'bins') {
        parsed.requires = {
          ...(parsed.requires ?? {}),
          bins: nestedValue.startsWith('[')
            ? parseInlineArray(nestedValue)
            : parsed.requires?.bins ?? [],
        };
      }

      if (currentRootKey === 'requires' && currentNestedKey === 'env') {
        parsed.requires = {
          ...(parsed.requires ?? {}),
          env: nestedValue.startsWith('[')
            ? parseInlineArray(nestedValue)
            : parsed.requires?.env ?? [],
        };
      }

      index += 1;
      continue;
    }

    index += 1;
  }

  if (!parsed.name || !parsed.description) {
    return null;
  }

  return parsed;
};

const canExecuteBinary = async (binaryName: string): Promise<boolean> => {
  const platformRuntime = getPranaPlatformRuntime();
  const pathValue = platformRuntime.path ?? platformRuntime.inheritedEnv?.PATH ?? '';
  const delimiter = process.platform === 'win32' ? ';' : ':';
  const parts = pathValue.split(delimiter).filter((part) => part.length > 0);

  const candidates =
    process.platform === 'win32'
      ? [binaryName, `${binaryName}.exe`, `${binaryName}.cmd`, `${binaryName}.bat`]
      : [binaryName];

  for (const part of parts) {
    for (const candidate of candidates) {
      const absolute = join(part, candidate);
      try {
        await access(absolute, constants.F_OK);
        return true;
      } catch {
        // Continue searching.
      }
    }
  }

  return false;
};

const evaluateEligibility = async (manifest: SkillManifest): Promise<string[]> => {
  const reasons: string[] = [];

  const osRules = manifest.os?.map((item) => item.toLowerCase()) ?? [];
  if (osRules.length > 0) {
    const currentOs = process.platform === 'win32' ? 'windows' : process.platform;
    if (!osRules.some((item) => item.includes(currentOs) || currentOs.includes(item))) {
      reasons.push(`OS mismatch: current=${currentOs}, allowed=${osRules.join(',')}`);
    }
  }

  for (const envVar of manifest.requires?.env ?? []) {
    if (!getPranaPlatformRuntime().runtimeVariables?.[envVar]) {
      reasons.push(`Missing env: ${envVar}`);
    }
  }

  for (const binaryName of manifest.requires?.bins ?? []) {
    const hasBinary = await canExecuteBinary(binaryName);
    if (!hasBinary) {
      reasons.push(`Missing binary: ${binaryName}`);
    }
  }

  return reasons;
};

const runHealthMonitorSkill = async (): Promise<string> => {
  const probe = await modelGatewayService.probeGateway();
  const active = probe.activeProvider ? `${probe.activeProvider}/${probe.activeModel}` : 'none';
  return `Skill completed. Model gateway active=${active}; providers=${probe.statuses.length}`;
};

const runVaultInventorySkill = async (): Promise<string> => {
  const files = await vaultService.listFiles();
  return `Skill completed. Vault files indexed=${files.length}`;
};

const executeSkillAdapter = async (skillId: string): Promise<SkillExecutionResult> => {
  if (skillId === 'compliance-officer') {
    return {
      ok: true,
      skillId,
      output: await runHealthMonitorSkill(),
    };
  }

  if (skillId === 'test-scaffolder') {
    return {
      ok: true,
      skillId,
      output: await runVaultInventorySkill(),
    };
  }

  return {
    ok: false,
    skillId,
    output: `No TypeScript execution adapter is registered for skill: ${skillId}`,
  };
};

export const skillSystemService = {
  async listWorkspaceSkills(): Promise<SkillEntry[]> {
    const root = getSkillRootPath();
    let directories: string[] = [];

    try {
      const entries = await readdir(root, { withFileTypes: true });
      directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }

    const output: SkillEntry[] = [];

    for (const directory of directories) {
      const skillPath = join(root, directory, 'SKILL.md');
      try {
        const content = await readFile(skillPath, 'utf8');
        const manifest = parseFrontmatter(content);
        if (!manifest) {
          continue;
        }

        const ineligibilityReasons = await evaluateEligibility(manifest);
        output.push({
          id: directory,
          manifest,
          path: skillPath,
          eligible: ineligibilityReasons.length === 0,
          ineligibilityReasons,
        });
      } catch {
        // Skip folders without valid SKILL.md.
      }
    }

    return output.sort((a, b) => a.id.localeCompare(b.id));
  },

  async executeSkill(skillId: string): Promise<SkillExecutionResult> {
    return executeSkillAdapter(skillId);
  },
};
