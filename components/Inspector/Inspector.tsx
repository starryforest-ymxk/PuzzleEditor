/**
 * components/Inspector/Inspector.tsx
 * 属性检查器路由组件
 * 
 * 该组件负责根据当前选中类型分发到对应的子检查器组件。
 * 遵循单一职责原则，不包含具体的渲染逻辑。
 * 
 * P4-T02 更新：添加滚动位置保留功能，切换选中时保持滚动位置
 */

import React, { useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useEditorState } from '../../store/context';
import { StageInspector } from './StageInspector';
import { NodeInspector } from './NodeInspector';
import { StateInspector } from './StateInspector';
import { TransitionInspector } from './TransitionInspector';
import { PresentationNodeInspector } from './PresentationNodeInspector';
import { PresentationGraphInspector } from './PresentationGraphInspector';
import { FsmInspector } from './FsmInspector';
import { VariableInspector } from './VariableInspector';
import { ScriptInspector } from './ScriptInspector';
import { EventInspector } from './EventInspector';

// 模块级缓存：跨组件重挂载也保留滚动位置
const inspectorScrollCache = new Map<string, number>();

interface InspectorProps {
  readOnly?: boolean;
}

/**
 * 主检查器组件 - 路由分发
 * 根据 ui.selection.type 将渲染委托给对应的子检查器
 * 支持滚动位置保留：每个选中对象的滚动位置会被记住
 */
