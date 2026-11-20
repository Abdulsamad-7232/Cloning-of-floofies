/**
 * App.js (master)
 * Connects MergeJar, Home, GameScreens and ProgressionModals around one
 * central gameState that is persisted with AsyncStorage.
 *
 * Install once:  npx expo install @react-native-async-storage/async-storage
 *
 * GameScreens.js and ProgressionModals.js were written against a slightly
 * different state shape, so they get a translated "legacy" view of gameState
 * and their setGameState calls are mapped back (see toLegacy / fromLegacy).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  AppState,
  SafeAreaView,
  StatusBar,
  Platform,
  StyleSheet,
  Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FluffsTab, OutfitsTab, ShopTab, TodayTab, DailyGiftsModal, THEMES } from './GameScreens';
import ProgressionModals, { completeChallenge } from './ProgressionModals';
import MergeJar, { TIERS, createWorld, resetWorld, stepWorld, hasDelta, emptyDelta, applyDelta } from './MergeJar';
import Home, { TopBar, BottomNav } from './Home';

/* ================================================================== */
/* CENTRAL STATE                                                       */
/* ================================================================== */

const STORAGE_KEY = 'fluff-jar-save-v1';
const TIER_VALUES = TIERS.map((t) => t.value);

const DEFAULT_STATE = {
  coins: 0,
  gems: 5,
  hearts: 5,
  level: 1,
  xp: 0,
  discovered: [1, 2],                       // tier values found so far
  powers: { sweep: 1, pop: 1, grow: 1, shake: 1 },
  equippedOutfit: 'classic',
  unlockedOutfits: ['classic'],
  activeTheme: 'cream',
  unlockedThemes: ['cream'],
  adventureStage: 1,
  dailyStreak: 1,
  todayMerges: {},                          // { date, counts: { [tierValue]: n } }
  settings: { sound: true, music: true, haptics: true, reduceMotion: false },

  // supporting fields used by the other screens
  maxHearts: 5,
  dailyLastClaim: '',
  nickname: 'Fluff Friend',
  avatar: 0,
  totalMerges: 0,
  best: 0,
  jarsCompleted: 0,
  challenge: null,
};

function hydrate(saved) {
  const d = DEFAULT_STATE;
  if (!saved || typeof saved !== 'object') return d;
  const list = (v, must, fallback) => {
    const arr = Array.isArray(v) ? v.slice() : fallback.slice();
    if (!arr.includes(must)) arr.unshift(must);
    return arr;
  };
  return {
    ...d,
    ...saved,
    powers: { ...d.powers, ...(saved.powers || {}) },
    settings: { ...d.settings, ...(saved.settings || {}) },
    discovered: Array.isArray(saved.discovered) ? saved.discovered : d.discovered.slice(),
    unlockedOutfits: list(saved.unlockedOutfits, 'classic', d.unlockedOutfits),
    unlockedThemes: list(saved.unlockedThemes, 'cream', d.unlockedThemes),
    todayMerges: saved.todayMerges && typeof saved.todayMerges === 'object' ? saved.todayMerges : {},
  };
}

/* ================================================================== */
/* TRANSLATION LAYER FOR GameScreens / ProgressionModals               */
/* ================================================================== */

const themeToLegacy = (id) => (id === 'cream' ? 'cozy' : id);
const themeFromLegacy = (id) => (id === 'cozy' ? 'cream' : id);

function toLegacy(gs) {
  const today = gs.todayMerges || {};
  const counts = TIER_VALUES.map((v) => (today.counts && today.counts[v]) || 0);
  return {
    coins: gs.coins,
    gems: gs.gems,
    level: gs.level,
    xp: gs.xp,
    hearts: gs.hearts,
    maxHearts: gs.maxHearts ?? 5,
    discovered: TIER_VALUES.map((v) => gs.discovered.includes(v)),
    power: { ...gs.powers },
    ownedOutfits: gs.unlockedOutfits.filter((id) => id !== 'classic'),
    equippedOutfit: gs.equippedOutfit === 'classic' ? 'none' : gs.equippedOutfit,
    ownedThemes: gs.unlockedThemes.map(themeToLegacy),
    activeTheme: themeToLegacy(gs.activeTheme),
    today: { date: today.date || '', merges: counts.reduce((a, b) => a + b, 0), counts },
    daily: { lastClaim: gs.dailyLastClaim || '', streak: gs.dailyStreak },
    adventure: { unlockedStage: gs.adventureStage },
    challenge: gs.challenge ?? null,
    nickname: gs.nickname,
    avatar: gs.avatar,
    totalMerges: gs.totalMerges,
    best: gs.best,
    jarsCompleted: gs.jarsCompleted,
    settings: {
      sound: gs.settings.sound,
      music: gs.settings.music,
      vibration: gs.settings.haptics,
      reduceMotion: gs.settings.reduceMotion,
      reminders: !!gs.settings.reminders,
    },
  };
}

