import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";
import { gsap } from "https://esm.sh/gsap";

/* ===========================
   固定順序
   =========================== */
const ORDER = ["TIRED", "SAD", "BORING", "UPSET", "HAPPY", "ANXIETY"];

/* ========== 資料綁定 ========== */
const DATA = {
  TIRED: {
    model: "../../assets/models/tired.glb",
    img: "../../assets/img/tired.png",
    title: "TIRED CANDY",
    desc: "精力耗盡、渴望休息、心靈疲乏。",
    link: "../emotions/tired.html",
    color: "#78ffcd",
  },
  SAD: {
    model: "../../assets/models/sad.glb",
    img: "../../assets/img/sad.png",
    title: "SAD CANDY",
    desc: "情緒低落、灰心喪志、沒有希望。",
    link: "../emotions/sad.html",
    color: "#6ec7ff",
  },
  BORING: {
    model: "../../assets/models/boring.glb",
    img: "../../assets/img/boring.png",
    title: "BORING CANDY",
    desc: "乏味停滯、提不起勁、毫無火花。",
    link: "../emotions/boring.html",
    color: "#ff8ee6",
  },
  UPSET: {
    model: "../../assets/models/upset.glb",
    img: "../../assets/img/upset.png",
    title: "UPSET CANDY",
    desc: "煩躁不順、情緒積壓、容易爆裂。",
    link: "../emotions/upset.html",
    color: "#ff7a7a",
  },
  HAPPY: {
    model: "../../assets/models/happy.glb",
    img: "../../assets/img/happy.png",
    title: "HAPPY CANDY",
    desc: "情緒明亮、心情輕盈、滿滿暖意。",
    link: "../emotions/happy.html",
    color: "#ffe066",
  },
  ANXIETY: {
    model: "../../assets/models/anxiety.glb",
    img: "../../assets/img/anxiety.png",
    title: "ANXIETY CANDY",
    desc: "緊張不安、思緒混亂、心跳加速。",
    link: "../emotions/anxiety.html",
    color: "#3ecf55",
  },
};
const TRAIL_COLOR = {
  TIRED: "#7BFFD8", // 飽和薄荷綠
  SAD: "#33C6FF", // 高亮藍青色
  BORING: "#FF5BEF", // 飽和洋紅
  UPSET: "#FF5050", // 鮮豔紅桃色
  HAPPY: "#FFD429", // 明亮金黃
  ANXIETY: "#3DFF5C", // 螢光綠
};
const TRAIL_COLOR_MAP = {
  TIRED: "#78FFD9",
  SAD: "#2CC2FF",
  BORING: "#FF4FEA",
  UPSET: "#FF3B3B",
  HAPPY: "#FFE700",
  ANXIETY: "#00FF6A",
};

function getFrontTrailColor() {
  const idx =
    ((Math.round(rotationIndex) % ORDER.length) + ORDER.length) % ORDER.length;
  const name = ORDER[idx];
  return TRAIL_COLOR_MAP[name] || "#ffffff";
}

/* ========== Layout (index 0 = FRONT) ==========
   ⭐ 將原本 size 全部縮小 1/4，避免超巨大
================================================ */
const POS = [
  { x: 0, y: -1, z: 0.3, size: 1.5 }, // front
  { x: 9.2, y: 0.8, z: -0.4, size: 0.7 },
  { x: 6.5, y: 3.2, z: -1.0, size: 0.4 },
  { x: 0, y: 3.8, z: -1.2, size: 0.375 },
  { x: -6.5, y: 3.2, z: -1.0, size: 0.4 },
  { x: -9.2, y: 0.8, z: -0.4, size: 0.7 },
];

/* ========== Three 基本設定 ========== */
const canvas = document.getElementById("webgl-shop");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 1.5, 17);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setClearColor(0x000000, 1.0);
renderer.physicallyCorrectLights = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

const keyLight = new THREE.DirectionalLight(0xffffff, 5.0);
keyLight.position.set(2.5, 9, 3.0);
keyLight.castShadow = true;
keyLight.shadow.bias = -0.002;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 3.0);
rimLight.position.set(-3, 6, -4);
scene.add(rimLight);

/* ========== RenderTarget：糖果 → 包裝折射用 ========== */
let rtCandy = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
);

