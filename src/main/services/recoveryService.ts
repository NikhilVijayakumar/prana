/**
 * RecoveryService - Goose-Style Failure Recovery with Exponential Backoff
 *
 * Implements the Goose pattern for resilient step execution:
 * - Execute step with success validation
 * - On failure: run cleanup command, reset state, retry with backoff
 * - Exponential backoff: 1s, 2s, 4s, 8s... (configurable multiplier)
 * - Transient vs. permanent error classification
 * - Max retries with configurable timeout
 *
 * Key Innovation from Goose:
 * - Success checks are DECLARATIVE (shell commands, assertions)
 * - Not probabilistic (ML confidence scores)
 * - NOT based on model output, but OBSERVABLE facts (exit codes, HTTP responses)
 *
 * File: src/main/services/recoveryService.ts
 */

import { auditLogService, AUDIT_ACTIONS } from './auditLogService';
import {
  ExecutionContext,
  ErrorClassification,
  ErrorContext,
  StepExecutionResult,
  SuccessCheck,
  ShellCheck,
  HttpCheck,
  StepExecutionConfig,
} from './types/orchestrationTypes';

interface StepExecutionAttempt {
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
  output?: string;
  error?: string;
  result: StepExecutionResult;
  successCheckResults?: boolean[];
}

/**
 * Recovery statistics for a step
 */
interface RecoveryStats {
  stepId: string;
  totalAttempts: number;
  successCheckCount: number;
  failures: number;
  retries: number;
  cleanupExecutions: number;
  totalDurationMs: number;
  finalResult: StepExecutionResult;
  failureReasons: string[];
}

/**
 * RecoveryService: Execute steps with automatic retry/recovery
 *
 * Main philosophy:
 * - Assume failures are transient unless proven permanent
 * - Run cleanup commands before retry to avoid stale state
 * - Reset execution context between attempts
 * - Log every attempt for auditing
 * - Escalate only after all retries exhausted
 */
export class RecoveryService {
  private stats: Map<string, RecoveryStats> = new Map();

