// ═══════════════════════════════════════════════
//  WORLD CAPITALS — Statistics & Achievements
// ═══════════════════════════════════════════════

const STORAGE_KEY = "wc_stats_v3";

const TROPHIES_DEF = [
  { id:"first_answer",   icon:"🌟", name:"First Step",        desc:"Answer your first question",           check: s => s.totalAnswered >= 1 },
  { id:"streak_5",       icon:"🔥", name:"On Fire",           desc:"Get 5 correct answers in a row",       check: s => s.bestStreak >= 5 },
  { id:"streak_10",      icon:"⚡", name:"Lightning",         desc:"Get 10 correct answers in a row",      check: s => s.bestStreak >= 10 },
  { id:"streak_20",      icon:"🌪️", name:"Unstoppable",       desc:"Get 20 correct answers in a row",      check: s => s.bestStreak >= 20 },
  { id:"score_1000",     icon:"🥉", name:"Bronze Scholar",    desc:"Earn 1,000 total points",              check: s => s.totalScore >= 1000 },
  { id:"score_5000",     icon:"🥈", name:"Silver Scholar",    desc:"Earn 5,000 total points",              check: s => s.totalScore >= 5000 },
  { id:"score_10000",    icon:"🥇", name:"Gold Scholar",      desc:"Earn 10,000 total points",             check: s => s.totalScore >= 10000 },
  { id:"score_50000",    icon:"👑", name:"Geography King",    desc:"Earn 50,000 total points",             check: s => s.totalScore >= 50000 },
  { id:"play_all_maps",  icon:"🗺️", name:"World Explorer",    desc:"Play all 6 maps at least once",        check: s => Object.keys(s.maps).length >= 6 },
  { id:"perfect_europe", icon:"🏰", name:"European Expert",   desc:"Complete Europe with no mistakes",     check: s => s.maps.europe && s.maps.europe.bestPerfectRun },
  { id:"perfect_africa", icon:"🌴", name:"African Expert",    desc:"Complete Africa with no mistakes",     check: s => s.maps.africa && s.maps.africa.bestPerfectRun },
  { id:"perfect_asia",   icon:"🏯", name:"Asian Expert",      desc:"Complete Asia with no mistakes",       check: s => s.maps.asia && s.maps.asia.bestPerfectRun },
  { id:"perfect_world",  icon:"🌍", name:"World Master",      desc:"Complete the World Map with no mistakes", check: s => s.maps.world && s.maps.world.bestPerfectRun },
  { id:"perfect_america",icon:"🗽", name:"American Expert",   desc:"Complete America with no mistakes",    check: s => s.maps.america && s.maps.america.bestPerfectRun },
  { id:"perfect_us",     icon:"🦅", name:"US States Master",  desc:"Complete U.S. States with no mistakes",check: s => s.maps.us_states && s.maps.us_states.bestPerfectRun },
  { id:"answered_100",   icon:"📚", name:"Bookworm",          desc:"Answer 100 questions total",           check: s => s.totalAnswered >= 100 },
  { id:"answered_500",   icon:"🎓", name:"Graduate",          desc:"Answer 500 questions total",           check: s => s.totalAnswered >= 500 },
  { id:"answered_1000",  icon:"🏛️", name:"Professor",         desc:"Answer 1,000 questions total",         check: s => s.totalAnswered >= 1000 },
  { id:"all_capitals",   icon:"⭐", name:"Capital Master",    desc:"Answer capitals mode for every map",   check: s => ["world","europe","africa","asia","america","us_states"].every(m => s.maps[m] && s.maps[m].modesPlayed && s.maps[m].modesPlayed.includes("capitals")) },
  { id:"all_flags",      icon:"🏳️", name:"Flag Enthusiast",   desc:"Answer flags mode for every map",      check: s => ["world","europe","africa","asia","america","us_states"].every(m => s.maps[m] && s.maps[m].modesPlayed && s.maps[m].modesPlayed.includes("flags")) },
];

// Default stats shape
function defaultStats() {
  return {
    totalScore: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    totalWrong: 0,
    bestStreak: 0,
    currentStreak: 0,
    trophiesUnlocked: [],
    maps: {},
    // per-entity game stats: {id: {correct, wrong}}
    entityStats: {},
    // per-entity study visits: {id: true}
    studiedEntities: {}
  };
}

function defaultMapStats() {
  return {
    gamesPlayed: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    totalWrong: 0,
    bestScore: 0,
    bestPerfectRun: false,
    modesPlayed: [],
    learningPct: 0 // % entities answered correctly at least once
  };
}

