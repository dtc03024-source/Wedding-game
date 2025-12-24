(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // ===== External links / API =====
  const INVITE_URL = "https://salondeletter.com/w/8kub8vyuib";
  const API_URL = "https://script.google.com/macros/s/AKfycbwrMjZy_pjLr3YUSh-ylaxJpfzH23Ik-h7awy6fF4Q3Doha0P2dvPmCt2LhMv7p0v4Tpw/exec";
  const SPEED_SCALE = 0.7; // 30% slower


  // ===== UI =====
  const hud = document.getElementById("hud");
  const scoreEl = document.getElementById("score");

  const startOverlay = document.getElementById("startOverlay");
  const btnStart = document.getElementById("btnStart");

  const guideOverlay = document.getElementById("guideOverlay");
  const btnGuide = document.getElementById("btnGuide");
  const btnGuideCloseGuide = document.getElementById("btnGuideCloseGuide");

  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const btnRetry = document.getElementById("btnRetry");
  const btnOpenGuide2 = document.getElementById("btnOpenGuide2");
  const deathPhotoEl = document.getElementById("deathPhoto");

  const finalOverlay = document.getElementById("finalOverlay");
  const btnFinalClose = document.getElementById("btnFinalClose");
  const btnFinalRestart = document.getElementById("btnFinalRestart");

  // (Ending) Invite link + gift form
  const btnInviteLink = document.getElementById("btnInviteLink");
  const giftNameEl = document.getElementById("giftName");
  const giftPhoneEl = document.getElementById("giftPhone");
  const btnGiftSubmit = document.getElementById("btnGiftSubmit");
  const giftStatusEl = document.getElementById("giftStatus");

  const pauseOverlay = document.getElementById("pauseOverlay");
  const btnPause = document.getElementById("btnPause");
  const btnResume = document.getElementById("btnResume");

  // ===== Photo pool =====
  const MAX_PHOTOS = 30;
  const exts = ["jpg", "jpeg", "png", "webp"];
  function buildPhotoCandidates() {
    const list = [];
    for (let i = 1; i <= MAX_PHOTOS; i++) {
      const n2 = String(i).padStart(2, "0");
      const n1 = String(i);
      for (const ext of exts) {
        list.push(`assets/photos/photo${n2}.${ext}`);
        list.push(`assets/photos/photo${n1}.${ext}`);
      }
    }
    return Array.from(new Set(list));
  }
  const photoCandidates = buildPhotoCandidates();
  let availablePhotos = [];
  let photoScanStarted = false;

  function placeholderDataUrl(label) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff7fb"/>
            <stop offset="1" stop-color="#fff0e6"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <text x="50%" y="45%" font-size="48" text-anchor="middle" fill="#c77b9f" font-family="system-ui">사진 준비중</text>
        <text x="50%" y="55%" font-size="26" text-anchor="middle" fill="#a56a86" font-family="system-ui">${label}</text>
      </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function startPhotoScanOnce() {
    if (photoScanStarted) return;
    photoScanStarted = true;

    let pending = photoCandidates.length;
    const found = [];

    photoCandidates.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (!found.some(f => f.src === img.src)) found.push(img);
        pending--;
        if (pending === 0) {
          availablePhotos = found;
          console.log("[PHOTO] found:", availablePhotos.length);
        }
      };
      img.onerror = () => {
        pending--;
        if (pending === 0) {
          availablePhotos = found;
          console.log("[PHOTO] found:", availablePhotos.length);
        }
      };
    });
  }

  function pickRandomPhotoSrc() {
    if (availablePhotos.length === 0) {
      return placeholderDataUrl("assets/photos/photo1.jpg 또는 photo01.jpg 형태로 넣어주세요");
    }
    const idx = Math.floor(Math.random() * availablePhotos.length);
    return availablePhotos[idx].src;
  }

  // ===== Scaling =====
  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  // ===== Gameplay constants =====
  const GRAVITY = 2000;
  const JUMP_V = 780;
  const MAX_JUMPS = 2;
  const GROUND_H = 90;

  // ✅ 커플이 앞/뒤로 분리되며 가로폭이 커짐
  const PLAYER_W = 140;
  const PLAYER_H = 64;

  // ✅ 충돌 판정(느슨하게): 보이는 캐릭터보다 작게 잡기
  // 값이 클수록 더 '안 맞는' 판정(쉬움)
  const HIT_PAD_X = 26;
  const HIT_PAD_Y = 18;

  const TARGET_SCORE = 120;

  // ===== Visual style =====
  const STYLE = {
    bgTop: "#fff7fb",
    bgBottom: "#fff0e6",
    ivory: "rgba(255,255,255,0.92)",
    mint: "rgba(124,214,198,0.85)",
    pink: "rgba(255,111,174,0.78)",
    pinkSoft: "rgba(255,111,174,0.18)",
    dark: "rgba(60,38,52,0.92)",
    outline: "rgba(60,38,52,0.55)",
    line: 3,
  };

  function getW() { return canvas.getBoundingClientRect().width; }
  function getH() { return canvas.getBoundingClientRect().height; }
  function getGroundY() { return getH() - GROUND_H; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ===== 안내판 =====
  const signSeq = [
    { type: "bus", title: "버스", boldPrefix: "동대구역 기준 출발", lines: ["708/814 이용", "651(호텔인터불고 하차)", "하차 후 도보 이동"] },
    { type: "subway", title: "지하철", boldPrefix: "동대구역 기준 출발", lines: ["지하철 이용 후 환승", "역 → 택시/도보", "혼잡 시간대 주의"] },
    { type: "car", title: "차량", boldPrefix: "동대구IC 기준 출발", lines: ["시청방향 약 4km", "제2아양교 지나 직진", "호텔인터불고(만촌)"] },
  ];
  let signIndex = 0;

  // ===== State =====
  let running = false;
  let paused = false;

  const world = {
    t: 0,
    speed: 250 * SPEED_SCALE,
    speedUp: 5 * SPEED_SCALE,
    score: 0,

    nextObstacleIn: 0,
    nextSignIn: 0,

    obstacles: [],
    signs: [],
    confetti: [],
    heartParticles: [],

    reached: false,
    endT: 0,
    doorOpen: 0,

    teacherToggle: 0,
  };

  const player = { x: 90, y: 0, vy: 0, jumps: 0, alive: true };

  function resetGame() {
    world.t = 0;
    world.speed = 250 * SPEED_SCALE;
    world.speedUp = 5 * SPEED_SCALE;
    world.score = 0;

    world.nextObstacleIn = 1.05;
    world.nextSignIn = 0.7;

    world.obstacles = [];
    world.signs = [];
    world.confetti = [];
    world.heartParticles = [];

    world.reached = false;
    world.endT = 0;
    world.doorOpen = 0;

    signIndex = 0;
    world.teacherToggle = 0;

    player.y = getGroundY() - PLAYER_H;
    player.vy = 0;
    player.jumps = 0;
    player.alive = true;

    scoreEl.textContent = "0";
    hud.classList.remove("hidden");

    startPhotoScanOnce();
  }

  // ===== Spawn =====
  function spawnObstacle() {
    const groundY = getGroundY();
    const kinds = ["bus", "subway", "taxi"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];

    let w = 92, h = 74;
    if (kind === "taxi") { w = 104; h = 54; }

    world.obstacles.push({
      x: getW() + 50,
      y: groundY - h,
      w, h,
      kind,
      scored: false,
    });
  }

  function canSpawnSign() { return world.signs.length === 0; }

  function spawnSign() {
    if (!canSpawnSign()) return;

    const item = signSeq[signIndex % signSeq.length];
    signIndex++;

    const topY = 96;
    const width = Math.min(400, Math.max(330, getW() * 0.90));

    const teacher = (world.teacherToggle % 2 === 0) ? "bear" : "bunny";
    world.teacherToggle++;

    world.signs.push({
      x: getW() + 30,
      y: topY,
      w: width,
      h: 116,
      ttl: 9.5,
      title: item.title,
      type: item.type,
      boldPrefix: item.boldPrefix,
      lines: item.lines,
      teacher,
    });

    world.nextSignIn = 3.1;
  }

  // ===== Particles =====
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fillRR(x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    rr(x, y, w, h, r);
    ctx.fill();
  }
  function strokeRR(x, y, w, h, r, stroke, lw) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    rr(x, y, w, h, r);
    ctx.stroke();
  }
  function heart(cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s*0.6);
    ctx.bezierCurveTo(cx - s, cy, cx - s, cy - s*0.6, cx, cy - s*0.25);
    ctx.bezierCurveTo(cx + s, cy - s*0.6, cx + s, cy, cx, cy + s*0.6);
    ctx.closePath();
    ctx.fill();
  }

  function spawnHearts(cx, cy) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      world.heartParticles.push({
        x: cx + (-8 + Math.random() * 16),
        y: cy + (-6 + Math.random() * 12),
        vx: (-70 + Math.random() * 140),
        vy: (-200 + Math.random() * -80),
        life: 0.8 + Math.random() * 0.45,
        age: 0,
        size: 7 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (-5 + Math.random() * 10),
      });
    }
  }
  function updateHearts(dt) {
    const g = 520;
    for (const p of world.heartParticles) {
      p.age += dt;
      p.vy += g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    world.heartParticles = world.heartParticles.filter(p => p.age < p.life);
  }

  function wrapWords(tokens, x, y, maxWidth, lineHeight) {
    let line = "";
    for (let i = 0; i < tokens.length; i++) {
      const test = line ? (line + " " + tokens[i]) : tokens[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = tokens[i];
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y);
  }

  // ===== Input =====
  function jump() {
    if (!running || paused) return;
    if (!player.alive) return;
    if (world.reached) return;
    if (player.jumps < MAX_JUMPS) {
      player.vy = -JUMP_V;
      player.jumps += 1;
      spawnHearts(player.x + PLAYER_W * 0.55, player.y + PLAYER_H * 0.55);
    }
  }

  canvas.addEventListener("pointerdown", () => {
    if (!running) return;
    if (!guideOverlay.classList.contains("hidden")) return;
    if (!gameOverOverlay.classList.contains("hidden")) return;
    if (!pauseOverlay.classList.contains("hidden")) return;
    if (!finalOverlay.classList.contains("hidden")) return;
    jump();
  });

  
  // ===== Ending UI (invite + gift) =====
  function prepareFinalUI() {
    if (btnInviteLink) btnInviteLink.href = INVITE_URL;

    if (giftNameEl) { giftNameEl.disabled = false; giftNameEl.value = ""; }
    if (giftPhoneEl) { giftPhoneEl.disabled = false; giftPhoneEl.value = ""; }
    if (btnGiftSubmit) btnGiftSubmit.disabled = false;
    if (giftStatusEl) giftStatusEl.textContent = "";
  }

  async function submitGiftEntry() {
    if (!giftStatusEl) return;

    const name = (giftNameEl?.value || "").trim();
    const phoneRaw = (giftPhoneEl?.value || "").trim();
    const phone = phoneRaw.replace(/[^0-9]/g, "");

    if (!name) { giftStatusEl.textContent = "이름을 입력해 주세요."; return; }
    if (phone.length < 10) { giftStatusEl.textContent = "휴대폰번호를 정확히 입력해 주세요."; return; }

    giftStatusEl.textContent = "응모 중입니다…";
    if (btnGiftSubmit) btnGiftSubmit.disabled = true;

    try {
      await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        body: new URLSearchParams({ name, phone }),
      });

      giftStatusEl.textContent = "✅ 응모 완료! 감사합니다 :)";
      if (giftNameEl) giftNameEl.disabled = true;
      if (giftPhoneEl) giftPhoneEl.disabled = true;
    } catch (e) {
      giftStatusEl.textContent = "전송 실패. 네트워크 확인 후 다시 시도해 주세요.";
      if (btnGiftSubmit) btnGiftSubmit.disabled = false;
    }
  }


    btnInviteLink?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = INVITE_URL;
  });

