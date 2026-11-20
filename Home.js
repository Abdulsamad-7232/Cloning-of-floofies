/**
 * Home.js
 * Home dashboard plus the top bar and bottom tab navigation.
 *
 * Default export <Home /> props:
 *   gameState   central state
 *   world       physics world (for the live jar preview)
 *   theme       jar colors { ink, glass, glassEdge, rim, swatchEdge }
 *   toast       (text) => void
 *   onPlay      () => void           open the merge screen
 *   onOpen      (modalName) => void  'daily' | 'leagues' | 'adventure' | 'profile' | 'settings'
 *   onTab       (tabKey) => void
 *
 * Also exports TopBar and BottomNav.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Fluff, JarBoard, Pill, RoundBtn, WW, DIM, C, dayKey } from './MergeJar';

export const TABS = [
  { key: 'home',    icon: '🏠', label: 'Home' },
  { key: 'fluffs',  icon: '🐣', label: 'Fluffs' },
  { key: 'outfits', icon: '🎀', label: 'Outfits' },
  { key: 'today',   icon: '📅', label: 'Today' },
  { key: 'shop',    icon: '🛍️', label: 'Shop' },
];

const ADVENTURE_LEVEL = 2; // player level that unlocks the Adventure map

/* ================================================================== */
/* TOP BAR                                                             */
/* ================================================================== */

export function TopBar({ gameState, onOpen, onTab }) {
  // avatar is a tier index; the outfit is shown on it too
  return (
    <View style={styles.topBar}>
      <RoundBtn onPress={() => onOpen('settings')}>
        <Text style={{ fontSize: 20 }}>⚙️</Text>
      </RoundBtn>
      <Pill icon="🪙" value={gameState.coins} onPress={() => onTab('shop')} />
      <Pill icon="💎" value={gameState.gems} onPress={() => onTab('shop')} />
      <View style={{ flex: 1 }} />
      <RoundBtn onPress={() => onOpen('profile')} size={44} style={{ overflow: 'visible', backgroundColor: '#FFD6E0' }}>
        <View style={{ marginTop: 4 }}>
          <Fluff t={gameState.avatar || 0} r={13} o={gameState.equippedOutfit} />
        </View>
      </RoundBtn>
    </View>
  );
}

/* ================================================================== */
/* BOTTOM NAV                                                          */
/* ================================================================== */

export function BottomNav({ tab, onTab }) {
  return (
    <View style={styles.nav}>
      {TABS.map((t) => {
        const on = t.key === tab;
        return (
          <Pressable key={t.key} onPress={() => onTab(t.key)} style={[styles.navItem, on && styles.navItemOn]}>
            <Text style={{ fontSize: 22 }}>{t.icon}</Text>
            <Text style={[styles.navLabel, on && { color: '#fff' }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ================================================================== */
/* HOME DASHBOARD                                                      */
/* ================================================================== */

export default function Home({ gameState, world, theme, toast, onPlay, onOpen, onTab }) {
  const [area, setArea] = useState({ w: 0, h: 0 });
  const topCut = DIM.dz - 14;
  const k = area.w ? Math.max(0.2, Math.min((area.w * 0.62) / WW, (area.h - 12) / (DIM.bh - topCut))) : 0;
  const unclaimed = gameState.dailyLastClaim !== dayKey();
  const advOpen = gameState.level >= ADVENTURE_LEVEL;
  const calm = !!(gameState.settings && gameState.settings.reduceMotion);

  const floating = [
    { icon: '🎁', label: 'Daily', dot: unclaimed, onPress: () => onOpen('daily') },
    { icon: '🏆', label: 'Leagues', onPress: () => onOpen('leagues') },
    { icon: '🛒', label: 'Shop', onPress: () => onTab('shop') },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.logoRow}>
        <Fluff t={2} r={12} o="none" />
        <Text style={styles.logo}>Fluff Jar</Text>
        <Fluff t={3} r={12} o="none" />
      </View>

      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {k > 0 && <JarBoard g={world} k={k} mode="preview" theme={theme} outfit={gameState.equippedOutfit} calm={calm} />}
      </View>

      <View style={styles.floatCol}>
        {floating.map((b) => (
          <View key={b.label} style={{ alignItems: 'center' }}>
            <RoundBtn onPress={b.onPress} size={52}>
              <Text style={{ fontSize: 24 }}>{b.icon}</Text>
              {b.dot && <View style={styles.dot} />}
            </RoundBtn>
            <Text style={[styles.floatLabel, { color: theme.ink }]}>{b.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <View style={styles.levelPill}>
          <Text style={styles.levelText}>Level {gameState.level} · Keep growing!</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 10, gap: 10 }}>
        <Pressable
          onPress={onPlay}
          style={({ pressed }) => [styles.bigBtn, { backgroundColor: C.pink, borderBottomColor: C.pinkDark }, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <Text style={styles.bigBtnText}>Resume my jar</Text>
        </Pressable>
        <Pressable
          onPress={() => (advOpen ? onOpen('adventure') : toast(`Reach level ${ADVENTURE_LEVEL} to unlock Adventure`))}
          style={({ pressed }) => [
            styles.bigBtn,
            { backgroundColor: '#B9A2E8', borderBottomColor: '#9A82CF', opacity: advOpen ? 1 : 0.9, paddingVertical: 13 },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={[styles.bigBtnText, { fontSize: 17 }]}>{advOpen ? '🗺️  Adventure' : '🔒  Adventure'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ================================================================== */
/* STYLES                                                              */
/* ================================================================== */

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, gap: 8 },

  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 4 },
  logo: {
    fontSize: 36, fontWeight: '900', color: C.pink, letterSpacing: 0.5,
    textShadowColor: 'rgba(255,255,255,0.95)', textShadowOffset: { width: 2, height: 3 }, textShadowRadius: 0,
  },
  floatCol: { position: 'absolute', right: 10, top: 80, gap: 14 },
  floatLabel: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  dot: { position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF5A6E', borderWidth: 2, borderColor: C.white },
  levelPill: { backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8, borderWidth: 2, borderColor: C.cardEdge },
  levelText: { color: C.text, fontWeight: '800', fontSize: 15 },
  bigBtn: { borderRadius: 999, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 5 },
  bigBtnText: { color: '#fff', fontSize: 21, fontWeight: '900' },

  nav: {
    flexDirection: 'row', backgroundColor: C.card, marginHorizontal: 10, marginBottom: 10, marginTop: 4,
    borderRadius: 999, borderWidth: 2, borderColor: C.cardEdge, padding: 5, elevation: 3,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 999 },
  navItemOn: { backgroundColor: C.pink },
  navLabel: { fontSize: 10, fontWeight: '800', color: C.text, marginTop: 1 },
});
