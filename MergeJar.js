/**
 * MergeJar.js
 * Core physics merge screen, jar renderer and shared fluff visuals.
 *
 * Default export <MergeJar /> props:
 *   world        mutable physics object from createWorld() (owned by App.js)
 *   gameState    central state (coins, gems, powers, equippedOutfit, settings, challenge...)
 *   setGameState central setter (functional updates)
 *   run          { score, over, armed }   current run
 *   setRun       setter for run
 *   theme        jar colors { bg, glass, glassEdge, rim, swatchEdge, ink }
 *   toast        (text) => void
 *   onExit       () => void
 */

import React, { memo, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, PanResponder, Modal } from 'react-native';

/* ================================================================== */
/* CONFIG                                                              */
/* ================================================================== */

export const TIERS = [
  { value: 1,   name: 'Tan',    color: '#EBD3AE', edge: '#CDAE82', rf: 0.045, pts: 0,   coins: 0,  gems: 0, eyes: 'dot',     mouth: 'smile' },
  { value: 2,   name: 'White',  color: '#FFF8EE', edge: '#E6D5C0', rf: 0.060, pts: 4,   coins: 1,  gems: 0, eyes: 'dot',     mouth: 'cat'   },
  { value: 4,   name: 'Pink',   color: '#FFBCCB', edge: '#F09BB0', rf: 0.075, pts: 8,   coins: 1,  gems: 0, eyes: 'happy',   mouth: 'smile' },
  { value: 8,   name: 'Yellow', color: '#FFE792', edge: '#F0C95E', rf: 0.092, pts: 16,  coins: 2,  gems: 0, eyes: 'dot',     mouth: 'open'  },
  { value: 16,  name: 'Blue',   color: '#A9D6F7', edge: '#7FB6E3', rf: 0.110, pts: 32,  coins: 3,  gems: 0, eyes: 'sparkle', mouth: 'smile' },
  { value: 32,  name: 'Green',  color: '#B8E6A9', edge: '#8FCB7E', rf: 0.130, pts: 64,  coins: 5,  gems: 0, eyes: 'happy',   mouth: 'open'  },
  { value: 64,  name: 'Orange', color: '#FFC38F', edge: '#F0A060', rf: 0.150, pts: 128, coins: 8,  gems: 0, eyes: 'sparkle', mouth: 'cat'   },
  { value: 128, name: 'Purple', color: '#CDB6F2', edge: '#AB8DDB', rf: 0.172, pts: 256, coins: 13, gems: 1, eyes: 'sparkle', mouth: 'open'  },
  { value: 256, name: 'Red',    color: '#FF9494', edge: '#E56F6F', rf: 0.195, pts: 512, coins: 21, gems: 2, eyes: 'happy',   mouth: 'open'  },
];

const POWER_DEFS = [
  { key: 'sweep', icon: '🧹', name: 'Sweep' },
  { key: 'pop',   icon: '💥', name: 'Pop'   },
  { key: 'grow',  icon: '🌱', name: 'Grow'  },
  { key: 'shake', icon: '🌀', name: 'Shake' },
];

// Physics runs in a fixed logical world and is scaled to fit any screen.
export const WW = 380;
export const DIM = { dz: WW * 0.24, jh: WW * 1.2, bh: WW * 1.44, lineY: WW * 0.31 };
const PAD = 4;
const SUB = 4;
const LAST = TIERS.length - 1;
const GROW_CAP = 4;
const INK = '#5B3A2E';

export const C = {
  card: '#FFE3C7',
  cardEdge: '#F6C79C',
  text: '#7A4A32',
  soft: '#A8806A',
  pink: '#FF8FA3',
  pinkDark: '#E96F88',
  white: '#FFFAF3',
};

/* ================================================================== */
/* HELPERS                                                             */
/* ================================================================== */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = (n) => (n < 10 ? '0' : '') + n;
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const pickTier = () => {
  const r = Math.random();
  return r < 0.38 ? 0 : r < 0.68 ? 1 : r < 0.88 ? 2 : 3;
};

/* ================================================================== */
/* WORLD (mutable physics, lives in a ref owned by App.js)             */
/* ================================================================== */

