/* =============================
   提示 Modal
============================= */
export function initHintModal() {
  const hintModal = document.getElementById("hintModal");
  const openBtn = document.getElementById("openHint");
  const closeBtn = document.getElementById("closeHint");
  if (!hintModal || !openBtn) return;

  function showModal() {
    hintModal.classList.add("show");
  }

  function hideModal() {
    hintModal.classList.remove("show");
  }

  // 點按按鈕開啟 / 關閉
  openBtn.addEventListener("click", showModal);
  if (closeBtn) closeBtn.addEventListener("click", hideModal);

  // 點背景也可關閉
  hintModal.addEventListener("click", (e) => {
    if (e.target === hintModal) hideModal();
  });

  // 首次進頁自動顯示（不再檢查 localStorage）
  setTimeout(() => showModal(), 600);
}

/* =============================
   Info Card Tilt（滑鼠傾斜效果）
============================= */
export function initInfoCardTilt(cardId = "info-card") {
  const card = document.getElementById(cardId);
  if (!card) return;

  let targetRX = 0,
    targetRY = 0,
    currentRX = 0,
    currentRY = 0;

  const MAX = 6,
    EASE = 0.12;

  function animate() {
    currentRX += (targetRX - currentRX) * EASE;
    currentRY += (targetRY - currentRY) * EASE;
    card.style.setProperty("--tilt-rx", currentRX + "deg");
    card.style.setProperty("--tilt-ry", currentRY + "deg");
    requestAnimationFrame(animate);
  }

  function updateTilt(e) {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    targetRY = x * MAX * 2;
    targetRX = -y * MAX * 2;
  }

  function resetTilt() {
    targetRX = 0;
    targetRY = 0;
  }

  card.addEventListener("mousemove", updateTilt);
  card.addEventListener("mouseleave", resetTilt);

  animate();
}
