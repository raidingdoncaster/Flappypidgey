(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;
  const nowMs = () => performance.now();

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // ---------- Asset helpers ----------
  function loadImage(src) {
    const im = new Image();
    im.src = src;
    return im;
  }

  function loadImageWithFallback(primarySrc, fallbackSrc) {
    const im = new Image();
    let triedFallback = false;
    im.onerror = () => {
      if (!fallbackSrc || triedFallback) return;
      triedFallback = true;
      im.src = fallbackSrc;
    };
    im.src = primarySrc;
    return im;
  }

  // ---------- Assets ----------
  const assets = {
    bg: loadImage("assets/bg.svg"),
    pipe: loadImage("assets/pipe.svg"),
    pidgey: loadImage("assets/pidgey_sheet.png"),

    // Optional mega sprite sheet. If missing, we scale the normal sheet.
    mega: loadImage("assets/mega_pidgey_sheet.png"),
    megaLoaded: false,

    // UI
    logo: loadImageWithFallback("assets/flappy_pidgey_logo.png", "assets/FlappyPidgey_logo.png"),
    hudScore: loadImageWithFallback("assets/hud_score.svg", "assets/hug_score.svg"), // you uploaded hug_score.svg
    hudSpeed: loadImage("assets/hud_speed.svg"),
    hudBest: loadImage("assets/hud_best.svg"),

    cd3: loadImage("assets/count_3.svg"),
    cd2: loadImage("assets/count_2.svg"),
    cd1: loadImage("assets/count_1.svg"),
    cdGo: loadImage("assets/count_flap.svg"),

    icons: {
      razz: loadImage("assets/icon_razz.png"),
      goldRazz: loadImage("assets/icon_golden_razz.png"),
      pinap: loadImage("assets/icon_pinap.png"),
      silverPinap: loadImage("assets/icon_silver_pinap.png"),
      nanab: loadImage("assets/icon_nanab.png"),
      mega: loadImage("assets/icon_mega_stone.png"),
    },
  };

  assets.mega.onload = () => { assets.megaLoaded = true; };
  assets.mega.onerror = () => { assets.megaLoaded = false; };

  // ---------- Tuning ----------
  const T = {
    gravity: 1550,
    flap: -480,
    maxFall: 980,

    pipeW: 80,
    gap: 185,
    gapHard: 155,
    spawnEvery: 1.25,

    pipeSpeedBase: 220,
    pipeSpeedStep: 16, // every 5 points

    groundH: 90,

    frames: 22,
    fpsBase: 14,
    fpsFlapBurst: 18,

    birdSize: 90,
    birdRadius: 26,

    collectibleChancePerPipe: 0.28,

    invincibleSec: 4,
    megaSec: 30,

    // UI timing
    transitionSec: 1.15,
    flutterEverySec: 0.35,
    countdownStepSec: 0.65,
    countdownGoSec: 0.55,
  };

  // ---------- Collectibles ----------
  const COLLECTIBLES = {
    RAZZ: {
      key: "RAZZ",
      title: "Razz Berry",
      desc: "Removes the next pipe in a poof of smoke and +1 point.",
      icon: "razz",
      score: 1,
      clearPipes: 1,
    },
    GOLD_RAZZ: {
      key: "GOLD_RAZZ",
      title: "Golden Razz Berry",
      desc: "Removes the next 5 pipes in a poof of smoke and +5 points.",
      icon: "goldRazz",
      score: 5,
      clearPipes: 5,
    },
    PINAP: {
      key: "PINAP",
      title: "Pinap Berry",
      desc: "+2 points.",
      icon: "pinap",
      score: 2,
      clearPipes: 0,
    },
    SILVER_PINAP: {
      key: "SILVER_PINAP",
      title: "Silver Pinap Berry",
      desc: "+10 points.",
      icon: "silverPinap",
      score: 10,
      clearPipes: 0,
    },
    NANAB: {
      key: "NANAB",
      title: "Nanab Berry",
      desc: "Invincible for 4 seconds / Pidgey turns transparent with a countdown timer.",
      icon: "nanab",
      score: 0,
      clearPipes: 0,
      invincibleSec: T.invincibleSec,
    },
    MEGA_STONE: {
      key: "MEGA_STONE",
      title: "Mega Stone",
      desc: "ITâS MEGA TIME! 30s Mega Mode: 4Ã larger, smash pipes, sparkle trail, timer.",
      icon: "mega",
      score: 0,
      clearPipes: 0,
      megaSec: T.megaSec,
    },
  };

  function rollCollectibleType() {
    // weights: tweak to taste
    const table = [
      ["RAZZ", 42],
      ["PINAP", 30],
      ["GOLD_RAZZ", 12],
      ["NANAB", 10],
      ["SILVER_PINAP", 5],
      ["MEGA_STONE", 1],
    ];
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of table) {
      r -= w;
      if (r <= 0) return k;
    }
    return "RAZZ";
  }

  // ---------- Game state ----------
  // mode: menu | help | transitioning | countdown | play | over
  const state = {
    mode: "menu",

    score: 0,
    best: Number(localStorage.getItem("fp_best") || 0),

    bird: { x: 140, y: H * 0.45, vy: 0, r: T.birdRadius, angle: 0 },
    anim: { frame: 0, time: 0, fps: T.fpsBase },

    invincibleUntil: 0,
    megaUntil: 0,
    megaBannerUntil: 0,
    clearQueue: 0,

    pipes: [],
    collectibles: [],
    particles: [],

    spawnTimer: 0,
    nextPipeId: 1,

    // Crossy Road-ish HUD
    menuAlpha: 1,
    hudAlpha: 0,
    hudSlideT: 0,
    transitionT: 0,
    flutterT: 0,

    // Countdown state
    countdownStep: 0, // 3,2,1,"go"
    countdownT: 0,

    // In-canvas buttons
    buttons: [],

    // difficulty toggle
    hard: false,

    lastT: performance.now(),
  };

  // ---------- Core mechanics ----------
  function pipeSpeed() {
    const steps = Math.floor(state.score / 5);
    return T.pipeSpeedBase + steps * T.pipeSpeedStep;
  }

  function isMega() {
    return nowMs() < state.megaUntil;
  }

  function isInvincible() {
    const t = nowMs();
    return t < state.invincibleUntil || t < state.megaUntil;
  }

  function awardScore(n) {
    state.score += n;
  }

  function resetRun() {
    state.score = 0;

    state.bird.x = 140;
    state.bird.y = H * 0.45;
    state.bird.vy = 0;
    state.bird.angle = 0;
    state.bird.r = T.birdRadius;

    state.anim.frame = 0;
    state.anim.time = 0;
    state.anim.fps = T.fpsBase;

    state.invincibleUntil = 0;
    state.megaUntil = 0;
    state.megaBannerUntil = 0;
    state.clearQueue = 0;

    state.pipes = [];
    state.collectibles = [];
    state.particles = [];

    state.spawnTimer = 0;
    state.nextPipeId = 1;
  }

  function toMenu() {
    state.mode = "menu";
    state.menuAlpha = 1;
    state.hudAlpha = 0;
    state.hudSlideT = 0;
    state.transitionT = 0;
    state.flutterT = 0;

    state.countdownStep = 0;
    state.countdownT = 0;

    resetRun();
  }

  function beginTransition() {
    state.mode = "transitioning";
    state.transitionT = 0;
    state.flutterT = 0;

    resetRun();
    state.bird.vy = -260; // cute kickoff
  }

  function beginCountdown() {
    state.mode = "countdown";
    state.countdownStep = 3;
    state.countdownT = 0;

    // fully in-game HUD now
    state.menuAlpha = 0;
    state.hudAlpha = 1;
    state.hudSlideT = 1;
  }

  function beginPlay() {
    state.mode = "play";
    state.bird.vy = -120;
    state.spawnTimer = 0;
  }

  function endGame() {
    state.mode = "over";
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("fp_best", String(state.best));
    }
  }

  // ---------- Particles ----------
  function poof(x, y, strength = 18) {
    for (let i = 0; i < strength; i++) {
      state.particles.push({
        kind: "smoke",
        x: x + rand(-10, 10),
        y: y + rand(-10, 10),
        vx: rand(-150, 150),
        vy: rand(-160, 160),
        life: rand(0.25, 0.55),
        age: 0,
        r: rand(4, 10),
      });
    }
  }

  function sparkle(x, y) {
    state.particles.push({
      kind: "sparkle",
      x: x + rand(-2, 2),
      y: y + rand(-2, 2),
      vx: rand(-40, 40),
      vy: rand(-20, 20),
      life: rand(0.25, 0.5),
      age: 0,
      r: rand(2, 4.5),
    });
  }

  function floatText(x, y, text) {
    state.particles.push({
      kind: "text",
      x,
      y,
      vx: rand(-10, 10),
      vy: rand(-70, -45),
      life: 0.8,
      age: 0,
      text,
    });
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.age += dt;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;

      if (p.kind === "smoke") {
        p.vx *= Math.pow(0.02, dt);
        p.vy *= Math.pow(0.02, dt);
      }
      if (p.kind === "sparkle") {
        p.vx *= Math.pow(0.08, dt);
        p.vy *= Math.pow(0.08, dt);
      }
    }
    state.particles = state.particles.filter((p) => p.age < p.life);
  }

  // ---------- Pipes & collectibles ----------
  function spawnPipe() {
    const gapSize = state.hard ? T.gapHard : T.gap;
    const topMargin = 90;
    const bottomMargin = T.groundH + 130;

    const gapY = rand(topMargin + gapSize / 2, H - bottomMargin - gapSize / 2);

    const id = state.nextPipeId++;
    state.pipes.push({ x: W + 40, gapY, passed: false, id });

    if (chance(T.collectibleChancePerPipe)) {
      const typeKey = rollCollectibleType();
      const cx = W + 40 + T.pipeW / 2 + rand(-8, 8);
      const cy = gapY + rand(-gapSize * 0.2, gapSize * 0.2);
      state.collectibles.push({ x: cx, y: cy, typeKey, r: 15, taken: false, pipeId: id });
    }
  }

  function applyCollectible(typeKey) {
    const c = COLLECTIBLES[typeKey];

    if (c.score) awardScore(c.score);
    if (c.clearPipes) state.clearQueue += c.clearPipes;

    if (c.invincibleSec) {
      state.invincibleUntil = Math.max(state.invincibleUntil, nowMs() + c.invincibleSec * 1000);
    }

    if (c.megaSec) {
      const t = nowMs();
      state.megaUntil = Math.max(state.megaUntil, t + c.megaSec * 1000);
      state.megaBannerUntil = Math.max(state.megaBannerUntil, t + 2200);
      // A tiny pipe-clear burst feels good right as mega starts:
      state.clearQueue += 2;
      poof(state.bird.x + 18, state.bird.y, 26);
    }
  }

  // ---------- Collision helpers ----------
  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const px = clamp(cx, rx, rx + rw);
    const py = clamp(cy, ry, ry + rh);
    const dx = cx - px;
    const dy = cy - py;
    return dx * dx + dy * dy <= cr * cr;
  }

  function circleCircle(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy <= (ar + br) * (ar + br);
  }

  // ---------- Input ----------
  function flap() {
    if (state.mode !== "play") return;

    state.bird.vy = T.flap;

    state.anim.time = 0;
    state.anim.fps = T.fpsFlapBurst;
    clearTimeout(flap._t);
    flap._t = setTimeout(() => (state.anim.fps = T.fpsBase), 220);
  }

  function pointerToCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height),
    };
  }

  function hitButton(x, y) {
    for (const b of state.buttons) {
      if (!b.enabled) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const p = pointerToCanvas(e);

    const b = hitButton(p.x, p.y);
    if (b) {
      b.onClick?.();
      return;
    }

    // tap to flap only during play
    flap();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (state.mode === "play") flap();
    }
    if (e.key === "r" || e.key === "R") toMenu();
    if (e.key === "Escape") toMenu();
  });

  // ---------- Update ----------
  function update(dt) {
    // sprite anim always
    state.anim.time += dt;
    const frameDur = 1 / state.anim.fps;
    while (state.anim.time >= frameDur) {
      state.anim.time -= frameDur;
      state.anim.frame = (state.anim.frame + 1) % T.frames;
    }

    // Mega sparkle trail always while mega
    if (isMega()) {
      for (let i = 0; i < 2; i++) sparkle(state.bird.x - 26, state.bird.y + rand(-12, 12));
    }

    updateParticles(dt);

    // Menu/help idle bounce
    if (state.mode === "menu" || state.mode === "help") {
      const b = state.bird;
      b.vy += (T.gravity * 0.35) * dt;
      b.vy = clamp(b.vy, -700, 500);
      b.y += b.vy * dt;

      const top = H * 0.30;
      const bot = H * 0.62;
      if (b.y < top) { b.y = top; b.vy = 180; }
      if (b.y > bot) { b.y = bot; b.vy = -220; }

      b.angle = clamp(b.vy / 900, -0.6, 0.6);
      return;
    }

    // Transition: menu fades away, HUD slides in, bird flutters
    if (state.mode === "transitioning") {
      state.transitionT = clamp(state.transitionT + dt / T.transitionSec, 0, 1);
      const t = easeInOutCubic(state.transitionT);

      state.menuAlpha = 1 - t;
      state.hudAlpha = t;
      state.hudSlideT = t;

      const b = state.bird;

      // HOLD bird in place during the transition so it can't fall
      const hoverY = H * 0.45;
      b.y += (hoverY - b.y) * Math.min(1, dt * 7);
      b.vy = 0;
      b.angle += (0 - b.angle) * Math.min(1, dt * 10);

      // tiny bob so it still feels alive
      b.y += Math.sin(nowMs() / 140) * 0.35;

      state.flutterT += dt;
      if (state.flutterT >= T.flutterEverySec) {
        state.flutterT = 0;
        b.vy = -260;
      }

      if (state.transitionT >= 1) beginCountdown();
      return;
    }

    // Countdown: no pipes, HUD visible
    if (state.mode === "countdown") {
      const b = state.bird;

      // HOLD bird in place during countdown so player isn't dead before starting
      const hoverY = H * 0.45;
      b.y += (hoverY - b.y) * Math.min(1, dt * 7);
      b.vy = 0;
      b.angle += (0 - b.angle) * Math.min(1, dt * 10);

      // tiny bob
      b.y += Math.sin(nowMs() / 140) * 0.35;

      state.countdownT += dt;
      const stepDur = state.countdownStep === "go" ? T.countdownGoSec : T.countdownStepSec;
      if (state.countdownT >= stepDur) {
        state.countdownT = 0;
        if (state.countdownStep === 3) state.countdownStep = 2;
        else if (state.countdownStep === 2) state.countdownStep = 1;
        else if (state.countdownStep === 1) state.countdownStep = "go";
        else beginPlay();
      }
      return;
    }

    if (state.mode !== "play") return;

    const b = state.bird;

    // mega hitbox
    b.r = isMega() ? T.birdRadius * 4 : T.birdRadius;

    // physics
    b.vy += T.gravity * dt;
    b.vy = clamp(b.vy, -2000, T.maxFall);
    b.y += b.vy * dt;

    // tilt
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
      if (!isInvincible()) endGame();
      return;
    }

    // spawn pipes
    state.spawnTimer += dt;
    if (state.spawnTimer >= T.spawnEvery) {
      state.spawnTimer = 0;
      spawnPipe();
    }

    // move entities
    const speed = pipeSpeed();
    for (const p of state.pipes) p.x -= speed * dt;
    for (const c of state.collectibles) c.x -= speed * dt;

    // cleanup offscreen
    state.pipes = state.pipes.filter((p) => p.x + T.pipeW > -80);

    // collectibles tied to live pipes only
    const alivePipeIds = new Set(state.pipes.map((p) => p.id));
    state.collectibles = state.collectibles.filter(
      (c) => !c.taken && c.x + 40 > -80 && alivePipeIds.has(c.pipeId)
    );

    // clear queue (berries/mega)
    if (state.clearQueue > 0 && state.pipes.length > 0) {
      const next = state.pipes[0];
      if (next && next.x < W * 0.70) {
        poof(next.x + T.pipeW / 2, next.gapY, 30);
        if (!next.passed) awardScore(1);
        state.collectibles = state.collectibles.filter((c) => c.pipeId !== next.id);
        state.pipes.shift();
        state.clearQueue--;
      }
    }

    // collisions + scoring
    const gapSize = state.hard ? T.gapHard : T.gap;

    for (let i = 0; i < state.pipes.length; i++) {
      const p = state.pipes[i];
      const x = p.x;
      const w = T.pipeW;
      const gapTop = p.gapY - gapSize / 2;
      const gapBot = p.gapY + gapSize / 2;

      if (!p.passed && x + w < b.x) {
        p.passed = true;
        awardScore(1);
      }

      const topRect = { x, y: 0, w, h: gapTop };
      const botRect = { x, y: gapBot, w, h: groundY - gapBot };

      const hit =
        circleRect(b.x, b.y, b.r, topRect.x, topRect.y, topRect.w, topRect.h) ||
        circleRect(b.x, b.y, b.r, botRect.x, botRect.y, botRect.w, botRect.h);

      if (hit) {
        if (isMega()) {
          // smash pipe
          poof(x + w / 2, p.gapY, 34);
          state.collectibles = state.collectibles.filter((c) => c.pipeId !== p.id);
          if (!p.passed) awardScore(1);
          state.pipes.splice(i, 1);
          i--;
          continue;
        }
        if (isInvincible()) continue;
        endGame();
        return;
      }
    }

    // collectible pickup
    for (const c of state.collectibles) {
      if (c.taken) continue;
      if (circleCircle(b.x, b.y, b.r * 0.6, c.x, c.y, c.r)) {
        c.taken = true;
        applyCollectible(c.typeKey);
        poof(c.x, c.y, 18);

        const def = COLLECTIBLES[c.typeKey];
        if (def.score) floatText(c.x, c.y - 14, `+${def.score}`);
        else floatText(c.x, c.y - 14, def.title);
      }
    }
  }

  // ---------- Draw helpers ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard(x, y, w, h, r, fill, stroke) {
    ctx.save();
    roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }

  function drawButton(x, y, w, h, label, enabled, onClick) {
    state.buttons.push({ x, y, w, h, enabled, onClick });

    const bg = enabled ? "rgba(64, 178, 255, 0.75)" : "rgba(64, 178, 255, 0.25)";
    const st = enabled ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)";
    drawCard(x, y, w, h, 14, bg, st);

    ctx.fillStyle = enabled ? "rgba(5, 25, 45, 0.95)" : "rgba(5, 25, 45, 0.45)";
    ctx.font = "900 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  function drawBG() {
    if (assets.bg.complete && assets.bg.naturalWidth > 0) ctx.drawImage(assets.bg, 0, 0, W, H);
    else {
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
    const gapSize = state.hard ? T.gapHard : T.gap;

    for (const p of state.pipes) {
      const x = p.x;
      const w = T.pipeW;
      const gapTop = p.gapY - gapSize / 2;
      const gapBot = p.gapY + gapSize / 2;

      if (assets.pipe.complete && assets.pipe.naturalWidth > 0) {
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

  function drawSprite(img, frameIndex, frameCount, size) {
    const fw = img.width / frameCount;
    const fh = img.height;
    const sx = Math.floor(frameIndex * fw);
    ctx.drawImage(img, sx, 0, fw, fh, -size / 2, -size / 2, size, size);
  }

  function drawTimerCircle(x, y, secondsLeft, totalSeconds, label) {
    const r = 14;
    const t = clamp(secondsLeft / totalSeconds, 0, 1);

    ctx.save();
    ctx.globalAlpha = 0.9;

    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(x, y, r - 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 10px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);

    ctx.restore();
  }

  function drawBird() {
    const b = state.bird;
    const inv = nowMs() < state.invincibleUntil;
    const mega = isMega();

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    // glow in mega
    if (mega) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 76, 54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // transparency during nanab invincibility
    ctx.globalAlpha = inv && !mega ? 0.55 : 1.0;

    const size = mega ? T.birdSize * 4 : T.birdSize;
    const frame = state.anim.frame % T.frames;

    if (mega && assets.megaLoaded && assets.mega.naturalWidth > 0) drawSprite(assets.mega, frame, T.frames, size);
    else if (assets.pidgey.naturalWidth > 0) drawSprite(assets.pidgey, frame, T.frames, size);
    else {
      ctx.fillStyle = "rgba(245,210,130,.98)";
      ctx.beginPath();
      ctx.arc(0, 0, b.r + 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // timers above bird
    const t = nowMs();
    if (t < state.invincibleUntil && !mega) {
      const left = (state.invincibleUntil - t) / 1000;
      drawTimerCircle(b.x, b.y - 56, left, T.invincibleSec, Math.ceil(left).toString());
    }
    if (mega) {
      const left = (state.megaUntil - t) / 1000;
      drawTimerCircle(b.x, b.y - (T.birdSize * 2.6), left, T.megaSec, Math.ceil(left).toString());
    }
  }

  function drawCollectibles() {
    for (const c of state.collectibles) {
      if (c.taken) continue;

      const def = COLLECTIBLES[c.typeKey];
      const icon = assets.icons[def.icon];

      ctx.save();
      ctx.translate(c.x, c.y);

      // shadow blob
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.beginPath();
      ctx.ellipse(0, 12, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1.0;

      if (icon && icon.complete && icon.naturalWidth > 0) {
        const s = 34;
        ctx.drawImage(icon, -s / 2, -s / 2, s, s);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      const t = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = clamp(t, 0, 1);

      if (p.kind === "text") {
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = "900 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.kind === "sparkle") {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function drawMegaBanner() {
    const t = nowMs();
    if (t >= state.megaBannerUntil) return;

    const remaining = (state.megaBannerUntil - t) / 1000;
    const life = 2.2;
    const p = clamp(1 - remaining / life, 0, 1);

    const y = 100 + Math.sin(p * Math.PI) * 6;
    const alpha = clamp(Math.sin(p * Math.PI), 0.1, 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    drawCard(24, y - 34, W - 48, 64, 16, "rgba(0,0,0,0.55)", "rgba(255,255,255,0.22)");

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ITâS MEGA TIME", W / 2, y);

    ctx.restore();
  }

  function drawGameHUD() {
    // Crossy-style floating bar that slides in during transition
    const alpha = state.hudAlpha;
    if (alpha <= 0) return;

    const t = easeOutCubic(state.hudSlideT);
    const barW = 372;
    const barH = 50;
    const x = (W - barW) / 2;
    const y = lerp(-70, 16, t);

    ctx.save();
    ctx.globalAlpha = alpha;

    drawCard(x, y, barW, barH, 16, "rgba(10,16,32,0.55)", "rgba(255,255,255,0.18)");

    // icon + value layout
    const pad = 12;
    const iconSize = 18;
    let cx = x + pad;

    function drawIcon(im) {
      if (im && im.complete && im.naturalWidth > 0) ctx.drawImage(im, cx, y + (barH - iconSize) / 2, iconSize, iconSize);
      else {
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(cx, y + (barH - iconSize) / 2, iconSize, iconSize);
      }
      cx += iconSize + 6;
    }

    function drawValue(txt, w = 96) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "900 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, cx, y + barH / 2);
      cx += w;
    }

    drawIcon(assets.hudScore);
    drawValue(String(state.score).padStart(6, "0"), 110);

    drawIcon(assets.hudSpeed);
    drawValue(String(Math.round(pipeSpeed())).padStart(6, "0"), 110);

    drawIcon(assets.hudBest);
    drawValue(String(state.best).padStart(6, "0"), 96);

    ctx.restore();
  }

  function drawCountdown() {
    if (state.mode !== "countdown") return;

    const step = state.countdownStep;
    const t = state.countdownT;

    const p = clamp(t / (step === "go" ? T.countdownGoSec : T.countdownStepSec), 0, 1);
    const scale = 0.9 + Math.sin(p * Math.PI) * 0.12;

    let im = assets.cd3;
    if (step === 2) im = assets.cd2;
    if (step === 1) im = assets.cd1;
    if (step === "go") im = assets.cdGo;

    const w = step === "go" ? 220 : 120;
    const h = step === "go" ? 72 : 120;

    const x = W / 2;
    const y = H * 0.33;

    ctx.save();
    ctx.globalAlpha = 0.95;

    drawCard(x - (w * scale) / 2 - 12, y - (h * scale) / 2 - 12, w * scale + 24, h * scale + 24, 16,
      "rgba(0,0,0,0.30)", "rgba(255,255,255,0.14)");

    if (im && im.complete && im.naturalWidth > 0) {
      ctx.drawImage(im, x - (w * scale) / 2, y - (h * scale) / 2, w * scale, h * scale);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "900 64px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(step).toUpperCase(), x, y);
    }

    ctx.restore();
  }

  function drawMenuOverlay() {
    const alpha = state.menuAlpha;
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Reset buttons each frame
    state.buttons = [];

    // Logo
    if (assets.logo && assets.logo.complete && assets.logo.naturalWidth > 0) {
      const lw = 270;
      const lh = (assets.logo.height / assets.logo.width) * lw;
      ctx.drawImage(assets.logo, (W - lw) / 2, 38, lw, lh);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "900 28px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("FLAPPY PIDGEY", W / 2, 70);
    }

    // High score line
    drawCard(110, 150, 200, 32, 12, "rgba(0,0,0,0.22)", "rgba(255,255,255,0.12)");
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "800 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`High Score: ${state.best.toLocaleString()}`, W / 2, 166);

    // Buttons
    drawButton(126, 400, 78, 48, "PLAY", true, () => beginTransition());
    drawButton(216, 400, 78, 48, "HELP", true, () => { state.mode = "help"; });

    drawButton(126, 456, 168, 44, "Story (Later)", false, null);
    drawButton(48,  620, 110, 44, "Boards (Later)", false, null);
    drawButton(160, 620, 110, 44, "Shop (Later)", false, null);
    drawButton(272, 620, 110, 44, "Dex (Later)", false, null);

    // Difficulty toggle button (in-canvas)
    const hardLabel = state.hard ? "Hard: ON" : "Hard: OFF";
    drawButton(28, 86, 110, 38, hardLabel, true, () => { state.hard = !state.hard; });

    ctx.restore();
  }

  function drawHelpOverlay() {
    ctx.save();
    state.buttons = [];

    drawCard(18, 90, W - 36, H - 180, 18, "rgba(0,0,0,0.62)", "rgba(255,255,255,0.18)");

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Help / Pickups", 34, 124);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "700 12px system-ui";
    ctx.fillText("Tap BACK to return â¢ Tap PLAY to start", 34, 146);

    // icon list
    const items = ["RAZZ","GOLD_RAZZ","PINAP","SILVER_PINAP","NANAB","MEGA_STONE"];
    let y = 178;

    for (const key of items) {
      const def = COLLECTIBLES[key];
      const icon = assets.icons[def.icon];

      // icon slot
      drawCard(34, y - 18, 42, 42, 12, "rgba(255,255,255,0.12)", "rgba(255,255,255,0.14)");
      if (icon && icon.complete && icon.naturalWidth > 0) {
        ctx.drawImage(icon, 34 + 6, y - 12, 30, 30);
      }

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "900 14px system-ui";
      ctx.fillText(def.title, 86, y);

      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "700 12px system-ui";
      ctx.fillText(def.desc, 86, y + 18);

      y += 56;
    }

    drawButton(34, H - 120, 110, 44, "BACK", true, () => { state.mode = "menu"; });
    drawButton(W - 144, H - 120, 110, 44, "PLAY", true, () => beginTransition());

    ctx.restore();
  }

  function drawOverOverlay() {
    ctx.save();
    state.buttons = [];

    drawCard(30, 240, W - 60, 190, 18, "rgba(0,0,0,0.55)", "rgba(255,255,255,0.18)");

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 26px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", W / 2, 284);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "900 16px system-ui";
    ctx.fillText(`Score: ${state.score}`, W / 2, 322);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "800 13px system-ui";
    ctx.fillText(`Best: ${state.best}`, W / 2, 348);

    drawButton(W / 2 - 60, 378, 120, 44, "RETRY", true, () => beginTransition());
    drawButton(34, H - 120, 110, 44, "MENU", true, () => toMenu());

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    drawBG();

    // Draw world layers
    if (state.mode === "play" || state.mode === "over") {
      drawPipes();
      drawCollectibles();
    }

    if (state.mode !== "menu" && state.mode !== "help") {
      drawBird();
    }
    drawParticles();
    drawGround();

    // HUD visible during transition+countdown+play+over
    if (state.mode === "transitioning" || state.mode === "countdown" || state.mode === "play" || state.mode === "over") {
      drawGameHUD();
    }

    // Menu/help overlays
    if (state.mode === "menu") {
      drawMenuOverlay();
      drawBird(); // draw bird AFTER menu so it sits on top of the character card
    }
    if (state.mode === "help") {
      drawHelpOverlay();
    drawBird(); // keeps the bird visible on help too (optional but nice)
    }

    drawMegaBanner();
    drawCountdown();

    if (state.mode === "over") drawOverOverlay();
  }

  // ---------- Game loop ----------
  function loop(t) {
    const dt = Math.min(0.033, (t - state.lastT) / 1000);
    state.lastT = t;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // Boot
  toMenu();
  requestAnimationFrame((t) => {
    state.lastT = t;
    requestAnimationFrame(loop);
  });
})();