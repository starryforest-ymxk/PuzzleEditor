/**
 * types/manifest.ts
 * 脚本清单类型定义 - 描述可用脚本及其参数
 */

import {
  Entity,
  VariableType,
  ResourceState,
  ScriptCategory,
  ScriptId,
  ScriptKey,
  TriggerId,
  TriggerKey
} from './common';

// ========== 脚本参数定义 ==========
/**
 * 脚本参数的元数据定义
 */
export interface ScriptParameterDefinition {
  name: string;
  type: VariableType | 'asset' | 'nodeReference';
  required: boolean;
  defaultValue?: any;
  options?: string[];   // 枚举值选项
}

// ========== 脚本定义 ==========
/**
 * 脚本定义，描述一个可调用的脚本及其参数
 */
export interface ScriptDefinition extends Entity {
  id: ScriptId;                        // 稳定 ID，内部引用使用
  key: ScriptKey;                      // 系统生成的稳定 Key，不随重命名变化
  category: ScriptCategory;            // 脚本分类
  parameters: ScriptParameterDefinition[];
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
 */
export interface TriggerDefinition extends Entity {
  id: TriggerId;
  key: TriggerKey;
  parameters?: ScriptParameterDefinition[];
  state: ResourceState;
}

// ========== 触发器清单 ==========
/**
 * 可用触发器类型的集合
 */
export interface TriggersManifest {
  triggers: Record<TriggerId, TriggerDefinition>;
}
