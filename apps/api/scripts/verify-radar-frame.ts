/**
 * Headless verification of the radar frame painter.
 *
 * The canvas is stubbed with a recording context, so every drawing call is
 * checked for non-finite arguments, and the km → pixel mapping is validated for
 * the grid sizes / radii / range scales the UI can produce.
 *
 *   tsx scripts/verify-radar-frame.ts
 */
import { drawRadarFrame, type RadarFrame, type RadarNode } from '../../web/src/components/RadarCanvas.js';

interface Call {
  method: string;
  args: number[];
}

function createMockContext(calls: Call[]): CanvasRenderingContext2D {
  const gradient = { addColorStop: (_o: number, _c: string) => {} };
  const handler: ProxyHandler<any> = {
    get(_target, prop: string) {
      if (prop === 'canvas') return { width: 0, height: 0 };
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
        return (...args: number[]) => {
          calls.push({ method: prop, args });
          return gradient;
        };
      }
      if (prop === 'measureText') return () => ({ width: 10 });
      return (...args: unknown[]) => {
        const nums = args.filter((a): a is number => typeof a === 'number');
        calls.push({ method: prop, args: nums });
      };
    },
    set() {
      return true;
    },
  };
  return new Proxy({}, handler) as CanvasRenderingContext2D;
}

function buildNodes(gridSize: 3 | 5, radiusKm: number): RadarNode[] {
  const half = Math.floor(gridSize / 2);
  const stepKm = radiusKm / Math.max(1, half);
  const nodes: RadarNode[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const dxKm = (c - half) * stepKm;
      const dyKm = (half - r) * stepKm;
      const bearings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const bearingDeg = ((Math.atan2(dxKm, dyKm) * 180) / Math.PI + 360) % 360;
      nodes.push({
        id: `n-${r}-${c}`,
        index: nodes.length,
        row: r,
        col: c,
        direction: `r${r}c${c}`,
        distanceKm: Math.round(Math.hypot(dxKm, dyKm) * 10) / 10,
        dxKm,
        dyKm,
        bearingDeg,
        bearingLabel: bearings[Math.round(bearingDeg / 45) % 8],
        rank: 1 + ((r * 3 + c * 2) % 12),
        in3Pack: (r * 3 + c * 2) % 12 < 3,
        leader: 'Rival Co',
        estMonthlySearches: 40 + r * 10 + c * 5,
        statusBadge: 'Dominant in 3-Pack',
      });
    }
  }
  return nodes;
}

function frameFor(gridSize: 3 | 5, radiusKm: number, rangeKm: number, sweepDeg = 120): RadarFrame {
  const nodes = buildNodes(gridSize, radiusKm);
  return {
    width: 440,
    height: 440,
    nodes,
    gridRadiusKm: radiusKm,
    rangeKm,
    selectedIndex: Math.floor(nodes.length / 2),
    hoveredIndex: 2,
    sweepDeg,
    reducedMotion: false,
    scanId: 0,
  };
}

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

// ── 1. km geometry of the mesh ──────────────────────────────────────────────
console.log('=== 1. mesh geometry (km) ===');
for (const [gridSize, radius] of [
  [3, 3],
  [3, 5],
  [5, 5],
  [5, 10],
  [5, 25],
] as Array<[3 | 5, number]>) {
  const nodes = buildNodes(gridSize, radius);
  const reach = Math.max(...nodes.map((n) => n.distanceKm));
  const expected = Math.round(radius * Math.SQRT2 * 10) / 10;
  const center = nodes[Math.floor(nodes.length / 2)];
  check(
    `${gridSize}x${gridSize} @ ${radius}km: ${nodes.length} nodes, corners at ${reach}km (expect ${expected}), centre ${center.distanceKm}km`,
    nodes.length === gridSize * gridSize && Math.abs(reach - expected) < 0.15 && center.distanceKm === 0
  );
}

// ── 2. frame painter: no NaNs, sane call volume, km → px scaling ────────────
console.log('\n=== 2. frame painting ===');
for (const [gridSize, radius, range] of [
  [3, 5, 10],
  [5, 5, 10],
  [5, 10, 10],
  [5, 25, 50],
  [3, 3, 5],
] as Array<[3 | 5, number, number]>) {
  const calls: Call[] = [];
  const ctx = createMockContext(calls);
  const blips = drawRadarFrame(ctx, frameFor(gridSize, radius, range));

  const nonFinite = calls.filter((c) => c.args.some((a) => !Number.isFinite(a)));
  const allFinite = calls.every((c) => c.args.every((a) => Number.isFinite(a)));
  check(
    `${gridSize}x${gridSize} @ ${radius}km on R${range}: ${calls.length} draw calls, ${blips.length} blips, all args finite`,
    allFinite && blips.length === gridSize * gridSize,
    nonFinite.length ? `non-finite in ${nonFinite[0].method}(${nonFinite[0].args.join(',')})` : ''
  );

  // km → px must be the single source of truth for blip placement. Compare
  // against the *unrounded* offset (distanceKm is display-rounded).
  const outer = Math.min(440, 440) / 2 - 10;
  const pxPerKm = outer / range;
  const corner = blips[blips.length - 1];
  const exactKm = Math.hypot(corner.node.dxKm, corner.node.dyKm);
  const expectedDistPx = exactKm * pxPerKm;
  const actualDistPx = Math.hypot(corner.px - 220, corner.py - 220);
  const beyond = exactKm > range;
  check(
    `   placement ${exactKm.toFixed(2)}km → ${actualDistPx.toFixed(1)}px (km-scaled ${expectedDistPx.toFixed(1)}px)${beyond ? ' [clamped beyond range]' : ''}`,
    beyond ? actualDistPx <= outer + 0.5 : Math.abs(actualDistPx - expectedDistPx) < 0.5
  );
}

// ── 3. radius actually moves the blips (the original bug) ───────────────────
console.log('\n=== 3. does changing km move the mesh? (fixed range scale) ===');
const positionsFor = (radius: number) => {
  const calls: Call[] = [];
  const blips = drawRadarFrame(createMockContext(calls), frameFor(3, radius, 10));
  const corner = blips[blips.length - 1];
  return Math.hypot(corner.px - 220, corner.py - 220);
};
const at3 = positionsFor(3);
const at5 = positionsFor(5);
const at10 = positionsFor(10);
console.log(`   3km corner → ${at3.toFixed(1)}px, 5km → ${at5.toFixed(1)}px, 10km → ${at10.toFixed(1)}px`);
check('blip radius grows with the km radius on a fixed range scale', at3 < at5 && at5 < at10);
check('10km mesh is clamped to the 10km range edge rather than drawn off-canvas', at10 <= 211);