  /**
   * MAIN ENTRY POINT: Execute a step with automatic recovery
   *
   * Algorithm:
   * 1. Initialize attempt counter
   * 2. Loop while attempts < max_retries:
   *    a. Calculate backoff delay
   *    b. Wait (exponential backoff)
   *    c. Execute primary command
   *    d. Validate success checks
   *    e. If success → return SUCCESS
   *    f. If failure:
   *       - Classify error (transient vs permanent)
   *       - If permanent → return FAILURE_PERMANENT
   *       - If retriable → run on_failure cleanup, reset, continue loop
   * 3. If max retries exceeded → return ESCALATED
   */
  async executeStepWithRecovery(
    config: StepExecutionConfig,
    context: ExecutionContext
  ): Promise<StepExecutionResult> {
    const stepStats: RecoveryStats = {
      stepId: context.stepId,
      totalAttempts: 0,
      successCheckCount: config.success_checks?.length ?? 0,
      failures: 0,
      retries: 0,
      cleanupExecutions: 0,
      totalDurationMs: 0,
      finalResult: StepExecutionResult.ESCALATED,
      failureReasons: [],
    };

    const attempts: StepExecutionAttempt[] = [];
    const startTime = Date.now();
    let lastError: Error | null = null;

    const maxRetries = config.max_retries ?? 3;
    const backoffMultiplier = config.backoff_multiplier ?? 2;
    const maxBackoffMs = config.max_backoff_ms ?? 30000;

    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      stepStats.totalAttempts++;

      const attemptStartTime = Date.now();
      const attemptLog: StepExecutionAttempt = {
        attemptNumber: attempt,
        startedAt: new Date().toISOString(),
        result: StepExecutionResult.ESCALATED,
      };

      try {
        // Calculate backoff delay (except for first attempt)
        if (attempt > 1) {
          const delayMs = this.calculateBackoff(attempt, backoffMultiplier, maxBackoffMs);

          await auditLogService.appendTransaction(AUDIT_ACTIONS.STEP_BACKOFF_WAIT, {
            stepId: context.stepId,
            attempt,
            delayMs,
            workOrderId: context.workOrderId,
            correlationId: context.workOrderId,
          });

          // Wait with exponential backoff
          await this.sleep(delayMs);
        }

        // Step 1: Execute primary command
        const execution = await this.executeCommand(config.command, {
          timeout: config.timeout_seconds ?? 300,
          env: context.env,
        });

        attemptLog.exitCode = execution.exitCode;
        attemptLog.output = execution.stdout;

        // Step 2: Validate success checks
        let allChecksPassed = true;
        const checkResults: boolean[] = [];

        if (config.success_checks && config.success_checks.length > 0) {
          for (const check of config.success_checks) {
            const checkPassed = await this.validateSuccessCheck(check, context);
            checkResults.push(checkPassed);
            if (!checkPassed) {
              allChecksPassed = false;
              lastError = new Error(`Success check failed: ${this.describeCheck(check)}`);
            }
          }
          attemptLog.successCheckResults = checkResults;
        }

        if (!allChecksPassed) {
          // Continue to retry logic below
          throw lastError || new Error('Success checks failed');
        }

        // SUCCESS!
        attemptLog.result = StepExecutionResult.SUCCESS;
        attemptLog.completedAt = new Date().toISOString();
        attempts.push(attemptLog);

        stepStats.finalResult = StepExecutionResult.SUCCESS;
        stepStats.totalDurationMs = Date.now() - startTime;

        await auditLogService.appendTransaction(AUDIT_ACTIONS.STEP_COMPLETED, {
          stepId: context.stepId,
          attempt,
          duration: Date.now() - attemptStartTime,
          workOrderId: context.workOrderId,
          correlationId: context.workOrderId,
        });

        this.stats.set(context.stepId, stepStats);
        return StepExecutionResult.SUCCESS;

      } catch (error) {
        lastError = error as Error;
        stepStats.failures++;
        attemptLog.error = lastError.message;
        attemptLog.completedAt = new Date().toISOString();

        // Classify error
        const errorContext = this.classifyError(lastError);

        await auditLogService.appendTransaction(AUDIT_ACTIONS.STEP_ERROR_CLASSIFIED, {
          stepId: context.stepId,
          attempt,
          classification: errorContext.classification,
          reason: errorContext.reason,
          isRetriable: errorContext.isRetriable,
          workOrderId: context.workOrderId,
          correlationId: context.workOrderId,
        });

        // Is this a permanent error?
        if (!errorContext.isRetriable || attempt >= maxRetries) {
          stepStats.failureReasons.push(lastError.message);

          if (!errorContext.isRetriable) {
            attemptLog.result = StepExecutionResult.FAILURE_PERMANENT;
            attempts.push(attemptLog);

            stepStats.finalResult = StepExecutionResult.FAILURE_PERMANENT;
            stepStats.totalDurationMs = Date.now() - startTime;

            await auditLogService.appendTransaction(AUDIT_ACTIONS.STEP_FAILED_PERMANENT, {
              stepId: context.stepId,
              attempt,
              error: lastError.message,
              classification: errorContext.classification,
              workOrderId: context.workOrderId,
              correlationId: context.workOrderId,
            });

            this.stats.set(context.stepId, stepStats);
            return StepExecutionResult.FAILURE_PERMANENT;
          }

          if (attempt >= maxRetries) {
            attemptLog.result = StepExecutionResult.ESCALATED;
            attempts.push(attemptLog);

            stepStats.finalResult = StepExecutionResult.ESCALATED;
            stepStats.totalDurationMs = Date.now() - startTime;

            await auditLogService.appendTransaction(AUDIT_ACTIONS.STEP_MAX_RETRIES_EXCEEDED, {
              stepId: context.stepId,
              maxRetries,
              lastError: lastError.message,
              workOrderId: context.workOrderId,
              correlationId: context.workOrderId,
            });

            this.stats.set(context.stepId, stepStats);
            return StepExecutionResult.ESCALATED;
          }
        }

        // Retriable error: run cleanup command before retry
        if (config.on_failure) {
          try {
            stepStats.cleanupExecutions++;

            const cleanupExecution = await this.executeCommand(config.on_failure, {
              timeout: config.on_failure_timeout_seconds ?? 600,
              env: context.env,
            });

            await auditLogService.appendTransaction(AUDIT_ACTIONS.STEP_CLEANUP_EXECUTED, {
              stepId: context.stepId,
              attempt,
              cleanupExitCode: cleanupExecution.exitCode,
              workOrderId: context.workOrderId,
              correlationId: context.workOrderId,
            });

            // Reset execution state for next attempt
            await context.resetState();

            await auditLogService.appendTransaction(AUDIT_ACTIONS.STEP_STATE_RESET, {
              stepId: context.stepId,
              attempt,
              workOrderId: context.workOrderId,
              correlationId: context.workOrderId,
            });

          } catch (cleanupError) {
            // Cleanup itself failed—this becomes a permanent failure
            stepStats.failureReasons.push(`Cleanup failed: ${(cleanupError as Error).message}`);

            await auditLogService.appendTransaction(AUDIT_ACTIONS.STEP_CLEANUP_FAILED, {
              stepId: context.stepId,
              attempt,
              cleanupError: (cleanupError as Error).message,
              workOrderId: context.workOrderId,
              correlationId: context.workOrderId,
            });

            attemptLog.result = StepExecutionResult.FAILURE_PERMANENT;
            attempts.push(attemptLog);

            stepStats.finalResult = StepExecutionResult.FAILURE_PERMANENT;
            stepStats.totalDurationMs = Date.now() - startTime;

            this.stats.set(context.stepId, stepStats);
            return StepExecutionResult.FAILURE_PERMANENT;
          }
        }

        // Log retry attempt
        stepStats.retries++;
        attemptLog.result = StepExecutionResult.FAILURE_RECOVERABLE;
        attempts.push(attemptLog);

        const nextDelayMs = this.calculateBackoff(attempt + 1, backoffMultiplier, maxBackoffMs);

        await auditLogService.appendTransaction(AUDIT_ACTIONS.STEP_RETRY, {
          stepId: context.stepId,
          attempt,
          nextDelayMs,
          error: lastError.message,
          workOrderId: context.workOrderId,
          correlationId: context.workOrderId,
        });
      }
    }

