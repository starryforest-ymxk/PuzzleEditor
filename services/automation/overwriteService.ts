/** 服务层只冻结覆盖前提；实际锁、备份、记录与替换由共用 Node 文件层负责。 */
import {
  ownershipSupported,
  ProjectFileError,
  readProjectSnapshot,
} from '../../dist-node/projectOwnership.js';
import type { OverwriteExpectation } from '../../dist-node/projectOverwrite.js';
import { AutomationFailure } from './errors';

export async function describeOverwrite(path: string, hash: string): Promise<OverwriteExpectation> {
  if (!ownershipSupported)
    throw new ProjectFileError(
      'OWNERSHIP_UNSUPPORTED',
      'In-place editing is currently supported on Windows only.',
      null,
      5,
    );
  if (!path.toLowerCase().endsWith('.puzzle.json'))
    throw new AutomationFailure(
      'INVALID_OUTPUT_EXTENSION',
      'In-place editing requires a .puzzle.json source.',
      2,
    );
  const snapshot = await readProjectSnapshot(path);
  if (snapshot.sha256 !== hash)
    throw new AutomationFailure(
      'REVISION_CONFLICT',
      'The source changed while preparing overwrite.',
      4,
    );
  return {
    mode: 'overwrite-source',
    path: snapshot.path,
    sha256: snapshot.sha256,
    identity: snapshot.identity,
  };
}
export function assertOverwriteMode(inPlace: boolean | undefined, overwrite: boolean) {
  if (Boolean(inPlace) !== overwrite)
    throw new AutomationFailure(
      'RECEIPT_CONFLICT',
      'The receipt mode differs from the requested output mode.',
      4,
    );
}
