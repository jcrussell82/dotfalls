// ---------------------------------------------------------
// Game — state machine + main loop.
//
// States: title -> levelIntro -> playing -> (cleared -> levelIntro)
//                                          -> (fail -> playing[retry] | title)
//
// Everything here is driven by requestAnimationFrame with a
// clamped delta time so the feel stays consistent across
// devices. Motion is the priority per the brief: dots must
// feel alive, arcs graceful, nothing jarring.
// ---------------------------------------------------------

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bounds = { width: 0, height: 0 };
    Utils.fitCanvas(this.canvas, this.ctx);
    this.bounds.width = this.canvas.clientWidth;
    this.bounds.height = this.canvas.clientHeight;

    this.state = 'idle'; // idle | intro | playing | paused | fail | cleared
    this.dots = [];
    this.levelNumber = 1;
    this.config = getLevelConfig(1);
    this.timeRemaining = this.config.duration;
    this.lastTs = null;
    this.introTimer = 0;
    this.clearedTimer = 0;

    this.horizonGlowT = 0; // ambient subtle pulse for the horizon glow

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this.onFail = null;
    this.onCleared = null;

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _onResize() {
    Utils.fitCanvas(this.canvas, this.ctx);
    this.bounds.width = this.canvas.clientWidth;
    this.bounds.height = this.canvas.clientHeight;
  }

  startLevel(levelNumber) {
    this.levelNumber = levelNumber;
    this.config = getLevelConfig(levelNumber);
    this.timeRemaining = this.config.duration;
    this.dots = [];
    // Seed with a single dot near the top-center, matching the
    // logo animation's falling dot continuing into gameplay.
    const startX = this.bounds.width / 2;
    const startY = this.bounds.height * 0.14;
    const seed = new Dot(startX, startY, Utils.rand(-8, 8), 40, 9, 0);
    this.dots.push(seed);
    this.state = 'playing';
  }

  pause() {
    if (this.state === 'playing') this.state = 'paused';
  }

  resume() {
    if (this.state === 'paused') {
      this.lastTs = null;
      this.state = 'playing';
    }
  }

  handleTap(x, y) {
    if (this.state !== 'playing') return;
    // Find topmost (last-drawn / most recently spawned) dot under the tap
    // so overlapping dots resolve predictably.
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const d = this.dots[i];
      if (d.alive && d.containsPoint(x, y)) {
        const children = d.split();
        this.dots.splice(i, 1, ...children);
        Audio_.playTap();
        return;
      }
    }
  }

  _aliveCount() {
    return this.dots.reduce((n, d) => n + (d.alive ? 1 : 0), 0);
  }

  _loop(ts) {
    requestAnimationFrame(this._loop);
    if (this.lastTs == null) this.lastTs = ts;
    let dt = (ts - this.lastTs) / 1000;
    dt = Utils.clamp(dt, 0, 1 / 30); // clamp to avoid huge steps on tab-switch
    this.lastTs = ts;

    if (this.state === 'playing') this._update(dt);
    this._render(dt);
  }

  _update(dt) {
    this.timeRemaining -= dt;

    let lostThisFrame = false;
    for (const d of this.dots) {
      if (!d.alive) continue;
      d.update(dt, this.config.gravity, this.bounds);
      if (d.lost) lostThisFrame = true;
    }
    if (lostThisFrame) Audio_.playLoss();

    this.dots = this.dots.filter(d => d.alive || d.trail.length > 0 && false);
    // (dots that just died are simply dropped; no lingering corpse needed)
    this.dots = this.dots.filter(d => d.alive);

    // Feed the ambient intensity from current chaos (dot count vs required).
    const intensity = Utils.clamp(this.dots.length / (this.config.required * 2.2), 0, 1);
    Audio_.setIntensity(intensity);

    const alive = this._aliveCount();

    if (alive < this.config.required && this.timeRemaining > 0) {
      // Only fail once it's mathematically impossible to reach the
      // requirement again is NOT how this works per spec: the rule is
      // "game ends immediately if all dots are lost before timer expires".
      // We only hard-fail on total loss (alive === 0); dropping below the
      // required count simply means the timer keeps running and the
      // player must split more to recover before time runs out.
    }

    if (alive === 0) {
      this.state = 'fail';
      if (this.onFail) this.onFail({ reason: 'lost-all' });
      return;
    }

    if (this.timeRemaining <= 0) {
      if (alive >= this.config.required) {
        this.state = 'cleared';
        if (this.onCleared) this.onCleared();
      } else {
        this.state = 'fail';
        if (this.onFail) this.onFail({ reason: 'insufficient', have: alive, need: this.config.required });
      }
    }
  }

  _render() {
    const { ctx, bounds } = this;
    ctx.clearRect(0, 0, bounds.width, bounds.height);

    // Background: nearly black, with a very soft horizon glow rising
    // from the bottom, echoing the reference frames.
    ctx.fillStyle = '#030304';
    ctx.fillRect(0, 0, bounds.width, bounds.height);

    const horizonY = bounds.height * 0.94;
    const glow = ctx.createLinearGradient(0, horizonY - 160, 0, bounds.height);
    glow.addColorStop(0, 'rgba(255,255,255,0)');
    glow.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizonY - 160, bounds.width, 160 + (bounds.height - horizonY));

    if (this.state === 'playing' || this.state === 'paused' || this.state === 'cleared') {
      for (const d of this.dots) d.draw(ctx);
    }
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
  }
}
