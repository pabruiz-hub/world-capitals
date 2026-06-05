// ═══════════════════════════════════════════════
//  WORLD CAPITALS — Statistics, XP, Trophies
// ═══════════════════════════════════════════════

const STORAGE_KEY = "wc_stats_v4";

// ─── XP / LEVEL ────────────────────────────────
const LEVEL_TITLES = [
  "Novice", "Explorer", "Apprentice", "Student",
  "Scholar", "Geographer", "Expert", "Master",
  "Champion", "Legend"
];
function xpForLevel(lvl) { return lvl * lvl * 120; }
function levelFromXP(xp) {
  let lv = 1;
  while (xpForLevel(lv + 1) <= xp) lv++;
  return Math.min(lv, LEVEL_TITLES.length);
}
function levelTitle(lvl) { return LEVEL_TITLES[Math.min(lvl - 1, LEVEL_TITLES.length - 1)]; }
function xpProgressInLevel(xp) {
  const lv  = levelFromXP(xp);
  const cur = xpForLevel(lv);
  const nxt = xpForLevel(lv + 1);
  return { pct: Math.round(((xp - cur) / (nxt - cur)) * 100), cur: xp - cur, needed: nxt - cur };
}

// ─── TROPHY DEFINITIONS ─────────────────────────
const TROPHIES_DEF = [
  // ── Firsts ──────────────────────────────────
  { id:"first_answer",    icon:"🌟", name:"First Step",         desc:"Answer your first question",                   midGame:true,  check: s => s.totalAnswered >= 1 },
  { id:"first_correct",   icon:"✅", name:"Bullseye",           desc:"Get your first correct answer",                midGame:true,  check: s => s.totalCorrect >= 1 },
  // ── Streaks ─────────────────────────────────
  { id:"streak_3",        icon:"🔥", name:"On Fire",            desc:"3 correct answers in a row",                   midGame:true,  check: s => s.bestStreak >= 3 },
  { id:"streak_5",        icon:"🔥", name:"Hot Streak",         desc:"5 correct answers in a row",                   midGame:true,  check: s => s.bestStreak >= 5 },
  { id:"streak_10",       icon:"⚡", name:"Lightning",          desc:"10 correct answers in a row",                  midGame:true,  check: s => s.bestStreak >= 10 },
  { id:"streak_15",       icon:"🌪️", name:"Unstoppable",        desc:"15 correct answers in a row",                  midGame:true,  check: s => s.bestStreak >= 15 },
  { id:"streak_20",       icon:"💫", name:"Legend Streak",      desc:"20 correct answers in a row",                  midGame:true,  check: s => s.bestStreak >= 20 },
  // ── Score ────────────────────────────────────
  { id:"score_500",       icon:"🥉", name:"Bronze",             desc:"Earn 500 points in a single game",             midGame:true,  check: s => (s._lastGameScore || 0) >= 500 },
  { id:"score_1000",      icon:"🥈", name:"Silver",             desc:"Earn 1,000 points in a single game",           midGame:true,  check: s => (s._lastGameScore || 0) >= 1000 },
  { id:"score_2000",      icon:"🥇", name:"Gold",               desc:"Earn 2,000 points in a single game",           midGame:true,  check: s => (s._lastGameScore || 0) >= 2000 },
  { id:"total_5k",        icon:"💎", name:"Diamond",            desc:"Earn 5,000 total XP",                          midGame:false, check: s => s.totalScore >= 5000 },
  { id:"total_20k",       icon:"👑", name:"Champion",           desc:"Earn 20,000 total XP",                         midGame:false, check: s => s.totalScore >= 20000 },
  // ── Questions answered ───────────────────────
  { id:"answered_10",     icon:"📖", name:"Getting Started",    desc:"Answer 10 questions",                          midGame:true,  check: s => s.totalAnswered >= 10 },
  { id:"answered_50",     icon:"📚", name:"Bookworm",           desc:"Answer 50 questions",                          midGame:true,  check: s => s.totalAnswered >= 50 },
  { id:"answered_100",    icon:"🎓", name:"Graduate",           desc:"Answer 100 questions",                         midGame:false, check: s => s.totalAnswered >= 100 },
  { id:"answered_500",    icon:"🏛️", name:"Professor",          desc:"Answer 500 questions",                         midGame:false, check: s => s.totalAnswered >= 500 },
  { id:"correct_25cap",   icon:"⭐", name:"Capital Starter",    desc:"Answer 25 capitals correctly",                 midGame:true,  check: s => (s.totalCorrectByMode?.capitals || 0) >= 25 },
  { id:"correct_50cap",   icon:"🌆", name:"Capital Expert",     desc:"Answer 50 capitals correctly",                 midGame:false, check: s => (s.totalCorrectByMode?.capitals || 0) >= 50 },
  { id:"correct_25flags", icon:"🏳️", name:"Flag Enthusiast",    desc:"Answer 25 flags correctly",                   midGame:true,  check: s => (s.totalCorrectByMode?.flags || 0) >= 25 },
  // ── Perfect runs ────────────────────────────
  { id:"first_perfect",   icon:"🎯", name:"Perfectionist",      desc:"Complete a game with no mistakes",             midGame:false, check: s => Object.values(s.maps).some(m => m.bestPerfectRun) },
  { id:"perfect_europe",  icon:"🏰", name:"European Expert",    desc:"Complete Europe with no mistakes",             midGame:false, check: s => s.maps.europe?.bestPerfectRun },
  { id:"perfect_africa",  icon:"🌴", name:"African Expert",     desc:"Complete Africa with no mistakes",             midGame:false, check: s => s.maps.africa?.bestPerfectRun },
  { id:"perfect_asia",    icon:"🏯", name:"Asian Expert",       desc:"Complete Asia with no mistakes",               midGame:false, check: s => s.maps.asia?.bestPerfectRun },
  { id:"perfect_america", icon:"🗽", name:"American Expert",    desc:"Complete America with no mistakes",            midGame:false, check: s => s.maps.america?.bestPerfectRun },
  { id:"perfect_world",   icon:"🌍", name:"World Master",       desc:"Complete the World Map with no mistakes",      midGame:false, check: s => s.maps.world?.bestPerfectRun },
  { id:"perfect_us",      icon:"🦅", name:"US States Master",   desc:"Complete U.S. States with no mistakes",        midGame:false, check: s => s.maps.us_states?.bestPerfectRun },
  // ── Exploration ─────────────────────────────
  { id:"play_all_maps",   icon:"🗺️", name:"World Explorer",     desc:"Play all 6 maps at least once",               midGame:false, check: s => Object.keys(s.maps).length >= 6 },
  { id:"study_10",        icon:"🔍", name:"Curious Mind",       desc:"Study 10 countries",                           midGame:true,  check: s => Object.keys(s.studiedEntities || {}).length >= 10 },
  { id:"study_50",        icon:"🌐", name:"Globetrotter",       desc:"Study 50 countries",                           midGame:true,  check: s => Object.keys(s.studiedEntities || {}).length >= 50 },
  { id:"study_100",       icon:"✈️", name:"World Traveler",     desc:"Study 100 countries",                          midGame:false, check: s => Object.keys(s.studiedEntities || {}).length >= 100 },
  // ── All modes ────────────────────────────────
  { id:"all_capitals",    icon:"🏙️", name:"Capital Master",     desc:"Play capitals mode on every map",              midGame:false, check: s => ["world","europe","africa","asia","america","us_states"].every(m => s.maps[m]?.modesPlayed?.includes("capitals")) },
  { id:"all_flags",       icon:"🎌", name:"Flag Master",        desc:"Play flags mode on every map",                 midGame:false, check: s => ["world","europe","africa","asia","america","us_states"].filter(m => m!=="us_states").every(m => s.maps[m]?.modesPlayed?.includes("flags")) },
  // ── Daily streak ────────────────────────────
  { id:"streak_day_3",    icon:"📅", name:"Habit Forming",      desc:"Play 3 days in a row",                         midGame:false, check: s => (s.dailyStreak || 0) >= 3 },
  { id:"streak_day_7",    icon:"🗓️", name:"Weekly Warrior",     desc:"Play 7 days in a row",                         midGame:false, check: s => (s.dailyStreak || 0) >= 7 },
  { id:"streak_day_30",   icon:"📆", name:"Monthly Dedication", desc:"Play 30 days in a row",                        midGame:false, check: s => (s.dailyStreak || 0) >= 30 },
  // ── Fun ─────────────────────────────────────
  { id:"comeback_kid",    icon:"💪", name:"Comeback Kid",       desc:"Answer correctly on the 3rd (last) attempt",   midGame:true,  check: s => s._lastWasComeback },
  { id:"night_owl",       icon:"🦉", name:"Night Owl",          desc:"Play after midnight",                          midGame:true,  check: s => s._playedAfterMidnight },
  { id:"theme_explorer",  icon:"🎨", name:"Theme Explorer",     desc:"Switch between light and dark mode",           midGame:true,  check: s => s._usedThemeToggle },
  { id:"level_5",         icon:"🚀", name:"Rising Star",        desc:"Reach level 5",                                midGame:true,  check: s => levelFromXP(s.totalScore) >= 5 },
  { id:"level_max",       icon:"🏆", name:"Geography God",      desc:"Reach the maximum level",                      midGame:false, check: s => levelFromXP(s.totalScore) >= LEVEL_TITLES.length },
];

