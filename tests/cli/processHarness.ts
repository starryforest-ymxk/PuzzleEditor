/** C2–C5 共用真实编译产物驱动；偏好目录隔离到每个测试的临时目录。 */
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';

const binary = resolve('dist-cli/cli.js');
export async function runCli(directory: string, args: string[], stdin?: string) {
  return new Promise<{ code: number | null; result: ReturnType<typeof JSON.parse> }>(
    (resolveRun, reject) => {
      const child = spawn(process.execPath, [binary, ...args], {
        cwd: directory,
        windowsHide: true,
        env: {
          ...process.env,
          APPDATA: join(directory, 'prefs'),
          LOCALAPPDATA: join(directory, 'prefs'),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const out: Buffer[] = [],
        err: Buffer[] = [];
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('CLI command timed out'));
      }, 15000);
      child.stdout.on('data', (b: Buffer) => out.push(b));
      child.stderr.on('data', (b: Buffer) => err.push(b));
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        try {
          expect(Buffer.concat(err).toString()).toBe('');
          resolveRun({ code, result: JSON.parse(Buffer.concat(out).toString()) });
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(stdin ?? '');
    },
  );
}
