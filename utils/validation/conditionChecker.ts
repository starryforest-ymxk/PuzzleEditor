/**
 * utils/validation/conditionChecker.ts
 * 条件表达式脚本引用检查 — 公共工具函数
 * 
 * 统一了 fsmValidation.ts 和 presentationValidation.ts 中对条件表达式树的
 * ScriptRef 节点进行脚本存在性验证的重复逻辑。
 * 调用方通过 onIssue 回调自行决定如何构造 issue 对象。
 */

import type { ConditionExpression } from '../../types/stateMachine';
import type { ScriptDefinition } from '../../types/manifest';

/**
 * 脚本引用问题状态
 * - Missing: 脚本在项目中不存在
 * - Deleted: 脚本已标记为删除
 */
export type ScriptRefStatus = 'Missing' | 'Deleted';

/**
 * 递归遍历条件表达式树，检查所有 ScriptRef 节点引用的脚本是否有效。
 * 
 * @param condition  - 条件表达式（可为 undefined，此时直接返回）
 * @param scripts    - 脚本记录映射（project.scripts.scripts）
 * @param onIssue    - 发现脚本引用问题时的回调，调用方据此构造具体的 issue 对象
 */
export function checkConditionScriptReferences(
  condition: ConditionExpression | undefined,
  scripts: Record<string, ScriptDefinition>,
  onIssue: (scriptId: string, status: ScriptRefStatus) => void
): void {
  if (!condition) return;

  // 检查 ScriptRef 节点的脚本是否存在/已删除
  if (condition.type === 'ScriptRef' && condition.scriptId) {
    const script = scripts[condition.scriptId];
    if (!script) {
      onIssue(condition.scriptId, 'Missing');
    } else if (script.state === 'MarkedForDelete') {
      onIssue(condition.scriptId, 'Deleted');
    }
  }

  // 递归遍历 And/Or 逻辑组合的子节点
  if ((condition.type === 'And' || condition.type === 'Or') && condition.children) {
    condition.children.forEach(child =>
      checkConditionScriptReferences(child, scripts, onIssue)
    );
  }

  // 递归遍历 Not 操作数
  if (condition.type === 'Not' && condition.operand) {
    checkConditionScriptReferences(condition.operand, scripts, onIssue);
  }
}
