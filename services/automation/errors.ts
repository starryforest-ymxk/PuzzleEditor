/** 领域协调错误不依赖终端，CLI 只负责映射退出码与输出。 */
import type { Diagnostic } from '../../contracts/automation/schemas';

export class AutomationFailure extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly exitCode: number,
    public readonly diagnostics: Diagnostic[] = [],
    public readonly data: unknown = null,
    public readonly retryable = false,
    public readonly path?: string,
  ) {
    super(message);
    this.name = 'AutomationFailure';
  }
}