    // Unreachable, but for type safety:
    stepStats.finalResult = StepExecutionResult.ESCALATED;
    stepStats.totalDurationMs = Date.now() - startTime;
    this.stats.set(context.stepId, stepStats);

    return StepExecutionResult.ESCALATED;
  }

  /**
   * Algorithm: Calculate exponential backoff delay
   *
   * Formula: min(multiplier^(attempt-1) * 1000, maxBackoffMs)
   * Examples (multiplier=2, max=30000):
   * - Attempt 1: 0ms (no delay)
   * - Attempt 2: 1000ms
   * - Attempt 3: 2000ms
   * - Attempt 4: 4000ms
   * - Attempt 5: 8000ms
   * - Attempt 6: 16000ms
   * - Attempt 7: 30000ms (capped)
   */
  private calculateBackoff(
    attempt: number,
    multiplier: number = 2,
    maxBackoffMs: number = 30000
  ): number {
    if (attempt <= 1) return 0;

    const backoffMs = Math.pow(multiplier, attempt - 2) * 1000;
    return Math.min(backoffMs, maxBackoffMs);
  }

  /**
   * Algorithm: Classify error as transient or permanent
   *
   * Transient (retriable):
   * - Timeout / timed out
   * - ECONNREFUSED / network error
   * - Too many requests / rate limit
   * - Temporarily unavailable
   * - 5xx server errors (assumed transient)
   *
   * Permanent (not retriable):
   * - Auth errors (401, 403)
   * - Not found (404)
   * - Invalid format
   * - Configuration errors
   * - Syntax errors
   */
  private classifyError(error: Error): ErrorContext {
    const message = error.message.toLowerCase();

    // Transient patterns
    const transientPatterns = [
      /timeout|timed out|enotimeout/,
      /econnrefused|econnreset|network error/,
      /too many requests|rate limit|rate_limit/,
      /temporarily unavailable|service unavailable/,
      /econnaborted|reset by peer/,
      /broken pipe/,
      /no such file or directory/i, // File may be copied soon in async operations
    ];

    for (const pattern of transientPatterns) {
      if (pattern.test(message)) {
        return {
          isRetriable: true,
          classification: ErrorClassification.TRANSIENT,
          reason: `Transient error detected: ${message.substring(0, 50)}`,
          message: error.message,
        };
      }
    }

    // Permanent patterns
    const permanentPatterns = [
      /unauthorized|401|authentication failed|auth error/,
      /forbidden|403/,
      /not found|404|not a directory/,
      /permission denied|eperm/,
      /invalid format|malformed|syntax error/,
      /configuration error|config invalid/,
      /command not found|no such command/,
    ];

    for (const pattern of permanentPatterns) {
      if (pattern.test(message)) {
        return {
          isRetriable: false,
          classification: ErrorClassification.PERMANENT,
          reason: `Permanent error detected: ${message.substring(0, 50)}`,
          message: error.message,
        };
      }
    }

    // Default: unknown classification
    return {
      isRetriable: true, // Assume retriable unless proven permanent
      classification: ErrorClassification.UNKNOWN,
      reason: 'Error classification unknown; assuming transient',
      message: error.message,
    };
  }

  /**
   * Algorithm: Validate individual success check
   *
   * Success check types:
   * 1. Shell: Run command, check exit code = 0
   * 2. Assertion: Evaluate boolean expression
   * 3. HTTP: GET endpoint, check status code
   */
  private async validateSuccessCheck(check: SuccessCheck, context: ExecutionContext): Promise<boolean> {
    try {
      if (check.type === 'shell') {
        const shellCheck = check as ShellCheck;
        const result = await this.executeCommand(shellCheck.command, {
          timeout: 30, // Quick timeout for checks
          env: context.env,
        });
        return result.exitCode === 0;
      }

      if (check.type === 'assertion') {
        // Simple assertion evaluation (would need context to be more useful)
        // For now, assume true (actual implementation would parse and evaluate)
        return true; // TODO: Implement assertion evaluation with context
      }

      if (check.type === 'http_check') {
        // TODO: Implement HTTP check with fetch/axios
        return true; // Placeholder
      }

      return false; // Unknown check type
    } catch (error) {
      return false; // Check failed
    }
  }

  /**
   * Helper: Describe a check for logging
   */
  private describeCheck(check: SuccessCheck): string {
    if (check.type === 'shell') {
      return `shell: ${(check as ShellCheck).command}`;
    }
    if (check.type === 'assertion') {
      return `assertion: ${check.assertion}`;
    }
    if (check.type === 'http_check') {
      return `http: ${(check as HttpCheck).http_url}`;
    }
    return 'unknown';
  }

  /**
   * Helper: Execute a shell command
   *
   * Returns:
   * - exitCode: Process exit code (0 = success, non-zero = failure)
   * - stdout: Standard output
   * - stderr: Standard error
   */
  private async executeCommand(
    command: string,
    _options: {
      timeout: number;
      env: Record<string, string>;
    }
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    // TODO: Implement actual command execution using child_process
    // For now, placeholder that always succeeds
    return {
      exitCode: 0,
      stdout: `Executed: ${command}`,
      stderr: '',
    };
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics for a step
   */
  getStats(stepId: string): RecoveryStats | undefined {
    return this.stats.get(stepId);
  }

  /**
   * Generate recovery report for debugging
   */
  generateReport(stepId: string): string {
    const stats = this.stats.get(stepId);
    if (!stats) return `No stats found for step: ${stepId}`;

    return `
Recovery Report for Step: ${stepId}
=====================================
Total Attempts:      ${stats.totalAttempts}
Success Checks:      ${stats.successCheckCount}
Failures:            ${stats.failures}
Retries:             ${stats.retries}
Cleanup Executions:  ${stats.cleanupExecutions}
Total Duration:      ${stats.totalDurationMs}ms
Final Result:        ${stats.finalResult}
Failure Reasons:     ${stats.failureReasons.join(', ')}
    `.trim();
  }
}

// Singleton instance
export const recoveryService = new RecoveryService();