// ===== Buttons =====
  btnStart.addEventListener("click", () => {
    startOverlay.classList.add("hidden");
    finalOverlay.classList.add("hidden");
    running = true;
    paused = false;
    resetGame();
  });

  btnGuide.addEventListener("click", () => {
    if (!running) return;
    paused = true;
    pauseOverlay.classList.add("hidden");
    guideOverlay.classList.remove("hidden");
  });
  btnGuideCloseGuide.addEventListener("click", () => {
    guideOverlay.classList.add("hidden");

    // Return to the right overlay/state
    if (!player.alive) {
      gameOverOverlay.classList.remove("hidden");
      paused = true;
      return;
    }
    if (!pauseOverlay.classList.contains("hidden")) {
      paused = true;
      return;
    }
    paused = false;
  });
btnOpenGuide2.addEventListener("click", () => {
    gameOverOverlay.classList.add("hidden");
    guideOverlay.classList.remove("hidden");
  });
  btnRetry.addEventListener("click", () => {
    gameOverOverlay.classList.add("hidden");
    paused = false;
    resetGame();
  });
  btnPause.addEventListener("click", () => {
    if (!running) return;
    if (world.reached) return;
    paused = true;
    pauseOverlay.classList.remove("hidden");
  });
  btnResume.addEventListener("click", () => {
    pauseOverlay.classList.add("hidden");
    paused = false;
  });
  btnFinalRestart.addEventListener("click", () => {
    finalOverlay.classList.add("hidden");
    paused = false;
    resetGame();
  });
  btnGiftSubmit?.addEventListener("click", submitGiftEntry);
  btnGiftSubmit?.addEventListener("pointerup", submitGiftEntry);

  btnFinalClose.addEventListener("click", () => {
    try { window.close(); } catch (e) {}
    if (giftStatusEl) giftStatusEl.textContent = "브라우저에서 탭을 닫아 주세요.";
  });
