// ==========================================
// 1. HIVEMQ CLOUD CREDENTIALS
// ==========================================
const HIVEMQ_HOST = "0bd403ef4ed0449a81d8e2de7a705113.s1.eu.hivemq.cloud";
const HIVEMQ_PORT = 8884;
const HIVEMQ_USERNAME = "FestoPLC1";
const HIVEMQ_PASSWORD = "FestoPLC1";
const MQTT_TOPIC = "festo/actuators/positions";

// ==========================================
// 2. THREE.JS SCENE & WEBXR SETUP
// ==========================================
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f6f9);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(-0.32, 0.83, 0.97);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// Enable WebXR
renderer.xr.enabled = true;

container.appendChild(renderer.domElement);

// Append AR Button safely
const arBtn = window.ARButton || (typeof THREE !== 'undefined' && THREE.ARButton);
if (arBtn) {
  document.body.appendChild(arBtn.createButton(renderer, { requiredFeatures: ['hit-test'] }));
} else {
  console.warn('[AR] ARButton not found on window or THREE context.');
}

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- LIGHTING SETUP ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.8);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
keyLight.position.set(-3, -3.5, -0.5);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 4.0);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// Group to hold model and grid
const arGroup = new THREE.Group();
scene.add(arGroup);

// --- GRID HELPER ---
const gridHelper = new THREE.GridHelper(10, 20, 0x0091ff, 0xcccccc);
gridHelper.position.y = -0.01;
arGroup.add(gridHelper);

// WebXR Session handlers
renderer.xr.addEventListener('sessionstart', () => {
  scene.background = null;
  gridHelper.visible = false; // Hide grid in AR mode
});
renderer.xr.addEventListener('sessionend', () => {
  scene.background = new THREE.Color(0xf4f6f9);
  gridHelper.visible = true;
});

// ==========================================
// 3. LOAD GLB MODEL
// ==========================================
let sliderBSNode = null;
let sliderTBNode = null;

let initialBS = { x: 0, y: 0, z: 0 };
let initialTB = { x: 0, y: 0, z: 0 };

let targetBS = 0;
let targetTB = 0;

const SCALE_FACTOR = 1;
const LERP_FACTOR = 0.08;

const loader = new THREE.GLTFLoader();
loader.load(
  './model/festo_actuators.glb',
  (gltf) => {
    console.log('[MODEL] Loaded successfully!');
    const model = gltf.scene;

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      if (child.name === 'SliderBS') {
        sliderBSNode = child;
        initialBS = { x: child.position.x, y: child.position.y, z: child.position.z };
      }
      if (child.name === 'SliderTB') {
        sliderTBNode = child;
        initialTB = { x: child.position.x, y: child.position.y, z: child.position.z };
      }
    });

    arGroup.add(model);

    // Position grid right at the bottom of the model
    const box = new THREE.Box3().setFromObject(model);
    gridHelper.position.y = box.min.y - 0.001;

    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    controls.update();
  },
  (xhr) => {
    if (xhr.total > 0) {
      console.log(`[MODEL] ${(xhr.loaded / xhr.total * 100).toFixed(0)}% loaded`);
    }
  },
  (error) => {
    console.error('[ERROR] Failed to load GLB model:', error);
  }
);

// ==========================================
// 4. ANIMATION & RENDER LOOP
// ==========================================
function animate() {
  if (sliderBSNode) {
    const targetZ = initialBS.z + (targetBS * SCALE_FACTOR);
    sliderBSNode.position.z += (targetZ - sliderBSNode.position.z) * LERP_FACTOR;
  }

  if (sliderTBNode) {
    const targetZ = initialTB.z + (targetTB * SCALE_FACTOR);
    sliderTBNode.position.z += (targetZ - sliderTBNode.position.z) * LERP_FACTOR;
  }

  controls.update();
  renderer.render(scene, camera);
}

// Handles both desktop and WebXR loops
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 5. UPDATE TARGET VALUES FROM MQTT
// ==========================================
function updateSliderPosition(sliderName, positionVal) {
  if (sliderName === 'SliderBS') {
    targetBS = positionVal;
    const valBsElem = document.getElementById('val-bs');
    if (valBsElem) valBsElem.innerText = `${positionVal} mm`;
  }

  if (sliderName === 'SliderTB') {
    targetTB = positionVal;
    const valTbElem = document.getElementById('val-tb');
    if (valTbElem) valTbElem.innerText = `${positionVal} mm`;
  }
}

// ==========================================
// 6. HIVEMQ CLOUD CONNECTION
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
    statusElem.style.color = '#2e7d32';
  }
  if (dotElem) {
    dotElem.style.backgroundColor = '#4caf50';
    dotElem.style.boxShadow = '0 0 10px #4caf50';
  }

  client.subscribe(MQTT_TOPIC);
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