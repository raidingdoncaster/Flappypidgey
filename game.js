(() => {
  "use strict";

  /** Canvas + helpers **/
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const btnStart = document.getElementById("btnStart");
  const btnRestart = document.getElementById("btnRestart");
  const chkHard = document.getElementById("chkHard");

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  /** Tunables (we will balance these together) **/
  const TUNING = {
    gravity: 1500,        // px/s^2
    flapVelocity: -460,   // px/s
    maxFallSpeed: 900,    // px/s
    pipeSpeed: 220,       // px/s
    pipeWidth: 78,
    gap: 168,             // px (normal)
    gapHard: 138,         // px (hard)
    spawnEvery: 1.35,     // seconds
    groundHeight: 92,
  };

  /** Game state **/
  const state = {
    running: false,
    started: false,
    gameOver: false,

    // score
    score: 0,
    best: Number(localStorage.getItem("fp_best") || 0),

    // bird
    bird: {
      x: 130,
      y: H * 0.45,
      r: 16,       // collision radius
      vy: 0,
      angle: 0,    // render tilt
    },

    // pipes
    pipes: [], // { x, gapY, passed }
    spawnTimer: 0,

    // time
    lastT: performance.now(),
  };

  function reset() {
    state.running = false;
    state.started = false;
    state.gameOver = false;

    state.score = 0;
    state.pipes = [];
    state.spawnTimer = 0;

    state.bird.x = 130;
    state.bird.y = H * 0.45;
    state.bird.vy = 0;
    state.bird.angle = 0;

    draw(); // show start screen
  }

  function start() {
    if (state.gameOver) reset();
    state.running = true;
    state.started = true;
    state.gameOver = false;
  }

  function flap() {
    if (!state.started) start();
    if (state.gameOver) return;

    state.bird.vy = TUNING.flapVelocity;
  }

  function endGame() {
    state.running = false;
    state.gameOver = true;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("fp_best", String(state.best));
    }
  }

  function spawnPipe() {
    const gapSize = chkHard.checked ? TUNING.gapHard : TUNING.gap;
    const marginTop = 80;
    const marginBottom = TUNING.groundHeight + 110;

    const gapY = rand(marginTop + gapSize * 0.5, H - marginBottom - gapSize * 0.5);

    state.pipes.push({
      x: W + 30,
      gapY,
      passed: false,
    });
  }

  /** Collision: circle vs rectangles (pipes) **/
  function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= cr * cr;
  }

  function update(dt) {
    if (!state.running) return;

    // bird physics
    const b = state.bird;
    b.vy += TUNING.gravity * dt;
    b.vy = clamp(b.vy, -2000, TUNING.maxFallSpeed);
    b.y += b.vy * dt;

    // tilt
    const targetAngle = clamp(b.vy / 900, -0.8, 1.05);
    b.angle += (targetAngle - b.angle) * Math.min(1, dt * 10);

    // ground / ceiling
    const ceiling = 20;
    const groundY = H - TUNING.groundHeight;
    if (b.y - b.r < ceiling) {
      b.y = ceiling + b.r;
      b.vy = 0;
    }
    if (b.y + b.r > groundY) {
      b.y = groundY - b.r;
      endGame();
      return;
    }

    // spawn pipes
    state.spawnTimer += dt;
    if (state.spawnTimer >= TUNING.spawnEvery) {
      state.spawnTimer = 0;
      spawnPipe();
    }

    // move pipes
    const speed = TUNING.pipeSpeed + Math.min(140, state.score * 2.5); // slight scaling
    for (const p of state.pipes) p.x -= speed * dt;

    // remove offscreen
    state.pipes = state.pipes.filter(p => p.x + TUNING.pipeWidth > -40);

    // scoring + collisions
    const gapSize = chkHard.checked ? TUNING.gapHard : TUNING.gap;
    for (const p of state.pipes) {
      const x = p.x;
      const w = TUNING.pipeWidth;
      const gapTop = p.gapY - gapSize / 2;
      const gapBot = p.gapY + gapSize / 2;

      // pass score
      if (!p.passed && x + w < b.x) {
        p.passed = true;
        state.score += 1;
      }

      // pipe rectangles (top and bottom)
      const topRect = { x, y: 0, w, h: gapTop };
      const botRect = { x, y: gapBot, w, h: (H - TUNING.groundHeight) - gapBot };

      if (
        circleRectCollide(b.x, b.y, b.r, topRect.x, topRect.y, topRect.w, topRect.h) ||
        circleRectCollide(b.x, b.y, b.r, botRect.x, botRect.y, botRect.w, botRect.h)
      ) {
        endGame();
        return;
      }
    }
  }

  /** Rendering **/
  function drawBackground() {
    // sky already from canvas CSS, but add clouds
    ctx.save();

    // subtle vignette
    const g = ctx.createRadialGradient(W / 2, H * 0.2, 60, W / 2, H / 2, 520);
    g.addColorStop(0, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0.10)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // clouds
    ctx.globalAlpha = 0.55;
    drawCloud(80, 110, 1.0);
    drawCloud(280, 170, 1.2);
    drawCloud(180, 250, 0.9);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawCloud(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    roundBlob(-35, 0, 42, 26);
    roundBlob(-5, -12, 54, 34);
    roundBlob(35, 0, 42, 26);
    ctx.restore();
  }

  function roundBlob(x, y, w, h) {
    ctx.beginPath();
    const r = Math.min(w, h) * 0.5;
    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGround() {
    const groundY = H - TUNING.groundHeight;

    // grass
    ctx.fillStyle = "rgba(40, 160, 70, 0.95)";
    ctx.fillRect(0, groundY, W, TUNING.groundHeight);

    // dirt band
    ctx.fillStyle = "rgba(140, 90, 40, 0.85)";
    ctx.fillRect(0, groundY + 28, W, TUNING.groundHeight - 28);

    // top edge
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, groundY, W, 3);
  }

  function drawPipes() {
    const gapSize = chkHard.checked ? TUNING.gapHard : TUNING.gap;

    for (const p of state.pipes) {
      const x = p.x;
      const w = TUNING.pipeWidth;
      const gapTop = p.gapY - gapSize / 2;
      const gapBot = p.gapY + gapSize / 2;

      // pipe style
      ctx.save();
      ctx.fillStyle = "rgba(24, 130, 60, 0.96)";
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;

      // top pipe
      pipeRect(x, 0, w, gapTop, true);
      // bottom pipe
      pipeRect(x, gapBot, w, (H - TUNING.groundHeight) - gapBot, false);

      ctx.restore();
    }
  }

  function pipeRect(x, y, w, h, isTop) {
    // main
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // cap
    const capH = 16;
    const capY = isTop ? (h - capH) : y;
    ctx.fillRect(x - 6, capY, w + 12, capH);
    ctx.strokeRect(x - 6, capY, w + 12, capH);

    // highlight
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(x + 10, y + 6, 10, h - 12);
    ctx.fillStyle = "rgba(24, 130, 60, 0.96)";
  }

  function drawBird() {
    const b = state.bird;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    // body (simple “pidgey-ish” vibe)
    ctx.fillStyle = "rgba(240, 210, 130, 0.98)";
    ctx.beginPath();
    ctx.arc(0, 0, b.r + 2, 0, Math.PI * 2);
    ctx.fill();

    // wing
    ctx.fillStyle = "rgba(210, 170, 95, 0.95)";
    ctx.beginPath();
    ctx.ellipse(-2, 4, 13, 9, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // crest
    ctx.fillStyle = "rgba(220, 165, 70, 0.95)";
    ctx.beginPath();
    ctx.moveTo(2, -b.r - 1);
    ctx.lineTo(12, -b.r + 10);
    ctx.lineTo(-2, -b.r + 8);
    ctx.closePath();
    ctx.fill();

    // beak
    ctx.fillStyle = "rgba(245, 190, 85, 0.98)";
    ctx.beginPath();
    ctx.moveTo(b.r + 2, 0);
    ctx.lineTo(b.r + 18, 6);
    ctx.lineTo(b.r + 2, 10);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.fillStyle = "rgba(20,20,20,0.95)";
    ctx.beginPath();
    ctx.arc(6, -6, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, W, 54);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Score: ${state.score}`, 12, 33);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Best: ${state.best}`, W - 90, 33);

    ctx.restore();
  }

  function drawOverlay() {
    if (!state.started) {
      centerCard("Tap / Space to start", "Keep Pidgey flying. Pass the pipes.", "Tip: short taps are better.");
    } else if (state.gameOver) {
      centerCard("Game Over", `Score: ${state.score} • Best: ${state.best}`, "Press R or Restart.");
    }
  }

  function centerCard(title, line1, line2) {
    ctx.save();
    const cardW = 340;
    const cardH = 170;
    const x = (W - cardW) / 2;
    const y = (H - cardH) / 2 - 20;

    ctx.fillStyle = "rgba(0,0,0,0.52)";
    roundRect(x, y, cardW, cardH, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "800 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(title, x + 20, y + 55);

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "600 15px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(line1, x + 20, y + 90);

    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = "600 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(line2, x + 20, y + 120);

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawPipes();
    drawBird();
    drawGround();
    drawHUD();
    drawOverlay();
  }

  /** Loop **/
  function loop(now) {
    const dt = Math.min(0.033, (now - state.lastT) / 1000);
    state.lastT = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  /** Input **/
  function onPrimaryAction() { flap(); }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      onPrimaryAction();
    }
    if (e.key === "r" || e.key === "R") reset();
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onPrimaryAction();
  });

  btnStart.addEventListener("click", start);
  btnRestart.addEventListener("click", reset);

  /** Boot **/
  reset();
  requestAnimationFrame((t) => {
    state.lastT = t;
    requestAnimationFrame(loop);
  });
})();