// ─── STORAGE ───────────────────────────────────
const Stats = {
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : defaultStats();
    } catch(e) {
      this.data = defaultStats();
    }
    return this.data;
  },

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); }
    catch(e) {}
  },

  get() {
    if (!this.data) this.load();
    return this.data;
  },

  // Called at end of a game session
  recordGame({ mapId, mode, score, correct, wrong, totalQuestions, perfectRun, entityResults }) {
    const s = this.get();

    // Global
    s.totalScore   += score;
    s.totalAnswered += totalQuestions;
    s.totalCorrect += correct;
    s.totalWrong   += wrong;

    // Map-level
    if (!s.maps[mapId]) s.maps[mapId] = defaultMapStats();
    const ms = s.maps[mapId];
    ms.gamesPlayed++;
    ms.totalAnswered += totalQuestions;
    ms.totalCorrect  += correct;
    ms.totalWrong    += wrong;
    if (score > ms.bestScore) ms.bestScore = score;
    if (perfectRun) ms.bestPerfectRun = true;
    if (!ms.modesPlayed.includes(mode)) ms.modesPlayed.push(mode);

    // Entity stats
    for (const [id, result] of Object.entries(entityResults)) {
      if (!s.entityStats[id]) s.entityStats[id] = { correct: 0, wrong: 0 };
      if (result.correct) s.entityStats[id].correct++;
      else s.entityStats[id].wrong++;
    }

    // Learning percentage: studied OR answered correctly counts as "seen"
    this._recalcLearning(mapId, s);

    this.save();

    // Check trophies
    const newTrophies = this._checkTrophies();
    return newTrophies;
  },

  // Record a single study visit for an entity
  recordStudy(entityId, mapId) {
    const s = this.get();
    if (!s.studiedEntities) s.studiedEntities = {};
    s.studiedEntities[entityId] = true;

    // Update map study progress
    if (!s.maps[mapId]) s.maps[mapId] = defaultMapStats();
    this._recalcLearning(mapId, s);

    this.save();
  },

  // Remove a single studied entity
  removeStudied(entityId, mapId) {
    const s = this.get();
    if (s.studiedEntities) delete s.studiedEntities[entityId];
    this._recalcLearning(mapId, s);
    this.save();
  },

  isStudied(entityId) {
    return !!(this.get().studiedEntities || {})[entityId];
  },

  // Remove all studied markers for a given map and recalculate
  resetStudied(mapId) {
    const s = this.get();
    const entities = new Set(this._getEntitiesForMap(mapId));
    for (const id of Object.keys(s.studiedEntities || {})) {
      if (entities.has(id)) delete s.studiedEntities[id];
    }
    this._recalcLearning(mapId, s);
    this.save();
  },

  _recalcLearning(mapId, s) {
    if (!s.maps[mapId]) return;
    const allEntities = this._getEntitiesForMap(mapId);
    const studied  = s.studiedEntities || {};
    const learned = allEntities.filter(id =>
      studied[id] || (s.entityStats[id] && s.entityStats[id].correct > 0)
    );
    s.maps[mapId].learningPct = allEntities.length
      ? Math.round((learned.length / allEntities.length) * 100)
      : 0;
  },

  recordStreak(val) {
    const s = this.get();
    s.currentStreak = val;
    if (val > s.bestStreak) s.bestStreak = val;
    this.save();
  },

  _getEntitiesForMap(mapId) {
    if (mapId === "us_states") return Object.keys(US_STATES);
    return Object.entries(COUNTRIES)
      .filter(([, v]) => {
        if (mapId === "world") return true;
        if (mapId === "europe")  return v.continent === "europe";
        if (mapId === "africa")  return v.continent === "africa";
        if (mapId === "asia")    return v.continent === "asia";
        if (mapId === "america") return v.continent === "america";
        return false;
      })
      .map(([k]) => k);
  },

  _checkTrophies() {
    const s = this.get();
    const newOnes = [];
    for (const t of TROPHIES_DEF) {
      if (!s.trophiesUnlocked.includes(t.id) && t.check(s)) {
        s.trophiesUnlocked.push(t.id);
        newOnes.push(t);
      }
    }
    if (newOnes.length) this.save();
    return newOnes;
  },

  getTotalScore() { return this.get().totalScore; },

  getMapLearning(mapId) {
    const s = this.get();
    return s.maps[mapId] ? s.maps[mapId].learningPct : 0;
  }
};