export const emptyDelta = () => ({ score: 0, coins: 0, gems: 0, merged: [], found: [] });
export const hasDelta = (d) => d.score || d.coins || d.gems || d.merged.length || d.found.length;

export function createWorld() {
  return {
    balls: [], fx: [], id: 0,
    held: pickTier(), next: pickTier(), canDropAt: 0,
    over: false, overSent: false, last: 0, danger: 0,
    hoverX: WW / 2, tx: 0, ty: 0,
    delta: emptyDelta(),
    listeners: new Set(),
  };
}

export function resetWorld(g) {
  Object.assign(g, {
    balls: [], fx: [], held: pickTier(), next: pickTier(), canDropAt: 0,
    over: false, overSent: false, danger: 0, hoverX: WW / 2, delta: emptyDelta(),
  });
}

// Folds a frame's worth of physics events into the central game state.
export function applyDelta(prev, d, newScore) {
  const key = dayKey();
  const t = prev.todayMerges && prev.todayMerges.date === key ? prev.todayMerges : { date: key, counts: {} };
  const counts = { ...(t.counts || {}) };
  d.merged.forEach((i) => {
    const v = TIERS[i].value;
    counts[v] = (counts[v] || 0) + 1;
  });
  const discovered = prev.discovered.slice();
  d.found.concat(d.merged).forEach((i) => {
    const v = TIERS[i].value;
    if (!discovered.includes(v)) discovered.push(v);
  });
  const xp = prev.xp + d.score;
  return {
    ...prev,
    coins: prev.coins + d.coins,
    gems: prev.gems + d.gems,
    discovered,
    xp,
    level: 1 + Math.floor(xp / 300),
    totalMerges: (prev.totalMerges || 0) + d.merged.length,
    best: Math.max(prev.best || 0, newScore),
    todayMerges: { date: key, counts },
  };
}

function addFx(g, x, y, r, color) {
  g.fx.push({ id: ++g.id, x, y, r, color, born: Date.now() });
}

function dropBall(g) {
  if (g.over || g.held == null) return;
  const now = Date.now();
  const r = TIERS[g.held].rf * WW;
  const x = clamp(g.hoverX, PAD + r, WW - PAD - r);
  g.balls.push({ id: ++g.id, t: g.held, x, y: DIM.dz - 8 - r, vx: 0, vy: 0, r, born: now, pop: 0, overT: 0 });
  g.delta.found.push(g.held);
  g.held = null;
  g.canDropAt = now + 450;
}

function mergeBalls(g, a, c, spawned, now) {
  a.dead = true;
  c.dead = true;
  const mx = (a.x + c.x) / 2;
  const my = (a.y + c.y) / 2;
  if (a.t === LAST) {
    g.delta.score += 100;
    g.delta.coins += 30;
    g.delta.gems += 3;
    g.delta.merged.push(LAST);
    addFx(g, mx, my, a.r * 1.4, TIERS[LAST].color);
    return;
  }
  const nt = a.t + 1;
  const cfg = TIERS[nt];
  spawned.push({
    id: ++g.id, t: nt, x: mx, y: my,
    vx: (a.vx + c.vx) * 0.25, vy: (a.vy + c.vy) * 0.25,
    r: cfg.rf * WW, born: Math.min(a.born, c.born), pop: now, overT: 0,
  });
  g.delta.score += cfg.pts;
  g.delta.coins += cfg.coins;
  g.delta.gems += cfg.gems;
  g.delta.merged.push(nt);
  addFx(g, mx, my, cfg.rf * WW, cfg.color);
}

