/**
 * The threads between the chart's cards (proposal 2): each card and each faint star is held at home by a spring, and
 * the constellations' threads are springs too, at their resting length. A card that shows grows and moves toward the
 * middle: it pushes the cards it meets aside (their boxes may not overlap), and every card that moves pulls on its
 * threads, so that its stars and its neighbours follow a little. Plain physics, a few substeps a frame.
 */

export interface WebNode {
  /** Home, and where it is (design px from the vanishing point), its speed (px/s). */
  hx: number;
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Half its box (a card), or 0 (a star), and how far its box reaches further down (the cartel of the card shown). */
  hw: number;
  hh: number;
  below: number;
  /** Where it wants to be: home, or nearer the middle when its card shows. */
  tx: number;
  ty: number;
  mass: number;
}

export interface WebEdge {
  a: number;
  b: number;
  rest: number;
}

const HOME_CARD = 26;
const HOME_STAR = 7;
const THREAD = 16;
const PUSH = 520;
const DAMPING = 7.5;
/** The room kept between two cards, and around a star. */
const MARGIN = 26;
const STAR_ROOM = 14;
const SUBSTEP = 1 / 120;

export function webEdges(nodes: readonly WebNode[], pairs: readonly [number, number][]): WebEdge[] {
  return pairs.flatMap(([a, b]) => {
    const na = nodes[a];
    const nb = nodes[b];
    if (!na || !nb || a === b) return [];
    return [{ a, b, rest: Math.hypot(nb.hx - na.hx, nb.hy - na.hy) }];
  });
}

/** Moves the web on by `dt` seconds; true while it still moves. */
export function stepWeb(nodes: WebNode[], edges: readonly WebEdge[], dt: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.min(dt, 0.1) / SUBSTEP));
  const h = Math.min(dt, 0.1) / steps;
  const fx = new Float64Array(nodes.length);
  const fy = new Float64Array(nodes.length);
  let moving = false;
  for (let s = 0; s < steps; s += 1) {
    fx.fill(0);
    fy.fill(0);
    nodes.forEach((node, i) => {
      const k = node.hw > 0 ? HOME_CARD : HOME_STAR;
      fx[i] = (fx[i] ?? 0) + k * (node.tx - node.x) * node.mass;
      fy[i] = (fy[i] ?? 0) + k * (node.ty - node.y) * node.mass;
    });
    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      const f = (THREAD * (length - edge.rest)) / length;
      fx[edge.a] = (fx[edge.a] ?? 0) + f * dx;
      fy[edge.a] = (fy[edge.a] ?? 0) + f * dy;
      fx[edge.b] = (fx[edge.b] ?? 0) - f * dx;
      fy[edge.b] = (fy[edge.b] ?? 0) - f * dy;
    }
    // Boxes push each other apart, along the axis where they overlap the least; stars are pushed out of the cards.
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (!a) continue;
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        if (!b || (a.hw === 0 && b.hw === 0)) continue;
        const room = a.hw > 0 && b.hw > 0 ? MARGIN : STAR_ROOM;
        const dx = b.x - a.x;
        const dy = b.y + b.below / 2 - (a.y + a.below / 2);
        const ox = a.hw + b.hw + room - Math.abs(dx);
        const oy = a.hh + b.hh + (a.below + b.below) / 2 + room - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) {
          const f = PUSH * ox * (dx < 0 ? -1 : 1);
          fx[i] = (fx[i] ?? 0) - f;
          fx[j] = (fx[j] ?? 0) + f;
        } else {
          const f = PUSH * oy * (dy < 0 ? -1 : 1);
          fy[i] = (fy[i] ?? 0) - f;
          fy[j] = (fy[j] ?? 0) + f;
        }
      }
    }
    const damp = Math.exp(-DAMPING * h);
    nodes.forEach((node, i) => {
      node.vx = (node.vx + ((fx[i] ?? 0) / node.mass) * h) * damp;
      node.vy = (node.vy + ((fy[i] ?? 0) / node.mass) * h) * damp;
      node.x += node.vx * h;
      node.y += node.vy * h;
    });
  }
  for (const node of nodes) {
    if (Math.abs(node.vx) + Math.abs(node.vy) > 0.5 || Math.hypot(node.tx - node.x, node.ty - node.y) > 0.5) {
      moving = true;
      break;
    }
  }
  return moving;
}
