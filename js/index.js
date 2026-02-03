import * as THREE from "https://esm.sh/three";
import { SVGLoader } from "https://esm.sh/three/examples/jsm/loaders/SVGLoader.js";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";
import { gsap } from "https://esm.sh/gsap";

const BASE = location.hostname.includes("github.io") ? "/Candy_Factory" : "";

let infoFollowLock = false;
let activeBubble = null;
let soundFollowBubble = null;

const infoBox = document.getElementById("bubble-info");
const infoTitle = document.getElementById("info-title");
const infoText = document.getElementById("info-text");
const infoMore = document.getElementById("info-more");
const bubbleHint = document.getElementById("bubble-hint");
const infoSoundUI = document.getElementById("info-sound-ui");

const infoDataRoot = document.getElementById("bubble-info-data");
const labelDataRoot = document.getElementById("bubble-labels-data");

function getInfoData(index) {
  const el = infoDataRoot.querySelector(`[data-index="${index}"]`);
  if (!el) return { title: "", text: "", url: "" };
  return {
    title: el.dataset.title || "",
    text: el.dataset.text || "",
    url: el.dataset.url || "",
  };
}

function getLabelText(index) {
  const el = labelDataRoot.querySelector(`[data-index="${index}"]`);
  return el ? el.textContent.trim() : "";
}

const canvas = document.querySelector("#webgl");
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

let DPR = Math.min(window.devicePixelRatio, 2);

renderer.setPixelRatio(DPR);
renderer.setSize(sizes.width, sizes.height);

renderer.physicallyCorrectLights = true;

const bgm = new Audio(`${BASE}/assets/sounds/tech glow.mp3`);
bgm.loop = true;
bgm.volume = 0.6;
let bgmStarted = false;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const track = audioContext.createMediaElementSource(bgm);
const analyser = audioContext.createAnalyser();

analyser.fftSize = 32; // 低負載，反應速度快
const freqData = new Uint8Array(analyser.frequencyBinCount);

// connect
track.connect(analyser);
analyser.connect(audioContext.destination);

// checkbox
const danceCheckbox = document.getElementById("bubble-dance");

// 確保 audioContext 在第一次播放後啟動
window.addEventListener("click", () => {
  if (audioContext.state === "suspended") audioContext.resume();
});

const soundPanel = document.getElementById("soundPanel");
const panelVolume = document.getElementById("bgm-volume");
const panelMute = document.getElementById("bgm-mute");
const infoVolume = document.getElementById("bgm-volume-info");
const infoMute = document.getElementById("bgm-mute-info");

function updateMuteText() {
  const text = bgm.muted || bgm.volume === 0 ? "取消靜音" : "靜音";
  if (panelMute) panelMute.textContent = text;
  if (infoMute) infoMute.textContent = text;
}

function syncVolume(value) {
  const v = Math.max(0, Math.min(1, parseFloat(value)));
  bgm.volume = v;
  if (panelVolume && panelVolume.value !== String(v)) panelVolume.value = v;
  if (infoVolume && infoVolume.value !== String(v)) infoVolume.value = v;
  if (v === 0) bgm.muted = true;
  updateMuteText();
}

if (panelVolume) {
  panelVolume.addEventListener("input", (e) => {
    syncVolume(e.target.value);
  });
}
if (infoVolume) {
  infoVolume.addEventListener("input", (e) => {
    syncVolume(e.target.value);
  });
}

function toggleMute() {
  bgm.muted = !bgm.muted;
  if (bgm.muted) {
    if (panelVolume) panelVolume.value = 0;
    if (infoVolume) infoVolume.value = 0;
  }
  updateMuteText();
}

if (panelMute) {
  panelMute.addEventListener("click", () => {
    toggleMute();
  });
}
if (infoMute) {
  infoMute.addEventListener("click", () => {
    toggleMute();
  });
}

window.addEventListener("click", () => {
  if (!bgmStarted) {
    bgm.play().catch(() => {});
    bgmStarted = true;
  }
});

