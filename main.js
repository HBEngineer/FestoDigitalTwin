// ==========================================
// 1. YOUR HIVEMQ CLOUD CREDENTIALS
// ==========================================
const HIVEMQ_HOST = "0bd403ef4ed0449a81d8e2de7a705113.s1.eu.hivemq.cloud";
const HIVEMQ_PORT = 8884;
const HIVEMQ_USERNAME = "FestoPLC1";
const HIVEMQ_PASSWORD = "FestoPLC1";
const MQTT_TOPIC = "festo/actuators/positions";

// ==========================================
// 2. THREE.JS SCENE & LIGHTING SETUP
// ==========================================
const container = document.getElementById('canvas-container');

// Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f6f9); // Clean industrial backdrop

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

// Custom Saved Camera Position
camera.position.set(-0.13, 0.88, 0.93);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Tone Mapping & Saved Exposure
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1; // Saved value

container.appendChild(renderer.domElement);

// Orbit Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- CUSTOM LIGHTING SETUP ---

// 1. Hemisphere Light (Soft ambient sky/ground fill)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

// 2. Key Light (Custom Position & Intensity)
const keyLight = new THREE.DirectionalLight(0xffffff, 3.0); // Saved intensity
keyLight.position.set(3, -5, -5);                           // Saved position
keyLight.castShadow = true;
scene.add(keyLight);

// 3. Fill Light (Backside fill)
const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// 4. Ambient Baseline Light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// ==========================================
// 3. LOAD GLB MODEL & FIND NODES
// ==========================================
let sliderBSNode = null;
let sliderTBNode = null;

let initialBS = { x: 0, y: 0, z: 0 };
let initialTB = { x: 0, y: 0, z: 0 };

// Scale factor applied to MQTT payloads
const SCALE_FACTOR = 1; 

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
    console.log('Festo Nodes Loaded & Baselines Saved:', { sliderBSNode, sliderTBNode });

    // Target the center of the model for OrbitControls focusing
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    controls.update();
  },
  undefined,
  (error) => {
    console.error('Error loading GLB model:', error);
  }
);

// Animation / Render loop
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

// ==========================================
// 4. POSITION UPDATE LOGIC (Z-AXIS)
// ==========================================
function updateSliderPosition(sliderName, positionVal) {
  const displacement = positionVal * SCALE_FACTOR;

  if (sliderName === 'SliderBS' && sliderBSNode) {
    sliderBSNode.position.z = initialBS.z + displacement;
    document.getElementById('val-bs').innerText = positionVal;
  }

  if (sliderName === 'SliderTB' && sliderTBNode) {
    sliderTBNode.position.z = initialTB.z + displacement;
    document.getElementById('val-tb').innerText = positionVal;
  }
}

// ==========================================
// 5. HIVEMQ CLOUD CONNECTION (WSS)
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
  document.getElementById('status').innerText = 'Connected (Private)';
  document.getElementById('status').style.color = 'green';
  document.getElementById('dot').style.backgroundColor = '#00ff00';

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
  document.getElementById('status').innerText = 'Connection Error';
  document.getElementById('status').style.color = 'red';
  document.getElementById('dot').style.backgroundColor = 'red';
});