// ─── DEFAULT SHAPES ─────────────────────────────
function defaultStats() {
  return {
    totalScore: 0, totalAnswered: 0, totalCorrect: 0, totalWrong: 0,
    bestStreak: 0, currentStreak: 0,
    totalCorrectByMode: { countries: 0, capitals: 0, flags: 0 },
    trophiesUnlocked: [],
    maps: {}, entityStats: {}, studiedEntities: {},
    dailyStreak: 0, lastPlayDate: null,
    _lastGameScore: 0, _lastWasComeback: false,
    _playedAfterMidnight: false, _usedThemeToggle: false,
  };
}
function defaultMapStats() {
  return {
    gamesPlayed: 0, totalAnswered: 0, totalCorrect: 0, totalWrong: 0,
    bestScore: 0, bestPerfectRun: false, modesPlayed: [], learningPct: 0
  };
}

// ─── MAIN STATS OBJECT ──────────────────────────
const Stats = {
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.data = raw ? { ...defaultStats(), ...JSON.parse(raw) } : defaultStats();
    } catch(e) { this.data = defaultStats(); }
    this._updateDailyStreak();
    return this.data;
  },

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch(e) {}
  },

  get() { if (!this.data) this.load(); return this.data; },

  _updateDailyStreak() {
    const s = this.data;
    const today = new Date().toDateString();
    if (s.lastPlayDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    s.dailyStreak = s.lastPlayDate === yesterday ? (s.dailyStreak || 0) + 1 : 1;
    s.lastPlayDate = today;
    const h = new Date().getHours();
    if (h === 0 || h === 1) s._playedAfterMidnight = true;
    this.save();
  },

  // Called after every correct answer (mid-game trophy checks)
  recordCorrectAnswer(mode) {
    const s = this.get();
    if (!s.totalCorrectByMode) s.totalCorrectByMode = { countries:0, capitals:0, flags:0 };
    if (mode && s.totalCorrectByMode[mode] !== undefined) s.totalCorrectByMode[mode]++;
    this.save();
    return this._checkTrophies(true);
  },

  recordComeback() {
    const s = this.get();
    s._lastWasComeback = true;
    this.save();
    return this._checkTrophies(true);
  },

  recordGame({ mapId, mode, score, correct, wrong, totalQuestions, perfectRun, entityResults }) {
    const s = this.get();
    s.totalScore    += score;
    s.totalAnswered += totalQuestions;
    s.totalCorrect  += correct;
    s.totalWrong    += wrong;
    s._lastGameScore = score;

    if (!s.maps[mapId]) s.maps[mapId] = defaultMapStats();
    const ms = s.maps[mapId];
    ms.gamesPlayed++;
    ms.totalAnswered += totalQuestions;
    ms.totalCorrect  += correct;
    ms.totalWrong    += wrong;
    if (score > ms.bestScore) ms.bestScore = score;
    if (perfectRun) ms.bestPerfectRun = true;
    if (!ms.modesPlayed.includes(mode)) ms.modesPlayed.push(mode);

    for (const [id, result] of Object.entries(entityResults)) {
      if (!s.entityStats[id]) s.entityStats[id] = { correct:0, wrong:0 };
      if (result.correct) s.entityStats[id].correct++;
      else s.entityStats[id].wrong++;
    }
    this._recalcLearning(mapId, s);
    this.save();
    return this._checkTrophies(false);
  },

  recordStreak(val) {
    const s = this.get();
    s.currentStreak = val;
    if (val > s.bestStreak) s.bestStreak = val;
    this.save();
  },

  recordStudy(entityId, mapId) {
    const s = this.get();
    if (!s.studiedEntities) s.studiedEntities = {};
    s.studiedEntities[entityId] = true;
    if (!s.maps[mapId]) s.maps[mapId] = defaultMapStats();
    this._recalcLearning(mapId, s);
    this.save();
    return this._checkTrophies(true);
  },

  removeStudied(entityId, mapId) {
    const s = this.get();
    if (s.studiedEntities) delete s.studiedEntities[entityId];
    this._recalcLearning(mapId, s);
    this.save();
  },

  resetStudied(mapId) {
    const s = this.get();
    const entities = new Set(this._getEntitiesForMap(mapId));
    for (const id of Object.keys(s.studiedEntities || {})) {
      if (entities.has(id)) delete s.studiedEntities[id];
    }
    this._recalcLearning(mapId, s);
    this.save();
  },

  isStudied(entityId) { return !!(this.get().studiedEntities || {})[entityId]; },

  recordThemeToggle() {
    const s = this.get();
    s._usedThemeToggle = true;
    this.save();
    return this._checkTrophies(true);
  },

  _recalcLearning(mapId, s) {
    if (!s.maps[mapId]) return;
    const all = this._getEntitiesForMap(mapId);
    const studied = s.studiedEntities || {};
    const learned = all.filter(id => studied[id] || (s.entityStats[id]?.correct > 0));
    s.maps[mapId].learningPct = all.length ? Math.round((learned.length / all.length) * 100) : 0;
  },

  _getEntitiesForMap(mapId) {
    if (mapId === "us_states") return Object.keys(US_STATES);
    return Object.entries(COUNTRIES)
      .filter(([, v]) => mapId === "world" || v.continent === mapId)
      .map(([k]) => k);
  },

  // midGameOnly: only check trophies marked midGame:true
  _checkTrophies(midGameOnly) {
    const s = this.get();
    const newOnes = [];
    for (const t of TROPHIES_DEF) {
      if (midGameOnly && !t.midGame) continue;
      if (!s.trophiesUnlocked.includes(t.id) && t.check(s)) {
        s.trophiesUnlocked.push(t.id);
        newOnes.push(t);
      }
    }
    if (newOnes.length) this.save();
    return newOnes;
  },

  getTotalScore() { return this.get().totalScore; },
  getLevel()      { return levelFromXP(this.get().totalScore); },
  getDailyStreak(){ return this.get().dailyStreak || 0; },
  getMapLearning(mapId) { return this.get().maps[mapId]?.learningPct || 0; },
};

