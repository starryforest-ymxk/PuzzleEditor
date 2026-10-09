import * as electron from '../platform/electron';
import type { IPCResult } from '../electron/types';

export interface ProjectSource {
  content: string;
  path: string | null;
}
export interface ProjectPlatform {
  isDesktop(): boolean;
  chooseOpen(): Promise<ProjectSource | null>;
  read(path: string): Promise<IPCResult<string>>;
  chooseSave(name: string): Promise<string | null>;
  write(
    path: string,
    content: string,
    options?: { exclusive?: boolean; expectedHash?: string },
  ): Promise<IPCResult>;
  chooseExport(defaultPath: string, name: string): Promise<string | null>;
  exportFile(path: string, content: string): Promise<IPCResult>;
  activate(path: string | null, name: string, token?: string): Promise<IPCResult>;
  claim?(
    path: string | null,
    expectedContent?: string,
    create?: boolean,
  ): Promise<IPCResult<string>>;
  releaseClaim?(token: string): Promise<IPCResult>;
  download(content: string, name: string): void;
}

export function downloadJSON(content: string, name: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // 给浏览器一次处理下载导航的机会，再释放对象 URL。
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function chooseBrowserFile(): Promise<ProjectSource | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.hidden = true;
    document.body.appendChild(input);
    input.addEventListener(
      'cancel',
      () => {
        input.remove();
        resolve(null);
      },
      { once: true },
    );
    input.addEventListener(
      'change',
      async () => {
        const file = input.files?.[0];
        input.remove();
        try {
          resolve(file ? { content: await file.text(), path: null } : null);
        } catch (error) {
          reject(error);
        }
      },
      { once: true },
    );
    input.click();
  });
}

export const projectPlatform: ProjectPlatform = {
  isDesktop: electron.isElectron,
  chooseOpen: async () => {
    if (!electron.isElectron()) return chooseBrowserFile();
    const selected = await electron.openFileDialog();
    if (!selected || selected.canceled || !selected.filePath) return null;
    const result = await electron.readProject(selected.filePath);
    if (!result.success || result.data === undefined)
      throw new Error(result.error || 'Failed to read project');
    return { content: result.data, path: selected.filePath };
  },
  read: electron.readProject,
  chooseSave: async (name) => {
    const result = await electron.saveFileDialog('', name, 'project');
    return result && !result.canceled ? (result.filePath ?? null) : null;
  },
  write: electron.writeProject,
  chooseExport: async (defaultPath, name) => {
    const result = await electron.saveFileDialog(defaultPath, name);
    return result && !result.canceled ? (result.filePath ?? null) : null;
  },
  exportFile: electron.exportProject,
  activate: electron.activateProject,
  claim: electron.claimProject,
  releaseClaim: electron.releaseProjectClaim,
  download: downloadJSON,
};
