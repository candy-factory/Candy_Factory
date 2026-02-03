import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";
import { initCandyZoom } from "./2_initCandyZoom.js";
import { initHintModal, initInfoCardTilt } from "./1_base.js";

const canvas = document.getElementById("webgl");

// ======= Scene / Camera / Renderer =======
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  500,
);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.setClearColor(0x000000, 0.0);
renderer.physicallyCorrectLights = true;

/* =====================================================
   Lights
===================================================== */
scene.add(new THREE.AmbientLight(0xffffff, 0.1));

const keyLight = new THREE.DirectionalLight(0xffffff, 8.0);
keyLight.position.set(2.5, 9, 3.0);
keyLight.castShadow = true;
keyLight.shadow.bias = -0.002;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 5.0);
rimLight.position.set(-3, 6, -4);
scene.add(rimLight);

/* =====================================================
   RenderTarget：先渲染糖果 → 外包裝折射使用
===================================================== */
let rtCandy = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    samples: 0,
  },
);

/* =====================================================
   Materials（沿用你原本的 shader）
===================================================== */
const bubbleMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uIor: { value: 1.45 },
    uNoiseScale: { value: 3.0 },
    uEmissionStrength: { value: 18.4 },
    uRampColor1: { value: new THREE.Color("#8a2be2") },
    uRampColor2: { value: new THREE.Color("#000938") },
    uOpacity: { value: 0.9 },
    uBackBuffer: { value: null },
  },

  vertexShader: `
    varying vec3 vPos;
    varying vec3 vNormal;

    void main() {
      vPos = position;
      vNormal = normalMatrix * normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
precision mediump float;

varying vec3 vPos;
varying vec3 vNormal;

uniform sampler2D uBackBuffer;
uniform float uOpacity;
uniform float uTime;

// ---------------------------------------------------
// Perlin-like 3D noise（簡易版 for 晶體質感）
// ---------------------------------------------------
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);

  f = f*f*(3.0 - 2.0*f);

  float n000 = hash(i + vec3(0.0,0.0,0.0));
  float n100 = hash(i + vec3(1.0,0.0,0.0));
  float n010 = hash(i + vec3(0.0,1.0,0.0));
  float n110 = hash(i + vec3(1.0,1.0,0.0));
  float n001 = hash(i + vec3(0.0,0.0,1.0));
  float n101 = hash(i + vec3(1.0,0.0,1.0));
  float n011 = hash(i + vec3(0.0,1.0,1.0));
  float n111 = hash(i + vec3(1.0,1.0,1.0));

  return mix(
    mix(mix(n000, n100, f.x),
        mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x),
        mix(n011, n111, f.x), f.y), f.z
  );
}

float fbm(vec3 p){
  float v = 0.0;
  float a = 0.55;
  for(int i=0; i<4; i++){
    v += noise(p) * a;
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
    vec3 V = normalize(vPos);
    vec3 N = normalize(vNormal);

    float facetSteps = 20.0;
    vec3 Nf = normalize(floor(N * facetSteps) / facetSteps);

    float thickness = length(vPos);
    float depth01   = clamp((thickness - 0.2) / 1.6, 0.0, 1.0);

    vec3 bodyBase = vec3(0.32, 0.49, 0.32);
    vec3 absorb = exp(-thickness * vec3(2.0, 1.6, 2.0));
    vec3 bodyColor = bodyBase * absorb * 2.3;

    // ---------------------------------------------------
    // 輕微折射（目前 uBackBuffer 為空，可之後再用）
    // ---------------------------------------------------
    const float iorR = 1.02;
    const float iorG = 1.03;
    const float iorB = 1.05;

    vec3 refrR = refract(V, Nf, 1.0 / iorR);
    vec3 refrG = refract(V, Nf, 1.0 / iorG);
    vec3 refrB = refract(V, Nf, 1.0 / iorB);

    vec2 uvR = refrR.xy * 0.5 + 0.5;
    vec2 uvG = refrG.xy * 0.5 + 0.5;
    vec2 uvB = refrB.xy * 0.5 + 0.5;

    vec3 refrSample = vec3(
      texture2D(uBackBuffer, uvR).r,
      texture2D(uBackBuffer, uvG).g,
      texture2D(uBackBuffer, uvB).b
    );

    float thinMask = 1.0 - depth01;
    vec3 refrColor = refrSample * vec3(0.04, 0.05, 0.14) * thinMask;

    // ---------------------------------------------------
    // 三條亮帶
    // ---------------------------------------------------
    vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.3));
    float facingLight = max(dot(Nf, lightDir), 0.0);
    float facingCam   = max(dot(Nf, V), 0.0);
    float fres = 1.0 - dot(Nf, V);

    float nl = facingLight;
    float bandArea  = smoothstep(0.15, 0.7, nl);
    float bandDepth = smoothstep(0.3, 1.5, thickness);

    float ring =
        smoothstep(0.22, 0.32, fres) *
        (1.0 - smoothstep(0.55, 0.65, fres));

    float bandMask = bandArea * bandDepth * ring * facingLight * facingCam;
    vec3 pinkBand = vec3(0.8, 1.0, 0.5) * bandMask * 0.78;

    float ring2 =
        smoothstep(0.17, 0.23, fres) *
        (1.0 - smoothstep(0.42, 0.50, fres));
    float bandMask2 = ring2 * bandDepth * facingLight * facingCam * 0.9;
    vec3 pinkBand2 = vec3(0.05, 0.15, 0.05) * bandMask2 * 0.90;

    float ring3 =
        smoothstep(0.10, 0.18, fres) *
        (1.0 - smoothstep(0.38, 0.48, fres));
    float bandMask3 = ring3 * bandDepth * facingLight * facingCam * 0.8;
    vec3 deepBlueBand = vec3(0.18, 0.08, 0.35) * bandMask3 * 0.75;

    // ---------------------------------------------------
    // 邊緣 + 高光
    // ---------------------------------------------------
    float rimMask = pow(fres, 3.2);
    vec3 rimBlue = vec3(0.05, 0.15, 0.05) * rimMask * 1.2;

    vec3 L = normalize(vec3(0.5, 0.5, 0.8));
    vec3 H = normalize(L + (-V));
    float spec = pow(max(dot(Nf, H), 0.0), 70.0);
    vec3 specColor = vec3(0.76, 0.83, 0.62) * spec * 0.20;

    // ---------------------------------------------------
    // 內部結晶噪音
    // ---------------------------------------------------
    float n = fbm(vPos * 3.0 + uTime * 0.2);

    float noiseMask =
      thinMask *
      smoothstep(0.3, 0.9, thickness) *
      smoothstep(0.2, 0.5, fres);

    vec3 noiseColor = vec3(0.4, 0.1, 0.55) * n * noiseMask * 0.45;

    // ---------------------------------------------------
    // Final
    // ---------------------------------------------------
    vec3 finalColor =
      bodyColor +
      refrColor +
      rimBlue +
      pinkBand +
      pinkBand2 +
      deepBlueBand +
      specColor +
      noiseColor;

    finalColor *= 0.95;

    gl_FragColor = vec4(finalColor, uOpacity);
}
  `,
});

