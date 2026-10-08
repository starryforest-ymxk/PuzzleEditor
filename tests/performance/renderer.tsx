import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { StateContext, DispatchContext } from '../../store/context';
import { createEditorStore, type EditorStore } from '../../store/editorStore';
import { INITIAL_STATE, type Action } from '../../store/types';
import { BlackboardPanel } from '../../components/Blackboard/BlackboardPanel';
import { StateMachineCanvas } from '../../components/Canvas/StateMachineCanvas';
import { PresentationCanvas } from '../../components/Canvas/PresentationCanvas';
import { useBlackboardData } from '../../hooks/useBlackboardData';
import { prepareProject, serializeProject } from '../../services/projectFiles';
import { validateProject } from '../../utils/validation/validator';
import { normalizeForExport } from '../../utils/exportNormalizer';
import { importProject } from '../../utils/projectImport';
import type { ProjectData } from '../../types/project';
import { createPerformanceProject, projectSize } from './fixtures';
import example from '../../overview/example_project/BubbleHorror.puzzle.json';
import '../../styles.css';

declare global {
  interface Window {
    performanceHarness: {
      report(result: unknown): void;
      progress(message: string): void;
      gc(): Promise<number>;
    };
  }
}
type Metric = { firstMs: number; samplesMs: number[]; p50Ms: number; p95Ms: number; maxMs: number };
const results: Record<string, unknown> = {};
const now = () => performance.now();
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function measure(operation: () => unknown, samples = 15): Metric {
  const start = now();
  operation();
  const firstMs = now() - start;
  operation();
  operation();
  const samplesMs = Array.from({ length: samples }, () => {
    const t = now();
    operation();
    return now() - t;
  });
  const sorted = [...samplesMs].sort((a, b) => a - b);
  return {
    firstMs,
    samplesMs,
    p50Ms: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maxMs: sorted.at(-1)!,
  };
}

function ReferenceProbe({ project }: { project: ProjectData }) {
  useBlackboardData(project, { filter: '', stateFilter: 'ALL', varTypeFilter: 'ALL' });
  return null;
}
type View = 'blackboard' | 'fsm' | 'presentation' | 'references';
function ViewHost({ store, view }: { store: EditorStore; view: View }) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const node = Object.values(state.project.nodes)[0],
    graph = Object.values(state.project.presentationGraphs)[0];
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={store.dispatch}>
        {view === 'blackboard' ? (
          <BlackboardPanel />
        ) : view === 'fsm' ? (
          node && <StateMachineCanvas node={node} />
        ) : view === 'presentation' ? (
          graph && <PresentationCanvas graph={graph} />
        ) : (
          <ReferenceProbe project={state.project} />
        )}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

