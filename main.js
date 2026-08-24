const viewer = document.getElementById('actuator-viewer');
let sliderBSNode = null;
let sliderTBNode = null;

// Conversion factor: millimeter inputs to meters in 3D coordinate space
const MM_TO_METERS = 0.001; 

// 1. Locate 3D nodes inside <model-viewer> once loaded
viewer.addEventListener('load', () => {
  // Extract the underlying Three.js scene object
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

// Function to translate 3D mesh nodes based on PLC input
function updateSliderPosition(sliderName, positionInMM) {
  const positionInMeters = positionInMM * MM_TO_METERS;

  if (sliderName === 'SliderBS' && sliderBSNode) {
    sliderBSNode.position.x = positionInMeters; // Adjust axis (x, y, or z) if needed
    document.getElementById('val-bs').innerText = positionInMM;
  } 
  
  if (sliderName === 'SliderTB' && sliderTBNode) {
    sliderTBNode.position.z = positionInMeters; // Adjust axis (x, y, or z) if needed
    document.getElementById('val-tb').innerText = positionInMM;
  }
}

// 2. Connect to HiveMQ Public WebSocket Broker over Secure HTTPS (WSS)
// Using MQTT.js library loaded in index.html
const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
const topic = 'festo/actuators/positions';

const client = mqtt.connect(brokerUrl, {
  clientId: 'festo_web_twin_' + Math.random().toString(16).substring(2, 10),
  clean: true
});

client.on('connect', () => {
  console.log('Connected to HiveMQ Broker!');
  document.getElementById('status').innerText = 'Connected';
  document.getElementById('status').style.color = 'green';
  document.getElementById('dot').style.backgroundColor = '#00ff00';

  // Subscribe to position update topic
  client.subscribe(topic, (err) => {
    if (!err) {
      console.log(`Subscribed to topic: ${topic}`);
    }
  });
});

client.on('message', (receivedTopic, message) => {
  try {
    // Expects JSON payload: {"slider": "SliderBS", "value": 150}
    const payload = JSON.parse(message.toString());
    if (payload.slider && payload.value !== undefined) {
      updateSliderPosition(payload.slider, payload.value);
    }
  } catch (err) {
    console.error('Error parsing MQTT payload:', err);
  }
});

client.on('error', (err) => {
  console.error('HiveMQ Connection Error:', err);
  document.getElementById('status').innerText = 'Error';
  document.getElementById('status').style.color = 'red';
  document.getElementById('dot').style.backgroundColor = 'red';
});