// ─── RENDER STATS SCREEN ──────────────────────
function renderStatsScreen() {
  const s = Stats.get();
  const accuracy = s.totalAnswered ? Math.round((s.totalCorrect / s.totalAnswered) * 100) : 0;

  const mapLabels = { world:"World Map", europe:"Europe", africa:"Africa", asia:"Asia", america:"America", us_states:"U.S. States" };

  let html = `
  <div class="stats-overview">
    <div class="stat-card">
      <div class="stat-card-icon">⭐</div>
      <div class="stat-card-value">${s.totalScore.toLocaleString()}</div>
      <div class="stat-card-label">Total Score</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">✅</div>
      <div class="stat-card-value">${s.totalCorrect.toLocaleString()}</div>
      <div class="stat-card-label">Correct</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">❌</div>
      <div class="stat-card-value">${s.totalWrong.toLocaleString()}</div>
      <div class="stat-card-label">Wrong</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">🎯</div>
      <div class="stat-card-value">${accuracy}%</div>
      <div class="stat-card-label">Accuracy</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">🔥</div>
      <div class="stat-card-value">${s.bestStreak}</div>
      <div class="stat-card-label">Best Streak</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">🎮</div>
      <div class="stat-card-value">${Object.values(s.maps).reduce((a,m)=>a+m.gamesPlayed,0)}</div>
      <div class="stat-card-label">Games Played</div>
    </div>
  </div>

  <div class="stats-section-title">Progress by Map</div>`;

  const studied = s.studiedEntities || {};

  for (const mapId of ["world","europe","africa","asia","america","us_states"]) {
    const ms = s.maps[mapId];
    const pct   = ms ? ms.learningPct : 0;
    const best  = ms ? ms.bestScore.toLocaleString() : "—";
    const games = ms ? ms.gamesPlayed : 0;
    const acc   = (ms && ms.totalAnswered) ? Math.round((ms.totalCorrect/ms.totalAnswered)*100) : 0;

    // Count studied-only (not yet tested)
    const allE  = Stats._getEntitiesForMap(mapId);
    const studiedCount  = allE.filter(id => studied[id]).length;
    const testedCorrect = allE.filter(id => s.entityStats[id] && s.entityStats[id].correct > 0).length;
    const studiedOnly   = allE.filter(id => studied[id] && !(s.entityStats[id] && s.entityStats[id].correct > 0)).length;

    html += `
    <div class="map-stat-row">
      <div class="map-stat-name">${mapLabels[mapId]}</div>
      <div class="map-stat-progress-wrap">
        <div class="map-stat-percent">${pct}% progress · ${studiedCount} studied · ${testedCorrect} mastered · ${games} games · ${acc}% quiz accuracy</div>
        <div class="progress-bar-outer" title="${pct}% total progress">
          <div class="progress-bar-inner" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="map-stat-scores">
        <div class="map-stat-score-val">${best}</div>
        <div class="map-stat-score-label">Best Score</div>
      </div>
    </div>`;
  }

  document.getElementById("stats-body").innerHTML = html;
}

// ─── RENDER TROPHIES SCREEN ───────────────────
function renderTrophiesScreen() {
  const s = Stats.get();
  const unlocked = new Set(s.trophiesUnlocked);
  const pct = Math.round((unlocked.size / TROPHIES_DEF.length) * 100);

  let html = `
  <div style="margin-bottom:20px; padding:20px; background:var(--glass2); border:1px solid var(--border); border-radius:var(--radius-lg); display:flex; align-items:center; gap:16px;">
    <div style="font-size:2rem">🏆</div>
    <div style="flex:1">
      <div style="font-weight:700; margin-bottom:6px;">${unlocked.size} / ${TROPHIES_DEF.length} Trophies Unlocked</div>
      <div class="progress-bar-outer"><div class="progress-bar-inner" style="width:${pct}%; background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div></div>
    </div>
    <div style="font-size:1.4rem; font-weight:800; color:var(--gold2)">${pct}%</div>
  </div>
  <div class="trophies-grid">`;

  for (const t of TROPHIES_DEF) {
    const isUnlocked = unlocked.has(t.id);
    html += `
    <div class="trophy-card ${isUnlocked ? "unlocked" : ""}">
      ${isUnlocked ? '<div class="trophy-check"><i class="fas fa-check"></i></div>' : ""}
      <div class="trophy-icon">${t.icon}</div>
      <div class="trophy-name">${t.name}</div>
      <div class="trophy-desc">${t.desc}</div>
    </div>`;
  }

  html += `</div>`;
  document.getElementById("trophies-body").innerHTML = html;
}
