# P4-T03 PuzzleNode Inspector �༭���

## ����Ŀ����Լ��
- ���� PuzzleNode Inspector �Ļ����༭������֧��ɾ���ڵ㣨��ڵ㳡������ȷ�ϣ����༭ Name �� Description��
- ���������������ڽű��󶨡��¼������������޸����õı༭���������� UI �İ�ΪӢ�ġ�
- ɾ������������ʵ�ֵ�ȷ�ϵ����������ѭ����ڵ�ʱ��ʾ�����ڵ��ֱ��ɾ��������
- ��Ҫ���뱣������ע�ͣ���ѭ���� Inspector UI ��ʽ����д�� `readOnly` ���ơ�

## ��� UX Flow ժҪ
- �ο� UX_Flow 4.4��PuzzleNode ѡ�� Inspector����Header չʾ���ͱ�ǩ�����ƣ�Basic Info չʾ ID/Type/Description��Lifecycle Script ����ѡ��Event Listeners �б���Local Variables ������
- �����ڵ㿨Ƭ�� Inspector ���£�������ʾ�İ�ʹ��Ӣ�ġ�

## �������
- **������Դ�붯��**��
  - ʹ�� `project.nodes[nodeId]` ��Ϊ��������Դ������ͨ�� `UPDATE_NODE` action��`name`��`description`��`lifecycleScriptId`��`eventListeners` �ȣ���
  - ɾ���ڵ��ɷ� `DELETE_PUZZLE_NODE`��Reducer �Ѹ����������� FSM �Լ� UI ѡ��̬���ˡ�
- **�ɼ������ռ�**������ `collectVisibleVariables` ���� Scope��Stage + Node�������˵� `MarkedForDelete`��
- **UI/����**��
  1) **Header + Delete**��ʹ���� Stage Inspector ��ͬ�� header ��ʽ�� `Trash2` ͼ�갴ť��`readOnly` ʱ����ɾ����ť��
     - ͳ�Ƶ�ǰ Stage �µ� PuzzleNode ������`getStageNodeIds`�������� > 1 ʱ���ɾ������ ConfirmDialog����ʾ�ڵ����� Stage ����ʾ������ = 1 ʱֱ��ɾ����
  2) **Basic Info**��
     - ID ֻ����Type ֻ����Name/Description ʹ�� `search-input` ��ʽ����ؼ����ɱ༭��`readOnly` ʱ����Ϊ���ı���
  3) **Lifecycle Script**������ ResourceSelect������ warn-on-marked-delete �߼�������ա�
  4) **Event Listeners**������ `EventListenersEditor`��ָ�� `UPDATE_NODE` �����
  5) **Local Variables**������ʹ�� `LocalVariableEditor`����д������ `readOnly` ���ơ�
- **�İ��������**��������ռλ����ȫ��ʹ��Ӣ�ģ�ɾ��ȷ���г� stage �ڽڵ�������ʾ���ɳ�����

## �����������ƻ���
1) �༭ Name/Description��������л�ѡ���ٷ��أ��ı����ָ��¡�
2) ɾ�����е����ڵ�� Stage�����ɾ��ֱ���Ƴ��ڵ㲢����ѡ������ Stage��
3) Stage �´��ڶ���ڵ㣺���ɾ���������֣�ȷ�Ϻ�ڵ��� FSM ���Ƴ���ȡ�������޸����ݡ�
4) Lifecycle Script ѡ��/��գ�ѡ��һ���״̬���£���հ�ť���������ɾ���Ľű���ʾ���档
5) readOnly ģʽ�������ɾ����ť���ɲ�����Event/Variable ������á�

## ʵʩ״̬
- �Ѱ��������� NodeInspector������ Name/Description �༭������ɾ����ť���ڵ�ȷ�ϵ����������������ڽű�/�¼�����/�ֲ������༭������ͳһ Inspector ��ʽ��
- �Ƴ� PuzzleNode Type �ֶΣ������� Inspector Basic Info ������չʾ/ʹ�á�
- Nodes ����Ҽ�ɾ���������� Reference Preview��Stage ���ơ�ͬ���ڵ���������� Inspector ɾ����Ϊ����һ�¡�
- ���ԣ�����δ�����������֤������ʵ��ҳ�����ֶ���֤��ɾ��ȷ�ϡ����ֶα༭����readOnly�����õȳ�����

---

## 2026-02-19 Node 删除流程统一补充

### 本次目标
- 将 PuzzleNode 删除入口统一到同一条业务流程，避免 Explorer / StageOverview / Inspector / 快捷键出现确认弹窗样式或行为分叉。

### 技术实现
- Explorer 右键删除改为调用 `useDeleteHandler.deleteNode`，移除组件内本地 `deleteConfirm` 状态与本地 `ConfirmDialog`。
- StageOverview 右键删除中，`NODE` 分支改为调用 `useDeleteHandler.deleteNode`；保留 `STAGE` 分支原有本地确认逻辑。
- NodeInspector 删除按钮改为调用 `useDeleteHandler.deleteNode`，移除组件内本地 `deleteConfirm` 与本地 `ConfirmDialog`。
- 快捷键删除本来已通过 `useDeleteHandler.deleteSelection -> deleteNode` 进入统一流程，本次无需改动。

### 统一后的行为
- 四个入口（Explorer 右键 / 主面板右键 / Inspector 按钮 / Delete 快捷键）均通过 `useDeleteHandler.deleteNode` 触发 `SET_CONFIRM_DIALOG`。
- 确认弹窗统一由 `GlobalConfirmDialog` 渲染和提交 `DELETE_PUZZLE_NODE`。
- 最终删除仍由 `projectSlice` 的 `DELETE_PUZZLE_NODE` 分支统一执行（同时清理关联 FSM 与 UI 选中态）。

### 验证结果
- 已对以下文件执行静态错误检查，均无新增错误：
  - `components/Explorer/NodeExplorer.tsx`
  - `components/Canvas/StageOverview.tsx`
  - `components/Inspector/NodeInspector.tsx`