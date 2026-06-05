// ═══════════════════════════════════════════════
//  WORLD CAPITALS — Main App Controller
// ═══════════════════════════════════════════════

let activeScreen   = "home";
let selectedMapDef = null;
let currentMode    = null;
let trophyTimer    = null;

// Card gradient map (matches CSS --grad-* variables)
const CARD_GRAD = {
  world:    "var(--grad-world)",
  europe:   "var(--grad-europe)",
  africa:   "var(--grad-africa)",
  asia:     "var(--grad-asia)",
  america:  "var(--grad-america)",
  us_states:"var(--grad-us)",
};

// ─── INIT ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  Stats.load();
  applyStoredTheme();
  buildMapGrid();
  bindUIEvents();
  updateNavScore();
  updateNavLevel();
  updateNavStreak();
  showScreen("home");
});

// ─── SCREEN MANAGER ────────────────────────────
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(`screen-${name}`);
  if (el) el.classList.add("active");
  activeScreen = name;
  if (name === "stats")    renderStatsScreen();
  if (name === "trophies") renderTrophiesScreen();
}

// ─── NAVBAR ────────────────────────────────────
function updateNavScore() {
  document.getElementById("nav-score").textContent = Stats.getTotalScore().toLocaleString();
  updateXPBar();
}
function updateNavLevel() {
  document.getElementById("nav-level-val").textContent = `Lv ${Stats.getLevel()}`;
  updateXPBar();
}
function updateNavStreak() {
  const streak = Stats.getDailyStreak();
  const el = document.getElementById("nav-streak");
  if (streak >= 2) {
    el.classList.remove("hidden");
    document.getElementById("nav-streak-val").textContent = streak;
  } else {
    el.classList.add("hidden");
  }
}
function updateXPBar() {
  const { pct } = xpProgressInLevel(Stats.getTotalScore());
  document.getElementById("xp-bar-fill").style.width = `${pct}%`;
}

// ─── THEME ─────────────────────────────────────
function applyStoredTheme() {
  const saved = localStorage.getItem("wc_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("theme-icon").className = saved === "dark" ? "fas fa-moon" : "fas fa-sun";
}
function toggleTheme() {
  const html    = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next    = current === "dark" ? "light" : "dark";
  html.classList.add("theme-transitioning");
  html.setAttribute("data-theme", next);
  document.getElementById("theme-icon").className = next === "dark" ? "fas fa-moon" : "fas fa-sun";
  localStorage.setItem("wc_theme", next);
  setTimeout(() => html.classList.remove("theme-transitioning"), 450);
  const newT = Stats.recordThemeToggle();
  if (newT.length) showTrophyPopup(newT[0]);
}

// ─── TROPHY POPUP ──────────────────────────────
function showTrophyPopup(trophy) {
  const el = document.getElementById("trophy-popup");
  if (!el) return;
  clearTimeout(trophyTimer);
  el.classList.remove("hidden", "hiding");
  document.getElementById("trophy-popup-icon").textContent = trophy.icon;
  document.getElementById("trophy-popup-name").textContent = trophy.name;
  document.getElementById("trophy-popup-desc").textContent = trophy.desc;
  trophyTimer = setTimeout(() => {
    el.classList.add("hiding");
    setTimeout(() => el.classList.add("hidden"), 330);
  }, 3500);
}

// ─── MAP GRID (replaces carousel) ──────────────
function buildMapGrid() {
  const grid = document.getElementById("map-grid");
  grid.innerHTML = "";

  MAP_DEFS.forEach((def, i) => {
    const pct  = Stats.getMapLearning(def.id);
    const grad = CARD_GRAD[def.id] || CARD_GRAD.world;

    const card = document.createElement("div");
    card.className = "mg-card";
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", def.label);
    card.innerHTML = `
      <div class="mg-bg" style="background:${grad}"></div>
      <div class="mg-map" id="mg-map-${i}"></div>
      <div class="mg-emoji">${def.icon}</div>
      <div class="mg-body">
        <div class="mg-label">${def.label}</div>
        <div class="mg-progress-bar">
          <div class="mg-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="mg-sub">${pct > 0 ? `${pct}% learned` : "Not started"}</div>
      </div>`;

    card.addEventListener("click", () => openModeModal(def));
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openModeModal(def); });
    grid.appendChild(card);

    // Load mini map preview asynchronously
    const mapEl = document.getElementById(`mg-map-${i}`);
    setTimeout(() => renderCardMiniMap(def, mapEl).catch(() => {}), i * 120);
  });
}