/* =====================================================
   Wrapper Shader（共用）
===================================================== */
function createIridescentMaterial(alpha = 0.2) {
  return new THREE.ShaderMaterial({
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uGloss: { value: 260.0 },
      uIriStrength: { value: 1.0 },
      uIriSaturation: { value: 0.55 },
      uBaseStrength: { value: 0.02 },
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

        vec3 iri = thinFilm(phase);
        iri = saturateColor(iri, 1.7);
        iri *= 0.9;
        col += iri * edge * uIriStrength;

        float specTight = pow(ndh, uGloss);
        float specWide  = pow(ndh, uGloss * 0.25);

        float specEnergy = specTight * 3.0 + specWide * 0.4;

        float bandMask = smoothstep(0.15, 0.50, specEnergy);
        bandMask = pow(bandMask, 1.2);
        vec3 whiteBand = vec3(1.0) * bandMask * 2.4;

        col += vec3(1.0) * specEnergy * 0.2;
        col += whiteBand;

        col += vec3(1.0) * edge * 0.25;

        float fres = pow(1.0 - ndv, 2.0);

        vec2 refUV = V.xy * 0.5 + 0.5;
        refUV += N.xy * uRefractPow;
        refUV = clamp(refUV, 0.0, 1.0);

        vec3 refractedCandy = texture2D(uCandyTex, refUV).rgb;

        col = mix(col, refractedCandy, fres * 0.85);

        col = col / (0.28 + col);
        col = pow(col, vec3(0.96));

        gl_FragColor = vec4(col, uAlpha);
      }
    `,
  });
}

function createTiredMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIor: { value: 1.45 },
      uNoiseScale: { value: 3.0 },
      uEmissionStrength: { value: 18.4 },

      uBaseColor: { value: new THREE.Color(0.5765, 1.0, 0.7412) },
      uBandColor1: { value: new THREE.Color(0.498, 2.442, 2.352) },
      uBandColor2: { value: new THREE.Color(0.5765, 1.0, 0.7412) },
      uBandColor3: { value: new THREE.Color(1.164, 1.116, 1.638) },

      uOpacity: { value: 0.9 },
      uBackBuffer: { value: null },

      uSpecShift: { value: 0.0 },
    },

    vertexShader: `
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vPos = position;
        vNormal = normalMatrix * normal;
        vViewPosition = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,

    fragmentShader: `
// ...（此處沿用你 TIRED shader 的 fragment，保持不變）
precision mediump float;

varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform sampler2D uBackBuffer;
uniform float uOpacity;
uniform float uTime;
uniform vec3 uBaseColor;

uniform vec3 uBandColor1;
uniform vec3 uBandColor2;
uniform vec3 uBandColor3;

uniform float uSpecShift;

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
  vec3 V = normalize(vViewPosition);
  vec3 N = normalize(vNormal);

  float facetSteps = 20.0;
  vec3 Nf = normalize(floor(N * facetSteps) / facetSteps);

  float thickness = length(vPos);
  float depth01   = clamp((thickness - 0.2) / 1.6, 0.0, 1.0);

  vec3 bodyBase = uBaseColor;
  vec3 absorb = exp(-thickness * vec3(1.2, 1.0, 0.8));
  vec3 bodyColor = bodyBase * absorb * 0.45;

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
  vec3 refrColor = refrSample * vec3(0.1216, 0.1882, 0.6706) * thinMask;

  vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.3));
  float facingLight = max(dot(Nf, lightDir), 0.0);
  float facingCam   = max(dot(Nf, V), 0.0);
  float fres = 1.0 - dot(Nf, V);

  float bandArea  = smoothstep(0.15, 0.7, facingLight);
  float bandDepth = smoothstep(0.3, 1.5, thickness);

  float ring =
      smoothstep(0.22, 0.32, fres) *
      (1.0 - smoothstep(0.55, 0.65, fres));

  float bandMask = bandArea * bandDepth * ring * facingLight * facingCam;
  vec3 pinkBand = uBandColor1 * bandMask * 0.78;

  float ring2 =
      smoothstep(0.17, 0.23, fres) *
      (1.0 - smoothstep(0.42, 0.50, fres));

  float bandMask2 = ring2 * bandDepth * facingLight * facingCam * 0.9;
  vec3 pinkBand2 = uBandColor2 * bandMask2 * 0.90;

  float ring3 =
      smoothstep(0.10, 0.18, fres) *
      (1.0 - smoothstep(0.38, 0.48, fres));

  float bandMask3 = ring3 * bandDepth * facingLight * facingCam * 0.8;
  vec3 deepBlueBand = uBandColor3 * bandMask3 * 0.75;

  float rimMask = pow(fres, 3.2);
  vec3 rimBlue = vec3(0.1961, 0.7765, 0.7216) * rimMask * 0.1;

  float vdot = dot(V, Nf);
  float camBand =
      smoothstep(0.25, 0.45, vdot) *
      smoothstep(0.85, 0.65, vdot);
  vec3 highlightBand = vec3(0.45, 0.88, 0.83) * camBand * 1.4;

  vec3 L = normalize(vec3(0.5, 0.5 + uSpecShift, 0.8));
  vec3 H = normalize(L + (-V));
  float spec = pow(max(dot(Nf, H), 0.0), 70.0);
  vec3 specColor = vec3(0.2196, 0.4706, 1.0) * spec * 0.9;

  float n = fbm(vPos * 3.0 + uTime * 0.2);
  float noiseMask =
    thinMask *
    smoothstep(0.3, 0.9, thickness) *
    smoothstep(0.2, 0.5, fres);
  vec3 noiseColor = vec3(0.1, 0.25, 0.45) * n * noiseMask * 0.9;

  vec3 finalColor =
    bodyColor +
    refrColor +
    rimBlue +
    pinkBand +
    pinkBand2 +
    deepBlueBand +
    highlightBand +
    specColor +
    noiseColor;

  finalColor *= 0.95;
  gl_FragColor = vec4(finalColor, uOpacity);
}
    `,
  });
}

function createSadMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIor: { value: 1.45 },
      uNoiseScale: { value: 3.0 },
      uEmissionStrength: { value: 18.4 },

      uBaseColor: { value: new THREE.Color("#0A91FF") },
      uBandColor1: { value: new THREE.Color(0.0, 0.9882, 0.6745) },
      uBandColor2: { value: new THREE.Color(0.5059, 0.6353, 0.7686) },
      uBandColor3: { value: new THREE.Color(0.2196, 0.4863, 0.5922) },

      uOpacity: { value: 0.9 },
      uBackBuffer: { value: null },

      // ⭐ 新增：糖果高光上下偏移
      uSpecShift: { value: 0.0 },
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
uniform vec3 uBaseColor;

uniform vec3 uBandColor1;
uniform vec3 uBandColor2;
uniform vec3 uBandColor3;

uniform float uSpecShift;   // ⭐ 高光偏移

