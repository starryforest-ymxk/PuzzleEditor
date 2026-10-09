/** 隔离测试页驱动真实 ProjectSession、Store 和 preload，生产应用不暴露此接口。 */
import { createEditorStore } from '../../store/editorStore';
import { ProjectSession } from '../../services/projectSession';
import { projectPlatform } from '../../services/projectPlatform';
const store = createEditorStore();
let savePath: string | null = null;
const session = new ProjectSession(store, { ...projectPlatform, chooseSave: async () => savePath });
const state = () => {
  const s = store.getState();
  return {
    name: s.project.meta.name,
    description: s.project.meta.description,
    path: s.runtime.currentProjectPath,
    dirty: s.ui.isDirty,
    revision: s.document.revision,
    history: s.history.past.length,
  };
};
async function operation(action: string, data: Record<string, string> = {}) {
  let result: unknown;
  if (action === 'edit')
    store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { description: data.description } });
  else if (action === 'save') {
    savePath = data.path;
    result = await session.saveProject();
  } else if (action === 'open' || action === 'memory' || action === 'closeCancel') {
    const promise =
      action === 'open'
        ? session.openProject(data.path)
        : action === 'memory'
          ? session.loadProjectFromString(data.content)
          : session.requestClose(async () => true);
    if (data.choice || action === 'closeCancel') {
      const end = Date.now() + 4000;
      while (store.getState().runtime.projectOperation.phase !== 'confirming') {
        if (Date.now() > end) throw new Error('Expected save confirmation');
        await new Promise((done) => setTimeout(done, 10));
      }
      session.choose(action === 'closeCancel' ? 'cancel' : (data.choice as 'cancel' | 'discard'));
    }
    result = await promise;
  }
  return { result, state: state() };
}
Object.assign(window, { ownershipSmoke: operation });