// ===== Collision =====
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function gameOver() {
    player.alive = false;
    paused = true;
    deathPhotoEl.src = pickRandomPhotoSrc();
    gameOverOverlay.classList.remove("hidden");
  }

  function reachVenue() {
    world.reached = true;
    paused = false;
    world.endT = 0;
    world.doorOpen = 0;

    hud.classList.add("hidden");

    world.obstacles = [];
    world.signs = [];
    world.heartParticles = [];

    world.confetti = [];
    for (let i = 0; i < 180; i++) {
      world.confetti.push({
        x: Math.random() * getW(),
        y: -20 - Math.random() * 220,
        vy: 120 + Math.random() * 240,
        vx: -50 + Math.random() * 100,
        r: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: -2 + Math.random() * 4,
      });
    }
  }

  // ===== Background =====
  function drawBackground(w, h, groundY) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, STYLE.bgTop);
    bg.addColorStop(1, STYLE.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // subtle dots
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = STYLE.pink;
    for (let y = 24; y < groundY - 24; y += 56) {
      for (let x = 18; x < w; x += 56) {
        fillRR(x, y, 4, 4, 2, STYLE.pink);
      }
    }
    ctx.globalAlpha = 1;

    // ground
    ctx.fillStyle = STYLE.ivory;
    ctx.fillRect(0, groundY, w, GROUND_H);

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = STYLE.pink;
    ctx.fillRect(0, groundY, w, 8);
    ctx.globalAlpha = 1;

    // road dashes
    ctx.fillStyle = "rgba(60,38,52,0.12)";
    for (let i = 0; i < 18; i++) {
      const lx = ((i * 92) - (world.t * world.speed * 0.28)) % (w + 140) - 140;
      ctx.fillRect(lx, groundY + 46, 54, 6);
    }
  }

  // ===== Label chip =====
  function drawChipCentered(x, y, w, text, fill, textFill) {
    const chipW = Math.max(58, Math.min(92, w * 0.62));
    const chipX = x + w/2 - chipW/2;
    fillRR(chipX, y, chipW, 18, 9, fill);
    strokeRR(chipX, y, chipW, 18, 9, "rgba(255,255,255,0.65)", 1.5);
    ctx.fillStyle = textFill;
    ctx.font = "900 11px system-ui, -apple-system, 'Noto Sans KR', sans-serif";
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, x + w/2 - tw/2, y + 13);
  }

  // ===== Obstacles =====
  function drawObstacle(o) {
    // shadow
    ctx.globalAlpha = 0.20;
    fillRR(o.x + 6, o.y + o.h - 6, o.w - 4, 10, 8, "rgba(60,38,52,0.35)");
    ctx.globalAlpha = 1;

    const lw = STYLE.line;
    const r = 16;

    if (o.kind === "taxi") {
      // taxi car shape
      const bodyY = o.y + 16;
      const bodyH = o.h - 16;

      fillRR(o.x, bodyY, o.w, bodyH, 16, STYLE.ivory);
      strokeRR(o.x, bodyY, o.w, bodyH, 16, STYLE.outline, lw);

      fillRR(o.x + 18, o.y + 6, o.w - 36, 18, 12, STYLE.ivory);
      strokeRR(o.x + 18, o.y + 6, o.w - 36, 18, 12, STYLE.outline, lw);

      drawChipCentered(o.x + 18, o.y + 6, o.w - 36, "TAXI", STYLE.pink, "rgba(255,255,255,0.98)");

      fillRR(o.x + 14, bodyY + 6, o.w - 28, 16, 10, "rgba(124,214,198,0.25)");
      strokeRR(o.x + 14, bodyY + 6, o.w - 28, 16, 10, "rgba(60,38,52,0.25)", 2);

      // headlights 2
      fillRR(o.x + 10, bodyY + bodyH - 16, 12, 10, 5, STYLE.pink);
      fillRR(o.x + o.w - 22, bodyY + bodyH - 16, 12, 10, 5, STYLE.pink);

      // wheels
      fillRR(o.x + 14, bodyY + bodyH - 6, 18, 8, 6, "rgba(60,38,52,0.35)");
      fillRR(o.x + o.w - 32, bodyY + bodyH - 6, 18, 8, 6, "rgba(60,38,52,0.35)");
    } else {
      // common front icon
      fillRR(o.x, o.y, o.w, o.h, r, STYLE.ivory);
      strokeRR(o.x, o.y, o.w, o.h, r, STYLE.outline, lw);

      if (o.kind === "bus") {
        drawChipCentered(o.x, o.y + 6, o.w, "BUS", STYLE.pink, "rgba(255,255,255,0.98)");
        fillRR(o.x + 12, o.y + 28, o.w - 24, 20, 12, "rgba(124,214,198,0.25)");
        strokeRR(o.x + 12, o.y + 28, o.w - 24, 20, 12, "rgba(60,38,52,0.25)", 2);

        // headlights 2
        fillRR(o.x + 12, o.y + o.h - 22, 12, 10, 5, STYLE.pink);
        fillRR(o.x + o.w - 24, o.y + o.h - 22, 12, 10, 5, STYLE.pink);

        // wheels
        fillRR(o.x + 16, o.y + o.h - 10, 18, 8, 6, "rgba(60,38,52,0.35)");
        fillRR(o.x + o.w - 34, o.y + o.h - 10, 18, 8, 6, "rgba(60,38,52,0.35)");
      }

      if (o.kind === "subway") {
        drawChipCentered(o.x, o.y + 6, o.w, "SUBWAY", STYLE.mint, "rgba(255,255,255,0.98)");
        fillRR(o.x + 14, o.y + 28, o.w - 28, 18, 12, "rgba(124,214,198,0.25)");
        strokeRR(o.x + 14, o.y + 28, o.w - 28, 18, 12, "rgba(60,38,52,0.25)", 2);

        fillRR(o.x + o.w/2 - 7, o.y + 50, 14, 10, 5, STYLE.pink);

        // headlights 2
        fillRR(o.x + 12, o.y + o.h - 22, 12, 10, 5, STYLE.pink);
        fillRR(o.x + o.w - 24, o.y + o.h - 22, 12, 10, 5, STYLE.pink);

        // rails
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "rgba(60,38,52,0.18)";
        ctx.fillRect(o.x + 10, o.y + o.h - 7, o.w - 20, 3);
        ctx.fillRect(o.x + 16, o.y + o.h - 3, o.w - 32, 2);
        ctx.globalAlpha = 1;
      }
    }

    // warning badge
    fillRR(o.x + o.w - 18, o.y - 10, 20, 20, 10, STYLE.pink);
    strokeRR(o.x + o.w - 18, o.y - 10, 20, 20, 10, "rgba(255,255,255,0.65)", 1.5);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "900 14px system-ui, -apple-system, 'Noto Sans KR', sans-serif";
    ctx.fillText("!", o.x + o.w - 12, o.y + 5);
  }

  // ===== Faces =====
  function drawFaceSimple(x, y) {
    ctx.fillStyle = STYLE.dark;
    ctx.fillRect(x + 10, y + 10, 4, 4);
    ctx.fillRect(x + 24, y + 10, 4, 4);
    fillRR(x + 18, y + 15, 4, 4, 2, "rgba(199,123,159,0.85)");
    ctx.strokeStyle = "rgba(199,123,159,0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x + 20, y + 21, 6, 0.15*Math.PI, 0.85*Math.PI);
    ctx.stroke();
  }

  // ✅ 커플: 신랑이 앞(오른쪽), 신부가 뒤(왼쪽)에서 손잡고 따라오기
  function drawRunnerCoupleFollow(x, y, weddingMode=false) {
    const lw = STYLE.line;
    const baseY = y + 12;

    // 진행 방향 "앞" = 오른쪽
    const brideX = x;        // 뒤(왼쪽)
    const groomX = x + 56;   // 앞(오른쪽) — 겹치지 않게 넉넉히

    // ---- Bride (bunny) behind ----
    fillRR(brideX + 4, baseY, 40, 42, 18, weddingMode ? STYLE.ivory : "rgba(255,111,174,0.22)");
    strokeRR(brideX + 4, baseY, 40, 42, 18, STYLE.outline, lw);

    fillRR(brideX + 8, y, 36, 30, 16, STYLE.ivory);
    strokeRR(brideX + 8, y, 36, 30, 16, STYLE.outline, lw);

    // bunny ears
    fillRR(brideX + 12, y - 18, 9, 22, 8, STYLE.ivory);
    fillRR(brideX + 31, y - 18, 9, 22, 8, STYLE.ivory);
    strokeRR(brideX + 12, y - 18, 9, 22, 8, STYLE.outline, lw);
    strokeRR(brideX + 31, y - 18, 9, 22, 8, STYLE.outline, lw);

    drawFaceSimple(brideX + 8, y);

    // ---- Groom (bear) in front ----
    fillRR(groomX + 4, baseY, 40, 42, 18, weddingMode ? STYLE.ivory : "rgba(255,111,174,0.18)");
    strokeRR(groomX + 4, baseY, 40, 42, 18, STYLE.outline, lw);

    fillRR(groomX + 8, y, 36, 30, 16, STYLE.ivory);
    strokeRR(groomX + 8, y, 36, 30, 16, STYLE.outline, lw);

    // bear ears
    fillRR(groomX + 8, y - 10, 12, 12, 7, STYLE.ivory);
    fillRR(groomX + 32, y - 10, 12, 12, 7, STYLE.ivory);
    strokeRR(groomX + 8, y - 10, 12, 12, 7, STYLE.outline, lw);
    strokeRR(groomX + 32, y - 10, 12, 12, 7, STYLE.outline, lw);

    drawFaceSimple(groomX + 8, y);

    // bowtie
    fillRR(groomX + 20, y + 28, 12, 10, 5, STYLE.pink);
    strokeRR(groomX + 20, y + 28, 12, 10, 5, "rgba(255,255,255,0.55)", 1.5);

    // ---- holding hands (bride → groom) ----
    ctx.strokeStyle = "rgba(60,38,52,0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(brideX + 44, baseY + 18);
    ctx.lineTo(groomX + 8, baseY + 18);
    ctx.stroke();

    // tiny heart on hands
    ctx.fillStyle = STYLE.pink;
    ctx.globalAlpha = 0.45;
    heart((brideX + 44 + groomX + 8) / 2, baseY + 12, 8);
    ctx.globalAlpha = 1;

    // feet
    fillRR(brideX + 12, y + PLAYER_H - 7, 12, 7, 4, "rgba(60,38,52,0.20)");
    fillRR(brideX + 30, y + PLAYER_H - 7, 12, 7, 4, "rgba(60,38,52,0.20)");
    fillRR(groomX + 12, y + PLAYER_H - 7, 12, 7, 4, "rgba(60,38,52,0.20)");
    fillRR(groomX + 30, y + PLAYER_H - 7, 12, 7, 4, "rgba(60,38,52,0.20)");
  }

  // ✅ 선생님: 상반신 + 팔 + 포인터(막대)
  function drawTeacherHalfBody(kind, x, y, pointToX, pointToY) {
    const lw = STYLE.line;

    // head
    fillRR(x + 10, y - 44, 44, 42, 18, STYLE.ivory);
    strokeRR(x + 10, y - 44, 44, 42, 18, STYLE.outline, lw);

    // ears
    if (kind === "bear") {
      fillRR(x + 10, y - 58, 14, 14, 7, STYLE.ivory);
      fillRR(x + 40, y - 58, 14, 14, 7, STYLE.ivory);
      strokeRR(x + 10, y - 58, 14, 14, 7, STYLE.outline, lw);
      strokeRR(x + 40, y - 58, 14, 14, 7, STYLE.outline, lw);
    } else {
      fillRR(x + 16, y - 74, 10, 34, 8, STYLE.ivory);
      fillRR(x + 38, y - 74, 10, 34, 8, STYLE.ivory);
      strokeRR(x + 16, y - 74, 10, 34, 8, STYLE.outline, lw);
      strokeRR(x + 38, y - 74, 10, 34, 8, STYLE.outline, lw);
    }

    // face
    ctx.fillStyle = STYLE.dark;
    ctx.fillRect(x + 26, y - 28, 5, 5);
    ctx.fillRect(x + 40, y - 28, 5, 5);
    fillRR(x + 33, y - 22, 5, 5, 2, "rgba(199,123,159,0.85)");
    ctx.strokeStyle = "rgba(199,123,159,0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x + 36, y - 15, 7, 0.15*Math.PI, 0.85*Math.PI);
    ctx.stroke();

    // upper body (only torso)
    fillRR(x + 6, y - 2, 52, 46, 18, STYLE.ivory);
    strokeRR(x + 6, y - 2, 52, 46, 18, STYLE.outline, lw);

    // arm (visible) — like your sample: extend toward board
    // shoulder point
    const sx = x + 46;
    const sy = y + 14;
    // elbow (slight bend)
    const ex = x + 60;
    const ey = y + 10;
    // hand near pointer start
    const hx = x + 68;
    const hy = y + 12;

    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // pointer stick (starts from hand)
    ctx.strokeStyle = "rgba(60,38,52,0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(pointToX, pointToY);
    ctx.stroke();

    // pointer tip heart
    ctx.fillStyle = STYLE.pink;
    ctx.globalAlpha = 0.55;
    heart(pointToX, pointToY, 7);
    ctx.globalAlpha = 1;
  }

  // ===== Signs =====
  function drawSign(s) {
    const alpha = clamp(s.ttl / 1.2, 0, 1);
    ctx.globalAlpha = alpha;

    // pole
    fillRR(s.x + 26, s.y + 72, 10, 150, 8, "rgba(60,38,52,0.12)");

    // card
    fillRR(s.x, s.y, s.w, s.h, 20, STYLE.ivory);
    strokeRR(s.x, s.y, s.w, s.h, 20, STYLE.outline, STYLE.line);

    // title badge
    fillRR(s.x + 14, s.y + 14, 64, 30, 14, (s.type === "subway") ? STYLE.mint : STYLE.pink);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "900 14px system-ui, -apple-system, 'Noto Sans KR', sans-serif";
    ctx.fillText(s.title, s.x + 28, s.y + 35);

    // bold prefix
    ctx.fillStyle = STYLE.dark;
    ctx.font = "900 16px system-ui, -apple-system, 'Noto Sans KR', sans-serif";
    ctx.fillText(s.boldPrefix, s.x + 88, s.y + 36);

    // lines
    const tokens = s.lines.join(" · ").split(" ");
    ctx.fillStyle = "rgba(60,38,52,0.88)";
    ctx.font = "800 15px system-ui, -apple-system, 'Noto Sans KR', sans-serif";
    wrapWords(tokens, s.x + 88, s.y + 64, s.w - 104, 20);

    // teacher (left) — move a bit to avoid overlapping
    const teacherX = s.x - 96;
    const teacherY = s.y + 70;
    const pointToX = s.x + 30;
    const pointToY = s.y + 30;
    drawTeacherHalfBody(s.teacher, teacherX, teacherY, pointToX, pointToY);

    ctx.globalAlpha = 1;
  }

  // ===== Ending scene =====
  function drawVenueDoorScene(dt) {
    const w = getW();
    const groundY = getGroundY();

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = STYLE.pink;
    ctx.fillRect(0, groundY - 14, w, 22);
    ctx.globalAlpha = 1;

    const doorX = w * 0.75;
    const doorY = groundY - 200;
    const doorW = 160;
    const doorH = 180;

    fillRR(doorX - doorW/2 - 16, doorY - 16, doorW + 32, doorH + 32, 26, "rgba(124,214,198,0.20)");
    strokeRR(doorX - doorW/2 - 16, doorY - 16, doorW + 32, doorH + 32, 26, "rgba(60,38,52,0.18)", 2);

    fillRR(doorX - doorW/2, doorY, doorW, doorH, 22, STYLE.ivory);
    strokeRR(doorX - doorW/2, doorY, doorW, doorH, 22, STYLE.outline, STYLE.line);

    const open = world.doorOpen;
    const gap = 8 + open * 54;

    fillRR(doorX - gap - doorW/2, doorY + 12, doorW/2 - 6, doorH - 24, 18, STYLE.pinkSoft);
    fillRR(doorX + gap + 6, doorY + 12, doorW/2 - 6, doorH - 24, 18, STYLE.pinkSoft);

    fillRR(doorX - gap - 28, doorY + doorH/2 - 6, 12, 12, 6, "rgba(60,38,52,0.30)");
    fillRR(doorX + gap + 16, doorY + doorH/2 - 6, 12, 12, 6, "rgba(60,38,52,0.30)");

    ctx.fillStyle = STYLE.dark;
    ctx.font = "900 16px system-ui, -apple-system, 'Noto Sans KR', sans-serif";
    ctx.fillText("WEDDING HALL", doorX - 56, doorY - 18);

    world.endT += dt;
    const startX = w * 0.18;
    const endX = doorX - 150;
    const t = clamp(world.endT / 6.0, 0, 1);
    const px = startX + (endX - startX) * t;
    const py = groundY - PLAYER_H - 2;

    // ✅ 엔딩도 “앞/뒤 커플” 유지
    drawRunnerCoupleFollow(px, py, true);

    world.confetti.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = "rgba(255,111,174,0.32)";
      ctx.fillRect(-c.r, -c.r, c.r * 2, c.r * 2);
      ctx.restore();
    });

    ctx.fillStyle = "rgba(60,38,52,0.70)";
    ctx.font = "900 18px system-ui, -apple-system, 'Noto Sans KR', sans-serif";
    ctx.fillText("도착! 예식장 문으로 천천히…", 18, 92);
  }

  // ===== Draw =====
  function draw() {
    const w = getW();
    const h = getH();
    const groundY = getGroundY();

    drawBackground(w, h, groundY);

    if (world.reached) {
      drawVenueDoorScene(0.016);
      return;
    }

    world.signs.forEach(drawSign);
    world.obstacles.forEach(drawObstacle);

    // ✅ 커플 렌더링 변경
    drawRunnerCoupleFollow(player.x, player.y, false);

    for (const p of world.heartParticles) {
      const t = 1 - (p.age / p.life);
      ctx.save();
      ctx.globalAlpha = 0.65 * t;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = STYLE.pink;
      heart(0, 0, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ===== Update =====
  function update(dt) {
    world.t += dt;
    world.speed = (250 + Math.floor(world.t / 12) * world.speedUp) * SPEED_SCALE;

    if (world.reached) {
      world.confetti.forEach(c => {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
        if (c.y > getH() + 40) {
          c.y = -40 - Math.random() * 120;
          c.x = Math.random() * getW();
        }
      });

      world.endT += dt;
      if (world.endT >= 6.0 && world.endT < 7.2) {
        world.doorOpen = clamp((world.endT - 6.0) / 1.2, 0, 1);
      }
      if (world.endT >= 7.2) {
        world.doorOpen = 1;
        if (finalOverlay.classList.contains("hidden")) {
          paused = true;
          finalOverlay.classList.remove("hidden");
          prepareFinalUI();
        }
      }
      return;
    }

    const groundY = getGroundY();

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    const onGround = player.y >= groundY - PLAYER_H;
    if (onGround) {
      player.y = groundY - PLAYER_H;
      player.vy = 0;
      player.jumps = 0;
    }

    world.nextObstacleIn -= dt;
    if (world.nextObstacleIn <= 0) {
      spawnObstacle();
      world.nextObstacleIn =
      clamp(1.65 - world.t * 0.006, 1.05, 1.65) * (1.00 + Math.random() * 0.55);
}

    world.nextSignIn -= dt;
    if (world.nextSignIn <= 0) {
      spawnSign();
      if (world.nextSignIn <= 0) world.nextSignIn = 3.1;
    }

    const vx = world.speed;

    world.obstacles.forEach(o => { o.x -= vx * dt; });
    world.signs.forEach(s => { s.x -= (vx * 0.66) * dt; s.ttl -= dt; });

    world.obstacles = world.obstacles.filter(o => o.x + o.w > -160);
    world.signs = world.signs.filter(s => (s.x + s.w > -220 && s.ttl > -0.2));

    for (const o of world.obstacles) {
      if (!o.scored && (o.x + o.w) < player.x) {
        o.scored = true;
        world.score += 10;
        scoreEl.textContent = String(world.score);
        if (world.score >= TARGET_SCORE) {
          reachVenue();
          return;
        }
      }
    }

    for (const o of world.obstacles) {
      // 플레이어 충돌 박스(작게) → 판정 느슨하게
      const px = player.x + HIT_PAD_X;
      const py = player.y + HIT_PAD_Y;
      const pw = PLAYER_W - HIT_PAD_X * 2;
      const ph = PLAYER_H - HIT_PAD_Y * 2;

      // 장애물도 살짝 축소
      const ox = o.x + 10;
      const oy = o.y + 8;
      const ow = o.w - 20;
      const oh = o.h - 16;

      if (aabb(px, py, pw, ph, ox, oy, ow, oh)) {
        gameOver();
        break;
      }
    }

    updateHearts(dt);
  }

  // ===== Loop =====
  let last = 0;
  function tick(ts) {
    if (!last) last = ts;
    const dt = Math.min(0.033, (ts - last) / 1000);
    last = ts;

    if (running && !paused) update(dt);
    draw();
    requestAnimationFrame(tick);
  }

  function boot() {
    resize();
    resetGame();
    requestAnimationFrame(tick);
  }
  boot();
})();
