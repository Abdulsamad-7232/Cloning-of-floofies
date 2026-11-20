/**
 * GameScreens.js
 * Collection, shop and progression views for the merge game.
 * Uses only React + standard React Native components.
 *
 * Every view takes { gameState, setGameState, onClose }.
 * setGameState must be a React state setter (functional updates are used).
 *
 * Expected gameState shape (all fields optional, safe defaults are applied;
 * call createInitialGameState() to get a complete one):
 * {
 *   coins: 0, gems: 5, level: 1,
 *   discovered: [true, false, ...],        // 9 booleans, index = tier
 *   ownedOutfits: [], equippedOutfit: 'none',
 *   power: { sweep: 2, pop: 2, grow: 2, shake: 2 },
 *   ownedThemes: ['cozy'], activeTheme: 'cozy',
 *   today: { date: 'YYYY-MM-DD', merges: 0, counts: [0 x 9] },  // counts[tier]
 *   daily: { lastClaim: 'YYYY-MM-DD', streak: 0 },
 * }
 *
 * Usage:
 *   <FluffsTab  gameState={gs} setGameState={setGs} />
 *   <OutfitsTab gameState={gs} setGameState={setGs} />
 *   <ShopTab    gameState={gs} setGameState={setGs} />
 *   <TodayTab   gameState={gs} setGameState={setGs} />
 *   <DailyGiftsModal visible gameState={gs} setGameState={setGs} onClose={...} />
 * Or use the default export: <GameScreens tab="shop" ... />
 */

import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native';

/* ================================================================== */
/* CONFIG                                                              */
/* ================================================================== */

export const TIERS = [
  { value: 1,   name: 'Tan',    color: '#EBD3AE', edge: '#CDAE82', eyes: 'dot',     mouth: 'smile' },
  { value: 2,   name: 'White',  color: '#FFF8EE', edge: '#E6D5C0', eyes: 'dot',     mouth: 'cat'   },
  { value: 4,   name: 'Pink',   color: '#FFBCCB', edge: '#F09BB0', eyes: 'happy',   mouth: 'smile' },
  { value: 8,   name: 'Yellow', color: '#FFE792', edge: '#F0C95E', eyes: 'dot',     mouth: 'open'  },
  { value: 16,  name: 'Blue',   color: '#A9D6F7', edge: '#7FB6E3', eyes: 'sparkle', mouth: 'smile' },
  { value: 32,  name: 'Green',  color: '#B8E6A9', edge: '#8FCB7E', eyes: 'happy',   mouth: 'open'  },
  { value: 64,  name: 'Orange', color: '#FFC38F', edge: '#F0A060', eyes: 'sparkle', mouth: 'cat'   },
  { value: 128, name: 'Purple', color: '#CDB6F2', edge: '#AB8DDB', eyes: 'sparkle', mouth: 'open'  },
  { value: 256, name: 'Red',    color: '#FF9494', edge: '#E56F6F', eyes: 'happy',   mouth: 'open'  },
];

export const OUTFITS = [
  { id: 'dino',   name: 'Baby Dino', icon: '🦖', reward: true },
  { id: 'kitty',  name: 'Kitty',     icon: '🐱', price: { coins: 100 } },
  { id: 'chick',  name: 'Chick',     icon: '🐥', price: { coins: 150 } },
  { id: 'puppy',  name: 'Puppy',     icon: '🐶', price: { coins: 200 } },
  { id: 'crown',  name: 'Crown',     icon: '👑', price: { gems: 5 } },
];

export const POWERS = [
  { key: 'sweep', icon: '🧹', name: 'Sweep', desc: 'Clears Tan and White fluffs', unit: 40 },
  { key: 'pop',   icon: '💥', name: 'Pop',   desc: 'Pops any one fluff',          unit: 40 },
  { key: 'grow',  icon: '🌱', name: 'Grow',  desc: 'Grows the fluff in hand',     unit: 50 },
  { key: 'shake', icon: '🌀', name: 'Shake', desc: 'Shakes up the whole jar',     unit: 30 },
];
const BUNDLE_QTY = 5; // bundle = 5 for the price of 4

