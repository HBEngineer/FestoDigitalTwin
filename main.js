import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import mqtt from 'mqtt';

// ==========================================
// 1. SCENE & CAMERA SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(2, 2, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Dynamic Grid Helper
let gridHelper = new THREE.GridHelper(10, 10, 0x0091ff, 0x444444);
scene.add(gridHelper);

// Function to recreate floor grid when primary color changes
function updateGridColor(colorHex) {
  scene.remove(gridHelper);
  gridHelper = new THREE.GridHelper(10, 10, new THREE.Color(colorHex), 0x444444);
  scene.add(gridHelper);
}

// ==========================================
// 2. FULL LIGHTING SUITE SETUP
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
keyLight.position.set(5, 5, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(hemiLight);

// Calculate X and Z positions based on angle in degrees
let currentLightDistance = 7.07; // Distance from center
function updateKeyLightPosition(angleDeg, heightY) {
  const rad = (angleDeg * Math.PI) / 180;
  keyLight.position.x = currentLightDistance * Math.cos(rad);
  keyLight.position.z = currentLightDistance * Math.sin(rad);
  keyLight.position.y = heightY;
}

// ==========================================
// 3. UI COLOR & LIGHT LISTENERS
// ==========================================
// Color Pickers
const pickerBg = document.getElementById('color-bg-picker');
const pickerGrid = document.getElementById('color-grid-picker');
const pickerLight = document.getElementById('color-light-picker');

pickerBg.addEventListener('input', (e) => {
  scene.background.set(e.target.value);
});

pickerGrid.addEventListener('input', (e) => {
  updateGridColor(e.target.value);
});

pickerLight.addEventListener('input', (e) => {
  keyLight.color.set(e.target.value);
});

// Light Sliders & Value Displays
const sliderKey = document.getElementById('light-key-slider');
const sliderAmb = document.getElementById('light-amb-slider');
const sliderFill = document.getElementById('light-fill-slider');
const sliderPosY = document.getElementById('light-posy-slider');
const sliderPosXZ = document.getElementById('light-posxz-slider');
const sliderHemi = document.getElementById('light-hemi-slider');

const valKey = document.getElementById('val-key');
const valAmb = document.getElementById('val-amb');
const valFill = document.getElementById('val-fill');
const valPosY = document.getElementById('val-posy');
const valPosXZ = document.getElementById('val-posxz');
const valHemi = document.getElementById('val-hemi');

sliderKey.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  keyLight.intensity = val;
  valKey.textContent = val.toFixed(1);
});

sliderAmb.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  ambientLight.intensity = val;
  valAmb.textContent = val.toFixed(1);
});

sliderFill.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  fillLight.intensity = val;
  valFill.textContent = val.toFixed(1);
});

sliderPosY.addEventListener('input', (e) => {
  const heightY = parseFloat(e.target.value);
  valPosY.textContent = heightY.toFixed(1);
  updateKeyLightPosition(parseFloat(sliderPosXZ.value), heightY);
});

sliderPosXZ.addEventListener('input', (e) => {
  const angle = parseFloat(e.target.value);
  valPosXZ.textContent = `${angle}°`;
  updateKeyLightPosition(angle, parseFloat(sliderPosY.value));
});

sliderHemi.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  hemiLight.intensity = val;
  valHemi.textContent = val.toFixed(1);
});

// ==========================================
// 4. MODEL LOADING & AUTO-CENTERING
// ==========================================
let sliderBSMesh = null;
let sliderTBMesh = null;

const elBS = document.getElementById('pos-bs');
const elTB = document.getElementById('pos-tb');

const loader = new GLTFLoader();
const MODEL_PATH = './model/festo_actuators.glb'; 

loader.load(
  MODEL_PATH,
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    console.log('[3D] Model loaded successfully!');

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        if (child.material) {
          child.material.roughness = 0.5;
          child.material.metalness = 0.2;
        }

        if (child.name.includes('BS') || child.name === 'SliderBS') sliderBSMesh = child;
        if (child.name.includes('TB') || child.name === 'SliderTB') sliderTBMesh = child;
      }
    });

    // Auto-center camera to bounding box
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    controls.target.copy(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(center.x + maxDim * 1.5, center.y + maxDim * 1.5, center.z + maxDim * 1.5);
    camera.lookAt(center);
    controls.update();
  },
  undefined,
  (error) => {
    console.error(`[3D Error] Failed to load model at "${MODEL_PATH}"`, error);
  }
);

// ==========================================
// 5. MQTT WEBSOCKET CONNECTION
// ==========================================
const MQTT_BROKER = 'wss://0bd403ef4ed0449a81d8e2de7a705113.s1.eu.hivemq.cloud:8843/mqtt';
const MQTT_TOPIC = 'festo/actuators/positions';

const client = mqtt.connect(MQTT_BROKER, {
  username: 'FestoPLC1',
  password: 'FestoPLC1',
  clean: true,
  connectTimeout: 4000
});

client.on('connect', () => {
  console.log('[MQTT] Connected to HiveMQ Cloud via WebSocket!');
  client.subscribe(MQTT_TOPIC);
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    if (data.SliderBS !== undefined) {
      elBS.textContent = `${data.SliderBS.toFixed(2)} mm`;
      if (sliderBSMesh) {
        sliderBSMesh.position.z = data.SliderBS / 1000.0;
      }
    }

    if (data.SliderTB !== undefined) {
      elTB.textContent = `${data.SliderTB.toFixed(2)} mm`;
      if (sliderTBMesh) {
        sliderTBMesh.position.z = data.SliderTB / 1000.0;
      }
    }
  } catch (err) {
    console.error('[MQTT] Failed to parse payload:', err);
  }
});

// ==========================================
// 6. RENDER LOOP
// ==========================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});