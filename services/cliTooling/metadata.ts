/** 版本来自实际构建元数据和共同协议，配套模块不再维护第二套版本号。 */
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { API_VERSION } from '../../contracts/automation/readSchemas';
import { POLICY_VERSION } from '../../contracts/automation/permissions';
import { IMPORT_CONVERTER_VERSION } from '../../contracts/automation/importSchemas';
import { SESSION_PROTOCOL } from '../../dist-node/sessionTransport.js';
export async function versionInfo(phase: string) {
  const metadata: unknown = JSON.parse(
    await fs.readFile(path.join(path.dirname(process.argv[1]), 'package.json'), 'utf8'),
  );
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('version' in metadata) ||
    typeof metadata.version !== 'string'
  )
    throw new Error('CLI build metadata is missing.');
  return {
    productVersion: metadata.version,
    phase,
    apiVersion: API_VERSION,
    policyVersion: POLICY_VERSION,
    onlineProtocol: SESSION_PROTOCOL,
    converterVersion: IMPORT_CONVERTER_VERSION,
    nodeVersion: process.version,
    executable: process.execPath,
    cliEntry: path.resolve(process.argv[1]),
  };
}
