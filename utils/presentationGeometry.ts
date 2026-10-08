import type { Side, Vector2 } from '../types/common';
import type { PresentationGraph } from '../types/presentation';
import { parseVirtualEdgeId } from './graphAdapter';
import * as Geom from './geometry';

/** 渲染、吸附和剪线共用尺寸，85px 对齐 GraphNode 的实际最小高度。 */
export const PRESENTATION_NODE_DIMENSIONS = { width: 160, height: 85, minHeight: 85 };

export function presentationEdgeAnchors(
  from: Vector2,
  to: Vector2,
  sides: { fromSide?: Side; toSide?: Side },
) {
  const { width, height } = PRESENTATION_NODE_DIMENSIONS;
  const fromSide = sides.fromSide || Geom.getClosestSide(from, width, height, to);
  const toSide = sides.toSide || Geom.getClosestSide(to, width, height, from);
  return {
    start: Geom.getNodeAnchor(from, width, height, fromSide),
    end: Geom.getNodeAnchor(to, width, height, toSide),
  };
}

/** 新连接的预览与最终吸附使用同一锚点计算。 */
export function presentationLinkPath(source: Vector2, target: Vector2, targetSide?: Side): string {
  const { width, height } = PRESENTATION_NODE_DIMENSIONS;
  const fromSide = Geom.getClosestSide(source, width, height, target);
  const start = Geom.getNodeAnchor(source, width, height, fromSide);
  return Geom.getBezierPathData(
    start,
    target,
    fromSide,
    targetSide || Geom.getNaturalEnteringSide(start, target),
  );
}

/** 拖动一个端点时保持另一端的已有方向，缺失边/节点不渲染无效路径。 */
export function presentationModifiedPath(
  graph: PresentationGraph,
  edgeId: string,
  handle: 'source' | 'target',
  target: Vector2,
  targetSide: Side | undefined,
  getPosition: (id: string, fallback: Vector2) => Vector2,
): string | null {
  const parsed = parseVirtualEdgeId(edgeId);
  if (!parsed) return null;
  const from = graph.nodes[parsed.fromNodeId];
  const to = from && graph.nodes[from.nextIds[parsed.index]];
  if (!from || !to) return null;
  const props = graph.edgeProperties?.[`${from.id}->${to.id}`];
  const { width, height } = PRESENTATION_NODE_DIMENSIONS;
  if (handle === 'target') {
    const pos = getPosition(from.id, from.position);
    const fromSide = props?.fromSide || Geom.getClosestSide(pos, width, height, target);
    const start = Geom.getNodeAnchor(pos, width, height, fromSide);
    return Geom.getBezierPathData(
      start,
      target,
      fromSide,
      targetSide || Geom.getNaturalEnteringSide(start, target),
    );
  }
  const pos = getPosition(to.id, to.position);
  const toSide = props?.toSide || Geom.getClosestSide(pos, width, height, target);
  const end = Geom.getNodeAnchor(pos, width, height, toSide);
  const fromSide =
    targetSide ||
    Geom.getClosestSide({ x: target.x - width / 2, y: target.y - height / 2 }, width, height, end);
  return Geom.getBezierPathData(target, end, fromSide, toSide);
}
