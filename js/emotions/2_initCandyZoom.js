import * as THREE from "https://esm.sh/three";

/* =====================================================
   初始化互動
   說明：
   - modelRoot, camera 必須在 anxiety.js 已定義
   - 可調整 rotateSpeed / zoomSpeed
===================================================== */
export function initCandyZoom(modelRoot, camera) {
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  let touchDist = 0; // 兩指距離
  let initialZoom = 0;

  const rotateSpeed = 0.01;
  const zoomSpeed = 0.5;

  // ---------- 單指 / 滑鼠拖曳 ----------
  function startDrag(x, y) {
    isDragging = true;
    lastX = x;
    lastY = y;
  }
  function moveDrag(x, y) {
    if (!isDragging) return;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;
    modelRoot.rotation.y += dx * rotateSpeed;
    modelRoot.rotation.x += dy * rotateSpeed;
  }
  function endDrag() {
    isDragging = false;
  }

  // ---------- 雙指縮放 ----------
  function getDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pinchStart(touches) {
    if (touches.length < 2) return;
    touchDist = getDistance(touches[0], touches[1]);
    initialZoom = camera.position.z;
  }
  function pinchMove(touches) {
    if (touches.length < 2) return;
    const newDist = getDistance(touches[0], touches[1]);
    const delta = (touchDist - newDist) * 0.01; // 調整縮放敏感度
    camera.position.z = THREE.MathUtils.clamp(initialZoom + delta, 3, 25);
  }

  // ---------- 滑鼠事件 ----------
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" && e.isPrimary === false) return; // 非主手指 ignore
    startDrag(e.clientX, e.clientY);
  });
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" && e.isPrimary === false) return;
    moveDrag(e.clientX, e.clientY);
  });
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // ---------- 滑輪縮放 ----------
  window.addEventListener("wheel", (e) => {
    camera.position.z += Math.sign(e.deltaY) * zoomSpeed;
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, 3, 25);
  });
}

// 禁止滑鼠滾輪滾動頁面
window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

// 選出可滾動區塊
const scrollContainer = document.querySelector(".card-scroll");

// 阻止全局滑動
document.body.addEventListener(
  "touchmove",
  (e) => {
    // 如果滑動的 target 是可滾動區塊或其子元素，放行
    if (!scrollContainer.contains(e.target)) {
      e.preventDefault();
    }
  },
  { passive: false },
);

const { OverlayScrollbars } = OverlayScrollbarsGlobal;

OverlayScrollbars(document.querySelector("#scroll-container"), {});

OverlayScrollbars(document.querySelector("#scroll-container"), {
  scrollbars: {
    autoHide: "never",
  },
});

OverlayScrollbars(document.querySelector("#scroll-container"), {
  scrollbars: {
    autoHide: "never",
  },
  overflow: {
    x: "hidden",
    y: "scroll",
  },
});

OverlayScrollbars(document.querySelector("#scroll-container"), {
  scrollbars: {
    autoHide: "never", // 永遠顯示
    clickScrolling: true,
  },
  overflow: {
    x: "hidden",
    y: "scroll",
  },
});

OverlayScrollbars(document.querySelector("#scroll-container"), {
  scrollbars: {
    autoHide: "never", // 永遠顯示
    dragScroll: true,
    clickScrolling: true,
    visibility: "visible", // 明確強制顯示
  },
});
