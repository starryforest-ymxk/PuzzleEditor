
import { ID } from './common';
import { VariableType } from './blackboard';

export interface ScriptParameterDefinition {
  name: string;
  type: VariableType | 'asset' | 'nodeReference';
  required: boolean;
  defaultValue?: any;
  options?: string[]; // 枚举值
}

export interface ScriptDefinition {
  id: ID;
  name: string;
  category: string;
  description?: string;
  parameters: ScriptParameterDefinition[];
}

export interface ScriptsManifest {
  scripts: ScriptDefinition[];
  version: string;
}

export interface TriggerDefinition {
    id: ID;
    name: string;
    description?: string;
    parameters?: ScriptParameterDefinition[];
}

export interface TriggersManifest {
  // 定义可用的触发器类型，如 "OnInteract", "OnEnterRegion"
  triggers: TriggerDefinition[];
}
