// ==========================================
// 1. YOUR HIVEMQ CLOUD CREDENTIALS
// ==========================================
const HIVEMQ_HOST = "0bd403ef4ed0449a81d8e2de7a705113.s1.eu.hivemq.cloud"; // Replace with your Cluster URL (without wss://)
const HIVEMQ_PORT = 8884;                                  // Secure WebSockets port
const HIVEMQ_USERNAME = "FestoPLC1";            // Your HiveMQ credentials username
const HIVEMQ_PASSWORD = "FestoPLC1";            // Your HiveMQ credentials password
const MQTT_TOPIC = "festo/actuators/positions";


// ==========================================
// 2. 3D MODEL & SCENE SETUP
// ==========================================
const viewer = document.getElementById('actuator-viewer');
let sliderBSNode = null;
let sliderTBNode = null;

// Conversion factor: millimeters to meters in 3D coordinate space
const MM_TO_METERS = 0.001; 

// Locate nodes inside <model-viewer> once loaded
viewer.addEventListener('load', () => {
  const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(s => s.description === 'scene');
  const scene = viewer[sceneSymbol];

  if (scene) {
    scene.traverse((child) => {
      if (child.name === 'SliderBS') sliderBSNode = child;
      if (child.name === 'SliderTB') sliderTBNode = child;
    });
    console.log('Festo Nodes Found:', { sliderBSNode, sliderTBNode });
  }
});

// Update node position in 3D space
function updateSliderPosition(sliderName, positionInMM) {
  const positionInMeters = positionInMM * MM_TO_METERS;

  if (sliderName === 'SliderBS' && sliderBSNode) {
    sliderBSNode.position.x = positionInMeters; // Change to .y or .z if it moves along a different axis
    document.getElementById('val-bs').innerText = positionInMM;
  } 
  
  if (sliderName === 'SliderTB' && sliderTBNode) {
    sliderTBNode.position.z = positionInMeters; // Change to .x or .y if it moves along a different axis
    document.getElementById('val-tb').innerText = positionInMM;
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
    // Parse the combined JSON payload: {"SliderBS": 120.5, "SliderTB": 45.0}
    const payload = JSON.parse(message.toString());
    
    // Check if SliderBS is in the message and update it
    if (payload.SliderBS !== undefined) {
      updateSliderPosition('SliderBS', payload.SliderBS);
    }
    
    // Check if SliderTB is in the message and update it
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