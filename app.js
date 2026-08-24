import * as THREE from 'https://unpkg.com/three@0.179.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.179.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.179.1/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

camera.position.set(2, 2, 2);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(
    camera,
    renderer.domElement
);

const light1 = new THREE.DirectionalLight(0xffffff, 2);
light1.position.set(5, 5, 5);
scene.add(light1);

const light2 = new THREE.AmbientLight(0xffffff, 1);
scene.add(light2);

const loader = new GLTFLoader();

loader.load(
    './actuator.glb',

    function(gltf){

        scene.add(gltf.scene);

        console.log("Model loaded");

        gltf.scene.traverse(function(obj){
            console.log(obj.name);
        });
    },

    undefined,

    function(error){
        console.error(error);
    }
);

function animate(){

    requestAnimationFrame(animate);

    controls.update();

    renderer.render(scene, camera);
}

animate();