export function stepWorld(g, dt, now) {
  const left = PAD;
  const right = WW - PAD;
  const floor = DIM.bh - PAD;
  const grav = WW * 5.5;
  const h = dt / SUB;

  if (g.held == null && now >= g.canDropAt) {
    g.held = g.next;
    g.next = pickTier();
  }

  for (let s = 0; s < SUB; s++) {
    const balls = g.balls;

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      b.vy += grav * h;
      b.vx *= 1 - 0.25 * h;
      b.x += b.vx * h;
      b.y += b.vy * h;
    }

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.x - b.r < left) {
        b.x = left + b.r;
        if (b.vx < 0) b.vx *= -0.25;
      } else if (b.x + b.r > right) {
        b.x = right - b.r;
        if (b.vx > 0) b.vx *= -0.25;
      }
      if (b.y + b.r > floor) {
        b.y = floor - b.r;
        if (b.vy > 0) b.vy *= -0.15;
        b.vx *= Math.max(0, 1 - 6 * h);
      }
    }

    const spawned = [];
    let changed = false;

    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        if (a.dead) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const c = balls[j];
          if (c.dead) continue;
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const rs = a.r + c.r;
          const d2 = dx * dx + dy * dy;
          if (d2 > (rs + 1.5) * (rs + 1.5)) continue;

          if (a.t === c.t) {
            mergeBalls(g, a, c, spawned, now);
            changed = true;
            break;
          }
          if (d2 >= rs * rs) continue;

          const dist = Math.sqrt(d2) || 0.001;
          const nx = dx / dist;
          const ny = dy / dist;
          const ov = (rs - dist) * 0.85;
          const ia = 1 / (a.r * a.r);
          const ic = 1 / (c.r * c.r);
          const is = ia + ic;
          a.x -= (nx * ov * ia) / is;
          a.y -= (ny * ov * ia) / is;
          c.x += (nx * ov * ic) / is;
          c.y += (ny * ov * ic) / is;

          const rvx = c.vx - a.vx;
          const rvy = c.vy - a.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const jn = (-(1 + 0.08) * vn) / is;
            a.vx -= jn * nx * ia;
            a.vy -= jn * ny * ia;
            c.vx += jn * nx * ic;
            c.vy += jn * ny * ic;
            const tx = -ny;
            const ty = nx;
            const vt = rvx * tx + rvy * ty;
            const jt = (-vt * 0.12) / is;
            a.vx -= jt * tx * ia;
            a.vy -= jt * ty * ia;
            c.vx += jt * tx * ic;
            c.vy += jt * ty * ic;
          }
        }
      }
    }

    if (changed) g.balls = balls.filter((b) => !b.dead).concat(spawned);
  }

  if (g.fx.length) g.fx = g.fx.filter((f) => now - f.born < 400);

  let maxOver = 0;
  for (let i = 0; i < g.balls.length; i++) {
    const b = g.balls[i];
    if (b.y - b.r < DIM.lineY && now - b.born > 1400 && Math.abs(b.vy) < WW * 0.4) b.overT += dt;
    else b.overT = 0;
    if (b.overT > maxOver) maxOver = b.overT;
  }
  g.danger = clamp(maxOver / 1.6, 0, 1);
  if (maxOver > 1.6) g.over = true;
}

function popAt(g, x, y) {
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const b = g.balls[i];
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx * dx + dy * dy <= (b.r + 4) * (b.r + 4)) {
      addFx(g, b.x, b.y, b.r, TIERS[b.t].color);
      g.balls.splice(i, 1);
      g.delta.coins += 1;
      return true;
    }
  }
  return false;
}

// Spends one power-up, or 1 gem when the bag is empty.
function spendPower(setGameState, key) {
  setGameState((p) => {
    if ((p.powers[key] || 0) > 0) return { ...p, powers: { ...p.powers, [key]: p.powers[key] - 1 } };
    if (p.gems > 0) return { ...p, gems: p.gems - 1 };
    return p;
  });
}

/* ================================================================== */
/* VISUALS: faces, outfits, fluffs                                     */
/* ================================================================== */

const abs = { position: 'absolute' };
const tri = (w, h, color) => ({
  width: 0, height: 0,
  borderLeftWidth: w / 2, borderRightWidth: w / 2, borderBottomWidth: h,
  borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color,
});