const renderTarget = new THREE.WebGLRenderTarget(
  sizes.width * DPR,
  sizes.height * DPR,
);
renderTarget.depthTexture = new THREE.DepthTexture(
  sizes.width * DPR,
  sizes.height * DPR,
);
renderTarget.depthTexture.format = THREE.DepthFormat;
renderTarget.depthTexture.type = THREE.UnsignedShortType;

const svgLoader = new SVGLoader();
let svgGroup = new THREE.Group();

svgLoader.load(`${BASE}/assets/svg/logo.svg`, (data) => {
  data.paths.forEach((path) => {
    const shapes = SVGLoader.createShapes(path);
    shapes.forEach((shape) => {
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({
          color: path.color,
          side: THREE.DoubleSide,
        }),
      );
      svgGroup.add(mesh);
    });
  });

  const box = new THREE.Box3().setFromObject(svgGroup);
  const center = box.getCenter(new THREE.Vector3());
  svgGroup.position.x -= center.x;
  svgGroup.scale.set(0.008, -0.008, 0.08);
  svgGroup.position.set(-5.5, 3, 0);
  scene.add(svgGroup);
});

// xPct / yPct：以螢幕寬高為基準（0 ~ 1）
const bubbleInfoOffset = [
  { xPct: 0.25, yPct: 0.9 }, // music
  { xPct: 2.5, yPct: -0.7 }, // shop
  { xPct: 0.55, yPct: -0.16 }, // contact
  { xPct: 0.82, yPct: -0.38 }, // about
  { xPct: 0.02, yPct: -0.12 }, // ???
];

const gltfLoader = new GLTFLoader();
const bubbles = [];

const bubbleUrls = [
  getInfoData(0).url || "./html/pages/shop.html",
  getInfoData(1).url || "./html/pages/shop.html",
  getInfoData(2).url || "./html/pages/contact.html",
  getInfoData(3).url || "./html/pages/about.html",
  "music",
];

function updateInfoContent(index) {
  // 從隱藏的 bubble-info-data 中讀取對應資料
  const dataNode = document.querySelector(
    `#bubble-info-data [data-index="${index}"]`,
  );

  if (!dataNode) return;

  const title = dataNode.dataset.title || "";
  const text = dataNode.dataset.text || "";
  const url = dataNode.dataset.url || "";

  // 填入文字內容
  infoTitle.innerText = title;
  infoText.innerText = text;

  infoMore.textContent = dataNode.dataset.btn || "了解更多";

  // ⭐ 設定「了解更多」按鈕
  if (!url || url === "#") {
    // 沒網址 → 隱藏按鈕（例如泡泡 0：音量控制）
    infoMore.style.display = "none";
  } else {
    // 有網址 → 顯示按鈕並綁定跳轉
    infoMore.style.display = "inline-block";
    infoMore.onclick = () => {
      window.location.href = url;
    };
  }
}

