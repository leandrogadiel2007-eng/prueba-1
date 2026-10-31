import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const host = document.getElementById("cube-view");
const loading = document.getElementById("loading");
const countLabel = document.getElementById("move-count");
const statusLabel = document.getElementById("cube-status");
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#172a42");

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
camera.position.set(5.4, 4.4, 6.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 4.4;
controls.maxDistance = 10;
controls.target.set(0, 0, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xe4efff, 0x34435a, 2.05));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(4, 7, 6);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x8bbaff, 1.05);
fillLight.position.set(-5, 2, -4);
scene.add(fillLight);

const cubeGroup = new THREE.Group();
scene.add(cubeGroup);
const cubies = [];
const size = 0.94;
const spacing = 1.015;
const black = 0x11151d;
const faceColors = {
  right: 0xe84148, left: 0xff8a28,
  up: 0xf5f4eb, down: 0xffd32f,
  front: 0x24b66e, back: 0x287ce5
};

function makeCubie(x, y, z) {
  const materials = [
    new THREE.MeshStandardMaterial({ color: x === 1 ? faceColors.right : black, roughness: 0.48 }),
    new THREE.MeshStandardMaterial({ color: x === -1 ? faceColors.left : black, roughness: 0.48 }),
    new THREE.MeshStandardMaterial({ color: y === 1 ? faceColors.up : black, roughness: 0.48 }),
    new THREE.MeshStandardMaterial({ color: y === -1 ? faceColors.down : black, roughness: 0.48 }),
    new THREE.MeshStandardMaterial({ color: z === 1 ? faceColors.front : black, roughness: 0.48 }),
    new THREE.MeshStandardMaterial({ color: z === -1 ? faceColors.back : black, roughness: 0.48 })
  ];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), materials);
  mesh.position.set(x * spacing, y * spacing, z * spacing);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.home = { x, y, z };
  mesh.userData.homeQuaternion = new THREE.Quaternion();
  cubeGroup.add(mesh);
  cubies.push(mesh);
}

function createSolvedCube() {
  for (const cubie of cubies) {
    cubeGroup.remove(cubie);
    cubie.geometry.dispose();
    cubie.material.forEach(material => material.dispose());
  }
  cubies.length = 0;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) makeCubie(x, y, z);
    }
  }
  updateStatus();
}

function snapCubie(cubie) {
  cubie.position.set(
    Math.round(cubie.position.x / spacing) * spacing,
    Math.round(cubie.position.y / spacing) * spacing,
    Math.round(cubie.position.z / spacing) * spacing
  );
  const euler = new THREE.Euler().setFromQuaternion(cubie.quaternion, "XYZ");
  const step = Math.PI / 2;
  cubie.rotation.set(
    Math.round(euler.x / step) * step,
    Math.round(euler.y / step) * step,
    Math.round(euler.z / step) * step,
    "XYZ"
  );
}

let queue = [];
let moving = false;
let moveCount = 0;
let history = [];
let redoStack = [];
let scrambleMode = false;

function parseMove(notation) {
  const face = notation[0];
  const suffix = notation.slice(1);
  const config = {
    R: ["x", 1], L: ["x", -1],
    U: ["y", 1], D: ["y", -1],
    F: ["z", 1], B: ["z", -1]
  };
  const [axis, layer] = config[face];
  let angle = -layer * Math.PI / 2;
  if (suffix === "'") angle *= -1;
  if (suffix === "2") angle *= 2;
  return { face, axis, layer, angle };
}

function enqueueMove(notation, record = true) {
  if (record) {
    history.push(notation);
    redoStack.length = 0;
    updateHistoryButtons();
  }
  queue.push({ notation });
  if (!moving) runNextMove();
}