export const THEMES = [
  { id: 'cozy',      name: 'Cozy Cream',     bg: '#FFF1E0', glass: 'rgba(255,255,255,0.55)', edge: '#F6C79C', coins: 0,   level: 1  },
  { id: 'mint',      name: 'Mint Meadow',    bg: '#E4F6EA', glass: 'rgba(196,238,210,0.60)', edge: '#A5D9B5', coins: 150, level: 3  },
  { id: 'lavender',  name: 'Lavender Dream', bg: '#EFE7FB', glass: 'rgba(214,196,242,0.60)', edge: '#C7B2EA', coins: 250, level: 5  },
  { id: 'peach',     name: 'Peach Sunset',   bg: '#FFE0D2', glass: 'rgba(255,205,180,0.60)', edge: '#F5B79F', coins: 350, level: 8  },
  { id: 'starlight', name: 'Starlight',      bg: '#34305A', glass: 'rgba(170,160,230,0.35)', edge: '#8F86D8', coins: 500, level: 12 },
];

// Day 1..7 login gifts.
export const DAILY_GIFTS = [
  { gems: 1 },
  { power: { sweep: 1 } },
  { gems: 2 },
  { skin: 'chick' },
  { power: { pop: 1, grow: 1 } },
  { gems: 3 },
  { skin: 'crown', gems: 5 },
];

const C = {
  card: '#FFE3C7',
  cardEdge: '#F6C79C',
  cream: '#FFF6EA',
  text: '#7A4A32',
  soft: '#A8806A',
  pink: '#FF8FA3',
  pinkDark: '#E96F88',
  green: '#8FD28A',
  grey: '#E4D5C6',
};

/* ================================================================== */
/* STATE HELPERS                                                       */
/* ================================================================== */