function onBubbleClick(bubble) {
  const index = bubbles.indexOf(bubble);
  const isSame = activeBubble === bubble;

  // ==========================================================
  // ⭐⭐ 再次點擊同一顆 → 返回 ⭐⭐
  // ==========================================================
  if (isSame) {
    hideInfo();
    if (soundPanel) soundPanel.style.display = "none";

    // 淡出下方提示字
    bubbleHint.style.opacity = 0;

    soundFollowBubble = null;
    resetCamera();
    activeBubble = null;
    return;
  }

  const worldPos = new THREE.Vector3();
  bubble.getWorldPosition(worldPos);

  // ==========================================================
  // ⭐⭐ 泡泡 0：音量控制取代 info ⭐⭐
  // ==========================================================
  if (index === 0) {
    hideInfo();
    activeBubble = null;
    activeBubble = bubble;

    bubbles.forEach((b) => (b.userData.followPaused = false));
    bubble.userData.followPaused = true;

    // 泡泡淡出
    bubble.traverse((child) => {
      if (child.isMesh && child.material) {
        gsap.to(child.material, {
          opacity: 0,
          duration: 0.25,
          ease: "power2.out",
        });
      }
    });

    // 鏡頭移動
    const offset = bubbleCameraOffsets[0] || new THREE.Vector3(0, 0, 0);
    const camTarget = worldPos.clone().add(offset);

    gsap.to(camera.position, {
      x: camTarget.x,
      y: camTarget.y,
      z: 6,
      duration: 1.1,
      ease: "power3.inOut",
    });

    // 顯示音量控制（淡入）
    soundPanel.style.display = "block";
    soundPanel.style.opacity = 0;
    requestAnimationFrame(() => {
      soundPanel.style.transition = "opacity 0.35s ease";
      soundPanel.style.opacity = 1;
    });

    soundFollowBubble = bubble;

    // 播音樂
    if (!bgmStarted) {
      bgm.play().catch(() => {});
      bgmStarted = true;
    }

    // ⭐ 顯示下方提示字（淡入）
    bubbleHint.style.opacity = 1;

    return; // 不進入 info 流程
  }

  // ==========================================================
  // ⭐⭐ 其他泡泡 → 正常 info 流程 ⭐⭐
  // ==========================================================
  if (soundPanel) soundPanel.style.display = "none";
  soundFollowBubble = null;

  activeBubble = bubble;

  bubbles.forEach((b) => (b.userData.followPaused = false));
  bubble.userData.followPaused = true;

  const needCrossFade = activeBubble && activeBubble !== bubble;

  if (needCrossFade) {
    infoFollowLock = true;
    infoBox.style.opacity = 0;

    setTimeout(() => {
      updateInfoContent(index);
      infoBox.style.display = "block";

      requestAnimationFrame(() => {
        infoFollowLock = false;
        infoBox.style.opacity = 1;
      });
    }, 350);
  } else {
    updateInfoContent(index);
    showInfo();
  }

  // 鏡頭移動
  const offset = bubbleCameraOffsets[index] || new THREE.Vector3(0, 0, 0);
  const camTarget = worldPos.clone().add(offset);

  gsap.to(camera.position, {
    x: camTarget.x,
    y: camTarget.y,
    z: 6,
    duration: 1.1,
    ease: "power3.inOut",
  });

  // ⭐ 顯示提示字（淡入）
  bubbleHint.style.opacity = 1;
}

function showInfo() {
  infoBox.style.display = "block";
  requestAnimationFrame(() => {
    infoBox.style.opacity = 1;
  });
}

function hideInfo() {
  infoBox.style.opacity = 0;
  setTimeout(() => {
    infoBox.style.display = "none";
  }, 350);
  if (bubbleHint) bubbleHint.style.opacity = 0;
}

const bubbleConfigs = [
  { pos: [1.5, 4, 1.5], rot: [0, Math.PI, Math.PI], scale: [1.8, 1.8, 1] },
  { pos: [-2.8, -1.3, 5.0], rot: [0, Math.PI, Math.PI / 2], scale: [2, 2, 2] },
  {
    pos: [-6.5, -1.3, 3.0],
    rot: [0, Math.PI, Math.PI / 2],
    scale: [2, 2, 2],
  },
  {
    pos: [-8, 0.3, 3],
    rot: [0, Math.PI, Math.PI / 2],
    scale: [4, 3, 3],
  },
  { pos: [-2.0, -1.5, 1.5], rot: [0, Math.PI, Math.PI / 3], scale: [1, 1, 1] },
];

const bubbleCameraOffsets = [
  new THREE.Vector3(0, -2, 0),
  new THREE.Vector3(4, 0.5, 0),
  new THREE.Vector3(5, 0.5, 0),
  new THREE.Vector3(6, 0.3, 0),
  new THREE.Vector3(1.8, 0.5, 0),
];

