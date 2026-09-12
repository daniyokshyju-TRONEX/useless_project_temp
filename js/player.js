// ============================================================================
// UNPREDICTABLE - Player Entity
// High-visibility 2D Canvas entity with smooth tile interpolation,
// facing animations, pulsing locator beacon, and invulnerability states.
// ============================================================================

export class Player {
  constructor(start = { x: 1, y: 1 }) {
    this.speed = 0.22; // Interpolation speed per frame
    this.facing = 'down';
    this.invulnerable = false;
    this.invulnerableTimer = 0;
    this.deathProgress = 0;
    this.isDying = false;
    this.stepCycle = 0;
    this.reset(start);
  }

  reset(position) {
    this.x = position.x;
    this.y = position.y;
    this.targetX = position.x;
    this.targetY = position.y;
    this.moving = false;
    this.keysCollected = 0;
    this.hasKey = false;
    this.checkpoint = { ...position };
    this.twist = 'none';
    this.invulnerable = false;
    this.isDying = false;
    this.deathProgress = 0;
    this.facing = 'down';
  }

  collectKey() {
    this.keysCollected += 1;
    this.hasKey = this.keysCollected > 0;
  }

  setCheckpoint(position) {
    this.checkpoint = { ...position };
  }

  respawn() {
    this.reset(this.checkpoint);
    this.invulnerable = true;
    this.invulnerableTimer = 600; // 600ms grace period on respawn
  }

  moveTo(x, y, direction = 'down') {
    this.targetX = x;
    this.targetY = y;
    this.moving = true;
    this.facing = direction;
  }

  update(delta = 16) {
    // Handle invulnerability flicker timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= delta;
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false;
      }
    }

    // Handle dying animation
    if (this.isDying) {
      this.deathProgress = Math.min(1, this.deathProgress + delta * 0.003);
      return;
    }

    // Smooth movement interpolation
    if (this.moving) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;

      this.x += dx * this.speed;
      this.y += dy * this.speed;
      this.stepCycle += delta * 0.015;

      if (Math.abs(dx) < 0.03 && Math.abs(dy) < 0.03) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.moving = false;
      }
    }
  }

  get tile() {
    return {
      x: Math.round(this.targetX),
      y: Math.round(this.targetY)
    };
  }

  // Draw player with maximum clarity, glowing aura, and directional visor
  draw(ctx, size, accuracy = 100, isRegaining = false) {
    if (this.isDying && this.deathProgress >= 1) return;

    const px = this.x * size + size / 2;
    const py = this.y * size + size / 2;
    const time = Date.now();

    ctx.save();

    // Invulnerability flicker
    if (this.invulnerable && Math.floor(time / 80) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    // Death collapse animation
    if (this.isDying) {
      const scale = Math.max(0.01, 1 - this.deathProgress);
      ctx.translate(px, py);
      ctx.scale(scale, scale);
      ctx.rotate(this.deathProgress * Math.PI * 3);
      ctx.translate(-px, -py);
      ctx.globalAlpha = 1 - this.deathProgress;
    }

    // 1. Accuracy recharge arc or pulsing beacon
    if (isRegaining) {
      // 5-second reload progress arc
      const reloadRadius = size * 0.44;
      ctx.strokeStyle = 'rgba(255, 101, 116, 0.3)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, reloadRadius, 0, Math.PI * 2);
      ctx.stroke();

      const progressAngle = -Math.PI / 2 + (accuracy / 100) * Math.PI * 2;
      ctx.strokeStyle = '#f8b85e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, reloadRadius, -Math.PI / 2, progressAngle);
      ctx.stroke();
    } else {
      // Standard pulsing beacon ring
      const pulseRadius = size * 0.44 + Math.sin(time * 0.006) * 3;
      ctx.strokeStyle = accuracy <= 35 ? 'rgba(255, 101, 116, 0.45)' : 'rgba(112, 244, 223, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Bright ambient aura
    const aura = ctx.createRadialGradient(px, py, 2, px, py, size * 0.65);
    const auraColor = isRegaining ? 'rgba(255, 101, 116,' : (accuracy <= 35 ? 'rgba(248, 184, 94,' : 'rgba(112, 244, 223,');
    aura.addColorStop(0, `${auraColor} 0.65)`);
    aura.addColorStop(0.4, `${auraColor} 0.25)`);
    aura.addColorStop(1, `${auraColor} 0)`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(px, py, size * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // 3. Ground drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(px, py + size * 0.3, size * 0.32, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Character body
    const bob = this.moving ? Math.sin(this.stepCycle) * 1.5 : 0;
    const bodyRadius = size * 0.3;

    // Dark outer contrast ring to make character pop against any background
    ctx.fillStyle = '#04151b';
    ctx.beginPath();
    ctx.arc(px, py + bob, bodyRadius + 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Gradient sphere
    const bodyGrad = ctx.createRadialGradient(
      px - 4, py - 5 + bob, 1,
      px, py + bob, bodyRadius
    );
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.3, '#70f4df');
    bodyGrad.addColorStop(0.8, '#12a49f');
    bodyGrad.addColorStop(1, '#055452');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(px, py + bob, bodyRadius, 0, Math.PI * 2);
    ctx.fill();

    // Sharp white edge highlight
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 5. Directional visor / eyes
    let eyeDx = 0;
    let eyeDy = 0;
    if (this.facing === 'left') eyeDx = -6;
    if (this.facing === 'right') eyeDx = 6;
    if (this.facing === 'up') eyeDy = -6;
    if (this.facing === 'down') eyeDy = 5;

    // Visor dark casing
    ctx.fillStyle = '#031015';
    ctx.beginPath();
    ctx.ellipse(px + eyeDx, py + eyeDy + bob, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing cyan pupil
    ctx.fillStyle = '#70f4df';
    ctx.beginPath();
    ctx.arc(px + eyeDx, py + eyeDy + bob, 3, 0, Math.PI * 2);
    ctx.fill();

    // White gleam in eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + eyeDx + (eyeDx ? Math.sign(eyeDx) * 1 : 0), py + eyeDy + bob - 1, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // 6. Orbiting Key Shard (if key is held)
    if (this.hasKey) {
      const orbitAngle = time * 0.005;
      const ox = px + Math.cos(orbitAngle) * (size * 0.42);
      const oy = py + Math.sin(orbitAngle) * (size * 0.42);

      // Amber glow
      const keyGlow = ctx.createRadialGradient(ox, oy, 1, ox, oy, 10);
      keyGlow.addColorStop(0, '#fff4db');
      keyGlow.addColorStop(0.4, '#f8b85e');
      keyGlow.addColorStop(1, 'rgba(248, 184, 94, 0)');
      ctx.fillStyle = keyGlow;
      ctx.beginPath();
      ctx.arc(ox, oy, 10, 0, Math.PI * 2);
      ctx.fill();

      // Golden diamond shard
      ctx.fillStyle = '#f8b85e';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 5);
      ctx.lineTo(ox + 4, oy);
      ctx.lineTo(ox, oy + 5);
      ctx.lineTo(ox - 4, oy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}