// =====================================================
// Wrapper 虹光 + 折射 Shader
// =====================================================
// =====================================================
// Wrapper 虹光 + 折射 Shader（加強白色高光帶版）
// =====================================================
function createIridescentMaterial(alpha = 0.2) {
  return new THREE.ShaderMaterial({
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uGloss: { value: 260.0 }, // 高光銳度
      uIriStrength: { value: 1.0 }, // 彩虹強度
      uIriSaturation: { value: 0.55 },
      uBaseStrength: { value: 0.02 }, // 超薄底光
      uAlpha: { value: alpha },
      uCandyTex: { value: null },
      uRefractPow: { value: 0.035 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;

      uniform float uGloss;
      uniform float uIriStrength;
      uniform float uBaseStrength;
      uniform float uAlpha;
      uniform sampler2D uCandyTex;
      uniform float uRefractPow;

      const float PI = 3.14159265;

      vec3 thinFilm(float t) {
        vec3 shift = vec3(0.0, 0.33, 0.67);
        vec3 c = 0.5 + 0.5 * cos(2.0 * PI * (t + shift));
        c = pow(c, vec3(0.7));
        c *= 1.6;
        return c;
      }

      vec3 saturateColor(vec3 col, float s){
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        return mix(vec3(l), col, s);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);

        vec3 col = vec3(1.0) * uBaseStrength;

        vec3 L = normalize(vec3(0.35, 0.85, 0.45));
        vec3 H = normalize(L + V);

        float ndv = max(dot(N, V), 0.0);
        float ndh = max(dot(N, H), 0.0);

        float edge = pow(1.0 - ndv, 5.0);

        float phase = edge * 4.5 + N.y * 0.2;

        // 虹光：稍微壓一點，讓白光有空間
        vec3 iri = thinFilm(phase);
        iri = saturateColor(iri, 1.7);
        iri *= 0.9;
        col += iri * edge * uIriStrength;

        // ===== 原本的 spec，高光來源 =====
        float specTight = pow(ndh, uGloss);
        float specWide  = pow(ndh, uGloss * 0.25);

        // 先算一個總高光能量
        float specEnergy = specTight * 3.0 + specWide * 0.4;

        // ⭐ 新增：把這個高光壓成「更窄、更亮」的白色帶
        float bandMask = smoothstep(0.15, 0.50, specEnergy); // 只取中高能量區
        bandMask = pow(bandMask, 1.2);                       // 稍微集中
        vec3 whiteBand = vec3(1.0) * bandMask * 2.4;         // 提升亮度

        // 原來的白光 + 新的強化白帶
        col += vec3(1.0) * specEnergy * 0.2; // 保留一點舊的柔光
        col += whiteBand;                    // 新的更亮、更窄的帶

        // 邊緣再補一點白 rim
        col += vec3(1.0) * edge * 0.25;

        // ---------- 使用糖果畫面做折射 ----------
        float fres = pow(1.0 - ndv, 2.0);

        vec2 refUV = V.xy * 0.5 + 0.5;
        refUV += N.xy * uRefractPow;
        refUV = clamp(refUV, 0.0, 1.0);

        vec3 refractedCandy = texture2D(uCandyTex, refUV).rgb;

        // 把糖果畫面混進外包裝顏色
        col = mix(col, refractedCandy, fres * 0.85);

        // ---------- Tone mapping ----------
        col = col / (0.28 + col);
        col = pow(col, vec3(0.96));

        gl_FragColor = vec4(col, uAlpha);
      }
    `,
  });
}
/* =====================================================
   Scene graph
===================================================== */
const modelRoot = new THREE.Group();
scene.add(modelRoot);
modelRoot.rotation.set(-2, 0.15, 0.15);
modelRoot.scale.set(1, 1, 1);
modelRoot.position.set(0, 0, 0);

let candyRoot = null;
let wrapperRoot = null;

const wrapperGroup = new THREE.Group();
modelRoot.add(wrapperGroup);

let decoRoot = null;

/* =====================================================
   Particles（保留你的外圍微光粒子）
===================================================== */
const particleCount = 60;
const particleRadius = 2.6;
const particlesGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const speeds = new Float32Array(particleCount);
const phases = new Float32Array(particleCount);
const scales = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = particleRadius * (0.45 + Math.random() * 0.55);
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);
  positions.set([x, y, z], i * 3);
  speeds[i] = 1.0 + Math.random() * 2.0;
  phases[i] = Math.random() * 10.0;
  scales[i] = 0.05 + Math.random() * 0.08;
}
particlesGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positions, 3),
);
particlesGeometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
particlesGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
particlesGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

const particlesMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0.0 },
    uColor: { value: new THREE.Color(1.0, 0.85, 1.0) },
  },
  vertexShader: `
    attribute float aSpeed, aPhase, aScale;
    uniform float uTime; varying float vAlpha;
    void main(){
      float flicker = sin((uTime + aPhase) * aSpeed);
      vAlpha = max(flicker, 0.0);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aScale * 300.0 / -mvPosition.z;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor; varying float vAlpha;
    void main(){
      vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
      if(d > 0.5) discard;
      float alpha = (1.0 - d * 2.0) * vAlpha;
      gl_FragColor = vec4(uColor, alpha);
    }
  `,
});
const particles = new THREE.Points(particlesGeometry, particlesMaterial);
modelRoot.add(particles);

/* =====================================================
   Load models
===================================================== */
const gltfLoader = new GLTFLoader();

gltfLoader.load("../../assets/models/anxiety.glb", (gltf) => {
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      child.material = bubbleMaterial;
      child.renderOrder = 10;
      child.material.depthWrite = false;
      child.material.depthTest = true;
    }
  });

  candyRoot = gltf.scene;

  candyRoot.scale.set(1.5, 1.5, 1.5);

  modelRoot.add(candyRoot);
  tryAlignWrapperAndCandy();
});

gltfLoader.load("../../assets/models/container_3.glb", (gltf) => {
  const group = new THREE.Group();
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      const geo = child.geometry;
      geo.computeVertexNormals();
      const backMat = createIridescentMaterial(0.12);
      backMat.side = THREE.BackSide;
      const frontMat = createIridescentMaterial(0.48);
      frontMat.side = THREE.FrontSide;
      const backMesh = new THREE.Mesh(geo, backMat);
      const frontMesh = new THREE.Mesh(geo, frontMat);
      [backMesh, frontMesh].forEach((m) => {
        m.position.copy(child.position);
        m.quaternion.copy(child.quaternion);
        m.scale.copy(child.scale);
      });
      backMesh.renderOrder = 20;
      frontMesh.renderOrder = 21;
      backMesh.material.depthWrite = false;
      frontMesh.material.depthWrite = false;
      group.add(backMesh);
      group.add(frontMesh);
    }
  });
  wrapperRoot = group;
  wrapperGroup.add(wrapperRoot);
  tryAlignWrapperAndCandy();
});

gltfLoader.load("../../assets/models/deco-4.glb", (gltf) => {
  decoRoot = gltf.scene;
  decoRoot.position.set(-0.55, 0.05, -0.13);
  decoRoot.rotation.set(0, 0.28, 0.03);
  decoRoot.scale.set(1.3, 1.3, 1.3);

  wrapperGroup.add(decoRoot);
});

/* =====================================================
   對齊：包裝自動包住糖果
===================================================== */
function tryAlignWrapperAndCandy() {
  if (!candyRoot || !wrapperRoot) return;

  const boxCandy = new THREE.Box3().setFromObject(candyRoot);
  const boxWrapper = new THREE.Box3().setFromObject(wrapperRoot);

  const candySize = new THREE.Vector3();
  const wrapperSize = new THREE.Vector3();
  boxCandy.getSize(candySize);
  boxWrapper.getSize(wrapperSize);

  const candyCenter = new THREE.Vector3();
  const wrapperCenter = new THREE.Vector3();
  boxCandy.getCenter(candyCenter);
  boxWrapper.getCenter(wrapperCenter);

  if (wrapperSize.length() > 0 && candySize.length() > 0) {
    const sCandy = candySize.length();
    const sWrapper = wrapperSize.length();
    const scaleFactor = (sCandy * 1.8) / sWrapper;
    wrapperRoot.scale.multiplyScalar(scaleFactor);
  }
  const boxWrapper2 = new THREE.Box3().setFromObject(wrapperRoot);
  boxWrapper2.getCenter(wrapperCenter);
  const offset = new THREE.Vector3().subVectors(candyCenter, wrapperCenter);
  wrapperRoot.position.add(offset);

  // 初次載入完成：自動取景一次
  if (!frameOnceDone) {
    frameOnceDone = true;
    safeFrame();
  }
}

/* =====================================================
   自動取景（不變形、左半顯示）
===================================================== */
let frameOnceDone = false;

function frameModelToViewport(
  object3D,
  { widthFill = 0.5, xOffsetN = -0.28, yOffsetN = 0.0 } = {},
) {
  const box = new THREE.Box3().setFromObject(object3D);
  if (!isFinite(box.min.x) || box.isEmpty()) return; // 等下一幀

  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  const w = window.innerWidth,
    h = window.innerHeight;
  const aspect = w / h;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

  const distFitX = sphere.radius / Math.sin(hFov / 2);
  const distFitY = sphere.radius / Math.sin(vFov / 2);
  const dist = Math.max(distFitX, distFitY) / widthFill;

  const target = sphere.center.clone();
  camera.near = Math.max(0.01, dist * 0.01);
  camera.far = dist * 50 + sphere.radius * 10;
  camera.updateProjectionMatrix();

  camera.position.set(target.x, target.y, target.z + dist);
  camera.lookAt(target);

  const halfW = Math.tan(hFov / 2) * dist;
  const halfH = Math.tan(vFov / 2) * dist;
  const dx = xOffsetN * halfW * 2;
  const dy = yOffsetN * halfH * 2;

  // 模型整體位移（視覺向左 → 模型往右）
  modelRoot.position.set(-dx, -dy, 0);
  modelRoot.scale.set(1, 1, 1); // 保證等比
}

function safeFrame() {
  frameModelToViewport(modelRoot, {
    widthFill: 1.58, // 稍微放大
    xOffsetN: -0.34, // 再往左移一點
    yOffsetN: 0.0,
  });
}

/* 快捷鍵：R 復位 */
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") safeFrame();
});

/* =====================================================
   Interaction（拖曳旋轉 / 滾輪縮放）
===================================================== */
let isDragging = false;
let lastX = 0,
  lastY = 0;

window.addEventListener("pointerdown", (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener("pointerup", () => {
  isDragging = false;
});
window.addEventListener("pointermove", (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  modelRoot.rotation.y += dx * 0.01;
  modelRoot.rotation.x += dy * 0.01;
});

/* =====================================================
   3D糖果（拖曳旋轉 / 滾輪縮放）
===================================================== */
window.addEventListener("wheel", (e) => {
  camera.position.z += Math.sign(e.deltaY) * 0.5;
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, 3, 25);
});

/* =====================================================
   Animation（兩階段渲染：糖果 → 全景）
===================================================== */
function animate() {
  requestAnimationFrame(animate);

  particlesMaterial.uniforms.uTime.value += 0.01;
  particlesGeometry.attributes.position.needsUpdate = true;
  bubbleMaterial.uniforms.uTime.value += 0.01;

  if (candyRoot && wrapperRoot) {
    // 1) 只渲染糖果到 rtCandy
    wrapperRoot.visible = false;
    renderer.setRenderTarget(rtCandy);
    renderer.clear();
    renderer.render(scene, camera);

    // 把糖果貼圖塞回外包裝 shader
    wrapperRoot.traverse((child) => {
      if (
        child.isMesh &&
        child.material &&
        child.material.uniforms &&
        child.material.uniforms.uCandyTex
      ) {
        child.material.uniforms.uCandyTex.value = rtCandy.texture;
      }
    });

    // 2) 渲染整個場景到螢幕
    wrapperRoot.visible = true;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  } else {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }
}
animate();

/* =====================================================
   Resize（整窗）
===================================================== */
window.addEventListener("resize", () => {
  const w = window.innerWidth,
    h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (rtCandy) rtCandy.setSize(w, h);

  // 視窗變更後重算一次取景
  setTimeout(safeFrame, 0);
});

/* 首屏保險：等 1 幀後做一次取景（避免尚未 ready） */
requestAnimationFrame(() => setTimeout(safeFrame, 0));