const bubbleVertexShader = `
  precision mediump float;

  uniform vec3 uHoverPos;
  uniform float uHoverRadius;
  uniform float uDeformAmount;

  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec3 pos = position;
    vec3 worldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

    float dist = length(worldPos - uHoverPos);
    if (dist < uHoverRadius) {
      float effect = cos(dist / uHoverRadius * 3.14159) * uDeformAmount;
      pos -= normal * effect;
      worldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    }

    vWorldPos = worldPos;
    gl_Position =
      projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const bubbleFragmentShader = `
 precision mediump float;

uniform sampler2D uScene;
uniform vec2 uResolution;

uniform float uRefraction;
uniform float uInnerRefraction;
uniform float uAberration;
uniform float uBlur;

uniform float uTransmission;

uniform vec3 uCameraPos;
uniform float uTime;

uniform float uFilmThickness;
uniform float uFilmThicknessInner;

uniform vec3 uHoverPos;
uniform float uHoverRadius;
uniform float uDeformRefract;

varying vec3 vNormal;
varying vec3 vWorldPos;

vec3 thinFilmColor(float thickness, float angleShift) {
    float t = thickness * 15.0 + angleShift;

    return vec3(
        sin(t) * 0.5 + 0.5,
        sin(t + 2.1) * 0.5 + 0.5,
        sin(t + 4.2) * 0.5 + 0.5
    );
}

vec3 fakeEnvReflection(vec3 n, vec3 viewDir) {
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    return vec3(1.0) * fres * 0.45;
}

void main() {

    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);

   vec2 uv = gl_FragCoord.xy / uResolution;


 float aspect = uResolution.x / uResolution.y;
    vec2 nScreen = vec2(n.x * aspect, n.y);
    vec2 nDir = normalize(nScreen);

    float hoverDist = length(vWorldPos - uHoverPos);
    if (hoverDist < uHoverRadius) {
        float deform = cos(hoverDist / uHoverRadius * 3.14159) * uDeformRefract * 1.4;
        uv += n.xy * deform;
    }

  float px = 1.0 / min(uResolution.x, uResolution.y);

