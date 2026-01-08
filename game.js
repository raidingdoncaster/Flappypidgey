(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const btnStart = document.getElementById("btnStart");
  const btnRestart = document.getElementById("btnRestart");
  const hardMode = document.getElementById("hardMode");

  const W = canvas.width;
  const H = canvas.height;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  // --- Assets (simple SVGs stored in /assets) ---
  const assets = {
    bg: new Image(),
    pidgey: new Image(),
    pipe: new Image(),
    loaded: false,
  };

  let loadedCount = 0;
  const onAssetLoad = () => {
    loadedCount++;
    if (loadedCount >= 3) assets.loaded = true;
  };

  assets.bg.onload = onAssetLoad;
  assets.pidgey.onload = onAssetLoad;
  assets.pipe.onload = onAssetLoad;

  assets.bg.src = "assets/bg.svg";
  assets.pidgey.src = "assets/pidgey_sheet.png";
  assets.pipe.src = "assets/pipe.svg";

  // --- Tuning ---
  const T = {
    gravity: 1650,
    flap: -480,
    maxFall: 980,
    pipeSpeed: 230,
    pipeW: 80,
    gap: 175,
    gapHard: 145,
    spawnEvery: 1.25,
    groundH: 90,
  };

  const state = {
    started: false,
    running: false,
    over: false,
    score: 0,
    best: Number(localStorage.getItem("fp_best") || 0),

    anim: { frame: 0, time: 0, fps: 14, frames: 22 },

    bird: { x: 140, y: H * 0.45, vy: 0, r: 18, angle: 0 },

    pipes: [], // { x, gapY, passed }
    spawnTimer: 0,

    lastT: performance.now(),
  };

  function reset() {
    state.started = false;
    state.running = false;
    state.over = false;
    state.score = 0;

    state.bird.x = 140;
    state.bird.y = H * 0.45;
    state.bird.vy = 0;
    state.bird.angle = 0;

    state.pipes = [];
    state.spawnTimer = 0;
  }

  function start() {
    if (state.over) reset();
    state.started = true;
    state.running = true;
    state.over = false;
  }

  function flap() {
    if (!state.started) start();
    if (state.over) return;
    state.bird.vy = T.flap;
    state.anim.time = 0;
    state.anim.time = 18;
    setTimeout(() => { state.anim.fps = 14; }, 200)
  }

  function endGame() {
    state.running = false;
    state.over = true;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("fp_best", String(state.best));
    }
  }

  function spawnPipe() {
    const gapSize = hardMode.checked ? T.gapHard : T.gap;
    const topMargin = 90;
    const bottomMargin = T.groundH + 130;

    const gapY = rand(topMargin + gapSize / 2, H - bottomMargin - gapSize / 2);

    state.pipes.push({ x: W + 40, gapY, passed: false });
  }

  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const px = clamp(cx, rx, rx + rw);
    const py = clamp(cy, ry, ry + rh);
    const dx = cx - px, dy = cy - py;
    return dx * dx + dy * dy <= cr * cr;
  }

  function update(dt) {
    if (!state.running) return;
    // Sprite animation tick
    state.anim.time += dt;
    const frameDur = 1 / state.anim.fps;
    while (state.anim.time >= frameDur) {
      state.anim.time -= frameDur;
      state.anim.time = (state.anim.frame + 1) % state.anim.frames;
    }

    const b = state.bird;

    // Physics
    b.vy += T.gravity * dt;
    b.vy = clamp(b.vy, -2000, T.maxFall);
    b.y += b.vy * dt;

    // Tilt
    const target = clamp(b.vy / 900, -0.7, 1.0);
    b.angle += (target - b.angle) * Math.min(1, dt * 10);

    const groundY = H - T.groundH;
    const ceiling = 18;

    if (b.y - b.r < ceiling) {
      b.y = ceiling + b.r;
      b.vy = 0;
    }
    if (b.y + b.r > groundY) {
      b.y = groundY - b.r;
      endGame();
      return;
    }

    // Pipes
    state.spawnTimer += dt;
    if (state.spawnTimer >= T.spawnEvery) {
      state.spawnTimer = 0;
      spawnPipe();
    }

    const speed = T.pipeSpeed + Math.min(140, state.score * 3); // mild scaling
    for (const p of state.pipes) p.x -= speed * dt;

    state.pipes = state.pipes.filter(p => p.x + T.pipeW > -60);

    const gapSize = hardMode.checked ? T.gapHard : T.gap;

    for (const p of state.pipes) {
      const x = p.x, w = T.pipeW;
      const gapTop = p.gapY - gapSize / 2;
      const gapBot = p.gapY + gapSize / 2;

      // score
      if (!p.passed && x + w < b.x) {
        p.passed = true;
        state.score++;
      }

      // collision rects
      const topRect = { x, y: 0, w, h: gapTop };
      const botRect = { x, y: gapBot, w, h: (H - T.groundH) - gapBot };

      if (
        circleRect(b.x, b.y, b.r, topRect.x, topRect.y, topRect.w, topRect.h) ||
        circleRect(b.x, b.y, b.r, botRect.x, botRect.y, botRect.w, botRect.h)
      ) {
        endGame();
        return;
      }
    }
  }

  function drawBG() {
    if (assets.loaded) {
      ctx.drawImage(assets.bg, 0, 0, W, H);
    } else {
      // fallback background
      ctx.fillStyle = "#8ed7ff";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawGround() {
    const y = H - T.groundH;
    ctx.fillStyle = "rgba(48, 190, 80, .95)";
    ctx.fillRect(0, y, W, T.groundH);
    ctx.fillStyle = "rgba(140, 90, 40, .85)";
    ctx.fillRect(0, y + 26, W, T.groundH - 26);
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(0, y, W, 3);
  }

  function drawPipes() {
    const gapSize = hardMode.checked ? T.gapHard : T.gap;

    for (const p of state.pipes) {
      const x = p.x, w = T.pipeW;
      const gapTop = p.gapY - gapSize / 2;
      const gapBot = p.gapY + gapSize / 2;

      // Draw pipes with asset if loaded, else draw rectangles
      if (assets.loaded) {
        // top pipe (flipped)
        ctx.save();
        ctx.translate(x + w / 2, gapTop / 2);
        ctx.scale(1, -1);
        ctx.drawImage(assets.pipe, -w / 2, -gapTop / 2, w, gapTop);
        ctx.restore();

        // bottom pipe
        const botH = (H - T.groundH) - gapBot;
        ctx.drawImage(assets.pipe, x, gapBot, w, botH);
      } else {
        ctx.fillStyle = "rgba(24,130,60,.96)";
        ctx.fillRect(x, 0, w, gapTop);
        ctx.fillRect(x, gapBot, w, (H - T.groundH) - gapBot);
      }
    }
  }

  function drawBird() {
    const b = state.bird;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    if (assets.loaded) {
      // Sprite sheet frame draw
      const a = state.anim;

      // Each frame is the sheet width divided by frame count
      const fw = assets.pidgey.width / a.frames;
      const fh = assets.pidgey.height;

      const sx = Math.floor(a.frame * fw);
      const sy = 0;

      // Draw size on canvas (tweak to taste)
      const size = 64;

      ctx.drawImage(
        assets.pidgey,
        sx, sy, fw, fh,
        -size / 2, -size / 2, size, size
      );
    } else {
      // fallback circle bird
      ctx.fillStyle = "rgba(245,210,130,.98)";
      ctx.beginPath();
      ctx.arc(0, 0, b.r + 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,.38)";
    ctx.fillRect(0, 0, W, 56);

    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.font = "800 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Score: ${state.score}`, 12, 34);

    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = "700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Best: ${state.best}`, W - 92, 34);
  }

  function drawOverlay() {
    if (!state.started) {
      centerCard("Tap to start", "Keep Pidgey flying.", "Pass the pipes to score.");
    } else if (state.over) {
      centerCard("Game Over", `Score: ${state.score} • Best: ${state.best}`, "Tap / Space to try again");
    }
  }

  function centerCard(title, line1, line2) {
    const cw = 340, ch = 170;
    const x = (W - cw) / 2;
    const y = (H - ch) / 2 - 30;

    ctx.fillStyle = "rgba(0,0,0,.55)";
    roundRect(x, y, cw, ch, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(title, x + 18, y + 54);

    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.font = "700 15px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(line1, x + 18, y + 92);

    ctx.fillStyle = "rgba(255,255,255,.68)";
    ctx.font = "700 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(line2, x + 18, y + 122);
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
    drawBG();
    drawPipes();
    drawBird();
    drawGround();
    drawHUD();
    drawOverlay();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - state.lastT) / 1000);
    state.lastT = now;

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Input
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    flap();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      flap();
    }
    if (e.key === "r" || e.key === "R") reset();
  });

  btnStart.addEventListener("click", start);
  btnRestart.addEventListener("click", reset);

  // Boot
  reset();
  requestAnimationFrame((t) => {
    state.lastT = t;
    requestAnimationFrame(loop);
  });
})();