// ---------------------------------------------------------
// Dot — the only actor in the game. Handles its own physics,
// trail history, and rendering (glow + soft trail line,
// matching the reference art: white glowing dot with a
// graceful curved trail behind it).
// ---------------------------------------------------------

class Dot {
  constructor(x, y, vx, vy, radius, generation) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.generation = generation; // how many times this lineage has split
    this.trail = []; // recent positions for the graceful arc line
    this.alive = true;
    this.lost = false; // reached bottom
    this.spawnT = 0; // for gentle scale-in on birth
    this.flashT = 0; // brief highlight ring on split, decays
  }

  update(dt, gravity, bounds) {
    this.spawnT = Math.min(1, this.spawnT + dt * 3.2);
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt * 2.2);

    this.vy += gravity * dt;
    // Very slight air drag keeps velocities from compounding into chaos
    // that would break the "graceful arc" feeling.
    this.vx *= (1 - 0.02 * dt * 60 / 60);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Soft wall bounce with damping — keeps dots on screen, feels calm.
    const margin = this.radius;
    if (this.x < margin) { this.x = margin; this.vx *= -0.55; }
    if (this.x > bounds.width - margin) { this.x = bounds.width - margin; this.vx *= -0.55; }

    // Trail bookkeeping.
    this.trail.push({ x: this.x, y: this.y });
    const maxTrail = 14;
    if (this.trail.length > maxTrail) this.trail.shift();

    if (this.y - this.radius > bounds.height) {
      this.lost = true;
      this.alive = false;
    }
  }

  containsPoint(px, py) {
    // Slightly generous hit radius for touch comfort.
    const hitR = this.radius + 14;
    return Utils.dist(this.x, this.y, px, py) <= hitR;
  }

  markSplit() {
    this.flashT = 1;
  }

  draw(ctx) {
    const scale = Utils.easeOutCubic(this.spawnT);
    const r = this.radius * scale;
    if (r <= 0.05) return;

    // Trail: thin fading polyline, alpha ramps from tail to head.
    if (this.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const t = i / this.trail.length;
        const p0 = this.trail[i - 1];
        const p1 = this.trail[i];
        ctx.strokeStyle = `rgba(255,255,255,${0.16 * t})`;
        ctx.lineWidth = Math.max(0.6, r * 0.5 * t);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();

    // Outer soft bloom.
    const bloomR = r * 5.5;
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, bloomR);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, bloomR, 0, Math.PI * 2);
    ctx.fill();

    // Split-flash ring — quick, subtle expanding ring, no explosion feel.
    if (this.flashT > 0) {
      const ringR = r + (1 - this.flashT) * r * 6;
      ctx.strokeStyle = `rgba(255,255,255,${0.25 * this.flashT})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Core dot with tight bright glow.
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = r * 3.2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Split this dot into two children launched upward, drifting apart.
  // Radius shrinks per generation so the screen doesn't overflow visually
  // and later splits feel appropriately "smaller responsibility, more of them".
  split() {
    this.markSplit();
    const childRadius = Math.max(3.4, this.radius * 0.74);
    const baseSpeed = Utils.rand(340, 410);
    const spread = Utils.rand(46, 86);

    const left = new Dot(
      this.x, this.y,
      this.vx - spread, -baseSpeed + Utils.rand(-20, 20),
      childRadius, this.generation + 1
    );
    const right = new Dot(
      this.x, this.y,
      this.vx + spread, -baseSpeed + Utils.rand(-20, 20),
      childRadius, this.generation + 1
    );
    return [left, right];
  }
}