function runNextMove() {
  if (!queue.length) {
    moving = false;
    if (scrambleMode) {
      scrambleMode = false;
      statusLabel.textContent = "Mezclado";
    }
    updateStatus();
    return;
  }

  moving = true;
  const item = queue.shift();
  const move = parseMove(item.notation);
  const pivot = new THREE.Group();
  cubeGroup.add(pivot);
  const selected = cubies.filter(cubie => Math.round(cubie.position[move.axis] / spacing) === move.layer);
  selected.forEach(cubie => pivot.attach(cubie));

  const start = performance.now();
  const duration = item.notation.endsWith("2") ? 245 : 190;
  const from = 0;
  const to = move.angle;

  function animate(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    pivot.rotation[move.axis] = from + (to - from) * eased;

    if (t < 1) {
      requestAnimationFrame(animate);
      return;
    }

    selected.forEach(cubie => {
      cubeGroup.attach(cubie);
      snapCubie(cubie);
    });
    cubeGroup.remove(pivot);
    moveCount++;
    countLabel.textContent = String(moveCount);
    updateStatus();
    runNextMove();
  }

  requestAnimationFrame(animate);
}

function invertMove(notation) {
  if (notation.endsWith("2")) return notation;
  return notation.endsWith("'") ? notation[0] : notation + "'";
}

function updateHistoryButtons() {
  undoButton.disabled = history.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

function isSolved() {
  return cubies.every(cubie => {
    const home = cubie.userData.home;
    const atHome =
      Math.abs(cubie.position.x - home.x * spacing) < 0.025 &&
      Math.abs(cubie.position.y - home.y * spacing) < 0.025 &&
      Math.abs(cubie.position.z - home.z * spacing) < 0.025;
    const q = cubie.quaternion;
    const sameRotation = Math.abs(q.x) < 0.01 && Math.abs(q.y) < 0.01 &&
      Math.abs(q.z) < 0.01 && Math.abs(Math.abs(q.w) - 1) < 0.01;
    return atHome && sameRotation;
  });
}

function updateStatus() {
  if (moving || queue.length) return;
  if (isSolved()) {
    statusLabel.textContent = "Resuelto";
    statusLabel.style.color = "#63d8a4";
  } else {
    statusLabel.textContent = scrambleMode ? "Mezclando…" : "En progreso";
    statusLabel.style.color = "#f2c36d";
  }
}

function resetCube() {
  queue.length = 0;
  moving = false;
  history = [];
  redoStack = [];
  moveCount = 0;
  countLabel.textContent = "0";
  createSolvedCube();
  updateHistoryButtons();
  statusLabel.textContent = "Resuelto";
  statusLabel.style.color = "#63d8a4";
}

document.querySelectorAll("[data-move]").forEach(button => {
  button.addEventListener("click", () => enqueueMove(button.dataset.move));
});

undoButton.addEventListener("click", () => {
  if (!history.length) return;
  const move = history.pop();
  redoStack.push(move);
  enqueueMove(invertMove(move), false);
  updateHistoryButtons();
});

redoButton.addEventListener("click", () => {
  if (!redoStack.length) return;
  const move = redoStack.pop();
  history.push(move);
  enqueueMove(move, false);
  updateHistoryButtons();
});

document.getElementById("scramble").addEventListener("click", () => {
  queue.length = 0;
  const faces = ["U", "D", "R", "L", "F", "B"];
  let previous = "";
  const sequence = [];
  for (let i = 0; i < 22; i++) {
    let face;
    do { face = faces[Math.floor(Math.random() * faces.length)]; } while (face === previous);
    previous = face;
    const suffix = ["", "'", "2"][Math.floor(Math.random() * 3)];
    sequence.push(face + suffix);
  }
  history = [];
  redoStack = [];
  moveCount = 0;
  countLabel.textContent = "0";
  updateHistoryButtons();
  scrambleMode = true;
  statusLabel.textContent = "Mezclando…";
  sequence.forEach(move => enqueueMove(move));
});

document.getElementById("solve-reset").addEventListener("click", resetCube);

document.getElementById("view-reset").addEventListener("click", () => {
  camera.position.set(5.4, 4.4, 6.2);
  controls.target.set(0, 0, 0);
  controls.update();
});

window.addEventListener("keydown", event => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  const key = event.key.toUpperCase();
  if (!["U", "D", "R", "L", "F", "B"].includes(key)) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  enqueueMove(key + (event.shiftKey ? "'" : ""));
});

function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
new ResizeObserver(resize).observe(host);
resize();
createSolvedCube();
loading.remove();

function render() {
  requestAnimationFrame(render);
  controls.update();
  renderer.render(scene, camera);
}
render();