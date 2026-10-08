import { useProjectSession } from '../store/context';
export { EDITOR_VERSION } from '../services/projectFiles';
/** 所有 UI 入口复用同一个会话协调器；组件不直接读写项目文件。 */
export function useProjectActions() {
  const session = useProjectSession();
  return {
    saveProject: session.saveProject,
    saveProjectSettings: session.saveProjectSettings,
    createAndSaveProject: session.createAndSaveProject,
    openProject: session.openProject,
    loadProjectFromString: session.loadProjectFromString,
    exportProject: session.exportProject,
    validateProject: session.validateProject,
    pushMessage: session.pushMessage,
  };
}
export default useProjectActions;
