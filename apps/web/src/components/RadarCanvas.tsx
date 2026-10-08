'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Polar "PPI" radar display for the local geo-grid.
 *
 * Everything is drawn from real kilometre geometry: each sample point carries
 * its km offset from the business, and the canvas converts km → pixels through
 * the selected range scale (pxPerKm = outerRadius / rangeKm). That is what makes
 * the radius control move the mesh instead of only re-labelling it: the view has
 * a fixed km span, so widening the grid visibly pushes blips outwards, exactly
 * like changing the range on a real radar.
 *
 * The frame painter is exported separately (`drawRadarFrame`) so the geometry and
 * canvas usage can be exercised without a browser.
 */

export interface RadarNode {
  id: string;
  index: number;
  row: number;
  col: number;
  direction: string;
  /** True straight-line distance from the business, in km. */
  distanceKm: number;
  /** Cartesian offsets from the business; +x = east, +y = north. */
  dxKm: number;
  dyKm: number;
  /** Compass bearing from the business, degrees clockwise from north. */
  bearingDeg: number;
  bearingLabel: string;
  rank: number;
  in3Pack: boolean;
  leader: string;
  estMonthlySearches: number;
  statusBadge: string;
}

export interface BlipPoint {
  x: number;
  y: number;
  /** On-screen position after clamping to the outer ring. */
  px: number;
  py: number;
  beyondRange: boolean;
  node: RadarNode;
}

export interface RadarFrame {
  width: number;
  height: number;
  nodes: RadarNode[];
  gridRadiusKm: number;
  rangeKm: number;
  selectedIndex: number;
  hoveredIndex: number | null;
  /** Sweep angle in degrees, 0 = north, increasing clockwise. */
  sweepDeg: number;
  reducedMotion: boolean;
  scanId: number;
}

export interface RadarCanvasProps {
  nodes: RadarNode[];
  /** Service radius the mesh was built from, in km. */
  gridRadiusKm: number;
  /** View span of the radar, in km (outer ring). */
  rangeKm: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Changing this value restarts the sweep (used by "re-scan" actions). */
  scanId?: number;
  className?: string;
}

const RING_DIVISIONS = 4;
const SWEEP_PERIOD_MS = 2800;
/** Degrees of trailing glow behind the sweep line. */
const SWEEP_TAIL_DEG = 70;

const RANK_COLORS = {
  dominant: { core: '#34d399', glow: 'rgba(52,211,153,' },
  striking: { core: '#f59e0b', glow: 'rgba(245,158,11,' },
  lost: { core: '#fb7185', glow: 'rgba(251,113,133,' },
} as const;

function rankColor(rank: number) {
  if (rank <= 3) return RANK_COLORS.dominant;
  if (rank <= 10) return RANK_COLORS.striking;
  return RANK_COLORS.lost;
}

/** Deterministic speckle so the noise field never flickers between frames. */
function speckle(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return '0';
  if (km >= 10) return `${Math.round(km)}`;
  if (km >= 1) return km.toFixed(1).replace(/\.0$/, '');
  return km.toFixed(2);
}

/** Shortest angular separation between two bearings, in degrees. */
function angularDistance(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return 180 - d;
}

/**
 * Paints one radar frame and returns the on-screen blip positions, which the
 * component reuses for pointer hit-testing.
 */
