import { spawn } from 'node:child_process';
import { homedir } from 'node:os';

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

// OpenClaw-inspired process guard: bounded execution with captured output.
export const executeCommand = (
  command: string,
  args: string[],
  timeoutMs = 10_000,
  cwd?: string,
): Promise<CommandResult> => {
  return new Promise((resolve) => {
    const home = homedir();

    // Build SSH command that works non-interactively (no TTY for prompts).
    // - StrictHostKeyChecking=accept-new: auto-accept new host keys
    // - BatchMode=yes: never prompt for passphrase (use agent only)
    const defaultSshCmd = 'ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes';
    const gitSshCommand = process.env['GIT_SSH_COMMAND'] || defaultSshCmd;

    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      // On Windows SSH needs shell context for agent / key discovery
      shell: process.platform === 'win32',
      windowsHide: true,
      env: {
        ...process.env,
        // Ensure HOME is set – SSH looks for keys under ~/.ssh
        HOME: process.env['HOME'] || home,
        USERPROFILE: process.env['USERPROFILE'] || home,
        // Force non-interactive SSH for git operations
        GIT_SSH_COMMAND: gitSshCommand,
      },
    });



    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        stdout,
        stderr: stderr || error.message,
        exitCode: null,
        timedOut,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        ok: !timedOut && code === 0,
        stdout,
        stderr,
        exitCode: code,
        timedOut,
      });
    });
  });
};
