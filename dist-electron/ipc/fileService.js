/**
 * 文件操作服务
 * 负责项目文件的读写、创建和导出
 */
import * as fs from 'fs';
import * as path from 'path';
import { preferencesService } from './preferencesService.js';
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
 * 文件操作服务类
 */
class FileService {
    /**
     * 读取文件内容
     * @param filePath 文件路径
     */
    async readFile(filePath) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return content;
    }
    /**
     * 写入文件内容
     * @param filePath 文件路径
     * @param content 文件内容
     */
    async writeFile(filePath, content) {
        const dir = path.dirname(filePath);
        await ensureDirectoryExists(dir);
        await fs.promises.writeFile(filePath, content, 'utf-8');
        console.log('File written to:', filePath);
    }
    /**
     * 检查文件是否存在
     * @param filePath 文件路径
     */
    fileExists(filePath) {
        try {
            fs.accessSync(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 异步检查文件是否存在
     * @param filePath 文件路径
     */
    async fileExistsAsync(filePath) {
        try {
            await fs.promises.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 创建新项目
     * @param params 项目创建参数
     */
    async createProject(params) {
        const { name, description } = params;
        // 获取项目目录
        const projectsDir = await preferencesService.ensureProjectsDirectoryExists();
        // 构建项目文件路径
        const projectFileName = `${name}.puzzle.json`;
        const projectPath = path.join(projectsDir, projectFileName);
        // 检查文件是否已存在
        if (await this.fileExistsAsync(projectPath)) {
            throw new Error(`Project "${name}" already exists at ${projectPath}`);
        }
        // 创建空项目结构
        const now = new Date().toISOString();
        const projectData = {
            meta: {
                id: this.generateId(),
                name: name,
                description: description || '',
                version: '1.0.0',
                createdAt: now,
                updatedAt: now,
                exportFileName: `${name}_export.json`,
            },
            blackboard: {
                variables: [],
                scripts: [],
                events: [],
            },
            stageTree: {
                root: {
                    id: this.generateId(),
                    name: 'Root',
                    description: '',
                    children: [],
                    puzzleNodes: [],
                    localVariables: [],
                    lifecycleScripts: {},
                    unlockCondition: null,
                    performances: [],
                    eventListeners: [],
                },
            },
            ui: {
                expandedNodes: [],
                selectedPath: null,
                canvasStates: {},
            },
        };
        // 写入项目文件
        const content = JSON.stringify(projectData, null, 2);
        await this.writeFile(projectPath, content);
        // 更新最近项目列表
        await preferencesService.updateRecentProjects(projectPath, name);
        console.log('New project created:', projectPath);
        return { path: projectPath };
    }
    /**
     * 生成唯一 ID
     */
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    /**
     * 获取导出文件路径
     * @param projectName 项目名称
     * @param exportFileName 自定义导出文件名 (可选)
     */
    async getExportPath(projectName, exportFileName) {
        const prefs = await preferencesService.loadPreferences();
        // 使用导出目录或项目目录
        const exportDir = prefs.exportDirectory || prefs.projectsDirectory;
        // 使用自定义文件名或默认文件名
        const fileName = exportFileName || `${projectName}_export.json`;
        return path.join(exportDir, fileName);
    }
}
// 导出单例实例
export const fileService = new FileService();
