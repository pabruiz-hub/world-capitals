// ═══════════════════════════════════════════════
//  WORLD CAPITALS — Main App Controller
// ═══════════════════════════════════════════════

// ─── STATE ─────────────────────────────────────
let activeScreen = "home";
let carouselIdx  = 0;
let selectedMapDef = null;
let currentMode  = null;   // "study" | "play"

// ─── INIT ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  Stats.load();
  buildCarousel();
  bindUIEvents();
  updateNavScore();
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

// ─── NAVBAR SCORE ──────────────────────────────
function updateNavScore() {
  document.getElementById("nav-score").textContent = Stats.getTotalScore().toLocaleString();
}

// ─── CAROUSEL ──────────────────────────────────
function buildCarousel() {
  const track = document.getElementById("carousel-track");
  const dots  = document.getElementById("carousel-dots");
  track.innerHTML = "";
  dots.innerHTML  = "";

  MAP_DEFS.forEach((def, i) => {
    const pct = Stats.getMapLearning(def.id);

    const card = document.createElement("div");
    card.className = `map-card${i === carouselIdx ? " active" : ""}`;
    card.dataset.idx = i;
    card.innerHTML = `
      <div class="card-visual" id="card-preview-${i}">
        <div class="card-visual-bg" style="background:linear-gradient(145deg,${def.bgColor},transparent)"></div>
        <div class="card-emoji-fallback">${def.icon}</div>
      </div>
      <div class="card-body">
        <div class="card-label">${def.label}</div>
        <div class="card-progress-bar">
          <div class="card-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="card-progress-label">${pct > 0 ? `${pct}% learned` : "Not started"}</div>
      </div>`;

    card.addEventListener("click", () => {
      setCarouselIdx(i);
      openModeModal(def);
    });
    track.appendChild(card);

    // Dot
    const dot = document.createElement("div");
    dot.className = `carousel-dot${i === carouselIdx ? " active" : ""}`;
    dot.addEventListener("click", () => setCarouselIdx(i));
    dots.appendChild(dot);

    // Load mini map SVG asynchronously into the card visual
    const previewEl = document.getElementById(`card-preview-${i}`);
    setTimeout(() => {
      renderCardMiniMap(def, previewEl).catch(() => {});
    }, i * 150);
  });

  applyCarouselTransform();
}

function setCarouselIdx(idx) {
  carouselIdx = Math.max(0, Math.min(MAP_DEFS.length - 1, idx));
  document.querySelectorAll(".map-card").forEach((c, i) => {
    c.classList.toggle("active", i === carouselIdx);
  });
  document.querySelectorAll(".carousel-dot").forEach((d, i) => {
    d.classList.toggle("active", i === carouselIdx);
  });
  applyCarouselTransform();
}

function applyCarouselTransform() {
  const track = document.getElementById("carousel-track");
  const viewport = document.querySelector(".carousel-viewport");
  const cards = track.querySelectorAll(".map-card");
  if (!cards.length) return;

  const cardW = cards[0].offsetWidth + 20; // + gap
  const vw = viewport.clientWidth;
  const offset = vw / 2 - cardW / 2 - carouselIdx * cardW;
  track.style.transform = `translateX(${offset}px)`;
}

window.addEventListener("resize", () => {
  if (activeScreen === "home") applyCarouselTransform();
});

