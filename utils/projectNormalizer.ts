/**
 * 仅补齐已通过结构校验的项目辅助信息；封装识别与旧格式转换属于 projectImport。
 * 保留 ID、引用、顺序、参数值和有效坐标，不裁剪业务字段。
 */
import type { ProjectData } from '../types/project';
import type { PresentationBinding } from '../types/common';
import type { ImportContext } from './projectImport/readers';
import { normalizePresentationNode } from './presentation';

export function normalizeProjectForStore(project: ProjectData, context: ImportContext): ProjectData {
    const normalizeBinding = (binding: PresentationBinding | undefined, path: string): PresentationBinding | undefined => {
        if (!binding || binding.type !== 'Script') return binding;
        const used = new Set(binding.parameters.map(param => param.id).filter(Boolean));
        const parameters = binding.parameters.map((param, index) => {
            if (param.id && param.kind) return param;
            let id = param.id || 'import-param-' + (index + 1);
            while (!param.id && used.has(id)) id += '-copy';
            used.add(id);
            context.note(path + '.parameters[' + index + ']', 'Restored parameter editor identity/source kind without changing its value.');
            return { ...param, id, kind: param.kind || (param.tempVariable ? 'Temporary' as const : 'Variable' as const) };
        });
        return { ...binding, parameters };
    };
    const stageTree = { ...project.stageTree, stages: Object.fromEntries(Object.entries(project.stageTree.stages).map(([key, stage]) => [key, {
        ...stage,
        onEnterPresentation: normalizeBinding(stage.onEnterPresentation, 'stageTree.stages[' + key + '].onEnterPresentation'),
        onExitPresentation: normalizeBinding(stage.onExitPresentation, 'stageTree.stages[' + key + '].onExitPresentation')
    }])) };
    const stateMachines = Object.fromEntries(Object.entries(project.stateMachines).map(([key, fsm]) => [key, {
        ...fsm, transitions: Object.fromEntries(Object.entries(fsm.transitions).map(([id, transition]) => [id, {
            ...transition, presentation: normalizeBinding(transition.presentation, 'stateMachines[' + key + '].transitions[' + id + '].presentation')
        }]))
    }]));
    const presentationGraphs = Object.fromEntries(Object.entries(project.presentationGraphs).map(([key, graph]) => [key, {
        // 结构 Reader 已确认字段合法，此处与编辑 Reducer 共用规范形态，避免点击时新增 undefined 字段产生虚假修改。
        ...graph, nodes: Object.fromEntries(Object.entries(graph.nodes).map(([id, node]) => [id, normalizePresentationNode({
            ...node, presentation: normalizeBinding(node.presentation, 'presentationGraphs[' + key + '].nodes[' + id + '].presentation')
        })]))
    }]));
    return { ...project, stageTree, stateMachines, presentationGraphs };
}
