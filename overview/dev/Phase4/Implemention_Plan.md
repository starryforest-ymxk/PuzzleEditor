# Electron 框架重构实现计划

## 目标

将当前的纯 Web 应用重构为 Electron 桌面应用，实现：

- 本地文件系统直接读写
- 用户偏好持久化
- 项目文件管理（保存/加载/最近列表）
- Header UI 重构（Preference / Project / Messages）

------

## 用户确认的决策

| 决策项          | 选择                                              |
| :-------------- | :------------------------------------------------ |
| 技术路线        | Electron 桌面应用                                 |
| Electron 初始化 | 需要完成                                          |
| 最近项目列表    | 需要（文件不存在时提醒并移除）                    |
| 新建项目命名    | 弹窗输入，名称为空时阻止创建                      |
| 保存冲突检测    | 不需要，直接覆写                                  |
| 导出文件名      | 可在项目元数据中配置，默认 `<项目名>_export.json` |

------

## 阶段划分

### Phase 1: Electron 项目初始化

**目标**：在现有 React 项目基础上集成 Electron

#### 1.1 安装依赖

```
npm install --save-dev electron electron-builder concurrently wait-on
```

#### 1.2 创建 Electron 主进程文件

```
electron/

├── main.ts           # 主进程入口

├── preload.ts        # 预加载脚本（安全暴露 API）

├── ipc/

│   ├── handlers.ts   # IPC 事件处理器注册

│   ├── fileService.ts    # 文件操作服务

│   └── preferencesService.ts  # 偏好管理服务

└── types.ts          # 主进程类型定义
```

#### 1.3 修改 package.json

- 添加 `"main": "electron/main.js"`
- 添加开发脚本：`electron:dev`、`electron:build`
- 配置 electron-builder

#### 1.4 修改 Vite 配置

- 调整 `base` 路径为相对路径
- 配置正确的输出目录

------

### Phase 2: 主进程服务实现

#### 2.1 偏好管理服务 (`preferencesService.ts`)

```
// 功能列表

- loadPreferences(): UserPreferences

- savePreferences(prefs: UserPreferences): void

- getDefaultPreferences(): UserPreferences

- ensureDirectoryExists(path: string): void



// 默认偏好

{

  projectsDirectory: 'C:/Users/<User>/Documents/StarryTree/PuzzleEditor/Projects/',

  exportDirectory: '',  // 空则使用 projectsDirectory

  restoreLastProject: true,

  lastProjectPath: null,

  recentProjects: []

}
```

#### 2.2 文件操作服务 (`fileService.ts`)

```
// 功能列表

- readProjectFile(path: string): ProjectFile

- writeProjectFile(path: string, data: ProjectFile): void

- writeExportFile(path: string, data: ExportBundle): void

- showOpenDialog(): string | null

- showSaveDialog(defaultName: string): string | null

- fileExists(path: string): boolean

- createDirectory(path: string): void
```

#### 2.3 IPC 通道定义

| 通道名             | 方向            | 用途               |
| :----------------- | :-------------- | :----------------- |
| `preferences:load` | Main → Renderer | 加载偏好           |
| `preferences:save` | Renderer → Main | 保存偏好           |
| `project:read`     | Renderer → Main | 读取项目文件       |
| `project:write`    | Renderer → Main | 写入项目文件       |
| `project:export`   | Renderer → Main | 导出运行时数据     |
| `project:create`   | Renderer → Main | 创建新项目文件     |
| `dialog:open-file` | Renderer → Main | 打开文件选择对话框 |
| `file:exists`      | Renderer → Main | 检查文件是否存在   |

------

### Phase 3: 渲染进程适配

#### 3.1 创建 Electron API 桥接层

```
src/

├── electron/

│   ├── api.ts        # 封装 IPC 调用

│   ├── types.ts      # 共享类型

│   └── useElectronAPI.ts  # React Hook
```

#### 3.2 类型扩展

```
// types/project.ts 扩展

interface ProjectMeta {

  // ... 现有字段

  exportFileName?: string;  // 新增：自定义导出文件名

}



// 新增：运行时状态

interface RuntimeState {

  currentProjectPath: string | null;

  isNewUnsavedProject: boolean;

}
```

#### 3.3 Store 扩展

```
// 新增到 EditorState

interface EditorState {

  // ... 现有字段

  runtime: {

    currentProjectPath: string | null;

    preferencesLoaded: boolean;

  };

  preferences: UserPreferences;

}



// 新增 Actions

type Action = 

  // ... 现有

  | { type: 'SET_CURRENT_PROJECT_PATH'; payload: string | null }

  | { type: 'LOAD_PREFERENCES'; payload: UserPreferences }

  | { type: 'UPDATE_PREFERENCES'; payload: Partial<UserPreferences> };
```

------

### Phase 4: Header UI 重构

#### 4.1 新的 Header 布局

```
┌─────────────────────────────────────────────────────────────────┐

│ [Logo]  │ PROJECT_NAME v1.0 * │ [EDITOR|BLACKBOARD] │ [Preference] [Project ▼] [Messages] │

└─────────────────────────────────────────────────────────────────┘
```

#### 4.2 Preference 面板

```
interface PreferencePanelProps {

  preferences: UserPreferences;

  onSave: (prefs: UserPreferences) => void;

  onClose: () => void;

}



// 可配置项

- 新项目存储路径（带目录选择按钮）

- 默认导出路径（带目录选择按钮）

- 启动时恢复上次项目（开关）
```

#### 4.3 Project 下拉菜单

