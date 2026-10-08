import { exportRuntimeProject } from './projectExport';
import { validateProject } from '../utils/validation/validator';
import type { EditorStore } from '../store/editorStore';
import type { MessageLevel, ProjectOperation, SaveAcknowledgement } from '../store/types';
import type { ProjectMeta } from '../types/project';
import { createEmptyProject } from '../utils/projectFactory';
import { prepareProject, projectUI, serializeProject, type ProjectCandidate } from './projectFiles';
import type { ProjectPlatform } from './projectPlatform';
import { importProject } from '../utils/projectImport';

export type SaveResult =
    | { status: 'saved'; acknowledgement: SaveAcknowledgement }
    | { status: 'downloadInitiated' }
    | { status: 'cancelled' }
    | { status: 'failed'; error: string };
export type SessionResult = { status: 'loaded' | 'cancelled' } | { status: 'failed'; error: string };
type Choice = 'save' | 'discard' | 'cancel';
type Identity = { sessionId: number; revision: number };
export interface StartupToken extends Identity { intent: number }

/** 每个编辑器实例一个协调器；所有入口共享写入顺序和会话切换保护。 */
export class ProjectSession {
    private queue: Promise<unknown> = Promise.resolve();
    private activeRequest = false;
    private autoSaving = false;
    private intent = 0;
    private choice: ((choice: Choice) => void) | null = null;
    private assignedPath = new Map<number, string>();

    constructor(private store: EditorStore, private platform: ProjectPlatform) {}

