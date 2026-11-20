import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

const C = {
  bg: '#FFF6EA',
  card: '#FFE3C7',
  cardEdge: '#F6C79C',
  text: '#7A4A32',
  soft: '#A8806A',
  pink: '#FF8FA3',
  pinkDark: '#E96F88',
  green: '#8FD28A',
  grey: '#E4D5C6',
};

const LEAGUES = [
  { name: 'Bronze', icon: '🥉', xp: 0 },
  { name: 'Silver', icon: '🥈', xp: 600 },
  { name: 'Gold', icon: '🥇', xp: 1800 },
  { name: 'Platinum', icon: '💠', xp: 4500 },
  { name: 'Diamond', icon: '💎', xp: 9000 },
];

const STAGES = [
  { stage: 1, title: 'Warmup Jar', target: 150, coins: 40, gems: 1 },
  { stage: 2, title: 'Pastel Stack', target: 350, coins: 75, gems: 1 },
  { stage: 3, title: 'Cozy Rush', target: 650, coins: 120, gems: 2 },
  { stage: 4, title: 'Fluff Tower', target: 1100, coins: 180, gems: 2 },
  { stage: 5, title: 'Jar Master', target: 1800, coins: 300, gems: 3 },
];

export function progressionDefaults() {
  return {
    xp: 0,
    best: 0,
    totalMerges: 0,
    jarsCompleted: 0,
    nickname: 'Fluff Friend',
    avatar: 0,
    adventure: { unlockedStage: 1 },
    challenge: null,
    settings: {
      sound: true,
      music: true,
      vibration: true,
      reduceMotion: false,
      reminders: false,
    },
  };
}

export function completeChallenge(setGameState, finalScore) {
  setGameState((prev) => {
    const ch = prev.challenge;
    if (!ch) return prev;
    const won = finalScore >= ch.target;
    const curUnlocked = (prev.adventure && prev.adventure.unlockedStage) || 1;
    const nextUnlocked = won ? Math.max(curUnlocked, Math.min(STAGES.length, ch.stage + 1)) : curUnlocked;
    return {
      ...prev,
      coins: (prev.coins || 0) + (won ? ch.coins : 0),
      gems: (prev.gems || 0) + (won ? ch.gems : 0),
      adventure: { unlockedStage: nextUnlocked },
      challenge: null,
    };
  });
}