const pad2 = (n) => (n < 10 ? '0' : '') + n;
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const prevDayKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const prettyDate = (d = new Date()) => `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;

const zeros = () => TIERS.map(() => 0);

export function createInitialGameState() {
  return {
    coins: 0,
    gems: 5,
    level: 1,
    discovered: TIERS.map((_, i) => i === 0),
    ownedOutfits: [],
    equippedOutfit: 'none',
    power: { sweep: 2, pop: 2, grow: 2, shake: 2 },
    ownedThemes: ['cozy'],
    activeTheme: 'cozy',
    today: { date: dayKey(), merges: 0, counts: zeros() },
    daily: { lastClaim: '', streak: 0 },
  };
}

// Fills in anything missing so the views never crash on partial state.
function norm(gs) {
  const g = gs || {};
  return {
    coins: g.coins ?? 0,
    gems: g.gems ?? 0,
    level: g.level ?? 1,
    discovered: g.discovered ?? TIERS.map((_, i) => i === 0),
    ownedOutfits: g.ownedOutfits ?? [],
    equippedOutfit: g.equippedOutfit ?? 'none',
    power: { sweep: 0, pop: 0, grow: 0, shake: 0, ...(g.power || {}) },
    ownedThemes: g.ownedThemes ?? ['cozy'],
    activeTheme: g.activeTheme ?? 'cozy',
    today: g.today ?? { date: '', merges: 0, counts: zeros() },
    daily: g.daily ?? { lastClaim: '', streak: 0 },
  };
}

const costLabel = (p) => (p.coins ? `🪙 ${p.coins}` : p.gems ? `💎 ${p.gems}` : 'Free');

// Returns a reason string if the player cannot pay, otherwise ''.
function shortBy(s, cost) {
  if (s.coins < (cost.coins || 0)) return 'Not enough coins';
  if (s.gems < (cost.gems || 0)) return 'Not enough gems';
  return '';
}

// Deducts cost and applies `apply` in one functional update (re-checks funds).
function spendAndApply(setGameState, cost, apply) {
  setGameState((prev) => {
    const p = norm(prev);
    if (shortBy(p, cost)) return prev;
    return apply({
      ...prev,
      coins: p.coins - (cost.coins || 0),
      gems: p.gems - (cost.gems || 0),
    });
  });
}

function useNote() {
  const [note, setNote] = useState('');
  const timer = useRef(null);
  const show = (m) => {
    setNote(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(''), 1700);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return [note, show];
}

/* ================================================================== */
/* FLUFF VISUALS (faces + outfits)                                     */
/* ================================================================== */

const INK = '#5B3A2E';
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

const Fluff = memo(function Fluff({ t, r, o }) {
  const has = o && o !== 'none';
  return (
    <View style={{ width: r * 2, height: r * 2 }}>
      {has && <Outfit id={o} r={r} t={t} front={false} />}
      <Blob t={t} r={r} />
      {has && <Outfit id={o} r={r} t={t} front />}
    </View>
  );
});

/* ================================================================== */
/* SMALL SHARED UI                                                     */
/* ================================================================== */

function Header({ title, subtitle, s, onClose }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h1}>{title}</Text>
        {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>
      {s && (
        <View style={styles.balances}>
          <View style={styles.pill}><Text style={styles.pillText}>🪙 {s.coins}</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>💎 {s.gems}</Text></View>
        </View>
      )}
      {typeof onClose === 'function' && (
        <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

function Btn({ label, onPress, tone = 'pink', style }) {
  const bg = tone === 'green' ? C.green : tone === 'grey' ? C.grey : C.pink;
  const dark = tone === 'green' ? '#6FB86A' : tone === 'grey' ? '#CDBBA8' : C.pinkDark;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, borderBottomColor: dark }, pressed && { transform: [{ scale: 0.96 }] }, style]}
    >
      <Text style={[styles.btnText, tone === 'grey' && { color: C.text }]}>{label}</Text>
    </Pressable>
  );
}

function Bar({ value, max, color = C.pink }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <View style={styles.barBack}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

function Note({ text }) {
  if (!text) return null;
  return (
    <View style={styles.noteWrap} pointerEvents="none">
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

/* ================================================================== */
/* 1. FLUFFS TAB                                                       */
/* ================================================================== */

export function FluffsTab({ gameState, setGameState, onClose }) {
  const s = norm(gameState);
  const found = TIERS.filter((_, i) => s.discovered[i]).length;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header title="Fluffs" subtitle="Merge to discover them all" s={s} onClose={onClose} />
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Collection</Text>
          <Text style={styles.cardTitle}>{found} / {TIERS.length}</Text>
        </View>
        <Bar value={found} max={TIERS.length} />

        <View style={styles.grid}>
          {TIERS.map((t, i) => {
            const on = !!s.discovered[i];
            return (
              <View key={t.name} style={[styles.tierCard, !on && { backgroundColor: '#EADFD3', borderColor: '#D9CABA' }]}>
                <View style={{ height: 80, alignItems: 'center', justifyContent: 'flex-end' }}>
                  {on ? (
                    <Fluff t={i} r={14 + i * 2.6} o={s.equippedOutfit} />
                  ) : (
                    <View style={styles.lockCircle}>
                      <Text style={{ fontSize: 24 }}>🔒</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.tierName}>{on ? t.name : 'Locked'}</Text>
                <Text style={styles.tierValue}>{on ? `Tier ${t.value}` : '???'}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/* ================================================================== */
/* 2. OUTFITS TAB                                                      */
/* ================================================================== */

export function OutfitsTab({ gameState, setGameState, onClose }) {
  const s = norm(gameState);
  const [note, showNote] = useNote();
  const current = OUTFITS.find((o) => o.id === s.equippedOutfit);

  const toggleEquip = (id) => {
    setGameState((prev) => {
      const p = norm(prev);
      if (!p.ownedOutfits.includes(id)) return prev;
      return { ...prev, equippedOutfit: p.equippedOutfit === id ? 'none' : id };
    });
  };

  const buy = (o) => {
    const why = shortBy(s, o.price);
    if (why) { showNote(why); return; }
    spendAndApply(setGameState, o.price, (next) => ({
      ...next,
      ownedOutfits: norm(next).ownedOutfits.concat(o.id),
      equippedOutfit: o.id,
    }));
    showNote(`${o.name} unlocked!`);
  };

  const claimReward = (o) => {
    setGameState((prev) => {
      const p = norm(prev);
      if (p.ownedOutfits.includes(o.id)) return prev;
      return { ...prev, ownedOutfits: p.ownedOutfits.concat(o.id), equippedOutfit: o.id };
    });
    showNote(`${o.name} is yours!`);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header title="Outfits" subtitle="Hats and ears for every fluff" s={s} onClose={onClose} />

        <View style={styles.previewCard}>
          <View style={{ paddingTop: 38 }}>
            <Fluff t={2} r={46} o={s.equippedOutfit} />
          </View>
          <Text style={styles.tierName}>{current ? current.name : 'No outfit'}</Text>
        </View>

        <View style={styles.grid}>
          {OUTFITS.map((o) => {
            const owned = s.ownedOutfits.includes(o.id);
            const equipped = s.equippedOutfit === o.id;
            return (
              <View key={o.id} style={styles.outfitCard}>
                <View style={{ height: 84, alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Fluff t={2} r={26} o={o.id} />
                </View>
                <Text style={styles.tierName}>{o.icon} {o.name}</Text>
                {owned ? (
                  <Btn label={equipped ? 'Equipped ✓' : 'Equip'} tone={equipped ? 'green' : 'grey'} onPress={() => toggleEquip(o.id)} style={styles.cardBtn} />
                ) : o.reward ? (
                  <Btn label="🎁 Claim reward" onPress={() => claimReward(o)} style={styles.cardBtn} />
                ) : (
                  <Btn label={costLabel(o.price)} onPress={() => buy(o)} style={styles.cardBtn} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Note text={note} />
    </View>
  );
}

/* ================================================================== */
/* 3. SHOP TAB                                                         */
/* ================================================================== */

export function ShopTab({ gameState, setGameState, onClose }) {
  const s = norm(gameState);
  const [note, showNote] = useNote();

  const buyPower = (p, qty) => {
    const cost = { coins: p.unit * (qty === BUNDLE_QTY ? BUNDLE_QTY - 1 : qty) };
    const why = shortBy(s, cost);
    if (why) { showNote(why); return; }
    spendAndApply(setGameState, cost, (next) => {
      const n = norm(next);
      return { ...next, power: { ...n.power, [p.key]: n.power[p.key] + qty } };
    });
    showNote(`+${qty} ${p.name}`);
  };

  const useTheme = (id) => {
    setGameState((prev) => (norm(prev).ownedThemes.includes(id) ? { ...prev, activeTheme: id } : prev));
  };

  const unlockByLevel = (th) => {
    if (s.level < th.level) return;
    setGameState((prev) => {
      const p = norm(prev);
      if (p.level < th.level || p.ownedThemes.includes(th.id)) return prev;
      return { ...prev, ownedThemes: p.ownedThemes.concat(th.id), activeTheme: th.id };
    });
    showNote(`${th.name} unlocked!`);
  };

  const buyTheme = (th) => {
    const cost = { coins: th.coins };
    const why = shortBy(s, cost);
    if (why) { showNote(why); return; }
    spendAndApply(setGameState, cost, (next) => ({
      ...next,
      ownedThemes: norm(next).ownedThemes.concat(th.id),
      activeTheme: th.id,
    }));
    showNote(`${th.name} unlocked!`);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header title="Shop" subtitle={`Player level ${s.level}`} s={s} onClose={onClose} />

        <Text style={styles.h2}>Power-ups</Text>
        {POWERS.map((p) => (
          <View key={p.key} style={styles.shopRow}>
            <View style={styles.iconBox}><Text style={{ fontSize: 26 }}>{p.icon}</Text></View>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={styles.rowTitle}>{p.name}  <Text style={{ color: C.soft }}>×{s.power[p.key]}</Text></Text>
              <Text style={styles.rowDesc}>{p.desc}</Text>
              <View style={styles.btnRow}>
                <Btn label={`×1  🪙 ${p.unit}`} onPress={() => buyPower(p, 1)} style={styles.smallBtn} />
                <Btn label={`×${BUNDLE_QTY}  🪙 ${p.unit * (BUNDLE_QTY - 1)}`} onPress={() => buyPower(p, BUNDLE_QTY)} style={styles.smallBtn} />
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.h2}>Jar themes</Text>
        {THEMES.map((th) => {
          const owned = s.ownedThemes.includes(th.id);
          const active = s.activeTheme === th.id;
          const levelOk = s.level >= th.level;
          return (
            <View key={th.id} style={styles.shopRow}>
              <View style={[styles.swatch, { backgroundColor: th.bg, borderColor: th.edge }]}>
                <View style={{ width: 28, height: 36, borderBottomLeftRadius: 11, borderBottomRightRadius: 11, borderWidth: 3, borderTopWidth: 0, borderColor: th.edge, backgroundColor: th.glass }} />
              </View>
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={styles.rowTitle}>{th.name}</Text>
                <Text style={styles.rowDesc}>
                  {owned
                    ? active ? 'In use' : 'Owned'
                    : th.coins === 0 ? 'Free' : `🪙 ${th.coins} or Level ${th.level}`}
                </Text>
              </View>
              {owned ? (
                <Btn label={active ? 'Using ✓' : 'Use'} tone={active ? 'green' : 'grey'} onPress={() => useTheme(th.id)} style={styles.sideBtn} />
              ) : levelOk ? (
                <Btn label={`Unlock · Lv ${th.level}`} tone="green" onPress={() => unlockByLevel(th)} style={styles.sideBtn} />
              ) : (
                <View style={{ alignItems: 'flex-end' }}>
                  <Btn label={`🪙 ${th.coins}`} onPress={() => buyTheme(th)} style={styles.sideBtn} />
                  <Text style={[styles.rowDesc, { marginTop: 3 }]}>🔒 Level {th.level}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      <Note text={note} />
    </View>
  );
}

/* ================================================================== */
/* 4. TODAY TAB                                                        */
/* ================================================================== */

export function TodayTab({ gameState, setGameState, onClose }) {
  const s = norm(gameState);
  const key = dayKey();

  // roll over to a fresh day record if the stored one is old
  useEffect(() => {
    setGameState((prev) => {
      const t = prev && prev.today;
      if (t && t.date === key) return prev;
      return { ...prev, today: { date: key, merges: 0, counts: zeros() } };
    });
  }, [key]);

  const isToday = s.today.date === key;
  const counts = isToday && Array.isArray(s.today.counts) ? s.today.counts : zeros();
  const total = isToday ? (s.today.merges ?? counts.reduce((a, b) => a + b, 0)) : 0;

  const ranked = TIERS.map((t, i) => ({ i, t, n: counts[i] || 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || b.i - a.i);
  const max = ranked.length ? ranked[0].n : 1;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header title="Today" subtitle={prettyDate()} onClose={onClose} />

        <View style={styles.bigStat}>
          <Text style={styles.bigStatNum}>{total}</Text>
          <Text style={styles.bigStatLabel}>merges today</Text>
          {ranked.length > 0 && (
            <Text style={[styles.rowDesc, { marginTop: 4 }]}>Favorite: {ranked[0].t.name}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Most merged tiers</Text>
          {ranked.length === 0 ? (
            <Text style={[styles.rowDesc, { marginTop: 10, fontSize: 14 }]}>No merges yet today. Go play!</Text>
          ) : (
            ranked.map((x, idx) => (
              <View key={x.i} style={styles.rankRow}>
                <Text style={styles.rankNo}>{idx < 3 ? medals[idx] : `#${idx + 1}`}</Text>
                <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Fluff t={x.i} r={10 + x.i * 0.9} o={s.equippedOutfit} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={styles.rowTitle}>{x.t.name}</Text>
                  <Bar value={x.n} max={max} color={x.t.edge} />
                </View>
                <Text style={styles.rankCount}>×{x.n}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ================================================================== */
