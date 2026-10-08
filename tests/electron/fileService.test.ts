import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileService } from '../../electron/ipc/fileService';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }));
let directory: string;
beforeEach(async () => { directory = await fs.promises.mkdtemp(join(tmpdir(), 'puzzle-batch2-files-')); });
afterEach(async () => {
    vi.restoreAllMocks();
    // 仅清理本用例 mkdtemp 创建的目录。
    await fs.promises.rm(directory, { recursive: true, force: true });
});

describe('真实临时文件写入', () => {
    it('排他新建、完整覆盖、重读均保留 UTF-8 内容且无残余临时文件', async () => {
        const path = join(directory, 'test.puzzle.json');
        await fileService.writeFile(path, '{"name":"初始"}', { exclusive: true });
        await fileService.writeFile(path, '{"name":"已编辑"}');
        expect(await fileService.readFile(path)).toBe('{"name":"已编辑"}');
        expect(await fs.promises.readdir(directory)).toEqual(['test.puzzle.json']);
    });
    it('同名新建失败，原文件内容完整保留', async () => {
        const path = join(directory, 'existing.puzzle.json');
        await fileService.writeFile(path, 'original');
        await expect(fileService.writeFile(path, 'replacement', { exclusive: true })).rejects.toMatchObject({ code: 'EEXIST' });
        expect(await fileService.readFile(path)).toBe('original');
        expect(await fs.promises.readdir(directory)).toEqual(['existing.puzzle.json']);
    });
    it('替换失败不会截断原文件，后续请求仍可成功', async () => {
        const path = join(directory, 'locked.puzzle.json');
        await fileService.writeFile(path, 'original');
        const rename = vi.spyOn(fs.promises, 'rename').mockRejectedValueOnce(new Error('Simulated permission failure'));
        await expect(fileService.writeFile(path, 'replacement')).rejects.toThrow('permission');
        expect(await fileService.readFile(path)).toBe('original');
        rename.mockRestore();
        await fileService.writeFile(path, 'retry');
        expect(await fileService.readFile(path)).toBe('retry');
        expect(await fs.promises.readdir(directory)).toEqual(['locked.puzzle.json']);
    });
});
