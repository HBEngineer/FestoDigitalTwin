import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import mqtt from 'mqtt';

// ==========================================
// 1. SCENE SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(10, 8, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// ==========================================
// 2. LIGHTING SETUP
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
keyLight.position.set(5, -3.5, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// ==========================================
// 3. UI LIGHT CONTROL LISTENERS
// ==========================================
const sliderKey = document.getElementById('light-key-slider');
const sliderAmb = document.getElementById('light-amb-slider');
const sliderPos = document.getElementById('light-pos-slider');

const valKey = document.getElementById('val-key');
const valAmb = document.getElementById('val-amb');
const valPos = document.getElementById('val-pos');

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

sliderPos.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  keyLight.position.y = val;
  valPos.textContent = val.toFixed(1);
});

// ==========================================
// 4. MODEL LOADING & ACTUATORS
// ==========================================
let sliderBSMesh = null;
let sliderTBMesh = null;

// Telemetry DOM elements
const elBS = document.getElementById('pos-bs');
const elTB = document.getElementById('pos-tb');

const loader = new GLTFLoader();
loader.load(
  './models/festo_assembly.gltf', // Path to your 3D CAD model
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    // Locate moveable slider objects within the hierarchy
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      if (child.name === 'ELGD_BS_Slider') sliderBSMesh = child;
      if (child.name === 'ELGD_TB_Slider') sliderTBMesh = child;
    });

    console.log('3D Model loaded successfully');
  },
  undefined,
  (error) => {
    console.error('An error occurred loading the 3D model:', error);
  }
);

// ==========================================
// 5. HIVEMQ CLOUD MQTT WEBSOCKET CONNECTION
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
        // Map millimeter positions to 3D world space (adjust axis & scale as needed)
        sliderBSMesh.position.x = data.SliderBS / 1000.0;
      }
    }

    if (data.SliderTB !== undefined) {
      elTB.textContent = `${data.SliderTB.toFixed(2)} mm`;
      if (sliderTBMesh) {
        sliderTBMesh.position.y = data.SliderTB / 1000.0;
      }
    }
  } catch (err) {
    console.error('[MQTT] Failed to parse payload:', err);
  }
});

// ==========================================
// 6. RENDER LOOP & RESIZE HANDLING
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