/* 5. DAILY GIFTS MODAL                                                */
/* ================================================================== */

function describeGift(g) {
  const parts = [];
  if (g.gems) parts.push(`+${g.gems} Gem${g.gems > 1 ? 's' : ''}`);
  if (g.power) {
    Object.keys(g.power).forEach((k) => {
      const p = POWERS.find((x) => x.key === k);
      parts.push(`+${g.power[k]} ${p ? p.name : k}`);
    });
  }
  if (g.skin) {
    const o = OUTFITS.find((x) => x.id === g.skin);
    parts.push(`${o ? o.name : 'Skin'} skin`);
  }
  return parts.join(', ');
}

function giftIcon(g) {
  if (g.skin) return (OUTFITS.find((x) => x.id === g.skin) || {}).icon || '🎀';
  if (g.power) return (POWERS.find((x) => x.key === Object.keys(g.power)[0]) || {}).icon || '⚡';
  return '💎';
}

// Works out where the player is in the 7-day cycle.
function dailyStatus(daily, today) {
  const last = daily.lastClaim || '';
  const claimedToday = last === today;
  const active = claimedToday || last === prevDayKey(today) ? daily.streak || 0 : 0;
  const lastDay = active === 0 ? 0 : ((active - 1) % 7) + 1;
  const nextDay = claimedToday ? null : active === 0 ? 1 : (active % 7) + 1;
  const doneCount = claimedToday ? lastDay : active % 7 === 0 ? 0 : lastDay;
  return { claimedToday, active, nextDay, doneCount };
}

