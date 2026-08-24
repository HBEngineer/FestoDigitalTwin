# Festo Digital Twin (minimal)

This small demo loads a GLB actuator model and exposes two sliders to control nodes named `SliderBS` and `SliderTB`.

Features:
- Render GLB with Three.js
- Local slider controls
- MQTT (WebSocket) publish/subscribe to `festo/sliderBS` and `festo/sliderTB`

Quick start:

1. Install `http-server` if you don't have it: `npm i -g http-server` or use the npm script below.
2. Run the site:

```bash
npm install
npm start
# then open http://localhost:8080
```

Notes:
- The app attempts to connect to the public Mosquitto WebSocket broker `wss://test.mosquitto.org:8081` by default.
- OPC UA is not supported directly in the browser; use a bridge (e.g., a small Node.js service that subscribes an OPC UA server and republishes values to MQTT).
- Adjust `maxTravel` in `app.js` to match your model's physical travel.
