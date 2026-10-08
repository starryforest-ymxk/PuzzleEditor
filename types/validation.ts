/** 项目诊断属于领域数据；导航和面板状态由应用层负责。 */
export interface ValidationResult {
  id: string;
  level: 'error' | 'warning' | 'hint';
  message: string;
  objectType:
    | 'STAGE'
    | 'NODE'
    | 'STATE'
    | 'TRANSITION'
    | 'PRESENTATION_GRAPH'
    | 'PRESENTATION_NODE'
    | 'SCRIPT'
    | 'VARIABLE'
    | 'EVENT';
  objectId: string;
  contextId?: string; // e.g. NodeId for State/Transition
  location: string; // Human readable location string
}
