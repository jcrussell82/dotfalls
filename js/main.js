// ---------------------------------------------------------
// Main — screen orchestration and the logo/title animation.
//
// Logo animation sequence (per brief, refined):
//   1. Screen begins empty.
//   2. One glowing white dot appears offscreen above, hangs
//      briefly, then falls down into frame.
//   3. As it falls, "DOTFALLS" fades in around it — the dot
//      settles into place as the "O".
//   4. "TAP TO START" appears once settled.
//   5. On tap: the whole logo (title + dot, as one group)
//      slides upward and fades out together — the dot rides
//      up with it. As the logo fades away, the dot separates
//      and begins falling again, continuing straight into
//      gameplay with no separate loading screen.
// ---------------------------------------------------------

(function () {
  const sceneCanvas = document.getElementById('scene');
  const titleCanvas = document.getElementById('title-canvas');

  const screens = {
    title: document.getElementById('screen-title'),
    levelintro: document.getElementById('screen-levelintro'),
    pause: document.getElementById('screen-pause'),
    fail: document.getElementById('screen-fail'),
    cleared: document.getElementById('screen-cleared'),
  };
  const hud = document.getElementById('hud');
  const timerEl = document.getElementById('timer');
  const levelLabelEl = document.getElementById('level-label');
  const introLevelName = document.getElementById('intro-level-name');
  const introLevelGoal = document.getElementById('intro-level-goal');
  const failRule = document.querySelector('.fail-rule');
  const pauseBtn = document.getElementById('pause-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const failNoBtn = document.getElementById('fail-no');
  const failYesBtn = document.getElementById('fail-yes');

  let game = null;
  let currentLevel = 1;
  let uiMode = 'title'; // title | intro | playing | paused | fail | cleared

  function showOnly(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== name);
    });
  }

  function hideAllScreens() {
    Object.values(screens).forEach(el => el.classList.add('hidden'));
  }

  // ---------------- Title / logo animation ----------------

  const titleCtx = titleCanvas.getContext('2d');
  let titleAnim = null;

  // Compute the x-position of the "O" slot in "DOTFALLS" for a given
  // canvas size, so the falling dot can start directly above it and
  // fall straight down instead of drifting sideways to match up later.
  function computeOSlotX(ctx, w, h) {
    const fontSize = Math.round(Math.min(w, h) * 0.11);
    ctx.font = `200 ${fontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    const letterSpacing = fontSize * 0.42;
    const word = ['D', 'O', 'T', 'F', 'A', 'L', 'L', 'S'];
    const widths = word.map(ch => ctx.measureText(ch).width);
    const totalWidth = widths.reduce((a, b) => a + b, 0) + letterSpacing * (word.length - 1);
    let cursorX = w / 2 - totalWidth / 2;
    for (let i = 0; i < word.length; i++) {
      if (word[i] === 'O') return cursorX + widths[i] / 2;
      cursorX += widths[i] + letterSpacing;
    }
    return w / 2;
  }

  // Shared title-state so the tap-triggered "slide up and fade out"
  // transition can pick up exactly where the idle loop left off,
  // rather than re-deriving position from scratch.
  let titleState = null;

  function startTitleAnimation() {
    Utils.fitCanvas(titleCanvas, titleCtx);
    const w = titleCanvas.clientWidth;
    const h = titleCanvas.clientHeight;
    const oSlotX = computeOSlotX(titleCtx, w, h);
    const restY = h * 0.5;

    // Start below the top edge by at least the dot's full bloom radius
    // so the glow never gets visibly clipped by the canvas boundary —
    // combined with the fade-in below, the dot simply materializes
    // just inside the top of the screen rather than popping in cut off.
    const startY = Math.min(h * 0.06, 60);

    const dot = {
      x: oSlotX,
      y: startY,
      appearT: 0,
      radius: 9,
    };

    titleState = { w, h, dot, restY, groupOffsetY: 0, groupAlpha: 1 };

    const textFadeStart = 0.9; // seconds after fall begins
    const textFadeDur = 1.1;

    let startTs = null;
    let running = true;
    titleAnim = { stop() { running = false; } };

    function frame(ts) {
      if (!running) return;
      if (startTs == null) startTs = ts;
      const t = (ts - startTs) / 1000;

      titleCtx.clearRect(0, 0, w, h);

      // Phase 1: dot appears (fade + tiny scale-in), 0 -> 0.9s
      const appearT = Utils.clamp(t / 0.9, 0, 1);
      dot.appearT = Utils.easeOutCubic(appearT);

      // Phase 2: hold briefly near the top in silence, then fall into frame.
      const fallDelay = 1.1;
      let fallProgress = 0;
      if (t > fallDelay) {
        fallProgress = Utils.clamp((t - fallDelay) / 2.4, 0, 1);
      }
      const fallY = Utils.lerp(startY, restY, Utils.easeInOutSine(fallProgress));
      dot.y = fallY;

      // Phase 3: title fades in as it falls.
      const textT = t > fallDelay
        ? Utils.clamp((t - fallDelay - textFadeStart) / textFadeDur, 0, 1)
        : 0;

      drawTitleFrame(titleCtx, w, h, dot, textT, 1);

      if (t < fallDelay + 3.2) {
        requestAnimationFrame(frame);
      } else {
        // Settle into a calm idle loop: dot resting as the "O", gentle glow pulse.
        idleLoop(startTs);
      }
    }

    function idleLoop(baseStartTs) {
      function idle(ts) {
        if (!running) return;
        const t = (ts - baseStartTs) / 1000;
        titleCtx.clearRect(0, 0, w, h);
        const pulse = 1 + Math.sin(t * 1.4) * 0.04;
        dot.y = restY;
        drawTitleFrame(titleCtx, w, h, dot, 1, pulse);
        requestAnimationFrame(idle);
      }
      requestAnimationFrame(idle);
    }

    requestAnimationFrame(frame);
  }

  // Slide the whole logo — title text and dot together, as one group —
  // upward while fading both out together, ending the title screen
  // cleanly before gameplay begins.
  function playTitleExitTransition(onComplete) {
    if (!titleState || !titleAnim) { onComplete(); return; }
    titleAnim.stop();
    const { w, h, dot } = titleState;
    const dotY = dot.y; // fixed base position; offset carries it upward

    const slideDist = h * 0.22;
    const duration = 0.85; // seconds

    let startTs = null;
    let running = true;
    titleAnim = { stop() { running = false; } };

    function frame(ts) {
      if (!running) return;
      if (startTs == null) startTs = ts;
      const t = (ts - startTs) / 1000;
      const p = Utils.clamp(t / duration, 0, 1);
      const eased = Utils.easeInOutSine(p);

      const groupOffsetY = -slideDist * eased;
      const groupAlpha = 1 - eased;

      titleCtx.clearRect(0, 0, w, h);
      drawTitleText(titleCtx, w, h, dotY + groupOffsetY, 0, groupAlpha);
      drawTitleDot(titleCtx, dot.x, dotY + groupOffsetY, dot.radius, groupAlpha);

      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        running = false;
        onComplete();
      }
    }
    requestAnimationFrame(frame);
  }

  function drawTitleText(ctx, w, h, baseY, offsetY, alpha) {
    if (alpha <= 0.01) return;
    const textY = baseY + offsetY;
    const fontSize = Math.round(Math.min(w, h) * 0.11);
    ctx.font = `200 ${fontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = 'middle';

    const letterSpacing = fontSize * 0.42;
    const word = ['D', 'O', 'T', 'F', 'A', 'L', 'L', 'S'];
    const widths = word.map(ch => ctx.measureText(ch).width);
    const totalWidth = widths.reduce((a, b) => a + b, 0) + letterSpacing * (word.length - 1);
    let cursorX = w / 2 - totalWidth / 2;

    ctx.save();
    ctx.fillStyle = `rgba(245,246,248,${0.92 * alpha})`;
    ctx.shadowColor = 'rgba(255,255,255,0.25)';
    ctx.shadowBlur = 6 * alpha;

    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (ch !== 'O') {
        // Don't draw a glyph for O — the dot itself becomes the O.
        ctx.fillText(ch, cursorX, textY);
      }
      cursorX += widths[i] + letterSpacing;
    }
    ctx.restore();
  }

  function drawTitleDot(ctx, x, y, radius, alpha) {
    if (radius <= 0.05 || alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const bloomR = radius * 6;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, bloomR);
    grad.addColorStop(0, 'rgba(255,255,255,0.4)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, bloomR, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = radius * 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTitleFrame(ctx, w, h, dot, textT, pulseScale) {
    pulseScale = pulseScale || 1;
    const r = dot.radius * dot.appearT * pulseScale;
    drawTitleText(ctx, w, h, dot.y, 0, textT);
    drawTitleDot(ctx, dot.x, dot.y, r, 1);
  }

  // ---------------- Level flow ----------------

  function goToTitle() {
    uiMode = 'title';
    hud.classList.add('hidden');
    hideAllScreens();
    screens.title.classList.remove('hidden');
    const promptEl = document.querySelector('#screen-title .prompt');
    if (promptEl) promptEl.classList.remove('fade-out');
    if (titleAnim) titleAnim.stop();
    startTitleAnimation();
  }

  function goToLevelIntro(levelNumber) {
    uiMode = 'intro';
    currentLevel = levelNumber;
    const cfg = getLevelConfig(levelNumber);
    introLevelName.textContent = `LEVEL ${levelNumber}`;
    introLevelGoal.textContent = `KEEP ${cfg.required} DOT${cfg.required > 1 ? 'S' : ''} ALIVE FOR ${cfg.duration}s`;
    hud.classList.add('hidden');
    hideAllScreens();
    screens.levelintro.classList.remove('hidden');

    setTimeout(() => {
      if (uiMode !== 'intro') return;
      beginPlaying(levelNumber);
    }, 1500);
  }

  function beginPlaying(levelNumber) {
    uiMode = 'playing';
    hideAllScreens();
    hud.classList.remove('hidden');
    levelLabelEl.textContent = `LEVEL ${levelNumber}`;
    game.startLevel(levelNumber);
    Audio_.startAmbient();
    Audio_.resume();
  }

  function handleFail(info) {
    uiMode = 'fail';
    hud.classList.add('hidden');
    if (info && info.reason === 'insufficient') {
      failRule.parentElement.querySelector('.fail-title').textContent = 'ALMOST.';
    }
    hideAllScreens();
    screens.fail.classList.remove('hidden');
    Audio_.pause();
  }

  function handleCleared() {
    uiMode = 'cleared';
    hud.classList.add('hidden');
    hideAllScreens();
    screens.cleared.classList.remove('hidden');
    setTimeout(() => {
      goToLevelIntro(currentLevel + 1);
    }, 1300);
  }

  // ---------------- Input ----------------

  function pointerXY(e) {
    const rect = sceneCanvas.getBoundingClientRect();
    if (e.touches && e.touches.length) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onSceneTap(e) {
    e.preventDefault();
    if (uiMode !== 'playing') return;
    const { x, y } = pointerXY(e);
    game.handleTap(x, y);
  }

  sceneCanvas.addEventListener('pointerdown', onSceneTap, { passive: false });

  const titlePromptEl = document.querySelector('#screen-title .prompt');

  screens.title.addEventListener('pointerdown', () => {
    if (uiMode !== 'title') return;
    uiMode = 'title-exiting'; // guard against double-taps mid-transition
    if (titlePromptEl) titlePromptEl.classList.add('fade-out');
    playTitleExitTransition(() => {
      goToLevelIntro(1);
    });
  });

  pauseBtn.addEventListener('click', () => {
    if (uiMode !== 'playing') return;
    uiMode = 'paused';
    game.pause();
    hideAllScreens();
    screens.pause.classList.remove('hidden');
    Audio_.pause();
  });

  function resumeFromPause() {
    if (uiMode !== 'paused') return;
    uiMode = 'playing';
    game.resume();
    hideAllScreens();
    hud.classList.remove('hidden');
    Audio_.resume();
  }
  resumeBtn.addEventListener('click', resumeFromPause);
  screens.pause.addEventListener('pointerdown', (e) => {
    if (e.target === resumeBtn || resumeBtn.contains(e.target)) return;
    resumeFromPause();
  });

  failYesBtn.addEventListener('click', () => {
    goToLevelIntro(currentLevel);
  });
  failNoBtn.addEventListener('click', () => {
    goToTitle();
  });

  // ---------------- HUD live update ----------------

  function tickHud() {
    if (uiMode === 'playing' && game) {
      timerEl.textContent = Utils.formatTime(game.timeRemaining);
    }
    requestAnimationFrame(tickHud);
  }

  // ---------------- Boot ----------------

  window.addEventListener('DOMContentLoaded', () => {
    game = new Game(sceneCanvas);
    game.onFail = handleFail;
    game.onCleared = handleCleared;
    goToTitle();
    requestAnimationFrame(tickHud);
  });
})();