// ─── BIND GLOBAL UI ────────────────────────────
function bindUIEvents() {
  // Carousel arrows
  document.getElementById("arrow-prev").addEventListener("click", () => setCarouselIdx(carouselIdx - 1));
  document.getElementById("arrow-next").addEventListener("click", () => setCarouselIdx(carouselIdx + 1));

  // Keyboard arrow keys for carousel
  document.addEventListener("keydown", e => {
    if (activeScreen === "home") {
      if (e.key === "ArrowLeft")  setCarouselIdx(carouselIdx - 1);
      if (e.key === "ArrowRight") setCarouselIdx(carouselIdx + 1);
      if (e.key === "Enter" || e.key === " ") openModeModal(MAP_DEFS[carouselIdx]);
    }
    if (activeScreen === "map" && Game.active && Game.mode === "capitals" && e.key === "Enter") {
      submitCapitalAnswer();
    }
  });

  // Touch swipe for carousel
  let touchStartX = 0;
  const vp = document.querySelector(".carousel-viewport");
  vp.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  vp.addEventListener("touchend", e => {
    const dx = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) setCarouselIdx(carouselIdx + (dx > 0 ? 1 : -1));
  });

  // Mode modal
  document.getElementById("mode-modal-close").addEventListener("click", closeModeModal);
  document.getElementById("btn-study").addEventListener("click", () => startStudy());
  document.getElementById("btn-play").addEventListener("click", () => showPlayOptions());
  document.getElementById("mode-stage-back").addEventListener("click", () => {
    document.getElementById("mode-stage-1").classList.remove("hidden");
    document.getElementById("mode-stage-2").classList.add("hidden");
  });

  // Game mode buttons
  document.getElementById("btn-mode-countries").addEventListener("click", () => startGame("countries"));
  document.getElementById("btn-mode-capitals") .addEventListener("click", () => startGame("capitals"));
  document.getElementById("btn-mode-flags")    .addEventListener("click", () => startGame("flags"));

  // Reset study button
  document.getElementById("btn-reset-study").addEventListener("click", () => {
    if (!selectedMapDef) return;
    Stats.resetStudied(selectedMapDef.id);
    Renderer.svg.selectAll(".country-path, .us-state-path").classed("studied", false);
    document.getElementById("study-panel").classList.add("hidden");
    showToast("Study progress reset", "info");
  });

  // Map back button
  document.getElementById("map-back-btn").addEventListener("click", () => {
    if (Game.active) {
      if (confirm("Leave the game? Your progress will be lost.")) {
        Game.stop();
        goHome();
      }
    } else {
      goHome();
    }
  });

  // Study panel
  document.getElementById("study-close").addEventListener("click", () => {
    document.getElementById("study-panel").classList.add("hidden");
  });
  document.getElementById("btn-more-info").addEventListener("click", openMoreInfo);
  document.getElementById("info-modal-close").addEventListener("click", () => {
    document.getElementById("info-modal").classList.add("hidden");
  });

  // Capital input submit
  document.getElementById("gp-submit").addEventListener("click", submitCapitalAnswer);
  document.getElementById("gp-input").addEventListener("keydown", e => {
    if (e.key === "Enter") submitCapitalAnswer();
  });

  // Game over modal
  document.getElementById("btn-play-again").addEventListener("click", () => {
    document.getElementById("gameover-modal").classList.add("hidden");
    if (selectedMapDef && currentMode) startGame(currentMode);
  });
  document.getElementById("btn-go-home").addEventListener("click", () => {
    document.getElementById("gameover-modal").classList.add("hidden");
    goHome();
  });

  // Close overlays on backdrop click
  document.getElementById("mode-modal").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModeModal();
  });
  document.getElementById("info-modal").addEventListener("click", e => {
    if (e.target === e.currentTarget) document.getElementById("info-modal").classList.add("hidden");
  });
  document.getElementById("gameover-modal").addEventListener("click", e => {
    if (e.target === e.currentTarget) {
      document.getElementById("gameover-modal").classList.add("hidden");
      goHome();
    }
  });
}

// ─── NAVIGATION ────────────────────────────────
function goHome() {
  Renderer.resetAllHighlights && Renderer.resetAllHighlights();
  document.getElementById("study-panel").classList.add("hidden");
  document.getElementById("game-panel").classList.add("hidden");
  document.getElementById("game-hud").classList.add("hidden");
  buildCarousel(); // refresh progress badges
  showScreen("home");
}

