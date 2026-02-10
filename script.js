/**
 * Shared JS logic: sounds (Web Audio API), mute persistence, index-page "No" dodge,
 * fake system modal, confetti (prefers-reduced-motion aware), date selection.
 */

(function () {
  "use strict";

  const STORAGE_KEYS = {
    muted: "valentine_muted_v1",
    dateChoice: "valentine_choice_v1",
  };

  const state = {
    audio: {
      ctx: null,
      muted: false,
      armed: false, // only true after any user gesture
    },
    index: {
      attempts: 0,
      msgIndex: 0,
      lastMoveAt: 0,
      noPos: { x: 0, y: 0 }, // translate offsets
    },
    confetti: {
      raf: 0,
      started: false,
    },
  };

  const microMessages = [
    "Plot armor engaged.",
    "That button is shy 😅",
    "Nice reflexes… mine are better.",
    "Barbara deserves YES energy.",
    "Your finger slipped into destiny.",
    "Error 418: I'm a teapot (of love).",
    "Nope. Too adorable to decline.",
    "Try again, romantic hero.",
    "The universe said: ‘nah’.",
  ];

  // ---------- Utilities ----------
  function $(sel, root = document) {
    return root.querySelector(sel);
  }
  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function loadMuted() {
    const raw = localStorage.getItem(STORAGE_KEYS.muted);
    if (raw === null) return false;
    return raw === "true";
  }

  function saveMuted(val) {
    localStorage.setItem(STORAGE_KEYS.muted, String(val));
  }

  function setMuteUi(btn) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(state.audio.muted));
    const icon = btn.querySelector(".icon");
    if (icon) icon.textContent = state.audio.muted ? "🔇" : "🔊";
    btn.title = state.audio.muted ? "Sound off" : "Sound on";
  }

  // ---------- Web Audio (no files) ----------
  function ensureAudioContext() {
    if (state.audio.ctx) return state.audio.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    state.audio.ctx = new Ctx();
    return state.audio.ctx;
  }

  function armAudioOnce() {
    if (state.audio.armed) return;
    state.audio.armed = true;

    const ctx = ensureAudioContext();
    if (!ctx) return;

    // Some browsers start suspended until user gesture; attempt resume on first gesture.
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function playTone({ type = "sine", freq = 440, duration = 0.07, gain = 0.04, bendTo = null }) {
    if (state.audio.muted) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (!state.audio.armed) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    if (bendTo && typeof bendTo === "number") {
      osc.frequency.exponentialRampToValueAtTime(bendTo, now + duration);
    }

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(g);
    g.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function sfxClick() {
    playTone({ type: "triangle", freq: 520, duration: 0.06, gain: 0.035, bendTo: 660 });
  }
  function sfxDodge() {
    playTone({ type: "square", freq: 260, duration: 0.05, gain: 0.025, bendTo: 340 });
  }
  function sfxSuccess() {
    // Two quick notes
    playTone({ type: "sine", freq: 660, duration: 0.08, gain: 0.04, bendTo: 880 });
    setTimeout(() => playTone({ type: "sine", freq: 880, duration: 0.10, gain: 0.04, bendTo: 990 }), 90);
  }
  function sfxSelect() {
    playTone({ type: "triangle", freq: 440, duration: 0.06, gain: 0.03, bendTo: 520 });
  }
  function sfxError() {
    playTone({ type: "sawtooth", freq: 180, duration: 0.10, gain: 0.02, bendTo: 120 });
  }

  function attachGlobalAudioArming() {
    const once = () => {
      armAudioOnce();
      window.removeEventListener("pointerdown", once, true);
      window.removeEventListener("keydown", once, true);
      window.removeEventListener("touchstart", once, true);
    };
    window.addEventListener("pointerdown", once, true);
    window.addEventListener("keydown", once, true);
    window.addEventListener("touchstart", once, true);
  }

  function attachMuteButton() {
    const btn = $("#muteBtn");
    if (!btn) return;

    state.audio.muted = loadMuted();
    setMuteUi(btn);

    btn.addEventListener("click", () => {
      armAudioOnce();
      state.audio.muted = !state.audio.muted;
      saveMuted(state.audio.muted);
      setMuteUi(btn);
      sfxClick();
    });
  }

  // ---------- Index: dodging No ----------
  function initIndexPage() {
    const noBtn = $("#noBtn");
    const noZone = $("#noZone");
    const attemptsCount = $("#attemptsCount");
    const attemptsMsg = $("#attemptsMsg");
    const modal = $("#modal");
    const retryBtn = $("#retryBtn");

    if (!noBtn || !noZone) return;

    // Position baseline: keep button centered in its zone initially.
    state.index.noPos = { x: 0, y: 0 };
    applyNoTransform(noBtn, 0, 0);

    function bumpAttempts() {
      state.index.attempts += 1;
      if (attemptsCount) attemptsCount.textContent = String(state.index.attempts);
      if (attemptsMsg) {
        const msg = microMessages[state.index.msgIndex % microMessages.length];
        state.index.msgIndex += 1;
        attemptsMsg.textContent = `— ${msg}`;
      }
    }

    function openModal() {
      if (!modal) return;
      modal.hidden = false;
      const dialog = modal.querySelector(".modal-dialog");
      if (dialog) dialog.focus();
    }

    function closeModal() {
      if (!modal) return;
      modal.hidden = true;
      noBtn.focus();
    }

    function randomInRange(min, max) {
      return min + Math.random() * (max - min);
    }

    function getViewportSafeBounds(el, padding = 12) {
      const rect = el.getBoundingClientRect();
      const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

      return {
        minX: -rect.left + padding,
        maxX: vw - rect.right - padding,
        minY: -rect.top + padding,
        maxY: vh - rect.bottom - padding,
      };
    }

    function applyNoTransform(btn, x, y) {
      btn.style.transform = `translate(${x}px, ${y}px)`;
    }

    function dodge(fromX, fromY) {
      const now = performance.now();
      if (now - state.index.lastMoveAt < 110) return; // avoids jitter spam
      state.index.lastMoveAt = now;

      const bounds = getViewportSafeBounds(noBtn, 14);

      // Move away from pointer with some randomness
      const dx = clamp((state.index.noPos.x - fromX) * 0.35, -140, 140);
      const dy = clamp((state.index.noPos.y - fromY) * 0.35, -120, 120);

      let nextX = state.index.noPos.x + dx + randomInRange(-60, 60);
      let nextY = state.index.noPos.y + dy + randomInRange(-45, 45);

      nextX = clamp(nextX, bounds.minX, bounds.maxX);
      nextY = clamp(nextY, bounds.minY, bounds.maxY);

      state.index.noPos.x = nextX;
      state.index.noPos.y = nextY;

      noBtn.classList.add("is-dodging");
      applyNoTransform(noBtn, nextX, nextY);

      bumpAttempts();
      sfxDodge();
    }

    function onPointerMove(e) {
      // Only dodge on desktop-ish pointers (mouse/trackpad)
      const isFine = window.matchMedia && window.matchMedia("(pointer:fine)").matches;
      if (!isFine) return;

      const rect = noBtn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);

      // Proximity threshold scales with screen size
      const threshold = clamp(window.innerWidth * 0.12, 90, 150);

      if (dist < threshold) {
        // Use pointer position in "transform space" approximation
        dodge(e.clientX - window.innerWidth / 2, e.clientY - window.innerHeight / 2);
      }
    }

    function onNoTap(e) {
      // On mobile / coarse pointers: tap triggers dodge instead of click-through.
      const isCoarse = window.matchMedia && window.matchMedia("(pointer:coarse)").matches;
      if (!isCoarse) return;

      e.preventDefault();
      const touch = e.touches && e.touches[0];
      const x = touch ? touch.clientX : window.innerWidth / 2;
      const y = touch ? touch.clientY : window.innerHeight / 2;

      dodge(x - window.innerWidth / 2, y - window.innerHeight / 2);
    }

    function onNoKeydown(e) {
      // Make keyboard “No” funny: pressing Enter/Space triggers modal (like a "real click").
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        sfxError();
        openModal();
      }

      // Arrow keys: try to chase it.
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        dodge(0, 0);
      }
    }

    function onNoClick(e) {
      // If user manages to click: show fake system error modal.
      e.preventDefault();
      sfxError();
      openModal();
    }

    function initModal() {
      if (!modal) return;

      modal.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "true") {
          closeModal();
        }
      });

      document.addEventListener("keydown", (e) => {
        if (modal.hidden) return;
        if (e.key === "Escape") closeModal();
      });

      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          sfxClick();
          closeModal();
        });
      }
    }

    // Listeners
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    noBtn.addEventListener("touchstart", onNoTap, { passive: false });
    noBtn.addEventListener("click", onNoClick);
    noBtn.addEventListener("keydown", onNoKeydown);

    // Friendly click SFX on Yes
    const yesBtn = $("#yesBtn");
    if (yesBtn) {
      yesBtn.addEventListener("click", () => {
        armAudioOnce();
        sfxSuccess();
      });
    }

    initModal();
  }

  // ---------- Yes: confetti ----------
  function initYesPage() {
    const canvas = $("#confetti");
    if (!canvas) return;

    const reduced = prefersReducedMotion();
    if (reduced) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    let w = 0;
    let h = 0;

    const pieces = [];
    const pieceCount = clamp(Math.floor(window.innerWidth / 12), 70, 130);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function makePiece() {
      return {
        x: rand(0, w),
        y: rand(-h, 0),
        r: rand(3, 8),
        vx: rand(-0.6, 0.6),
        vy: rand(1.3, 3.4),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.08, 0.08),
        shape: Math.random() < 0.2 ? "heart" : "rect",
        alpha: rand(0.6, 0.95),
      };
    }

    function drawHeart(x, y, size, rot, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;

      // Colors come from system palette by default; we avoid "specific colors" by using HSL.
      const hue = (x * 0.6 + y * 0.2) % 360;
      ctx.fillStyle = `hsl(${hue} 85% 65%)`;

      ctx.beginPath();
      const s = size;
      ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(0, -s * 0.1, -s * 0.55, -s * 0.1, -s * 0.55, s * 0.35);
      ctx.bezierCurveTo(-s * 0.55, s * 0.7, 0, s * 0.95, 0, s * 1.15);
      ctx.bezierCurveTo(0, s * 0.95, s * 0.55, s * 0.7, s * 0.55, s * 0.35);
      ctx.bezierCurveTo(s * 0.55, -s * 0.1, 0, -s * 0.1, 0, s * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawRect(x, y, size, rot, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;

      const hue = (x * 0.8 + y * 0.4) % 360;
      ctx.fillStyle = `hsl(${hue} 90% 70%)`;

      ctx.fillRect(-size, -size * 0.5, size * 2, size);
      ctx.restore();
    }

    function step() {
      ctx.clearRect(0, 0, w, h);

      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        if (p.y > h + 20) {
          p.x = rand(0, w);
          p.y = rand(-80, -10);
          p.vy = rand(1.3, 3.4);
        }

        if (p.shape === "heart") drawHeart(p.x, p.y, p.r, p.rot, p.alpha);
        else drawRect(p.x, p.y, p.r, p.rot, p.alpha);
      }

      state.confetti.raf = requestAnimationFrame(step);
    }

    function start() {
      if (state.confetti.started) return;
      state.confetti.started = true;

      resize();
      pieces.length = 0;
      for (let i = 0; i < pieceCount; i++) pieces.push(makePiece());

      step();
    }

    function stop() {
      if (state.confetti.raf) cancelAnimationFrame(state.confetti.raf);
      state.confetti.raf = 0;
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });

    // Play a tiny success jingle on first interaction on this page
    const planBtn = $("#planBtn");
    if (planBtn) {
      planBtn.addEventListener("click", () => {
        armAudioOnce();
        sfxSuccess();
      });
    }

    start();
  }

  // ---------- Date: selection ----------
  function initDatePage() {
    const choices = $all(".choice");
    const confirm = $("#confirm");
    const confirmText = $("#confirmText");

    if (!choices.length) return;

    function setSelected(btn) {
      for (const c of choices) c.classList.remove("is-selected");
      btn.classList.add("is-selected");

      const choice = btn.getAttribute("data-choice") || "…";
      localStorage.setItem(STORAGE_KEYS.dateChoice, choice);

      if (confirm && confirmText) {
        confirm.hidden = false;
        confirmText.textContent = `Barbara chose: ${choice}`;
      }
    }

    // Restore saved choice if present
    const saved = localStorage.getItem(STORAGE_KEYS.dateChoice);
    if (saved) {
      const match = choices.find((c) => (c.getAttribute("data-choice") || "") === saved);
      if (match) setSelected(match);
    }

    choices.forEach((btn) => {
      btn.addEventListener("click", () => {
        armAudioOnce();
        sfxSelect();
        setSelected(btn);
      });
    });
  }

  // ---------- Boot ----------
  function boot() {
    attachGlobalAudioArming();
    attachMuteButton();

    const page = document.body.getAttribute("data-page");
    if (page === "index") initIndexPage();
    if (page === "yes") initYesPage();
    if (page === "date") initDatePage();

    // Generic "pleasant click" for primary buttons/links
    document.addEventListener(
      "click",
      (e) => {
        const t = e.target;
        if (!t) return;
        const clickable =
          t.closest &&
          t.closest("a.btn, button.btn, button.icon-btn, a.brand-link");

        if (clickable) {
          armAudioOnce();
          sfxClick();
        }
      },
      true
    );
  }

  boot();
})();
