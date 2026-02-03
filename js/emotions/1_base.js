// 操作說明、卡片晃動

export function initHintModal() {
  const openHint = document.getElementById("openHint");
  const closeHint = document.getElementById("closeHint");
  const hintModal = document.getElementById("hintModal");
  if (!openHint || !hintModal) return;

  openHint.onclick = () => (hintModal.style.display = "flex");
  if (closeHint) {
    closeHint.onclick = () => (hintModal.style.display = "none");
  }

  hintModal.addEventListener("click", (e) => {
    if (e.target === hintModal) hintModal.style.display = "none";
  });

  const KEY = "emotionCandyHintSeen";
  if (!localStorage.getItem(KEY)) {
    setTimeout(() => {
      hintModal.style.display = "flex";
    }, 600);
    localStorage.setItem(KEY, "true");
  }
}

export function initInfoCardTilt(cardId = "info-card") {
  const card = document.getElementById(cardId);
  if (!card) return;

  let tRX = 0,
    tRY = 0,
    cRX = 0,
    cRY = 0;
  const MAX = 6,
    EASE = 0.12;

  function animate() {
    cRX += (tRX - cRX) * EASE;
    cRY += (tRY - cRY) * EASE;
    card.style.setProperty("--tilt-rx", cRX + "deg");
    card.style.setProperty("--tilt-ry", cRY + "deg");
    requestAnimationFrame(animate);
  }

  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tRY = x * MAX * 2;
    tRX = -y * MAX * 2;
  });

  card.addEventListener("mouseleave", () => {
    tRX = 0;
    tRY = 0;
  });

  animate();
}

// 不知道為什麼得加這個，功能才能正常運作
(function () {
  const card = document.getElementById("info-card");
  if (!card) return;

  let tRX = 0,
    tRY = 0,
    cRX = 0,
    cRY = 0,
    raf = null;
  const MAX = 6,
    EASE = 0.12;

  function anim() {
    cRX += (tRX - cRX) * EASE;
    cRY += (tRY - cRY) * EASE;
    card.style.setProperty("--tilt-rx", cRX + "deg");
    card.style.setProperty("--tilt-ry", cRY + "deg");
    if (Math.abs(cRX - tRX) > 0.1 || Math.abs(cRY - tRY) > 0.1)
      raf = requestAnimationFrame(anim);
    else raf = null;
  }

  function move(e) {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tRY = x * MAX * 2;
    tRX = -y * MAX * 2;
    if (!raf) anim();
  }
  function leave() {
    tRX = 0;
    tRY = 0;
    if (!raf) anim();
  }

  card.addEventListener("mousemove", move);
  card.addEventListener("mouseleave", leave);
})();

// 不知道為什麼得加這個，功能才能正常運作
// 總之是提示卡片
// 第一次進頁自動顯示操作說明
const hasSeenHint = localStorage.getItem("anxietyHintSeen");

if (!hasSeenHint) {
  // 稍微延遲一下，等畫面穩定再跳出
  setTimeout(() => {
    hintModal.style.display = "flex";
  }, 600);

  localStorage.setItem("candyFactoryHintSeen", "true");
}

const openHint = document.getElementById("openHint");
const closeHint = document.getElementById("closeHint");
const hintModal = document.getElementById("hintModal");

openHint.addEventListener("click", () => {
  hintModal.style.display = "flex";
});

closeHint.addEventListener("click", () => {
  hintModal.style.display = "none";
});

// 點背景也可以關
hintModal.addEventListener("click", (e) => {
  if (e.target === hintModal) {
    hintModal.style.display = "none";
  }
});
