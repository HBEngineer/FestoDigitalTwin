// ==========================================
// 1. HIVEMQ CLOUD CREDENTIALS
// ==========================================
const HIVEMQ_HOST = "0bd403ef4ed0449a81d8e2de7a705113.s1.eu.hivemq.cloud";
const HIVEMQ_PORT = 8884;
const HIVEMQ_USERNAME = "FestoPLC1";
const HIVEMQ_PASSWORD = "FestoPLC1";
const MQTT_TOPIC = "festo/actuators/positions";

// ==========================================
// 2. THREE.JS SCENE SETUP
// ==========================================
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f6f9);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

// Saved Camera Position
camera.position.set(-0.32, 0.83, 0.97);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- LIGHTING SETUP ---

// 1. Hemisphere Light
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.8);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

// 2. Key Directional Light
const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
keyLight.position.set(-3, -3.5, -0.5);
keyLight.castShadow = true;
scene.add(keyLight);

// 3. Fill Light
const fillLight = new THREE.DirectionalLight(0xffffff, 4.0);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// 4. Ambient Light Baseline
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// ==========================================
// 3. CREATE BASE PLATE FOR ACTUATORS
// ==========================================
function createActuatorBase(modelBox) {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  modelBox.getSize(size);
  modelBox.getCenter(center);

  // Double size footprint (2.4x) and reduced thickness (0.01 units)
  const baseWidth = size.x * 2.4;
  const baseDepth = size.z * 2.4;
  const baseThickness = 0.01;

  // Dark metallic material for thin plate
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x22252a,
    metalness: 0.85,
    roughness: 0.25
  });

  const baseGeometry = new THREE.BoxGeometry(baseWidth, baseThickness, baseDepth);
  const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);

  // Position plate flush underneath the bottom of the model
  baseMesh.position.set(
    center.x,
    modelBox.min.y - (baseThickness / 2),
    center.z
  );
  baseMesh.receiveShadow = true;
  baseMesh.castShadow = true;

  scene.add(baseMesh);
}

// ==========================================
// 4. LOAD GLB MODEL & INTERPOLATION SETUP
// ==========================================
let sliderBSNode = null;
let sliderTBNode = null;

let initialBS = { x: 0, y: 0, z: 0 };
let initialTB = { x: 0, y: 0, z: 0 };

// Target positions received via MQTT
let targetBS = 0;
let targetTB = 0;

const SCALE_FACTOR = 1;
const LERP_FACTOR = 0.08; // Smooth movement interpolation factor

const loader = new THREE.GLTFLoader();
loader.load(
  './model/festo_actuators.glb',
  (gltf) => {
    const model = gltf.scene;

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.needsUpdate = true;
        }
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

    scene.add(model);

    // Compute bounding box and create base automatically
    const box = new THREE.Box3().setFromObject(model);
    createActuatorBase(box);

    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    controls.update();
  },
  undefined,
  (error) => {
    console.error('Error loading GLB model:', error);
  }
);

// ==========================================
// 5. ANIMATION LOOP WITH INTERPOLATION
// ==========================================
function animate() {
  requestAnimationFrame(animate);

  // Smoothly lerp SliderBS along Z-axis toward target position
  if (sliderBSNode) {
    const targetZ = initialBS.z + (targetBS * SCALE_FACTOR);
    sliderBSNode.position.z += (targetZ - sliderBSNode.position.z) * LERP_FACTOR;
  }

  // Smoothly lerp SliderTB along Z-axis toward target position
  if (sliderTBNode) {
    const targetZ = initialTB.z + (targetTB * SCALE_FACTOR);
    sliderTBNode.position.z += (targetZ - sliderTBNode.position.z) * LERP_FACTOR;
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 6. UPDATE TARGET VALUES FROM MQTT
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
// 7. HIVEMQ CLOUD CONNECTION (WSS)
// ==========================================
const brokerUrl = `wss://${HIVEMQ_HOST}:${HIVEMQ_PORT}/mqtt`;

const client = mqtt.connect(brokerUrl, {
  clientId: 'festo_web_twin_' + Math.random().toString(16).substring(2, 10),
  username: HIVEMQ_USERNAME,
  password: HIVEMQ_PASSWORD,
  clean: true
});

client.on('connect', () => {
  console.log('Connected to private HiveMQ Cloud!');
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

  client.subscribe(MQTT_TOPIC, (err) => {
    if (!err) console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
  });
});

client.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());

    if (payload.SliderBS !== undefined) {
      updateSliderPosition('SliderBS', payload.SliderBS);
    }

    if (payload.SliderTB !== undefined) {
      updateSliderPosition('SliderTB', payload.SliderTB);
    }

  } catch (err) {
    console.error('Error parsing MQTT payload:', err);
  }
});

client.on('error', (err) => {
  console.error('HiveMQ Connection Error:', err);
  const statusElem = document.getElementById('status');
  const dotElem = document.getElementById('dot');

  if (statusElem) {
    statusElem.innerText = 'Connection Error';
    statusElem.style.color = '#c62828';
  }
  if (dotElem) {
    dotElem.style.backgroundColor = '#f44336';
    dotElem.style.boxShadow = '0 0 10px #f44336';
  }
});

client.on('offline', () => {
  const statusElem = document.getElementById('status');
  const dotElem = document.getElementById('dot');

  if (statusElem) {
    statusElem.innerText = 'Offline';
    statusElem.style.color = '#ff9800';
  }
  if (dotElem) {
    dotElem.style.backgroundColor = '#ff9800';
    dotElem.style.boxShadow = '0 0 10px #ff9800';
  }
});