// ─── BIND EVENTS ───────────────────────────────
function bindUIEvents() {
  document.getElementById("btn-theme").addEventListener("click", toggleTheme);

  document.addEventListener("keydown", e => {
    if (activeScreen === "map" && Game.active && Game.mode === "capitals" && e.key === "Enter") {
      submitCapitalAnswer();
    }
    if (e.key === "Escape") {
      document.getElementById("mode-modal").classList.add("hidden");
      document.getElementById("info-modal").classList.add("hidden");
    }
  });

  // Mode modal
  document.getElementById("mode-modal-close").addEventListener("click", closeModeModal);
  document.getElementById("btn-study").addEventListener("click", startStudy);
  document.getElementById("btn-play").addEventListener("click", showPlayOptions);
  document.getElementById("mode-stage-back").addEventListener("click", () => {
    document.getElementById("mode-stage-1").classList.remove("hidden");
    document.getElementById("mode-stage-2").classList.add("hidden");
  });
  document.getElementById("btn-mode-countries").addEventListener("click", () => startGame("countries"));
  document.getElementById("btn-mode-capitals") .addEventListener("click", () => startGame("capitals"));
  document.getElementById("btn-mode-flags")    .addEventListener("click", () => startGame("flags"));

  // Reset study
  document.getElementById("btn-reset-study").addEventListener("click", () => {
    if (!selectedMapDef) return;
    Stats.resetStudied(selectedMapDef.id);
    Renderer.svg && Renderer.svg.selectAll(".country-path, .us-state-path").classed("studied", false);
    document.getElementById("study-panel").classList.add("hidden");
    showToast("Study progress reset", "info");
  });

  // Map back
  document.getElementById("map-back-btn").addEventListener("click", () => {
    if (Game.active) {
      if (confirm("Leave the game? Your progress will be lost.")) {
        Game.stop(); goHome();
      }
    } else { goHome(); }
  });

  // Study panel
  document.getElementById("study-close").addEventListener("click", () =>
    document.getElementById("study-panel").classList.add("hidden")
  );
  document.getElementById("btn-more-info").addEventListener("click", openMoreInfo);
  document.getElementById("info-modal-close").addEventListener("click", () =>
    document.getElementById("info-modal").classList.add("hidden")
  );

  // Capital input
  document.getElementById("gp-submit").addEventListener("click", submitCapitalAnswer);
  document.getElementById("gp-input").addEventListener("keydown", e => {
    if (e.key === "Enter") submitCapitalAnswer();
  });

  // Game over
  document.getElementById("btn-play-again").addEventListener("click", () => {
    document.getElementById("gameover-modal").classList.add("hidden");
    if (selectedMapDef && currentMode) startGame(currentMode);
  });
  document.getElementById("btn-go-home").addEventListener("click", () => {
    document.getElementById("gameover-modal").classList.add("hidden");
    goHome();
  });

  // Backdrop dismiss
  ["mode-modal", "info-modal", "gameover-modal"].forEach(id => {
    document.getElementById(id).addEventListener("click", e => {
      if (e.target === e.currentTarget) {
        e.currentTarget.classList.add("hidden");
        if (id === "gameover-modal") goHome();
      }
    });
  });
}

// ─── NAVIGATION ────────────────────────────────
function goHome() {
  Renderer.resetAllHighlights && Renderer.resetAllHighlights();
  document.getElementById("study-panel").classList.add("hidden");
  document.getElementById("game-panel").classList.add("hidden");
  document.getElementById("game-hud").classList.add("hidden");
  buildMapGrid();
  showScreen("home");
}

// ─── MODE MODAL ────────────────────────────────
function openModeModal(mapDef) {
  selectedMapDef = mapDef;
  document.getElementById("mode-modal-header").innerHTML = `
    <div class="mode-map-icon">${mapDef.icon}</div>
    <h2>${mapDef.label}</h2>
    <p>${entityCountForMap(mapDef)} ${mapDef.isUSStates ? "states" : "countries"}</p>`;
  document.getElementById("mode-stage-1").classList.remove("hidden");
  document.getElementById("mode-stage-2").classList.add("hidden");
  document.getElementById("mode-modal").classList.remove("hidden");
}
function closeModeModal() {
  document.getElementById("mode-modal").classList.add("hidden");
}
function entityCountForMap(mapDef) {
  if (mapDef.isUSStates) return Object.keys(US_STATES).length;
  if (mapDef.id === "world") return Object.keys(COUNTRIES).length;
  return Object.values(COUNTRIES).filter(c => c.continent === mapDef.id).length;
}

// ─── STUDY / PLAY ──────────────────────────────
function startStudy() {
  closeModeModal();
  currentMode = "study";
  openMap(selectedMapDef, "study");
}
function showPlayOptions() {
  document.getElementById("mode-stage-1").classList.add("hidden");
  document.getElementById("mode-stage-2").classList.remove("hidden");
}
function startGame(mode) {
  closeModeModal();
  if (mode === "flags" && selectedMapDef.isUSStates) {
    showToast("Flags not available for U.S. States — using Countries mode", "info", 3000);
    mode = "countries";
  }
  currentMode = mode;
  openMap(selectedMapDef, "game", mode);
}