function Face({ r, eyes, mouth }) {
  const e = Math.max(3, r * 0.17);
  const ey = r * 0.98;
  const ex = r * 0.4;
  const m = r * 0.34;
  const my = r * 1.3;
  const lw = Math.max(1.5, r * 0.06);
  const parts = [];

  [-1, 1].forEach((sd) => {
    const cx = r + sd * ex;
    if (eyes === 'happy') {
      const w = e * 1.8;
      parts.push(
        <View
          key={'e' + sd}
          style={{
            ...abs, left: cx - w / 2, top: ey - w * 0.25, width: w, height: w * 0.5,
            borderTopWidth: lw * 1.3, borderTopLeftRadius: w / 2, borderTopRightRadius: w / 2, borderColor: INK,
          }}
        />
      );
    } else {
      const w = eyes === 'sparkle' ? e * 1.4 : e;
      parts.push(
        <View key={'e' + sd} style={{ ...abs, left: cx - w / 2, top: ey - w * 0.6, width: w, height: w * 1.25, borderRadius: w / 2, backgroundColor: INK }}>
          <View style={{ ...abs, left: w * 0.22, top: w * 0.2, width: w * 0.38, height: w * 0.38, borderRadius: w * 0.19, backgroundColor: '#fff' }} />
          {eyes === 'sparkle' && (
            <View style={{ ...abs, right: w * 0.2, bottom: w * 0.22, width: w * 0.2, height: w * 0.2, borderRadius: w * 0.1, backgroundColor: '#fff' }} />
          )}
        </View>
      );
    }
    const cw = r * 0.3;
    parts.push(
      <View
        key={'c' + sd}
        style={{ ...abs, left: r + sd * r * 0.62 - cw / 2, top: r * 1.15, width: cw, height: cw * 0.6, borderRadius: cw / 2, backgroundColor: 'rgba(255,125,150,0.38)' }}
      />
    );
  });

  if (mouth === 'smile') {
    parts.push(
      <View key="m" style={{ ...abs, left: r - m / 2, top: my, width: m, height: m * 0.5, borderBottomWidth: lw, borderBottomLeftRadius: m / 2, borderBottomRightRadius: m / 2, borderColor: INK }} />
    );
  } else if (mouth === 'open') {
    parts.push(
      <View key="m" style={{ ...abs, left: r - m * 0.4, top: my - m * 0.05, width: m * 0.8, height: m * 0.85, borderRadius: m * 0.4, backgroundColor: INK, overflow: 'hidden' }}>
        <View style={{ ...abs, left: m * 0.12, bottom: 0, width: m * 0.56, height: m * 0.38, borderRadius: m * 0.28, backgroundColor: C.pink }} />
      </View>
    );
  } else {
    const mw = m * 0.6;
    [-1, 1].forEach((sd) => {
      parts.push(
        <View
          key={'m' + sd}
          style={{ ...abs, left: r + (sd * mw) / 2 - mw / 2, top: my, width: mw, height: mw * 0.55, borderBottomWidth: lw, borderBottomLeftRadius: mw / 2, borderBottomRightRadius: mw / 2, borderColor: INK }}
        />
      );
    });
  }
  return <>{parts}</>;
}