// ─── MODE MODAL ────────────────────────────────
function openModeModal(mapDef) {
  selectedMapDef = mapDef;

  document.getElementById("mode-modal-header").innerHTML = `
    <span style="font-size:3rem">${mapDef.icon}</span>
    <h2>${mapDef.label}</h2>
    <p>${entityCountForMap(mapDef)} ${mapDef.isUSStates ? "states" : "countries"}</p>
  `;

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

// ─── STUDY MODE ────────────────────────────────
function startStudy() {
  closeModeModal();
  currentMode = "study";
  openMap(selectedMapDef, "study");
}

function showPlayOptions() {
  document.getElementById("mode-stage-1").classList.add("hidden");
  document.getElementById("mode-stage-2").classList.remove("hidden");
}

// ─── GAME START ────────────────────────────────
function startGame(mode) {
  closeModeModal();
  currentMode = mode;

  // Don't show flags for US states
  if (mode === "flags" && selectedMapDef.isUSStates) {
    showToast("Flags not available for U.S. States. Playing Countries mode.", "info", 3000);
    mode = "countries";
    currentMode = "countries";
  }

  openMap(selectedMapDef, "game", mode);
}

// ─── OPEN MAP ──────────────────────────────────
function openMap(mapDef, modeType, gameMode) {
  showScreen("map");
  document.getElementById("map-title-label").textContent = mapDef.label;
  document.getElementById("study-panel").classList.add("hidden");
  document.getElementById("game-panel").classList.add("hidden");
  document.getElementById("game-hud").classList.add("hidden");
  document.getElementById("gameover-modal").classList.add("hidden");
  document.getElementById("btn-reset-study").classList.toggle("hidden", modeType !== "study");

  Renderer.renderMap(mapDef, (entityId) => {
    handleEntityClick(entityId, modeType, mapDef);
  }).then(() => {
    if (modeType === "game") {
      const entities = getEntitiesForMap(mapDef);
      Game.start(mapDef.id, gameMode, entities);
    } else if (modeType === "study") {
      // Restore studied markers from saved progress
      const studied = Stats.get().studiedEntities || {};
      for (const id of Object.keys(studied)) {
        Renderer.markStudied(id);
      }
    }
  });
}

function getEntitiesForMap(mapDef) {
  // Return list of entity ids (country numeric codes or state fips)
  const rendered = Renderer.getFeatureIds();
  if (mapDef.isUSStates) {
    return rendered.filter(id => US_STATES[id]);
  } else {
    return rendered.filter(id => COUNTRIES[id]);
  }
}

// ─── ENTITY CLICK HANDLER ──────────────────────
function handleEntityClick(entityId, modeType, mapDef) {
  if (modeType === "study") {
    showStudyPanel(entityId, mapDef);
  } else if (modeType === "game") {
    handleGameClick(entityId);
  }
}

// ─── STUDY PANEL ───────────────────────────────
function showStudyPanel(entityId, mapDef) {
  const isUS = mapDef.isUSStates;
  const data = isUS ? getStateData(entityId) : getCountryData(entityId);
  if (!data) return;

  const panel = document.getElementById("study-panel");
  const panelOpen = !panel.classList.contains("hidden");
  const panelShowingThis = panel.dataset.entityId === String(entityId);

  // Panel is open for this country → close it and un-dim
  if (panelOpen && panelShowingThis) {
    panel.classList.add("hidden");
    Stats.removeStudied(entityId, mapDef.id);
    const el = document.getElementById(`country-${entityId}`);
    if (el) el.classList.remove("studied");
    return;
  }

  // Save study visit and dim
  Stats.recordStudy(entityId, mapDef.id);
  Renderer.markStudied(entityId);

  document.getElementById("study-name").textContent = data.name;
  document.getElementById("study-capital").textContent = data.capital;

  const flagEl = document.getElementById("study-flag");
  flagEl.style.display = "";          // always reset — onerror may have hidden it
  flagEl.removeAttribute("src");      // clear before assigning to force reload
  if (!isUS && data.iso2) {
    flagEl.src = flagUrl(data.iso2, 80);
    flagEl.alt = data.name;
    flagEl.onerror = () => { flagEl.style.display = "none"; };
    flagEl.parentElement.style.display = "";
  } else {
    flagEl.parentElement.style.display = "none";
  }

  // Store for More Info
  document.getElementById("study-panel").dataset.entityId = entityId;
  document.getElementById("study-panel").dataset.isUs = isUS;

  document.getElementById("study-panel").classList.remove("hidden");
}

function openMoreInfo() {
  const panel = document.getElementById("study-panel");
  const entityId = panel.dataset.entityId;
  const isUS = panel.dataset.isUs === "true";

  const data = isUS ? getStateData(entityId) : getCountryData(entityId);
  if (!data) return;

  document.getElementById("info-modal-name").textContent = data.name;
  document.getElementById("info-modal-capital").textContent = data.capital;

  const flagEl = document.getElementById("info-modal-flag");
  if (!isUS && data.iso2) {
    flagEl.src = flagUrl(data.iso2, 160);
    flagEl.alt = data.name;
    flagEl.style.display = "";
  } else {
    flagEl.style.display = "none";
  }

  const body = document.getElementById("info-modal-body");
  body.innerHTML = buildInfoBody(data, isUS);

  document.getElementById("info-modal").classList.remove("hidden");
}

function buildInfoBody(data, isUS) {
  const chips = isUS
    ? [
        { label: "Capital",    value: data.capital },
        { label: "State Code", value: data.abbr || "—" },
      ]
    : [
        { label: "Capital",    value: data.capital },
        { label: "Continent",  value: capitalize(data.continent) },
      ];

  const chipsHtml = chips.map(c => `
    <div class="info-chip">
      <div class="info-chip-label">${c.label}</div>
      <div class="info-chip-value">${c.value}</div>
    </div>`).join("");

  return `
    <div class="info-grid">${chipsHtml}</div>
    <div class="info-summary">${data.summary || "No additional information available."}</div>
  `;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

// ─── GAME CLICK ────────────────────────────────
function handleGameClick(entityId) {
  if (!Game.active) return;

  const result = Game.answerClick(entityId);
  if (!result) return;

  if (result.correct) {
    Renderer.highlightEntity(result.id, "correct");
  } else if (result.showAnswer) {
    Renderer.highlightEntity(result.answerId, "wrong");
  }
  // partial wrong: no highlight change
}

// ─── CAPITAL INPUT ─────────────────────────────
function submitCapitalAnswer() {
  if (!Game.active || Game.mode !== "capitals") return;
  const inp = document.getElementById("gp-input");
  const text = inp.value.trim();
  if (!text) return;

  const result = Game.answerText(text);
  if (!result) return;

  if (result.correct) {
    Renderer.highlightEntity(result.id, "correct");
  }
}

// ─── KEYBOARD SHORTCUTS ────────────────────────
// Already bound in bindUIEvents
