import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// ── Types ──────────────────────────────────────────────────────────────────────
type Habit = {
  id: string;
  name: string;
  emoji: string;
  streak: number;
  lastCompleted: string | null; // 'YYYY-MM-DD'
  history: string[];            // completed dates, last 30 days
};

type Review = {
  id: string;
  rating: number;   // 1–5
  comment: string;
  date: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY  = '@habits_v2';
const REVIEWS_KEY  = '@reviews_v1';
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const EMOJI_OPTIONS = [
  '💧','🏃','📚','🧘','😴','🥗','💪','🎯',
  '✍️','🎨','🎵','🧹','💊','🚶','🌿','📝',
  '🍎','🧠','💻','☀️',
];

const DEFAULT_HABITS: Habit[] = [
  { id: '1', name: 'Drink 8 glasses of water', emoji: '💧', streak: 3,  lastCompleted: null, history: [] },
  { id: '2', name: 'Exercise 30 min',           emoji: '🏃', streak: 7,  lastCompleted: null, history: [] },
  { id: '3', name: 'Read 20 pages',             emoji: '📚', streak: 12, lastCompleted: null, history: [] },
  { id: '4', name: 'Meditate 10 min',           emoji: '🧘', streak: 0,  lastCompleted: null, history: [] },
  { id: '5', name: 'Sleep 8 hours',             emoji: '😴', streak: 5,  lastCompleted: null, history: [] },
  { id: '6', name: 'No junk food',              emoji: '🥗', streak: 2,  lastCompleted: null, history: [] },
  { id: '7', name: 'Play soccer',               emoji: '⚽', streak: 0,  lastCompleted: null, history: [] },
];

// ── Design tokens ─────────────────────────────────────────────────────────────
const PURPLE       = '#7C3AED';
const PURPLE_LIGHT = '#EDE9FE';
const PURPLE_MID   = '#A78BFA';
const PURPLE_DARK  = '#5B21B6';
const GOLD         = '#F59E0B';

// ── Date helpers ──────────────────────────────────────────────────────────────
function dateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayStr     = () => dateOffset(0);
const yesterdayStr = () => dateOffset(-1);
const lastSevenDays = () => Array.from({ length: 7 }, (_, i) => dateOffset(i - 6));

function streakBadge(streak: number): string {
  if (streak >= 100) return ' 💎';
  if (streak >= 30)  return ' 🥇';
  if (streak >= 7)   return ' 🥈';
  if (streak >= 3)   return ' 🥉';
  return '';
}

// ── HabitCard ─────────────────────────────────────────────────────────────────
function HabitCard({
  habit, onToggle, onDelete,
}: {
  habit: Habit;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const today     = todayStr();
  const completed = habit.lastCompleted === today;

  const cardScale  = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const prev       = useRef(completed);

  useEffect(() => {
    if (completed === prev.current) return;
    prev.current = completed;

    Animated.sequence([
      Animated.timing(cardScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, friction: 4, tension: 300, useNativeDriver: true }),
    ]).start();

    Animated.spring(checkScale, {
      toValue: completed ? 1 : 0,
      friction: 4,
      tension: 400,
      useNativeDriver: true,
    }).start();
  }, [completed]);

  const days = lastSevenDays();

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <TouchableOpacity
        style={[styles.card, completed && styles.cardDone]}
        onPress={onToggle}
        onLongPress={onDelete}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        <Text style={styles.cardEmoji}>{habit.emoji}</Text>

        <View style={styles.cardBody}>
          <Text style={[styles.habitName, completed && styles.habitNameDone]}>
            {habit.name}
          </Text>

          {habit.streak > 0 && (
            <Text style={styles.streakLabel}>
              🔥 {habit.streak}-day streak{streakBadge(habit.streak)}
            </Text>
          )}

          {/* 7-day completion dots */}
          <View style={styles.dotsRow}>
            {days.map((day, i) => {
              const done    = habit.history.includes(day);
              const isToday = day === today;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    done    && styles.dotDone,
                    isToday && !done && styles.dotToday,
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={[styles.checkCircle, completed && styles.checkCircleDone]}>
          <Animated.Text style={[styles.checkMark, { transform: [{ scale: checkScale }] }]}>
            ✓
          </Animated.Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── AddHabitModal ─────────────────────────────────────────────────────────────
function AddHabitModal({
  visible, onClose, onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, emoji: string) => void;
}) {
  const [name, setName]   = useState('');
  const [emoji, setEmoji] = useState('🎯');

  function submit() {
    if (!name.trim()) return;
    onAdd(name.trim(), emoji);
    setName('');
    setEmoji('🎯');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>New Habit</Text>

          <Text style={styles.sheetLabel}>Choose an emoji</Text>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map(e => (
              <TouchableOpacity
                key={e}
                style={[styles.emojiOption, emoji === e && styles.emojiSelected]}
                onPress={() => setEmoji(e)}
              >
                <Text style={styles.emojiOptionText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sheetLabel}>Name your habit</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Journal 10 minutes"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={submit}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.addBtn, !name.trim() && styles.addBtnDisabled]}
            onPress={submit}
            disabled={!name.trim()}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>Add Habit</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── ReviewModal ───────────────────────────────────────────────────────────────
function ReviewModal({
  visible, onClose, onSubmit, totalReviews, avgRating,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
  totalReviews: number;
  avgRating: number;
}) {
  const [rating, setRating]   = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone]       = useState(false);

  function submit() {
    if (rating === 0) return;
    onSubmit(rating, comment.trim());
    setDone(true);
  }

  function handleClose() {
    setRating(0);
    setComment('');
    setDone(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />

          {done ? (
            <View style={styles.reviewThanks}>
              <Text style={styles.reviewThanksEmoji}>🎉</Text>
              <Text style={styles.reviewThanksTitle}>Thank you!</Text>
              <Text style={styles.reviewThanksSub}>
                You're review #{totalReviews}. Average rating: {avgRating.toFixed(1)} ⭐
              </Text>
              <TouchableOpacity style={styles.addBtn} onPress={handleClose} activeOpacity={0.85}>
                <Text style={styles.addBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sheetTitle}>Rate this App</Text>

              {totalReviews > 0 && (
                <View style={styles.reviewStats}>
                  <Text style={styles.reviewStatsText}>
                    ⭐ {avgRating.toFixed(1)}  ·  {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>
              )}

              <Text style={styles.sheetLabel}>Your rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
                    <Text style={[styles.star, s <= rating && styles.starActive]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sheetLabel}>Comment (optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
                placeholder="What do you think about this app?"
                placeholderTextColor="#9CA3AF"
                value={comment}
                onChangeText={setComment}
                maxLength={200}
                multiline
              />

              <TouchableOpacity
                style={[styles.addBtn, rating === 0 && styles.addBtnDisabled]}
                onPress={submit}
                disabled={rating === 0}
                activeOpacity={0.85}
              >
                <Text style={styles.addBtnText}>Submit Review</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [habits, setHabits]       = useState<Habit[]>([]);
  const [loaded, setLoaded]       = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [showReview, setShowReview]     = useState(false);
  const [reviews, setReviews]           = useState<Review[]>([]);
  const progressAnim              = useRef(new Animated.Value(0)).current;

  // Load persisted habits
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      try { setHabits(raw ? JSON.parse(raw) : DEFAULT_HABITS); }
      catch { setHabits(DEFAULT_HABITS); }
      setLoaded(true);
    });
  }, []);

  // Persist habits on every change
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits, loaded]);

  // Load & save reviews
  useEffect(() => {
    AsyncStorage.getItem(REVIEWS_KEY).then(raw => {
      try { if (raw) setReviews(JSON.parse(raw)); } catch {}
    });
  }, []);
  useEffect(() => {
    if (reviews.length > 0) AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  }, [reviews]);

  const today     = todayStr();
  const completed = habits.filter(h => h.lastCompleted === today).length;
  const total     = habits.length;
  const progress  = total > 0 ? completed / total : 0;
  const allDone   = total > 0 && completed === total;

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Weekly completion rate
  const weekDays       = lastSevenDays();
  const weeklyPossible = total * 7;
  const weeklyActual   = habits.reduce(
    (sum, h) => sum + weekDays.filter(d => h.history.includes(d)).length,
    0,
  );
  const weeklyRate = weeklyPossible > 0
    ? Math.round((weeklyActual / weeklyPossible) * 100)
    : 0;

  function toggle(id: string) {
    const t    = today;
    const yest = yesterdayStr();

    // Compute haptic before setState so we read stale-but-correct habits
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const wasCompleted  = habit.lastCompleted === t;
    const otherAllDone  = habits.filter(h => h.id !== id).every(h => h.lastCompleted === t);
    const willCelebrate = !wasCompleted && otherAllDone;

    if (willCelebrate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(
        wasCompleted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
      );
    }

    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const wasDone = h.lastCompleted === t;
      if (wasDone) {
        const newHistory = h.history.filter(d => d !== t);
        return {
          ...h,
          lastCompleted: newHistory.length > 0 ? newHistory[newHistory.length - 1] : null,
          history: newHistory,
          streak: Math.max(0, h.streak - 1),
        };
      } else {
        const newStreak  = h.lastCompleted === yest ? h.streak + 1 : 1;
        const newHistory = [...new Set([...h.history, t])].sort().slice(-30);
        return { ...h, lastCompleted: t, history: newHistory, streak: newStreak };
      }
    }));
  }

  function submitReview(rating: number, comment: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReviews(prev => [
      ...prev,
      { id: Date.now().toString(), rating, comment, date: todayStr() },
    ]);
  }

  const totalReviews = reviews.length;
  const avgRating    = totalReviews > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews
    : 0;

  function addHabit(name: string, emoji: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHabits(prev => [
      ...prev,
      { id: Date.now().toString(), name, emoji, streak: 0, lastCompleted: null, history: [] },
    ]);
  }

  function deleteHabit(id: string) {
    Alert.alert('Remove Habit', 'Delete this habit permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setHabits(prev => prev.filter(h => h.id !== id));
        },
      },
    ]);
  }

  const now      = new Date();
  const dateLabel = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  if (!loaded) return <SafeAreaProvider><SafeAreaView style={styles.safe} /></SafeAreaProvider>;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.dateText}>{dateLabel}</Text>
            <Text style={styles.titleText}>My Habits</Text>
          </View>
          <View style={styles.weeklyBadge}>
            <Text style={styles.weeklyRate}>{weeklyRate}%</Text>
            <Text style={styles.weeklyLabel}>this week</Text>
          </View>
        </View>

        <Text style={styles.subtitleText}>
          {allDone ? '🎉 All done — perfect day!' : `${completed} of ${total} completed`}
        </Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }) as any,
              },
            ]}
          />
        </View>

        {/* Get Review button */}
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowReview(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.reviewBtnText}>
            ⭐ Get Review
            {totalReviews > 0 ? `  ·  ${avgRating.toFixed(1)} (${totalReviews})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── List ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {habits.map(h => (
          <HabitCard
            key={h.id}
            habit={h}
            onToggle={() => toggle(h.id)}
            onDelete={() => deleteHabit(h.id)}
          />
        ))}

        {allDone && (
          <View style={styles.celebration}>
            <Text style={styles.celebrationEmoji}>🏆</Text>
            <Text style={styles.celebrationTitle}>Perfect Day!</Text>
            <Text style={styles.celebrationSub}>Keep the streak alive tomorrow.</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowModal(true);
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <AddHabitModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onAdd={addHabit}
      />

      <ReviewModal
        visible={showReview}
        onClose={() => setShowReview(false)}
        onSubmit={submitReview}
        totalReviews={totalReviews}
        avgRating={avgRating}
      />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PURPLE,
  },

  // Header
  header: {
    backgroundColor: PURPLE,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  dateText: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  titleText: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
  },
  weeklyBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  weeklyRate: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  weeklyLabel: {
    color: '#DDD6FE',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  subtitleText: {
    color: '#DDD6FE',
    fontSize: 15,
    marginBottom: 14,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: PURPLE_MID,
  },

  // Scroll
  scroll: {
    flex: 1,
    backgroundColor: '#F5F3FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scrollContent: {
    padding: 20,
    gap: 12,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardDone: {
    backgroundColor: PURPLE_LIGHT,
  },
  cardEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  habitNameDone: {
    color: PURPLE,
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  streakLabel: {
    fontSize: 12,
    color: GOLD,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
  },
  dotDone: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  dotToday: {
    borderColor: PURPLE,
    borderWidth: 2,
  },

  // Checkbox
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkCircleDone: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  checkMark: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  // Celebration
  celebration: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  celebrationEmoji: {
    fontSize: 56,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: PURPLE,
    marginTop: 12,
  },
  celebrationSub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 34,
  },

  // Modal bottom sheet
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 20,
  },
  sheetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiSelected: {
    backgroundColor: PURPLE_LIGHT,
    borderWidth: 2,
    borderColor: PURPLE,
  },
  emojiOptionText: {
    fontSize: 22,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
    backgroundColor: '#FAFAFA',
  },
  addBtn: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // Review button (in header)
  reviewBtn: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  reviewBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Review modal
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  star: {
    fontSize: 40,
    color: '#D1D5DB',
  },
  starActive: {
    color: GOLD,
  },
  reviewStats: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  reviewStatsText: {
    fontSize: 15,
    fontWeight: '600',
    color: PURPLE,
  },
  reviewThanks: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  reviewThanksEmoji: {
    fontSize: 52,
  },
  reviewThanksTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  reviewThanksSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
});