export const Inspector: React.FC<InspectorProps> = ({ readOnly = false }) => {
  const { ui, project } = useEditorState();

  // 滚动容器引用（自身 DOM）
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 记录最近一次发生滚动的元素与位置，避免切换选中时用错误容器的 0 覆盖缓存
  const lastScrollTopRef = useRef<number>(0);
  // 当前选中 key 的 ref：供滚动监听读取，避免在监听里依赖 ui.selection
  const currentKeyRef = useRef<string>('');
  // 上一次的选中 key
  const prevSelectionKeyRef = useRef<string>('');
  // 首次挂载是否已尝试恢复，用于同一选中对象重挂载的场景
  const initialRestoreDoneRef = useRef<boolean>(false);

  // 组件挂载时重置恢复标记，防止跨视图切换后不再恢复
  useEffect(() => {
    initialRestoreDoneRef.current = false;
  }, []);

  // 解析可滚动元素：优先外层 .panel-content，统一使用 Sidebar 的滚动容器，避免嵌套滚动导致无法保存
  const resolveScrollElements = useCallback((): HTMLElement[] => {
    const container = scrollContainerRef.current;
    const panelContent = container?.parentElement?.closest('.panel-content') as HTMLElement | null;
    // 只返回真正应该滚动的容器（panelContent）；若找不到则回退自身（用于非 Sidebar 场景）
    return (panelContent ? [panelContent] : (container ? [container] : []));
  }, []);

  // 初始化滚动元素引用并绑定监听（中文注释：确保使用真实滚动容器捕获滚动位置，避免阶段面板不保存）
  useEffect(() => {
    const scrollEls = resolveScrollElements();

    const handleScrollEvent = (evt: Event) => {
      const target = evt.target as HTMLElement | null;
      if (!target) return;
      const key = currentKeyRef.current || prevSelectionKeyRef.current;
      if (key) {
        lastScrollTopRef.current = target.scrollTop;
        inspectorScrollCache.set(key, target.scrollTop);
      }
    };

    scrollEls.forEach((el) => el.addEventListener('scroll', handleScrollEvent, { passive: true }));

    return () => {
      scrollEls.forEach((el) => el.removeEventListener('scroll', handleScrollEvent));
    };
    // getSelectionKey 内部依赖 ui.selection，因此不将其放入依赖避免重复绑定；使用 ref 读取最新 key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveScrollElements]);

  // 生成当前选中对象的唯一 key
  const getSelectionKey = useCallback(() => {
    if (ui.selection.type === 'NONE' || !ui.selection.id) {
      return '';
    }
    return `${ui.selection.type}-${ui.selection.id}`;
  }, [ui.selection.type, ui.selection.id]);

  const currentKey = getSelectionKey();
  currentKeyRef.current = currentKey;

  // 确保某个 key 的滚动位置已写入缓存（若已有则不覆盖，避免被重渲染后的 0 覆盖）
  const ensureScrollPositionSaved = useCallback((key: string) => {
    if (!key) return;
    if (inspectorScrollCache.has(key)) return;

    const scrollEl = resolveScrollElements()[0];
    // 优先使用最近一次滚动事件记录的值；否则回退读取当前容器 scrollTop
    const scrollTop = lastScrollTopRef.current || (scrollEl?.scrollTop ?? 0);
    inspectorScrollCache.set(key, scrollTop);
  }, [resolveScrollElements]);

  // 恢复滚动位置
  const restoreScrollPosition = useCallback(() => {
    const scrollEls = resolveScrollElements();
    if (currentKey && scrollEls.length) {
      const savedPosition = inspectorScrollCache.get(currentKey);
      if (savedPosition !== undefined) {
        // 中文注释：使用双层 rAF 等待布局/尺寸计算完成后再恢复，避免后续渲染重置滚动
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollEls.forEach((el) => {
              el.scrollTop = savedPosition;
            });
          });
        });
      }
    }
  }, [currentKey, resolveScrollElements]);

  // 当选中变化时，保存旧位置、恢复新位置
  useLayoutEffect(() => {
    // 选中对象变更
    if (currentKey !== prevSelectionKeyRef.current) {
      ensureScrollPositionSaved(prevSelectionKeyRef.current);
      prevSelectionKeyRef.current = currentKey;
      initialRestoreDoneRef.current = false;
      restoreScrollPosition();
      return;
    }

    // 选中未变但组件重挂载/重渲染时，至少尝试一次恢复
    if (!initialRestoreDoneRef.current) {
      restoreScrollPosition();
      initialRestoreDoneRef.current = true;
    }
  }, [currentKey, ensureScrollPositionSaved, restoreScrollPosition]);

  // 卸载时兜底保存当前位置，避免重新挂载后丢失
  useEffect(() => {
    return () => {
      ensureScrollPositionSaved(prevSelectionKeyRef.current);
    };
  }, [ensureScrollPositionSaved]);

  // 渲染内容
  const renderContent = () => {
    // --- 空选中状态 ---
    if (ui.selection.type === 'NONE') {
      return (
        <div className="empty-state">
          <div style={{ marginBottom: '8px', fontSize: '24px', opacity: 0.2 }}>ⓘ</div>
          Select an object to view its properties
        </div>
      );
    }

    // --- STAGE 检查器 ---
    if (ui.selection.type === 'STAGE') {
      return <StageInspector stageId={ui.selection.id!} readOnly={readOnly} />;
    }

    // --- NODE 检查器 ---
    if (ui.selection.type === 'NODE') {
      return <NodeInspector nodeId={ui.selection.id!} readOnly={readOnly} />;
    }

    // --- STATE 检查器 ---
    if (ui.selection.type === 'STATE') {
      if (!ui.selection.contextId) {
        return <div className="empty-state">State context missing</div>;
      }
      const node = project.nodes[ui.selection.contextId];
      if (!node) {
        return <div className="empty-state">Context node not found</div>;
      }
      return <StateInspector fsmId={node.stateMachineId} stateId={ui.selection.id!} readOnly={readOnly} />;
    }

    // --- TRANSITION 检查器 ---
    if (ui.selection.type === 'TRANSITION') {
      if (!ui.selection.contextId) {
        return <div className="empty-state">Transition context missing</div>;
      }
      const node = project.nodes[ui.selection.contextId];
      if (!node) {
        return <div className="empty-state">Context node not found</div>;
      }
      return <TransitionInspector fsmId={node.stateMachineId} transitionId={ui.selection.id!} readOnly={readOnly} />;
    }

    // --- PRESENTATION_NODE 检查器 ---
    if (ui.selection.type === 'PRESENTATION_NODE') {
      if (!ui.selection.contextId) {
        return <div className="empty-state">Presentation graph context missing</div>;
      }
      return <PresentationNodeInspector graphId={ui.selection.contextId} nodeId={ui.selection.id!} />;
    }

    // --- PRESENTATION_GRAPH 检查器 ---
    if (ui.selection.type === 'PRESENTATION_GRAPH') {
      return <PresentationGraphInspector graphId={ui.selection.id!} readOnly={readOnly} />;
    }

    // --- FSM 检查器 ---
    if (ui.selection.type === 'FSM') {
      return <FsmInspector fsmId={ui.selection.id!} readOnly={readOnly} />;
    }

    // --- VARIABLE 检查器 ---
    if (ui.selection.type === 'VARIABLE') {
      return <VariableInspector variableId={ui.selection.id!} readOnly={readOnly} />;
    }

    // --- SCRIPT 检查器 ---
    if (ui.selection.type === 'SCRIPT') {
      return <ScriptInspector scriptId={ui.selection.id!} readOnly={readOnly} />;
    }

    // --- EVENT 检查器 ---
    if (ui.selection.type === 'EVENT') {
      return <EventInspector eventId={ui.selection.id!} readOnly={readOnly} />;
    }

    // --- 未知选中类型 ---
    return <div className="empty-state">Unknown selection type</div>;
  };

  return (
    <div
      ref={scrollContainerRef}
    >
      {renderContent()}
    </div>
  );
};