function fromLegacy(prev, L) {
  const todayCounts = {};
  ((L.today && L.today.counts) || []).forEach((n, i) => {
    if (n) todayCounts[TIER_VALUES[i]] = n;
  });
  return {
    ...prev,
    coins: L.coins,
    gems: L.gems,
    level: L.level,
    xp: L.xp,
    hearts: L.hearts,
    maxHearts: L.maxHearts ?? prev.maxHearts,
    discovered: TIER_VALUES.filter((v, i) => L.discovered[i]),
    powers: { ...L.power },
    unlockedOutfits: ['classic'].concat((L.ownedOutfits || []).filter((id) => id !== 'none' && id !== 'classic')),
    equippedOutfit: L.equippedOutfit === 'none' ? 'classic' : L.equippedOutfit,
    unlockedThemes: (L.ownedThemes || []).map(themeFromLegacy),
    activeTheme: themeFromLegacy(L.activeTheme),
    todayMerges: L.today && L.today.date ? { date: L.today.date, counts: todayCounts } : {},
    dailyLastClaim: L.daily.lastClaim,
    dailyStreak: L.daily.streak,
    adventureStage: L.adventure.unlockedStage,
    challenge: L.challenge ?? null,
    nickname: L.nickname,
    avatar: L.avatar,
    totalMerges: L.totalMerges,
    best: L.best,
    jarsCompleted: L.jarsCompleted,
    settings: {
      ...prev.settings,
      sound: L.settings.sound,
      music: L.settings.music,
      haptics: L.settings.vibration,
      reduceMotion: L.settings.reduceMotion,
      reminders: L.settings.reminders,
    },
  };
}

// Jar colors for the active theme.
function themeFor(id) {
  const t = THEMES.find((x) => x.id === themeToLegacy(id)) || THEMES[0];
  const night = t.id === 'starlight';
  return {
    ...t,
    ink: night ? '#FFE9D6' : '#7A4A32',
    glassEdge: night ? '#B9B0F2' : '#FFFAF2',
    rim: night ? '#D8D0FF' : '#FFFDF8',
    swatchEdge: t.edge,
  };
}

/* ================================================================== */
/* APP                                                                 */
/* ================================================================== */