async function runProject(label: string, project: ProjectData) {
  window.performanceHarness.progress(`Measuring ${label}`);
  const file = serializeProject(project, undefined, '2026-10-08T00:00:00.000Z');
  const metrics: Record<string, Metric> = {};
  metrics.prepare = measure(() => prepareProject(file, null));
  metrics.validate = measure(() => validateProject(project));
  metrics.serialize = measure(() => serializeProject(project, undefined, project.meta.updatedAt));
  metrics.exportNormalize = measure(() => normalizeForExport(project));
  const store = createEditorStore(structuredClone(INITIAL_STATE));
  store.dispatch({ type: 'INIT_SUCCESS', payload: project, saved: true });
  const container = document.createElement('div');
  Object.assign(container.style, {
    width: '1280px',
    height: '900px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  });
  document.body.appendChild(container);
  const root = createRoot(container);
  const mount = (view: View) =>
    flushSync(() => root.render(<ViewHost store={store} view={view} />));
  const dispatch = (action: Action) => flushSync(() => store.dispatch(action));
  metrics.referencesMount = measure(() => {
    flushSync(() => root.render(null));
    mount('references');
  }, 9);
  flushSync(() => root.render(null));
  metrics.blackboardMount = measure(() => {
    flushSync(() => root.render(null));
    mount('blackboard');
  }, 9);
  await frame();
  let i = 0;
  metrics.blackboardFilter = measure(() =>
    dispatch({ type: 'SET_BLACKBOARD_VIEW', payload: { filter: ++i % 2 ? 'Global 1' : '' } }),
  );
  dispatch({ type: 'SET_BLACKBOARD_VIEW', payload: { filter: '' } });
  metrics.blackboardTabs = measure(() =>
    dispatch({
      type: 'SET_BLACKBOARD_VIEW',
      payload: { activeTab: (['Scripts', 'Events', 'Graphs', 'Variables'] as const)[++i % 4] },
    }),
  );
  dispatch({ type: 'SET_BLACKBOARD_VIEW', payload: { activeTab: 'Variables' } });
  const variableId = Object.keys(project.blackboard.globalVariables)[0];
  if (variableId) {
    metrics.blackboardSelect = measure(() =>
      dispatch({
        type: 'SELECT_OBJECT',
        payload: ++i % 2 ? { type: 'VARIABLE', id: variableId } : { type: 'NONE', id: null },
      }),
    );
    metrics.blackboardEdit = measure(
      () =>
        dispatch({
          type: 'UPDATE_GLOBAL_VARIABLE',
          payload: { id: variableId, data: { description: `Edit ${++i}` } },
        }),
      9,
    );
  }
  const blackboardDomNodes = container.querySelectorAll('*').length;
  const node = Object.values(project.nodes)[0];
  if (node) {
    metrics.fsmMount = measure(() => {
      flushSync(() => root.render(null));
      mount('fsm');
    }, 9);
    const state = Object.values(project.stateMachines[node.stateMachineId].states)[0];
    if (state) {
      metrics.fsmMove = measure(() =>
        dispatch({
          type: 'UPDATE_STATE',
          payload: {
            fsmId: node.stateMachineId,
            stateId: state.id,
            data: { position: { x: state.position.x + ++i, y: state.position.y } },
          },
        }),
      );
      metrics.fsmUndoRedo = measure(() => {
        dispatch({ type: 'UNDO' });
        dispatch({ type: 'REDO' });
      });
    }
  }
  const graph = Object.values(project.presentationGraphs)[0];
  if (graph) {
    metrics.presentationMount = measure(() => {
      flushSync(() => root.render(null));
      mount('presentation');
    }, 9);
    const node = Object.values(graph.nodes)[0];
    if (node)
      metrics.presentationMove = measure(() =>
        dispatch({
          type: 'UPDATE_PRESENTATION_NODE',
          payload: {
            graphId: graph.id,
            nodeId: node.id,
            data: { position: { x: node.position.x + ++i, y: node.position.y } },
          },
        }),
      );
  }
  // 堆测量只比较本进程清理后的趋势；不把它解释为精确的单工程内存占用。
  dispatch({ type: 'INIT_SUCCESS', payload: project, saved: true });
  const historyEntriesBefore = store.getState().history.past.length;
  const heapBeforeHistory = await window.performanceHarness.gc();
  const firstState = node && Object.values(project.stateMachines[node.stateMachineId].states)[0];
  for (let k = 0; k < 50; k++) {
    if (node && firstState)
      dispatch({
        type: 'UPDATE_STATE',
        payload: {
          fsmId: node.stateMachineId,
          stateId: firstState.id,
          data: { position: { x: firstState.position.x + k + 1, y: firstState.position.y } },
        },
      });
    else dispatch({ type: 'UPDATE_PROJECT_META', payload: { description: `History ${k}` } });
  }
  const heapAfterHistory = await window.performanceHarness.gc();
  const issues = validateProject(project);
  results[label] = {
    size: projectSize(project),
    bytes: new TextEncoder().encode(file).length,
    errors: issues.filter((issue) => issue.level === 'error').length,
    metrics,
    blackboardDomNodes,
    finalDomNodes: container.querySelectorAll('*').length,
    heapBeforeHistory,
    heapAfterHistory,
    historyEntriesBefore,
    historyEntries: store.getState().history.past.length,
  };
  flushSync(() => root.unmount());
  container.remove();
  await frame();
}

async function run() {
  for (const [label, project] of [
    ['example', importProject(JSON.stringify(example)).project],
    ['medium', createPerformanceProject('medium')],
    ['large', createPerformanceProject('large')],
  ] as const) {
    if (label !== 'example' && validateProject(project).some((issue) => issue.level === 'error'))
      throw new Error(`Invalid synthetic fixture: ${label}`);
    await runProject(label, project);
  }
  window.performanceHarness.report({
    success: true,
    production: import.meta.env.PROD,
    userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight },
    results,
  });
}
void run().catch((error) =>
  window.performanceHarness.report({
    success: false,
    error: String(error),
    stack: error instanceof Error ? error.stack : undefined,
    results,
  }),
);
