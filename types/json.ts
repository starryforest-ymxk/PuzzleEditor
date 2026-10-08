/** 文件可保留的 JSON 值；导入时允许尚待业务校验的值，不使用 any 绕过类型检查。 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** 编辑器四种变量类型的有效值；integer/float 共用 number。 */
export type VariableValue = string | number | boolean;
