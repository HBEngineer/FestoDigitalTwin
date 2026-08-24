// ==========================================
// 1. YOUR HIVEMQ CLOUD CREDENTIALS
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

// Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f2f5);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(2, 2, 2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Orbit Controls (Mouse rotation / zoom)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// ==========================================
// 3. LOAD GLB MODEL & FIND NODES
// ==========================================
let sliderBSNode = null;
let sliderTBNode = null;

let initialBS = { x: 0, y: 0, z: 0 };
let initialTB = { x: 0, y: 0, z: 0 };

const MM_TO_METERS = 0.001;

const loader = new THREE.GLTFLoader();
loader.load(
  './model/festo_actuators.glb',
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    // Traversal to find exact sub-nodes
    model.traverse((child) => {
      if (child.name === 'SliderBS') {
        sliderBSNode = child;
        initialBS = { x: child.position.x, y: child.position.y, z: child.position.z };
      }
      if (child.name === 'SliderTB') {
        sliderTBNode = child;
        initialTB = { x: child.position.x, y: child.position.y, z: child.position.z };
      }
    });

    console.log('Nodes Loaded:', { sliderBSNode, sliderTBNode });

    // Center camera on loaded model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    camera.position.set(center.x + 0.5, center.y + 0.5, center.z + 0.5);
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

// Handle browser window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 4. POSITION UPDATE LOGIC
// ==========================================
function updateSliderPosition(sliderName, positionInMM) {
  const positionInMeters = positionInMM * MM_TO_METERS;

  if (sliderName === 'SliderBS' && sliderBSNode) {
    // Adjust axis (.x, .y, or .z) based on movement direction
    sliderBSNode.position.x = initialBS.x + positionInMeters;
    document.getElementById('val-bs').innerText = positionInMM;
  }

  if (sliderName === 'SliderTB' && sliderTBNode) {
    // Adjust axis (.x, .y, or .z) based on movement direction
    sliderTBNode.position.z = initialTB.z + positionInMeters;
    document.getElementById('val-tb').innerText = positionInMM;
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