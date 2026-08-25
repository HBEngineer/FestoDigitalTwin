import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import mqtt from 'mqtt';

// ==========================================
// 1. HIVEMQ CLOUD CREDENTIALS
// ==========================================
const HIVEMQ_HOST = "0bd403ef4ed0449a81d8e2de7a705113.s1.eu.hivemq.cloud";
const HIVEMQ_PORT = 8884;
const HIVEMQ_USERNAME = "FestoPLC1";
const HIVEMQ_PASSWORD = "FestoPLC1";
const MQTT_TOPIC = "festo/actuators/positions";

// ==========================================
// 2. SCENE & CAMERA SETUP
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

let gridHelper = new THREE.GridHelper(10, 10, 0x0091ff, 0x444444);
scene.add(gridHelper);

function updateGridColor(colorHex) {
  scene.remove(gridHelper);
  gridHelper = new THREE.GridHelper(10, 10, new THREE.Color(colorHex), 0x444444);
  scene.add(gridHelper);
}

// ==========================================
// 3. UI TOGGLE & CONTROLS BINDING
// ==========================================
const statusCard = document.getElementById('status-card');
const panelToggle = document.getElementById('panel-toggle');

panelToggle.addEventListener('click', () => {
  statusCard.classList.toggle('collapsed');
});

const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 2.1);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(hemiLight);

let currentLightDistance = 7.07;
function updateKeyLightPosition(angleDeg, heightY) {
  const rad = (angleDeg * Math.PI) / 180;
  keyLight.position.x = currentLightDistance * Math.cos(rad);
  keyLight.position.z = currentLightDistance * Math.sin(rad);
  keyLight.position.y = heightY;
}
updateKeyLightPosition(165, 0.0);

document.getElementById('color-bg-picker').addEventListener('input', (e) => {
  scene.background.set(e.target.value);
});

document.getElementById('color-grid-picker').addEventListener('input', (e) => {
  updateGridColor(e.target.value);
});

document.getElementById('color-light-picker').addEventListener('input', (e) => {
  keyLight.color.set(e.target.value);
});

document.getElementById('light-key-slider').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  keyLight.intensity = val;
  document.getElementById('val-key').textContent = val.toFixed(1);
});

document.getElementById('light-amb-slider').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  ambientLight.intensity = val;
  document.getElementById('val-amb').textContent = val.toFixed(1);
});

document.getElementById('light-fill-slider').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  fillLight.intensity = val;
  document.getElementById('val-fill').textContent = val.toFixed(1);
});

document.getElementById('light-posy-slider').addEventListener('input', (e) => {
  const heightY = parseFloat(e.target.value);
  document.getElementById('val-posy').textContent = heightY.toFixed(1);
  updateKeyLightPosition(parseFloat(document.getElementById('light-posxz-slider').value), heightY);
});

document.getElementById('light-posxz-slider').addEventListener('input', (e) => {
  const angle = parseFloat(e.target.value);
  document.getElementById('val-posxz').textContent = `${angle}°`;
  updateKeyLightPosition(angle, parseFloat(document.getElementById('light-posy-slider').value));
});

document.getElementById('light-hemi-slider').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  hemiLight.intensity = val;
  document.getElementById('val-hemi').textContent = val.toFixed(1);
});

// ==========================================
// 4. MODEL LOADING & SLIDER ANIMATION
// ==========================================
let sliderBSMesh = null;
let sliderTBMesh = null;

const elBS = document.getElementById('pos-bs');
const elTB = document.getElementById('pos-tb');

function updateSliderPosition(sliderName, val) {
  if (sliderName === 'SliderBS') {
    if (elBS) elBS.textContent = `${val.toFixed(2)} mm`;
    if (sliderBSMesh) sliderBSMesh.position.z = val / 1000.0;
  }
  if (sliderName === 'SliderTB') {
    if (elTB) elTB.textContent = `${val.toFixed(2)} mm`;
    if (sliderTBMesh) sliderTBMesh.position.z = val / 1000.0;
  }
}

const loader = new GLTFLoader();
const MODEL_PATH = './model/festo_actuators.glb'; 

loader.load(
  MODEL_PATH,
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.name.includes('BS') || child.name === 'SliderBS') sliderBSMesh = child;
        if (child.name.includes('TB') || child.name === 'SliderTB') sliderTBMesh = child;
      }
    });

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
// 5. HIVEMQ CLOUD CONNECTION (PORT 8884)
// ==========================================
const brokerUrl = `wss://${HIVEMQ_HOST}:${HIVEMQ_PORT}/mqtt`;

const client = mqtt.connect(brokerUrl, {
  clientId: 'festo_web_twin_' + Math.random().toString(16).substring(2, 10),
  username: HIVEMQ_USERNAME,
  password: HIVEMQ_PASSWORD,
  clean: true
});

client.on('connect', () => {
  console.log('[MQTT] Connected to HiveMQ Cloud');
  const statusElem = document.getElementById('status');
  const dotElem = document.getElementById('dot');

  if (statusElem) {
    statusElem.innerText = 'Connected';
    statusElem.style.color = '#00ff88';
  }
  if (dotElem) {
    dotElem.style.backgroundColor = '#00ff88';
    dotElem.style.boxShadow = '0 0 10px #00ff88';
  }

  client.subscribe(MQTT_TOPIC);
});

client.on('offline', () => {
  const statusElem = document.getElementById('status');
  const dotElem = document.getElementById('dot');
  if (statusElem) {
    statusElem.innerText = 'Offline';
    statusElem.style.color = '#ff4444';
  }
  if (dotElem) {
    dotElem.style.backgroundColor = '#ff4444';
    dotElem.style.boxShadow = '0 0 10px #ff4444';
  }
});

client.on('error', (err) => {
  console.error('[MQTT Error]', err);
});

client.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    if (payload.SliderBS !== undefined) updateSliderPosition('SliderBS', payload.SliderBS);
    if (payload.SliderTB !== undefined) updateSliderPosition('SliderTB', payload.SliderTB);
  } catch (err) {
    console.error('[MQTT] Parse error:', err);
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