/**
 * 用户偏好管理服务
 * 负责读写用户偏好设置文件
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
/**
 * 偏好设置存储路径
 * Windows: %APPDATA%/StarryTree/PuzzleEditor/preferences.json
 * macOS: ~/Library/Application Support/StarryTree/PuzzleEditor/preferences.json
 * Linux: ~/.config/StarryTree/PuzzleEditor/preferences.json
 */
function getPreferencesPath() {
    const userDataPath = app.getPath('userData');
    // app.getPath('userData') 默认返回 %APPDATA%/<appName>
    // 我们需要改为 StarryTree/PuzzleEditor
    const basePath = path.dirname(userDataPath);
    return path.join(basePath, 'StarryTree', 'PuzzleEditor', 'preferences.json');
}
/**
 * 获取默认项目目录
 * Windows: C:/Users/<User>/Documents/StarryTree/PuzzleEditor/Projects/
 */
function getDefaultProjectsDirectory() {
    const documentsPath = app.getPath('documents');
    return path.join(documentsPath, 'StarryTree', 'PuzzleEditor', 'Projects');
}
/**
 * 获取默认偏好设置
 */
function getDefaultPreferences() {
    return {
        projectsDirectory: getDefaultProjectsDirectory(),
        exportDirectory: '', // 空则使用 projectsDirectory
        restoreLastProject: true,
        lastProjectPath: null,
        recentProjects: [],
        // 默认使用本地词典翻译，避免未配置 API Key 时请求外网失败
        translation: {
            provider: 'local',
            openaiModel: 'gpt-4o-mini'
        }
    };
}
/**
 * 确保目录存在，不存在则创建
 */
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.promises.access(dirPath);
    }
    catch {
        await fs.promises.mkdir(dirPath, { recursive: true });
    }
}
/**
 * 偏好设置服务
 */
class PreferencesService {
    cachedPreferences = null;
    /**
     * 加载用户偏好设置
     * 如果文件不存在，则创建默认设置
     */
    async loadPreferences() {
        const prefsPath = getPreferencesPath();
        try {
            const content = await fs.promises.readFile(prefsPath, 'utf-8');
            const prefs = JSON.parse(content);
            // 合并默认值，确保新增字段有默认值
            this.cachedPreferences = {
                ...getDefaultPreferences(),
                ...prefs,
            };
            return this.cachedPreferences;
        }
        catch (error) {
            // 文件不存在或读取失败，使用默认设置
            console.log('Preferences file not found, creating default preferences');
            this.cachedPreferences = getDefaultPreferences();
            // 保存默认设置
            await this.savePreferences(this.cachedPreferences);
            return this.cachedPreferences;
        }
    }
    /**
     * 保存用户偏好设置
     */
    async savePreferences(prefs) {
        const prefsPath = getPreferencesPath();
        const prefsDir = path.dirname(prefsPath);
        // 确保目录存在
        await ensureDirectoryExists(prefsDir);
        // 格式化 JSON 便于调试
        const content = JSON.stringify(prefs, null, 2);
        await fs.promises.writeFile(prefsPath, content, 'utf-8');
        // 更新缓存
        this.cachedPreferences = prefs;
        console.log('Preferences saved to:', prefsPath);
    }
    /**
     * 获取缓存的偏好设置
     */
    getCachedPreferences() {
        return this.cachedPreferences;
    }
    /**
     * 更新最近项目列表
     * @param projectPath 项目文件路径
     * @param projectName 项目名称
     */
    async updateRecentProjects(projectPath, projectName) {
        const prefs = this.cachedPreferences || await this.loadPreferences();
        // 移除已存在的相同路径记录
        const filtered = prefs.recentProjects.filter(p => p.path !== projectPath);
        // 添加到列表开头
        filtered.unshift({
            path: projectPath,
            name: projectName,
            lastOpened: new Date().toISOString(),
        });
        // 只保留最近 10 条
        prefs.recentProjects = filtered.slice(0, 10);
        prefs.lastProjectPath = projectPath;
        await this.savePreferences(prefs);
    }
    /**
     * 从最近项目列表移除指定项目
     */
    async removeFromRecentProjects(projectPath) {
        const prefs = this.cachedPreferences || await this.loadPreferences();
        prefs.recentProjects = prefs.recentProjects.filter(p => p.path !== projectPath);
        // 如果移除的是当前项目，清空 lastProjectPath
        if (prefs.lastProjectPath === projectPath) {
            prefs.lastProjectPath = null;
        }
        await this.savePreferences(prefs);
    }
    /**
     * 清空最近项目列表
     */
    async clearRecentProjects() {
        const prefs = this.cachedPreferences || await this.loadPreferences();
        prefs.recentProjects = [];
        await this.savePreferences(prefs);
    }
    /**
     * 确保项目目录存在
     */
    async ensureProjectsDirectoryExists() {
        const prefs = this.cachedPreferences || await this.loadPreferences();
        await ensureDirectoryExists(prefs.projectsDirectory);
        return prefs.projectsDirectory;
    }
}
// 导出单例实例
export const preferencesService = new PreferencesService();
