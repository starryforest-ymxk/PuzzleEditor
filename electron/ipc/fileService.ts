/**
 * 文件操作服务
 * 负责项目文件的读写、创建和导出
 */

import * as fs from 'fs';
import * as path from 'path';
import { readUtf8File, writeUtf8File } from '../../dist-node/files.js';
import { CreateProjectParams, CreateProjectResult } from '../types.js';
import { preferencesService } from './preferencesService.js';

/**
 * 文件操作服务类
 */
class FileService {
  /**
   * 读取文件内容
   * @param filePath 文件路径
   */
  async readFile(filePath: string): Promise<string> {
    return readUtf8File(filePath);
  }

  /**
   * 写入文件内容
   * @param filePath 文件路径
   * @param content 文件内容
   */
  async writeFile(
    filePath: string,
    content: string,
    options?: { exclusive?: boolean },
  ): Promise<void> {
    // 与离线 CLI 共用 IO；桌面专有偏好仍由当前服务协调。
    await writeUtf8File(filePath, content, options);
  }

  /**
   * 检查文件是否存在
   * @param filePath 文件路径
   */
  fileExists(filePath: string): boolean {
    try {
      fs.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 异步检查文件是否存在
   * @param filePath 文件路径
   */
  async fileExistsAsync(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建新项目
   * @param params 项目创建参数
   */
  async createProject(params: CreateProjectParams): Promise<CreateProjectResult> {
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
    await this.writeFile(projectPath, content, { exclusive: true });

    // 更新最近项目列表
    await preferencesService.updateRecentProjects(projectPath, name);

    console.log('New project created:', projectPath);

    return { path: projectPath };
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取导出文件路径
   * @param projectName 项目名称
   * @param exportFileName 自定义导出文件名 (可选)
   */
  async getExportPath(projectName: string, exportFileName?: string): Promise<string> {
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
