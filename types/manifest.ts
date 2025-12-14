/**
 * types/manifest.ts
 * 脚本清单类型定义 - 描述可用脚本
 */

import {
  Entity,
  ResourceState,
  ScriptCategory,
  LifecycleScriptTarget,
  ScriptId,
  TriggerId,
  TriggerKey
} from './common';

// ========== 脚本定义 ==========
/**
 * 脚本定义，描述一个可调用的脚本
 * 注意：演出脚本的参数由用户在绑定时动态配置，不预定义在脚本中
 * 注意：ID 由系统生成，不可编辑
 */
export interface ScriptDefinition extends Entity {
  id: ScriptId;                        // 稳定 ID，内部引用使用
  category: ScriptCategory;            // 脚本分类
  // 生命周期脚本的挂载对象范围（仅 category === 'Lifecycle' 时生效）
  lifecycleType?: LifecycleScriptTarget;
  state: ResourceState;
}

// ========== 脚本清单 ==========
/**
 * 所有脚本定义的集合
 */
export interface ScriptsManifest {
  scripts: Record<ScriptId, ScriptDefinition>;
  version: string;
}

// ========== 触发器定义 ==========
/**
 * 预定义触发器类型（如 OnInteract, OnEnterRegion）
 * 注意：触发器不需要参数
 * 注意：ID 由系统生成，不可编辑
 */
export interface TriggerDefinition extends Entity {
  id: TriggerId;
  state: ResourceState;
}

// ========== 触发器清单 ==========
/**
 * 可用触发器类型的集合
 */
export interface TriggersManifest {
  triggers: Record<TriggerId, TriggerDefinition>;
}