// ─── OPEN MAP ──────────────────────────────────
function openMap(mapDef, modeType, gameMode) {
  showScreen("map");
  document.getElementById("map-title-label").textContent = mapDef.label;
  ["study-panel","game-panel","game-hud","gameover-modal"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
  document.getElementById("btn-reset-study")
    .classList.toggle("hidden", modeType !== "study");

  Renderer.renderMap(mapDef, id => handleEntityClick(id, modeType, mapDef))
    .then(() => {
      if (modeType === "game") {
        Game.start(mapDef.id, gameMode, getEntitiesForMap(mapDef));
      } else {
        // Restore study markers from saved progress
        const studied = Stats.get().studiedEntities || {};
        Object.keys(studied).forEach(id => Renderer.markStudied(id));
      }
    });
}

function getEntitiesForMap(mapDef) {
  const rendered = Renderer.getFeatureIds();
  return mapDef.isUSStates
    ? rendered.filter(id => US_STATES[id])
    : rendered.filter(id => COUNTRIES[id]);
}

// ─── ENTITY CLICK ──────────────────────────────
function handleEntityClick(entityId, modeType, mapDef) {
  if (modeType === "study") showStudyPanel(entityId, mapDef);
  else if (modeType === "game") handleGameClick(entityId);
}

// ─── STUDY PANEL ───────────────────────────────
function showStudyPanel(entityId, mapDef) {
  const isUS = mapDef.isUSStates;
  const data = isUS ? getStateData(entityId) : getCountryData(entityId);
  if (!data) return;

  const panel = document.getElementById("study-panel");
  const isOpen = !panel.classList.contains("hidden");
  const showingThis = panel.dataset.entityId === String(entityId);

  // Second click on same country → close + un-dim
  if (isOpen && showingThis) {
    panel.classList.add("hidden");
    Stats.removeStudied(entityId, mapDef.id);
    const el = document.getElementById(`country-${entityId}`);
    if (el) el.classList.remove("studied");
    return;
  }

  // New country click
  const newTrophies = Stats.recordStudy(entityId, mapDef.id);
  Renderer.markStudied(entityId);
  if (newTrophies.length) setTimeout(() => showTrophyPopup(newTrophies[0]), 200);

  document.getElementById("study-name").textContent    = data.name;
  document.getElementById("study-capital").textContent = data.capital;

  const flagEl = document.getElementById("study-flag");
  flagEl.style.display = "";
  flagEl.removeAttribute("src");
  if (!isUS && data.iso2) {
    flagEl.src = flagUrl(data.iso2, 80);
    flagEl.onerror = () => { flagEl.style.display = "none"; };
    flagEl.parentElement.style.display = "";
  } else {
    flagEl.parentElement.style.display = "none";
  }

  panel.dataset.entityId = entityId;
  panel.dataset.isUs     = isUS;
  panel.classList.remove("hidden");
}

function openMoreInfo() {
  const panel    = document.getElementById("study-panel");
  const entityId = panel.dataset.entityId;
  const isUS     = panel.dataset.isUs === "true";
  const data     = isUS ? getStateData(entityId) : getCountryData(entityId);
  if (!data) return;

  document.getElementById("info-modal-name").textContent    = data.name;
  document.getElementById("info-modal-capital").textContent = data.capital;

  const flagEl = document.getElementById("info-modal-flag");
  if (!isUS && data.iso2) {
    flagEl.src = flagUrl(data.iso2, 160);
    flagEl.style.display = "";
  } else { flagEl.style.display = "none"; }

  document.getElementById("info-modal-body").innerHTML = buildInfoBody(data, isUS);
  document.getElementById("info-modal").classList.remove("hidden");
}

function buildInfoBody(data, isUS) {
  const chips = isUS
    ? [{ label:"Capital", value:data.capital }, { label:"Abbreviation", value:data.abbr || "—" }]
    : [{ label:"Capital", value:data.capital }, { label:"Continent", value:capitalize(data.continent) }];
  const chipsHtml = chips.map(c => `
    <div class="info-chip">
      <div class="info-chip-label">${c.label}</div>
      <div class="info-chip-value">${c.value}</div>
    </div>`).join("");
  return `<div class="info-grid">${chipsHtml}</div><div class="info-summary">${data.summary || "No additional information available."}</div>`;
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

// ─── GAME ──────────────────────────────────────
function handleGameClick(entityId) {
  if (!Game.active) return;
  const result = Game.answerClick(entityId);
  if (!result) return;
  if (result.correct)         Renderer.highlightEntity(result.id, "correct");
  else if (result.showAnswer) Renderer.highlightEntity(result.answerId, "wrong");
}

function submitCapitalAnswer() {
  if (!Game.active || Game.mode !== "capitals") return;
  const inp  = document.getElementById("gp-input");
  const text = inp.value.trim();
  if (!text) return;
  const result = Game.answerText(text);
  if (result?.correct) Renderer.highlightEntity(result.id, "correct");
}