function SheetShell({ visible, title, onClose, children }) {
  return (
    <Modal transparent visible={!!visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ProgressionModals({ gameState, setGameState, activeModal, onClose }) {
  const [confirmReset, setConfirmReset] = useState(false);

  const gs = useMemo(() => ({ ...progressionDefaults(), ...(gameState || {}) }), [gameState]);
  const xp = gs.xp || 0;
  const level = gs.level || 1 + Math.floor(xp / 300);
  const intoLevel = xp % 300;
  const discoveredCount = Array.isArray(gs.discovered) ? gs.discovered.filter(Boolean).length : 0;

  const currentLeagueIdx = useMemo(() => {
    let idx = 0;
    LEAGUES.forEach((l, i) => {
      if (xp >= l.xp) idx = i;
    });
    return idx;
  }, [xp]);

  const unlockedStage = (gs.adventure && gs.adventure.unlockedStage) || 1;
  const settings = { ...progressionDefaults().settings, ...(gs.settings || {}) };

  const toggleSetting = (key) => {
    setGameState((prev) => ({
      ...prev,
      settings: { ...progressionDefaults().settings, ...(prev.settings || {}), [key]: !((prev.settings || {})[key] ?? progressionDefaults().settings[key]) },
    }));
  };

  const startStage = (st) => {
    setGameState((prev) => ({
      ...prev,
      challenge: {
        stage: st.stage,
        title: st.title,
        target: st.target,
        coins: st.coins,
        gems: st.gems,
        startedAt: Date.now(),
      },
      modal: null,
    }));
  };

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setGameState((prev) => ({
      ...progressionDefaults(),
      coins: 0,
      gems: 5,
      level: 1,
      xp: 0,
      discovered: [true, false, false, false, false, false, false, false, false],
      ownedOutfits: [],
      equippedOutfit: 'none',
      power: { sweep: 2, pop: 2, grow: 2, shake: 2 },
      ownedThemes: ['cozy'],
      activeTheme: 'cozy',
      today: { date: '', merges: 0, counts: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
      daily: { lastClaim: '', streak: 0 },
      tab: prev.tab || 'home',
      modal: null,
      playing: false,
      over: false,
      armed: false,
      score: 0,
    }));
  };

  const closeAndResetConfirm = () => {
    setConfirmReset(false);
    onClose();
  };

  if (!activeModal || activeModal === 'daily') return null;

  if (activeModal === 'profile') {
    return (
      <SheetShell visible title="Profile" onClose={closeAndResetConfirm}>
        <View style={styles.centerBox}>
          <Text style={styles.bigEmoji}>🧸</Text>
          <Text style={styles.heroName}>{gs.nickname || 'Fluff Friend'}</Text>
          <Text style={styles.sub}>Level {level} · {xp} XP</Text>
        </View>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${Math.min(100, (intoLevel / 300) * 100)}%` }]} />
        </View>
        <Text style={[styles.sub, { textAlign: 'center', marginTop: 6 }]}>{intoLevel} / 300 XP to Level {level + 1}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{gs.best || 0}</Text>
            <Text style={styles.statLabel}>Best</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{gs.totalMerges || 0}</Text>
            <Text style={styles.statLabel}>Merges</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{discoveredCount}/9</Text>
            <Text style={styles.statLabel}>Fluffs</Text>
          </View>
        </View>
      </SheetShell>
    );
  }

  if (activeModal === 'leagues') {
    const cur = LEAGUES[currentLeagueIdx];
    const nxt = LEAGUES[currentLeagueIdx + 1];
    const span = nxt ? nxt.xp - cur.xp : 1;
    const progress = nxt ? Math.max(0, Math.min(100, ((xp - cur.xp) / span) * 100)) : 100;

    return (
      <SheetShell visible title="Leagues" onClose={closeAndResetConfirm}>
        {LEAGUES.map((league, i) => {
          const isYou = i === currentLeagueIdx;
          return (
            <View key={league.name} style={[styles.rowCard, isYou && styles.rowCardActive]}>
              <Text style={styles.rowIcon}>{league.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{league.name}</Text>
                <Text style={styles.sub}>{league.xp} XP</Text>
              </View>
              {isYou && <Text style={styles.youBadge}>YOU</Text>}
            </View>
          );
        })}
        <View style={{ marginTop: 8 }}>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${progress}%` }]} />
          </View>
          <Text style={[styles.sub, { textAlign: 'center', marginTop: 6 }]}>
            {nxt ? `${Math.max(0, nxt.xp - xp)} XP to ${nxt.name}` : 'Highest league reached'}
          </Text>
        </View>
      </SheetShell>
    );
  }

  if (activeModal === 'adventure') {
    return (
      <SheetShell visible title="Adventure" onClose={closeAndResetConfirm}>
        <Text style={[styles.sub, { marginBottom: 10 }]}>Hit the target score before the jar fills up.</Text>
        {STAGES.map((st) => {
          const open = st.stage <= unlockedStage;
          return (
            <View key={st.stage} style={[styles.rowCard, !open && styles.lockedCard]}>
              <Text style={styles.rowIcon}>{open ? '🫙' : '🔒'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Stage {st.stage}: {st.title}</Text>
                <Text style={styles.sub}>Target {st.target} · 🪙 {st.coins}  💎 {st.gems}</Text>
              </View>
              <Pressable
                disabled={!open}
                onPress={() => startStage(st)}
                style={[styles.actionBtn, !open && styles.disabledBtn]}
              >
                <Text style={styles.actionText}>{open ? 'Play' : 'Locked'}</Text>
              </Pressable>
            </View>
          );
        })}
      </SheetShell>
    );
  }

  if (activeModal === 'settings') {
    const items = [
      { key: 'sound', label: 'Sound effects' },
      { key: 'music', label: 'Cozy music' },
      { key: 'vibration', label: 'Merge vibration' },
      { key: 'reduceMotion', label: 'Reduce motion' },
      { key: 'reminders', label: 'Daily reminders' },
    ];
    return (
      <SheetShell visible title="Settings" onClose={closeAndResetConfirm}>
        {items.map((it) => (
          <View key={it.key} style={styles.switchRow}>
            <Text style={styles.rowTitle}>{it.label}</Text>
            <Switch
              value={!!settings[it.key]}
              onValueChange={() => toggleSetting(it.key)}
              trackColor={{ false: C.grey, true: C.pink }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}

        <Pressable
          onPress={handleReset}
          style={[styles.resetBtn, confirmReset && { backgroundColor: '#E56F6F' }]}
        >
          <Text style={styles.actionText}>
            {confirmReset ? 'Tap again to reset all progress' : 'Reset progress'}
          </Text>
        </Pressable>
      </SheetShell>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(90, 55, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '84%',
    backgroundColor: C.bg,
    borderRadius: 30,
    padding: 18,
    borderWidth: 3,
    borderColor: C.cardEdge,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: C.text,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.card,
    borderWidth: 2,
    borderColor: C.cardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: C.text,
    fontWeight: '900',
    fontSize: 14,
  },
  centerBox: {
    alignItems: 'center',
    marginBottom: 12,
  },
  bigEmoji: {
    fontSize: 44,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '900',
    color: C.text,
    marginTop: 4,
  },
  sub: {
    fontSize: 12,
    fontWeight: '700',
    color: C.soft,
  },
  barBg: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(122, 74, 50, 0.14)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.pink,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.cardEdge,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.soft,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.cardEdge,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  rowCardActive: {
    backgroundColor: '#FFD6E0',
    borderColor: C.pink,
  },
  lockedCard: {
    opacity: 0.72,
  },
  rowIcon: {
    fontSize: 24,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: C.text,
  },
  youBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: C.pinkDark,
  },
  actionBtn: {
    backgroundColor: C.pink,
    borderBottomWidth: 3,
    borderBottomColor: C.pinkDark,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  disabledBtn: {
    backgroundColor: C.grey,
    borderBottomColor: '#CDBBA8',
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  resetBtn: {
    marginTop: 14,
    backgroundColor: C.soft,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
