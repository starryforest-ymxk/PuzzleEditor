import type { Selection } from '../../store/types';
import type { useBlackboardData } from '../../hooks/useBlackboardData';
import type { useBlackboardActions } from '../../hooks/useBlackboardActions';
/** 各页签只接收显示模型、选择和资源意图，菜单状态不进入此契约。 */
export interface BlackboardTabProps {
  data: ReturnType<typeof useBlackboardData>;
  actions: ReturnType<typeof useBlackboardActions>;
  selection: Selection;
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
}