// ─── RENDER STATS SCREEN ─────────────────────────
function renderStatsScreen() {
  const s = Stats.get();
  const accuracy = s.totalAnswered ? Math.round((s.totalCorrect / s.totalAnswered) * 100) : 0;
  const lv = levelFromXP(s.totalScore);
  const xpP = xpProgressInLevel(s.totalScore);
  const mapLabels = { world:"World Map", europe:"Europe", africa:"Africa", asia:"Asia", america:"America", us_states:"U.S. States" };

  let html = `
  <div class="level-display">
    <div class="level-badge">
      <div class="level-badge-num">${lv}</div>
      <div class="level-badge-lbl">Level</div>
    </div>
    <div class="level-info">
      <div class="level-title">${levelTitle(lv)}</div>
      <div class="level-xp">${xpP.cur.toLocaleString()} / ${xpP.needed.toLocaleString()} XP to next level</div>
      <div class="level-bar-outer"><div class="level-bar-inner" style="width:${xpP.pct}%"></div></div>
    </div>
  </div>

  <div class="streak-display">
    <div class="streak-fire">🔥</div>
    <div class="streak-info">
      <div class="streak-num">${s.dailyStreak || 0}</div>
      <div class="streak-label">Day streak${(s.dailyStreak||0)===1?'':'s'}</div>
    </div>
  </div>

  <div class="stats-overview">
    <div class="stat-card"><div class="stat-card-icon">⭐</div><div class="stat-card-value">${s.totalScore.toLocaleString()}</div><div class="stat-card-label">Total XP</div></div>
    <div class="stat-card"><div class="stat-card-icon">✅</div><div class="stat-card-value">${s.totalCorrect.toLocaleString()}</div><div class="stat-card-label">Correct</div></div>
    <div class="stat-card"><div class="stat-card-icon">❌</div><div class="stat-card-value">${s.totalWrong.toLocaleString()}</div><div class="stat-card-label">Wrong</div></div>
    <div class="stat-card"><div class="stat-card-icon">🎯</div><div class="stat-card-value">${accuracy}%</div><div class="stat-card-label">Accuracy</div></div>
    <div class="stat-card"><div class="stat-card-icon">⚡</div><div class="stat-card-value">${s.bestStreak}</div><div class="stat-card-label">Best Streak</div></div>
    <div class="stat-card"><div class="stat-card-icon">🎮</div><div class="stat-card-value">${Object.values(s.maps).reduce((a,m)=>a+m.gamesPlayed,0)}</div><div class="stat-card-label">Games</div></div>
  </div>

  <div class="stats-section-title">Progress by Map</div>`;

  const studied = s.studiedEntities || {};
  for (const mapId of ["world","europe","africa","asia","america","us_states"]) {
    const ms = s.maps[mapId];
    const pct   = ms?.learningPct || 0;
    const best  = ms ? ms.bestScore.toLocaleString() : "—";
    const games = ms?.gamesPlayed || 0;
    const acc   = (ms?.totalAnswered) ? Math.round((ms.totalCorrect/ms.totalAnswered)*100) : 0;
    const allE  = Stats._getEntitiesForMap(mapId);
    const studiedCount  = allE.filter(id => studied[id]).length;
    const mastered      = allE.filter(id => s.entityStats[id]?.correct > 0).length;
    html += `
    <div class="map-stat-row">
      <div class="map-stat-name">${mapLabels[mapId]}</div>
      <div class="map-stat-progress-wrap">
        <div class="map-stat-percent">${pct}% · ${studiedCount} studied · ${mastered} mastered · ${games} games · ${acc}% acc</div>
        <div class="progress-bar-outer"><div class="progress-bar-inner" style="width:${pct}%"></div></div>
      </div>
      <div class="map-stat-scores">
        <div class="map-stat-score-val">${best}</div>
        <div class="map-stat-score-label">Best</div>
      </div>
    </div>`;
  }
  document.getElementById("stats-body").innerHTML = html;
}