vec2 refractOuter = n.xy * uRefraction * px;
vec2 refractInner = n.xy * uInnerRefraction * px;



    float kR = 0.7;
    float kG = 1.0;
    float kB = 1.4;

    vec3 colR = texture2D(uScene, uv + refractOuter * (kR + uAberration)).rgb;
    vec3 colG = texture2D(uScene, uv + refractOuter * (kG)).rgb;
    vec3 colB = texture2D(uScene, uv + refractOuter * (kB - uAberration)).rgb;

    vec3 outer = vec3(colR.r, colG.g, colB.b);

   

    vec3 innerR = texture2D(uScene, uv + refractInner * (kR + uAberration)).rgb;
    vec3 innerG = texture2D(uScene, uv + refractInner * (kG)).rgb;
    vec3 innerB = texture2D(uScene, uv + refractInner * (kB - uAberration)).rgb;

    vec3 inner = vec3(innerR.r, innerG.g, innerB.b);

    vec3 color = mix(inner, outer, 0.55);

    float angle = pow(1.0 - abs(dot(n, viewDir)), 4.0);
    vec3 filmOuter = thinFilmColor(uFilmThickness, angle * 10.0 + uTime * 0.8);
    color += filmOuter * angle * 0.9;

    vec3 filmInner = thinFilmColor(uFilmThicknessInner, angle * 13.0 + uTime * 0.5);
    color += filmInner * angle * 0.6;

    color += fakeEnvReflection(n, viewDir);

    gl_FragColor = vec4(color, uTransmission);
}
`;

gltfLoader.load(`${BASE}/assets/models/bubble.glb`, (gltf) => {
  for (let i = 0; i < bubbleConfigs.length; i++) {
    const bubbleClone = gltf.scene.clone();
    const cfg = bubbleConfigs[i];

    bubbleClone.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.ShaderMaterial({
          uniforms: {
            uInnerRefraction: { value: 11 },
            uFilmThicknessInner: { value: 1.8 },
            uScene: { value: renderTarget.texture },
            uResolution: {
              value: new THREE.Vector2(sizes.width * DPR, sizes.height * DPR),
            },
            uFilmThickness: { value: 4 },
            uTime: { value: 1 },
            uRefraction: { value: 18 },
            uAberration: { value: 0.7 },
            uBlur: { value: 0.005 },
            uTransmission: { value: 1 },
            uHoverPos: { value: new THREE.Vector3(1000, 1000, 1000) },
            uHoverRadius: { value: 0.3 },
            uDeformAmount: { value: 0.001 },
            uDeformRefract: { value: 0.001 },
            uIridescenceStrength: { value: 1.2 },
            uIridescenceSpeed: { value: 6 },
            uIridescenceShift: { value: Math.random() * 10.0 },
            uCameraPos: { value: camera.position.clone() },
          },
          vertexShader: bubbleVertexShader,
          fragmentShader: bubbleFragmentShader,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      }
    });

    const labelText = getLabelText(i);
    const div = document.createElement("div");
    div.className = "label";
    div.innerText = labelText;
    div.style.position = "absolute";
    div.style.color = "#fff";
    div.style.pointerEvents = "auto";
    div.style.fontFamily = "Arial";
    div.style.display = "none";
    document.body.appendChild(div);
    bubbleClone.userData.labelDiv = div;

    bubbleClone.userData.url = bubbleUrls[i];

    const basePos = new THREE.Vector3(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    const baseScale = new THREE.Vector3(
      cfg.scale[0],
      cfg.scale[1],
      cfg.scale[2],
    );
    bubbleClone.position.copy(basePos);
    bubbleClone.userData.basePos = basePos;
    bubbleClone.userData.baseScale = baseScale;

    bubbleClone.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
    bubbleClone.scale.copy(baseScale);

    scene.add(bubbleClone);
    bubbles.push(bubbleClone);
  }

  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  const directional = new THREE.DirectionalLight(0xffffff, 1);
  directional.position.set(5, 10, 7);
  scene.add(ambient, directional);
});

const raycaster = new THREE.Raycaster();
const mouse = { x: 0, y: 0 };

window.addEventListener("mousemove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

function worldToScreen(pos) {
  const p = pos.clone().project(camera);
  return {
    x: (p.x * 0.5 + 0.5) * window.innerWidth,
    y: (-p.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function resetCamera() {
  activeBubble = null;
  bubbles.forEach((b) => (b.userData.followPaused = false));
  gsap.to(camera.position, {
    x: 0,
    y: 0,
    z: 6,
    duration: 1.2,
    ease: "power3.inOut",
  });
}

window.addEventListener("click", (e) => {
  const mouseClick = new THREE.Vector2();
  mouseClick.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseClick.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouseClick, camera);
  const intersects = raycaster.intersectObjects(bubbles, true);

  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (!obj.userData.url && obj.parent) obj = obj.parent;
    if (obj.userData.url) onBubbleClick(obj);
  }
});

let logoRotateStrength = 0.15;
const logoParallax = 0.01;
const bubbleParallax = 0.2;
const bubbleOffsetX = -0.02;
const bubbleOffsetY = -0.01;

function animate() {
  requestAnimationFrame(animate);

  const t = performance.now() * 0.001;
  const px = mouse.x;
  const py = mouse.y;

  if (svgGroup) {
    svgGroup.position.x +=
      (-5.5 + px * logoParallax - svgGroup.position.x) * 0.008;
    svgGroup.position.y +=
      (3 + py * logoParallax - svgGroup.position.y) * 0.008;

    svgGroup.rotation.y +=
      (px * logoRotateStrength - svgGroup.rotation.y) * 0.04;
    svgGroup.rotation.x +=
      (-py * logoRotateStrength - svgGroup.rotation.x) * 0.08;
  }

  bubbles.forEach((b, i) => {
    const phase = i * 0.8;
    const base = b.userData.basePos;
    const baseScale = b.userData.baseScale || new THREE.Vector3(1, 1, 1);

    const floatOffset = Math.sin(t * 1.2 + phase) * 0.03;

    const targetX = base.x + px * bubbleParallax + bubbleOffsetX;
    const targetY = base.y + py * bubbleParallax + bubbleOffsetY + floatOffset;

    b.position.x += (targetX - b.position.x) * 0.08;
    b.position.y += (targetY - b.position.y) * 0.06;

    const s = 1.0 + Math.sin(t * 1.5 + phase) * 0.003;
    b.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);

    b.traverse((child) => {
      if (child.isMesh) {
        child.material.uniforms.uTime.value = t;
        child.material.uniforms.uCameraPos.value.copy(camera.position);
      }
    });
    // ----------------------------------------------------
    // ⭐⭐ 泡泡跳舞（音頻反應）
    // ----------------------------------------------------
    if (danceCheckbox && danceCheckbox.checked) {
      analyser.getByteFrequencyData(freqData);

      // 取平均音量（0~255）
      let level = 0;
      for (let j = 0; j < freqData.length; j++) level += freqData[j];
      level = level / freqData.length;
      const audioStrength = level / 255; // 0~1

      // ------------------------------------------------
      // ⭐ ① 泡泡縮放（呼吸感）
      // ------------------------------------------------
      const scalePulse = 1 + audioStrength * 0.35; // 最高 +35%
      b.scale.set(
        baseScale.x * scalePulse,
        baseScale.y * scalePulse,
        baseScale.z * scalePulse,
      );

      // ------------------------------------------------
      // ⭐ ② 虹光改強（使用你的 uniform）
      // ------------------------------------------------
      b.traverse((child) => {
        if (!child.isMesh) return;

        // 外層膜變厚 → 顏色更亮、更强烈
        if (child.material.uniforms.uFilmThickness)
          child.material.uniforms.uFilmThickness.value =
            4 + audioStrength * 12.0; // 原4 → 最大16

        // 流速加快 → 色彩流動感更明顯
        if (child.material.uniforms.uIridescenceSpeed)
          child.material.uniforms.uIridescenceSpeed.value =
            6 + audioStrength * 25.0; // 原6 → 最大31

        // 讓薄膜顏色飽和度倍增
        if (child.material.uniforms.uAberration)
          child.material.uniforms.uAberration.value = 0.7 + audioStrength * 1.3; // 原0.7 → 最大2.0

        // 讓外層折射變強 → 華麗感↑
        if (child.material.uniforms.uRefraction)
          child.material.uniforms.uRefraction.value =
            0.03 + audioStrength * 0.06; // 原0.03 → 最高0.09
      });
    } else {
      // ----------------------------------------------------
      // ⭐ 恢復原本狀態
      // ----------------------------------------------------
      b.scale.copy(baseScale);

      b.traverse((child) => {
        if (!child.isMesh) return;

        if (child.material.uniforms.uFilmThickness)
          child.material.uniforms.uFilmThickness.value = 4;

        if (child.material.uniforms.uIridescenceSpeed)
          child.material.uniforms.uIridescenceSpeed.value = 6;

        if (child.material.uniforms.uAberration)
          child.material.uniforms.uAberration.value = 0.7;

        if (child.material.uniforms.uRefraction)
          child.material.uniforms.uRefraction.value = 0.03;
      });
    }
  });

  if (bubbles.length > 0) {
    bubbles.forEach((b) => (b.visible = false));
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    bubbles.forEach((b) => (b.visible = true));
  }

  bubbles.forEach((b) => {
    if (b.userData.labelDiv) b.userData.labelDiv.style.display = "none";
  });

  if (activeBubble && !infoFollowLock) {
    const index = bubbles.indexOf(activeBubble);
    const worldPos = new THREE.Vector3();
    activeBubble.getWorldPosition(worldPos);

    const screenPos = worldToScreen(worldPos);
    const offset = bubbleInfoOffset[index];

    const offsetX = offset.xPct * window.innerWidth;
    const offsetY = offset.yPct * window.innerHeight;

    let left = screenPos.x + offsetX;
    let top = screenPos.y + offsetY;

    left = Math.max(20, Math.min(left, window.innerWidth - 320));
    top = Math.max(80, Math.min(top, window.innerHeight - 160));

    infoBox.style.left = left + "px";
    infoBox.style.top = top + "px";
  }

  if (soundFollowBubble) {
    const index = bubbles.indexOf(soundFollowBubble);

    const worldPos = new THREE.Vector3();
    soundFollowBubble.getWorldPosition(worldPos);

    const screenPos = worldToScreen(worldPos);
    const offset = bubbleInfoOffset[index];

    const offsetX = offset.xPct * window.innerWidth;
    const offsetY = offset.yPct * window.innerHeight;

    const PANEL_W = 280;
    const PANEL_H = 220;

    let left = screenPos.x + offsetX;
    let top = screenPos.y + offsetY;

    const RIGHT_SAFE = -150;

    left = Math.max(
      20,
      Math.min(left, window.innerWidth - PANEL_W - RIGHT_SAFE),
    );
    top = Math.max(160, Math.min(top, window.innerHeight - PANEL_H - 20));

    soundPanel.style.left = left + "px";
    soundPanel.style.top = top + "px";
  }

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(bubbles, true);

  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (!obj.userData.labelDiv && obj.parent) obj = obj.parent;

    if (obj.userData.labelDiv) {
      const label = obj.userData.labelDiv;
      label.style.display = label.innerText.trim() ? "block" : "none";

      const mx = ((mouse.x + 1) / 2) * window.innerWidth;
      const my = ((-mouse.y + 1) / 2) * window.innerHeight;
      label.style.left = mx + 20 + "px";
      label.style.top = my + 10 + "px";
    }

    obj.traverse((child) => {
      if (child.isMesh) {
        child.material.uniforms.uHoverPos.value.copy(intersects[0].point);

        child.material.uniforms.uDeformAmount.value = THREE.MathUtils.lerp(
          child.material.uniforms.uDeformAmount.value,
          0.45,
          0.18,
        );

        child.material.uniforms.uDeformRefract.value = THREE.MathUtils.lerp(
          child.material.uniforms.uDeformRefract.value,
          0.22,
          0.18,
        );
      }
    });
  }

  if (intersects.length === 0) {
    bubbles.forEach((b) => {
      if (b.userData.labelDiv) b.userData.labelDiv.style.display = "none";

      b.traverse((child) => {
        if (child.isMesh) {
          child.material.uniforms.uHoverPos.value.set(9999, 9999, 9999);

          child.material.uniforms.uDeformAmount.value = THREE.MathUtils.lerp(
            child.material.uniforms.uDeformAmount.value,
            0.15,
            0.1,
          );

          child.material.uniforms.uDeformRefract.value = THREE.MathUtils.lerp(
            child.material.uniforms.uDeformRefract.value,
            0.05,
            0.1,
          );
        }
      });
    });
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  DPR = Math.min(window.devicePixelRatio, 2);

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(DPR);
  renderer.setSize(sizes.width, sizes.height);

  renderTarget.setSize(sizes.width * DPR, sizes.height * DPR);

  if (bubbles.length > 0) {
    bubbles.forEach((b) => {
      b.traverse((child) => {
        if (
          child.isMesh &&
          child.material.uniforms &&
          child.material.uniforms.uResolution
        ) {
          child.material.uniforms.uResolution.value.set(
            sizes.width * DPR,
            sizes.height * DPR,
          );
        }
      });
    });
  }
});

function updateRotateHint() {
  const isMobile = window.innerWidth < 900;
  const isPortrait = window.innerHeight > window.innerWidth;

  const hint = document.getElementById("rotate-hint");

  if (isMobile && isPortrait) {
    hint.style.display = "flex";
  } else {
    hint.style.display = "none";
  }
}

window.addEventListener("resize", updateRotateHint);
window.addEventListener("orientationchange", updateRotateHint);

let interactionLocked = false;

// 初始化
updateRotateHint();
