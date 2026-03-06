(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
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
    overLogo: loadImage("assets/game_over_logo.svg"),
    coinSpin0: loadImage("assets/coin_spin_0.svg"),
    coinSpin1: loadImage("assets/coin_spin_1.svg"),
    coinSpin2: loadImage("assets/coin_spin_2.svg"),
    coinSpin3: loadImage("assets/coin_spin_3.svg"),
    codesIcon: loadImage("assets/codes_icon.svg"),
    powerFeather: loadImage("assets/power_feather.svg"),
    tabPower: loadImage("assets/store_tab_power.svg"),
    tabTrail: loadImage("assets/store_tab_trail.svg"),
    tabTheme: loadImage("assets/store_tab_theme.svg"),
    tabMerch: loadImage("assets/store_tab_merch.svg"),
    evForestLogo: loadImage("assets/event_logo_forest.svg"),
    evCityLogo: loadImage("assets/event_logo_city.svg"),
    evRocketLogo: loadImage("assets/event_logo_rocket.svg"),
    evPonyLogo: loadImage("assets/event_logo_pony.svg"),
    nestIcon: loadImage("assets/icon_nest.svg"),
    trophyIcon: loadImage("assets/icon_trophy.svg"),

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
    gravityEasy: 1280,
    gravityHard: 1550,
    flap: -480,
    maxFallEasy: 860,
    maxFallHard: 980,

    pipeWBase: 80,
    pipeWStage1: 92, // pipes 1-20
    pipeWStage2: 86, // pipes 21-30
    pipeWStepEvery: 15, // after pipe 50, shrink every N pipes
    pipeWStepSize: 3,
    pipeWMin: 62,
    gapEasyStart: 215,
    gapEasyMin: 178,
    gapEasyStepEveryScore: 40,
    gapEasyStepSize: 9,
    gapHard: 155,
    spawnEveryHard: 1.25,
    pipeSpacingEasyTarget: 275,
    spawnEveryEasyMin: 0.95,
    spawnEveryEasyMax: 1.6,

    pipeSpeedBaseEasy: 180,
    pipeSpeedBaseHard: 220,
    pipeSpeedStepEasy: 6,
    pipeSpeedStepHard: 16, // hard mode: original ramp
    pipeSpeedEveryEasy: 9,
    pipeSpeedEveryHard: 5,
    hardUnlockScore: 200,

    groundH: 90,

    frames: 22,
    fpsBase: 14,
    fpsFlapBurst: 18,

    birdSize: 90,
    birdRadius: 26,
    birdHitboxX: 24,
    birdHitboxY: 18,

    collectibleChancePerPipe: 0.28,

    invincibleSec: 4,
    megaSec: 30,
    megaChargeNeeded: 300,
    passivePointSec: 4.5,
    megaChargeAutoFireSec: 0.6,
    megaMeterRadius: 26,
    megaMeterTapRadius: 40,
    coinR: 11,
    coinSingleChance: 0.16,
    coinFormationChance: 0.06,
    scoreCoinBonusDiv: 10,

    forestEventWindowMin: 80,
    forestEventWindowMax: 120,
    forestEventCooldownScore: 80,
    forestEventDurationMin: 20,
    forestEventDurationMax: 40,
    forestEventSpeedBoost: 22,
    forestEventSpawnEveryMin: 0.42,
    forestEventSpawnEveryMax: 0.86,
    forestEventEkansChance: 0.26,
    forestEventRewardScore: 3,
    forestEventRewardCoins: 1,
    forestEventMobSpeedMin: 1.06,
    forestEventMobSpeedMax: 1.34,
    forestEventEkansScale: 2.0,
    cityEventWindowMin: 80,
    cityEventWindowMax: 120,
    cityEventCooldownScore: 80,
    cityEventDurationSec: 20,
    cityEventSpawnEveryMin: 0.34,
    cityEventSpawnEveryMax: 0.62,
    cityEventMegaGain: 3,
    cityEventCoinGain: 1,
    rocketEventWindowMin: 80,
    rocketEventWindowMax: 120,
    rocketEventCooldownScore: 80,
    rocketEventDurationSec: 15,
    rocketEventSpawnEveryMin: 0.12,
    rocketEventSpawnEveryMax: 0.24,
    rocketEventCoinScore: 2,
    rocketEventCoinCoins: 1,
    rocketEventBigScore: 5,
    rocketEventBigCoins: 10,
    rocketEventBigMega: 3,
    ponyEventWindowMin: 80,
    ponyEventWindowMax: 120,
    ponyEventCooldownScore: 80,
    ponyEventDurationSec: 20,
    ponyEventSpawnEveryMin: 0.18,
    ponyEventSpawnEveryMax: 0.34,
    ponyEventCoinScore: 2,
    ponyEventCoinCoins: 1,
    ponyEventFragMega: 2,
    ponyEventBigScore: 5,
    ponyEventBigCoins: 10,
    ponyEventBigMega: 3,
    ponyEvent303Score: 3,
    ponyEvent303Coins: 3,
    debugEventFirstPointsMax: 120,
    debugEventFirstPointsMin: 70,
    eventIntroSec: 5,

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
      desc: "Poofs the next pipe. +1 point.",
      icon: "razz",
      score: 1,
      clearPipes: 1,
    },
    GOLD_RAZZ: {
      key: "GOLD_RAZZ",
      title: "Golden Razz Berry",
      desc: "Poofs the next 5 pipes. +5 points.",
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
      desc: "4s shield: Pidgey turns ghosty and ignores hits.",
      icon: "nanab",
      score: 0,
      clearPipes: 0,
      invincibleSec: T.invincibleSec,
    },
    MEGA_STONE: {
      key: "MEGA_STONE",
      title: "Mega Stone",
      desc: "30s Mega Mode: 4x size, smash pipes, sparkle trail.",
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

  function rollCoinPattern() {
    const patterns = [
      [[0, 0], [34, 0], [68, 0], [102, 0], [136, 0], [170, 0]],
      [[0, 0], [34, -16], [68, -24], [102, -16], [136, 0], [170, 16], [204, 24]],
      [[0, 0], [36, 0], [72, 0], [108, -16], [144, -24], [180, -16], [216, 0]],
      [[0, -18], [34, -8], [68, 8], [102, 18], [136, 8], [170, -8], [204, -18]],
      [[0, 0], [34, -18], [68, 0], [102, 18], [136, 0], [170, -18], [204, 0], [238, 18]],
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  const STORE_DEFAULTS = {
    ownedTrails: ["none"],
    ownedThemes: ["classic"],
    ownedMerch: [],
    equippedTrail: "none",
    equippedTheme: "classic",
    featherCount: 0,
  };

  const STORE_TRAILS = [
    { id: "none", name: "No Trail", cost: 0 },
    { id: "stardust", name: "Stardust Sparkle", cost: 90 },
    { id: "feather", name: "Feather Trail", cost: 105 },
    { id: "rainbow", name: "Rainbow Wind Trail", cost: 130 },
    { id: "ember", name: "Ember Drift Trail", cost: 145 },
    { id: "comet", name: "Comet Frost Trail", cost: 170 },
    { id: "shadow", name: "Shadow Wisp Trail", cost: 195 },
  ];

  const STORE_THEMES = [
    { id: "classic", name: "Classic Pipes", cost: 0 },
    { id: "forest", name: "Forest Pipes", cost: 160 },
    { id: "city", name: "City Skyline Pipes", cost: 320 },
    { id: "rocket", name: "Team Rocket Hideout Pipes", cost: 640 },
    { id: "pony", name: "Pink Pony Club Pipes", cost: 998 },
  ];
  const STORE_MERCH = [
    {
      id: "legacy_reward",
      name: "Flappy Pidgey Legacy Reward",
      desc: "XL Badge, Sticker Pack, and Community Medal.",
      cost: 10000,
    },
  ];
  const THEME_META = {
    classic: {
      skyTop: "#8ed7ff",
      skyBottom: "#d5f0ff",
      groundTop: "rgba(48, 190, 80, .95)",
      groundBottom: "rgba(140, 90, 40, .85)",
      move: false,
      lighting: null,
      obstacle: "pipe",
    },
    forest: {
      skyTop: "#5aa85b",
      skyBottom: "#bce7a7",
      groundTop: "#4f9f58",
      groundBottom: "#40693f",
      move: true,
      lighting: "rgba(111, 223, 92, 0.12)",
      obstacle: "tree",
    },
    city: {
      skyTop: "#4f6ea5",
      skyBottom: "#9cb9d9",
      groundTop: "#566884",
      groundBottom: "#2d3a4a",
      move: true,
      lighting: "rgba(184, 214, 255, 0.12)",
      obstacle: "tower",
    },
    rocket: {
      skyTop: "#31243f",
      skyBottom: "#65465f",
      groundTop: "#4b3648",
      groundBottom: "#2a1b2d",
      move: true,
      lighting: "rgba(236, 71, 98, 0.14)",
      obstacle: "reactor",
    },
    pony: {
      skyTop: "#f08fc7",
      skyBottom: "#ffd2ea",
      groundTop: "#d26ea9",
      groundBottom: "#8b4c78",
      move: true,
      lighting: "rgba(255, 255, 205, 0.14)",
      obstacle: "candy",
    },
  };

  const FEATHER_COST = 499;

  function currentThemeMeta() {
    return THEME_META[activeThemeId()] || THEME_META.classic;
  }

  function debugEarlyEventScore() {
    return randInt(T.debugEventFirstPointsMin, T.debugEventFirstPointsMax);
  }

  function activeThemeId() {
    return state.hard ? "classic" : (state.equippedTheme || "classic");
  }

  function activeTrailId() {
    return state.hard ? "none" : (state.equippedTrail || "none");
  }

  function themeListMetrics() {
    const x = 40;
    const y = 374;
    const w = W - 80;
    const h = H - y - 138;
    const rowH = 58;
    const contentH = STORE_THEMES.length * rowH;
    const maxScroll = Math.max(0, contentH - h);
    return { x, y, w, h, rowH, contentH, maxScroll };
  }

  function trailListMetrics() {
    const x = 40;
    const y = 194;
    const w = W - 80;
    const h = H - y - 138;
    const rowH = 58;
    const contentH = STORE_TRAILS.length * rowH;
    const maxScroll = Math.max(0, contentH - h);
    return { x, y, w, h, rowH, contentH, maxScroll };
  }

  function merchListMetrics() {
    const x = 40;
    const y = 194;
    const w = W - 80;
    const h = H - y - 138;
    const rowH = 84;
    const contentH = STORE_MERCH.length * rowH;
    const maxScroll = Math.max(0, contentH - h);
    return { x, y, w, h, rowH, contentH, maxScroll };
  }

  function clampStoreThemeScroll() {
    const m = themeListMetrics();
    state.storeThemeScroll = clamp(state.storeThemeScroll, 0, m.maxScroll);
  }

  function clampStoreTrailScroll() {
    const m = trailListMetrics();
    state.storeTrailScroll = clamp(state.storeTrailScroll, 0, m.maxScroll);
  }

  function clampStoreMerchScroll() {
    const m = merchListMetrics();
    state.storeMerchScroll = clamp(state.storeMerchScroll, 0, m.maxScroll);
  }

  function activeStoreScrollMetrics() {
    if (state.storeTab === "themes") return themeListMetrics();
    if (state.storeTab === "trails") return trailListMetrics();
    if (state.storeTab === "merch") return merchListMetrics();
    return null;
  }

  function clampActiveStoreScroll() {
    if (state.storeTab === "themes") clampStoreThemeScroll();
    else if (state.storeTab === "trails") clampStoreTrailScroll();
    else if (state.storeTab === "merch") clampStoreMerchScroll();
  }

  function currentWeekKey() {
    const d = new Date();
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  function missionTargets() {
    return { easy: 30, medium: 80, hard: 140 };
  }

  function defaultChallengerState() {
    return {
      weekKey: currentWeekKey(),
      stamps: 0,
      weekly: { easy: false, medium: false, hard: false },
      leaderboard: [],
    };
  }

  function loadChallengerState() {
    try {
      const raw = localStorage.getItem("fp_challengers_v1");
      if (!raw) return defaultChallengerState();
      const parsed = JSON.parse(raw);
      const weekKey = currentWeekKey();
      const weekly = parsed.weekKey === weekKey && parsed.weekly
        ? {
            easy: !!parsed.weekly.easy,
            medium: !!parsed.weekly.medium,
            hard: !!parsed.weekly.hard,
          }
        : { easy: false, medium: false, hard: false };
      return {
        weekKey,
        stamps: Number(parsed.stamps || 0),
        weekly,
        leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard.map(Number).filter(Number.isFinite) : [],
      };
    } catch {
      return defaultChallengerState();
    }
  }

  function saveChallengerState() {
    localStorage.setItem(
      "fp_challengers_v1",
      JSON.stringify({
        weekKey: state.challengerWeekKey,
        stamps: state.challengerStamps,
        weekly: state.challengerWeekly,
        leaderboard: state.challengerLeaderboard,
      })
    );
  }

  function defaultLeaderboardsState() {
    return {
      themes: { classic: [], forest: [], city: [], rocket: [], pony: [] },
      challengers: { lifetime: [], seasonal: {} },
    };
  }

  function normalizeBoardName(name) {
    return String(name || "UNKNOWN").trim().slice(0, 24) || "UNKNOWN";
  }

  function toBoardEntry(v) {
    if (v && typeof v === "object") {
      const displayName = normalizeBoardName(v.displayName || v.name);
      const name = displayName.slice(0, 16).toUpperCase();
      const score = Number(v.score || 0);
      if (Number.isFinite(score)) {
        return {
          userId: v.userId ? String(v.userId) : "",
          displayName,
          name,
          avatarUrl: v.avatarUrl ? String(v.avatarUrl) : "",
          profileUrl: v.profileUrl ? String(v.profileUrl) : "",
          rank: Number.isFinite(Number(v.rank)) ? Number(v.rank) : 0,
          score,
        };
      }
    }
    const n = Number(v);
    if (Number.isFinite(n)) {
      return {
        userId: "",
        displayName: "UNKNOWN",
        name: "UNKNOWN",
        avatarUrl: "",
        profileUrl: "",
        rank: 0,
        score: n,
      };
    }
    return null;
  }

  function loadLeaderboardsState() {
    try {
      const raw = localStorage.getItem("fp_leaderboards_v1");
      if (!raw) return defaultLeaderboardsState();
      const parsed = JSON.parse(raw);
      const out = defaultLeaderboardsState();
      if (parsed.themes && typeof parsed.themes === "object") {
        for (const key of Object.keys(out.themes)) {
          const arr = parsed.themes[key];
          out.themes[key] = Array.isArray(arr) ? arr.map(toBoardEntry).filter(Boolean) : [];
        }
      }
      if (parsed.challengers && typeof parsed.challengers === "object") {
        out.challengers.lifetime = Array.isArray(parsed.challengers.lifetime)
          ? parsed.challengers.lifetime.map(toBoardEntry).filter(Boolean)
          : [];
        if (parsed.challengers.seasonal && typeof parsed.challengers.seasonal === "object") {
          for (const [k, v] of Object.entries(parsed.challengers.seasonal)) {
            out.challengers.seasonal[k] = Array.isArray(v) ? v.map(toBoardEntry).filter(Boolean) : [];
          }
        }
      }
      return out;
    } catch {
      return defaultLeaderboardsState();
    }
  }

  function saveLeaderboardsState() {
    localStorage.setItem("fp_leaderboards_v1", JSON.stringify(state.leaderboards));
  }

  function pushBoardScore(list, entry, keep = 20) {
    const e = toBoardEntry(entry);
    if (!e) return;
    list.push(e);
    list.sort((a, b) => b.score - a.score);
    if (list.length > keep) list.length = keep;
  }

  function toIsoTime(v) {
    if (typeof v === "string" && v) return v;
    if (Number.isFinite(Number(v))) {
      try {
        return new Date(Number(v)).toISOString();
      } catch {}
    }
    return new Date().toISOString();
  }

  function activeBoardKey() {
    return state.hard ? "chal_life" : activeThemeId();
  }

  function buildRdabConfig() {
    const raw = window.__RDAB_GAME_CONFIG__ || window.__RDAB_FLAPPY_CONFIG__ || null;
    if (!raw) {
      return {
        enabled: false,
        apiBase: "/api/games/flappy",
        launchType: "RDAB_LAUNCH",
        allowedOrigins: [],
        useCredentials: true,
      };
    }
    const allowedOrigins = Array.isArray(raw.allowedOrigins)
      ? raw.allowedOrigins.map((v) => String(v || "")).filter(Boolean)
      : [];
    return {
      enabled: raw.enabled !== false,
      apiBase: String(raw.apiBase || "/api/games/flappy"),
      launchType: String(raw.launchType || "RDAB_LAUNCH"),
      allowedOrigins,
      useCredentials: raw.useCredentials !== false,
      authToken: raw.authToken ? String(raw.authToken) : "",
      user: raw.user && typeof raw.user === "object" ? raw.user : null,
    };
  }

  function createRdabApiClient(rdabCfg) {
    const base = rdabCfg.apiBase.replace(/\/+$/, "");
    const timeoutMs = 9000;

    async function request(path, init = {}) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const headers = Object.assign({ "Content-Type": "application/json" }, init.headers || {});
      if (state?.rdab?.authToken) headers.Authorization = `Bearer ${state.rdab.authToken}`;
      try {
        const res = await fetch(`${base}${path}`, {
          method: init.method || "GET",
          headers,
          body: init.body,
          credentials: rdabCfg.useCredentials ? "include" : "same-origin",
          signal: ctrl.signal,
        });
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch {}
        if (!res.ok) {
          const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
          throw new Error(msg);
        }
        return data || {};
      } finally {
        clearTimeout(timer);
      }
    }

    return {
      async startRun(payload) {
        return request("/runs/start", { method: "POST", body: JSON.stringify(payload || {}) });
      },
      async finishRun(payload) {
        return request("/runs/finish", { method: "POST", body: JSON.stringify(payload || {}) });
      },
      async getLeaderboard(board) {
        return request(`/leaderboard?board=${encodeURIComponent(board)}`);
      },
    };
  }

  function ensureAudioCtx() {
    if (state.audioCtx) return state.audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    state.audioCtx = new Ctx();
    return state.audioCtx;
  }

  function stopEventMusic() {
    const m = state.eventMusic;
    if (m.timer) {
      clearInterval(m.timer);
      m.timer = null;
    }
    for (const n of m.nodes) {
      try { n.stop?.(); } catch {}
      try { n.disconnect?.(); } catch {}
    }
    m.nodes = [];
    m.key = "";
  }

  function stopThemeMusic() {
    const m = state.themeMusic;
    if (m.timer) {
      clearInterval(m.timer);
      m.timer = null;
    }
    for (const n of m.nodes) {
      try { n.stop?.(); } catch {}
      try { n.disconnect?.(); } catch {}
    }
    m.nodes = [];
    m.key = "";
  }

  function playEventStartSfx(key) {
    const ac = ensureAudioCtx();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    const base = key === "forest" ? 330 : key === "city" ? 410 : key === "rocket" ? 240 : 520;
    const now = ac.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = i === 2 ? "square" : "triangle";
      osc.frequency.setValueAtTime(base * (1 + i * 0.16), now + i * 0.1);
      gain.gain.setValueAtTime(0.0001, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.24);
    }
  }

  function playSfx(kind, arg = "") {
    const ac = ensureAudioCtx();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain).connect(ac.destination);

    if (kind === "mega") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.22);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
      return;
    }
    if (kind === "coin") {
      if (now - state.sfxLastCoinAt < 0.045) return;
      state.sfxLastCoinAt = now;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(760, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.1);
      return;
    }
    if (kind === "pickup") {
      osc.type = arg === "MEGA_STONE" ? "sawtooth" : "square";
      const base = arg === "RAZZ" ? 380
        : arg === "GOLD_RAZZ" ? 430
        : arg === "PINAP" ? 470
        : arg === "SILVER_PINAP" ? 520
        : arg === "NANAB" ? 330
        : 560;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  }

  function startEventMusic(key) {
    const ac = ensureAudioCtx();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    if (state.eventMusic.key === key) return;
    stopEventMusic();
    stopThemeMusic();

    const root = key === "forest" ? 164 : key === "city" ? 196 : key === "rocket" ? 146 : 220;
    const lead = ac.createOscillator();
    const bass = ac.createOscillator();
    const gLead = ac.createGain();
    const gBass = ac.createGain();
    lead.type = key === "rocket" ? "square" : "sawtooth";
    bass.type = "triangle";
    lead.frequency.value = root * 2;
    bass.frequency.value = root;
    gLead.gain.value = 0.018;
    gBass.gain.value = 0.026;
    lead.connect(gLead).connect(ac.destination);
    bass.connect(gBass).connect(ac.destination);
    lead.start();
    bass.start();

    const seq = key === "forest" ? [0, 3, 5, 7, 5, 3] :
      key === "city" ? [0, 2, 7, 9, 7, 2] :
      key === "rocket" ? [0, -2, 3, 1, -2, 0] : [0, 4, 7, 12, 7, 4];
    let i = 0;
    const timer = setInterval(() => {
      const semis = seq[i % seq.length];
      const f = root * Math.pow(2, semis / 12);
      lead.frequency.setTargetAtTime(f * 2, ac.currentTime, 0.03);
      bass.frequency.setTargetAtTime(f, ac.currentTime, 0.05);
      i++;
    }, 280);

    state.eventMusic = { key, nodes: [lead, bass, gLead, gBass], timer };
  }

  function startThemeMusic(key) {
    const ac = ensureAudioCtx();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    if (state.themeMusic.key === key) return;
    stopThemeMusic();

    const rootMap = {
      classic: 174,
      forest: 164,
      city: 196,
      rocket: 148,
      pony: 220,
      mega: 262,
    };
    const root = rootMap[key] || 174;
    const lead = ac.createOscillator();
    const chord = ac.createOscillator();
    const bass = ac.createOscillator();
    const gLead = ac.createGain();
    const gChord = ac.createGain();
    const gBass = ac.createGain();
    lead.type = key === "rocket" ? "square" : "triangle";
    chord.type = key === "mega" ? "sawtooth" : "sine";
    bass.type = "triangle";
    lead.frequency.value = root * 2;
    chord.frequency.value = root * 1.5;
    bass.frequency.value = root * 0.5;
    gLead.gain.value = key === "mega" ? 0.024 : 0.017;
    gChord.gain.value = key === "mega" ? 0.017 : 0.012;
    gBass.gain.value = 0.02;
    lead.connect(gLead).connect(ac.destination);
    chord.connect(gChord).connect(ac.destination);
    bass.connect(gBass).connect(ac.destination);
    lead.start();
    chord.start();
    bass.start();

    const seq = key === "classic" ? [0, 4, 7, 9, 7, 4, 2, 4]
      : key === "forest" ? [0, 3, 5, 7, 5, 3, 1, 3]
      : key === "city" ? [0, 2, 7, 9, 11, 9, 7, 2]
      : key === "rocket" ? [0, -2, 3, 1, -4, -2, 0, 1]
      : key === "pony" ? [0, 4, 7, 12, 11, 7, 4, 9]
      : [0, 7, 10, 12, 10, 7, 5, 7];

    function percHit(type, t) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type === "snare" ? "square" : "sine";
      o.frequency.setValueAtTime(type === "snare" ? 190 : 96, t);
      o.frequency.exponentialRampToValueAtTime(type === "snare" ? 90 : 52, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(type === "snare" ? 0.033 : 0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (type === "snare" ? 0.12 : 0.18));
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.2);
    }

    let i = 0;
    const stepMs = key === "mega" ? 230 : 340;
    const timer = setInterval(() => {
      const semi = seq[i % seq.length];
      const f = root * Math.pow(2, semi / 12);
      const t = ac.currentTime;
      lead.frequency.setTargetAtTime(f * 2.04, t, 0.06);
      chord.frequency.setTargetAtTime(f * 1.49, t, 0.09);
      bass.frequency.setTargetAtTime(f * 0.5, t, 0.07);
      percHit(i % 4 === 1 || i % 4 === 3 ? "snare" : "kick", t);
      i++;
    }, stepMs);

    state.themeMusic = { key, nodes: [lead, chord, bass, gLead, gChord, gBass], timer };
  }

  function updateBackgroundMusic() {
    if (!state.audioCtx) return;
    const gameMode = state.mode === "transitioning" || state.mode === "countdown" || state.mode === "play" || state.mode === "over";
    if (!gameMode) {
      stopThemeMusic();
      return;
    }
    if (state.eventMusic.key) {
      stopThemeMusic();
      return;
    }
    const key = (state.mode === "play" && isMega()) ? "mega" : activeThemeId();
    startThemeMusic(key);
  }

  function beginEventIntro(eventKey, title, rules) {
    state.eventIntro.active = true;
    state.eventIntro.until = nowMs() + T.eventIntroSec * 1000;
    state.eventIntro.eventKey = eventKey;
    state.eventIntro.title = title;
    state.eventIntro.rules = rules;
    playEventStartSfx(eventKey);
  }

  function loadStoreState() {
    try {
      const raw = localStorage.getItem("fp_store_v1");
      if (!raw) return { ...STORE_DEFAULTS };
      const parsed = JSON.parse(raw);
      const ownedTrails = Array.isArray(parsed.ownedTrails) ? parsed.ownedTrails.slice() : [...STORE_DEFAULTS.ownedTrails];
      if (!ownedTrails.includes("none")) ownedTrails.unshift("none");
      return {
        ownedTrails,
        ownedThemes: Array.isArray(parsed.ownedThemes) ? parsed.ownedThemes : [...STORE_DEFAULTS.ownedThemes],
        ownedMerch: Array.isArray(parsed.ownedMerch) ? parsed.ownedMerch : [...STORE_DEFAULTS.ownedMerch],
        equippedTrail: typeof parsed.equippedTrail === "string" ? parsed.equippedTrail : STORE_DEFAULTS.equippedTrail,
        equippedTheme: parsed.equippedTheme || STORE_DEFAULTS.equippedTheme,
        featherCount: Number(parsed.featherCount || 0),
      };
    } catch {
      return { ...STORE_DEFAULTS };
    }
  }

  function saveStoreState() {
    localStorage.setItem(
      "fp_store_v1",
      JSON.stringify({
        ownedTrails: state.ownedTrails,
        ownedThemes: state.ownedThemes,
        ownedMerch: state.ownedMerch,
        equippedTrail: state.equippedTrail,
        equippedTheme: state.equippedTheme,
        featherCount: state.featherCount,
      })
    );
  }

  // ---------- Game state ----------
  // mode: menu | help | store | leaderboards | transitioning | countdown | play | over
  const storeState = loadStoreState();
  const challengerState = loadChallengerState();
  const leaderboardsState = loadLeaderboardsState();
  const rdabConfig = buildRdabConfig();

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
    megaCharge: 0,
    megaReadySince: 0,
    passivePointTimer: 0,
    overDialog: "",
    totalCoins: Number(localStorage.getItem("fp_coins") || 0),
    runCoins: 0,
    runCoinPointMilestones: 0,
    runHundredsBoosts: 0,
    coinBreakdown: null,
    rewardsApplied: false,
    forestEvent: {
      active: false,
      pending: false,
      kind: "",
      until: 0,
      spawnTimer: 0,
      nextSpawnIn: rand(T.forestEventSpawnEveryMin, T.forestEventSpawnEveryMax),
      mobs: [],
      labelUntil: 0,
      nextTriggerScore: debugEarlyEventScore(),
    },
    cityEvent: {
      active: false,
      pending: false,
      until: 0,
      spawnTimer: 0,
      nextSpawnIn: rand(T.cityEventSpawnEveryMin, T.cityEventSpawnEveryMax),
      fragments: [],
      labelUntil: 0,
      nextTriggerScore: debugEarlyEventScore(),
    },
    rocketEvent: {
      active: false,
      pending: false,
      until: 0,
      spawnTimer: 0,
      nextSpawnIn: rand(T.rocketEventSpawnEveryMin, T.rocketEventSpawnEveryMax),
      coins: [],
      bigCoin: null,
      balloonY: -130,
      ascendUntil: 0,
      labelUntil: 0,
      nextTriggerScore: debugEarlyEventScore(),
    },
    ponyEvent: {
      active: false,
      pending: false,
      until: 0,
      spawnTimer: 0,
      nextSpawnIn: rand(T.ponyEventSpawnEveryMin, T.ponyEventSpawnEveryMax),
      pickups: [],
      bigCoin: null,
      lettersDone: { "3a": false, "0": false, "3b": false },
      letterOrder: ["3a", "0", "3b"],
      lastLetterSpawnX: 0,
      rainbowPhase: 0,
      labelUntil: 0,
      nextTriggerScore: debugEarlyEventScore(),
    },
    eventIntro: {
      active: false,
      until: 0,
      eventKey: "",
      title: "",
      rules: "",
    },

    pipes: [],
    collectibles: [],
    coins: [],
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
    helpSlide: 0,

    // In-canvas buttons
    buttons: [],

    // difficulty toggle
    hard: false,
    showHardLockPopup: false,
    showNestPopup: false,
    lbTab: "classic",
    lbProfileName: "",
    lbProfileEntry: null,
    lbSearchResults: [],
    showLbSearchPopup: false,
    lbSearchDraft: "",
    storeTab: "power",
    ownedTrails: storeState.ownedTrails,
    ownedThemes: storeState.ownedThemes,
    ownedMerch: storeState.ownedMerch || [],
    equippedTrail: storeState.equippedTrail,
    equippedTheme: storeState.equippedTheme,
    storeThemeScroll: 0,
    storeTrailScroll: 0,
    storeMerchScroll: 0,
    featherCount: storeState.featherCount,
    trailTimer: 0,
    secondChanceUsedThisRun: false,
    redeemedCodes: (() => {
      try {
        const raw = localStorage.getItem("fp_redeemed_codes");
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    })(),
    dragThemeScroll: false,
    dragThemeLastY: 0,
    dragPointerId: null,
    challengerWeekKey: challengerState.weekKey,
    challengerStamps: challengerState.stamps,
    challengerWeekly: challengerState.weekly,
    challengerLeaderboard: challengerState.leaderboard,
    playerName: (localStorage.getItem("fp_player_name") || "").slice(0, 16).toUpperCase(),
    audioCtx: null,
    eventMusic: { key: "", nodes: [], timer: null },
    themeMusic: { key: "", nodes: [], timer: null },
    sfxLastCoinAt: 0,
    leaderboards: leaderboardsState,
    rdab: {
      enabled: rdabConfig.enabled,
      launchType: rdabConfig.launchType,
      allowedOrigins: rdabConfig.allowedOrigins,
      authToken: rdabConfig.authToken || "",
      user: rdabConfig.user || null,
      api: null,
      runId: "",
      runStartedAtIso: "",
      submitState: "idle",
      submitMessage: "",
      rewards: [],
      boardLoading: {},
      boardLastSyncAt: {},
      boardError: "",
      avatarImages: {},
    },

    lastT: performance.now(),
  };
  state.rdab.api = createRdabApiClient(rdabConfig);
  if (!state.ownedTrails.includes(state.equippedTrail)) state.equippedTrail = "none";

  function entryLabel(entry) {
    if (!entry) return "UNKNOWN";
    return normalizeBoardName(entry.displayName || entry.name || "UNKNOWN");
  }

  function samePilot(entry, label) {
    return entryLabel(entry).toUpperCase() === String(label || "").trim().toUpperCase();
  }

  function findPilotEntryByLabel(label) {
    const lists = [];
    for (const k of ["classic", "forest", "city", "rocket", "pony"]) lists.push(state.leaderboards.themes[k] || []);
    lists.push(state.leaderboards.challengers.lifetime || []);
    for (const arr of Object.values(state.leaderboards.challengers.seasonal || {})) lists.push(arr || []);
    for (const list of lists) {
      const hit = list.find((e) => samePilot(e, label));
      if (hit) return hit;
    }
    return null;
  }

  function isRdabOriginAllowed(origin) {
    if (!origin) return false;
    if (!state.rdab.allowedOrigins || state.rdab.allowedOrigins.length === 0) return origin === window.location.origin;
    return state.rdab.allowedOrigins.includes(origin);
  }

  function maybeEnableRdabFromLaunch(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.token) state.rdab.authToken = String(msg.token);
    if (msg.user && typeof msg.user === "object") state.rdab.user = msg.user;
    if (msg.apiBase && typeof msg.apiBase === "string") {
      const overrideCfg = Object.assign({}, rdabConfig, { apiBase: msg.apiBase, enabled: true });
      state.rdab.api = createRdabApiClient(overrideCfg);
    }
    state.rdab.enabled = true;
  }

  function applyRemoteBoard(tabId, entries) {
    const out = Array.isArray(entries) ? entries.map(toBoardEntry).filter(Boolean) : [];
    if (tabId === "chal_season") {
      state.leaderboards.challengers.seasonal[currentWeekKey()] = out;
    } else if (tabId === "chal_life") {
      state.leaderboards.challengers.lifetime = out;
    } else {
      state.leaderboards.themes[tabId] = out;
    }
    saveLeaderboardsState();
  }

  async function refreshLeaderboardTab(tabId, force = false) {
    if (!state.rdab.enabled || !state.rdab.api) return;
    const now = Date.now();
    const last = Number(state.rdab.boardLastSyncAt[tabId] || 0);
    if (!force && now - last < 25000) return;
    if (state.rdab.boardLoading[tabId]) return;
    state.rdab.boardLoading[tabId] = true;
    state.rdab.boardError = "";
    try {
      const board = tabId === "chal_season" ? "chal_season" : tabId;
      const resp = await state.rdab.api.getLeaderboard(board);
      applyRemoteBoard(tabId, resp.entries || []);
      state.rdab.boardLastSyncAt[tabId] = Date.now();
    } catch (err) {
      state.rdab.boardError = err?.message || "Leaderboard sync failed";
    } finally {
      state.rdab.boardLoading[tabId] = false;
    }
  }

  async function startRunOnRdab() {
    state.rdab.runId = "";
    state.rdab.runStartedAtIso = new Date().toISOString();
    state.rdab.submitState = "idle";
    state.rdab.submitMessage = "";
    state.rdab.rewards = [];
    if (!state.rdab.enabled || !state.rdab.api) return;
    try {
      const resp = await state.rdab.api.startRun({
        mode: state.hard ? "hard" : "classic",
        theme: activeThemeId(),
        startedAt: state.rdab.runStartedAtIso,
      });
      state.rdab.runId = String(resp.runId || "");
      state.rdab.runStartedAtIso = toIsoTime(resp.startedAt || state.rdab.runStartedAtIso);
    } catch (err) {
      state.rdab.submitMessage = `RDAB run session unavailable (${err?.message || "network error"})`;
    }
  }

  async function finishRunOnRdab() {
    if (!state.rdab.enabled || !state.rdab.api) return;
    if (state.rdab.submitState === "submitting") return;
    state.rdab.submitState = "submitting";
    state.rdab.submitMessage = "Submitting score to RDAB...";
    const nowIso = new Date().toISOString();
    const startedMs = new Date(state.rdab.runStartedAtIso || nowIso).getTime();
    const durationMs = Number.isFinite(startedMs) ? Math.max(0, Date.now() - startedMs) : 0;
    try {
      const resp = await state.rdab.api.finishRun({
        runId: state.rdab.runId || undefined,
        score: state.score,
        durationMs,
        mode: state.hard ? "hard" : "classic",
        theme: activeThemeId(),
        startedAt: state.rdab.runStartedAtIso || nowIso,
        finishedAt: nowIso,
      });
      if (!resp || resp.accepted === false) {
        state.rdab.submitState = "rejected";
        state.rdab.submitMessage = "Score was not accepted by RDAB.";
        return;
      }
      state.rdab.submitState = "ok";
      state.rdab.submitMessage = "Score submitted to RDAB.";
      state.rdab.rewards = Array.isArray(resp.rewards) ? resp.rewards.slice(0, 4) : [];
      if (Number.isFinite(Number(resp.personalBest))) {
        state.best = Math.max(state.best, Number(resp.personalBest));
        localStorage.setItem("fp_best", String(state.best));
      }
      await refreshLeaderboardTab(activeBoardKey(), true);
      if (state.hard) await refreshLeaderboardTab("chal_season", true);
    } catch (err) {
      state.rdab.submitState = "error";
      state.rdab.submitMessage = `Score not submitted (${err?.message || "network error"})`;
    }
  }

  function openLeaderboards() {
    state.mode = "leaderboards";
    state.lbProfileName = "";
    state.lbProfileEntry = null;
    state.showLbSearchPopup = false;
    refreshLeaderboardTab(state.lbTab, true);
  }

  function avatarImage(url) {
    const u = String(url || "");
    if (!u) return null;
    if (state.rdab.avatarImages[u]) return state.rdab.avatarImages[u];
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.src = u;
    state.rdab.avatarImages[u] = im;
    return im;
  }

  window.addEventListener("message", (ev) => {
    if (!ev || !ev.data || typeof ev.data !== "object") return;
    if (ev.data.type !== state.rdab.launchType) return;
    if (!isRdabOriginAllowed(ev.origin)) return;
    maybeEnableRdabFromLaunch(ev.data);
    refreshLeaderboardTab(state.lbTab, true);
  });

  // ---------- Core mechanics ----------
  function pipeSpeed() {
    const baseSpeed = state.hard ? T.pipeSpeedBaseHard : T.pipeSpeedBaseEasy;
    const stepEvery = state.hard ? T.pipeSpeedEveryHard : T.pipeSpeedEveryEasy;
    const stepSize = state.hard ? T.pipeSpeedStepHard : T.pipeSpeedStepEasy;
    const steps = Math.floor(state.score / stepEvery);
    const megaBoost = isMega() ? 100 : 0;
    const forestBoost = state.forestEvent.active ? T.forestEventSpeedBoost : 0;
    const hundredsBoost = state.runHundredsBoosts * 3;
    return baseSpeed + steps * stepSize + megaBoost + forestBoost + hundredsBoost;
  }

  function currentSpawnEvery() {
    if (state.hard) return T.spawnEveryHard;
    const adaptive = T.pipeSpacingEasyTarget / pipeSpeed();
    const citySpread = state.cityEvent.active ? 1.45 : 1;
    return clamp(adaptive * citySpread, T.spawnEveryEasyMin, T.spawnEveryEasyMax * 1.65);
  }

  function currentGapSize() {
    if (state.hard) return T.gapHard;
    const shrinkSteps = Math.floor(state.score / T.gapEasyStepEveryScore);
    const gap = T.gapEasyStart - shrinkSteps * T.gapEasyStepSize;
    return Math.max(T.gapEasyMin, gap);
  }

  function pipeWidthForNumber(pipeNumber) {
    if (pipeNumber <= 20) return T.pipeWStage1;
    if (pipeNumber <= 30) return T.pipeWStage2;
    if (pipeNumber <= 50) return T.pipeWBase;

    const post50Index = pipeNumber - 51;
    const shrinkSteps = Math.floor(post50Index / T.pipeWStepEvery);
    return Math.max(T.pipeWMin, T.pipeWBase - shrinkSteps * T.pipeWStepSize);
  }

  function isMega() {
    return nowMs() < state.megaUntil;
  }

  function isHardUnlocked() {
    return state.best >= T.hardUnlockScore;
  }

  function isInvincible() {
    const t = nowMs();
    return t < state.invincibleUntil || t < state.megaUntil;
  }

  function isMegaChargeReady() {
    return state.megaCharge >= T.megaChargeNeeded;
  }

  function tryActivateChargedMega() {
    if (state.hard) return false;
    if (state.mode !== "play" || !isMegaChargeReady()) return false;
    state.megaCharge = 0;
    state.megaReadySince = 0;
    triggerMegaMode();
    return true;
  }

  function applyChallengerRunResult() {
    if (!state.hard) return;
    syncChallengerWeekIfNeeded();
    const missions = missionTargets();
    let gained = 0;
    if (state.score >= missions.easy && !state.challengerWeekly.easy) {
      state.challengerWeekly.easy = true;
      gained++;
    }
    if (state.score >= missions.medium && !state.challengerWeekly.medium) {
      state.challengerWeekly.medium = true;
      gained++;
    }
    if (state.score >= missions.hard && !state.challengerWeekly.hard) {
      state.challengerWeekly.hard = true;
      gained++;
    }
    if (gained > 0) {
      state.challengerStamps += gained;
      floatText(W / 2, 120, `+${gained} stamp${gained > 1 ? "s" : ""}`);
    }
    state.challengerLeaderboard.push(state.score);
    state.challengerLeaderboard.sort((a, b) => b - a);
    state.challengerLeaderboard = state.challengerLeaderboard.slice(0, 10);
    saveChallengerState();
  }

  function recordRunOnLeaderboards() {
    if (state.score <= 0) return;
    if (state.rdab.enabled) return;
    const entry = { name: ensurePlayerName(), score: state.score };
    if (state.hard) {
      const wk = currentWeekKey();
      const seasonals = state.leaderboards.challengers.seasonal;
      if (!Array.isArray(seasonals[wk])) seasonals[wk] = [];
      pushBoardScore(seasonals[wk], entry, 25);
      pushBoardScore(state.leaderboards.challengers.lifetime, entry, 50);
      saveLeaderboardsState();
      return;
    }
    const theme = activeThemeId();
    if (!Array.isArray(state.leaderboards.themes[theme])) state.leaderboards.themes[theme] = [];
    pushBoardScore(state.leaderboards.themes[theme], entry, 25);
    saveLeaderboardsState();
  }

  function syncChallengerWeekIfNeeded() {
    const wk = currentWeekKey();
    if (state.challengerWeekKey === wk) return;
    state.challengerWeekKey = wk;
    state.challengerWeekly = { easy: false, medium: false, hard: false };
    saveChallengerState();
  }

  function ensurePlayerName() {
    if (state.rdab.enabled && state.rdab.user && state.rdab.user.displayName) {
      const n = normalizeBoardName(state.rdab.user.displayName);
      state.playerName = n.toUpperCase().slice(0, 16);
      return state.playerName;
    }
    let name = (state.playerName || "").trim();
    if (name) return name.toUpperCase().slice(0, 16);
    name = `PILOT${randInt(1000, 9999)}`;
    state.playerName = name;
    localStorage.setItem("fp_player_name", name);
    return name;
  }

  function boardByTab(tabId) {
    const wk = currentWeekKey();
    if (tabId === "chal_season") return state.leaderboards.challengers.seasonal[wk] || [];
    if (tabId === "chal_life") return state.leaderboards.challengers.lifetime || [];
    return state.leaderboards.themes[tabId] || [];
  }

  function findPlayers(query) {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const set = new Set();
    const pushName = (arr) => {
      for (const e of arr) {
        const n = entryLabel(e).toUpperCase();
        if (n.includes(q)) set.add(n);
      }
    };
    for (const k of ["classic", "forest", "city", "rocket", "pony"]) pushName(state.leaderboards.themes[k] || []);
    pushName(state.leaderboards.challengers.lifetime || []);
    for (const arr of Object.values(state.leaderboards.challengers.seasonal || {})) pushName(arr || []);
    return Array.from(set).sort().slice(0, 20);
  }

  function addMegaCharge(amount) {
    const wasReady = isMegaChargeReady();
    state.megaCharge = Math.min(T.megaChargeNeeded, state.megaCharge + amount);
    if (!wasReady && isMegaChargeReady()) state.megaReadySince = nowMs();
  }

  function awardScore(n) {
    state.score += n;
    const hundredsNow = Math.floor(state.score / 100);
    while (state.mode === "play" && hundredsNow > state.runHundredsBoosts) {
      state.runHundredsBoosts += 1;
      state.score += 1;
      floatText(W / 2, 142, `100+ BONUS! +1 SCORE | SPEED +${state.runHundredsBoosts * 3}`);
    }
    if (!state.hard && n > 0 && state.mode === "play") {
      addMegaCharge(n);
    }
  }

  function addRunCoins(amount, fx = 0, fy = 0) {
    if (amount <= 0) return;
    state.runCoins += amount;
    const milestones = Math.floor(state.runCoins / 10);
    if (state.mode === "play" && milestones > state.runCoinPointMilestones) {
      const gained = milestones - state.runCoinPointMilestones;
      state.runCoinPointMilestones = milestones;
      awardScore(gained);
      if (fx || fy) floatText(fx, fy, `+${gained} SCORE (10 COIN)`);
    }
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function gameOverDialogForScore(score) {
    if (score < 10) {
      return randomFrom([
        "Pidgey says: You lasted about one dramatic inhale.",
        "Pidgey says: That was less flight, more surrender.",
        "Pidgey says: Pipe 1 sends its regards.",
        "Pidgey says: You speedran humiliation. Respect.",
        "Pidgey says: Wings installed, confidence not found.",
        "Pidgey says: Even the clouds looked away.",
        "Pidgey says: You fought gravity and gravity yawned.",
        "Pidgey says: The tutorial is asking for a rematch.",
        "Pidgey says: That run was a public service announcement.",
        "Pidgey says: You hit one pipe and became lore.",
      ]);
    }
    if (score < 40) {
      return randomFrom([
        "Pidgey says: Not bad. Still legally classified as turbulent.",
        "Pidgey says: You cooked, then forgot to stir.",
        "Pidgey says: Mid-air confidence, ground-level ending.",
        "Pidgey says: You bullied a few pipes, then tripped.",
        "Pidgey says: Decent run. Your ego can have a snack.",
        "Pidgey says: You look dangerous right up to the crash.",
        "Pidgey says: You almost looked professional for six seconds.",
        "Pidgey says: Clean movement, tragic finale.",
        "Pidgey says: Solid effort. Horrific closing statement.",
        "Pidgey says: Good pace. Bad life choices.",
      ]);
    }
    if (score < 90) {
      return randomFrom([
        "Pidgey says: Okay now we're talking. Pipes looked nervous.",
        "Pidgey says: Stylish run. Catastrophic final decision.",
        "Pidgey says: You were farming clips until the choke.",
        "Pidgey says: Big swagger, bigger collision.",
        "Pidgey says: You flew like a villain and died like a meme.",
        "Pidgey says: That run had aura. Also impact.",
        "Pidgey says: You made chaos look coordinated.",
        "Pidgey says: Good enough to brag, not enough to sleep easy.",
        "Pidgey says: The pipes are drafting an apology letter.",
        "Pidgey says: You were one braincell away from greatness.",
      ]);
    }
    if (score < 160) {
      return randomFrom([
        "Pidgey says: Elite work. The pipes started negotiating.",
        "Pidgey says: You turned panic into performance art.",
        "Pidgey says: That's a dangerous amount of skill.",
        "Pidgey says: You flew like rent was due.",
        "Pidgey says: Cold run. Absolutely villainous energy.",
        "Pidgey says: The sky owes you an apology.",
        "Pidgey says: That was premium menace behavior.",
        "Pidgey says: You nearly broke the mood and the map.",
        "Pidgey says: If this was warm-up, that's terrifying.",
        "Pidgey says: You had the pipes on life support.",
      ]);
    }
    return randomFrom([
      "Pidgey says: Legendary. The pipes called legal counsel.",
      "Pidgey says: Unreal run. Are you human or patch notes?",
      "Pidgey says: Hall-of-fame wings. Pure cinema.",
      "Pidgey says: The sky has entered your fan club.",
      "Pidgey says: You farmed greatness like it was routine.",
      "Pidgey says: Ruthless. Elegant. Slightly disrespectful.",
      "Pidgey says: You didn't play the game. You audited it.",
      "Pidgey says: This run should come with a warning label.",
      "Pidgey says: The leaderboard just felt that.",
      "Pidgey says: You are now the problem everyone else has.",
    ]);
  }

  function triggerMegaMode(durationSec = T.megaSec) {
    playSfx("mega");
    const t = nowMs();
    state.megaUntil = Math.max(state.megaUntil, t + durationSec * 1000);
    state.megaBannerUntil = Math.max(state.megaBannerUntil, t + 2200);
    state.clearQueue += 2;
    poof(state.bird.x + 18, state.bird.y, 26);
  }

  function computeCoinBreakdownForRun() {
    const picked = state.runCoins;
    const scoreBonus = Math.floor(state.score / T.scoreCoinBonusDiv);
    let survivalBonus = 0;
    if (state.score >= 180) survivalBonus = 20;
    else if (state.score >= 120) survivalBonus = 12;
    else if (state.score >= 70) survivalBonus = 7;
    else if (state.score >= 30) survivalBonus = 3;
    const hardBonus = state.hard ? Math.max(5, Math.floor(state.score / 22)) : 0;
    const total = picked + scoreBonus + survivalBonus + hardBonus;
    return { picked, scoreBonus, survivalBonus, hardBonus, total };
  }

  function applyRunRewardsIfNeeded() {
    if (state.rewardsApplied) return;
    state.coinBreakdown = computeCoinBreakdownForRun();
    state.totalCoins += state.coinBreakdown.total;
    state.rewardsApplied = true;
    localStorage.setItem("fp_coins", String(state.totalCoins));
  }

  function rollbackRunRewardsIfNeeded() {
    if (!state.rewardsApplied || !state.coinBreakdown) return;
    state.totalCoins = Math.max(0, state.totalCoins - state.coinBreakdown.total);
    state.rewardsApplied = false;
    state.coinBreakdown = null;
    localStorage.setItem("fp_coins", String(state.totalCoins));
  }

  function buyFeather() {
    if (state.totalCoins < FEATHER_COST) return;
    state.totalCoins -= FEATHER_COST;
    state.featherCount += 1;
    localStorage.setItem("fp_coins", String(state.totalCoins));
    saveStoreState();
  }

  function buyOrEquipTrail(id, cost) {
    if (!state.ownedTrails.includes(id)) {
      if (state.totalCoins < cost) return;
      state.totalCoins -= cost;
      state.ownedTrails.push(id);
      localStorage.setItem("fp_coins", String(state.totalCoins));
    }
    state.equippedTrail = id;
    saveStoreState();
  }

  function buyOrEquipTheme(id, cost) {
    if (!state.ownedThemes.includes(id)) {
      if (state.totalCoins < cost) return;
      state.totalCoins -= cost;
      state.ownedThemes.push(id);
      localStorage.setItem("fp_coins", String(state.totalCoins));
    }
    state.equippedTheme = id;
    saveStoreState();
  }

  function buyMerch(id, cost) {
    if (state.ownedMerch.includes(id)) return;
    if (state.totalCoins < cost) return;
    state.totalCoins -= cost;
    state.ownedMerch.push(id);
    localStorage.setItem("fp_coins", String(state.totalCoins));
    saveStoreState();
    floatText(W / 2, 130, "LEGACY REWARD PURCHASED");
  }

  function useSecondChanceFeather() {
    if (state.hard) return;
    if (state.mode !== "over" || state.featherCount <= 0 || state.secondChanceUsedThisRun) return;
    rollbackRunRewardsIfNeeded();
    state.featherCount -= 1;
    state.secondChanceUsedThisRun = true;
    saveStoreState();

    state.mode = "play";
    state.overDialog = "";
    state.bird.vy = -140;
    state.bird.y = clamp(state.bird.y, 72, H - T.groundH - 72);
    state.invincibleUntil = Math.max(state.invincibleUntil, nowMs() + 2500);
    state.pipes = state.pipes.filter((p) => p.x > state.bird.x + 90);
    state.collectibles = state.collectibles.filter((c) => c.x > state.bird.x + 70);
    state.coins = state.coins.filter((coin) => coin.x > state.bird.x + 70);
  }

  function openCodesPrompt() {
    const raw = window.prompt("Enter code");
    if (raw == null) return;
    const code = raw.trim().toUpperCase();
    if (!code) return;

    if (code === "RESTUP") {
      state.totalCoins = 0;
      localStorage.setItem("fp_coins", "0");
      window.alert("Code accepted: coin wallet reset.");
      return;
    }

    if (state.redeemedCodes.includes(code)) {
      window.alert("Code already redeemed.");
      return;
    }

    window.alert("Invalid code.");
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
    state.megaCharge = 0;
    state.megaReadySince = 0;
    state.passivePointTimer = 0;
    state.overDialog = "";
    state.runCoins = 0;
    state.runCoinPointMilestones = 0;
    state.runHundredsBoosts = 0;
    state.coinBreakdown = null;
    state.rewardsApplied = false;
    state.trailTimer = 0;
    state.secondChanceUsedThisRun = false;
    state.forestEvent.active = false;
    state.forestEvent.pending = false;
    state.forestEvent.kind = "";
    state.forestEvent.until = 0;
    state.forestEvent.spawnTimer = 0;
    state.forestEvent.nextSpawnIn = rand(T.forestEventSpawnEveryMin, T.forestEventSpawnEveryMax);
    state.forestEvent.mobs = [];
    state.forestEvent.labelUntil = 0;
    state.forestEvent.nextTriggerScore = debugEarlyEventScore();
    state.cityEvent.active = false;
    state.cityEvent.pending = false;
    state.cityEvent.until = 0;
    state.cityEvent.spawnTimer = 0;
    state.cityEvent.nextSpawnIn = rand(T.cityEventSpawnEveryMin, T.cityEventSpawnEveryMax);
    state.cityEvent.fragments = [];
    state.cityEvent.labelUntil = 0;
    state.cityEvent.nextTriggerScore = debugEarlyEventScore();
    state.rocketEvent.active = false;
    state.rocketEvent.pending = false;
    state.rocketEvent.until = 0;
    state.rocketEvent.spawnTimer = 0;
    state.rocketEvent.nextSpawnIn = rand(T.rocketEventSpawnEveryMin, T.rocketEventSpawnEveryMax);
    state.rocketEvent.coins = [];
    state.rocketEvent.bigCoin = null;
    state.rocketEvent.balloonY = -130;
    state.rocketEvent.ascendUntil = 0;
    state.rocketEvent.labelUntil = 0;
    state.rocketEvent.nextTriggerScore = debugEarlyEventScore();
    state.ponyEvent.active = false;
    state.ponyEvent.pending = false;
    state.ponyEvent.until = 0;
    state.ponyEvent.spawnTimer = 0;
    state.ponyEvent.nextSpawnIn = rand(T.ponyEventSpawnEveryMin, T.ponyEventSpawnEveryMax);
    state.ponyEvent.pickups = [];
    state.ponyEvent.bigCoin = null;
    state.ponyEvent.lettersDone = { "3a": false, "0": false, "3b": false };
    state.ponyEvent.letterOrder = ["3a", "0", "3b"];
    state.ponyEvent.lastLetterSpawnX = 0;
    state.ponyEvent.rainbowPhase = 0;
    state.ponyEvent.labelUntil = 0;
    state.ponyEvent.nextTriggerScore = debugEarlyEventScore();
    state.eventIntro.active = false;
    state.eventIntro.until = 0;
    state.eventIntro.eventKey = "";
    state.eventIntro.title = "";
    state.eventIntro.rules = "";
    stopEventMusic();
    stopThemeMusic();

    state.pipes = [];
    state.collectibles = [];
    state.coins = [];
    state.particles = [];

    state.spawnTimer = 0;
    state.nextPipeId = 1;
    state.rdab.runId = "";
    state.rdab.runStartedAtIso = "";
    state.rdab.submitState = "idle";
    state.rdab.submitMessage = "";
    state.rdab.rewards = [];
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
    state.showHardLockPopup = false;
    state.showNestPopup = false;

    if (!isHardUnlocked()) state.hard = false;

    resetRun();
  }

  function beginTransition() {
    state.mode = "transitioning";
    state.transitionT = 0;
    state.flutterT = 0;
    state.showHardLockPopup = false;
    state.showNestPopup = false;

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
    state.passivePointTimer = 0;
    state.megaReadySince = 0;
    startRunOnRdab();
  }

  function endGame() {
    state.mode = "over";
    endForestEvent();
    endCityEvent();
    endRocketEvent();
    endPonyEvent();
    applyChallengerRunResult();
    recordRunOnLeaderboards();
    state.overDialog = gameOverDialogForScore(state.score);
    applyRunRewardsIfNeeded();
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("fp_best", String(state.best));
    }
    finishRunOnRdab();
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

  function emitTrail() {
    if (state.mode !== "play") return;
    const trail = activeTrailId();
    if (trail === "none") return;
    if (trail === "stardust") {
      for (let i = 0; i < 2; i++) {
        state.particles.push({
          kind: "sparkle",
          x: state.bird.x - 30 + rand(-7, 5),
          y: state.bird.y + rand(-14, 14),
          vx: rand(-110, -42),
          vy: rand(-28, 28),
          life: rand(0.55, 1.0),
          age: 0,
          r: rand(2.8, 5),
        });
      }
      return;
    }
    if (trail === "feather") {
      const burst = chance(0.28) ? 3 : 2;
      for (let i = 0; i < burst; i++) {
        state.particles.push({
          kind: "featherTrail",
          x: state.bird.x - 28 + rand(-7, 3),
          y: state.bird.y + rand(-14, 14),
          vx: rand(-132, -54),
          vy: rand(-40, 38),
          life: rand(0.7, 1.25),
          age: 0,
          r: rand(5, 8),
          rot: rand(-0.6, 0.6),
          vr: rand(-3.2, 3.2),
        });
      }
      return;
    }
    if (trail === "rainbow") {
      const palette = ["#ff5d73", "#ffa94f", "#fff06a", "#7ff57a", "#6ad6ff", "#b17cff"];
      for (let i = 0; i < 2; i++) {
        state.particles.push({
          kind: "rainbowTrail",
          color: palette[Math.floor(Math.random() * palette.length)],
          x: state.bird.x - 30 + rand(-6, 5),
          y: state.bird.y + rand(-14, 14),
          vx: rand(-130, -52),
          vy: rand(-30, 30),
          life: rand(0.6, 1.05),
          age: 0,
          r: rand(3.4, 5.6),
        });
      }
      return;
    }
    if (trail === "ember") {
      for (let i = 0; i < 2; i++) {
        state.particles.push({
          kind: "emberTrail",
          x: state.bird.x - 30 + rand(-6, 5),
          y: state.bird.y + rand(-12, 12),
          vx: rand(-126, -52),
          vy: rand(-44, 36),
          life: rand(0.65, 1.2),
          age: 0,
          r: rand(2.4, 4.5),
        });
      }
      return;
    }
    if (trail === "comet") {
      for (let i = 0; i < 2; i++) {
        state.particles.push({
          kind: "cometTrail",
          x: state.bird.x - 31 + rand(-6, 5),
          y: state.bird.y + rand(-12, 12),
          vx: rand(-140, -66),
          vy: rand(-26, 24),
          life: rand(0.72, 1.25),
          age: 0,
          r: rand(2.8, 4.8),
        });
      }
      return;
    }
    if (trail === "shadow") {
      for (let i = 0; i < 2; i++) {
        state.particles.push({
          kind: "shadowTrail",
          x: state.bird.x - 30 + rand(-7, 5),
          y: state.bird.y + rand(-13, 13),
          vx: rand(-115, -48),
          vy: rand(-28, 28),
          life: rand(0.85, 1.45),
          age: 0,
          r: rand(3.5, 6),
        });
      }
    }
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
      if (p.kind === "featherTrail" || p.kind === "rainbowTrail" || p.kind === "emberTrail" || p.kind === "cometTrail" || p.kind === "shadowTrail") {
        p.vx *= Math.pow(0.45, dt);
        p.vy *= Math.pow(0.45, dt);
      }
      if (p.kind === "featherTrail") {
        p.rot = (p.rot || 0) + (p.vr || 0) * dt;
      }
    }
    state.particles = state.particles.filter((p) => p.age < p.life);
  }

  // ---------- Pipes & collectibles ----------
  function spawnCoinsForPipe(pipeId, pipeX, pipeW, gapY, gapSize) {
    if (state.hard) return;
    const baseX = pipeX + pipeW * 0.5 + rand(-4, 10);
    const baseY = gapY + rand(-gapSize * 0.12, gapSize * 0.12);
    const spawnSingle = chance(T.coinSingleChance);
    const spawnFormation = chance(T.coinFormationChance);
    if (!spawnSingle && !spawnFormation) return;

    if (spawnSingle) {
      state.coins.push({ x: baseX, y: baseY, r: T.coinR, v: 1, taken: false, pipeId });
    }

    if (spawnFormation) {
      const pattern = rollCoinPattern();
      for (const [dx, dy] of pattern) {
        state.coins.push({
          x: baseX + dx,
          y: clamp(baseY + dy, 28, H - T.groundH - 28),
          r: T.coinR,
          v: 1,
          taken: false,
          pipeId,
        });
      }
    }
  }

  function spawnPipe() {
    const gapSize = currentGapSize();
    const topMargin = 90;
    const bottomMargin = T.groundH + 130;

    const gapY = rand(topMargin + gapSize / 2, H - bottomMargin - gapSize / 2);

    const id = state.nextPipeId++;
    const w = pipeWidthForNumber(id);
    state.pipes.push({ x: W + 40, gapY, passed: false, id, w });
    spawnCoinsForPipe(id, W + 40, w, gapY, gapSize);

    if (!state.hard && chance(T.collectibleChancePerPipe)) {
      const typeKey = rollCollectibleType();
      const cx = W + 40 + w / 2 + rand(-8, 8);
      const cy = gapY + rand(-gapSize * 0.2, gapSize * 0.2);
      state.collectibles.push({ x: cx, y: cy, typeKey, r: 15, taken: false, pipeId: id });
    }
  }

  function applyCollectible(typeKey) {
    const c = COLLECTIBLES[typeKey];
    playSfx("pickup", typeKey);

    if (c.score) awardScore(c.score);
    if (c.clearPipes) state.clearQueue += c.clearPipes;

    if (c.invincibleSec) {
      state.invincibleUntil = Math.max(state.invincibleUntil, nowMs() + c.invincibleSec * 1000);
    }

    if (c.megaSec) {
      triggerMegaMode(c.megaSec);
    }
  }

  function scheduleNextForestEvent(baseScore) {
    state.forestEvent.nextTriggerScore = baseScore
      + T.forestEventCooldownScore
      + randInt(T.forestEventWindowMin, T.forestEventWindowMax);
  }

  function maybeStartForestEvent() {
    if (state.hard) return;
    if (state.mode !== "play") return;
    if (activeThemeId() !== "forest") return;
    if (state.forestEvent.active || state.forestEvent.pending || state.eventIntro.active) return;
    if (state.score < state.forestEvent.nextTriggerScore) return;

    const kind = chance(0.5) ? "weedle" : "caterpie";
    state.forestEvent.pending = true;
    state.forestEvent.kind = kind;
    beginEventIntro(
      "forest",
      kind === "weedle" ? "WEEDLE'IN AROUND" : "CATERPIE CRAWLERS",
      kind === "weedle" ? "EAT WEEDLE. DODGE EKANS." : "EAT CATERPIE. DODGE EKANS."
    );
    scheduleNextForestEvent(state.score);
  }

  function activateForestEvent() {
    state.forestEvent.pending = false;
    state.forestEvent.active = true;
    state.forestEvent.until = nowMs() + randInt(T.forestEventDurationMin, T.forestEventDurationMax) * 1000;
    state.forestEvent.spawnTimer = 0;
    state.forestEvent.nextSpawnIn = rand(T.forestEventSpawnEveryMin, T.forestEventSpawnEveryMax);
    state.forestEvent.mobs = [];
    state.forestEvent.labelUntil = nowMs() + 2400;
    state.spawnTimer = 0;
    state.pipes = [];
    state.collectibles = [];
    state.coins = [];
    startEventMusic("forest");
  }

  function endForestEvent() {
    state.forestEvent.active = false;
    state.forestEvent.pending = false;
    state.forestEvent.kind = "";
    state.forestEvent.until = 0;
    state.forestEvent.spawnTimer = 0;
    state.forestEvent.nextSpawnIn = rand(T.forestEventSpawnEveryMin, T.forestEventSpawnEveryMax);
    state.forestEvent.mobs = [];
    stopEventMusic();
  }

  function spawnForestEventMob(speed) {
    const isEkans = chance(T.forestEventEkansChance);
    const kind = isEkans ? "ekans" : state.forestEvent.kind;
    const y = rand(70, H - T.groundH - 70);
    state.forestEvent.mobs.push({
      kind,
      x: W + rand(28, 96),
      y,
      vx: -speed * rand(T.forestEventMobSpeedMin, T.forestEventMobSpeedMax),
      vy: rand(-28, 28),
      r: kind === "ekans" ? 22 * T.forestEventEkansScale : 18,
      taken: false,
    });
  }

  function updateForestEvent(dt, b, hitRx, hitRy) {
    maybeStartForestEvent();
    if (state.forestEvent.pending && !state.eventIntro.active) activateForestEvent();
    if (!state.forestEvent.active) return false;

    if (nowMs() >= state.forestEvent.until) {
      endForestEvent();
      return false;
    }

    state.forestEvent.spawnTimer += dt;
    if (state.forestEvent.spawnTimer >= state.forestEvent.nextSpawnIn) {
      state.forestEvent.spawnTimer = 0;
      state.forestEvent.nextSpawnIn = rand(T.forestEventSpawnEveryMin, T.forestEventSpawnEveryMax);
      spawnForestEventMob(pipeSpeed());
    }

    for (const m of state.forestEvent.mobs) {
      if (m.taken) continue;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < 46 || m.y > H - T.groundH - 42) m.vy *= -1;

      const hitsBird = ellipseRect(
        b.x, b.y, hitRx, hitRy,
        m.x - m.r * 0.9, m.y - m.r * 0.8, m.r * 1.8, m.r * 1.6
      );
      if (!hitsBird) continue;

      m.taken = true;
      if (m.kind === "ekans") {
        endGame();
        return true;
      }
      awardScore(T.forestEventRewardScore);
      addRunCoins(T.forestEventRewardCoins, m.x, m.y - 28);
      playSfx("coin");
      floatText(m.x, m.y - 14, `+${T.forestEventRewardScore} +${T.forestEventRewardCoins}c`);
      poof(m.x, m.y, 14);
    }

    state.forestEvent.mobs = state.forestEvent.mobs.filter((m) => !m.taken && m.x + 40 > -80);
    return false;
  }

  function scheduleNextCityEvent(baseScore) {
    state.cityEvent.nextTriggerScore = baseScore
      + T.cityEventCooldownScore
      + randInt(T.cityEventWindowMin, T.cityEventWindowMax);
  }

  function maybeStartCityEvent() {
    if (state.hard) return;
    if (state.mode !== "play") return;
    if (activeThemeId() !== "city") return;
    if (state.cityEvent.active || state.cityEvent.pending || state.eventIntro.active) return;
    if (state.score < state.cityEvent.nextTriggerScore) return;

    state.cityEvent.pending = true;
    beginEventIntro("city", "MEGA MADNESS", "GRAB FRAGMENTS. CHARGE MEGA.");
    scheduleNextCityEvent(state.score);
  }

  function activateCityEvent() {
    state.cityEvent.pending = false;
    state.cityEvent.active = true;
    state.cityEvent.until = nowMs() + T.cityEventDurationSec * 1000;
    state.cityEvent.spawnTimer = 0;
    state.cityEvent.nextSpawnIn = rand(T.cityEventSpawnEveryMin, T.cityEventSpawnEveryMax);
    state.cityEvent.fragments = [];
    state.cityEvent.labelUntil = nowMs() + 2200;
    state.clearQueue += 2;
    state.pipes = [];
    state.collectibles = [];
    state.coins = [];
    state.spawnTimer = 0;
    startEventMusic("city");
  }

  function endCityEvent() {
    state.cityEvent.active = false;
    state.cityEvent.pending = false;
    state.cityEvent.until = 0;
    state.cityEvent.spawnTimer = 0;
    state.cityEvent.nextSpawnIn = rand(T.cityEventSpawnEveryMin, T.cityEventSpawnEveryMax);
    state.cityEvent.fragments = [];
    stopEventMusic();
  }

  function spawnCityEventFragment(speed) {
    state.cityEvent.fragments.push({
      x: W + rand(32, 120),
      y: rand(70, H - T.groundH - 70),
      vx: -speed * rand(0.92, 1.18),
      vy: rand(-18, 18),
      r: 13,
      taken: false,
    });
  }

  function updateCityEvent(dt, b) {
    maybeStartCityEvent();
    if (state.cityEvent.pending && !state.eventIntro.active) activateCityEvent();
    if (!state.cityEvent.active) return;
    if (nowMs() >= state.cityEvent.until) {
      endCityEvent();
      return;
    }

    state.cityEvent.spawnTimer += dt;
    if (state.cityEvent.spawnTimer >= state.cityEvent.nextSpawnIn) {
      state.cityEvent.spawnTimer = 0;
      state.cityEvent.nextSpawnIn = rand(T.cityEventSpawnEveryMin, T.cityEventSpawnEveryMax);
      spawnCityEventFragment(pipeSpeed());
    }

    for (const f of state.cityEvent.fragments) {
      if (f.taken) continue;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y < 44 || f.y > H - T.groundH - 42) f.vy *= -1;
      if (circleCircle(b.x, b.y, b.r * 0.6, f.x, f.y, f.r)) {
        f.taken = true;
        addMegaCharge(T.cityEventMegaGain);
        addRunCoins(T.cityEventCoinGain, f.x, f.y - 22);
        playSfx("coin");
        floatText(f.x, f.y - 12, `+${T.cityEventMegaGain} MEGA +${T.cityEventCoinGain}c`);
      }
    }
    state.cityEvent.fragments = state.cityEvent.fragments.filter((f) => !f.taken && f.x + f.r > -70);
  }

  function scheduleNextRocketEvent(baseScore) {
    state.rocketEvent.nextTriggerScore = baseScore
      + T.rocketEventCooldownScore
      + randInt(T.rocketEventWindowMin, T.rocketEventWindowMax);
  }

  function rocketBalloonPos() {
    const bob = (state.rocketEvent.active ? Math.sin(nowMs() / 260) * 58 : 0);
    return {
      x: W * 0.74 + Math.sin(nowMs() / 380) * 8,
      y: state.rocketEvent.balloonY + bob,
    };
  }

  function maybeStartRocketEvent() {
    if (state.hard) return;
    if (state.mode !== "play") return;
    if (activeThemeId() !== "rocket") return;
    if (state.rocketEvent.active || state.rocketEvent.pending || state.eventIntro.active) return;
    if (state.score < state.rocketEvent.nextTriggerScore) return;

    state.rocketEvent.pending = true;
    beginEventIntro("rocket", "TEAM ROCKET RAID", "FOLLOW COINS. HIT BIG DROP.");
    scheduleNextRocketEvent(state.score);
  }

  function activateRocketEvent() {
    state.rocketEvent.pending = false;
    state.rocketEvent.active = true;
    state.rocketEvent.until = nowMs() + T.rocketEventDurationSec * 1000;
    state.rocketEvent.spawnTimer = 0;
    state.rocketEvent.nextSpawnIn = rand(T.rocketEventSpawnEveryMin, T.rocketEventSpawnEveryMax);
    state.rocketEvent.coins = [];
    state.rocketEvent.bigCoin = null;
    state.rocketEvent.balloonY = -130;
    state.rocketEvent.ascendUntil = 0;
    state.rocketEvent.labelUntil = nowMs() + 2200;
    state.spawnTimer = 0;
    state.pipes = [];
    state.collectibles = [];
    state.coins = [];
    startEventMusic("rocket");
  }

  function endRocketEvent() {
    state.rocketEvent.active = false;
    state.rocketEvent.pending = false;
    state.rocketEvent.until = 0;
    state.rocketEvent.spawnTimer = 0;
    state.rocketEvent.nextSpawnIn = rand(T.rocketEventSpawnEveryMin, T.rocketEventSpawnEveryMax);
    state.rocketEvent.coins = [];
    state.rocketEvent.bigCoin = null;
    state.rocketEvent.balloonY = -130;
    state.rocketEvent.ascendUntil = 0;
    stopEventMusic();
  }

  function spawnRocketTrailCoin(speed) {
    const b = rocketBalloonPos();
    state.rocketEvent.coins.push({
      x: b.x - 18 + rand(-6, 6),
      y: b.y + 58 + rand(-12, 12),
      vx: -speed * rand(0.86, 1.08),
      vy: rand(-12, 12),
      r: 11,
      rewardCoins: T.rocketEventCoinCoins,
      rewardScore: T.rocketEventCoinScore,
      rewardMega: 0,
      taken: false,
      big: false,
    });
  }

  function spawnRocketBigCoin(speed) {
    const b = rocketBalloonPos();
    state.rocketEvent.bigCoin = {
      x: b.x - 10,
      y: b.y + 58,
      vx: -speed * 0.8,
      vy: -20,
      r: 18,
      rewardCoins: T.rocketEventBigCoins,
      rewardScore: T.rocketEventBigScore,
      rewardMega: T.rocketEventBigMega,
      taken: false,
      big: true,
    };
    floatText(b.x, b.y + 34, "BIG COIN DROP!");
  }

  function updateRocketEvent(dt, b) {
    maybeStartRocketEvent();
    if (state.rocketEvent.pending && !state.eventIntro.active) activateRocketEvent();
    const hasBalloon = state.rocketEvent.active || nowMs() < state.rocketEvent.ascendUntil;
    if (!hasBalloon && state.rocketEvent.coins.length === 0 && !state.rocketEvent.bigCoin) return;

    if (state.rocketEvent.active) {
      state.rocketEvent.balloonY += (H * 0.48 - state.rocketEvent.balloonY) * Math.min(1, dt * 2.8);

      state.rocketEvent.spawnTimer += dt;
      if (state.rocketEvent.spawnTimer >= state.rocketEvent.nextSpawnIn) {
        state.rocketEvent.spawnTimer = 0;
        state.rocketEvent.nextSpawnIn = rand(T.rocketEventSpawnEveryMin, T.rocketEventSpawnEveryMax);
        spawnRocketTrailCoin(pipeSpeed());
      }

      if (nowMs() >= state.rocketEvent.until) {
        state.rocketEvent.active = false;
        state.rocketEvent.ascendUntil = nowMs() + 2.3 * 1000;
        spawnRocketBigCoin(pipeSpeed());
        stopEventMusic();
      }
    } else if (nowMs() < state.rocketEvent.ascendUntil) {
      state.rocketEvent.balloonY -= 180 * dt;
    }

    for (const c of state.rocketEvent.coins) {
      if (c.taken) continue;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.y < 50 || c.y > H - T.groundH - 44) c.vy *= -1;
      if (circleCircle(b.x, b.y, b.r * 0.6, c.x, c.y, c.r)) {
        c.taken = true;
        awardScore(c.rewardScore);
        addRunCoins(c.rewardCoins, c.x, c.y - 22);
        playSfx("coin");
        if (c.rewardMega) addMegaCharge(c.rewardMega);
        floatText(c.x, c.y - 14, `+${c.rewardScore} +${c.rewardCoins}c`);
      }
    }
    state.rocketEvent.coins = state.rocketEvent.coins.filter((c) => !c.taken && c.x + c.r > -70);

    const bc = state.rocketEvent.bigCoin;
    if (bc && !bc.taken) {
      bc.x += bc.vx * dt;
      bc.vy += 90 * dt;
      bc.y += bc.vy * dt;
      if (bc.y > H - T.groundH - 30) {
        bc.y = H - T.groundH - 30;
        bc.vy *= -0.35;
      }
      if (circleCircle(b.x, b.y, b.r * 0.65, bc.x, bc.y, bc.r)) {
        bc.taken = true;
        awardScore(bc.rewardScore);
        addRunCoins(bc.rewardCoins, bc.x, bc.y - 22);
        playSfx("coin");
        addMegaCharge(bc.rewardMega);
        floatText(bc.x, bc.y - 18, `+${bc.rewardScore} +${bc.rewardCoins}c +${bc.rewardMega} MEGA`);
      }
      if (bc.x + bc.r < -80 || bc.taken) state.rocketEvent.bigCoin = null;
    }
  }

  function scheduleNextPonyEvent(baseScore) {
    state.ponyEvent.nextTriggerScore = baseScore
      + T.ponyEventCooldownScore
      + randInt(T.ponyEventWindowMin, T.ponyEventWindowMax);
  }

  function rainbowYAtX(x, phase) {
    const t = (x + phase) * 0.018;
    return H * 0.52 + Math.sin(t) * 74;
  }

  function maybeStartPonyEvent() {
    if (state.hard) return;
    if (state.mode !== "play") return;
    if (activeThemeId() !== "pony") return;
    if (state.ponyEvent.active || state.ponyEvent.pending || state.eventIntro.active) return;
    if (state.score < state.ponyEvent.nextTriggerScore) return;

    state.ponyEvent.pending = true;
    beginEventIntro("pony", "WOODS TO THE EAST!", "RIDE RAINBOW. BUILD 3-0-3.");
    scheduleNextPonyEvent(state.score);
  }

  function activatePonyEvent() {
    state.ponyEvent.pending = false;
    state.ponyEvent.active = true;
    state.ponyEvent.until = nowMs() + T.ponyEventDurationSec * 1000;
    state.ponyEvent.spawnTimer = 0;
    state.ponyEvent.nextSpawnIn = rand(T.ponyEventSpawnEveryMin, T.ponyEventSpawnEveryMax);
    state.ponyEvent.pickups = [];
    state.ponyEvent.bigCoin = null;
    state.ponyEvent.lettersDone = { "3a": false, "0": false, "3b": false };
    state.ponyEvent.letterOrder = ["3a", "0", "3b"];
    state.ponyEvent.lastLetterSpawnX = 0;
    state.ponyEvent.rainbowPhase = 0;
    state.ponyEvent.labelUntil = nowMs() + 2500;
    state.spawnTimer = 0;
    state.pipes = [];
    state.collectibles = [];
    state.coins = [];
    startEventMusic("pony");
  }

  function endPonyEvent() {
    state.ponyEvent.active = false;
    state.ponyEvent.pending = false;
    state.ponyEvent.until = 0;
    state.ponyEvent.spawnTimer = 0;
    state.ponyEvent.nextSpawnIn = rand(T.ponyEventSpawnEveryMin, T.ponyEventSpawnEveryMax);
    state.ponyEvent.pickups = [];
    state.ponyEvent.bigCoin = null;
    state.ponyEvent.rainbowPhase = 0;
    stopEventMusic();
  }

  function spawnPonyPickup(speed) {
    const x = W + rand(34, 120);
    const yOnRainbow = rainbowYAtX(x, state.ponyEvent.rainbowPhase);
    const y = yOnRainbow + rand(-12, 12);
    let kind = chance(0.58) ? "coin" : "fragment";
    if (state.ponyEvent.letterOrder.length > 0 && chance(0.12)) kind = "letter";
    if (kind === "letter") {
      const key = state.ponyEvent.letterOrder.shift();
      const label = key === "3a" ? "3" : key === "0" ? "0" : "3";
      const lx = Math.max(x + rand(40, 80), state.ponyEvent.lastLetterSpawnX + 120);
      state.ponyEvent.lastLetterSpawnX = lx;
      const side = chance(0.5) ? -1 : 1;
      const ly = yOnRainbow + side * rand(55, 110);
      state.ponyEvent.pickups.push({
        kind: "letter",
        key,
        label,
        x: lx,
        y: clamp(ly, 62, H - T.groundH - 62),
        vx: -speed * rand(0.8, 1.0),
        vy: rand(-10, 10),
        r: 24,
        taken: false,
      });
      return;
    }
    state.ponyEvent.pickups.push({
      kind,
      x,
      y,
      vx: -speed * rand(0.9, 1.14),
      vy: rand(-16, 16),
      r: kind === "fragment" ? 13 : 11,
      taken: false,
    });
  }

  function spawnPonyBigCoin(speed) {
    const x = W + 64;
    const y = rainbowYAtX(x, state.ponyEvent.rainbowPhase) - 10;
    state.ponyEvent.bigCoin = {
      x,
      y,
      vx: -speed * 0.82,
      vy: -18,
      r: 19,
      taken: false,
    };
    floatText(x, y - 20, "POT OF GOLD!");
  }

  function pony303Complete() {
    return state.ponyEvent.lettersDone["3a"]
      && state.ponyEvent.lettersDone["0"]
      && state.ponyEvent.lettersDone["3b"];
  }

  function updatePonyEvent(dt, b) {
    maybeStartPonyEvent();
    if (state.ponyEvent.pending && !state.eventIntro.active) activatePonyEvent();
    if (!state.ponyEvent.active && !state.ponyEvent.bigCoin && state.ponyEvent.pickups.length === 0) return;

    if (state.ponyEvent.active) {
      state.ponyEvent.rainbowPhase += dt * 160;
      state.ponyEvent.spawnTimer += dt;
      if (state.ponyEvent.spawnTimer >= state.ponyEvent.nextSpawnIn) {
        state.ponyEvent.spawnTimer = 0;
        state.ponyEvent.nextSpawnIn = rand(T.ponyEventSpawnEveryMin, T.ponyEventSpawnEveryMax);
        spawnPonyPickup(pipeSpeed());
      }
      if (nowMs() >= state.ponyEvent.until) {
        state.ponyEvent.active = false;
        spawnPonyBigCoin(pipeSpeed());
        stopEventMusic();
      }
    }

    for (const p of state.ponyEvent.pickups) {
      if (p.taken) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < 42 || p.y > H - T.groundH - 40) p.vy *= -1;
      if (!circleCircle(b.x, b.y, b.r * 0.6, p.x, p.y, p.r)) continue;
      p.taken = true;
      if (p.kind === "coin") {
        awardScore(T.ponyEventCoinScore);
        addRunCoins(T.ponyEventCoinCoins, p.x, p.y - 22);
        playSfx("coin");
        floatText(p.x, p.y - 12, `+${T.ponyEventCoinScore} +${T.ponyEventCoinCoins}c`);
      } else if (p.kind === "fragment") {
        addMegaCharge(T.ponyEventFragMega);
        floatText(p.x, p.y - 12, `+${T.ponyEventFragMega} MEGA`);
      } else if (p.kind === "letter") {
        state.ponyEvent.lettersDone[p.key] = true;
        floatText(p.x, p.y - 12, p.label);
        if (pony303Complete()) {
          triggerMegaMode();
          awardScore(T.ponyEvent303Score);
          addRunCoins(T.ponyEvent303Coins, p.x, p.y - 36);
          playSfx("coin");
          floatText(b.x + 24, b.y - 30, "303! MEGA +3 +3c");
        }
      }
    }
    state.ponyEvent.pickups = state.ponyEvent.pickups.filter((p) => !p.taken && p.x + p.r > -70);

    const big = state.ponyEvent.bigCoin;
    if (big && !big.taken) {
      big.x += big.vx * dt;
      big.vy += 80 * dt;
      big.y += big.vy * dt;
      if (big.y > H - T.groundH - 28) {
        big.y = H - T.groundH - 28;
        big.vy *= -0.38;
      }
      if (circleCircle(b.x, b.y, b.r * 0.65, big.x, big.y, big.r)) {
        big.taken = true;
        awardScore(T.ponyEventBigScore);
        addRunCoins(T.ponyEventBigCoins, bc.x, bc.y - 24);
        playSfx("coin");
        addMegaCharge(T.ponyEventBigMega);
        floatText(big.x, big.y - 20, `+${T.ponyEventBigScore} +${T.ponyEventBigCoins}c +${T.ponyEventBigMega} MEGA`);
      }
      if (big.taken || big.x + big.r < -80) {
        state.ponyEvent.bigCoin = null;
      }
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

  function ellipseRect(cx, cy, erx, ery, rx, ry, rw, rh) {
    // Scale into unit-space so ellipse-vs-rect becomes circle-vs-rect.
    return circleRect(cx / erx, cy / ery, 1, rx / erx, ry / ery, rw / erx, rh / ery);
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

  function hitMegaMeter(x, y) {
    if (state.mode !== "play") return false;
    const mx = W / 2;
    const my = H - T.groundH - 38;
    const dx = x - mx;
    const dy = y - my;
    return dx * dx + dy * dy <= T.megaMeterTapRadius * T.megaMeterTapRadius;
  }

  function hitButton(x, y) {
    for (let i = state.buttons.length - 1; i >= 0; i--) {
      const b = state.buttons[i];
      if (!b.enabled) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const ac = ensureAudioCtx();
    if (ac && ac.state === "suspended") ac.resume();
    const p = pointerToCanvas(e);

    const canPressButtons = state.mode === "menu" || state.mode === "help" || state.mode === "store" || state.mode === "leaderboards" || state.mode === "over";
    if (canPressButtons) {
      const b = hitButton(p.x, p.y);
      if (b) {
        b.onClick?.();
        return;
      }
    }

    if (state.mode === "store") {
      const m = activeStoreScrollMetrics();
      if (!m) return;
      if (p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h) {
        state.dragThemeScroll = true;
        state.dragThemeLastY = p.y;
        state.dragPointerId = e.pointerId;
        return;
      }
    }

    if (hitMegaMeter(p.x, p.y) && tryActivateChargedMega()) {
      return;
    }

    // tap to flap only during play
    flap();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!state.dragThemeScroll || state.dragPointerId !== e.pointerId) return;
    const p = pointerToCanvas(e);
    const dy = p.y - state.dragThemeLastY;
    state.dragThemeLastY = p.y;
    if (state.storeTab === "themes") state.storeThemeScroll = Math.max(0, state.storeThemeScroll - dy);
    else if (state.storeTab === "trails") state.storeTrailScroll = Math.max(0, state.storeTrailScroll - dy);
    else if (state.storeTab === "merch") state.storeMerchScroll = Math.max(0, state.storeMerchScroll - dy);
    clampActiveStoreScroll();
  });

  function endThemeDrag(pointerId) {
    if (!state.dragThemeScroll) return;
    if (state.dragPointerId !== pointerId) return;
    state.dragThemeScroll = false;
    state.dragPointerId = null;
  }
  canvas.addEventListener("pointerup", (e) => endThemeDrag(e.pointerId));
  canvas.addEventListener("pointercancel", (e) => endThemeDrag(e.pointerId));

  canvas.addEventListener("wheel", (e) => {
    if (state.mode !== "store") return;
    const p = pointerToCanvas(e);
    const m = activeStoreScrollMetrics();
    if (!m) return;
    if (p.x < m.x || p.x > m.x + m.w || p.y < m.y || p.y > m.y + m.h) return;
    e.preventDefault();
    if (state.storeTab === "themes") state.storeThemeScroll += e.deltaY * 0.75;
    else if (state.storeTab === "trails") state.storeTrailScroll += e.deltaY * 0.75;
    else if (state.storeTab === "merch") state.storeMerchScroll += e.deltaY * 0.75;
    clampActiveStoreScroll();
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    const ac = ensureAudioCtx();
    if (ac && ac.state === "suspended") ac.resume();
    if (e.code === "Space") {
      e.preventDefault();
      if (tryActivateChargedMega()) return;
      if (state.mode === "play") flap();
    }
    if (e.code === "ArrowUp") {
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
    updateBackgroundMusic();
    const frameDur = 1 / state.anim.fps;
    while (state.anim.time >= frameDur) {
      state.anim.time -= frameDur;
      state.anim.frame = (state.anim.frame + 1) % T.frames;
    }

    // Mega sparkle trail always while mega
    if (!state.hard && isMega()) {
      for (let i = 0; i < 2; i++) sparkle(state.bird.x - 26, state.bird.y + rand(-12, 12));
    }

    updateParticles(dt);

    // Menu/help idle bounce
    if (state.mode === "menu" || state.mode === "help") {
      const b = state.bird;
      const hoverX = W * 0.68 + Math.sin(nowMs() / 480) * 10;
      b.x += (hoverX - b.x) * Math.min(1, dt * 3.2);
      const menuGravity = state.hard ? T.gravityHard : T.gravityEasy;
      b.vy += (menuGravity * 0.35) * dt;
      b.vy = clamp(b.vy, -700, 500);
      b.y += b.vy * dt;

      const top = H * 0.22;
      const bot = H * 0.42;
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
    if (state.eventIntro.active) {
      if (nowMs() >= state.eventIntro.until) {
        state.eventIntro.active = false;
      } else {
        const hoverY = H * 0.45;
        b.y += (hoverY - b.y) * Math.min(1, dt * 8);
        b.vy = 0;
        b.angle += (0 - b.angle) * Math.min(1, dt * 12);
        state.flutterT += dt;
        if (state.flutterT >= 0.22) {
          state.flutterT = 0;
          state.anim.time = 0;
          state.anim.fps = T.fpsFlapBurst;
          clearTimeout(flap._t);
          flap._t = setTimeout(() => (state.anim.fps = T.fpsBase), 180);
        }
        return;
      }
    }

    const trailTick = activeTrailId() === "none" ? 0.06 : 0.032;
    state.trailTimer += dt;
    while (state.trailTimer >= trailTick) {
      state.trailTimer -= trailTick;
      emitTrail();
    }

    if (!state.hard && isMegaChargeReady() && state.megaReadySince > 0) {
      if (nowMs() - state.megaReadySince >= T.megaChargeAutoFireSec * 1000) {
        tryActivateChargedMega();
      }
    }

    if (!state.hard) {
      state.passivePointTimer += dt;
      while (state.passivePointTimer >= T.passivePointSec) {
        state.passivePointTimer -= T.passivePointSec;
        awardScore(1);
        floatText(b.x + 14, b.y - 22, "+1");
      }
    }

    // mega hitbox
    b.r = isMega() ? T.birdRadius * 4 : T.birdRadius;
    const hitRx = isMega() ? T.birdHitboxX * 4 : T.birdHitboxX;
    const hitRy = isMega() ? T.birdHitboxY * 4 : T.birdHitboxY;

    // physics
    const gravity = state.hard ? T.gravityHard : T.gravityEasy;
    const maxFall = state.hard ? T.maxFallHard : T.maxFallEasy;
    b.vy += gravity * dt;
    b.vy = clamp(b.vy, -2000, maxFall);
    b.y += b.vy * dt;

    // tilt
    const target = clamp(b.vy / 900, -0.7, 1.0);
    b.angle += (target - b.angle) * Math.min(1, dt * 10);

    const groundY = H - T.groundH;
    const ceiling = 18;

    if (b.y - hitRy < ceiling) {
      b.y = ceiling + hitRy;
      endGame();
      return;
    }

    if (b.y + hitRy > groundY) {
      b.y = groundY - hitRy;
      endGame();
      return;
    }

    if (updateForestEvent(dt, b, hitRx, hitRy)) return;
    updateCityEvent(dt, b);
    updateRocketEvent(dt, b);
    updatePonyEvent(dt, b);

    // spawn pipes
    if (!state.forestEvent.active && !state.rocketEvent.active && !state.ponyEvent.active) {
      state.spawnTimer += dt;
      const spawnEvery = currentSpawnEvery();
      if (state.spawnTimer >= spawnEvery) {
        state.spawnTimer = 0;
        spawnPipe();
      }
    }

    // move entities
    const speed = pipeSpeed();
    for (const p of state.pipes) p.x -= speed * dt;
    for (const c of state.collectibles) c.x -= speed * dt;
    for (const coin of state.coins) coin.x -= speed * dt;

    // cleanup offscreen
    state.pipes = state.pipes.filter((p) => p.x + p.w > -80);

    // collectibles tied to live pipes only
    const alivePipeIds = new Set(state.pipes.map((p) => p.id));
    state.collectibles = state.collectibles.filter(
      (c) => !c.taken && c.x + 40 > -80 && alivePipeIds.has(c.pipeId)
    );
    state.coins = state.coins.filter(
      (coin) => !coin.taken && coin.x + coin.r > -80 && alivePipeIds.has(coin.pipeId)
    );

    // clear queue (berries/mega)
    if (state.clearQueue > 0 && state.pipes.length > 0) {
      const next = state.pipes[0];
      if (next && next.x < W * 0.70) {
        poof(next.x + next.w / 2, next.gapY, 30);
        if (!next.passed) awardScore(1);
        state.collectibles = state.collectibles.filter((c) => c.pipeId !== next.id);
        state.coins = state.coins.filter((coin) => coin.pipeId !== next.id);
        state.pipes.shift();
        state.clearQueue--;
      }
    }

    // collisions + scoring
    if (!state.forestEvent.active) {
      const gapSize = currentGapSize();
      for (let i = 0; i < state.pipes.length; i++) {
        const p = state.pipes[i];
        const x = p.x;
        const w = p.w;
        const gapTop = p.gapY - gapSize / 2;
        const gapBot = p.gapY + gapSize / 2;

        if (!p.passed && x + w < b.x) {
          p.passed = true;
          awardScore(1);
        }

        const topRect = { x, y: 0, w, h: gapTop };
        const botRect = { x, y: gapBot, w, h: groundY - gapBot };

        const hit =
          ellipseRect(b.x, b.y, hitRx, hitRy, topRect.x, topRect.y, topRect.w, topRect.h) ||
          ellipseRect(b.x, b.y, hitRx, hitRy, botRect.x, botRect.y, botRect.w, botRect.h);

        if (hit) {
          if (isMega()) {
            // smash pipe
            poof(x + w / 2, p.gapY, 34);
            state.collectibles = state.collectibles.filter((c) => c.pipeId !== p.id);
            state.coins = state.coins.filter((coin) => coin.pipeId !== p.id);
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
    }

    // coin pickup
    for (const coin of state.coins) {
      if (coin.taken) continue;
      if (circleCircle(b.x, b.y, b.r * 0.6, coin.x, coin.y, coin.r)) {
        coin.taken = true;
        addRunCoins(coin.v, coin.x, coin.y - 24);
        playSfx("coin");
        floatText(coin.x, coin.y - 14, `+${coin.v} COIN`);
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

  function drawPixelRect(x, y, w, h, c) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = c.outer;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c.border;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = c.inner;
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.fillStyle = c.highlight;
    ctx.fillRect(x + 6, y + 6, w - 12, Math.max(4, Math.floor((h - 12) * 0.35)));

    ctx.restore();
  }

  function drawLockIcon(cx, cy, scale = 1) {
    const w = 10 * scale;
    const h = 8 * scale;
    const r = 4 * scale;

    ctx.save();
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.strokeStyle = "rgba(255, 250, 210, 0.95)";
    ctx.beginPath();
    ctx.arc(cx, cy - 2 * scale, r, Math.PI, 0);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 250, 210, 0.95)";
    ctx.fillRect(cx - w / 2, cy, w, h);
    ctx.restore();
  }

  function drawPopupBackdrop(alpha = 0.60) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawThemedPopupFrame(x, y, w, h, title) {
    drawCard(x, y, w, h, 18, "rgba(15, 38, 18, 0.96)", "rgba(176, 239, 127, 0.85)");
    ctx.fillStyle = "rgba(240, 255, 203, 0.98)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 22px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText(title, x + w / 2, y + 36);
  }

  function drawButton(x, y, w, h, label, enabled, onClick) {
    state.buttons.push({ x, y, w, h, enabled, onClick });

    if (enabled) {
      drawPixelRect(x, y, w, h, {
        outer: "#1a6f25",
        border: "#2ea23e",
        inner: "#f0d34b",
        highlight: "#fff4bf",
      });
      ctx.fillStyle = "#24410f";
    } else {
      drawPixelRect(x, y, w, h, {
        outer: "rgba(31, 76, 39, 0.55)",
        border: "rgba(66, 124, 72, 0.50)",
        inner: "rgba(160, 163, 122, 0.45)",
        highlight: "rgba(255, 255, 220, 0.20)",
      });
      ctx.fillStyle = "rgba(19, 38, 13, 0.55)";
    }

    ctx.font = "900 16px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  }

  function drawAvatar(url, x, y, size) {
    const im = avatarImage(url);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    if (im && im.complete && im.naturalWidth > 0) {
      ctx.drawImage(im, x, y, size, size);
    } else {
      ctx.fillStyle = "rgba(232, 242, 196, 0.9)";
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = "rgba(45, 75, 29, 0.9)";
      ctx.font = "900 11px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("RD", x + size / 2, y + size / 2);
    }
    ctx.restore();
  }

  function drawWrappedText(text, x, y, maxW, lineH, maxLines = 3) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxW) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lineH);
    }
    return y + lines.length * lineH;
  }

  function drawThemeBackdrop(themeId, x, y, w, h, timeSec, animated = true) {
    const m = THEME_META[themeId] || THEME_META.classic;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, m.skyTop);
    grad.addColorStop(1, m.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    if (!m.move || !animated) {
      if (themeId === "classic") {
        ctx.fillStyle = "rgba(255,255,255,0.42)";
        ctx.fillRect(x + 36, y + 72, w * 0.24, 30);
        ctx.fillRect(x + w * 0.58, y + 126, w * 0.3, 36);
      }
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    if (themeId === "forest") {
      const hillTile = 190;
      const hillOffset = (timeSec * 16) % hillTile;
      ctx.fillStyle = "rgba(79, 146, 82, 0.66)";
      for (let i = -1; i < Math.ceil(w / hillTile) + 2; i++) {
        const bx = x + i * hillTile - hillOffset;
        ctx.beginPath();
        ctx.moveTo(bx, y + h * 0.72);
        ctx.lineTo(bx + hillTile * 0.5, y + h * 0.44);
        ctx.lineTo(bx + hillTile, y + h * 0.72);
        ctx.closePath();
        ctx.fill();
      }
      const treeTile = 96;
      const treeOffset = (timeSec * 36) % treeTile;
      for (let i = -1; i < Math.ceil(w / treeTile) + 2; i++) {
        const tx = x + i * treeTile - treeOffset;
        ctx.fillStyle = "rgba(44, 90, 36, 0.9)";
        ctx.fillRect(tx + 34, y + h * 0.54, 10, h * 0.2);
        ctx.fillStyle = "rgba(73, 166, 68, 0.95)";
        ctx.fillRect(tx + 18, y + h * 0.46, 44, 26);
        ctx.fillRect(tx + 22, y + h * 0.39, 36, 18);
      }
    } else if (themeId === "city") {
      const farTile = 150;
      const farOffset = (timeSec * 20) % farTile;
      ctx.fillStyle = "rgba(54, 73, 104, 0.56)";
      for (let i = -1; i < Math.ceil(w / farTile) + 2; i++) {
        const bx = x + i * farTile - farOffset;
        const bh = 56 + (i % 3) * 22;
        ctx.fillRect(bx, y + h * 0.74 - bh, 54, bh);
      }
      const nearTile = 100;
      const nearOffset = (timeSec * 42) % nearTile;
      for (let i = -1; i < Math.ceil(w / nearTile) + 2; i++) {
        const bx = x + i * nearTile - nearOffset;
        const bh = 70 + (i % 4) * 16;
        ctx.fillStyle = "rgba(33, 47, 74, 0.94)";
        ctx.fillRect(bx, y + h * 0.82 - bh, 44, bh);
        ctx.fillStyle = "rgba(255, 235, 148, 0.7)";
        for (let wx = 0; wx < 3; wx++) {
          for (let wy = 0; wy < 5; wy++) {
            if ((wx + wy + i) % 2 === 0) ctx.fillRect(bx + 5 + wx * 12, y + h * 0.82 - bh + 8 + wy * 12, 5, 6);
          }
        }
      }
    } else if (themeId === "rocket") {
      const stripeTile = 180;
      const stripeOffset = (timeSec * 54) % stripeTile;
      for (let i = -1; i < Math.ceil(w / stripeTile) + 2; i++) {
        const sx = x + i * stripeTile - stripeOffset;
        ctx.fillStyle = "rgba(120, 42, 70, 0.55)";
        ctx.fillRect(sx, y + h * 0.26, stripeTile - 12, 16);
        ctx.fillRect(sx + 12, y + h * 0.56, stripeTile - 18, 12);
      }
      ctx.fillStyle = "rgba(255, 73, 112, 0.16)";
      for (let i = 0; i < 5; i++) {
        const beamX = x + ((timeSec * 38 + i * 102) % (w + 80)) - 40;
        ctx.fillRect(beamX, y, 14, h);
      }
    } else if (themeId === "pony") {
      const cloudTile = 160;
      const cloudOffset = (timeSec * 30) % cloudTile;
      for (let i = -1; i < Math.ceil(w / cloudTile) + 2; i++) {
        const cx = x + i * cloudTile - cloudOffset;
        ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
        ctx.fillRect(cx + 28, y + h * 0.28, 56, 18);
        ctx.fillRect(cx + 16, y + h * 0.32, 84, 16);
      }
      const sparkleTile = 90;
      const sparkleOffset = (timeSec * 44) % sparkleTile;
      for (let i = -1; i < Math.ceil(w / sparkleTile) + 2; i++) {
        const sx = x + i * sparkleTile - sparkleOffset;
        ctx.fillStyle = "rgba(255, 246, 161, 0.92)";
        ctx.fillRect(sx + 20, y + h * 0.54, 6, 6);
        ctx.fillRect(sx + 18, y + h * 0.56, 10, 2);
        ctx.fillRect(sx + 22, y + h * 0.52, 2, 10);
      }
    }

    if (m.lighting) {
      ctx.fillStyle = m.lighting;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  function drawThemeObstacle(themeId, x, y, w, h, seed, topPiece) {
    const capH = Math.min(24, Math.max(12, Math.round(h * 0.12)));
    if (themeId === "forest") {
      ctx.fillStyle = "#6b4a2b";
      ctx.fillRect(x + w * 0.22, y, w * 0.56, h);
      ctx.fillStyle = "#4f9f4d";
      ctx.fillRect(x + 3, y + (topPiece ? h - capH - 14 : 6), w - 6, capH + 8);
      ctx.fillStyle = "#74ca69";
      ctx.fillRect(x + 8, y + (topPiece ? h - capH - 8 : 2), w - 16, capH - 2);
      return;
    }
    if (themeId === "city") {
      ctx.fillStyle = "#465d85";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#2a3b56";
      ctx.fillRect(x, y + (topPiece ? h - capH : 0), w, capH);
      ctx.fillStyle = "#f8db8e";
      const rows = Math.max(2, Math.floor((h - capH) / 14));
      for (let r = 0; r < rows; r++) {
        const yy = y + 5 + r * 14;
        if (yy + 8 > y + h - capH) break;
        for (let c = 0; c < 3; c++) {
          if ((seed + r + c) % 2 === 0) ctx.fillRect(x + 6 + c * 11, yy, 6, 8);
        }
      }
      return;
    }
    if (themeId === "rocket") {
      ctx.fillStyle = "#4d2a3f";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#bd3d63";
      ctx.fillRect(x + 3, y + 4, w - 6, 6);
      ctx.fillRect(x + 3, y + h - 10, w - 6, 6);
      ctx.fillStyle = "#f7db7b";
      for (let yy = y + 14; yy < y + h - 14; yy += 12) {
        if (Math.floor((yy + seed) / 12) % 2 === 0) ctx.fillRect(x + 5, yy, w - 10, 4);
      }
      ctx.fillStyle = "#f3f0f5";
      ctx.fillRect(x + w * 0.31, y + (topPiece ? h - capH + 3 : 3), w * 0.38, capH - 6);
      ctx.fillStyle = "#9d2649";
      ctx.font = "900 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("R", x + w / 2, y + (topPiece ? h - capH / 2 : capH / 2));
      return;
    }
    if (themeId === "pony") {
      ctx.fillStyle = "#d270b0";
      ctx.fillRect(x, y, w, h);
      const stripes = ["#ffe173", "#ff9ecf", "#8ee3ff"];
      for (let i = 0; i < stripes.length; i++) {
        ctx.fillStyle = stripes[i];
        ctx.fillRect(x + 4 + i * ((w - 8) / stripes.length), y, (w - 8) / stripes.length - 2, h);
      }
      ctx.fillStyle = "#ffef9d";
      ctx.fillRect(x + 3, y + (topPiece ? h - capH : 0), w - 6, capH);
      return;
    }
    ctx.fillStyle = "rgba(24,130,60,.96)";
    ctx.fillRect(x, y, w, h);
  }

  function drawBG() {
    const theme = activeThemeId();
    if (theme === "classic") {
      if (assets.bg.complete && assets.bg.naturalWidth > 0) ctx.drawImage(assets.bg, 0, 0, W, H);
      else {
        ctx.fillStyle = "#8ed7ff";
        ctx.fillRect(0, 0, W, H);
      }
      return;
    }
    drawThemeBackdrop(theme, 0, 0, W, H, nowMs() / 1000, true);
  }

  function drawGround() {
    const y = H - T.groundH;
    const m = currentThemeMeta();
    ctx.fillStyle = m.groundTop;
    ctx.fillRect(0, y, W, T.groundH);
    ctx.fillStyle = m.groundBottom;
    ctx.fillRect(0, y + 26, W, T.groundH - 26);
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(0, y, W, 3);

    if (m.move) {
      const stripeW = 68;
      const offset = (nowMs() / 16) % stripeW;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = -1; i < Math.ceil(W / stripeW) + 2; i++) {
        ctx.fillRect(i * stripeW - offset, y + 10, 20, 6);
      }
    }
  }

  function drawPipes() {
    const gapSize = currentGapSize();
    const megaSwing = isMega() && state.mode === "play";
    const theme = activeThemeId();

    for (const p of state.pipes) {
      const x = p.x;
      const w = p.w;
      const gapTop = p.gapY - gapSize / 2;
      const gapBot = p.gapY + gapSize / 2;
      const botH = (H - T.groundH) - gapBot;

      let swingTop = 0;
      let swingBot = 0;
      let liftTop = 0;
      let liftBot = 0;
      if (megaSwing) {
        const centerX = x + w / 2;
        const dist = Math.abs(centerX - state.bird.x);
        const t = clamp(1 - dist / 250, 0, 1);
        const wave = Math.sin(nowMs() / 110 + p.id * 0.35) * 0.05;
        const amount = t * 0.26 + wave;
        swingTop = -amount;
        swingBot = amount;
        liftTop = -t * 14;
        liftBot = t * 14;
      }

      if (theme === "classic") {
        if (assets.pipe.complete && assets.pipe.naturalWidth > 0) {
          ctx.save();
          ctx.translate(x + w / 2, gapTop / 2);
          if (swingTop !== 0) {
            ctx.translate(0, liftTop);
            ctx.rotate(swingTop);
          }
          ctx.scale(1, -1);
          ctx.drawImage(assets.pipe, -w / 2, -gapTop / 2, w, gapTop);
          ctx.restore();

          if (swingBot !== 0) {
            ctx.save();
            ctx.translate(x + w / 2, gapBot + botH / 2 + liftBot);
            ctx.rotate(swingBot);
            ctx.drawImage(assets.pipe, -w / 2, -botH / 2, w, botH);
            ctx.restore();
          } else {
            ctx.drawImage(assets.pipe, x, gapBot, w, botH);
          }
        } else {
          ctx.fillStyle = "rgba(24,130,60,.96)";
          if (swingTop !== 0) {
            ctx.save();
            ctx.translate(x + w / 2, gapTop / 2 + liftTop);
            ctx.rotate(swingTop);
            ctx.fillRect(-w / 2, -gapTop / 2, w, gapTop);
            ctx.restore();
          } else {
            ctx.fillRect(x, 0, w, gapTop);
          }
          if (swingBot !== 0) {
            ctx.save();
            ctx.translate(x + w / 2, gapBot + botH / 2 + liftBot);
            ctx.rotate(swingBot);
            ctx.fillRect(-w / 2, -botH / 2, w, botH);
            ctx.restore();
          } else {
            ctx.fillRect(x, gapBot, w, botH);
          }
        }
        continue;
      }

      if (swingTop !== 0) {
        ctx.save();
        ctx.translate(x + w / 2, gapTop / 2 + liftTop);
        ctx.rotate(swingTop);
        drawThemeObstacle(theme, -w / 2, -gapTop / 2, w, gapTop, p.id * 2 + 1, true);
        ctx.restore();
      } else {
        drawThemeObstacle(theme, x, 0, w, gapTop, p.id * 2 + 1, true);
      }

      if (swingBot !== 0) {
        ctx.save();
        ctx.translate(x + w / 2, gapBot + botH / 2 + liftBot);
        ctx.rotate(swingBot);
        drawThemeObstacle(theme, -w / 2, -botH / 2, w, botH, p.id * 2 + 2, false);
        ctx.restore();
      } else {
        drawThemeObstacle(theme, x, gapBot, w, botH, p.id * 2 + 2, false);
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

  function drawCoins() {
    const frames = [assets.coinSpin0, assets.coinSpin1, assets.coinSpin2, assets.coinSpin3];
    for (const coin of state.coins) {
      if (coin.taken) continue;
      const wobble = Math.sin(nowMs() / 130 + coin.x * 0.02) * 0.8;
      const r = coin.r;
      const x = coin.x;
      const y = coin.y + wobble;
      const f = Math.floor((nowMs() / 90 + coin.x * 0.03)) % frames.length;
      const frame = frames[(f + frames.length) % frames.length];
      const s = r * 2.2;

      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.9, r * 0.85, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      if (frame && frame.complete && frame.naturalWidth > 0) {
        ctx.drawImage(frame, x - s / 2, y - s / 2, s, s);
      } else {
        ctx.fillStyle = "#d89f0f";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawForestEventMobs() {
    if (!state.forestEvent.active) return;
    for (const m of state.forestEvent.mobs) {
      ctx.save();
      ctx.translate(m.x, m.y);
      const wiggle = Math.sin(nowMs() / 130 + m.x * 0.02) * 1.6;
      ctx.translate(0, wiggle);

      if (m.kind === "weedle") {
        ctx.fillStyle = "#e3b64a";
        ctx.fillRect(-16, -8, 10, 16);
        ctx.fillRect(-6, -9, 10, 18);
        ctx.fillRect(4, -8, 10, 16);
        ctx.fillStyle = "#cf8b34";
        ctx.fillRect(12, -6, 6, 12);
        ctx.fillStyle = "#111";
        ctx.fillRect(14, -3, 2, 2);
      } else if (m.kind === "caterpie") {
        ctx.fillStyle = "#79c45f";
        for (let i = 0; i < 4; i++) ctx.fillRect(-18 + i * 8, -8 + (i % 2 ? 1 : -1), 8, 16);
        ctx.fillStyle = "#b7ef8c";
        ctx.fillRect(-16, -4, 22, 8);
        ctx.fillStyle = "#ce4d4d";
        ctx.fillRect(9, -8, 5, 5);
      } else {
        const s = m.r / 22;
        ctx.scale(s, s);
        ctx.fillStyle = "#7f4ca8";
        ctx.fillRect(-20, -6, 36, 12);
        ctx.fillStyle = "#5f347f";
        ctx.fillRect(-24, -3, 6, 6);
        ctx.fillRect(16, -3, 6, 6);
        ctx.fillStyle = "#f3e38f";
        ctx.fillRect(14, -2, 3, 3);
      }
      ctx.restore();
    }
  }

  function drawForestEventBanner() {
    if (!state.forestEvent.active) return;
    const title = state.forestEvent.kind === "weedle" ? "WEEDLE'IN AROUND" : "CATERPIE CRAWLERS";
    const show = nowMs() < state.forestEvent.labelUntil;
    const cardW = show ? 284 : 238;
    const x = W / 2 - cardW / 2;
    const y = 84;
    drawPixelRect(x, y, cardW, 62, {
      outer: "rgba(19, 80, 29, 0.96)",
      border: "rgba(73, 202, 92, 0.92)",
      inner: "rgba(16, 60, 22, 0.90)",
      highlight: "rgba(128, 224, 104, 0.34)",
    });
    ctx.fillStyle = "rgba(245, 255, 214, 0.98)";
    ctx.font = "900 16px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lg = assets.evForestLogo;
    if (lg && lg.complete && lg.naturalWidth > 0) ctx.drawImage(lg, x + 8, y + 6, 58, 40);
    ctx.fillText(title, W / 2, y + 22);
    ctx.font = "800 13px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText("Eat bugs: +3 points +1 coin | Avoid Ekans", W / 2, y + 44);
  }

  function drawCityEventFragments() {
    if (!state.cityEvent.active) return;
    for (const f of state.cityEvent.fragments) {
      const pulse = 1 + Math.sin(nowMs() / 120 + f.x * 0.02) * 0.12;
      const s = f.r * 2.1 * pulse;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.sin(nowMs() / 200 + f.y * 0.03) * 0.25);
      ctx.fillStyle = "rgba(79, 248, 228, 0.92)";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.6);
      ctx.lineTo(s * 0.45, -s * 0.08);
      ctx.lineTo(s * 0.22, s * 0.58);
      ctx.lineTo(-s * 0.18, s * 0.58);
      ctx.lineTo(-s * 0.42, -s * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(225, 255, 252, 0.95)";
      ctx.fillRect(-2, -6, 4, 10);
      ctx.fillRect(-5, -2, 10, 4);
      ctx.restore();
    }
  }

  function drawCityEventBanner() {
    if (!state.cityEvent.active) return;
    const show = nowMs() < state.cityEvent.labelUntil;
    const cardW = show ? 300 : 244;
    const x = W / 2 - cardW / 2;
    const y = 84;
    drawPixelRect(x, y, cardW, 62, {
      outer: "rgba(23, 70, 104, 0.96)",
      border: "rgba(108, 214, 244, 0.92)",
      inner: "rgba(19, 44, 71, 0.90)",
      highlight: "rgba(152, 230, 255, 0.30)",
    });
    ctx.fillStyle = "rgba(233, 251, 255, 0.98)";
    ctx.font = "900 16px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lg = assets.evCityLogo;
    if (lg && lg.complete && lg.naturalWidth > 0) ctx.drawImage(lg, x + 8, y + 6, 58, 40);
    ctx.fillText("MEGA MADNESS", W / 2, y + 22);
    ctx.font = "800 13px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText("Fragments: +3 mega energy and +1 coin each", W / 2, y + 44);
  }

  function drawRocketEventCoins() {
    const frames = [assets.coinSpin0, assets.coinSpin1, assets.coinSpin2, assets.coinSpin3];
    for (const c of state.rocketEvent.coins) {
      const r = c.r;
      const s = r * 2.1;
      const f = Math.floor((nowMs() / 90 + c.x * 0.03)) % frames.length;
      const frame = frames[(f + frames.length) % frames.length];
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + r * 0.9, r * 0.85, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      if (frame && frame.complete && frame.naturalWidth > 0) ctx.drawImage(frame, c.x - s / 2, c.y - s / 2, s, s);
      ctx.restore();
    }
    const big = state.rocketEvent.bigCoin;
    if (big) {
      const r = big.r;
      ctx.save();
      ctx.globalAlpha = 0.98;
      ctx.fillStyle = "rgba(255, 236, 124, 0.28)";
      ctx.beginPath();
      ctx.arc(big.x, big.y, r + 8 + Math.sin(nowMs() / 140) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f3c847";
      ctx.beginPath();
      ctx.arc(big.x, big.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff3bb";
      ctx.beginPath();
      ctx.arc(big.x, big.y, r * 0.68, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7f5a00";
      ctx.font = "900 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("10", big.x, big.y + 1);
      ctx.restore();
    }
  }

  function drawRocketBalloon() {
    const visible = state.rocketEvent.active || nowMs() < state.rocketEvent.ascendUntil;
    if (!visible) return;
    const b = rocketBalloonPos();
    const x = b.x;
    const y = b.y;
    ctx.save();
    ctx.fillStyle = "#383a40";
    ctx.beginPath();
    ctx.ellipse(x, y, 62, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1f2126";
    ctx.fillRect(x - 56, y - 6, 112, 12);
    ctx.fillStyle = "#dadce2";
    ctx.fillRect(x - 20, y - 12, 40, 24);
    ctx.fillStyle = "#8f1237";
    ctx.font = "900 20px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("R", x, y + 2);
    ctx.strokeStyle = "#c8c9ce";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 24, y + 26); ctx.lineTo(x - 14, y + 52);
    ctx.moveTo(x + 24, y + 26); ctx.lineTo(x + 14, y + 52);
    ctx.stroke();
    ctx.fillStyle = "#6b4a2b";
    ctx.fillRect(x - 16, y + 52, 32, 16);
    ctx.fillStyle = "#a27544";
    ctx.fillRect(x - 16, y + 52, 32, 4);
    ctx.restore();
  }

  function drawRocketEventBanner() {
    if (!state.rocketEvent.active) return;
    const show = nowMs() < state.rocketEvent.labelUntil;
    const cardW = show ? 320 : 250;
    const x = W / 2 - cardW / 2;
    const y = 84;
    drawPixelRect(x, y, cardW, 62, {
      outer: "rgba(52, 18, 29, 0.96)",
      border: "rgba(200, 83, 119, 0.92)",
      inner: "rgba(70, 20, 36, 0.90)",
      highlight: "rgba(224, 131, 154, 0.30)",
    });
    ctx.fillStyle = "rgba(255, 233, 242, 0.98)";
    ctx.font = "900 16px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lg = assets.evRocketLogo;
    if (lg && lg.complete && lg.naturalWidth > 0) ctx.drawImage(lg, x + 8, y + 6, 58, 40);
    ctx.fillText("TEAM ROCKET RAID", W / 2, y + 22);
    ctx.font = "800 13px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText("Coin trail: +2 score +1 coin | Big coin at the end", W / 2, y + 44);
  }

  function drawPonyEventRainbow() {
    if (!state.ponyEvent.active) return;
    const phase = state.ponyEvent.rainbowPhase;
    const cols = ["#ff617a", "#ffb74e", "#ffe96f", "#7fe778", "#70d6ff", "#b782ff"];
    for (let i = 0; i < cols.length; i++) {
      ctx.strokeStyle = cols[i];
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 12) {
        const y = rainbowYAtX(x, phase + i * 14) + i * 5;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawPonyEventPickups() {
    for (const p of state.ponyEvent.pickups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.kind === "coin") {
        const f = Math.floor((nowMs() / 90 + p.x * 0.03)) % 4;
        const frames = [assets.coinSpin0, assets.coinSpin1, assets.coinSpin2, assets.coinSpin3];
        const frame = frames[(f + 4) % 4];
        if (frame && frame.complete && frame.naturalWidth > 0) ctx.drawImage(frame, -12, -12, 24, 24);
      } else if (p.kind === "fragment") {
        ctx.fillStyle = "rgba(96, 252, 232, 0.94)";
        ctx.beginPath();
        ctx.moveTo(0, -10); ctx.lineTo(8, -2); ctx.lineTo(4, 10); ctx.lineTo(-4, 10); ctx.lineTo(-8, -2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(255, 242, 189, 0.98)";
        ctx.fillRect(-16, -20, 32, 40);
        ctx.fillStyle = "rgba(214, 91, 151, 0.96)";
        ctx.font = "900 28px 'Trebuchet MS', Verdana, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.label, 0, 3);
      }
      ctx.restore();
    }

    const big = state.ponyEvent.bigCoin;
    if (big) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 241, 137, 0.28)";
      ctx.beginPath();
      ctx.arc(big.x, big.y, big.r + 9 + Math.sin(nowMs() / 150) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f0c84b";
      ctx.beginPath();
      ctx.arc(big.x, big.y, big.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff5bf";
      ctx.beginPath();
      ctx.arc(big.x, big.y, big.r * 0.68, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7e5b00";
      ctx.font = "900 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("G", big.x, big.y + 1);
      ctx.restore();
    }
  }

  function drawPonyEventBanner() {
    const active = state.ponyEvent.active || !!state.ponyEvent.bigCoin;
    if (!active) return;
    const show = nowMs() < state.ponyEvent.labelUntil;
    const cardW = show ? 320 : 250;
    const x = W / 2 - cardW / 2;
    const y = 84;
    const got = state.ponyEvent.lettersDone;
    drawPixelRect(x, y, cardW, 66, {
      outer: "rgba(76, 26, 70, 0.96)",
      border: "rgba(233, 132, 196, 0.92)",
      inner: "rgba(95, 36, 88, 0.90)",
      highlight: "rgba(249, 175, 218, 0.28)",
    });
    ctx.fillStyle = "rgba(255, 241, 247, 0.98)";
    ctx.font = "900 16px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lg = assets.evPonyLogo;
    if (lg && lg.complete && lg.naturalWidth > 0) ctx.drawImage(lg, x + 8, y + 8, 58, 40);
    ctx.fillText("WOODS TO THE EAST!", W / 2, y + 21);
    ctx.font = "800 13px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText(
      `Collect 3-0-3: [${got["3a"] ? "3" : "_"} ${got["0"] ? "0" : "_"} ${got["3b"] ? "3" : "_"}]`,
      W / 2,
      y + 42
    );
    ctx.fillText("Rainbow run: coins or mega fragments, then pot of gold", W / 2, y + 57);
  }

  function eventLogoForKey(key) {
    if (key === "forest") return assets.evForestLogo;
    if (key === "city") return assets.evCityLogo;
    if (key === "rocket") return assets.evRocketLogo;
    if (key === "pony") return assets.evPonyLogo;
    return null;
  }

  function drawEventIntroOverlay() {
    if (!state.eventIntro.active) return;
    const remaining = Math.max(0, Math.ceil((state.eventIntro.until - nowMs()) / 1000));
    const pulse = 1 + Math.sin(nowMs() / 120) * 0.05;
    drawPopupBackdrop(0.62);
    drawThemedPopupFrame(30, 170, W - 60, 260, "Event Incoming");
    const logo = eventLogoForKey(state.eventIntro.eventKey);
    if (logo && logo.complete && logo.naturalWidth > 0) {
      const lw = 240;
      const lh = (logo.height / logo.width) * lw;
      ctx.drawImage(logo, W / 2 - lw / 2, 214, lw, lh);
    } else {
      ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
      ctx.font = "900 20px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(state.eventIntro.title, W / 2, 246);
    }
    ctx.fillStyle = "rgba(240, 255, 203, 0.98)";
    ctx.font = "900 26px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.eventIntro.title, W / 2, 306);
    ctx.font = "900 18px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText(state.eventIntro.rules, W / 2, 336);

    drawPixelRect(W / 2 - 58, 356, 116, 44, {
      outer: "rgba(95, 24, 28, 0.96)",
      border: "rgba(238, 109, 98, 0.92)",
      inner: "rgba(132, 32, 40, 0.90)",
      highlight: "rgba(255, 173, 130, 0.35)",
    });
    ctx.fillStyle = "rgba(255, 239, 209, 0.98)";
    ctx.font = "900 28px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText(String(remaining), W / 2, 385);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.ellipse(W / 2, 284, 130 * pulse, 56 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
      } else if (p.kind === "featherTrail") {
        const s = p.r * 4.1;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot || 0) + Math.sin(p.age * 14) * 0.15);
        if (assets.powerFeather && assets.powerFeather.complete && assets.powerFeather.naturalWidth > 0) {
          ctx.drawImage(assets.powerFeather, -s / 2, -s / 2, s, s);
        } else {
          ctx.fillStyle = "rgba(245, 227, 182, 0.96)";
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 1.4, p.r * 0.8, Math.PI * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.kind === "rainbowTrail") {
        ctx.fillStyle = p.color || "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.ellipse(p.x - p.r * 0.5, p.y, p.r * 1.8, p.r * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha *= 0.8;
        ctx.fillStyle = p.color || "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "emberTrail") {
        ctx.fillStyle = "rgba(255, 151, 66, 0.94)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha *= 0.55;
        ctx.fillStyle = "rgba(255, 79, 35, 0.92)";
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.9, p.y, p.r * 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "cometTrail") {
        ctx.fillStyle = "rgba(164, 228, 255, 0.95)";
        ctx.beginPath();
        ctx.ellipse(p.x - p.r * 1.2, p.y, p.r * 2.3, p.r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha *= 0.9;
        ctx.fillStyle = "rgba(224, 255, 255, 0.98)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "shadowTrail") {
        ctx.fillStyle = "rgba(78, 63, 112, 0.88)";
        ctx.beginPath();
        ctx.ellipse(p.x - p.r * 0.5, p.y, p.r * 1.9, p.r * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha *= 0.6;
        ctx.fillStyle = "rgba(188, 125, 241, 0.55)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.65, 0, Math.PI * 2);
        ctx.fill();
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
    if (state.hard) return;
    const t = nowMs();
    if (t >= state.megaBannerUntil) return;

    const remaining = (state.megaBannerUntil - t) / 1000;
    const life = 2.2;
    const p = clamp(1 - remaining / life, 0, 1);

    const y = 100 + Math.sin(p * Math.PI) * 6;
    const alpha = clamp(Math.sin(p * Math.PI), 0.1, 1);
    const bw = W - 48;
    const bh = 64;
    const bx = 24;
    const by = y - 34;

    ctx.save();
    ctx.globalAlpha = alpha;
    drawPixelRect(bx, by, bw, bh, {
      outer: "rgba(15, 82, 28, 0.92)",
      border: "rgba(46, 162, 62, 0.95)",
      inner: "rgba(20, 66, 25, 0.90)",
      highlight: "rgba(112, 202, 93, 0.40)",
    });

    ctx.fillStyle = "rgba(240, 255, 203, 0.98)";
    ctx.font = "900 22px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("IT'S MEGA TIME", W / 2, y);

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

    drawPixelRect(x, y, barW, barH, {
      outer: "rgba(15, 82, 28, 0.92)",
      border: "rgba(46, 162, 62, 0.95)",
      inner: "rgba(20, 66, 25, 0.90)",
      highlight: "rgba(112, 202, 93, 0.40)",
    });

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
      ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
      ctx.font = "900 14px 'Trebuchet MS', Verdana, sans-serif";
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

    if (state.hard) {
      ctx.fillStyle = "rgba(255, 226, 164, 0.96)";
      ctx.font = "900 10px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("CHALLENGERS NEST", x + barW - 10, y + 12);
    }

    ctx.restore();
  }

  function drawMegaChargeMeter() {
    if (state.hard) return;
    if (state.mode !== "play") return;

    const x = W / 2;
    const y = H - T.groundH - 38;
    const progress = clamp(state.megaCharge / T.megaChargeNeeded, 0, 1);
    const ready = isMegaChargeReady();
    const pulse = 1 + Math.sin(nowMs() / 120) * 0.04;
    const readyPulse = 1 + Math.sin(nowMs() / 120) * 0.16;

    ctx.save();
    drawCard(x - 38, y - 38, 76, 76, 20, "rgba(9, 28, 14, 0.80)", "rgba(140, 178, 140, 0.42)");

    if (ready) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(243, 210, 82, 0.70)";
      ctx.beginPath();
      ctx.arc(x, y, T.megaMeterRadius + 8 * readyPulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(120, 130, 120, 0.45)";
    ctx.beginPath();
    ctx.arc(x, y, T.megaMeterRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ready ? "rgba(243, 210, 82, 0.95)" : "rgba(109, 227, 95, 0.92)";
    ctx.beginPath();
    ctx.arc(x, y, T.megaMeterRadius * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();

    ctx.fillStyle = "rgba(18, 49, 21, 0.94)";
    ctx.beginPath();
    ctx.arc(x, y, 19, 0, Math.PI * 2);
    ctx.fill();

    const im = assets.icons.mega;
    if (im && im.complete && im.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = progress >= 1 ? 1 : 0.35;
      ctx.drawImage(im, x - 13, y - 13, 26, 26);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(233, 243, 204, 0.92)";
    ctx.font = "900 10px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      ready ? "MEGA READY" : `${Math.min(state.megaCharge, T.megaChargeNeeded)}/${T.megaChargeNeeded}`,
      x,
      y + 30
    );
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

    const cardX = x - (w * scale) / 2 - 12;
    const cardY = y - (h * scale) / 2 - 12;
    const cardW = w * scale + 24;
    const cardH = h * scale + 24;
    drawPixelRect(cardX, cardY, cardW, cardH, {
      outer: "rgba(15, 82, 28, 0.92)",
      border: "rgba(46, 162, 62, 0.95)",
      inner: "rgba(20, 66, 25, 0.90)",
      highlight: "rgba(112, 202, 93, 0.40)",
    });

    if (im && im.complete && im.naturalWidth > 0) {
      ctx.drawImage(im, x - (w * scale) / 2, y - (h * scale) / 2, w * scale, h * scale);
    } else {
      ctx.fillStyle = "rgba(240, 255, 203, 0.98)";
      ctx.font = "900 64px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(step).toUpperCase(), x, y);
    }

    ctx.restore();
  }

  function drawMenuOverlay() {
    const alpha = state.menuAlpha;
    if (alpha <= 0) return;
    syncChallengerWeekIfNeeded();

    ctx.save();
    ctx.globalAlpha = alpha;

    // Reset buttons each frame
    state.buttons = [];

    // Logo
    let logoBottom = 150;
    if (assets.logo && assets.logo.complete && assets.logo.naturalWidth > 0) {
      const lw = 270;
      const lh = (assets.logo.height / assets.logo.width) * lw;
      const ly = 38;
      ctx.drawImage(assets.logo, (W - lw) / 2, ly, lw, lh);
      logoBottom = ly + lh;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "900 28px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("FLAPPY PIDGEY", W / 2, 70);
      logoBottom = 88;
    }

    // High score line
    const hsY = logoBottom + 14;
    drawPixelRect(104, hsY, 212, 34, {
      outer: "rgba(25, 109, 34, 0.82)",
      border: "rgba(54, 160, 63, 0.82)",
      inner: "rgba(22, 71, 22, 0.70)",
      highlight: "rgba(111, 197, 90, 0.35)",
    });
    ctx.fillStyle = "rgba(248, 245, 218, 0.95)";
    ctx.font = "900 18px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`High Score: ${state.best.toLocaleString()}`, W / 2, hsY + 17);

    // Buttons
    drawButton(126, 400, 78, 48, "PLAY", true, () => beginTransition());
    drawButton(216, 400, 78, 48, "HELP", true, () => {
      state.showHardLockPopup = false;
      state.showNestPopup = false;
      state.helpSlide = 0;
      state.mode = "help";
    });

    // Bottom dock: coins | store | codes
    const dockY = H - 80;
    const dockX = 14;
    const dockW = W - 28;
    const dockH = 64;
    const cardGap = 10;
    const leftW = 118;
    const midW = 112;
    const rightW = 112;
    drawPixelRect(dockX, dockY, dockW, dockH, {
      outer: "rgba(21, 77, 31, 0.96)",
      border: "rgba(68, 190, 86, 0.92)",
      inner: "rgba(17, 56, 23, 0.86)",
      highlight: "rgba(109, 206, 96, 0.28)",
    });

    const leftX = dockX + 8;
    drawPixelRect(leftX, dockY + 8, leftW, 48, {
      outer: "rgba(23, 90, 35, 0.95)",
      border: "rgba(66, 188, 83, 0.90)",
      inner: "rgba(20, 63, 26, 0.95)",
      highlight: "rgba(116, 210, 96, 0.35)",
    });
    const coinIcon = [assets.coinSpin0, assets.coinSpin1, assets.coinSpin2, assets.coinSpin3][Math.floor(nowMs() / 110) % 4];
    if (coinIcon && coinIcon.complete && coinIcon.naturalWidth > 0) {
      ctx.drawImage(coinIcon, leftX + 8, dockY + 18, 20, 20);
    }
    ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
    ctx.font = "900 11px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("COINS", leftX + 34, dockY + 25);
    ctx.font = "900 19px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText(state.totalCoins.toLocaleString(), leftX + 34, dockY + 46);

    const midX = leftX + leftW + cardGap;
    drawButton(midX, dockY + 10, midW, 44, "STORE", true, () => { state.mode = "store"; });

    const rightX = midX + midW + cardGap;
    drawButton(rightX, dockY + 10, rightW, 44, "CODES", true, () => openCodesPrompt());
    if (assets.codesIcon && assets.codesIcon.complete && assets.codesIcon.naturalWidth > 0) {
      ctx.drawImage(assets.codesIcon, rightX + 8, dockY + 22, 16, 16);
    }

    // Challengers Nest (hard/traditional mode)
    const hardUnlocked = isHardUnlocked();
    const hardLabel = "CHALLENGERS NEST";
    const hardX = 104;
    const hardY = 452;
    const hardW = 220;
    const hardH = 44;
    drawButton(hardX, hardY, hardW, hardH, hardLabel, true, () => {
      if (hardUnlocked) state.showNestPopup = true;
      else state.showHardLockPopup = true;
    });
    const nestPulse = 1 + Math.sin(nowMs() / 170) * 0.06;
    const nestY = hardY + 12 + Math.sin(nowMs() / 240) * 1.5;
    if (assets.nestIcon && assets.nestIcon.complete && assets.nestIcon.naturalWidth > 0) {
      ctx.drawImage(assets.nestIcon, hardX + 8, nestY, 20 * nestPulse, 20 * nestPulse);
    }
    if (assets.trophyIcon && assets.trophyIcon.complete && assets.trophyIcon.naturalWidth > 0) {
      ctx.drawImage(assets.trophyIcon, hardX + hardW - 30, nestY, 20 * nestPulse, 20 * nestPulse);
    }
    const banY = hardY + hardH + 8;
    const flash = 0.28 + (Math.sin(nowMs() / 120) * 0.12 + 0.12);
    drawPixelRect(hardX, banY, hardW, 24, {
      outer: "rgba(95, 24, 28, 0.96)",
      border: "rgba(238, 109, 98, 0.92)",
      inner: "rgba(132, 32, 40, 0.90)",
      highlight: `rgba(255, 173, 130, ${flash.toFixed(2)})`,
    });
    ctx.fillStyle = "rgba(255, 239, 209, 0.98)";
    ctx.font = "900 11px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("COMPETE AND WIN STAMPS!", hardX + hardW / 2, banY + 15);
    drawButton(hardX, banY + 30, hardW, 40, "LEADERBOARDS", true, () => openLeaderboards());
    if (state.hard) {
      ctx.fillStyle = "rgba(255, 245, 183, 0.95)";
      ctx.font = "900 10px 'Trebuchet MS', Verdana, sans-serif";
      ctx.fillText("NEST ACTIVE", hardX + hardW / 2, hardY - 8);
    }
    if (!hardUnlocked) drawLockIcon(hardX + 18, hardY + 16, 1);

    if (state.showHardLockPopup && !hardUnlocked) {
      // Modal layer
      drawPopupBackdrop(0.64);
      drawThemedPopupFrame(28, 236, W - 56, 224, "Challengers Nest Locked");

      ctx.font = "800 14px 'Trebuchet MS', Verdana, sans-serif";
      ctx.fillText("The Nest only opens for proven flyers.", W / 2, 308);
      ctx.fillText("Get a High Score of 200+ to unlock", W / 2, 334);
      ctx.fillText("Challengers Nest and leaderboard access.", W / 2, 358);
      ctx.fillText(`Current best: ${state.best}`, W / 2, 382);

      // block underlying menu buttons while popup is open
      state.buttons = [];
      drawButton(W / 2 - 64, 410, 128, 40, "FAIR ENOUGH", true, () => {
        state.showHardLockPopup = false;
      });
    }

    if (state.showNestPopup && hardUnlocked) {
      const missions = missionTargets();
      drawPopupBackdrop(0.66);
      drawThemedPopupFrame(18, 176, W - 36, 346, "Challengers Nest");
      drawPixelRect(32, 214, W - 64, 30, {
        outer: "rgba(95, 24, 28, 0.96)",
        border: "rgba(238, 109, 98, 0.92)",
        inner: "rgba(132, 32, 40, 0.90)",
        highlight: "rgba(255, 173, 130, 0.35)",
      });
      ctx.fillStyle = "rgba(255, 239, 209, 0.98)";
      ctx.font = "900 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("COMPETE AND WIN STAMPS!", W / 2, 233);

      ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
      ctx.font = "800 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.fillText("Traditional mode: base map only, no trails/themes/power-ups.", W / 2, 260);
      ctx.fillText(`Weekly Stamps: ${state.challengerStamps}`, W / 2, 278);

      const m = state.challengerWeekly;
      const rows = [
        `Easy Mission (${missions.easy}+): ${m.easy ? "DONE" : "PENDING"}`,
        `Medium Mission (${missions.medium}+): ${m.medium ? "DONE" : "PENDING"}`,
        `Hard Mission (${missions.hard}+): ${m.hard ? "DONE" : "PENDING"}`,
      ];
      ctx.textAlign = "left";
      for (let i = 0; i < rows.length; i++) {
        drawPixelRect(36, 292 + i * 34, W - 72, 28, {
          outer: "rgba(23, 90, 35, 0.95)",
          border: "rgba(66, 188, 83, 0.90)",
          inner: "rgba(20, 63, 26, 0.92)",
          highlight: "rgba(116, 210, 96, 0.35)",
        });
        ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
        ctx.fillText(rows[i], 44, 310 + i * 34);
      }

      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
      ctx.font = "900 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.fillText("Challengers Leaderboard", 36, 404);
      const board = state.challengerLeaderboard.slice(0, 5);
      for (let i = 0; i < 5; i++) {
        const val = board[i] ?? "---";
        ctx.fillText(`${i + 1}.  ${val}`, 48, 424 + i * 18);
      }

      state.buttons = [];
      drawButton(42, 470, 128, 40, state.hard ? "SET CASUAL" : "SET NEST", true, () => {
        state.hard = !state.hard;
        state.showNestPopup = false;
      });
      drawButton(W - 170, 470, 128, 40, "CLOSE", true, () => {
        state.showNestPopup = false;
      });
    }

    ctx.restore();
  }

  function drawHelpOverlay() {
    ctx.save();
    state.buttons = [];

    drawPopupBackdrop(0.60);
    drawThemedPopupFrame(14, 76, W - 28, H - 150, "How To Play / Pickups");
    const slides = [
      {
        title: "How To Play",
        subtitle: "Tap to flap. Miss nothing. Hit nothing.",
        lines: [
          "Fly through gaps and avoid pipes, sky ceiling, and ground.",
          "Coins and pickups build score, mega charge, and momentum.",
        ],
      },
      {
        title: "Pickups Field Guide",
        subtitle: "Every pickup can rescue or accelerate your run.",
        pickupCards: true,
      },
      {
        title: "Mega Evolution",
        subtitle: "Mega deserves center stage. Use it wisely.",
        lines: [
          "Charge meter to 300. Trigger by tapping meter, pulse, or Space.",
          "Mega grants speed, smash power, and a safer burst window.",
        ],
        megaCard: true,
      },
      {
        title: "Coins + Store",
        subtitle: "Economy and scaling rewards",
        lines: [
          "Every 10 run coins = +1 score. Event coins count too.",
          "Coins buy trails, themes, feathers, and merch rewards.",
        ],
        coinCard: true,
      },
      {
        title: "Themes + Minigames",
        subtitle: "Each theme has a different chaos event.",
        lines: [
          "Learn event rules quickly and farm score, coins, and mega.",
          "Most events remove pipes briefly: use that space aggressively.",
        ],
        themeCard: true,
      },
      {
        title: "Challengers Nest",
        subtitle: "Traditional mode, no assists.",
        lines: [
          "Base map only. No themes, trails, or powerups.",
          "Compete on seasonal + lifetime Nest leaderboards.",
        ],
        nestCard: true,
      },
      {
        title: "Earning Stamps",
        subtitle: "Weekly mission clears = stamps.",
        lines: [
          "Easy 30+, Medium 80+, Hard 140+ in Nest runs.",
          "Clear each once per week for stamp progress.",
        ],
        stampCard: true,
      },
    ];
    const idx = clamp(state.helpSlide, 0, slides.length - 1);
    state.helpSlide = idx;
    const slide = slides[idx];

    const panelX = 28;
    const panelY = 140;
    const panelW = W - 56;
    const panelH = 346;
    const headerH = 126;
    const bodyY = panelY + headerH + 8;
    const bodyH = 170;
    const navY = panelY + panelH - 52;
    drawPixelRect(panelX, panelY, panelW, panelH, {
      outer: "rgba(22, 87, 34, 0.95)",
      border: "rgba(68, 192, 86, 0.90)",
      inner: "rgba(21, 62, 26, 0.92)",
      highlight: "rgba(117, 211, 97, 0.30)",
    });

    drawPixelRect(34, 150, W - 68, headerH - 18, {
      outer: "rgba(38, 108, 45, 0.95)",
      border: "rgba(88, 204, 99, 0.90)",
      inner: "rgba(56, 128, 58, 0.90)",
      highlight: "rgba(170, 229, 153, 0.25)",
    });
    drawPixelRect(34, bodyY, W - 68, bodyH, {
      outer: "rgba(23, 90, 35, 0.95)",
      border: "rgba(66, 188, 83, 0.90)",
      inner: "rgba(20, 63, 26, 0.92)",
      highlight: "rgba(116, 210, 96, 0.20)",
    });

    ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
    ctx.font = "900 18px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(slide.title, W / 2, 174);
    ctx.font = "800 13px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillStyle = "rgba(228, 247, 199, 0.94)";
    ctx.fillText(`Slide ${idx + 1}/${slides.length}`, W / 2, 194);
    ctx.font = "700 12px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillStyle = "rgba(219, 242, 184, 0.96)";
    ctx.fillText(slide.subtitle || "", W / 2, 214);

    ctx.save();
    ctx.beginPath();
    ctx.rect(40, 222, W - 80, 34);
    ctx.clip();
    ctx.textAlign = "left";
    if (slide.lines) {
      ctx.font = "700 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.fillStyle = "rgba(232, 248, 206, 0.95)";
      drawWrappedText(slide.lines[0], 40, 228, W - 80, 14, 1);
      drawWrappedText(slide.lines[1], 40, 242, W - 80, 14, 1);
    }
    ctx.restore();

    if (slide.pickupCards) {
      const entries = [
        { key: "RAZZ", bonus: "+1" },
        { key: "GOLD_RAZZ", bonus: "+5" },
        { key: "PINAP", bonus: "+2" },
        { key: "SILVER_PINAP", bonus: "+10" },
        { key: "NANAB", bonus: "SAFE" },
        { key: "MEGA_STONE", bonus: "MEGA" },
      ];
      const colW = (W - 96) / 2;
      for (let i = 0; i < entries.length; i++) {
        const def = COLLECTIBLES[entries[i].key];
        const x = 40 + (i % 2) * (colW + 16);
        const y = bodyY + 10 + Math.floor(i / 2) * 52;
        drawPixelRect(x, y, colW, 46, {
          outer: "rgba(23, 90, 35, 0.95)",
          border: "rgba(66, 188, 83, 0.90)",
          inner: "rgba(20, 63, 26, 0.92)",
          highlight: "rgba(116, 210, 96, 0.35)",
        });
        drawCard(x + 6, y + 6, 26, 26, 7, "rgba(37, 98, 47, 0.92)", "rgba(118, 212, 106, 0.58)");
        const icon = assets.icons[def.icon];
        if (icon && icon.complete && icon.naturalWidth > 0) ctx.drawImage(icon, x + 9, y + 9, 20, 20);
        ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
        ctx.font = "900 10px 'Trebuchet MS', Verdana, sans-serif";
        drawWrappedText(def.title, x + 36, y + 16, colW - 42, 11, 1);
        ctx.font = "700 9px 'Trebuchet MS', Verdana, sans-serif";
        drawWrappedText(def.desc, x + 36, y + 30, colW - 42, 10, 1);
      }
    }

    if (slide.megaCard) {
      drawPixelRect(40, bodyY + 10, W - 80, bodyH - 20, {
        outer: "rgba(21, 80, 42, 0.98)",
        border: "rgba(66, 196, 102, 0.95)",
        inner: "rgba(17, 54, 31, 0.95)",
        highlight: "rgba(130, 228, 146, 0.28)",
      });
      const progress = clamp(state.megaCharge / T.megaChargeNeeded, 0, 1);
      drawPixelRect(56, bodyY + 42, W - 112, 24, {
        outer: "rgba(24, 92, 39, 0.95)",
        border: "rgba(72, 198, 95, 0.90)",
        inner: "rgba(17, 48, 25, 0.95)",
        highlight: "rgba(100, 185, 96, 0.20)",
      });
      ctx.fillStyle = "rgba(255, 226, 92, 0.96)";
      ctx.fillRect(60, bodyY + 46, (W - 120) * progress, 16);
      ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
      ctx.font = "900 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`MEGA CHARGE ${Math.floor(progress * 100)}%`, W / 2, bodyY + 60);
      ctx.textAlign = "left";
      ctx.font = "700 12px 'Trebuchet MS', Verdana, sans-serif";
      drawWrappedText("During Mega: move faster, smash pipes on contact, and clear pressure.", 56, bodyY + 82, W - 112, 16, 3);
    }

    if (slide.coinCard) {
      drawPixelRect(40, bodyY + 10, W - 80, bodyH - 20, {
        outer: "rgba(23, 90, 35, 0.95)",
        border: "rgba(66, 188, 83, 0.90)",
        inner: "rgba(20, 63, 26, 0.92)",
        highlight: "rgba(116, 210, 96, 0.35)",
      });
      const frame = [assets.coinSpin0, assets.coinSpin1, assets.coinSpin2, assets.coinSpin3][Math.floor(nowMs() / 90) % 4];
      if (frame && frame.complete && frame.naturalWidth > 0) ctx.drawImage(frame, 56, bodyY + 32, 50, 50);
      ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
      ctx.font = "800 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "left";
      drawWrappedText("10 coins in a run grants +1 score automatically.", 114, bodyY + 42, W - 160, 14, 2);
      drawWrappedText("Event pickups are your fastest coin engine.", 114, bodyY + 74, W - 160, 14, 2);
      drawWrappedText("Use codes/store wisely to build your loadout.", 56, bodyY + 114, W - 112, 14, 2);
    }

    if (slide.themeCard) {
      const logos = [assets.evForestLogo, assets.evCityLogo, assets.evRocketLogo, assets.evPonyLogo];
      for (let i = 0; i < logos.length; i++) {
        const x = 40 + (i % 2) * ((W - 96) / 2 + 16);
        const y = bodyY + 10 + Math.floor(i / 2) * 58;
        drawPixelRect(x, y, (W - 96) / 2, 52, {
          outer: "rgba(23, 90, 35, 0.95)",
          border: "rgba(66, 188, 83, 0.90)",
          inner: "rgba(20, 63, 26, 0.92)",
          highlight: "rgba(116, 210, 96, 0.35)",
        });
        const lg = logos[i];
        if (lg && lg.complete && lg.naturalWidth > 0) ctx.drawImage(lg, x + 6, y + 5, (W - 96) / 2 - 12, 42);
      }
      ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
      ctx.font = "700 11px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "left";
      drawWrappedText("Forest: eat bugs, dodge Ekans. City: collect mega fragments.", 40, bodyY + 132, W - 80, 12, 2);
    }

    if (slide.nestCard || slide.stampCard) {
      drawPixelRect(40, bodyY + 10, W - 80, bodyH - 20, {
        outer: "rgba(52, 18, 29, 0.96)",
        border: "rgba(200, 83, 119, 0.92)",
        inner: "rgba(70, 20, 36, 0.90)",
        highlight: "rgba(224, 131, 154, 0.30)",
      });
      ctx.fillStyle = "rgba(255, 233, 242, 0.98)";
      ctx.font = "800 11px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "left";
      if (slide.nestCard) {
        drawWrappedText("Unlock at High Score 200+. This is your ranked skill queue.", 54, bodyY + 34, W - 108, 14, 3);
        drawWrappedText("No theme buffs, no trail buffs, no mercy.", 54, bodyY + 92, W - 108, 14, 2);
      } else {
        const m = missionTargets();
        drawWrappedText(`Weekly targets: Easy ${m.easy}+, Medium ${m.medium}+, Hard ${m.hard}+`, 54, bodyY + 34, W - 108, 14, 3);
        drawWrappedText("Clear each once per week to bank stamps.", 54, bodyY + 92, W - 108, 14, 2);
      }
    }

    drawButton(panelX + 10, navY, 52, 36, "<", idx > 0, () => { state.helpSlide = Math.max(0, state.helpSlide - 1); });
    drawButton(panelX + panelW - 62, navY, 52, 36, ">", idx < slides.length - 1, () => { state.helpSlide = Math.min(slides.length - 1, state.helpSlide + 1); });

    drawButton(34, H - 120, 110, 44, "BACK", true, () => { state.mode = "menu"; });
    drawButton(W - 144, H - 120, 110, 44, "PLAY", true, () => beginTransition());

    ctx.restore();
  }

  function drawStoreOverlay() {
    ctx.save();
    state.buttons = [];

    drawPopupBackdrop(0.62);
    drawThemedPopupFrame(16, 68, W - 32, H - 136, "Pidgey Coin Store");

    ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
    ctx.font = "900 16px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Wallet: ${state.totalCoins} coins`, W / 2, 116);
    const tabs = [
      { id: "power", label: "Power", icon: assets.tabPower },
      { id: "trails", label: "Trails", icon: assets.tabTrail },
      { id: "themes", label: "Themes", icon: assets.tabTheme },
      { id: "merch", label: "Merch", icon: assets.tabMerch },
    ];
    const tabW = 86;
    const tabGap = 10;
    const tabStart = W / 2 - ((tabW * tabs.length + tabGap * (tabs.length - 1)) / 2);
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const tx = tabStart + i * (tabW + tabGap);
      const active = state.storeTab === tab.id;
      drawPixelRect(tx, 130, tabW, 40, {
        outer: active ? "rgba(31, 112, 43, 0.98)" : "rgba(22, 72, 31, 0.90)",
        border: active ? "rgba(90, 208, 99, 0.96)" : "rgba(65, 150, 76, 0.74)",
        inner: active ? "rgba(242, 214, 86, 0.96)" : "rgba(31, 90, 41, 0.92)",
        highlight: active ? "rgba(255, 244, 191, 0.72)" : "rgba(129, 188, 119, 0.35)",
      });
      if (tab.icon && tab.icon.complete && tab.icon.naturalWidth > 0) {
        ctx.drawImage(tab.icon, tx + 8, 138, 20, 20);
      }
      ctx.fillStyle = active ? "rgba(36, 65, 15, 0.98)" : "rgba(230, 247, 198, 0.92)";
      ctx.font = "800 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(tab.label, tx + 32, 152);
      state.buttons.push({
        x: tx,
        y: 130,
        w: tabW,
        h: 40,
        enabled: true,
        onClick: () => {
          state.storeTab = tab.id;
          clampActiveStoreScroll();
        },
      });
    }

    const panelY = 178;
    const panelH = H - 322;
    drawPixelRect(28, panelY, W - 56, panelH, {
      outer: "rgba(23, 90, 35, 0.95)",
      border: "rgba(66, 188, 83, 0.90)",
      inner: "rgba(20, 63, 26, 0.92)",
      highlight: "rgba(116, 210, 96, 0.35)",
    });

    function drawTrailPreview(id, x, y) {
      drawCard(x, y, 34, 26, 8, "rgba(33, 88, 43, 0.92)", "rgba(119, 211, 110, 0.58)");
      if (id === "none") {
        ctx.fillStyle = "rgba(206, 227, 183, 0.85)";
        ctx.fillRect(x + 7, y + 12, 20, 2);
      } else if (id === "stardust") {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(x + 10, y + 13, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 17, y + 9, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 24, y + 15, 1.8, 0, Math.PI * 2); ctx.fill();
      } else if (id === "feather") {
        if (assets.powerFeather && assets.powerFeather.complete && assets.powerFeather.naturalWidth > 0) {
          ctx.drawImage(assets.powerFeather, x + 6, y + 4, 22, 18);
        } else {
          ctx.fillStyle = "rgba(245, 227, 182, 0.96)";
          ctx.beginPath(); ctx.ellipse(x + 12, y + 14, 4, 2.4, 0.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x + 18, y + 10, 4, 2.2, 0.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x + 24, y + 14, 4, 2.4, 0.5, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        if (id === "rainbow") {
          const cols = ["#ff5d73", "#ffa94f", "#fff06a", "#7ff57a", "#6ad6ff", "#b17cff"];
          for (let i = 0; i < cols.length; i++) {
            ctx.fillStyle = cols[i];
            ctx.beginPath();
            ctx.arc(x + 7 + i * 4.5, y + 13 + Math.sin(i * 1.2) * 2.5, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (id === "ember") {
          ctx.fillStyle = "#ff8b33";
          ctx.beginPath(); ctx.arc(x + 10, y + 14, 2.8, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 16, y + 10, 2.3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#ff4e2f";
          ctx.beginPath(); ctx.arc(x + 22, y + 15, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (id === "comet") {
          ctx.fillStyle = "#9de8ff";
          ctx.beginPath(); ctx.ellipse(x + 14, y + 12, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#e6ffff";
          ctx.beginPath(); ctx.arc(x + 21, y + 12, 3, 0, Math.PI * 2); ctx.fill();
        } else if (id === "shadow") {
          ctx.fillStyle = "#6d589b";
          ctx.beginPath(); ctx.arc(x + 12, y + 14, 4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 19, y + 11, 3.6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(196, 132, 243, 0.72)";
          ctx.beginPath(); ctx.arc(x + 24, y + 15, 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = "#d6efbe";
          ctx.fillRect(x + 8, y + 12, 18, 3);
        }
      }
    }

    function drawThemePreview(id, x, y, w, h) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      drawThemeBackdrop(id, x, y, w, h, nowMs() / 1000, id !== "classic");

      const groundH = 18;
      const m = THEME_META[id] || THEME_META.classic;
      ctx.fillStyle = m.groundTop;
      ctx.fillRect(x, y + h - groundH, w, groundH);
      ctx.fillStyle = m.groundBottom;
      ctx.fillRect(x, y + h - 10, w, 10);

      const obstacleW = 26;
      const gap = Math.round(h * 0.36);
      const midY = y + h * 0.5;
      const topH = Math.max(22, midY - gap / 2 - y);
      const botY = midY + gap / 2;
      const botH = Math.max(22, (y + h - groundH) - botY);

      drawThemeObstacle(id, x + 32, y, obstacleW, topH, 7, true);
      drawThemeObstacle(id, x + 32, botY, obstacleW, botH, 8, false);
      drawThemeObstacle(id, x + w - 58, y, obstacleW, topH - 24, 9, true);
      drawThemeObstacle(id, x + w - 58, botY - 16, obstacleW, botH + 16, 10, false);

      const birdY = y + h * 0.46 + Math.sin(nowMs() / 230) * 3;
      if (assets.pidgey && assets.pidgey.naturalWidth > 0) {
        ctx.save();
        ctx.translate(x + w * 0.49, birdY);
        drawSprite(assets.pidgey, state.anim.frame % T.frames, T.frames, 48);
        ctx.restore();
      }
      ctx.restore();
    }

    if (state.storeTab === "power") {
      ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
      ctx.font = "900 14px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "left";
      drawCard(42, 198, 40, 40, 10, "rgba(40, 112, 47, 0.88)", "rgba(190, 247, 125, 0.58)");
      if (assets.powerFeather && assets.powerFeather.complete && assets.powerFeather.naturalWidth > 0) {
        ctx.drawImage(assets.powerFeather, 48, 204, 28, 28);
      }
      ctx.fillText("Second Chance Feather", 92, 208);
      ctx.font = "700 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.fillStyle = "rgba(218, 244, 186, 0.88)";
      drawWrappedText("Use on Game Over to jump back into the same run once.", 92, 226, W - 204, 15, 3);
      ctx.fillText(`Owned: ${state.featherCount}    Cost: ${FEATHER_COST} coins`, 92, 274);
      drawButton(W - 156, 248, 114, 40, "BUY +1", state.totalCoins >= FEATHER_COST, () => buyFeather());
    }

    if (state.storeTab === "trails") {
      const m = trailListMetrics();
      clampStoreTrailScroll();
      const needsScroll = m.maxScroll > 0;
      const scrollbarW = needsScroll ? 12 : 0;
      const listW = m.w - (needsScroll ? scrollbarW + 8 : 0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(m.x, m.y, m.w, m.h);
      ctx.clip();
      for (let i = 0; i < STORE_TRAILS.length; i++) {
        const trail = STORE_TRAILS[i];
        const owned = state.ownedTrails.includes(trail.id);
        const equipped = state.equippedTrail === trail.id;
        const y = m.y + i * m.rowH - state.storeTrailScroll;
        if (y + 48 < m.y || y > m.y + m.h) continue;
        drawPixelRect(m.x, y, listW, 54, {
          outer: "rgba(23, 90, 35, 0.95)",
          border: "rgba(66, 188, 83, 0.90)",
          inner: "rgba(20, 63, 26, 0.92)",
          highlight: "rgba(116, 210, 96, 0.35)",
        });
        drawTrailPreview(trail.id, 46, y + 11);
        ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
        ctx.font = "800 13px 'Trebuchet MS', Verdana, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${trail.name} ${owned ? "" : `- ${trail.cost}c`}`, m.x + 48, y + 28);
        const label = equipped ? "EQUIPPED" : (owned ? "EQUIP" : "BUY");
        const enabled = equipped ? false : (owned || state.totalCoins >= trail.cost);
        const btnX = m.x + listW - 122;
        drawButton(btnX, y + 7, 112, 40, label, enabled, () => buyOrEquipTrail(trail.id, trail.cost));
      }
      ctx.restore();

      if (needsScroll) {
        const trackX = m.x + listW + 4;
        drawPixelRect(trackX, m.y, scrollbarW, m.h, {
          outer: "rgba(23, 90, 35, 0.95)",
          border: "rgba(66, 188, 83, 0.90)",
          inner: "rgba(20, 63, 26, 0.92)",
          highlight: "rgba(116, 210, 96, 0.25)",
        });
        const thumbH = Math.max(28, (m.h / m.contentH) * m.h);
        const thumbTravel = m.h - thumbH - 4;
        const thumbY = m.y + 2 + (m.maxScroll > 0 ? (state.storeTrailScroll / m.maxScroll) * thumbTravel : 0);
        drawPixelRect(trackX + 2, thumbY, scrollbarW - 4, thumbH, {
          outer: "rgba(31, 112, 43, 0.98)",
          border: "rgba(90, 208, 99, 0.96)",
          inner: "rgba(242, 214, 86, 0.96)",
          highlight: "rgba(255, 244, 191, 0.72)",
        });
      }
    }

    if (state.storeTab === "themes") {
      const slideshowIndex = Math.floor(nowMs() / 1700) % STORE_THEMES.length;
      const activeTheme = STORE_THEMES[slideshowIndex].id;
      drawPixelRect(40, 194, W - 80, 170, {
        outer: "rgba(24, 91, 36, 0.95)",
        border: "rgba(75, 194, 95, 0.90)",
        inner: "rgba(19, 62, 27, 0.92)",
        highlight: "rgba(126, 214, 104, 0.33)",
      });
      drawThemePreview(activeTheme, 48, 202, W - 96, 142);
      ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
      ctx.font = "800 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Theme Preview: ${STORE_THEMES[slideshowIndex].name}`, 50, 356);

      const m = themeListMetrics();
      clampStoreThemeScroll();
      const needsScroll = m.maxScroll > 0;
      const scrollbarW = needsScroll ? 12 : 0;
      const listW = m.w - (needsScroll ? scrollbarW + 8 : 0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(m.x, m.y, m.w, m.h);
      ctx.clip();
      for (let i = 0; i < STORE_THEMES.length; i++) {
        const theme = STORE_THEMES[i];
        const owned = state.ownedThemes.includes(theme.id);
        const equipped = state.equippedTheme === theme.id;
        const y = m.y + i * m.rowH - state.storeThemeScroll;
        if (y + 48 < m.y || y > m.y + m.h) continue;
        drawPixelRect(m.x, y, listW, 54, {
          outer: "rgba(23, 90, 35, 0.95)",
          border: "rgba(66, 188, 83, 0.90)",
          inner: "rgba(20, 63, 26, 0.92)",
          highlight: "rgba(116, 210, 96, 0.35)",
        });
        ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
        ctx.font = "800 13px 'Trebuchet MS', Verdana, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${theme.name} ${owned ? "" : `- ${theme.cost}c`}`, m.x + 12, y + 28);
        const label = equipped ? "EQUIPPED" : (owned ? "EQUIP" : "BUY");
        const enabled = equipped ? false : (owned || state.totalCoins >= theme.cost);
        const btnX = m.x + listW - 122;
        drawButton(btnX, y + 7, 112, 40, label, enabled, () => buyOrEquipTheme(theme.id, theme.cost));
      }
      ctx.restore();

      if (needsScroll) {
        const trackX = m.x + listW + 4;
        drawPixelRect(trackX, m.y, scrollbarW, m.h, {
          outer: "rgba(23, 90, 35, 0.95)",
          border: "rgba(66, 188, 83, 0.90)",
          inner: "rgba(20, 63, 26, 0.92)",
          highlight: "rgba(116, 210, 96, 0.25)",
        });
        const thumbH = Math.max(28, (m.h / m.contentH) * m.h);
        const thumbTravel = m.h - thumbH - 4;
        const thumbY = m.y + 2 + (m.maxScroll > 0 ? (state.storeThemeScroll / m.maxScroll) * thumbTravel : 0);
        drawPixelRect(trackX + 2, thumbY, scrollbarW - 4, thumbH, {
          outer: "rgba(31, 112, 43, 0.98)",
          border: "rgba(90, 208, 99, 0.96)",
          inner: "rgba(242, 214, 86, 0.96)",
          highlight: "rgba(255, 244, 191, 0.72)",
        });
        const step = 90;
        state.buttons.push({
          x: trackX, y: m.y, w: scrollbarW, h: 22, enabled: true,
          onClick: () => { state.storeThemeScroll = Math.max(0, state.storeThemeScroll - step); clampStoreThemeScroll(); },
        });
        state.buttons.push({
          x: trackX, y: m.y + m.h - 22, w: scrollbarW, h: 22, enabled: true,
          onClick: () => { state.storeThemeScroll += step; clampStoreThemeScroll(); },
        });
        ctx.fillStyle = "rgba(240, 255, 203, 0.9)";
        ctx.beginPath();
        ctx.moveTo(trackX + scrollbarW / 2, m.y + 6);
        ctx.lineTo(trackX + 3, m.y + 14);
        ctx.lineTo(trackX + scrollbarW - 3, m.y + 14);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(trackX + 3, m.y + m.h - 14);
        ctx.lineTo(trackX + scrollbarW - 3, m.y + m.h - 14);
        ctx.lineTo(trackX + scrollbarW / 2, m.y + m.h - 6);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (state.storeTab === "merch") {
      const m = merchListMetrics();
      clampStoreMerchScroll();
      ctx.save();
      ctx.beginPath();
      ctx.rect(m.x, m.y, m.w, m.h);
      ctx.clip();
      for (let i = 0; i < STORE_MERCH.length; i++) {
        const item = STORE_MERCH[i];
        const y = m.y + i * m.rowH - state.storeMerchScroll;
        const owned = state.ownedMerch.includes(item.id);
        if (y + 70 < m.y || y > m.y + m.h) continue;
        drawPixelRect(m.x, y, m.w, 80, {
          outer: "rgba(23, 90, 35, 0.95)",
          border: "rgba(66, 188, 83, 0.90)",
          inner: "rgba(20, 63, 26, 0.92)",
          highlight: "rgba(116, 210, 96, 0.35)",
        });
        ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
        ctx.font = "900 13px 'Trebuchet MS', Verdana, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(item.name, m.x + 12, y + 24);
        ctx.font = "700 11px 'Trebuchet MS', Verdana, sans-serif";
        ctx.fillStyle = "rgba(218, 244, 186, 0.90)";
        drawWrappedText(item.desc, m.x + 12, y + 42, m.w - 146, 13, 2);
        const label = owned ? "OWNED" : `BUY ${item.cost}`;
        const enabled = !owned && state.totalCoins >= item.cost;
        drawButton(m.x + m.w - 122, y + 20, 110, 40, label, enabled, () => buyMerch(item.id, item.cost));
      }
      ctx.restore();
    }

    drawButton(34, H - 120, 110, 44, "BACK", true, () => { state.mode = "menu"; });
    drawButton(W - 144, H - 120, 110, 44, "PLAY", true, () => beginTransition());
    ctx.restore();
  }

  function drawLeaderboardsOverlay() {
    ctx.save();
    state.buttons = [];
    drawPopupBackdrop(0.64);
    drawThemedPopupFrame(12, 62, W - 24, H - 126, "Leaderboards");
    const tabs = [
      ["classic", "Classic"],
      ["forest", "Forest"],
      ["city", "City"],
      ["rocket", "Rocket"],
      ["pony", "Pony"],
      ["chal_season", "Nest Season"],
      ["chal_life", "Nest Life"],
    ];
    const tabW = 94;
    const tabH = 32;
    const startX = 20;
    for (let i = 0; i < tabs.length; i++) {
      const row = i < 4 ? 0 : 1;
      const col = i < 4 ? i : i - 4;
      const tx = startX + col * (tabW + 8);
      const ty = 112 + row * (tabH + 8);
      const active = state.lbTab === tabs[i][0];
      drawPixelRect(tx, ty, tabW, tabH, {
        outer: active ? "rgba(31, 112, 43, 0.98)" : "rgba(22, 72, 31, 0.90)",
        border: active ? "rgba(90, 208, 99, 0.96)" : "rgba(65, 150, 76, 0.74)",
        inner: active ? "rgba(242, 214, 86, 0.96)" : "rgba(31, 90, 41, 0.92)",
        highlight: active ? "rgba(255, 244, 191, 0.72)" : "rgba(129, 188, 119, 0.35)",
      });
      ctx.fillStyle = active ? "rgba(36, 65, 15, 0.98)" : "rgba(230, 247, 198, 0.92)";
      ctx.font = "800 11px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tabs[i][1], tx + tabW / 2, ty + 19);
      const tabId = tabs[i][0];
      state.buttons.push({
        x: tx, y: ty, w: tabW, h: tabH, enabled: true, onClick: () => {
          state.lbTab = tabId;
          state.lbProfileName = "";
          state.lbProfileEntry = null;
          state.showLbSearchPopup = false;
          refreshLeaderboardTab(tabId, true);
        },
      });
    }

    drawButton(W - 132, 152, 104, 32, "SEARCH", true, () => {
      state.showLbSearchPopup = true;
      state.lbSearchDraft = "";
    });

    const list = boardByTab(state.lbTab).slice(0, 10);
    drawPixelRect(20, 190, W - 40, 318, {
      outer: "rgba(23, 90, 35, 0.95)",
      border: "rgba(66, 188, 83, 0.90)",
      inner: "rgba(20, 63, 26, 0.92)",
      highlight: "rgba(116, 210, 96, 0.35)",
    });

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
    ctx.font = "900 13px 'Trebuchet MS', Verdana, sans-serif";
    const tabLabel = tabs.find((t) => t[0] === state.lbTab)?.[1] || "Board";
    ctx.fillText(`${tabLabel} Top 10`, 30, 212);
    if (state.rdab.enabled) {
      ctx.fillStyle = "rgba(214, 236, 179, 0.92)";
      ctx.font = "700 10px 'Trebuchet MS', Verdana, sans-serif";
      if (state.rdab.boardLoading[state.lbTab]) ctx.fillText("Syncing with RDAB...", 148, 212);
      else if (state.rdab.boardError) ctx.fillText(state.rdab.boardError.slice(0, 38), 148, 212);
      else ctx.fillText("RDAB Live", 148, 212);
    }

    let y = 226;
    for (let i = 0; i < 10; i++) {
      const e = list[i];
      drawPixelRect(28, y, W - 56, 26, {
        outer: "rgba(22, 87, 34, 0.95)",
        border: "rgba(68, 192, 86, 0.90)",
        inner: "rgba(21, 62, 26, 0.92)",
        highlight: "rgba(117, 211, 97, 0.22)",
      });
      if (e?.avatarUrl) drawAvatar(e.avatarUrl, 34, y + 3, 20);
      const rank = Number.isFinite(Number(e?.rank)) && Number(e?.rank) > 0 ? `${e.rank}.` : `${i + 1}.`;
      const name = e ? entryLabel(e) : "---";
      const score = e?.score ?? "---";
      ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
      ctx.font = "800 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.fillText(`${rank} ${name}`.slice(0, 24), 58, y + 17);
      ctx.textAlign = "right";
      ctx.fillText(String(score), W - 38, y + 17);
      ctx.textAlign = "left";
      if (e) {
        state.buttons.push({
          x: 28, y, w: W - 56, h: 26, enabled: true, onClick: () => {
            state.lbProfileName = entryLabel(e);
            state.lbProfileEntry = e;
          },
        });
      }
      y += 28;
    }

    if (state.lbSearchResults.length > 0 && !state.lbProfileName) {
      ctx.fillStyle = "rgba(255, 233, 242, 0.98)";
      ctx.font = "800 11px 'Trebuchet MS', Verdana, sans-serif";
      ctx.fillText("Search Results:", 30, 520);
      const names = state.lbSearchResults.slice(0, 4);
      for (let i = 0; i < names.length; i++) {
        drawButton(124 + i * 74, 506, 70, 28, names[i].slice(0, 7), true, () => {
          state.lbProfileName = names[i];
          state.lbProfileEntry = findPilotEntryByLabel(names[i]);
        });
      }
    }

    if (state.showLbSearchPopup) {
      drawPopupBackdrop(0.58);
      drawThemedPopupFrame(28, 180, W - 56, 286, "Find Pilot");
      drawPixelRect(48, 220, W - 96, 36, {
        outer: "rgba(23, 90, 35, 0.95)",
        border: "rgba(66, 188, 83, 0.90)",
        inner: "rgba(20, 63, 26, 0.92)",
        highlight: "rgba(116, 210, 96, 0.35)",
      });
      ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
      ctx.font = "800 13px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "left";
      const draft = state.lbSearchDraft || "Tap letters, then SEARCH";
      ctx.fillText(draft, 56, 243);

      const rows = ["ABCDEF", "GHIJKL", "MNOPQR", "STUVWX", "YZ<"];
      for (let r = 0; r < rows.length; r++) {
        const chars = rows[r].split("");
        for (let c = 0; c < chars.length; c++) {
          const ch = chars[c];
          const bx = 48 + c * 50;
          const by = 264 + r * 34;
          drawButton(bx, by, 44, 28, ch, true, () => {
            if (ch === "<") state.lbSearchDraft = state.lbSearchDraft.slice(0, -1);
            else if (state.lbSearchDraft.length < 12) state.lbSearchDraft += ch;
          });
        }
      }

      drawButton(48, 434, 84, 28, "CLEAR", true, () => {
        state.lbSearchDraft = "";
        state.lbSearchResults = [];
      });
      drawButton(W / 2 - 48, 434, 96, 28, "SEARCH", state.lbSearchDraft.length > 0, () => {
        const results = findPlayers(state.lbSearchDraft);
        state.lbSearchResults = results;
        if (results.length === 1) {
          state.lbProfileName = results[0];
          state.lbProfileEntry = findPilotEntryByLabel(results[0]);
        }
        state.showLbSearchPopup = false;
      });
      drawButton(W - 132, 434, 84, 28, "CLOSE", true, () => {
        state.showLbSearchPopup = false;
      });
    }

    if (state.lbProfileName) {
      const n = state.lbProfileName;
      if (!state.lbProfileEntry) state.lbProfileEntry = findPilotEntryByLabel(n);
      drawPopupBackdrop(0.56);
      drawThemedPopupFrame(24, 184, W - 48, 284, `${n}`);
      const kTheme = ["classic","forest","city","rocket","pony"];
      ctx.fillStyle = "rgba(240, 255, 203, 0.95)";
      ctx.font = "800 12px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "left";
      if (state.lbProfileEntry?.avatarUrl) drawAvatar(state.lbProfileEntry.avatarUrl, W - 106, 218, 56);
      let py = 230;
      for (const k of kTheme) {
        const arr = (state.leaderboards.themes[k] || []).filter((e) => samePilot(e, n));
        const best = arr[0]?.score ?? "---";
        ctx.fillText(`${k.toUpperCase()}: best ${best} | runs ${arr.length}`, 34, py);
        py += 22;
      }
      const wk = currentWeekKey();
      const season = (state.leaderboards.challengers.seasonal[wk] || []).filter((e) => samePilot(e, n));
      const allSeason = [];
      for (const arr of Object.values(state.leaderboards.challengers.seasonal || {})) {
        for (const e of (arr || [])) if (samePilot(e, n)) allSeason.push(e);
      }
      allSeason.sort((a, b) => b.score - a.score);
      const life = (state.leaderboards.challengers.lifetime || []).filter((e) => samePilot(e, n));
      ctx.fillText(`NEST SEASON (${wk}): best ${season[0]?.score ?? "---"} | runs ${season.length}`, 34, py); py += 22;
      ctx.fillText(`NEST SEASONAL (all): best ${allSeason[0]?.score ?? "---"} | runs ${allSeason.length}`, 34, py); py += 22;
      ctx.fillText(`NEST LIFETIME: best ${life[0]?.score ?? "---"} | runs ${life.length}`, 34, py);
      if (state.lbProfileEntry?.profileUrl) {
        drawButton(W / 2 - 114, 420, 108, 36, "PROFILE", true, () => {
          window.open(state.lbProfileEntry.profileUrl, "_blank", "noopener,noreferrer");
        });
        drawButton(W / 2 + 6, 420, 108, 36, "CLOSE", true, () => {
          state.lbProfileName = "";
          state.lbProfileEntry = null;
        });
      } else {
        drawButton(W / 2 - 54, 420, 108, 36, "CLOSE", true, () => {
          state.lbProfileName = "";
          state.lbProfileEntry = null;
        });
      }
    }

    drawButton(W / 2 - 64, H - 108, 128, 44, "BACK", true, () => {
      state.mode = "menu";
      state.lbProfileName = "";
      state.lbProfileEntry = null;
      state.showLbSearchPopup = false;
    });
    ctx.restore();
  }

  function drawOverOverlay() {
    ctx.save();
    state.buttons = [];

    drawPopupBackdrop(0.56);
    drawThemedPopupFrame(22, 160, W - 44, 320, " ");

    const logoY = 178 + Math.sin(nowMs() / 220) * 3;
    if (assets.overLogo && assets.overLogo.complete && assets.overLogo.naturalWidth > 0) {
      const lw = 260;
      const lh = (assets.overLogo.height / assets.overLogo.width) * lw;
      ctx.drawImage(assets.overLogo, W / 2 - lw / 2, logoY, lw, lh);
    } else {
      ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
      ctx.font = "900 34px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", W / 2, logoY + 26);
    }

    ctx.fillStyle = "rgba(240, 255, 203, 0.90)";
    ctx.font = "900 15px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Score ${state.score}    |    Best ${state.best}`, W / 2, 262);

    drawPixelRect(40, 276, W - 80, 170, {
      outer: "rgba(23, 90, 35, 0.95)",
      border: "rgba(66, 188, 83, 0.90)",
      inner: "rgba(20, 63, 26, 0.92)",
      highlight: "rgba(116, 210, 96, 0.35)",
    });

    ctx.fillStyle = "rgba(240, 255, 203, 0.96)";
    ctx.font = "900 15px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("How Did You Do?", 54, 300);

    ctx.fillStyle = "rgba(218, 244, 186, 0.90)";
    ctx.font = "700 13px 'Trebuchet MS', Verdana, sans-serif";
    const dialogBottom = drawWrappedText(state.overDialog || gameOverDialogForScore(state.score), 54, 320, W - 178, 16, 3);

    const cb = state.coinBreakdown || { picked: 0, scoreBonus: 0, survivalBonus: 0, hardBonus: 0, total: 0 };
    ctx.fillStyle = "rgba(240, 255, 203, 0.93)";
    ctx.font = "900 12px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText(`Coins: +${cb.total}`, 54, dialogBottom + 8);
    ctx.fillStyle = "rgba(218, 244, 186, 0.82)";
    ctx.font = "700 11px 'Trebuchet MS', Verdana, sans-serif";
    ctx.fillText(`Picked ${cb.picked}  |  Score bonus ${cb.scoreBonus}`, 54, dialogBottom + 24);
    ctx.fillText(`Survival ${cb.survivalBonus}  |  Hard bonus ${cb.hardBonus}`, 54, dialogBottom + 38);
    ctx.fillText(`Wallet total: ${state.totalCoins} coins`, 54, dialogBottom + 52);
    if (state.rdab.enabled) {
      ctx.fillStyle = "rgba(240, 255, 203, 0.93)";
      ctx.font = "700 11px 'Trebuchet MS', Verdana, sans-serif";
      const syncMsg = state.rdab.submitMessage || "Awaiting RDAB sync...";
      ctx.fillText(syncMsg.slice(0, 44), 54, dialogBottom + 66);
      if (state.rdab.rewards.length > 0) {
        const rewardText = state.rdab.rewards.map((r) => String(r?.label || r?.name || r)).join(", ");
        ctx.fillText(`Rewards: ${rewardText}`.slice(0, 58), 54, dialogBottom + 80);
      }
    }

    // Little pidgey coach portrait on the summary card
    ctx.save();
    ctx.translate(W - 88, 356);
    ctx.rotate(Math.sin(nowMs() / 210) * 0.07);
    if (assets.pidgey && assets.pidgey.naturalWidth > 0) {
      drawSprite(assets.pidgey, state.anim.frame % T.frames, T.frames, 72);
    } else {
      ctx.fillStyle = "rgba(245,210,130,.98)";
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (!state.hard && state.featherCount > 0 && !state.secondChanceUsedThisRun) {
      drawButton(W / 2 - 78, 452, 156, 40, `USE FEATHER x${state.featherCount}`, true, () => useSecondChanceFeather());
    }

    const btnW = 120;
    const btnH = 44;
    const btnGap = 16;
    const rowY = !state.hard && state.featherCount > 0 && !state.secondChanceUsedThisRun ? 500 : 452;
    const rowStart = W / 2 - ((btnW * 2 + btnGap) / 2);
    drawButton(rowStart, rowY, btnW, btnH, "MENU", true, () => toMenu());
    drawButton(rowStart + btnW + btnGap, rowY, btnW, btnH, "RETRY", true, () => beginTransition());

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    state.buttons = [];

    drawBG();

    // Draw world layers
    if (state.mode === "play" || state.mode === "over") {
      drawPipes();
      drawPonyEventRainbow();
      drawForestEventMobs();
      drawCityEventFragments();
      drawRocketBalloon();
      drawRocketEventCoins();
      drawPonyEventPickups();
      drawCoins();
      drawCollectibles();
    }

    if (state.mode !== "menu" && state.mode !== "help") {
      drawBird();
    }
    drawParticles();
    drawGround();
    drawMegaChargeMeter();

    // HUD visible during transition+countdown+play+over
    if (state.mode === "transitioning" || state.mode === "countdown" || state.mode === "play" || state.mode === "over") {
      drawGameHUD();
    }

    // Menu/help overlays
    if (state.mode === "menu") {
      drawMenuOverlay();
      if (!state.showHardLockPopup && !state.showNestPopup) {
        drawBird(); // draw bird AFTER menu so it sits on top of the character card
      }
    }
    if (state.mode === "help") {
      drawHelpOverlay();
    }
    if (state.mode === "store") {
      drawStoreOverlay();
    }
    if (state.mode === "leaderboards") {
      drawLeaderboardsOverlay();
    }

    drawMegaBanner();
    drawForestEventBanner();
    drawCityEventBanner();
    drawRocketEventBanner();
    drawPonyEventBanner();
    drawEventIntroOverlay();
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
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "FLAPPY_READY" }, "*");
  }
  if (state.rdab.enabled) {
    refreshLeaderboardTab(state.lbTab, true);
  }
  requestAnimationFrame((t) => {
    state.lastT = t;
    requestAnimationFrame(loop);
  });
})();