// ---------------------------------------------------
// noise
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

    vec3 bodyBase = uBaseColor;
    vec3 absorb = exp(-thickness * vec3(1.2, 1.0, 0.8));
    vec3 bodyColor = bodyBase * absorb * 0.35;

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
    vec3 refrColor = refrSample * vec3(0.1216, 0.1882, 0.6706) * thinMask;

    vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.3));
    float facingLight = max(dot(Nf, lightDir), 0.0);
    float facingCam   = max(dot(Nf, V), 0.0);
    float fres = 1.0 - dot(Nf, V);

    float bandArea  = smoothstep(0.15, 0.7, facingLight);
    float bandDepth = smoothstep(0.3, 1.5, thickness);

    float ring =
        smoothstep(0.22, 0.32, fres) *
        (1.0 - smoothstep(0.55, 0.65, fres));

    float bandMask = bandArea * bandDepth * ring * facingLight * facingCam;
    vec3 pinkBand = uBandColor1 * bandMask * 0.78;

    float ring2 =
        smoothstep(0.17, 0.23, fres) *
        (1.0 - smoothstep(0.42, 0.50, fres));

    float bandMask2 = ring2 * bandDepth * facingLight * facingCam * 0.9;
    vec3 pinkBand2 = uBandColor2 * bandMask2 * 0.90;

    float ring3 =
        smoothstep(0.10, 0.18, fres) *
        (1.0 - smoothstep(0.38, 0.48, fres));

    float bandMask3 = ring3 * bandDepth * facingLight * facingCam * 0.8;
    vec3 deepBlueBand = uBandColor3 * bandMask3 * 0.75;

    float rimMask = pow(fres, 3.2);
    vec3 rimBlue = vec3(0.05, 0.10, 0.25) * rimMask * 1.2;

    // ---------------------------------------------------
    // ⭐⭐ Specular 高光 + 可上下移動
    // ---------------------------------------------------
    vec3 L = normalize(vec3(0.5, 0.5 + uSpecShift, 0.8));
    vec3 H = normalize(L + (-V));

    float spec = pow(max(dot(Nf, H), 0.0), 70.0);
    vec3 specColor = vec3(0.2627, 0.3294, 1.0) * spec * 0.1;

    // ---------------------------------------------------
    float n = fbm(vPos * 3.0 + uTime * 0.2);
    float noiseMask =
      thinMask *
      smoothstep(0.3, 0.9, thickness) *
      smoothstep(0.2, 0.5, fres);

    vec3 noiseColor = vec3(0.1, 0.25, 0.45) * n * noiseMask * 0.9;

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
}

function createBoringMaterial() {
  return new THREE.ShaderMaterial({
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
// Perlin-like 3D noise（for 晶體質感）
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

    // ---------------------------------------------------
    // 主體：深紫水晶
    // ---------------------------------------------------
    vec3 bodyBase = vec3(0.12, 0.03, 0.22);
    vec3 absorb = exp(-thickness * vec3(3.5, 3.0, 2.0));
    vec3 bodyColor = bodyBase * absorb * 2.3;

    // ---------------------------------------------------
    // 輕度折射（外包裝折射用）
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
    // 三道亮帶
    // ---------------------------------------------------
    vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.3));
    float facingLight = max(dot(Nf, lightDir), 0.0);
    float facingCam   = max(dot(Nf, V), 0.0);
    float fres = 1.0 - dot(Nf, V);

    float bandArea  = smoothstep(0.15, 0.7, facingLight);
    float bandDepth = smoothstep(0.3, 1.5, thickness);

    float ring =
      smoothstep(0.22, 0.32, fres) *
      (1.0 - smoothstep(0.55, 0.65, fres));

    float bandMask = bandArea * bandDepth * ring * facingLight * facingCam;
    vec3 pinkBand = vec3(2.2, 0.65, 2.8) * bandMask * 0.78;

    float ring2 =
      smoothstep(0.17, 0.23, fres) *
      (1.0 - smoothstep(0.42, 0.50, fres));

    float bandMask2 = ring2 * bandDepth * facingLight * facingCam * 0.9;
    vec3 pinkBand2 = vec3(2.8, 0.75, 3.5) * bandMask2 * 0.90;

    float ring3 =
      smoothstep(0.10, 0.18, fres) *
      (1.0 - smoothstep(0.38, 0.48, fres));

    float bandMask3 = ring3 * bandDepth * facingLight * facingCam * 0.8;
    vec3 deepBlueBand = vec3(0.18, 0.08, 0.35) * bandMask3 * 0.75;

    // ---------------------------------------------------
    // Rim 光 + 高光
    // ---------------------------------------------------
    float rimMask = pow(fres, 3.2);
    vec3 rimBlue = vec3(0.06, 0.04, 0.25) * rimMask * 1.2;

    vec3 L = normalize(vec3(0.5, 0.5, 0.8));
    vec3 H = normalize(L + (-V));
    float spec = pow(max(dot(Nf, H), 0.0), 70.0);
    vec3 specColor = vec3(1.25, 0.9, 1.55) * spec * 0.20;

    // ---------------------------------------------------
    // 晶體內部噪音（signature 紫噪點）
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
}

function createUpsetMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIor: { value: 1.45 },
      uNoiseScale: { value: 3.0 },
      uEmissionStrength: { value: 18.4 },

      uBaseColor: { value: new THREE.Color(0.52, 0.0314, 0.0941) },
      uBandColor1: { value: new THREE.Color(0.2392, 0.0314, 0.0941) },
      uBandColor2: { value: new THREE.Color(1.0, 0.5608, 0.3255) },
      uBandColor3: { value: new THREE.Color(0.1059, 0.0314, 0.1608) },

      uOpacity: { value: 0.9 },
      uBackBuffer: { value: null },

      uSpecShift: { value: 0.0 }, // 高光上下位移
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
uniform vec3 uBaseColor;

uniform vec3 uBandColor1;
uniform vec3 uBandColor2;
uniform vec3 uBandColor3;

uniform float uSpecShift;

// ---------------------------------------------------
// noise
// ---------------------------------------------------
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}

float noise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f*f*(3.0 - 2.0*f);

  return mix(
    mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
        mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
        mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z
  );
}

float fbm(vec3 p){
  float v = 0.0;
  float a = 0.55;
  for(int i=0; i<4; i++){
    v += noise(p) * a;
    p *= 2.0;
    a *= .5;
  }
  return v;
}