export function drawRadarFrame(ctx: CanvasRenderingContext2D, frame: RadarFrame): BlipPoint[] {
  const { width: w, height: h, nodes, gridRadiusKm, rangeKm, selectedIndex, hoveredIndex, sweepDeg } = frame;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.min(w, h) / 2 - 10;
  const safeRange = Math.max(rangeKm, 0.1);
  const pxPerKm = outer / safeRange;

  // ── Background: CRT glass + vignette ─────────────────────────────────────
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(outer * 1.1, 1));
  bg.addColorStop(0, 'rgba(8,47,73,0.55)');
  bg.addColorStop(0.55, 'rgba(2,6,23,0.9)');
  bg.addColorStop(1, 'rgba(2,6,23,1)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fill();

  // ── Range rings (labelled in km) ─────────────────────────────────────────
  const rings: number[] = [];
  for (let i = 1; i <= RING_DIVISIONS; i++) rings.push((safeRange * i) / RING_DIVISIONS);

  ctx.save();
  ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  rings.forEach((ringKm, i) => {
    const r = ringKm * pxPerKm;
    const isOuter = i === rings.length - 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = isOuter ? 'rgba(56,189,248,0.4)' : 'rgba(56,189,248,0.16)';
    ctx.lineWidth = isOuter ? 1.4 : 1;
    ctx.stroke();

    // Range label up the north-west diagonal: clear of the compass letters and
    // of the corner HUD blocks.
    const lx = cx + r * Math.cos((5 * Math.PI) / 4);
    const ly = cy + r * Math.sin((5 * Math.PI) / 4);
    ctx.fillStyle = 'rgba(148,197,253,0.75)';
    ctx.fillText(`${formatKm(ringKm)} km`, lx + 3, ly);
  });

  // ── Azimuth spokes + compass ─────────────────────────────────────────────
  for (let deg = 0; deg < 360; deg += 10) {
    const rad = ((deg - 90) * Math.PI) / 180;
    const cardinal = deg % 90 === 0;
    const major = deg % 30 === 0;
    if (!major && !cardinal) continue;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + outer * Math.cos(rad), cy + outer * Math.sin(rad));
    ctx.strokeStyle = cardinal ? 'rgba(148,163,184,0.28)' : 'rgba(148,163,184,0.12)';
    ctx.lineWidth = cardinal ? 1 : 0.8;
    ctx.stroke();
  }

  ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  const compass: Array<[string, number]> = [
    ['N', 0],
    ['E', 90],
    ['S', 180],
    ['W', 270],
  ];
  for (const [label, deg] of compass) {
    const rad = ((deg - 90) * Math.PI) / 180;
    ctx.fillStyle = 'rgba(226,232,240,0.85)';
    ctx.fillText(label, cx + (outer - 6) * Math.cos(rad), cy + (outer - 6) * Math.sin(rad));
  }

  // ── Speckle noise (static, range-faded) ──────────────────────────────────
  for (let i = 0; i < 190; i++) {
    const a = speckle(i * 1.7 + frame.scanId) * Math.PI * 2;
    const rr = Math.sqrt(speckle(i * 3.1 + 11)) * outer;
    const alpha = 0.05 + 0.09 * (1 - rr / Math.max(outer, 1));
    ctx.fillStyle = `rgba(125,211,252,${alpha.toFixed(3)})`;
    ctx.fillRect(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 1.3, 1.3);
  }

  // ── Service radius (the value the user picked) ───────────────────────────
  const serviceR = gridRadiusKm * pxPerKm;
  if (serviceR > 2) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, serviceR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34,211,238,0.75)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(103,232,249,0.95)';
    // Up the north-east diagonal so it never sits on the "N" compass letter.
    ctx.textAlign = 'left';
    ctx.fillText(
      `service radius ${formatKm(gridRadiusKm)} km`,
      cx + serviceR * Math.cos(-Math.PI / 4) + 4,
      cy + serviceR * Math.sin(-Math.PI / 4)
    );
  }

  // ── Blip geometry (km → px; clamped to the outer ring when off-scale) ────
  const blips: BlipPoint[] = nodes.map((node) => {
    const x = cx + node.dxKm * pxPerKm;
    const y = cy - node.dyKm * pxPerKm;
    const dist = Math.hypot(x - cx, y - cy);
    const beyondRange = node.distanceKm > safeRange;
    const clamped = beyondRange && dist > 0 ? (outer * 0.985) / dist : 1;
    return {
      x,
      y,
      px: cx + (x - cx) * clamped,
      py: cy + (y - cy) * clamped,
      beyondRange,
      node,
    };
  });

  // ── Sweep wedge (behind blips, in front of the grid) ─────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.clip();

  const steps = 44;
  for (let i = 0; i < steps; i++) {
    const from = sweepDeg - (SWEEP_TAIL_DEG * (i + 1)) / steps;
    const to = sweepDeg - (SWEEP_TAIL_DEG * i) / steps;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outer, ((from - 90) * Math.PI) / 180, ((to - 90) * Math.PI) / 180);
    ctx.closePath();
    ctx.fillStyle = `rgba(34,211,238,${(0.16 * (1 - i / steps)).toFixed(4)})`;
    ctx.fill();
  }

  const leadRad = ((sweepDeg - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + outer * Math.cos(leadRad), cy + outer * Math.sin(leadRad));
  ctx.strokeStyle = 'rgba(165,243,252,0.9)';
  ctx.lineWidth = 1.6;
  ctx.shadowColor = 'rgba(34,211,238,0.9)';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
  ctx.shadowBlur = 0;

  // ── Mesh lattice ─────────────────────────────────────────────────────────
  const gridSize = Math.round(Math.sqrt(nodes.length));
  if (nodes.length > 1 && gridSize > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(99,102,241,0.18)';
    ctx.lineWidth = 0.8;
    for (let r = 0; r < gridSize; r++) {
      const rowBlips = blips.filter((b) => b.node.row === r).sort((a, b) => a.node.col - b.node.col);
      ctx.beginPath();
      rowBlips.forEach((b, i) => (i === 0 ? ctx.moveTo(b.px, b.py) : ctx.lineTo(b.px, b.py)));
      ctx.stroke();
    }
    for (let c = 0; c < gridSize; c++) {
      const colBlips = blips.filter((b) => b.node.col === c).sort((a, b) => a.node.row - b.node.row);
      ctx.beginPath();
      colBlips.forEach((b, i) => (i === 0 ? ctx.moveTo(b.px, b.py) : ctx.lineTo(b.px, b.py)));
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── HQ marker ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(226,232,240,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 15, cy);
  ctx.lineTo(cx + 15, cy);
  ctx.moveTo(cx, cy - 15);
  ctx.lineTo(cx, cy + 15);
  ctx.strokeStyle = 'rgba(226,232,240,0.35)';
  ctx.stroke();
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
  ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(241,245,249,0.9)';
  ctx.fillText('HQ', cx + 8, cy - 8);
  ctx.restore();

  // ── Blips ────────────────────────────────────────────────────────────────
  blips.forEach((b) => {
    const node = b.node;
    const color = rankColor(node.rank);
    const isSelected = node.index === selectedIndex;
    const isHovered = hoveredIndex === node.index;

    // A blip brightens as the beam sweeps over it.
    const illumination = frame.reducedMotion
      ? 0
      : Math.max(0, 1 - angularDistance(sweepDeg, node.bearingDeg) / 22);
    const blipRadius = 3 + Math.min(4.5, node.estMonthlySearches / 60) + illumination * 1.6;

    if (isSelected || isHovered) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(b.px, b.py);
      ctx.strokeStyle = isSelected ? 'rgba(103,232,249,0.6)' : 'rgba(226,232,240,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    const glowRadius = Math.max(blipRadius * 4, 1);
    const glow = ctx.createRadialGradient(b.px, b.py, 0, b.px, b.py, glowRadius);
    glow.addColorStop(0, `${color.glow}${(0.55 + illumination * 0.35).toFixed(3)})`);
    glow.addColorStop(1, `${color.glow}0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.px, b.py, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(b.px, b.py, blipRadius, 0, Math.PI * 2);
    ctx.fillStyle = color.core;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(2,6,23,0.65)';
    ctx.stroke();

    if (blipRadius >= 4.4) {
      ctx.font = '800 8px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(2,6,23,0.9)';
      ctx.fillText(String(node.rank), b.px, b.py + 0.5);
    }

    if (isSelected && !frame.reducedMotion) {
      const phase = (frame.sweepDeg % 360) / 360;
      ctx.beginPath();
      ctx.arc(b.px, b.py, blipRadius + phase * 16, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${(0.55 * (1 - phase)).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    if (b.beyondRange) {
      ctx.beginPath();
      ctx.arc(b.px, b.py, blipRadius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(251,191,36,0.9)';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // ── Hover crosshair ──────────────────────────────────────────────────────
  if (hoveredIndex !== null) {
    const hovered = blips.find((b) => b.node.index === hoveredIndex);
    if (hovered) {
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(226,232,240,0.45)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(hovered.px, 0);
      ctx.lineTo(hovered.px, h);
      ctx.moveTo(0, hovered.py);
      ctx.lineTo(w, hovered.py);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── HUD ──────────────────────────────────────────────────────────────────
  const inPack = nodes.filter((n) => n.in3Pack).length;
  const avgRank = nodes.length ? nodes.reduce((a, n) => a + n.rank, 0) / nodes.length : 0;
  const reach = nodes.length ? Math.max(...nodes.map((n) => n.distanceKm)) : 0;
  const selected = nodes.find((n) => n.index === selectedIndex);

  ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(125,211,252,0.95)';
  ctx.fillText(`RANGE ${formatKm(safeRange)} km`, 10, 18);
  ctx.fillStyle = 'rgba(148,163,184,0.85)';
  ctx.fillText(`MESH ${gridSize}x${gridSize} · ${nodes.length} PINS`, 10, 32);
  ctx.fillText(`IN 3-PACK ${inPack}/${nodes.length} · AVG #${avgRank.toFixed(1)}`, 10, 46);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(125,211,252,0.95)';
  ctx.fillText(
    frame.reducedMotion ? 'SWEEP STATIC' : `SWEEP ${(SWEEP_PERIOD_MS / 1000).toFixed(1)}s`,
    w - 10,
    18
  );
  ctx.fillStyle = 'rgba(148,163,184,0.85)';
  ctx.fillText(`AZ ${Math.round(sweepDeg).toString().padStart(3, '0')}°`, w - 10, 32);
  if (selected) {
    ctx.fillStyle = 'rgba(226,232,240,0.95)';
    ctx.fillText(
      selected.distanceKm === 0 ? 'LOCK HQ' : `LOCK ${selected.bearingLabel} ${formatKm(selected.distanceKm)} km`,
      w - 10,
      46
    );
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = reach > safeRange ? 'rgba(251,191,36,0.95)' : 'rgba(148,163,184,0.8)';
  ctx.fillText(reach > safeRange ? `REACH ${formatKm(reach)} km > RANGE — CLAMPED` : `MESH REACH ${formatKm(reach)} km`, 10, h - 10);

  return blips;
}

export default function RadarCanvas({
  nodes,
  gridRadiusKm,
  rangeKm,
  selectedIndex,
  onSelect,
  scanId = 0,
  className = '',
}: RadarCanvasProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);

  // Sweep phase lives in a ref so animation never triggers a React re-render.
  const sweepRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const blipsRef = useRef<BlipPoint[]>([]);
  const hoveredIndexRef = useRef<number | null>(null);

  const selected = useMemo(
    () => nodes.find((n) => n.index === selectedIndex) ?? nodes[Math.floor(nodes.length / 2)],
    [nodes, selectedIndex]
  );

  hoveredIndexRef.current = hovered?.index ?? null;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only animate while the canvas is on screen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    sweepRef.current = 0;
  }, [scanId]);

  const draw = useCallback(
    (sweepDeg: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || size.width === 0 || size.height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = size.width;
      const h = size.height;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      blipsRef.current = drawRadarFrame(ctx, {
        width: w,
        height: h,
        nodes,
        gridRadiusKm,
        rangeKm,
        selectedIndex,
        hoveredIndex: hoveredIndexRef.current,
        sweepDeg,
        reducedMotion,
        scanId,
      });
    },
    [nodes, gridRadiusKm, rangeKm, selectedIndex, size, reducedMotion, scanId]
  );

  useEffect(() => {
    const shouldAnimate = !reducedMotion && visible;
    if (!shouldAnimate) {
      draw(reducedMotion ? 35 : sweepRef.current);
      return;
    }

    let frame = 0;
    const loop = () => {
      frame += 1;
      sweepRef.current = ((frame * 16.7) / SWEEP_PERIOD_MS) * 360 % 360;
      draw(sweepRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [draw, reducedMotion, visible]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best: { index: number; x: number; y: number; dist: number } | null = null;
    for (const b of blipsRef.current) {
      const d = Math.hypot(b.px - x, b.py - y);
      if (d <= 16 && (!best || d < best.dist)) best = { index: b.node.index, x: b.px, y: b.py, dist: d };
    }
    setHovered(best ? { index: best.index, x: best.x, y: best.y } : null);
  }, []);

  const handleClick = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let best: { index: number; dist: number } | null = null;
      for (const b of blipsRef.current) {
        const d = Math.hypot(b.px - x, b.py - y);
        if (d <= 18 && (!best || d < best.dist)) best = { index: b.node.index, dist: d };
      }
      if (best) onSelect(best.index);
    },
    [onSelect]
  );

  const hoveredNode = hovered ? nodes.find((n) => n.index === hovered.index) : null;

  return (
    <div
      ref={wrapRef}
      className={`relative aspect-square w-full select-none ${className}`}
      role="img"
      aria-label={`Geo-grid radar: ${nodes.length} sample points across a ${formatKm(gridRadiusKm)} km mesh, shown on a ${formatKm(rangeKm)} km range scale.`}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair rounded-2xl border border-slate-800 bg-slate-950"
        style={{ width: '100%', height: '100%', touchAction: 'manipulation' }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHovered(null)}
        onPointerDown={handleClick}
      />

      {/* HTML tooltip keeps text crisp at any device pixel ratio. */}
      {hovered && hoveredNode && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-cyan-400/30 bg-slate-950/95 px-2.5 py-1.5 text-[10px] leading-tight text-slate-100 shadow-xl backdrop-blur"
          style={{
            left: hovered.x,
            top: Math.max(8, hovered.y - 12),
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-bold text-cyan-300">
            #{hoveredNode.rank} · {hoveredNode.bearingLabel} {formatKm(hoveredNode.distanceKm)} km
          </div>
          <div className="text-slate-300">
            {hoveredNode.direction} · {hoveredNode.statusBadge}
          </div>
          <div className="text-slate-400">
            bearing {Math.round(hoveredNode.bearingDeg)}° · {hoveredNode.leader}
          </div>
        </div>
      )}

      {/* Keyboard/AT access: the canvas is visual, so the same nodes are exposed
          as an off-screen button list. */}
      <div className="sr-only">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            aria-pressed={node.index === selectedIndex}
            onClick={() => onSelect(node.index)}
          >
            {node.direction}, {formatKm(node.distanceKm)} km from HQ, rank #{node.rank}, {node.statusBadge}
          </button>
        ))}
      </div>
    </div>
  );
}
