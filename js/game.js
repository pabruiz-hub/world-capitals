// ═══════════════════════════════════════════════
//  WORLD CAPITALS — Game Engine
// ═══════════════════════════════════════════════

const Game = {
  active: false,
  mapId: null,
  mode: null,      // "countries" | "capitals" | "flags"
  queue: [],       // shuffled list of entity ids to ask
  current: null,   // current entity id
  attempts: 0,
  score: 0,
  correct: 0,
  wrong: 0,
  streak: 0,
  totalQuestions: 0,
  answered: {},    // id → {correct: bool}
  perfectRun: true,

  // ─── START ─────────────────────────────────
  start(mapId, mode, entities) {
    this.active = true;
    this.mapId = mapId;
    this.mode = mode;
    this.queue = shuffle([...entities]);
    this.current = null;
    this.attempts = 0;
    this.score = 0;
    this.correct = 0;
    this.wrong = 0;
    this.streak = 0;
    this.totalQuestions = this.queue.length;
    this.answered = {};
    this.perfectRun = true;

    this._showGamePanel();
    this._showHUD();
    this._next();
  },

  // ─── NEXT QUESTION ─────────────────────────
  _next() {
    if (this.queue.length === 0) {
      this._finish();
      return;
    }
    this.current = this.queue.shift();
    this.attempts = 0;
    this._renderQuestion();
  },

  // ─── RENDER QUESTION ───────────────────────
  _renderQuestion() {
    const isUS = this.mapId === "us_states";
    const data = isUS ? getStateData(this.current) : getCountryData(this.current);
    if (!data) { this._next(); return; }

    const panel = document.getElementById("game-panel");
    panel.classList.remove("hidden");

    // Badge
    const labels = { countries:"🗺 Countries", capitals:"🏙 Capitals", flags:"🚩 Flags" };
    document.getElementById("gp-mode-badge").textContent = labels[this.mode] || this.mode;

    // Lives
    this._renderLives();

    // Flag
    const flagWrap = document.getElementById("gp-flag-wrap");
    const flagImg  = document.getElementById("gp-flag");
    const input    = document.getElementById("gp-input-wrap");
    const fb       = document.getElementById("gp-feedback");
    fb.classList.add("hidden");

    if (this.mode === "flags" && !isUS) {
      flagWrap.classList.remove("hidden");
      flagImg.src = flagUrl(data.iso2, 160);
      flagImg.alt = "?";
    } else {
      flagWrap.classList.add("hidden");
    }

    // Question text
    const q = document.getElementById("gp-question");
    if (this.mode === "countries") {
      q.innerHTML = `Find <strong>${data.name}</strong> on the map`;
    } else if (this.mode === "flags") {
      q.innerHTML = isUS ? `Find <strong>${data.name}</strong> on the map` : `Which country does this flag belong to?`;
    } else {
      q.innerHTML = `What is the capital of <strong>${data.name}</strong>?`;
    }

    // Input
    if (this.mode === "capitals") {
      input.classList.remove("hidden");
      const inp = document.getElementById("gp-input");
      inp.value = "";
      setTimeout(() => { try { inp.focus(); } catch(e){} }, 100);
    } else {
      input.classList.add("hidden");
    }

    // Update HUD
    const done = Object.keys(this.answered).length;
    document.getElementById("hud-progress").textContent = `${done}/${this.totalQuestions}`;
    document.getElementById("hud-score").textContent = this.score.toLocaleString();
  },

  // ─── ANSWER (click on map) ─────────────────
  answerClick(entityId) {
    if (!this.active) return false;
    if (this.mode !== "countries" && this.mode !== "flags") return false;
    if (!this.current) return false;
    if (this.answered[this.current]) return false;

    const correct = String(entityId) === String(this.current);
    const savedCurrent = this.current;
    const result = this._processAnswer(correct, entityId);
    if (result && !result.id) result.id = savedCurrent;
    return result;
  },

  // ─── ANSWER (text input) ──────────────────
  answerText(text) {
    if (!this.active) return false;
    if (this.mode !== "capitals") return false;
    if (!this.current) return false;
    if (this.answered[this.current]) return false;

    const isUS = this.mapId === "us_states";
    const data = isUS ? getStateData(this.current) : getCountryData(this.current);
    if (!data) return false;

    const savedId = this.current;
    const correct = normalizeAnswer(text) === normalizeAnswer(data.capital);
    const result = this._processAnswer(correct);
    if (result && !result.id) result.id = savedId;
    return result;
  },

  // ─── PROCESS ANSWER ────────────────────────
  _processAnswer(correct, clickedId) {
    const savedId = this.current;
    this.attempts++;
    const fb = document.getElementById("gp-feedback");

    if (correct) {
      const baseScore    = 100;
      const attemptBonus = this.attempts === 1 ? 50 : this.attempts === 2 ? 20 : 0;
      const streakBonus  = Math.min(this.streak * 10, 200);
      const pts = baseScore + attemptBonus + streakBonus;
      this.score += pts;
      this.correct++;
      this.streak++;
      Stats.recordStreak(this.streak);

      // Comeback trophy check
      if (this.attempts === 3) {
        const newT = Stats.recordComeback();
        if (newT.length) showTrophyPopup(newT[0]);
      }

      // Mid-game trophy check after correct answer
      const newTrophies = Stats.recordCorrectAnswer(this.mode);
      if (newTrophies.length) setTimeout(() => showTrophyPopup(newTrophies[0]), 500);

      this.answered[this.current] = { correct: true };

      fb.className = "correct-fb";
      fb.textContent = `✓ Correct! +${pts} pts`;
      fb.classList.remove("hidden");

      document.getElementById("hud-score").textContent = this.score.toLocaleString();
      updateNavScore();
      updateNavLevel();

      // Combo burst animation for streaks >= 3
      if (this.streak >= 3) showComboBurst(this.streak);

      showToast(`✓ +${pts} XP`, "correct");

      setTimeout(() => { fb.classList.add("hidden"); this._next(); }, 800);

      return { correct: true, id: savedId, pts };

    } else {
      if (this.attempts >= 3) {
        // Out of attempts
        this.wrong++;
        this.perfectRun = false;
        this.streak = 0;
        Stats.recordStreak(0);

        this.answered[this.current] = { correct: false };

        const isUS = this.mapId === "us_states";
        const data = isUS ? getStateData(this.current) : getCountryData(this.current);
        const correctAnswer = this.mode === "capitals"
          ? (data ? data.capital : "?")
          : (data ? data.name : savedId);

        fb.className = "wrong-fb";
        fb.textContent = `✗ The answer was: ${correctAnswer}`;
        fb.classList.remove("hidden");

        showToast(`✗ ${correctAnswer}`, "wrong");

        setTimeout(() => {
          fb.classList.add("hidden");
          this._next();
        }, 2000);

        return { correct: false, id: savedId, showAnswer: true, answerId: savedId };
      } else {
        // Still has attempts
        this._renderLives();
        const remaining = 3 - this.attempts;

        fb.className = "wrong-fb";
        fb.textContent = `✗ Wrong! ${remaining} attempt${remaining > 1 ? "s" : ""} left`;
        fb.classList.remove("hidden");

        // Clear input for next attempt
        if (this.mode === "capitals") {
          const inp = document.getElementById("gp-input");
          inp.value = "";
          inp.style.borderColor = "var(--red)";
          setTimeout(() => { inp.style.borderColor = ""; }, 500);
        }

        setTimeout(() => { fb.classList.add("hidden"); }, 1200);

        return { correct: false, partial: true, attempts: this.attempts };
      }
    }
  },

  // ─── FINISH ────────────────────────────────
  _finish() {
    this.active = false;

    document.getElementById("game-panel").classList.add("hidden");
    document.getElementById("game-hud").classList.add("hidden");

    const entityResults = {};
    for (const [id, res] of Object.entries(this.answered)) {
      entityResults[id] = res;
    }

    updateNavScore();
    updateNavLevel();

    const newTrophies = Stats.recordGame({
      mapId: this.mapId,
      mode: this.mode,
      score: this.score,
      correct: this.correct,
      wrong: this.wrong,
      totalQuestions: this.totalQuestions,
      perfectRun: this.perfectRun,
      entityResults
    });

    const accuracy = this.totalQuestions ? Math.round((this.correct / this.totalQuestions) * 100) : 0;

    this._showGameOver({ newTrophies, accuracy });
    updateNavScore();
  },

  // ─── SHOW GAME OVER ────────────────────────
  _showGameOver({ newTrophies, accuracy }) {
    const grade = accuracy === 100 ? "🏆 Perfect!" : accuracy >= 80 ? "⭐ Excellent!" : accuracy >= 60 ? "👍 Good Job!" : accuracy >= 40 ? "📚 Keep Practicing!" : "💪 You'll Get There!";

    document.getElementById("gameover-header").innerHTML = `
      <div class="go-icon">${accuracy === 100 ? "🏆" : accuracy >= 80 ? "⭐" : "📊"}</div>
      <h2>${grade}</h2>
      <p>${this.totalQuestions} questions · ${MAP_DEFS.find(m=>m.id===this.mapId)?.label || this.mapId}</p>
    `;

    document.getElementById("gameover-stats").innerHTML = `
      <div class="go-stat highlight">
        <div class="go-stat-value">${this.score.toLocaleString()}</div>
        <div class="go-stat-label">Points Earned</div>
      </div>
      <div class="go-stat">
        <div class="go-stat-value">${accuracy}%</div>
        <div class="go-stat-label">Accuracy</div>
      </div>
      <div class="go-stat">
        <div class="go-stat-value" style="color:var(--green2)">${this.correct}</div>
        <div class="go-stat-label">Correct</div>
      </div>
      <div class="go-stat">
        <div class="go-stat-value" style="color:var(--red2)">${this.wrong}</div>
        <div class="go-stat-label">Wrong</div>
      </div>
      ${newTrophies.length ? `<div class="go-stat" style="grid-column:1/-1; border-color:rgba(245,158,11,0.4); background:rgba(245,158,11,0.07); text-align:center;">
        <div style="font-size:1.1rem; margin-bottom:6px">🎉 New Trophy${newTrophies.length > 1 ? "es" : ""}!</div>
        <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap">${newTrophies.map(t=>`<span title="${t.name}">${t.icon}</span>`).join("")}</div>
      </div>` : ""}
    `;

    document.getElementById("gameover-modal").classList.remove("hidden");
  },

  _showGamePanel() {
    document.getElementById("game-panel").classList.remove("hidden");
  },

  _showHUD() {
    const hud = document.getElementById("game-hud");
    hud.classList.remove("hidden");
    document.getElementById("hud-progress").textContent = `0/${this.totalQuestions}`;
    document.getElementById("hud-score").textContent = "0";
  },

  _renderLives() {
    const lives = document.getElementById("gp-lives");
    const hearts = lives.querySelectorAll("i");
    const lost = this.attempts;
    hearts.forEach((h, i) => {
      h.classList.toggle("lost", i < lost);
    });
  },

  stop() {
    this.active = false;
    document.getElementById("game-panel").classList.add("hidden");
    document.getElementById("game-hud").classList.add("hidden");
  }
};

// ─── HELPERS ───────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeAnswer(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function showComboBurst(streak) {
  const labels = { 3:"🔥 x3", 5:"⚡ x5", 10:"💫 x10", 15:"🌪️ x15", 20:"👑 x20" };
  const label = labels[streak] || (streak >= 3 ? `🔥 x${streak}` : null);
  if (!label) return;
  const el = document.createElement("div");
  el.className = "combo-burst";
  el.textContent = label;
  const area = document.getElementById("map-area");
  if (area) { area.appendChild(el); setTimeout(() => el.remove(), 900); }
}

function showToast(msg, type = "info", duration = 1800) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast-${type}`;
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.classList.add("hidden"); }, duration);
}
