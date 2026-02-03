export function initCandyZoom({ canvas, candy, options = {} }) {
  const {
    minScale = 0.5,
    maxScale = 2.5,
    wheelSpeed = 0.001,
    pinchSpeed = 0.005,
    dragSpeed = 0.005, // 單指拖動旋轉速度
  } = options;

  if (!canvas || !candy) return;

  // ========= 滑鼠滾輪縮放 =========
  function zoomByDelta(delta) {
    const scaleDelta = 1 - delta * wheelSpeed;
    candy.scale.multiplyScalar(scaleDelta);
    candy.scale.clampScalar(minScale, maxScale);
  }

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomByDelta(e.deltaY);
    },
    { passive: false },
  );

  // ========= 觸控 =========
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  const quat = candy.quaternion.clone();

  function onTouchMove(e) {
    e.preventDefault();

    if (!isDragging || e.touches.length !== 1) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    const dx = x - lastX;
    const dy = y - lastY;

    const qx = new THREE.Quaternion();
    const qy = new THREE.Quaternion();

    qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.005);
    qx.setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.005);

    quat.premultiply(qy);
    quat.premultiply(qx);

    candy.quaternion.copy(quat);

    lastX = x;
    lastY = y;
  }

  function onTouchEnd() {
    isDragging = false;
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  }

  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;

    isDragging = true;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;

    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
  });

  function onTouchEnd(e) {
    if (e.touches.length === 0) {
      isDragging = false;
      lastDistance = null;

      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    }
  }
}
