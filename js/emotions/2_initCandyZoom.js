export function initCandyZoom({ canvas, candy, options = {} }) {
  const {
    minScale = 0.5,
    maxScale = 2.5,
    wheelSpeed = 0.001,
    pinchSpeed = 0.005,
    dragSpeed = 0.002, // 單指拖動旋轉速度
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
  let lastDistance = null;

  const quat = candy.quaternion.clone();

  canvas.addEventListener("pointerdown", (e) => {
    // 只處理 touch / pen（mouse 你可以留原本的）
    if (e.pointerType === "mouse") return;

    canvas.setPointerCapture(e.pointerId);

    if (e.pointerType === "touch") {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    if (e.pointerType !== "touch") return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    const qx = new THREE.Quaternion();
    const qy = new THREE.Quaternion();

    qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * dragSpeed);
    qx.setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * dragSpeed);

    quat.premultiply(qy);
    quat.premultiply(qx);

    candy.quaternion.copy(quat);

    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;

    isDragging = false;
    lastDistance = null;

    canvas.releasePointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointercancel", () => {
    isDragging = false;
    lastDistance = null;
  });
}