    private identity(): Identity { return this.store.getState().document; }
    private matches(identity: Identity): boolean {
        const current = this.identity();
        return current.sessionId === identity.sessionId && current.revision === identity.revision;
    }
    private phase(phase: ProjectOperation['phase'], nextAction?: string, message?: string): void {
        this.store.dispatch({ type: 'SET_PROJECT_OPERATION', payload: { phase, nextAction, message } });
    }
    private enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.queue.then(operation);
        this.queue = result.catch(() => undefined);
        return result;
    }
    private async drain(): Promise<void> {
        let tail: Promise<unknown>;
        do { tail = this.queue; await tail; } while (tail !== this.queue);
    }
    pushMessage = (level: MessageLevel, text: string): void => {
        this.store.dispatch({ type: 'ADD_MESSAGE', payload: { id: crypto.randomUUID(), level, text, timestamp: new Date().toISOString() } });
    };
    /** 校验读取当前快照；导出在写队列执行时固定快照，不在组件中保留另一套文件流程。 */
    validateProject = (): void => {
        const { project } = this.store.getState();
        if (!project.isLoaded) return;
        const results = validateProject(project);
        this.store.dispatch({ type: 'SET_VALIDATION_RESULTS', payload: results });
        this.store.dispatch({ type: 'SET_SHOW_VALIDATION_PANEL', payload: true });
        const errors = results.filter(result => result.level === 'error').length;
        this.pushMessage(errors ? 'warning' : 'info', `Validation complete: ${errors} errors and ${results.length - errors} other issues.`);
    };
    exportProject = (): Promise<void> => this.enqueue(async () => {
        const { project, runtime } = this.store.getState();
        if (!project.isLoaded || runtime.projectOperation.phase === 'committing') return;
        try {
            await exportRuntimeProject(project, this.platform, this.store.dispatch, this.pushMessage);
        } catch (error) {
            this.failure(error, 'Export failed');
        }
    });
    private failure(error: unknown, prefix: string): { status: 'failed'; error: string } {
        const message = `${prefix}: ${error instanceof Error ? error.message : String(error)}`;
        this.pushMessage('error', message);
        return { status: 'failed', error: message };
    }

    /** 打开新建表单也算用户意图，避免偏好加载完成后覆盖正在进行的手动操作。 */
    markUserIntent = (): void => { this.intent++; };
    captureStartup = (): StartupToken => ({ ...this.identity(), intent: this.intent });
    private canRestore(token: StartupToken): boolean {
        return token.intent === this.intent && this.matches(token) && !this.store.getState().project.isLoaded && !this.activeRequest;
    }

    private async activate(): Promise<void> {
        if (!this.platform.isDesktop()) return;
        const state = this.store.getState();
        try {
            const result = await this.platform.activate(state.runtime.currentProjectPath, state.project.meta.name);
            if (!result.success) throw new Error(result.error || 'Unable to update recent projects');
        } catch (error) {
            this.pushMessage('warning', `Project is open, but session preferences or file watching could not be updated: ${String(error)}`);
        }
    }

    saveProject = async (options?: { silent?: boolean }): Promise<SaveResult> => {
        const snapshot = this.store.getState();
        if (!snapshot.project.isLoaded || snapshot.runtime.projectOperation.phase === 'committing') return { status: 'cancelled' };
        const savedAt = new Date().toISOString();
        const identity = snapshot.document;
        const originalPath = snapshot.runtime.currentProjectPath;
        let content: string;
        try { content = serializeProject(snapshot.project, projectUI(snapshot.ui), savedAt); }
        catch (error) { return this.failure(error, 'Failed to save project'); }

        return this.enqueue(async () => {
            try {
                let current = this.store.getState();
                if (current.document.sessionId !== identity.sessionId) return { status: 'cancelled' };
                let path = originalPath;
                // 先前同会话的无路径保存可为后续排队请求建立路径，不重复弹选择器。
                if (!path) path = this.assignedPath.get(identity.sessionId) ?? null;
                if (current.runtime.currentProjectPath !== path) return { status: 'cancelled' };
                if (!this.platform.isDesktop()) {
                    this.platform.download(content, `${snapshot.project.meta.name || 'project'}.puzzle.json`);
                    this.pushMessage('info', 'Download started. Unsaved changes remain until you reopen the saved copy.');
                    return { status: 'downloadInitiated' };
                }
                const previousPath = path;
                if (!path) {
                    path = await this.platform.chooseSave(`${snapshot.project.meta.name || 'project'}.puzzle.json`);
                    if (!path) {
                        if (!options?.silent) this.pushMessage('info', 'Save cancelled. Your changes are still in the editor.');
                        return { status: 'cancelled' };
                    }
                    if (!path.toLowerCase().endsWith('.puzzle.json')) throw new Error('Choose a .puzzle.json project file.');
                }
                current = this.store.getState();
                if (current.document.sessionId !== identity.sessionId || current.runtime.currentProjectPath !== previousPath) return { status: 'cancelled' };
                const result = await this.platform.write(path, content);
                if (!result.success) throw new Error(result.error || 'Write failed');
                const acknowledgement: SaveAcknowledgement = { sessionId: identity.sessionId, revision: identity.revision, path, previousPath, savedAt };
                this.store.dispatch({ type: 'PROJECT_SAVE_SUCCEEDED', payload: acknowledgement });
                if (this.store.getState().document.sessionId === identity.sessionId) {
                    this.assignedPath.set(identity.sessionId, path);
                    if (previousPath !== path) await this.activate();
                    if (!options?.silent) this.pushMessage('info', `Project saved to ${path}`);
                }
                return { status: 'saved', acknowledgement };
            } catch (error) { return this.failure(error, 'Failed to save project'); }
        });
    };

    saveProjectSettings = async (updates: Partial<ProjectMeta>): Promise<SaveResult> => {
        const state = this.store.getState();
        if (state.ui.readOnly || this.activeRequest) return { status: 'cancelled' };
        // 同步 dispatch 后读取完整内存快照，绝不回读旧文件覆盖其他未保存内容。
        this.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: updates });
        return this.saveProject();
    };

    autoSave = async (): Promise<void> => {
        const state = this.store.getState();
        if (this.autoSaving || this.activeRequest || !this.platform.isDesktop() || !state.settings.autoSave.enabled
            || !state.project.isLoaded || !state.runtime.currentProjectPath || !state.ui.isDirty) return;
        this.autoSaving = true;
        try { await this.saveProject({ silent: true }); } finally { this.autoSaving = false; }
    };

    choose = (choice: Choice): void => {
        const resolve = this.choice;
        this.choice = null;
        resolve?.(choice);
    };
    private ask(nextAction: string, message?: string): Promise<Choice> {
        return new Promise(resolve => {
            this.choice = resolve;
            this.phase('confirming', nextAction, message);
        });
    }
    private async protect(sessionId: number, nextAction: string, signal?: AbortSignal): Promise<Identity | null> {
        let message: string | undefined;
        while (!signal?.aborted && this.identity().sessionId === sessionId) {
            const current = this.store.getState();
            if (!current.ui.isDirty) return this.identity();
            const choice = await this.ask(nextAction, message);
            if (signal?.aborted || this.identity().sessionId !== sessionId || choice === 'cancel') return null;
            if (choice === 'discard') return this.identity();
            this.phase('saving', nextAction);
            const result = await this.saveProject();
            if (signal?.aborted || this.identity().sessionId !== sessionId) return null;
            if (result.status === 'saved' && this.matches(result.acknowledgement) && result.acknowledgement.path === this.store.getState().runtime.currentProjectPath && !this.store.getState().ui.isDirty) return this.identity();
            message = result.status === 'failed' ? result.error
                : result.status === 'downloadInitiated' ? 'Download started. After keeping your copy, choose Discard to continue, or Cancel to stay.'
                : result.status === 'cancelled' ? 'Save was cancelled. Retry, discard, or cancel this operation.'
                : 'New changes were made while saving. Save again, discard them, or cancel this operation.';
        }
        return null;
    }

    /** 放行前排空同一写队列并冻结已确认版本；握手失败或取消才恢复编辑。 */
    requestClose = async (confirmClose: () => Promise<boolean>, signal?: AbortSignal): Promise<boolean> => {
        this.markUserIntent();
        if (signal?.aborted) return false;
        if (this.activeRequest) {
            this.pushMessage('info', 'Finish or cancel the current project operation before closing.');
            return false;
        }
        this.activeRequest = true;
        const sessionId = this.identity().sessionId;
        const nextAction = 'close the editor';
        let approved = false;
        const abort = () => this.choose('cancel');
        signal?.addEventListener('abort', abort, { once: true });
        this.phase('saving', nextAction);
        try {
            // 已经开始的手动/自动保存必须完成，不能在写盘途中销毁窗口。
            await this.drain();
            while (!signal?.aborted && this.identity().sessionId === sessionId) {
                const consent = await this.protect(sessionId, nextAction, signal);
                if (!consent) return false;
                await this.drain();
                if (signal?.aborted) return false;
                if (!this.matches(consent)) continue;
                this.phase('committing', nextAction);
                approved = await confirmClose();
                return approved;
            }
            return false;
        } catch (error) {
            this.failure(error, 'Unable to close the editor');
            return false;
        } finally {
            signal?.removeEventListener('abort', abort);
            this.choice = null;
            // 已获批准时保持冻结，杜绝 IPC 答复到原生销毁之间的新修改。
            if (!approved) { this.activeRequest = false; this.phase('idle'); }
        }
    };

    private commit(candidate: ProjectCandidate): void {
        this.assignedPath.clear();
        this.store.dispatch({ type: 'INIT_SUCCESS', payload: candidate.project, saved: candidate.saved,
            path: candidate.path, editorState: candidate.editorState, validationResults: candidate.validationResults });
        // 候选未提交时不发布诊断，取消打开也不会替换原项目的问题列表。
        const notices = candidate.importNotices ?? [];
        notices.slice(0, 20).forEach(notice => this.pushMessage('warning', `[${notice.path}] ${notice.message}`));
        if (notices.length > 20) this.pushMessage('warning', `${notices.length - 20} additional optional fields were restored or migrated.`);
        if (candidate.validationResults?.length) {
            const errors = candidate.validationResults.filter(result => result.level === 'error').length;
            this.pushMessage('warning', `Project opened with ${errors} errors and ${candidate.validationResults.length - errors} other validation issues. Use the validation panel to locate and fix them.`);
        }
    }
    private async readCandidate(path: string): Promise<ProjectCandidate> {
        const result = await this.platform.read(path);
        if (!result.success || result.data === undefined) throw new Error(result.error || 'Failed to read project');
        return prepareProject(result.data, path);
    }
    private async replace(prepare: () => Promise<ProjectCandidate | null>, nextAction: string): Promise<SessionResult> {
        this.markUserIntent();
        if (this.activeRequest) return { status: 'cancelled' };
        this.activeRequest = true;
        const sessionId = this.identity().sessionId;
        this.phase('preparing', nextAction);
        try {
            let candidate = await this.enqueue(prepare);
            if (!candidate) return { status: 'cancelled' };
            while (this.identity().sessionId === sessionId) {
                const consent = await this.protect(sessionId, nextAction);
                if (!consent) return { status: 'cancelled' };
                await this.drain();
                if (!this.matches(consent)) continue;
                this.phase('committing', nextAction);
                // 同路径重开必须读取刚完成的保存，而不是确认前准备的旧副本。
                if (!candidate.create && candidate.path && candidate.path === this.store.getState().runtime.currentProjectPath) {
                    candidate = await this.enqueue(() => this.readCandidate(candidate!.path!));
                }
                if (candidate.create && candidate.path) {
                    const savedAt = new Date().toISOString();
                    const content = serializeProject(candidate.project, candidate.editorState, savedAt);
                    const result = await this.enqueue(() => this.platform.write(candidate!.path!, content, { exclusive: true }));
                    if (!result.success) throw new Error(result.error || 'Failed to create project');
                    candidate = { ...candidate, saved: true, project: { ...candidate.project, meta: { ...candidate.project.meta, updatedAt: savedAt } } };
                }
                if (!this.matches(consent)) return { status: 'cancelled' };
                this.commit(candidate);
                await this.enqueue(() => this.activate());
                this.pushMessage('info', `Project "${candidate.project.meta.name}" ${candidate.create ? 'created' : 'loaded'}.`);
                return { status: 'loaded' };
            }
            return { status: 'cancelled' };
        } catch (error) { return this.failure(error, 'Project switch failed'); }
        finally { this.choice = null; this.activeRequest = false; this.phase('idle'); }
    }

    openProject = (path?: string): Promise<SessionResult> => this.replace(async () => {
        if (path) return this.readCandidate(path);
        const source = await this.platform.chooseOpen();
        return source ? prepareProject(source.content, source.path) : null;
    }, 'open another project');

    loadProjectFromString = (content: string, path?: string): Promise<SessionResult> => this.replace(async () =>
        prepareProject(content, this.platform.isDesktop() ? path ?? null : null), 'open another project');

    createAndSaveProject = (name: string, description: string, location: string): Promise<SessionResult> => this.replace(async () => {
        // eslint-disable-next-line no-control-regex -- 文件名校验有意排除 U+0000 至 U+001F 控制字符。
        if (!name.trim() || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name)) throw new Error('Enter a valid project file name.');
        const project = createEmptyProject(name, description);
        let path: string | null = null;
        if (this.platform.isDesktop()) {
            if (!location.trim()) throw new Error('Choose a project folder.');
            const separator = location.includes('\\') ? '\\' : '/';
            path = location.replace(/[\\/]+$/, '') + separator + name + '.puzzle.json';
        }
        return { project, path, saved: false, create: true };
    }, 'create a new project');

    restoreProject = async (path: string, token: StartupToken): Promise<SessionResult> => {
        if (!this.canRestore(token)) return { status: 'cancelled' };
        try {
            const candidate = await this.enqueue(() => this.readCandidate(path));
            if (!this.canRestore(token)) return { status: 'cancelled' };
            this.commit(candidate);
            await this.enqueue(() => this.activate());
            this.pushMessage('info', `Project "${candidate.project.meta.name}" restored.`);
            return { status: 'loaded' };
        } catch (error) {
            return this.canRestore(token) ? this.failure(error, 'Failed to restore last project') : { status: 'cancelled' };
        }
    };

    syncExternal = async (path: string): Promise<void> => {
        const identity = this.identity();
        if (path !== this.store.getState().runtime.currentProjectPath) return;
        await this.enqueue(async () => {
            const current = () => this.identity().sessionId === identity.sessionId && this.store.getState().runtime.currentProjectPath === path;
            if (!current()) return;
            try {
                const result = await this.platform.read(path);
                if (!current()) return;
                if (!result.success || result.data === undefined) throw new Error(result.error || 'Read failed');
                const imported = importProject(result.data);
                if (imported.format !== 'project') throw new Error('External resource synchronization requires a puzzle-project file.');
                const before = this.identity().revision;
                this.store.dispatch({ type: 'SYNC_RESOURCE_STATES', sessionId: identity.sessionId, payload: imported.project });
                if (this.identity().revision !== before) this.pushMessage('info', 'Project resources synchronized from external changes.');
            } catch (error) { if (current()) this.failure(error, 'Failed to synchronize external changes'); }
        });
    };
}