const Blob = memo(function Blob({ t, r }) {
  const c = TIERS[t];
  return (
    <View style={{ width: r * 2, height: r * 2, borderRadius: r, backgroundColor: c.color, overflow: 'hidden' }}>
      <View style={{ ...abs, left: r * 0.35, top: r * 0.2, width: r * 0.42, height: r * 0.22, borderRadius: r * 0.2, backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-25deg' }] }} />
      <Face r={r} eyes={c.eyes} mouth={c.mouth} />
      <View
        pointerEvents="none"
        style={{ ...abs, left: 0, top: 0, width: r * 2, height: r * 2, borderRadius: r, borderWidth: Math.max(1.5, r * 0.07), borderColor: c.edge }}
      />
    </View>
  );
});

// Outfit ids: kitty, puppy, chick, dino, crown. 'classic' means no outfit.
const Outfit = memo(function Outfit({ id, r, t, front }) {
  const c = TIERS[t];
  const bw = Math.max(1.2, r * 0.05);
  const els = [];

  if (!front) {
    if (id === 'kitty') {
      [-1, 1].forEach((sd) => {
        const w = r * 0.7;
        const h = r * 0.75;
        els.push(
          <View key={'k' + sd} style={{ ...abs, left: r + sd * r * 0.55 - w / 2, top: -r * 0.4, width: w, height: h, transform: [{ rotate: `${sd * 18}deg` }] }}>
            <View style={tri(w, h, c.edge)} />
            <View style={{ ...abs, left: w * 0.3, top: h * 0.4, ...tri(w * 0.4, h * 0.5, '#FFB6C8') }} />
          </View>
        );
      });
    } else if (id === 'puppy') {
      [-1, 1].forEach((sd) => {
        const w = r * 0.5;
        const h = r * 0.95;
        els.push(
          <View
            key={'p' + sd}
            style={{
              ...abs, left: r + sd * r * 0.82 - w / 2, top: r * 0.15, width: w, height: h,
              borderRadius: w / 2, backgroundColor: '#B98660', borderWidth: bw, borderColor: '#8F6540',
              transform: [{ rotate: `${sd * -14}deg` }],
            }}
          />
        );
      });
    }
  } else {
    if (id === 'chick') {
      [-1, 0, 1].forEach((i) => {
        const w = r * 0.2;
        const h = r * 0.38;
        els.push(
          <View
            key={'c' + i}
            style={{
              ...abs, left: r + i * r * 0.2 - w / 2, top: -r * 0.2 - (i === 0 ? r * 0.08 : 0), width: w, height: h,
              borderRadius: w / 2, backgroundColor: '#FFD84D', transform: [{ rotate: `${i * 22}deg` }],
            }}
          />
        );
      });
    } else if (id === 'dino') {
      [-1, 0, 1].forEach((i) => {
        const w = r * 0.3;
        const h = r * 0.4;
        els.push(
          <View key={'d' + i} style={{ ...abs, left: r + i * r * 0.34 - w / 2, top: -r * 0.28 - (i === 0 ? r * 0.08 : 0), ...tri(w, h, '#7CCB74') }} />
        );
      });
    } else if (id === 'crown') {
      const w = r * 0.95;
      const bh = r * 0.22;
      const th = r * 0.38;
      els.push(
        <View key="crown" style={{ ...abs, left: r - w / 2, top: -r * 0.5, width: w, height: bh + th }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ ...abs, left: (i * w) / 3, top: 0, ...tri(w / 3, th, '#FFD84D') }} />
          ))}
          <View style={{ ...abs, left: 0, top: th, width: w, height: bh, borderRadius: 3, backgroundColor: '#FFD84D', borderWidth: bw, borderColor: '#E8B82E' }} />
        </View>
      );
    }
  }
  return els.length ? <>{els}</> : null;
});

export const Fluff = memo(function Fluff({ t, r, o }) {
  const has = o && o !== 'none' && o !== 'classic';
  return (
    <View style={{ width: r * 2, height: r * 2 }}>
      {has && <Outfit id={o} r={r} t={t} front={false} />}
      <Blob t={t} r={r} />
      {has && <Outfit id={o} r={r} t={t} front />}
    </View>
  );
});

const BallView = memo(function BallView({ x, y, r, t, s, o }) {
  return (
    <View style={{ ...abs, left: x - r, top: y - r, width: r * 2, height: r * 2, transform: [{ scale: s }] }}>
      <Fluff t={t} r={r} o={o} />
    </View>
  );
});

const DashLine = memo(function DashLine({ width, op }) {
  const n = 28;
  const dw = width / (n * 2 - 1);
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push(<View key={i} style={{ width: dw, height: 3, borderRadius: 2, backgroundColor: '#FF7A7A' }} />);
  }
  return <View style={{ width, flexDirection: 'row', justifyContent: 'space-between', opacity: op }}>{items}</View>;
});

/* ================================================================== */
/* JAR BOARD (subscribes to the game loop itself)                      */
/* ================================================================== */