// ─── RENDER TROPHIES SCREEN ──────────────────────
function renderTrophiesScreen() {
  const s = Stats.get();
  const unlocked = new Set(s.trophiesUnlocked);
  const pct = Math.round((unlocked.size / TROPHIES_DEF.length) * 100);

  let html = `
  <div class="trophies-summary">
    <div class="trophies-summary-icon">🏆</div>
    <div class="trophies-summary-text">
      <div class="trophies-summary-title">${unlocked.size} of ${TROPHIES_DEF.length} trophies unlocked</div>
      <div class="progress-bar-outer" style="margin-top:8px"><div class="progress-bar-inner" style="width:${pct}%;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div></div>
    </div>
    <div class="trophies-summary-pct">${pct}%</div>
  </div>
  <div class="trophies-grid">`;

  for (const t of TROPHIES_DEF) {
    const ok = unlocked.has(t.id);
    html += `
    <div class="trophy-card ${ok?"unlocked":""}">
      ${ok?'<div class="trophy-check"><i class="fas fa-check"></i></div>':""}
      <div class="trophy-icon">${t.icon}</div>
      <div class="trophy-name">${t.name}</div>
      <div class="trophy-desc">${t.desc}</div>
    </div>`;
  }
  html += `</div>`;
  document.getElementById("trophies-body").innerHTML = html;
}
