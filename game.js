(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const btnBegin = document.getElementById("btnBegin");
  const btnHelp = document.getElementById("btnHelp");
  const btnRestart = document.getElementById("btnRestart");
  const hardMode = document.getElementById("hardMode");

  const W = canvas.width;
  const H = canvas.height;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;
  const nowMs = () => performance.now();

  // ---- Assets ----
  const assets = {
    bg: new Image(),
    pipe: new Image(),
    pidgey: new Image(),
    mega: new Image(), // optional mega sheet
    icons: {
      razz: new Image(),
      goldRazz: new Image(),
      pinap: new Image(),
      silverPinap: new Image(),
      nanab: new Image(),
      mega: new Image(),
    },
    loaded: false,
    megaLoaded: false,
    iconsLoaded: false,
  };

  let baseLoaded = 0;
  const onBaseLoad = () => {
    baseLoaded++;
    if (baseLoaded >= 3) assets.loaded = true;
  };

  assets.bg.onload = onBaseLoad;
  assets.pipe.onload = onBaseLoad;
  assets.pidgey.onload = onBaseLoad;

  assets.bg.src = "assets/bg.svg";
  assets.pipe.src = "assets/pipe.svg";
  assets.pidgey.src = "assets/pidgey_sheet.png";

  assets.mega.onload = () => { assets.megaLoaded = true; };
  assets.mega.onerror = () => { assets.megaLoaded = false; };
  assets.mega.src = "assets/mega_pidgey_sheet.png"; // optional

  // icons you said you have
  const iconEntries = [
    ["razz", "assets/icon_razz.png"],
    ["goldRazz", "assets/icon_golden_razz.png"],
    ["pinap", "assets/icon_pinap.png"],
    ["silverPinap", "assets/icon_silver_pinap.png"],
    ["nanab", "assets/icon_nanab.png"],
    ["mega", "assets/icon_mega_stone.png"],
  ];
  let iconsLoadedCount = 0;
  for (const [k, path] of iconEntries) {
    assets.icons[k].onload = () => {
      iconsLoadedCount++;
      if (iconsLoadedCount >= iconEntries.length) assets.iconsLoaded = true;
    };
    assets.icons[k].src = path;
  }

  // ---- Tuning ----
  const T = {
    gravity: 1550,
    flap: -480,
    maxFall: 980,

    pipeW: 85,
    gap: 200,
    gapHard: 155,
    spawnEvery: 1.22,

    pipeSpeedBase: 170,
    pipeSpeedStep: 9, // every 5 points

    groundH: 90,

    frames: 22,
    fpsBase: 14,
    fpsFlapBurst: 30,

    birdSize: 100,
    birdRadius: 26,

    collectibleChancePerPipe: 0.22,

    invincibleSec: 6,
    megaSec: 40,
  };

  // ---- Collectibles ----
  const COLLECTIBLES = {
    RAZZ: {
      key: "RAZZ",
      title: "Razz Berry",
      desc: "Removes the next pipe and +1 point.",
      icon: "razz",
      score: 1,
      clearPipes: 1,
    },
    GOLD_RAZZ: {
      key: "GOLD_RAZZ",
      title: "Golden Razz Berry",
      desc: "Removes the next 5 pipes and +5 points.",
      icon: "goldRazz",
      score: 5,
      clearPipes: 5,
    },
    PINAP: {
      key: "PINAP",
      title: "Pinap Berry",
      desc: "Gain +2 points.",
      icon: "pinap",
      score: 2,
      clearPipes: 0,
    },
    SILVER_PINAP: {
      key: "SILVER_PINAP",
      title: "Silver Pinap Berry",
      desc: "Gain +10 points.",
      icon: "silverPinap",
      score: 10,
      clearPipes: 0,
    },
    NANAB: {
      key: "NANAB",
      title: "Nanab Berry",
      desc: "Invincible for 6 seconds.",
      icon: "nanab",
      score: 0,
      clearPipes: 0,
      invincibleSec: T.invincibleSec,
    },
    MEGA_STONE: {
      key: "MEGA_STONE",
      title: "Mega Stone",
      desc: "Mega Evolve for 40 seconds and smash your way through pipes!",
      icon: "mega",
      score: 30,
      clearPipes: 1,
      megaSec: T.megaSec,
    },
  };

  function rollCollectibleType() {
    // weights: common berries common, mega rare
    const table = [
      ["RAZZ", 23],
      ["PINAP", 42],
      ["GOLD_RAZZ", 9],
      ["NANAB", 10],
      ["SILVER_PINAP", 12],
      ["MEGA_STONE", 4],
    ];
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of table) {
      r -= w;
      if (r <= 0) return k;
    }
    return "RAZZ";
  }

  // ---- State ----
  const state = {
    mode: "menu", // menu | help | play | over

    score: 0,
    best: Number(localStorage.getItem("fp_best") || 0),

    bird: { x: 140, y: H * 0.45, vy: 0, r: T.birdRadius, angle: 0 },

    anim: { frame: 0, time: 0, fps: T.fpsBase },

    invincibleUntil: 0,
    megaUntil: 0,
    megaBannerUntil: 0,

    clearQueue: 0,

    pipes: [],        // { x, gapY, passed, id }
    collectibles: [], // { x, y, typeKey, r, taken, pipeId }
    particles: [],    // smoke + sparkles + text

    spawnTimer: 0,
    nextPipeId: 1,

    lastT: performance.now(),
  };

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

  function reset(toMenu = true) {
    state.mode = toMenu ? "menu" : "play";

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

  function startGame() {
    reset(false);
  }

  function endGame() {
    state.mode = "over";
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("fp_best", String(state.best));
    }
  }

  // ---- Particles ----
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
      life: rand(0.25, 0.50),
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
    state.particles = state.particles.filter(p => p.age < p.life);
  }

  // ---- Pipes / collectibles ----
  function spawnPipe() {
    const gapSize = hardMode.checked ? T.gapHard : T.gap;
    const topMargin = 90;
    const bottomMargin = T.groundH + 130;

    const gapY = rand(topMargin + gapSize / 2, H - bottomMargin - gapSize / 2);

    const id = state.nextPipeId++;
    state.pipes.push({ x: W + 40, gapY, passed: false, id });

    if (chance(T.collectibleChancePerPipe)) {
      const typeKey = rollCollectibleType();
      const cx = W + 40 + T.pipeW / 2 + rand(-8, 8);
      const cy = gapY + rand(-gapSize * 0.20, gapSize * 0.20);
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
      state.clearQueue += 2;
      poof(state.bird.x + 18, state.bird.y, 26);
    }
  }

  // ---- Collision helpers ----
  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const px = clamp(cx, rx, rx + rw);
    const py = clamp(cy, ry, ry + rh);
    const dx = cx - px, dy = cy - py;
    return dx * dx + dy * dy <= cr * cr;
  }
  function circleCircle(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return (dx * dx + dy * dy) <= (ar + br) * (ar + br);
  }

  // ---- Input ----
  function flap() {
    if (state.mode !== "play") return;

    state.bird.vy = T.flap;

    state.anim.time = 0;
    state.anim.fps = T.fpsFlapBurst;
    clearTimeout(flap._t);
    flap._t = setTimeout(() => state.anim.fps = T.fpsBase, 220);
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    // Only flap during play. Menu has buttons.
    flap();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (state.mode === "play") flap();
    }
    if (e.key === "r" || e.key === "R") reset(true);
    if (e.key === "Escape") state.mode = "menu";
  });

  btnBegin.addEventListener("click", () => startGame());
  btnHelp.addEventListener("click", () => state.mode = "help");
  btnRestart.addEventListener("click", () => reset(true));

  // ---- Update loop ----
  function update(dt) {
    // animate sprite always (menu looks alive)
    state.anim.time += dt;
    const frameDur = 1 / state.anim.fps;
    while (state.anim.time >= frameDur) {
      state.anim.time -= frameDur;
      state.anim.frame = (state.anim.frame + 1) % T.frames;
    }

    // sparkle trail during mega
    if (isMega()) {
      for (let i = 0; i < 2; i++) sparkle(state.bird.x - 26, state.bird.y + rand(-12, 12));
    }

    updateParticles(dt);

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
    state.pipes = state.pipes.filter(p => p.x + T.pipeW > -80);

    const alivePipeIds = new Set(state.pipes.map(p => p.id));
    state.collectibles = state.collectibles.filter(c =>
      !c.taken && (c.x + 40 > -80) && alivePipeIds.has(c.pipeId)
    );

    // clear queue (berries/mega)
    if (state.clearQueue > 0 && state.pipes.length > 0) {
      const next = state.pipes[0];
      if (next && next.x < W * 0.70) {
        poof(next.x + T.pipeW / 2, next.gapY, 30);
        if (!next.passed) awardScore(1);
        state.collectibles = state.collectibles.filter(c => c.pipeId !== next.id);
        state.pipes.shift();
        state.clearQueue--;
      }
    }

    // collisions + scoring
    const gapSize = hardMode.checked ? T.gapHard : T.gap;

    for (let i = 0; i < state.pipes.length; i++) {
      const p = state.pipes[i];
      const x = p.x, w = T.pipeW;
      const gapTop = p.gapY - gapSize / 2;
      const gapBot = p.gapY + gapSize / 2;

      if (!p.passed && x + w < b.x) {
        p.passed = true;
        awardScore(1);
      }

      const topRect = { x, y: 0, w, h: gapTop };
      const botRect = { x, y: gapBot, w, h: (H - T.groundH) - gapBot };

      const hit =
        circleRect(b.x, b.y, b.r, topRect.x, topRect.y, topRect.w, topRect.h) ||
        circleRect(b.x, b.y, b.r, botRect.x, botRect.y, botRect.w, botRect.h);

      if (hit) {
        if (isMega()) {
          poof(x + w / 2, p.gapY, 34);
          state.collectibles = state.collectibles.filter(c => c.pipeId !== p.id);
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

  // ---- Draw ----
  function drawBG() {
    if (assets.loaded) ctx.drawImage(assets.bg, 0, 0, W, H);
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
    const gapSize = hardMode.checked ? T.gapHard : T.gap;

    for (const p of state.pipes) {
      const x = p.x, w = T.pipeW;
      const gapTop = p.gapY - gapSize / 2;
      const gapBot = p.gapY + gapSize / 2;

      if (assets.loaded) {
        ctx.save();
        ctx.translate(x + w / 2, gapTop / 2);
        ctx.scale(1, -1);
        ctx.drawImage(assets.pipe, -w / 2, -gapTop / 2, w, gapTop);
        ctx.restore();

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

    if (assets.loaded) {
      if (mega) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 76, 54, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalAlpha = inv && !mega ? 0.55 : 1.0;

      const size = mega ? T.birdSize * 4 : T.birdSize;
      const frame = state.anim.frame % T.frames;

      if (mega && assets.megaLoaded) drawSprite(assets.mega, frame, T.frames, size);
      else drawSprite(assets.pidgey, frame, T.frames, size);

      ctx.globalAlpha = 1.0;
    }

    ctx.restore();

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

      // soft shadow blob
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.beginPath();
      ctx.ellipse(0, 12, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1.0;

      // icon (if loaded) else fallback circle
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
      const t = 1 - (p.age / p.life);
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
        // smoke
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,.38)";
    ctx.fillRect(0, 0, W, 56);

    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.font = "800 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${state.score}`, 12, 34);

    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = "700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Best: ${state.best}`, W - 92, 34);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Speed: ${Math.round(pipeSpeed())}`, W / 2 - 30, 34);
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
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(24, y - 34, W - 48, 64, 16);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("IT’S MEGA TIME", W / 2, y);

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

  // Help screen layout
  const HELP_ITEMS = [
    "RAZZ",
    "GOLD_RAZZ",
    "PINAP",
    "SILVER_PINAP",
    "NANAB",
    "MEGA_STONE",
  ];

  function drawHelpScreen() {
    // backdrop card
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    roundRect(18, 84, W - 36, H - 160, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "left";
    ctx.fillText("Help: Pickups", 34, 118);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Tap BEGIN to play • Press Esc to return", 34, 140);

    // grid
    const startX = 34;
    let y = 164;
    const rowH = 74;

    for (const key of HELP_ITEMS) {
      const def = COLLECTIBLES[key];
      const icon = assets.icons[def.icon];

      // icon slot
      ctx.save();
      ctx.translate(startX + 18, y + 20);

      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.beginPath();
      ctx.ellipse(0, 24, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (icon && icon.complete && icon.naturalWidth > 0) {
        ctx.drawImage(icon, -18, 0, 36, 36);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(0, 18, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // text
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "900 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(def.title, startX + 52, y + 24);

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      wrapText(def.desc, startX + 52, y + 44, W - 36 - 52 - 20, 14);

      y += rowH;
    }

    ctx.restore();
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + " ";
      const w = ctx.measureText(test).width;
      if (w > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + " ";
        y += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, y);
  }

  function drawMenuOverlay() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(30, 220, W - 60, 170, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Flappy Pidgey", W / 2, 268);

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "800 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Press BEGIN • Collect berries • Mega Stone = smash mode", W / 2, 302);

    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Tip: Speed increases every 5 points", W / 2, 328);

    ctx.restore();
  }

  function drawGameOverOverlay() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(30, 220, W - 60, 180, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", W / 2, 268);

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "900 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Score: ${state.score}`, W / 2, 305);

    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = "800 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Best: ${state.best} • Press Restart`, W / 2, 336);

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBG();

    // world
    drawPipes();
    drawCollectibles();
    drawBird();
    drawParticles();
    drawGround();

    // HUD only during play/over
    if (state.mode === "play" || state.mode === "over") drawHUD();

    drawMegaBanner();

    // overlays
    if (state.mode === "menu") drawMenuOverlay();
    if (state.mode === "help") drawHelpScreen();
    if (state.mode === "over") drawGameOverOverlay();
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - state.lastT) / 1000);
    state.lastT = t;

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Start in menu
  reset(true);
  requestAnimationFrame((t) => {
    state.lastT = t;
    requestAnimationFrame(loop);
  });
})();