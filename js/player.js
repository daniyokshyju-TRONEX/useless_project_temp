export class Player {
  constructor(start) { this.speed = .14; this.reset(start); }
  reset(position) { this.x = position.x; this.y = position.y; this.fromX = this.x; this.fromY = this.y; this.toX = this.x; this.toY = this.y; this.moving = false; this.hasKey = false; this.checkpoint = { ...position }; this.twist = 'none'; }
  setCheckpoint(position) { this.checkpoint = { ...position }; }
  respawn() { this.reset(this.checkpoint); }
  moveTo(x, y) { this.fromX = this.x; this.fromY = this.y; this.toX = x; this.toY = y; this.moving = true; }
  update() {
    if (!this.moving) return;
    this.x += (this.toX - this.x) * this.speed;
    this.y += (this.toY - this.y) * this.speed;
    if (Math.abs(this.x - this.toX) < .02 && Math.abs(this.y - this.toY) < .02) { this.x = this.toX; this.y = this.toY; this.moving = false; }
  }
  get tile() { return { x: Math.round(this.x), y: Math.round(this.y) }; }
}
