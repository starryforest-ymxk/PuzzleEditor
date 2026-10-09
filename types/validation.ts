/** 项目诊断属于领域数据；导航和面板状态由应用层负责。 */
export interface ValidationResult {
  id: string;
  code?: string; // 稳定规则标识；旧 UI 夹具可省略，新工程校验必须提供。
  field?: string; // 相对于诊断所属实体的字段；不从英文消息反推。
  graphId?: string; // 演出节点所属图，避免相同局部 ID 误定位。
  fsmId?: string; // 状态/迁移的所属图，避免局部 ID 冲突。
  ownerType?: 'stage' | 'puzzle'; // 局部变量的声明归属，不把 ID 误当全局唯一。
  ownerId?: string;
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

/** 自动化入口使用带稳定代码的工程诊断，保留现有 GUI 诊断接口兼容。 */
export interface CodedValidationResult extends ValidationResult {
  code: string;
}