export default function App() {
  const [gameState, setGameState] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [ui, setUi] = useState({ tab: 'home', modal: null, playing: false });
  const [run, setRun] = useState({ score: 0, over: false, armed: false });
  const [toastText, setToastText] = useState('');

  const stateRef = useRef(gameState);
  const uiRef = useRef(ui);
  const runRef = useRef(run);
  stateRef.current = gameState;
  uiRef.current = ui;
  runRef.current = run;

  const worldRef = useRef(null);
  if (!worldRef.current) worldRef.current = createWorld();
  const world = worldRef.current;

  const lastChallenge = useRef(0);
  const toastTimer = useRef(null);
  const fade = useRef(new Animated.Value(1)).current;

  const toast = useCallback((text) => {
    setToastText(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(''), 1800);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // setter handed to GameScreens / ProgressionModals (they use the legacy shape)
  const setLegacy = useCallback((updater) => {
    setGameState((prev) => {
      const cur = toLegacy(prev);
      const next = typeof updater === 'function' ? updater(cur) : updater;
      return next === cur ? prev : fromLegacy(prev, next);
    });
  }, []);
  const legacy = useMemo(() => toLegacy(gameState), [gameState]);
  const theme = useMemo(() => themeFor(gameState.activeTheme), [gameState.activeTheme]);

  /* ---------- persistence ---------- */

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const h = hydrate(JSON.parse(raw));
          lastChallenge.current = h.challenge ? h.challenge.startedAt : 0;
          setGameState(h);
        } catch (e) {
          // corrupted save: start fresh
        }
      })
      .catch(() => {})
      .then(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return undefined;
    const id = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(gameState)).catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [gameState, loaded]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current)).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  /* ---------- game loop ---------- */

  useEffect(() => {
    if (!loaded) return undefined;
    const g = world;
    let raf;
    g.last = Date.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = Date.now();
      let dt = (now - g.last) / 1000;
      g.last = now;
      if (dt > 1 / 30) dt = 1 / 30;
      if (dt <= 0) dt = 1 / 60;

      const u = uiRef.current;
      const active = u.playing || u.tab === 'home';
      if (active && !g.over) stepWorld(g, dt, now);

      if (hasDelta(g.delta)) {
        const d = g.delta;
        g.delta = emptyDelta();
        const newScore = runRef.current.score + d.score;
        if (d.merged.length && stateRef.current.settings.haptics) Vibration.vibrate(8);
        setRun((r) => ({ ...r, score: r.score + d.score }));
        setGameState((p) => applyDelta(p, d, newScore));
      }

      if (g.over && !g.overSent) {
        g.overSent = true;
        setRun((r) => ({ ...r, over: true, armed: false }));
        setGameState((p) => ({
          ...p,
          best: Math.max(p.best || 0, runRef.current.score),
          jarsCompleted: (p.jarsCompleted || 0) + 1,
        }));
      }

      if (active && (!g.over || g.fx.length)) g.listeners.forEach((fn) => fn());
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [loaded, world]);

  /* ---------- adventure challenges ---------- */

  const chKey = gameState.challenge ? gameState.challenge.startedAt : 0;

  // a freshly started challenge opens a clean jar on the merge screen
  useEffect(() => {
    if (!loaded || !chKey || chKey === lastChallenge.current) return;
    lastChallenge.current = chKey;
    resetWorld(world);
    setRun({ score: 0, over: false, armed: false });
    setUi({ tab: 'home', modal: null, playing: true });
  }, [chKey, loaded, world]);

  // target reached
  useEffect(() => {
    const ch = gameState.challenge;
    if (ch && ui.playing && run.score >= ch.target) {
      completeChallenge(setLegacy, run.score);
      toast(`Stage ${ch.stage} cleared! 🎉`);
    }
  }, [run.score, chKey, ui.playing]);

  // jar filled before the target
  useEffect(() => {
    const ch = gameState.challenge;
    if (run.over && ch) {
      completeChallenge(setLegacy, run.score);
      toast(`Stage ${ch.stage} failed. Try again!`);
    }
  }, [run.over]);

  /* ---------- tab fade ---------- */

  const calm = gameState.settings.reduceMotion;
  useEffect(() => {
    if (calm) { fade.setValue(1); return; }
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [ui.tab, ui.playing, calm]);

  /* ---------- navigation ---------- */

  const onTab = useCallback((tab) => setUi((u) => ({ ...u, tab })), []);
  const onOpen = useCallback((modal) => setUi((u) => ({ ...u, modal })), []);
  const closeModal = useCallback(() => setUi((u) => ({ ...u, modal: null })), []);
  const onPlay = useCallback(() => setUi((u) => ({ ...u, playing: true })), []);
  const onExit = useCallback(() => {
    setRun((r) => ({ ...r, armed: false }));
    setUi((u) => ({ ...u, playing: false, tab: 'home' }));
  }, []);

  /* ---------- render ---------- */

  if (!loaded) {
    return (
      <View style={[styles.splash, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF1E0" />
        <Text style={styles.splashEmoji}>🫙</Text>
        <Text style={styles.splashText}>Fluff Jar</Text>
      </View>
    );
  }

  const tabProps = { gameState: legacy, setGameState: setLegacy };
  let screen;
  if (ui.tab === 'home') {
    screen = (
      <Home
        gameState={gameState}
        world={world}
        theme={theme}
        toast={toast}
        onPlay={onPlay}
        onOpen={onOpen}
        onTab={onTab}
      />
    );
  } else {
    screen = (
      <View style={styles.panel}>
        {ui.tab === 'fluffs' && <FluffsTab {...tabProps} />}
        {ui.tab === 'outfits' && <OutfitsTab {...tabProps} />}
        {ui.tab === 'today' && <TodayTab {...tabProps} />}
        {ui.tab === 'shop' && <ShopTab {...tabProps} />}
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0 }]}
    >
      <StatusBar barStyle={theme.id === 'starlight' ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      {ui.playing ? (
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <MergeJar
            world={world}
            gameState={gameState}
            setGameState={setGameState}
            run={run}
            setRun={setRun}
            theme={theme}
            toast={toast}
            onExit={onExit}
          />
        </Animated.View>
      ) : (
        <>
          <TopBar gameState={gameState} onOpen={onOpen} onTab={onTab} />
          <Animated.View style={{ flex: 1, opacity: fade }}>{screen}</Animated.View>
          <BottomNav tab={ui.tab} onTab={onTab} />
        </>
      )}

      {!!toastText && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toastText}</Text>
        </View>
      )}

      {ui.modal === 'daily' && (
        <DailyGiftsModal gameState={legacy} setGameState={setLegacy} onClose={closeModal} />
      )}
      <ProgressionModals
        gameState={legacy}
        setGameState={setLegacy}
        activeModal={ui.modal}
        onClose={closeModal}
      />
    </SafeAreaView>
  );
}

/* ================================================================== */
/* STYLES                                                              */
/* ================================================================== */

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, backgroundColor: '#FFF1E0', alignItems: 'center', justifyContent: 'center' },
  splashEmoji: { fontSize: 56 },
  splashText: { fontSize: 32, fontWeight: '900', color: '#FF8FA3', marginTop: 8 },
  panel: {
    flex: 1, marginHorizontal: 8, marginVertical: 2, borderRadius: 30,
    backgroundColor: '#FFF6EA', borderWidth: 2, borderColor: '#F6C79C', overflow: 'hidden',
  },
  toast: { position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center' },
  toastText: {
    backgroundColor: 'rgba(90,55,40,0.92)', color: '#fff', fontWeight: '800', fontSize: 14,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, overflow: 'hidden',
  },
});
