/**
 * API 服务导出
 * 提供统一的 API 服务访问点
 */

import { IApiService, ManifestData, ExportManifest } from './types';
import { MockApiService } from './mockService';

// 导出类型定义
export type { IApiService, ManifestData, ExportManifest };

// 创建并导出默认的 API 服务实例
// 未来可以通过环境变量或配置切换到真实的 HTTP 服务
export const apiService: IApiService = new MockApiService();