```
// 菜单项

- New Project          → 打开新建弹窗

- Open Project...      → 打开文件选择器

- Open Recent         → 展开最近项目列表

  ├── Project A (路径)

  ├── Project B (路径)

  └── Clear Recent

- ────────────────────

- Edit Metadata...     → 打开元数据编辑弹窗

- ────────────────────

- Export               → 导出到默认路径
```

#### 4.4 需要重构/删除的现有组件

| 组件                    | 操作                           |
| :---------------------- | :----------------------------- |
| NewProjectDialog        | 保留，无需修改                 |
| ProjectSettingsDialog   | 修改：添加导出文件名字段       |
| ConfirmSaveDialog       | 保留                           |
| HeaderDialogManager     | 修改：添加 Preference 弹窗     |
| GlobalKeyboardShortcuts | 修改：Ctrl+S 调用 IPC 而非下载 |

------

### Phase 5: 工作流程实现

#### 5.1 应用启动流程

```
1. Main Process 启动

2. 加载 preferences.json

3. 创建 BrowserWindow

4. Renderer 启动后请求偏好

5. 如果 restoreLastProject && lastProjectPath 存在

   → 自动加载上次项目
```

#### 5.2 新建项目流程

```
1. 用户点击 New Project

2. 弹窗输入项目名称

3. （如名称为空，显示错误提示，阻止创建）

4. 调用 IPC `project:create`

5. Main Process 在 projectsDirectory 创建文件

6. 返回新项目路径

7. Renderer 设置 currentProjectPath

8. 更新 recentProjects
```

#### 5.3 保存项目流程 (Ctrl+S)

```
1. 检查 currentProjectPath 是否存在

2. 构建 ProjectFile 对象

3. 调用 IPC `project:write`

4. Main Process 直接覆写文件

5. 清除 isDirty 标记

6. 推送成功消息
```

#### 5.4 加载项目流程

```
1. 调用 IPC `dialog:open-file`

2. 用户选择文件

3. 调用 IPC `project:read`

4. 归一化数据并加载到 Store

5. 设置 currentProjectPath

6. 更新 recentProjects
```

#### 5.5 加载最近项目流程

```
1. 用户从列表选择项目

2. 调用 IPC `file:exists` 检查文件

3. 如果不存在：

   - 显示错误消息

   - 从 recentProjects 移除该条目

   - 保存偏好

4. 如果存在：

   - 同正常加载流程
```

#### 5.6 导出流程

```
1. 获取导出文件名（meta.exportFileName 或默认值）

2. 获取导出目录（preferences.exportDirectory 或 projectsDirectory）

3. 构建 ExportBundle 对象

4. 调用 IPC `project:export`

5. 推送成功消息（含导出路径）
```

------

## 文件变更清单

### 新增文件

| 路径                                       | 说明                |
| :----------------------------------------- | :------------------ |
| `electron/main.ts`                         | Electron 主进程入口 |
| `electron/preload.ts`                      | 预加载脚本          |
| `electron/ipc/handlers.ts`                 | IPC 处理器注册      |
| `electron/ipc/fileService.ts`              | 文件操作服务        |
| `electron/ipc/preferencesService.ts`       | 偏好管理服务        |
| `src/electron/api.ts`                      | 渲染进程 API 封装   |
| `src/electron/useElectronAPI.ts`           | React Hook          |
| `components/Layout/PreferencePanel.tsx`    | 偏好设置面板        |
| `components/Layout/ProjectMenu.tsx`        | Project 下拉菜单    |
| `components/Layout/RecentProjectsList.tsx` | 最近项目列表        |

### 修改文件

| 路径                                          | 变更                                 |
| :-------------------------------------------- | :----------------------------------- |
| `package.json`                                | 添加 Electron 依赖和脚本             |
| `vite.config.ts`                              | 调整构建配置                         |
| types/project.ts                              | 添加 `exportFileName` 字段           |
| store/types.ts                                | 添加 `runtime` 和 `preferences` 状态 |
| store/reducer.ts                              | 添加新 Actions 处理                  |
| components/Layout/Header.tsx                  | 重构 UI 布局                         |
| components/Layout/ProjectSettingsDialog.tsx   | 添加导出文件名配置                   |
| components/Layout/GlobalKeyboardShortcuts.tsx | 修改保存逻辑                         |

------

## 验证计划

### 自动化测试

- 暂无（现有项目无单元测试）

### 手动测试清单

| 测试场景             | 预期结果                   |
| :------------------- | :------------------------- |
| 首次启动             | 创建默认偏好文件和项目目录 |
| 新建项目（空名称）   | 显示错误提示，阻止创建     |
| 新建项目（有效名称） | 创建 .puzzle.json 文件     |
| Ctrl+S 保存          | 覆写当前项目文件（无弹窗） |
| 打开项目             | 显示文件选择器，加载项目   |
| 最近项目（存在）     | 直接加载                   |
| 最近项目（不存在）   | 显示错误，移除条目         |
| 修改偏好             | 重启后保留                 |
| 导出项目             | 导出到配置的目录           |
| 关闭应用             | 记住当前项目路径           |
| 重启应用             | 自动恢复上次项目           |

------

## 风险与注意事项

WARNING

**破坏性变更**：现有的"下载保存"方式将被替换为本地文件直接写入。

IMPORTANT

**开发环境**：Electron 开发模式需要同时运行 Vite dev server 和 Electron 主进程。

NOTE

**跨平台路径**：使用 `path.join` 和 `app.getPath` 处理路径，确保 Windows/macOS/Linux 兼容。