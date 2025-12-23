(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const show = (el) => { if (el) el.classList.add('show'); };
  const hide = (el) => { if (el) el.classList.remove('show'); };

  const INVITE_URL = "https://m.site.naver.com/1VRaQ";
  const API_URL = "https://script.google.com/macros/s/AKfycbwrMjZy_pjLr3YUSh-ylaxJpfzH23Ik-h7awy6fF4Q3Doha0P2dvPmCt2LhMv7p0v4Tpw/exec";
  const SPEED_SCALE = 0.7;

  let isSubmittingGift = false;

  const canvas = $("game");
  if (!canvas) { console.error("canvas#game not found"); return; }
  const ctx = canvas.getContext("2d");

  const hud = $("hud");
  const scoreEl = $("score");

  const startOverlay = $("startOverlay");
  const btnStart = $("btnStart");
  const btnGuide = $("btnGuide");

  const guideOverlay = $("guideOverlay");
  const btnGuideCloseGuide = $("btnGuideCloseGuide");

  const pauseOverlay = $("pauseOverlay");
  const btnPause = $("btnPause");
  const btnResume = $("btnResume");

  const gameOverOverlay = $("gameOverOverlay");
  const btnRetry = $("btnRetry");
  const btnOpenGuide2 = $("btnOpenGuide2");
  const deathPhotoEl = $("deathPhoto");

  const finalOverlay = $("finalOverlay");
  const btnFinalClose = $("btnFinalClose");
  const btnFinalRestart = $("btnFinalRestart");
  const btnInviteLink = $("btnInviteLink");

  const giftNameEl = $("giftName");
  const giftPhoneEl = $("giftPhone");
  const btnGiftSubmit = $("btnGiftSubmit");
  const giftStatusEl = $("giftStatus");

  function resize() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize, { passive: true });

  let groundY = 520;
  let running = false;
  let score = 0;

  const player = { x: 70, y: 0, w: 70, h: 70, vy: 0, jumpsLeft: 2, onGround: true };

  const obstacles = [];
  let spawnTimer = 0;
  const OBSTACLE_GAP_MIN = 340;
  const OBSTACLE_GAP_MAX = 520;
  let nextGap = rand(OBSTACLE_GAP_MIN, OBSTACLE_GAP_MAX);

  const HIT_SHRINK = 10;

  const MAX_PHOTOS = 30;
  const photoExts = ["jpg","jpeg","png","webp"];
  const photoCandidates = [];
  for (let i=1;i<=MAX_PHOTOS;i++){
    const n2 = String(i).padStart(2,"0");
    for (const ext of photoExts) photoCandidates.push(`photos/photo${n2}.${ext}`);
  }
  const choice = (arr) => arr[Math.floor(Math.random()*arr.length)];
  function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  async function pickExistingPhoto() {
    for (let tries=0; tries<8; tries++){
      const p = choice(photoCandidates);
      try{
        const r = await fetch(p, { method:"HEAD", cache:"no-store" });
        if (r.ok) return p;
      }catch(e){}
    }
    return "assets/map.png";
  }

  function clear() {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    ctx.clearRect(0,0,w,h);
  }

  function roundRect(x,y,w,h,r,fill,stroke){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    if (fill){ ctx.fillStyle = fill; ctx.fill(); }
    if (stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function circle(cx,cy,r,fill,stroke){
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    if (fill){ ctx.fillStyle = fill; ctx.fill(); }
    if (stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function face(cx, cy){
    ctx.save();
    ctx.fillStyle = "rgba(59,43,53,.85)";
    circle(cx-6, cy-2, 2.2, ctx.fillStyle);
    circle(cx+6, cy-2, 2.2, ctx.fillStyle);
    ctx.strokeStyle = "rgba(59,43,53,.75)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy+6, 6, 0.1*Math.PI, 0.9*Math.PI); ctx.stroke();
    ctx.restore();
  }

  function heart(cx,cy,s){
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx, cy - s, cx - s*1.2, cy - s, cx - s*1.2, cy);
    ctx.bezierCurveTo(cx - s*1.2, cy + s*1.2, cx, cy + s*1.6, cx, cy + s*2.2);
    ctx.bezierCurveTo(cx, cy + s*1.6, cx + s*1.2, cy + s*1.2, cx + s*1.2, cy);
    ctx.bezierCurveTo(cx + s*1.2, cy - s, cx, cy - s, cx, cy);
    ctx.fill();
  }

  function drawGround() {
    const w = canvas.getBoundingClientRect().width;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(255,111,174,.45)";
    ctx.fillRect(0, groundY+50, w, 6);
    ctx.restore();
  }

  function drawPlayer() {
    ctx.save();
    const x = player.x, y = player.y;
    roundRect(x, y, player.w, player.h, 18, "rgba(255,255,255,.95)", "rgba(0,0,0,.08)");

    const bx = x + 8, by = y + 10;
    const gx = x + 32, gy = y + 12;

    // rabbit ears
    roundRect(bx+6, by-14, 10, 18, 6, "rgba(255,255,255,.95)", "rgba(0,0,0,.10)");
    roundRect(bx+20, by-14, 10, 18, 6, "rgba(255,255,255,.95)", "rgba(0,0,0,.10)");
    circle(bx+18, by+18, 16, "rgba(255,255,255,.98)", "rgba(0,0,0,.10)");
    face(bx+18, by+18);

    // bear
    circle(gx+4, gy+6, 6, "rgba(255,255,255,.95)", "rgba(0,0,0,.10)");
    circle(gx+28, gy+6, 6, "rgba(255,255,255,.95)", "rgba(0,0,0,.10)");
    circle(gx+16, gy+20, 16, "rgba(255,255,255,.98)", "rgba(0,0,0,.10)");
    face(gx+16, gy+20);

    // heart hand
    ctx.fillStyle = "rgba(255,111,174,.85)";
    heart(x+36, y+46, 7);
    ctx.restore();
  }

  function label(x,y,w,text){
    ctx.save();
    roundRect(x+10, y+10, w-20, 24, 12, "rgba(255,111,174,.12)", "rgba(255,111,174,.30)");
    ctx.fillStyle = "rgba(59,43,53,.90)";
    ctx.font = "900 12px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x+w/2, y+22);
    ctx.restore();
  }

  function pictBus(cx, cy, w, h){
    const x = cx - w/2, y = cy - h/2;
    roundRect(x, y, w, h, 10, "rgba(127,225,211,.22)", "rgba(12,58,51,.25)");
    roundRect(x+8, y+8, w-16, 12, 6, "rgba(255,255,255,.9)", "rgba(0,0,0,.08)");
    circle(x+10, y+h-8, 3, "rgba(255,221,130,.95)", "rgba(0,0,0,.10)");
    circle(x+w-10, y+h-8, 3, "rgba(255,221,130,.95)", "rgba(0,0,0,.10)");
    circle(x+12, y+h+4, 4, "rgba(59,43,53,.25)");
    circle(x+w-12, y+h+4, 4, "rgba(59,43,53,.25)");
  }
  function pictSubway(cx, cy, w, h){
    const x = cx - w/2, y = cy - h/2;
    roundRect(x, y, w, h, 10, "rgba(255,151,198,.18)", "rgba(59,43,53,.22)");
    roundRect(x+10, y+8, w-20, 14, 7, "rgba(255,255,255,.92)", "rgba(0,0,0,.08)");
    circle(x+12, y+h-6, 3, "rgba(255,221,130,.95)", "rgba(0,0,0,.10)");
    circle(x+w-12, y+h-6, 3, "rgba(255,221,130,.95)", "rgba(0,0,0,.10)");
    ctx.strokeStyle="rgba(59,43,53,.20)";
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x+8, y+h+5); ctx.lineTo(x+w-8, y+h+5); ctx.stroke();
  }
  function pictTaxi(cx, cy, w, h){
    const x = cx - w/2, y = cy - h/2;
    roundRect(x, y+6, w, h-6, 10, "rgba(255,221,130,.22)", "rgba(59,43,53,.20)");
    roundRect(x+12, y, w-24, 16, 8, "rgba(255,255,255,.92)", "rgba(0,0,0,.08)");
    roundRect(cx-10, y-10, 20, 10, 6, "rgba(255,111,174,.18)", "rgba(255,111,174,.30)");
    circle(x+12, y+h+4, 4, "rgba(59,43,53,.25)");
    circle(x+w-12, y+h+4, 4, "rgba(59,43,53,.25)");
  }

  function drawObstacle(o){
    roundRect(o.x, o.y, o.w, o.h, 18, "rgba(255,255,255,.95)", "rgba(255,111,174,.40)");
    const cx = o.x + o.w/2;
    const cy = o.y + o.h/2 - 6;
    if (o.type === "bus"){ pictBus(cx, cy, 44, 32); label(o.x,o.y,o.w,"BUS"); }
    else if (o.type === "subway"){ pictSubway(cx, cy, 44, 32); label(o.x,o.y,o.w,"SUBWAY"); }
    else { pictTaxi(cx, cy, 44, 32); label(o.x,o.y,o.w,"TAXI"); }
  }

  function resetGame() {
    score = 0;
    if (scoreEl) scoreEl.textContent = String(score);

    const rect = canvas.getBoundingClientRect();
    groundY = rect.height - 180;

    player.y = groundY - player.h;
    player.vy = 0;
    player.onGround = true;
    player.jumpsLeft = 2;

    obstacles.length = 0;
    spawnTimer = 0;
    nextGap = rand(OBSTACLE_GAP_MIN, OBSTACLE_GAP_MAX);
  }

  function startGame() {
    resetGame();
    running = true;
    if (hud) hud.dataset.hidden = "0";
    hide(startOverlay); hide(guideOverlay); hide(gameOverOverlay); hide(finalOverlay); hide(pauseOverlay);
    lastT = 0;
    requestAnimationFrame(loop);
  }

  function endGameWin() { running = false; show(finalOverlay); }

  async function endGameLose() {
    running = false;
    if (deathPhotoEl) deathPhotoEl.src = await pickExistingPhoto();
    show(gameOverOverlay);
  }

  function rectsOverlap(a,b){
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }
  function playerHitBox(){
    return { x: player.x + HIT_SHRINK, y: player.y + HIT_SHRINK, w: player.w - HIT_SHRINK*2, h: player.h - HIT_SHRINK*2 };
  }

  function addScore(){
    score += 10;
    if (scoreEl) scoreEl.textContent = String(score);
    if (score >= 120) endGameWin();
  }

  function spawnObstacle() {
    const rect = canvas.getBoundingClientRect();
    const w = 92, h = 92;
    const x = rect.width + 20;
    const y = groundY - h + 22;
    const type = choice(["bus","subway","taxi"]);
    obstacles.push({ x, y, w, h, type });
  }

  let lastTap = 0;
  function handleTap() {
    const now = performance.now();
    const isDouble = (now - lastTap) < 280;
    lastTap = now;

    if (player.jumpsLeft <= 0) return;
    const base = -10.5;
    const extra = isDouble ? -1.2 : 0;
    player.vy = (base + extra);
    player.onGround = false;
    player.jumpsLeft -= 1;
  }

  let lastT = 0;
  function loop(t) {
    if (!running) return;

    const dt = Math.min(0.033, (t - lastT) / 1000 || 0);
    lastT = t;

    clear();

    player.vy += 24 * dt;
    player.y += player.vy * 60 * dt;

    if (player.y >= groundY - player.h) {
      player.y = groundY - player.h;
      player.vy = 0;
      if (!player.onGround) { player.onGround = true; player.jumpsLeft = 2; }
    }

    spawnTimer += (220 * dt) * SPEED_SCALE;
    if (spawnTimer >= nextGap) {
      spawnTimer = 0;
      nextGap = rand(OBSTACLE_GAP_MIN, OBSTACLE_GAP_MAX);
      spawnObstacle();
    }

    const speed = 180 * SPEED_SCALE;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;

      if (!o.passed && o.x + o.w < player.x) { o.passed = true; addScore(); }
      if (o.x + o.w < -30) obstacles.splice(i, 1);
    }

    drawGround();
    for (const o of obstacles) drawObstacle(o);
    drawPlayer();

    const pbox = playerHitBox();
    for (const o of obstacles) {
      const obox = { x: o.x + HIT_SHRINK, y: o.y + HIT_SHRINK, w: o.w - HIT_SHRINK*2, h: o.h - HIT_SHRINK*2 };
      if (rectsOverlap(pbox, obox)) { endGameLose(); return; }
    }

    requestAnimationFrame(loop);
  }

  async function submitGiftEntry() {
    if (isSubmittingGift) return;

    const name = (giftNameEl?.value || "").trim();
    const phoneRaw = (giftPhoneEl?.value || "").trim();
    const phone = phoneRaw.replace(/[^0-9]/g, "");
    if (!giftStatusEl) return;

    if (!name) { giftStatusEl.textContent = "이름을 입력해 주세요."; return; }
    if (phone.length < 10) { giftStatusEl.textContent = "휴대폰번호를 정확히 입력해 주세요."; return; }

    isSubmittingGift = true;
    giftStatusEl.textContent = "응모 중입니다…";
    if (btnGiftSubmit) btnGiftSubmit.disabled = true;

    try {
      await fetch(API_URL, { method: "POST", mode: "no-cors", body: new URLSearchParams({ name, phone }) });
      giftStatusEl.textContent = "✅ 응모 완료! 감사합니다 :)";
      if (giftNameEl) giftNameEl.disabled = true;
      if (giftPhoneEl) giftPhoneEl.disabled = true;
    } catch (e) {
      giftStatusEl.textContent = "전송 실패. 네트워크 확인 후 다시 시도해 주세요.";
      if (btnGiftSubmit) btnGiftSubmit.disabled = false;
      isSubmittingGift = false;
    }
  }

  function setPaused(p) {
    if (!running) return;
    if (p) { running = false; show(pauseOverlay); }
    else { hide(pauseOverlay); running = true; requestAnimationFrame(loop); }
  }

  function wire() {
    resize();
    show(startOverlay);
    hide(guideOverlay); hide(gameOverOverlay); hide(finalOverlay); hide(pauseOverlay);

    btnStart?.addEventListener("click", startGame);
    btnGuide?.addEventListener("click", () => { hide(startOverlay); show(guideOverlay); });
    btnGuideCloseGuide?.addEventListener("click", () => { hide(guideOverlay); show(startOverlay); });

    btnRetry?.addEventListener("click", () => { hide(gameOverOverlay); startGame(); });
    btnOpenGuide2?.addEventListener("click", () => { hide(gameOverOverlay); show(guideOverlay); });

    btnInviteLink?.addEventListener("click", () => { window.location.href = INVITE_URL; });
    btnFinalRestart?.addEventListener("click", () => { hide(finalOverlay); startGame(); });

    btnFinalClose?.addEventListener("click", () => {
      try { window.close(); } catch(e) {}
      hide(finalOverlay);
      show(startOverlay);
      if (hud) hud.dataset.hidden = "1";
    });

    btnPause?.addEventListener("click", () => setPaused(true));
    btnResume?.addEventListener("click", () => setPaused(false));

    btnGiftSubmit?.addEventListener("click", submitGiftEntry);

    canvas.addEventListener("pointerdown", () => {
      if (startOverlay?.classList.contains("show")) return;
      if (guideOverlay?.classList.contains("show")) return;
      if (finalOverlay?.classList.contains("show")) return;
      if (gameOverOverlay?.classList.contains("show")) return;
      if (pauseOverlay?.classList.contains("show")) return;
      handleTap();
    }, { passive: true });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") handleTap();
      if (e.code === "Escape") setPaused(true);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();