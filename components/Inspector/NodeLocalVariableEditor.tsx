import React from 'react';
import { LocalVariableEditor, type LocalVariableEditorProps } from './LocalVariableEditor';

// Deprecated: 保留旧入口，统一转发到 LocalVariableEditor（Node/Stage 通用局部变量编辑）
export type NodeLocalVariableEditorProps = LocalVariableEditorProps;
export const NodeLocalVariableEditor: React.FC<LocalVariableEditorProps> = (props) => <LocalVariableEditor {...props} />;