export function DailyGiftsModal({ gameState, setGameState, onClose, visible = true }) {
  const s = norm(gameState);
  const today = dayKey();
  const st = dailyStatus(s.daily, today);
  const [msg, setMsg] = useState('');

  const claim = () => {
    if (st.claimedToday || !st.nextDay) return;
    const gift = DAILY_GIFTS[st.nextDay - 1];
    let converted = false;

    setGameState((prev) => {
      const p = norm(prev);
      const d = dailyStatus(p.daily, today);
      if (d.claimedToday || !d.nextDay) return prev;
      const g = DAILY_GIFTS[d.nextDay - 1];

      let gems = p.gems + (g.gems || 0);
      const power = { ...p.power };
      if (g.power) Object.keys(g.power).forEach((k) => { power[k] = (power[k] || 0) + g.power[k]; });
      let ownedOutfits = p.ownedOutfits;
      if (g.skin) {
        if (ownedOutfits.includes(g.skin)) gems += 2; // duplicate skin turns into gems
        else ownedOutfits = ownedOutfits.concat(g.skin);
      }
      const newStreak = d.active + 1;
      return { ...prev, gems, power, ownedOutfits, daily: { lastClaim: today, streak: newStreak } };
    });

    if (gift.skin && s.ownedOutfits.includes(gift.skin)) converted = true;
    setMsg(converted ? 'You already own that skin: +2 Gems instead' : `Claimed: ${describeGift(gift)}`);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBack} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.rowBetween}>
            <Text style={styles.h1}>Daily Gifts 🎁</Text>
            {typeof onClose === 'function' && (
              <Pressable onPress={onClose} style={styles.closeBtn}><Text style={styles.closeText}>✕</Text></Pressable>
            )}
          </View>
          <Text style={styles.sub}>Login streak: {st.active} day{st.active === 1 ? '' : 's'}</Text>

          <View style={styles.dailyGrid}>
            {DAILY_GIFTS.map((g, idx) => {
              const day = idx + 1;
              const done = day <= st.doneCount;
              const isNext = st.nextDay === day;
              const wide = day === 7;
              return (
                <View
                  key={day}
                  style={[
                    styles.dayTile,
                    wide && { width: '48%' },
                    done && { backgroundColor: '#DDF3D8', borderColor: C.green },
                    isNext && { backgroundColor: '#FFD6E0', borderColor: C.pink },
                  ]}
                >
                  <Text style={styles.dayLabel}>Day {day}</Text>
                  <Text style={{ fontSize: wide ? 34 : 26, marginVertical: 2 }}>{giftIcon(g)}</Text>
                  <Text style={styles.dayGift} numberOfLines={2}>{describeGift(g)}</Text>
                  {done && <Text style={styles.tick}>✓</Text>}
                </View>
              );
            })}
          </View>

          {!!msg && <Text style={styles.claimMsg}>{msg}</Text>}

          <Btn
            label={st.claimedToday ? 'Come back tomorrow' : 'Claim'}
            tone={st.claimedToday ? 'grey' : 'pink'}
            onPress={claim}
            style={{ marginTop: 12, paddingVertical: 13 }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ================================================================== */
/* OPTIONAL ROUTER                                                     */
/* ================================================================== */

export default function GameScreens({ tab = 'fluffs', ...rest }) {
  if (tab === 'outfits') return <OutfitsTab {...rest} />;
  if (tab === 'shop') return <ShopTab {...rest} />;
  if (tab === 'today') return <TodayTab {...rest} />;
  if (tab === 'daily') return <DailyGiftsModal {...rest} />;
  return <FluffsTab {...rest} />;
}

/* ================================================================== */
/* STYLES                                                              */
/* ================================================================== */

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 14, paddingBottom: 28 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  h1: { fontSize: 28, fontWeight: '900', color: C.text },
  h2: { fontSize: 20, fontWeight: '900', color: C.text, marginTop: 16, marginBottom: 8 },
  sub: { fontSize: 13, fontWeight: '700', color: C.soft },
  balances: { flexDirection: 'row', gap: 6 },
  pill: { backgroundColor: C.card, borderRadius: 999, borderWidth: 2, borderColor: C.cardEdge, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: C.text, fontWeight: '900', fontSize: 13 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, borderWidth: 2, borderColor: C.cardEdge, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: C.text, fontWeight: '900' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { color: C.text, fontWeight: '900', fontSize: 16 },
  barBack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(122,74,50,0.14)', overflow: 'hidden', marginTop: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14 },
  tierCard: { width: '31%', backgroundColor: C.card, borderRadius: 26, borderWidth: 2, borderColor: C.cardEdge, alignItems: 'center', paddingVertical: 10, marginBottom: 10 },
  tierName: { color: C.text, fontWeight: '900', fontSize: 14, marginTop: 6 },
  tierValue: { color: C.soft, fontWeight: '700', fontSize: 11 },
  lockCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#D3C4B4', alignItems: 'center', justifyContent: 'center' },

  previewCard: { backgroundColor: '#FFD6E0', borderRadius: 32, borderWidth: 2, borderColor: C.pink, alignItems: 'center', paddingBottom: 12 },
  outfitCard: { width: '48%', backgroundColor: C.card, borderRadius: 26, borderWidth: 2, borderColor: C.cardEdge, alignItems: 'center', padding: 10, marginBottom: 10 },
  cardBtn: { marginTop: 8, alignSelf: 'stretch' },

  btn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 3 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  smallBtn: { flex: 1 },
  sideBtn: { minWidth: 96 },
  btnRow: { flexDirection: 'row', gap: 6, marginTop: 8 },

  shopRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 26, borderWidth: 2, borderColor: C.cardEdge, padding: 10, marginBottom: 10 },
  iconBox: { width: 50, height: 56, borderRadius: 16, backgroundColor: '#FFF3E4', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 50, height: 56, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: C.text, fontWeight: '900', fontSize: 16 },
  rowDesc: { color: C.soft, fontWeight: '700', fontSize: 12 },

  bigStat: { backgroundColor: '#FFD6E0', borderRadius: 30, borderWidth: 2, borderColor: C.pink, alignItems: 'center', paddingVertical: 18, marginBottom: 12 },
  bigStatNum: { fontSize: 52, fontWeight: '900', color: C.text },
  bigStatLabel: { fontSize: 15, fontWeight: '800', color: C.soft },
  card: { backgroundColor: C.card, borderRadius: 26, borderWidth: 2, borderColor: C.cardEdge, padding: 14, marginBottom: 12 },
  rankRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  rankNo: { width: 34, fontSize: 18, fontWeight: '900', color: C.text },
  rankCount: { color: C.text, fontWeight: '900', fontSize: 16, minWidth: 36, textAlign: 'right' },

  modalBack: { flex: 1, backgroundColor: 'rgba(90,55,40,0.45)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '92%', maxWidth: 380, backgroundColor: C.cream, borderRadius: 34, padding: 18, borderWidth: 3, borderColor: C.cardEdge },
  dailyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  dayTile: { width: '23%', minHeight: 104, backgroundColor: C.card, borderRadius: 20, borderWidth: 2, borderColor: C.cardEdge, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 3, marginBottom: 8 },
  dayLabel: { color: C.soft, fontWeight: '900', fontSize: 11 },
  dayGift: { color: C.text, fontWeight: '800', fontSize: 10, textAlign: 'center' },
  tick: { position: 'absolute', top: 4, right: 8, color: '#4FA84A', fontWeight: '900', fontSize: 14 },
  claimMsg: { color: C.text, fontWeight: '800', fontSize: 13, textAlign: 'center', marginTop: 6 },

  noteWrap: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' },
  noteText: { backgroundColor: 'rgba(90,55,40,0.92)', color: '#fff', fontWeight: '800', fontSize: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, overflow: 'hidden' },
});