export const JarBoard = memo(function JarBoard({ g, k, mode, theme, outfit, calm }) {
  const [, bump] = useReducer((x) => (x + 1) % 1000000000, 0);
  useEffect(() => {
    g.listeners.add(bump);
    return () => { g.listeners.delete(bump); };
  }, [g]);

  const now = Date.now();
  const play = mode === 'play';
  const topCut = play ? 0 : DIM.dz - 14;
  const w = WW * k;
  const h = (DIM.bh - topCut) * k;

  return (
    <View style={{ width: w, height: h }}>
      <View
        style={{
          ...abs,
          left: -(WW - w) / 2,
          top: -(DIM.bh - DIM.bh * k) / 2 - topCut * k,
          width: WW, height: DIM.bh, transform: [{ scale: k }],
        }}
      >
        <View style={{ ...abs, left: WW * 0.08, top: DIM.bh - 6, width: WW * 0.84, height: 12, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.12)' }} />

        <View style={{ ...abs, left: -1.5, top: DIM.dz, width: WW + 3, height: DIM.jh + 1.5, borderWidth: 1.5, borderTopWidth: 0, borderColor: 'rgba(122,74,50,0.16)', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }} />
        <View
          style={{
            ...abs, left: 0, top: DIM.dz, width: WW, height: DIM.jh,
            backgroundColor: theme.glass, borderWidth: PAD, borderTopWidth: 0, borderColor: theme.glassEdge,
            borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
          }}
        >
          <View style={{ ...abs, left: 10, top: 18, width: 8, height: DIM.jh * 0.42, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' }} />
          <View style={{ ...abs, left: 10, top: 18 + DIM.jh * 0.42 + 8, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' }} />
        </View>

        <View style={{ ...abs, left: -6, top: DIM.dz - 6, width: WW + 12, height: 12, borderRadius: 6, backgroundColor: theme.rim, borderWidth: 2, borderColor: theme.swatchEdge }} />

        <View style={{ ...abs, left: PAD, top: DIM.lineY }}>
          <DashLine width={WW - PAD * 2} op={Math.round((0.3 + g.danger * 0.7) * 20) / 20} />
        </View>

        {play && g.held != null && !g.over && (
          <View
            style={{
              ...abs,
              left: clamp(g.hoverX, PAD + TIERS[g.held].rf * WW, WW - PAD - TIERS[g.held].rf * WW) - 1,
              top: DIM.dz, width: 2, height: DIM.jh - PAD, backgroundColor: 'rgba(122,74,50,0.16)',
            }}
          />
        )}

        {g.balls.map((b) => {
          const p = !calm && b.pop ? Math.min(1, (now - b.pop) / 240) : 1;
          const s = p >= 1 ? 1 : 0.65 + 0.35 * p + 0.15 * Math.sin(Math.PI * p);
          return (
            <BallView
              key={b.id}
              x={Math.round(b.x * 10) / 10}
              y={Math.round(b.y * 10) / 10}
              r={Math.round(b.r * 10) / 10}
              t={b.t}
              s={Math.round(s * 100) / 100}
              o={outfit}
            />
          );
        })}

        {!calm && g.fx.map((f) => {
          const p = clamp((now - f.born) / 400, 0, 1);
          return (
            <View
              key={f.id}
              pointerEvents="none"
              style={{
                ...abs, left: f.x - f.r, top: f.y - f.r, width: f.r * 2, height: f.r * 2,
                borderRadius: f.r, borderWidth: 3, borderColor: f.color,
                opacity: 1 - p, transform: [{ scale: 1 + p * 0.9 }],
              }}
            />
          );
        })}

        {play && g.held != null && !g.over && (() => {
          const r = TIERS[g.held].rf * WW;
          const x = clamp(g.hoverX, PAD + r, WW - PAD - r);
          return <BallView key="held" x={Math.round(x * 10) / 10} y={DIM.dz - 8 - r} r={Math.round(r * 10) / 10} t={g.held} s={1} o={outfit} />;
        })()}

        {play && (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>NEXT</Text>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Fluff t={g.next} r={Math.round(TIERS[g.next].rf * 200)} o={outfit} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

/* ================================================================== */
/* SHARED SMALL UI                                                     */
/* ================================================================== */

export function Pill({ icon, value, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={styles.pillText}>{value}</Text>
    </Pressable>
  );
}

export function RoundBtn({ onPress, children, size = 40, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: C.card, borderWidth: 2, borderColor: C.cardEdge, alignItems: 'center', justifyContent: 'center', elevation: 2 },
        pressed && { transform: [{ scale: 0.94 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ================================================================== */
/* MERGE SCREEN                                                        */
/* ================================================================== */

export default function MergeJar({ world: g, gameState, setGameState, run, setRun, theme, toast, onExit }) {
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const k = stage.w ? Math.max(0.3, Math.min((stage.w - 24) / WW, (stage.h - 12) / DIM.bh)) : 0;
  const left = (stage.w - WW * k) / 2;
  const L = useRef({});
  L.current = { run, setRun, setGameState, k: k || 1, left };
  const calm = !!(gameState.settings && gameState.settings.reduceMotion);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { k: kk, left: ll } = L.current;
          g.tx = e.nativeEvent.locationX;
          g.ty = e.nativeEvent.locationY;
          g.hoverX = (g.tx - ll) / kk;
        },
        onPanResponderMove: (e, gesture) => {
          const { k: kk, left: ll } = L.current;
          g.hoverX = (g.tx + gesture.dx - ll) / kk;
        },
        onPanResponderRelease: (e, gesture) => {
          const { run: r, setRun: sr, setGameState: sg, k: kk, left: ll } = L.current;
          if (g.over) return;
          if (r.armed) {
            const hit = popAt(g, (g.tx + gesture.dx - ll) / kk, (g.ty + gesture.dy - 6) / kk);
            if (hit) {
              spendPower(sg, 'pop');
              sr((x) => ({ ...x, armed: false }));
            }
          } else {
            dropBall(g);
          }
        },
      }),
    [g]
  );

  const usePower = (key) => {
    if (run.over) return;
    const has = (gameState.powers[key] || 0) > 0;
    const canGem = gameState.gems > 0;
    if (key === 'pop') {
      if (run.armed) setRun((x) => ({ ...x, armed: false }));
      else if (has || canGem) setRun((x) => ({ ...x, armed: true }));
      else toast('Out of Pop. Visit the Shop');
      return;
    }
    if (!has && !canGem) { toast('Out of power-ups. Visit the Shop'); return; }

    if (key === 'sweep') {
      const gone = g.balls.filter((b) => b.t <= 1);
      if (!gone.length) { toast('Nothing to sweep'); return; }
      spendPower(setGameState, key);
      gone.forEach((b) => addFx(g, b.x, b.y, b.r, TIERS[b.t].color));
      g.delta.coins += gone.length;
      g.balls = g.balls.filter((b) => b.t > 1);
    } else if (key === 'grow') {
      if (g.held == null || g.held >= GROW_CAP) { toast('Cannot grow this one'); return; }
      spendPower(setGameState, key);
      g.held = Math.min(GROW_CAP, g.held + 2);
    } else if (key === 'shake') {
      if (!g.balls.length) { toast('Jar is empty'); return; }
      spendPower(setGameState, key);
      g.balls.forEach((b) => {
        b.vy -= WW * (0.6 + Math.random() * 0.9);
        b.vx += (Math.random() - 0.5) * WW * 1.4;
        b.overT = 0;
      });
    }
  };

  const restart = () => {
    resetWorld(g);
    setRun({ score: 0, over: false, armed: false });
  };

  const ch = gameState.challenge;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <RoundBtn onPress={onExit}>
          <Text style={{ fontSize: 20, color: C.text, fontWeight: '900' }}>‹</Text>
        </RoundBtn>
        <Pill icon="🪙" value={gameState.coins} />
        <Pill icon="💎" value={gameState.gems} />
        <View style={{ flex: 1 }} />
        <Pill icon="⭐" value={run.score} />
      </View>

      {ch ? (
        <View style={styles.targetCard}>
          <Text style={styles.targetText}>🎯 Stage {ch.stage}: {Math.min(run.score, ch.target)} / {ch.target}</Text>
          <View style={styles.targetBack}>
            <View style={{ width: `${clamp((run.score / ch.target) * 100, 0, 100)}%`, height: '100%', borderRadius: 999, backgroundColor: C.pink }} />
          </View>
        </View>
      ) : (
        <View style={styles.legend}>
          {TIERS.map((t, i) => (
            <View key={t.name} style={{ width: 8 + i * 1.8, height: 8 + i * 1.8, borderRadius: 10, backgroundColor: t.color, borderWidth: 1.5, borderColor: t.edge }} />
          ))}
        </View>
      )}

      <View style={{ flex: 1 }} onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {k > 0 && (
          <View style={{ ...abs, left, top: 6 }}>
            <JarBoard g={g} k={k} mode="play" theme={theme} outfit={gameState.equippedOutfit} calm={calm} />
          </View>
        )}
        {run.armed && (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>Tap a fluff to pop it</Text>
          </View>
        )}
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
      </View>

      <View style={styles.powerBar}>
        {POWER_DEFS.map((p) => {
          const count = gameState.powers[p.key] || 0;
          const armed = p.key === 'pop' && run.armed;
          return (
            <Pressable
              key={p.key}
              onPress={() => usePower(p.key)}
              style={({ pressed }) => [styles.powerBtn, armed && { backgroundColor: '#FFC1D0', borderColor: C.pink }, pressed && { transform: [{ scale: 0.95 }] }]}
            >
              <Text style={{ fontSize: 24 }}>{p.icon}</Text>
              <Text style={styles.powerLabel}>{p.name}</Text>
              <View style={[styles.badge, count <= 0 && { backgroundColor: '#8FC7F0' }]}>
                <Text style={styles.badgeText}>{count > 0 ? count : '💎1'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Modal transparent visible={run.over} animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalBack}>
          <View style={[styles.sheet, { alignItems: 'center', width: 280 }]}>
            <Text style={{ fontSize: 44 }}>🫙</Text>
            <Text style={styles.overTitle}>Jar is full!</Text>
            <Text style={styles.overLine}>Score  {run.score}</Text>
            <Text style={styles.overLine}>Best  {gameState.best}</Text>
            <Pressable onPress={restart} style={({ pressed }) => [styles.bigBtn, pressed && { transform: [{ scale: 0.96 }] }]}>
              <Text style={styles.bigBtnText}>Play again</Text>
            </Pressable>
            <Pressable onPress={() => { restart(); onExit(); }} style={{ marginTop: 12, padding: 6 }}>
              <Text style={{ color: C.soft, fontWeight: '800' }}>Back home</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================================================================== */
/* STYLES                                                              */
/* ================================================================== */

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7, borderWidth: 2, borderColor: C.cardEdge, elevation: 2,
  },
  pillIcon: { fontSize: 16, marginRight: 6 },
  pillText: { fontSize: 16, fontWeight: '800', color: C.text, minWidth: 18 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingBottom: 4, minHeight: 34 },
  targetCard: { marginHorizontal: 14, marginBottom: 6, backgroundColor: C.card, borderRadius: 20, borderWidth: 2, borderColor: C.cardEdge, paddingHorizontal: 14, paddingVertical: 6 },
  targetText: { color: C.text, fontWeight: '900', fontSize: 13 },
  targetBack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(122,74,50,0.14)', overflow: 'hidden', marginTop: 4 },

  nextCard: { ...abs, right: 2, top: 0, width: 62, height: 66, backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 22, borderWidth: 2, borderColor: C.cardEdge, alignItems: 'center', paddingTop: 4 },
  nextLabel: { fontSize: 9, fontWeight: '800', color: C.text, letterSpacing: 1 },
  hint: { ...abs, left: 0, right: 0, top: 4, alignItems: 'center' },
  hintText: { backgroundColor: '#FFC1D0', color: C.text, fontWeight: '800', fontSize: 13, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },

  powerBar: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14, gap: 8 },
  powerBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: C.card, borderRadius: 26, borderWidth: 2, borderColor: C.cardEdge, elevation: 2 },
  powerLabel: { fontSize: 11, fontWeight: '800', color: C.text, marginTop: 1 },
  badge: { ...abs, top: -7, right: -3, minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  modalBack: { flex: 1, backgroundColor: 'rgba(90,55,40,0.45)', alignItems: 'center', justifyContent: 'center' },
  sheet: { width: '88%', maxWidth: 340, backgroundColor: '#FFF6EA', borderRadius: 34, padding: 20, borderWidth: 3, borderColor: C.cardEdge },
  overTitle: { fontSize: 26, fontWeight: '900', color: C.text, marginTop: 4, marginBottom: 6 },
  overLine: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 2 },
  bigBtn: { marginTop: 16, backgroundColor: C.pink, borderBottomColor: C.pinkDark, borderBottomWidth: 5, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 34, alignItems: 'center' },
  bigBtnText: { color: '#fff', fontSize: 20, fontWeight: '900' },
});
