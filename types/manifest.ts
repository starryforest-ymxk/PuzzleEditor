/**
 * types/manifest.ts
 * 脚本清单类型定义 - 描述可用脚本
 */

import {
  Entity,
  ResourceState,
  ScriptCategory,
  LifecycleScriptTarget,
  ScriptId
} from './common';

// ========== 脚本定义 ==========
/**
 * 脚本定义，描述一个可调用的脚本
 * 注意：演出脚本的参数由用户在绑定时动态配置，不预定义在脚本中
 * 注意：ID 由系统生成，不可编辑
 * 
 * 触发器脚本统一使用 category: 'Trigger' 管理，不再使用独立的 TriggersManifest
 */
export interface ScriptDefinition extends Entity {
  id: ScriptId;                        // 稳定 ID，内部引用使用
  assetName?: string;                  // 资产名（符合变量命名规则：字母/下划线开头，只含字母数字下划线）
  category: ScriptCategory;            // 脚本分类
  // 生命周期脚本的挂载对象范围（仅 category === 'Lifecycle' 时生效）
  lifecycleType?: LifecycleScriptTarget;
  state: ResourceState;
  displayOrder?: number;               // 显示顺序（用于黑板拖拽排序）
}

// ========== 脚本清单 ==========
/**
 * 所有脚本定义的集合
 * 包含所有类型的脚本：Performance、Lifecycle、Condition、Trigger
 */
export interface ScriptsManifest {
  scripts: Record<ScriptId, ScriptDefinition>;
  version: string;
}
