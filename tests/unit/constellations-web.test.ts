import { describe, expect, it } from 'vitest';
import { stepWeb, webEdges, type WebNode } from '../../src/scene/constellations/web';

const card = (x: number, y: number, half: number): WebNode => ({
  hx: x,
  hy: y,
  x,
  y,
  vx: 0,
  vy: 0,
  hw: half,
  hh: (half * 9) / 16,
  below: 0,
  tx: x,
  ty: y,
  mass: 1,
});

const star = (x: number, y: number): WebNode => ({ ...card(x, y, 0), hh: 0 });

/** Runs the web for `seconds`, at 60 frames a second; true if it still moves at the end. */
function run(nodes: WebNode[], edges: ReturnType<typeof webEdges>, seconds: number): boolean {
  let moving = true;
  for (let t = 0; t < seconds; t += 1 / 60) moving = stepWeb(nodes, edges, 1 / 60);
  return moving;
}

describe('the chart’s threads', () => {
  it('rest where they are when nothing pulls on them', () => {
    const nodes = [card(-300, 0, 90), card(0, 0, 90), star(200, 120)];
    const edges = webEdges(nodes, [
      [0, 1],
      [1, 2],
    ]);
    expect(run(nodes, edges, 0.5)).toBe(false);
    expect(nodes[1]?.x).toBeCloseTo(0, 3);
  });

  it('push a card aside when its neighbour grows', () => {
    const nodes = [card(-200, 0, 80), card(0, 0, 80)];
    const edges = webEdges(nodes, [[0, 1]]);
    const grown = nodes[0];
    if (!grown) throw new Error('no card');
    grown.hw = 170;
    grown.hh = (170 * 9) / 16;
    grown.mass = 6;
    run(nodes, edges, 3);
    const other = nodes[1];
    // The other card no longer overlaps the grown one: it was pushed right.
    expect(other?.x).toBeGreaterThan(-200 + 170 + 80 - 1);
  });

  it('pull a card’s neighbours along its threads, and bring them home once it lets go', () => {
    const nodes = [card(-300, 0, 80), star(-100, -150)];
    const edges = webEdges(nodes, [[0, 1]]);
    const moved = nodes[0];
    const neighbour = nodes[1];
    if (!moved || !neighbour) throw new Error('no node');
    moved.tx = -150;
    moved.mass = 6;
    run(nodes, edges, 3);
    expect(neighbour.x).toBeGreaterThan(-100 + 20);
    moved.tx = -300;
    moved.mass = 1;
    expect(run(nodes, edges, 6)).toBe(false);
    expect(neighbour.x).toBeCloseTo(-100, 0);
    expect(neighbour.y).toBeCloseTo(-150, 0);
  });
});