void main() {

    vec3 V = normalize(vPos);
    vec3 N = normalize(vNormal);

    float facetSteps = 20.0;
    vec3 Nf = normalize(floor(N * facetSteps) / facetSteps);

    float thickness = length(vPos);
    float depth01   = clamp((thickness - 0.18) / 1.45, 0.0, 1.0);
    float thinMask  = 1.0 - depth01;

    // ---------------------------------------------------
    // 主體顏色（紅莓深色系）
    // ---------------------------------------------------
    vec3 absorb = exp(-thickness * vec3(1.2, 1.0, 0.8));
    vec3 bodyColor = uBaseColor * absorb * 0.55;

    // ---------------------------------------------------
    // 折射 + 飽和度提升
    // ---------------------------------------------------
    const float iorR = 1.02;
    const float iorG = 1.03;
    const float iorB = 1.05;

    vec3 refrR = refract(V, Nf, 1.0/iorR);
    vec3 refrG = refract(V, Nf, 1.0/iorG);
    vec3 refrB = refract(V, Nf, 1.0/iorB);

    vec2 uvR = refrR.xy*.5+.5;
    vec2 uvG = refrG.xy*.5+.5;
    vec2 uvB = refrB.xy*.5+.5;

    vec3 refrSample = vec3(
      texture2D(uBackBuffer, uvR).r,
      texture2D(uBackBuffer, uvG).g,
      texture2D(uBackBuffer, uvB).b
    );

    vec3 refrColor =
      refrSample *
      vec3(0.1216,0.1882,0.6706) *
      thinMask * 0.65;

    // ---------------------------------------------------
    // 光帶
    // ---------------------------------------------------
    vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.3));
    float facingLight = max(dot(Nf, lightDir),0.0);
    float facingCam   = max(dot(Nf, V),0.0);
    float fres = 1.0 - dot(Nf,V);

    float bandArea  = smoothstep(.15,.7,facingLight);
    float bandDepth = smoothstep(.3,1.5,thickness);

    float ring =
      smoothstep(.22,.32,fres) *
      (1.0 - smoothstep(.55,.65,fres));

    float bandMask = bandArea * bandDepth * ring * facingLight * facingCam;
    vec3 band1 = uBandColor1 * bandMask * .78;

    float ring2 =
      smoothstep(.17,.23,fres) *
      (1.0 - smoothstep(.42,.50,fres));

    float bandMask2 = ring2 * bandDepth * facingLight * facingCam * .9;
    vec3 band2 = uBandColor2 * bandMask2 * .90;

    float ring3 =
      smoothstep(.10,.18,fres) *
      (1.0 - smoothstep(.38,.48,fres));

    float bandMask3 = ring3 * bandDepth * facingLight * facingCam * .8;
    vec3 band3 = uBandColor3 * bandMask3 * .75;

    // ---------------------------------------------------
    // Fresnel 增強
    // ---------------------------------------------------
    float rimMask = pow(fres, 2.5);
    vec3 rim = vec3(1.0,0.149,0.239) * rimMask * .1;

    // ---------------------------------------------------
    // 高光（可上下移動）
    // ---------------------------------------------------
    vec3 L = normalize(vec3(.5, .5 + uSpecShift, .8));
    vec3 H = normalize(L + (-V));
    float spec = pow(max(dot(Nf,H),0.0), 70.0);
    vec3 specColor = vec3(1.0,0.529,0.2) * spec * .9;

    // ---------------------------------------------------
    // Noise（增強立體感）
    // ---------------------------------------------------
    float n = fbm(vPos * 3.0 + uTime * .2);

    float noiseMask =
      thinMask *
      smoothstep(.3,.9,thickness) *
      smoothstep(.2,.5,fres);

    vec3 noiseColor = vec3(.1,.25,.45) * n * noiseMask * .9;

    // ---------------------------------------------------
    // Final Color
    // ---------------------------------------------------
    vec3 finalColor =
      bodyColor +
      refrColor +
      rim +
      band1 +
      band2 +
      band3 +
      specColor +
      noiseColor;

    finalColor *= .95;

    gl_FragColor = vec4(finalColor, uOpacity);
}
    `,
  });
}

function createHappyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIor: { value: 1.45 },
      uNoiseScale: { value: 3.0 },
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
// noise
// ---------------------------------------------------
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}

float noise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f*f*(3.0-2.0*f);

  return mix(
    mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
        mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
        mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z
  );
}

float fbm(vec3 p){
  float v = 0.0;
  float a = 0.55;
  for(int i=0; i<4; i++){
    v += noise(p)*a;
    p *= 2.0;
    a *= .5;
  }
  return v;
}

void main() {

    vec3 V = normalize(vPos);
    vec3 N = normalize(vNormal);

    float thickness = length(vPos);
    float depth01 = clamp((thickness - 0.2) / 1.6, 0.0, 1.0);
    float thinMask = 1.0 - depth01;

    // ---------------------------------------------------
    // 粉橘主體 + 柔暈吸收
    // ---------------------------------------------------
    vec3 bodyBase = vec3(1.00, 0.74, 0.63);
    vec3 absorb = exp(-thickness * vec3(0.22,0.18,0.15));
    vec3 bodyColor = bodyBase * absorb * 1.65;

    // ---------------------------------------------------
    // 折射：帶粉橘濾色
    // ---------------------------------------------------
    const float iorR = 1.02;
    const float iorG = 1.03;
    const float iorB = 1.05;

    vec3 refrR = refract(V, N, 1.0/iorR);
    vec3 refrG = refract(V, N, 1.0/iorG);
    vec3 refrB = refract(V, N, 1.0/iorB);

    vec2 uvR = refrR.xy*.5+.5;
    vec2 uvG = refrG.xy*.5+.5;
    vec2 uvB = refrB.xy*.5+.5;

    vec3 refrSample = vec3(
      texture2D(uBackBuffer, uvR).r,
      texture2D(uBackBuffer, uvG).g,
      texture2D(uBackBuffer, uvB).b
    );

    vec3 refrColor = refrSample * (bodyBase * 1.45) * thinMask * 0.85;

    // ---------------------------------------------------
    // 三段柔光亮帶
    // ---------------------------------------------------
    vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.3));
    float facingLight = max(dot(N, lightDir),0.0);
    float facingCam   = max(dot(N, V),0.0);
    float fres = 1.0 - dot(N,V);

    float bandArea = smoothstep(.15,.7,facingLight);
    float bandDepth = smoothstep(.3,1.5,thickness);

    float ring =
      smoothstep(.22,.32,fres) *
      (1.0 - smoothstep(.55,.65,fres));

    float bandMask = bandArea * bandDepth * ring * facingLight * facingCam;
    vec3 pinkBand = vec3(1.25,0.95,0.75) * bandMask * 0.25;

    float ring2 =
      smoothstep(.17,.23,fres) *
      (1.0 - smoothstep(.42,.50,fres));

    float bandMask2 = ring2 * bandDepth * facingLight * facingCam * .45;
    vec3 pinkBand2 = vec3(1.35,1.05,0.80) * bandMask2 * .21;

    float ring3 =
      smoothstep(.10,.18,fres) *
      (1.0 - smoothstep(.38,.48,fres));

    float bandMask3 = ring3 * bandDepth * facingLight * facingCam * .40;
    vec3 deepBlueBand = vec3(0.70,0.40,0.25) * bandMask3 * .20;

    // ---------------------------------------------------
    // Rim（粉光圓圈，偏右上）
    // ---------------------------------------------------
    vec3 camDir = normalize(-V);
    vec3 offset = normalize(vec3(-0.6,-0.6,-0.2));
    vec3 circleDir = normalize(camDir + offset);

    float circleRaw = 1.0 - dot(N, circleDir);
    float rimMask = smoothstep(0.25,0.75,circleRaw);
    vec3 rimBlue = vec3(1.0,0.88,0.70) * rimMask * 0.3;

    // ---------------------------------------------------
    // Specular（柔亮，不刺眼）
    // ---------------------------------------------------
    vec3 L = normalize(vec3(.5,.5,.8));
    vec3 H = normalize(L + (-V));
    float spec = pow(max(dot(N,H),0.0), 70.0);
    vec3 specColor = vec3(1.0,0.95,0.55) * spec * 0.065;

    // ---------------------------------------------------
    // 額頭光（代表開心糖特徵）
    // ---------------------------------------------------
    vec3 headDir = normalize(vec3(0.0,1.0,0.25));
    vec3 headHot = normalize(headDir + camDir * 0.35);
    float headRaw = max(dot(N, headHot),0.0);
    float headMask = smoothstep(.45,.85, headRaw);
    vec3 headLight = vec3(1.0,0.88,0.70) * headMask * 0.20;

    // ---------------------------------------------------
    // Noise（柔散亮點）
    // ---------------------------------------------------
    float n = fbm(vPos * 3.0 + uTime*.2);
    float noiseMask =
      thinMask *
      smoothstep(.3,.9,thickness) *
      smoothstep(.2,.5,fres);

    vec3 noiseColor = vec3(1.0,0.70,0.55) * n * noiseMask * .16;

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
      headLight +
      noiseColor;

    float lum = dot(finalColor, vec3(.299,.587,.114));
    finalColor = mix(vec3(lum), finalColor, 1.28);
    finalColor *= 0.68;

    gl_FragColor = vec4(finalColor, uOpacity);
}
    `,
  });
}

function createAnxietyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIor: { value: 1.45 },
      uNoiseScale: { value: 3.0 },
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

// ---------------------------------------------
// Noise
// ---------------------------------------------
float hash(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}

float noise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f*f*(3.0-2.0*f);

  return mix(
    mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
        mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
        mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z
  );
}

float fbm(vec3 p){
  float v = 0.0;
  float a = 0.55;
  for(int i=0;i<4;i++){
    v += noise(p)*a;
    p *= 2.0;
    a *= .5;
  }
  return v;
}

// ---------------------------------------------
// Main
// ---------------------------------------------
void main(){
    vec3 V = normalize(vPos);
    vec3 N = normalize(vNormal);

    float thickness = length(vPos);
    float depth01 = clamp((thickness - 0.2)/1.6, 0.0, 1.0);
    float thinMask = 1.0 - depth01;

    // ---------------------------------------------
    // Body：深焦慮綠
    // ---------------------------------------------
    vec3 bodyBase = vec3(0.32, 0.49, 0.32);
    vec3 absorb = exp(-thickness * vec3(2.0,1.6,2.0));
    vec3 bodyColor = bodyBase * absorb * 2.3;

    // ---------------------------------------------
    // Refraction
    // ---------------------------------------------
    const float iorR = 1.02;
    const float iorG = 1.03;
    const float iorB = 1.05;

    vec3 refrR = refract(V, N, 1.0/iorR);
    vec3 refrG = refract(V, N, 1.0/iorG);
    vec3 refrB = refract(V, N, 1.0/iorB);

    vec3 refrSample = vec3(
      texture2D(uBackBuffer, refrR.xy*.5+.5).r,
      texture2D(uBackBuffer, refrG.xy*.5+.5).g,
      texture2D(uBackBuffer, refrB.xy*.5+.5).b
    );

    vec3 refrColor = refrSample * vec3(0.04,0.05,0.14) * thinMask;

    // ---------------------------------------------
    // Triple highlight bands
    // ---------------------------------------------
    vec3 lightDir = normalize(vec3(-0.4,0.6,0.3));
    float facingLight = max(dot(N, lightDir),0.0);
    float facingCam   = max(dot(N, V),0.0);
    float fres = 1.0 - dot(N,V);

    float bandArea = smoothstep(.15,.7,facingLight);
    float bandDepth = smoothstep(.3,1.5,thickness);

    float ring =
      smoothstep(.22,.32,fres) *
      (1.0 - smoothstep(.55,.65,fres));

    float bandMask = bandArea * bandDepth * ring * facingLight * facingCam;
    vec3 band1 = vec3(0.8,1.0,0.5) * bandMask * 0.78;

    float ring2 =
      smoothstep(.17,.23,fres) *
      (1.0 - smoothstep(.42,.50,fres));

    float bandMask2 = ring2 * bandDepth * facingLight * facingCam * .9;
    vec3 band2 = vec3(0.05,0.15,0.05) * bandMask2 * .90;

    float ring3 =
      smoothstep(.10,.18,fres) *
      (1.0 - smoothstep(.38,.48,fres));

    float bandMask3 = ring3 * bandDepth * facingLight * facingCam * .8;
    vec3 band3 = vec3(0.18,0.08,0.35) * bandMask3 * .75;

    // ---------------------------------------------
    // Rim light（深焦慮綠）
    // ---------------------------------------------
    float rimMask = pow(fres,3.2);
    vec3 rim = vec3(0.05,0.15,0.05) * rimMask * 1.2;

    // ---------------------------------------------
    // Specular（冰冷高光）
    // ---------------------------------------------
    vec3 L = normalize(vec3(.5,.5,.8));
    vec3 H = normalize(L + (-V));
    float spec = pow(max(dot(N,H),0.0),70.0);
    vec3 specColor = vec3(0.76,0.83,0.62) * spec * 0.20;

    // ---------------------------------------------
    // Inner crystal noise
    // ---------------------------------------------
    float n = fbm(vPos*3.0 + uTime*.2);

    float noiseMask =
      thinMask *
      smoothstep(.3,.9,thickness) *
      smoothstep(.2,.5,fres);

    vec3 noiseColor = vec3(0.4,0.1,0.55) * n * noiseMask * .45;

    // ---------------------------------------------
    // Final
    // ---------------------------------------------
    vec3 finalColor =
      bodyColor +
      refrColor +
      rim +
      band1 +
      band2 +
      band3 +
      specColor +
      noiseColor;

    finalColor *= 0.95;

    gl_FragColor = vec4(finalColor, uOpacity);
}
    `,
  });
}

// 🔑 統一入口
function createCandyMaterialByName(name) {
  switch (name) {
    case "TIRED":
      return createTiredMaterial();
    case "SAD":
      return createSadMaterial();
    case "BORING":
      return createBoringMaterial();
    case "UPSET":
      return createUpsetMaterial();
    case "HAPPY":
      return createHappyMaterial();
    case "ANXIETY":
      return createAnxietyMaterial();
    default:
      return createTiredMaterial();
  }
}

/* =====================================================
   Wrapper / Deco 模板：只 load 一次，之後 clone 給 6 顆
===================================================== */
const gltfLoader = new GLTFLoader();

let wrapperTemplate = null;
let decoTemplate = null;

// ⭐ 這兩個陣列用來處理「載入順序不同」的情況
const pendingGroupsForWrapper = [];
const pendingGroupsForDeco = [];

function tryAlignWrapperAndCandy(candyRoot, wrapperRoot) {
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
    const scaleFactor = (candySize.length() * 1.8) / wrapperSize.length();
    wrapperRoot.scale.multiplyScalar(scaleFactor);
  }

  const boxWrapper2 = new THREE.Box3().setFromObject(wrapperRoot);
  boxWrapper2.getCenter(wrapperCenter);

  const offset = new THREE.Vector3().subVectors(candyCenter, wrapperCenter);
  wrapperRoot.position.add(offset);
}

function attachWrapperAndDecoToGroup(group) {
  const candyRoot = group.userData.candyRoot;
  if (!candyRoot) return;

  // ---- Wrapper ----
  if (!wrapperTemplate) {
    // ⭐ wrapper 還沒載完，先排隊
    if (!pendingGroupsForWrapper.includes(group)) {
      pendingGroupsForWrapper.push(group);
    }
  } else if (!group.userData.wrapperRoot) {
    const wrapperRoot = wrapperTemplate.clone(true);
    wrapperRoot.traverse((m) => {
      if (m.isMesh) {
        m.renderOrder = 20;
        m.material.depthWrite = false;
        m.material.depthTest = true;
        m.userData.isWrapper = true;
      }
    });

    group.add(wrapperRoot);
    group.userData.wrapperRoot = wrapperRoot;
    tryAlignWrapperAndCandy(candyRoot, wrapperRoot);
  }

  // ---- Deco ----
  if (!decoTemplate) {
    if (!pendingGroupsForDeco.includes(group)) {
      pendingGroupsForDeco.push(group);
    }
  } else if (!group.userData.decoRoot) {
    const deco = decoTemplate.clone(true);

    // ⭐ 以糖果中心為基準，微調 offset，避免不同大小差太多
    const boxCandy = new THREE.Box3().setFromObject(candyRoot);
    const candyCenter = new THREE.Vector3();
    const candySize = new THREE.Vector3();
    boxCandy.getCenter(candyCenter);
    boxCandy.getSize(candySize);

    deco.position.copy(candyCenter);
    deco.position.x += -0.55 * (candySize.length() / 3.0);
    deco.position.y += 0.1 * (candySize.length() / 3.0);
    deco.position.z += -0.13;

    deco.rotation.set(0, 0.28, 0.03);
    deco.scale.set(1.3, 1.3, 1.3);
    candyRoot.add(deco);
    group.userData.decoRoot = deco;

    // deco 的位置請微調到你期望的 candy 局部座標
    deco.position.set(0.0, -0.08, -0.15);
    deco.rotation.set(0, 0.25, 0.1);
    deco.scale.set(1.0, 1.0, 1.0);
  }
}

gltfLoader.load("../../assets/models/container_3.glb", (gltf) => {
  const group = new THREE.Group();
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      const geo = child.geometry.clone();
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
        m.renderOrder = 20;
        m.material.depthWrite = false;
        m.userData.isWrapper = true;
      });
      frontMesh.renderOrder = 21;

      group.add(backMesh);
      group.add(frontMesh);
    }
  });
  wrapperTemplate = group;

  // ⭐ wrapper 載完後，補 attach 之前已經 load 好的 candy
  Object.values(candies).forEach((g) => attachWrapperAndDecoToGroup(g));
  pendingGroupsForWrapper.length = 0;
});

gltfLoader.load("../../assets/models/deco-4.glb", (gltf) => {
  decoTemplate = gltf.scene;
  // ⭐ deco 載完後，同樣補 attach
  Object.values(candies).forEach((g) => attachWrapperAndDecoToGroup(g));
  pendingGroupsForDeco.length = 0;
});

/* =====================================================
   建立每顆糖果：group = candy + wrapper + deco
===================================================== */
let candies = {}; // name -> group
let rotationIndex = 0;
let animating = false;

function buildCandy(name) {
  const info = DATA[name];
  const group = new THREE.Group();
  group.name = name;

  // 初始旋轉

  let baseZ = 0;

  group.rotation.set(THREE.MathUtils.degToRad(170), 0, 0);
  group.userData.baseRotX = THREE.MathUtils.degToRad(-160);
  group.userData.baseRotY = 0;
  group.userData.baseRotZ = baseZ;
  group.userData.rotVelY = 0;
  group.userData.targetRotSpeed = 0.0022;

  scene.add(group);
  candies[name] = group;

  // 載糖果
  gltfLoader.load(info.model, (gltf) => {
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.material = createCandyMaterialByName(name); // ⭐ 每顆獨立 shader
        child.renderOrder = 10;
        child.material.depthWrite = false;
        child.material.depthTest = true;
      }
    });

    const candyRoot = gltf.scene;
    candyRoot.scale.set(1.5, 1.5, 1.5);
    group.add(candyRoot);
    group.userData.candyRoot = candyRoot;

    // 這裡就會自動 attach wrapper + deco（若模板已經載好）
    attachWrapperAndDecoToGroup(group);
  });
}

/* 一次建六顆 */
ORDER.forEach((name) => buildCandy(name));

/* ========== Carousel control ========== */

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function shift(step) {
  if (animating) return;
  animating = true;

  const start = rotationIndex;
  const end = start + step;
  const duration = 500;
  const t0 = performance.now();

  function anim() {
    const now = performance.now();
    let p = (now - t0) / duration;
    if (p > 1) p = 1;

    // smoothstep（柔順）
    const ease = p * p * (3 - 2 * p);

    rotationIndex = start + (end - start) * ease;

    if (p < 1) requestAnimationFrame(anim);
    else {
      // 統一化 index
      rotationIndex = ((end % ORDER.length) + ORDER.length) % ORDER.length;
      animating = false;
    }
  }

  anim();
}

/* 初始 layout */
function applyInitialLayout() {
  ORDER.forEach((name, ordIndex) => {
    const g = candies[name];
    if (!g) return;
    const relative = (ordIndex - rotationIndex + ORDER.length) % ORDER.length;
    const p = POS[relative];
    g.position.set(p.x, p.y, p.z);
    g.scale.setScalar(p.size);
  });
}
applyInitialLayout();

/* ========== front 名稱 ========== */
function getFrontName() {
  return ORDER[rotationIndex % ORDER.length];
}

/* ========== Modal & Raycast ========== */
const modal = document.getElementById("candy-modal");
const modalImg = document.getElementById("modal-img");
const modalTitle = document.getElementById("modal-title");
const modalDesc = document.getElementById("modal-desc");
const modalBtn = document.getElementById("modal-btn");

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const label = document.getElementById("candy-label");

window.addEventListener("mousemove", (event) => {
  const frontName = getFrontName();
  const front = candies[frontName];
  if (!front || animating) {
    label.style.opacity = 0;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hit = raycaster.intersectObject(front, true);

  if (hit.length > 0) {
    label.style.opacity = 1;
    label.style.left = event.clientX + "px";
    label.style.top = event.clientY + "px";
  } else {
    label.style.opacity = 0;
  }
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects(scene.children, true);

  let clickedCandy = null;
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj && !DATA[obj.name]) obj = obj.parent;
    clickedCandy = obj;
  }

  // ① 點到正面糖果 → 開 modal
  if (clickedCandy) {
    const target = ORDER.indexOf(clickedCandy.name);
    const front = rotationIndex;

    if (clickedCandy.name === getFrontName()) {
      // 已經是 front → 開 modal
      const d = DATA[clickedCandy.name];
      modalImg.src = d.img;
      modalTitle.textContent = d.title;
      modalDesc.textContent = d.desc;
      modalBtn.onclick = () => (window.location.href = d.link);
      modal.classList.add("show");
    } else {
      // 不是 front → 旋轉到該糖果（用最短路徑）
      shiftTo(target);
    }
    return;
  }

  // ② 未點中糖果 → 判斷左右區域
  const clickX = event.clientX - rect.left;
  const centerX = rect.width / 2;

  if (clickX < centerX) {
    shift(1); // 左邊 → carousel 往右
  } else {
    shift(-1); // 右邊 → carousel 往左
  }
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("show");
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") shift(1);
  if (e.key === "ArrowRight") shift(-1);
  if (e.key === "Escape") {
    modal.classList.remove("show");
    label.style.opacity = 0;
  }
});
function shiftTo(targetIndex) {
  if (animating) return;
  const items = ORDER.length;
  const current = ((Math.round(rotationIndex) % items) + items) % items;

  let diff = (targetIndex - current + items) % items;
  if (diff > items / 2) diff -= items; // 最短路徑

  shift(diff);
}

/* ========== Animation loop：兩階段渲染 + 群組微動 ========== */

const clock = new THREE.Clock();

function setWrappersVisible(visible) {
  Object.values(candies).forEach((g) => {
    if (!g) return;
    const wrapperRoot = g.userData.wrapperRoot;
    if (wrapperRoot) wrapperRoot.visible = visible;
  });
}

function updateCandyTimeUniforms(t) {
  Object.values(candies).forEach((g) => {
    if (!g) return;
    g.traverse((child) => {
      if (
        child.isMesh &&
        child.material &&
        child.material.uniforms &&
        child.material.uniforms.uTime
      ) {
        child.material.uniforms.uTime.value = t;
      }
    });
  });
}

function updateWrapperCandyTexture() {
  Object.values(candies).forEach((g) => {
    const wrapperRoot = g.userData.wrapperRoot;
    if (!wrapperRoot) return;
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
  });
}
const HAND_DRAWN_POS = [
  // 0 = NOW：比旁邊大一點，但不誇張，位置略低、略前
  { x: 0.5, y: -1.2, z: 4.6, scale: 1.7 },

  // 1 = 左前（第二大）
  { x: -9.0, y: -0.5, z: 2.2, scale: 0.8 },

  // 2 = 左上（明顯後退 + 明顯變小）
  { x: -9.2, y: 4.0, z: -0.8, scale: 0.45 },

  // 3 = 最上（最小、最遠）
  { x: -3, y: 5, z: -2.0, scale: 0.25 },

  // 4 = 右上
  { x: 7, y: 4.0, z: -0.8, scale: 0.45 },

  // 5 = 右前
  { x: 9.5, y: 0.5, z: 2.2, scale: 0.9 },
];

function updateCarousel3D(t) {
  const items = ORDER.length;
  const frontIndex = ((Math.round(rotationIndex) % items) + items) % items;

  for (let i = 0; i < items; i++) {
    const name = ORDER[i];
    const g = candies[name];
    if (!g) continue;

    // rel = 此糖果落在 HAND_DRAWN_POS 的哪個 index（0~5）
    const rel = (i - frontIndex + items) % items;
    const P = HAND_DRAWN_POS[rel];

    // ------------------------------
    // 平滑位置插值
    // ------------------------------
    g.position.x += (P.x - g.position.x) * 0.12;
    g.position.y += (P.y - g.position.y) * 0.12;
    g.position.z += (P.z - g.position.z) * 0.12;

    // ------------------------------
    // 大小（scale）插值
    // ------------------------------
    let s = P.scale;

    // ⭐ 單獨調整 SAD 的大小（例：放大 1.3 倍）
    if (name === "SAD") {
      s *= 0.9;
    }

    g.scale.x += (s - g.scale.x) * 0.12;
    g.scale.y = g.scale.x;
    g.scale.z = g.scale.x;

    // ------------------------------
    // 動作：前方旋轉，其餘呼吸
    // ------------------------------
    if (rel === 0) {
      g.rotation.y += 0.018; // NOW 自轉
    } else {
      g.rotation.y *= 0.92; // 衰減回歸
      g.position.y += Math.sin(t * 1.4 + i) * 0.03; // 呼吸漂浮
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  updateCarousel3D(t); // ✅ 只呼叫一次
  updateCandyTimeUniforms(t);

  // 兩階段渲染
  setWrappersVisible(false);
  renderer.setRenderTarget(rtCandy);
  renderer.clear();
  renderer.render(scene, camera);

  updateWrapperCandyTexture();

  setWrappersVisible(true);
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
}

animate();

/* ============================================================
   3D Ribbon Cursor Trail（立體絲帶拖尾）
   ============================================================ */

// 螢幕座標點列（最新在前）
const trailPoints = [];
const MAX_TRAIL_POINTS = 22;

// 絲帶 Mesh / 幾何
let ribbonGeometry = null;
let ribbonMesh = null;

const ribbonMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.96,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

// 滑鼠移動 → 新增一個 trail point
window.addEventListener("mousemove", (e) => {
  trailPoints.unshift({
    x: e.clientX,
    y: e.clientY,
    life: 1,
  });
  if (trailPoints.length > MAX_TRAIL_POINTS) trailPoints.pop();
});

// 讓後面的點追前面的點，形成柔滑曲線
function smoothTrail() {
  for (let i = 1; i < trailPoints.length; i++) {
    const p = trailPoints[i];
    const prev = trailPoints[i - 1];

    const followT = 0.25 * (i / MAX_TRAIL_POINTS);

    p.x += (prev.x - p.x) * followT;
    p.y += (prev.y - p.y) * followT;

    p.life -= 0.018;
  }
}

// 螢幕座標 → 世界座標（固定在相機前方一段距離）
function screenToWorld(x, y) {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((y - rect.top) / rect.height) * 2 + 1;

  const ndc = new THREE.Vector3(ndcX, ndcY, 0.0); // near plane
  ndc.unproject(camera);

  const dir = ndc.sub(camera.position).normalize();
  const distance = 14; // 絲帶離相機距離，可微調
  return camera.position.clone().add(dir.multiplyScalar(distance));
}

// 每幀更新 3D 絲帶
function updateRibbon() {
  if (trailPoints.length < 2) {
    if (ribbonMesh) ribbonMesh.visible = false;
    return;
  }

  smoothTrail();

  // 還有壽命的點
  const alive = trailPoints.filter((p) => p.life > 0.02);
  if (alive.length < 2) {
    if (ribbonMesh) ribbonMesh.visible = false;
    return;
  }

  // 轉成世界座標
  const worldPts = alive.map((p) => screenToWorld(p.x, p.y));
  const n = worldPts.length;

  const positions = [];
  const uvs = [];
  const indices = [];

  const baseWidth = 0.65; // 絲帶中段寬度，可調

  for (let i = 0; i < n; i++) {
    const p = worldPts[i];
    const prev = worldPts[i > 0 ? i - 1 : i];
    const next = worldPts[i < n - 1 ? i + 1 : i];

    const dir = next.clone().sub(prev).normalize();
    const camDir = camera.position.clone().sub(p).normalize();
    const side = dir.clone().cross(camDir).normalize();

    // t：0 → 頭, 1 → 尾
    const t = i / (n - 1);

    // 頭尾細，中間胖
    const widthFactor = Math.sin(Math.PI * t); // 0,↑,1,↓,0
    const width = baseWidth * widthFactor;

    const left = p.clone().add(side.clone().multiplyScalar(width));
    const right = p.clone().add(side.clone().multiplyScalar(-width));

    positions.push(left.x, left.y, left.z);
    positions.push(right.x, right.y, right.z);

    uvs.push(0, t);
    uvs.push(1, t);
  }

  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, c, b, d);
  }

  if (!ribbonGeometry) {
    ribbonGeometry = new THREE.BufferGeometry();
  }

  ribbonGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  ribbonGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  ribbonGeometry.setIndex(indices);
  ribbonGeometry.computeVertexNormals();

  if (!ribbonMesh) {
    ribbonMesh = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
    ribbonMesh.renderOrder = 30; // 在 wrapper 之上，可視情況調整
    scene.add(ribbonMesh);
  } else {
    ribbonMesh.geometry.dispose();
    ribbonMesh.geometry = ribbonGeometry;
  }

  ribbonMesh.visible = true;

  // 顏色：用你剛剛定義的高飽和 map
  const colHex = getFrontCandyColor();
  ribbonMaterial.color.set(colHex);
}

window.addEventListener("load", () => {
  const pageWrap = document.getElementById("pageWrap");

  gsap.to(pageWrap, {
    y: "0%",
    duration: 1.0,
    ease: "power2.out",
  });
});

/* ========== Resize ========== */

window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);

  rtCandy.setSize(w, h);
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
