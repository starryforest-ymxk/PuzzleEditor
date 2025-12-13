import React from 'react';
import { LocalVariableEditor, type LocalVariableEditorProps } from './LocalVariableEditor';

// Deprecated: 保留兼容导出，已由 LocalVariableEditor 统一实现局部变量编辑（Node/Stage 均可复用）
export const BlackboardEditor: React.FC<LocalVariableEditorProps> = (props) => <LocalVariableEditor {...props} />;
export type BlackboardEditorProps = LocalVariableEditorProps;
