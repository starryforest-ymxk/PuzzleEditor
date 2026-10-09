/** 配套命令只调用工具层，不加载 GUI，不推断业务工程或授予持久权限。 */
import { setup } from './installation';
import { versionInfo } from './metadata';
import { configuration, configLocation, type ConfigOptions } from './configuration';
import { skills, type SkillOptions } from './skills';
import { doctor, type DoctorOptions } from './doctor';
export async function runToolingCommand(operation: string, input: unknown, phase: string) {
  if (operation === 'version') return versionInfo(phase);
  if (operation === 'doctor') return doctor(input as DoctorOptions, phase);
  if (operation === 'config path') return configLocation(input as ConfigOptions);
  if (operation === 'config show') return configuration(input as ConfigOptions, phase);
  if (operation.startsWith('skills ')) return skills(operation, input as SkillOptions, phase);
  return setup(operation, input as Parameters<typeof setup>[1]);
}
