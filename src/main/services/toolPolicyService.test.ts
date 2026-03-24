import { beforeEach, describe, expect, it } from 'vitest';
import { toolPolicyService } from './toolPolicyService';

describe('toolPolicyService', () => {
  beforeEach(() => {
    toolPolicyService.__resetForTesting();
  });

  it('allows non-restricted generic actions', () => {
    const result = toolPolicyService.evaluate({
      actor: 'director',
      action: 'skills.execute',
      target: 'clean-implementation',
    });

    expect(result.decision).toBe('ALLOW');
    expect(result.reasonCode).toBe('allowed');
  });

  it('requires approval for vault publish without explicit user approval', () => {
    const result = toolPolicyService.evaluate({
      actor: 'DIRECTOR',
      action: 'vault.publish',
      target: 'governance-repository',
      approvedByUser: false,
    });

    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.reasonCode).toBe('director_approval_required');
  });

  it('denies restricted path targets', () => {
    const result = toolPolicyService.evaluate({
      actor: 'DIRECTOR',
      action: 'vault.knowledge.read',
      target: '../secrets.txt',
    });

    expect(result.decision).toBe('DENY');
    expect(result.reasonCode).toBe('path_restricted');
  });

  it('denies repeated loop patterns', () => {
    let result = toolPolicyService.evaluate({
      actor: 'DIRECTOR',
      action: 'skills.execute',
      target: 'compliance-officer',
    });

    for (let i = 0; i < 6; i += 1) {
      result = toolPolicyService.evaluate({
        actor: 'DIRECTOR',
        action: 'skills.execute',
        target: 'compliance-officer',
      });
    }

    expect(result.decision).toBe('DENY');
    expect(result.reasonCode).toBe('loop_detected');
  });

  it('denies subagent spawn beyond depth limit', () => {
    const result = toolPolicyService.evaluate({
      actor: 'Eva Compliance',
      action: 'subagents.spawn',
      target: 'parent-123',
      metadata: { depth: 4 },
    });

    expect(result.decision).toBe('DENY');
    expect(result.reasonCode).toBe('depth_limit_exceeded');
  });

  it('reports telemetry counters', () => {
    toolPolicyService.evaluate({
      actor: 'DIRECTOR',
      action: 'vault.publish',
      target: 'governance-repository',
      approvedByUser: false,
    });
    toolPolicyService.evaluate({
      actor: 'DIRECTOR',
      action: 'vault.knowledge.read',
      target: '../restricted',
    });
    toolPolicyService.evaluate({
      actor: 'DIRECTOR',
      action: 'skills.execute',
      target: 'security-and-pitfalls',
    });

    const telemetry = toolPolicyService.getTelemetry();

    expect(telemetry.totalEvaluations).toBe(3);
    expect(telemetry.approvalRequired).toBe(1);
    expect(telemetry.pathBlocks).toBe(1);
    expect(telemetry.allowed).toBe(1);
  });
});
