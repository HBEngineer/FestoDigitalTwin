// ==========================================
// 1. YOUR HIVEMQ CLOUD CREDENTIALS
// ==========================================
const HIVEMQ_HOST = "0bd403ef4ed0449a81d8e2de7a705113.s1.eu.hivemq.cloud";
const HIVEMQ_PORT = 8884;                                  // Secure WebSockets port
const HIVEMQ_USERNAME = "FestoPLC1";                        // Your HiveMQ credentials username
const HIVEMQ_PASSWORD = "FestoPLC1";                        // Your HiveMQ credentials password
const MQTT_TOPIC = "festo/actuators/positions";

// ==========================================
// 2. 3D MODEL & SCENE SETUP
// ==========================================
const viewer = document.getElementById('actuator-viewer');
let sliderBSNode = null;
let sliderTBNode = null;

// Store initial baseline positions so displacement moves relative to origin
let initialBS = { x: 0, y: 0, z: 0 };
let initialTB = { x: 0, y: 0, z: 0 };

// Conversion factor: millimeters to meters in 3D coordinate space
const MM_TO_METERS = 0.001; 

// Locate nodes inside <model-viewer> and save starting transforms once loaded
viewer.addEventListener('load', () => {
  const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(s => s.description === 'scene');
  const scene = viewer[sceneSymbol];

  if (scene) {
    scene.traverse((child) => {
      if (child.name === 'SliderBS') {
        sliderBSNode = child;
        initialBS = { x: child.position.x, y: child.position.y, z: child.position.z };
      }
      if (child.name === 'SliderTB') {
        sliderTBNode = child;
        initialTB = { x: child.position.x, y: child.position.y, z: child.position.z };
      }
    });
    console.log('Festo Nodes Found & Baseline Saved:', { sliderBSNode, sliderTBNode });
  }
});

// Update node position in 3D space & force frame update
function updateSliderPosition(sliderName, positionInMM) {
  const positionInMeters = positionInMM * MM_TO_METERS;

  if (sliderName === 'SliderBS' && sliderBSNode) {
    // Modify axis (.x, .y, or .z) based on physical movement orientation
    sliderBSNode.position.x = initialBS.x + positionInMeters; 
    document.getElementById('val-bs').innerText = positionInMM;
  } 
  
  if (sliderName === 'SliderTB' && sliderTBNode) {
    // Modify axis (.x, .y, or .z) based on physical movement orientation
    sliderTBNode.position.z = initialTB.z + positionInMeters; 
    document.getElementById('val-tb').innerText = positionInMM;
  }

  // Force <model-viewer> to redraw the canvas
  if (typeof viewer.queueRender === 'function') {
    viewer.queueRender();
  }
}

// ==========================================
// 3. HIVEMQ CLOUD CONNECTION (WSS)
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
    // Expecting combined JSON payload: {"SliderBS": 120.5, "SliderTB": 45.0}
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