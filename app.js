import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const host = document.getElementById("cube-view");
const loading = document.getElementById("loading");
const countLabel = document.getElementById("move-count");
const statusLabel = document.getElementById("cube-status");
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");
const typeSelect = document.getElementById("cube-type");
const sizeBadge = document.getElementById("size-badge");
const description = document.getElementById("cube-description");

const TYPE_INFO = {
  2: "Pocket Cube: solo tiene esquinas; es compacto y rápido de resolver.",
  3: "El clásico de seis caras y tres capas por lado.",
  4: "Rubik's Revenge: añade centros móviles y aristas emparejadas.",
  5: "Professor's Cube: cinco capas por lado y más piezas que organizar.",
  6: "Seis capas por lado: un reto avanzado con paridad.",
  7: "Siete capas por lado: el mayor tamaño de esta colección."
};

const scene = new THREE.Scene();
scene.background = new THREE.Color("#172a42");
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
camera.position.set(5.4, 4.4, 6.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
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
let cubies = [];
let cubeletGeometry = null;
let cubeSize = 3;
let spacing = 2.75 / cubeSize;
const black = 0x11151d;
const faceColors = {
  right: 0xe84148, left: 0xff8a28,
  up: 0xf5f4eb, down: 0xffd32f,
  front: 0x24b66e, back: 0x287ce5
};
const materials = {
  black: new THREE.MeshStandardMaterial({ color: black, roughness: 0.52 }),
  right: new THREE.MeshStandardMaterial({ color: faceColors.right, roughness: 0.48 }),
  left: new THREE.MeshStandardMaterial({ color: faceColors.left, roughness: 0.48 }),
  up: new THREE.MeshStandardMaterial({ color: faceColors.up, roughness: 0.48 }),
  down: new THREE.MeshStandardMaterial({ color: faceColors.down, roughness: 0.48 }),
  front: new THREE.MeshStandardMaterial({ color: faceColors.front, roughness: 0.48 }),
  back: new THREE.MeshStandardMaterial({ color: faceColors.back, roughness: 0.48 })
};

function coordinate(index) {
  return (index - (cubeSize - 1) / 2) * spacing;
}

function makeCubie(x, y, z) {
  const faceMaterials = [
    x === cubeSize - 1 ? materials.right : materials.black,
    x === 0 ? materials.left : materials.black,
    y === cubeSize - 1 ? materials.up : materials.black,
    y === 0 ? materials.down : materials.black,
    z === cubeSize - 1 ? materials.front : materials.black,
    z === 0 ? materials.back : materials.black
  ];
  const mesh = new THREE.Mesh(cubeletGeometry, faceMaterials);
  mesh.position.set(coordinate(x), coordinate(y), coordinate(z));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.home = mesh.position.clone();
  cubeGroup.add(mesh);
  cubies.push(mesh);
}

let queue = [];
let moving = false;
let moveCount = 0;
let history = [];
let redoStack = [];
let scrambleMode = false;
let activePivot = null;
let animationGeneration = 0;

function createSolvedCube() {
  cubeGroup.clear();
  cubies = [];
  spacing = 2.75 / cubeSize;
  const pieceSize = spacing * 0.91;
  if (cubeletGeometry) cubeletGeometry.dispose();
  cubeletGeometry = new THREE.BoxGeometry(pieceSize, pieceSize, pieceSize);
  for (let x = 0; x < cubeSize; x++) {
    for (let y = 0; y < cubeSize; y++) {
      for (let z = 0; z < cubeSize; z++) makeCubie(x, y, z);
    }
  }
  updateStatus();
}

function layerIndex(position) {
  return Math.round(position / spacing + (cubeSize - 1) / 2);
}

function snapCubie(cubie) {
  cubie.position.set(
    (layerIndex(cubie.position.x) - (cubeSize - 1) / 2) * spacing,
    (layerIndex(cubie.position.y) - (cubeSize - 1) / 2) * spacing,
    (layerIndex(cubie.position.z) - (cubeSize - 1) / 2) * spacing
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

function parseMove(notation) {
  const face = notation[0];
  const suffix = notation.slice(1);
  const config = {
    R: ["x", 1], L: ["x", -1],
    U: ["y", 1], D: ["y", -1],
    F: ["z", 1], B: ["z", -1]
  };
  const [axis, side] = config[face];
  const layer = side > 0 ? cubeSize - 1 : 0;
  let angle = -side * Math.PI / 2;
  if (suffix === "'") angle *= -1;
  if (suffix === "2") angle *= 2;
  return { axis, layer, angle };
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
  const generation = animationGeneration;
  const pivot = new THREE.Group();
  activePivot = pivot;
  cubeGroup.add(pivot);
  const selected = cubies.filter(cubie => layerIndex(cubie.position[move.axis]) === move.layer);
  selected.forEach(cubie => pivot.attach(cubie));

  const start = performance.now();
  const duration = item.notation.endsWith("2") ? 245 : 190;

  function animate(now) {
    if (generation !== animationGeneration) return;
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    pivot.rotation[move.axis] = move.angle * eased;

    if (t < 1) {
      requestAnimationFrame(animate);
      return;
    }

    selected.forEach(cubie => {
      cubeGroup.attach(cubie);
      snapCubie(cubie);
    });
    cubeGroup.remove(pivot);
    activePivot = null;
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
  const localNormals = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
  ];
  const exposedFaces = [
    { axis: 0, side: 1, expected: materials.right, normal: new THREE.Vector3(1, 0, 0) },
    { axis: 0, side: -1, expected: materials.left, normal: new THREE.Vector3(-1, 0, 0) },
    { axis: 1, side: 1, expected: materials.up, normal: new THREE.Vector3(0, 1, 0) },
    { axis: 1, side: -1, expected: materials.down, normal: new THREE.Vector3(0, -1, 0) },
    { axis: 2, side: 1, expected: materials.front, normal: new THREE.Vector3(0, 0, 1) },
    { axis: 2, side: -1, expected: materials.back, normal: new THREE.Vector3(0, 0, -1) }
  ];

  for (const cubie of cubies) {
    const indexes = [
      layerIndex(cubie.position.x),
      layerIndex(cubie.position.y),
      layerIndex(cubie.position.z)
    ];
    for (const face of exposedFaces) {
      const isOnFace = face.side > 0
        ? indexes[face.axis] === cubeSize - 1
        : indexes[face.axis] === 0;
      if (!isOnFace) continue;

      const stickerIndex = localNormals.findIndex(normal =>
        normal.clone().applyQuaternion(cubie.quaternion).dot(face.normal) > 0.999
      );
      if (stickerIndex < 0 || cubie.material[stickerIndex] !== face.expected) return false;
    }
  }
  return true;
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

function cancelPendingMoves() {
  animationGeneration++;
  queue.length = 0;
  moving = false;
  if (activePivot) {
    for (const child of [...activePivot.children]) cubeGroup.attach(child);
    cubeGroup.remove(activePivot);
    activePivot = null;
  }
  scrambleMode = false;
}

function resetCube() {
  cancelPendingMoves();
  history = [];
  redoStack = [];
  moveCount = 0;
  countLabel.textContent = "0";
  createSolvedCube();
  updateHistoryButtons();
  statusLabel.textContent = "Resuelto";
  statusLabel.style.color = "#63d8a4";
}

function changeCubeSize(value) {
  const nextSize = Number(value);
  if (!Number.isInteger(nextSize) || nextSize < 2 || nextSize > 7) return;
  cubeSize = nextSize;
  sizeBadge.textContent = cubeSize + "×" + cubeSize;
  description.textContent = TYPE_INFO[cubeSize];
  resetCube();
}

typeSelect.addEventListener("change", () => changeCubeSize(typeSelect.value));

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
  cancelPendingMoves();
  history = [];
  redoStack = [];
  moveCount = 0;
  countLabel.textContent = "0";
  createSolvedCube();
  updateHistoryButtons();
  const faces = ["U", "D", "R", "L", "F", "B"];
  let previousAxis = "";
  const sequence = [];
  const scrambleLength = Math.max(20, cubeSize * 8);
  const axes = { U: "y", D: "y", R: "x", L: "x", F: "z", B: "z" };
  for (let i = 0; i < scrambleLength; i++) {
    let face;
    do {
      face = faces[Math.floor(Math.random() * faces.length)];
    } while (axes[face] === previousAxis);
    previousAxis = axes[face];
    const suffix = ["", "'", "2"][Math.floor(Math.random() * 3)];
    sequence.push(face + suffix);
  }
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
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key.toUpperCase();
  if (!["U", "D", "R", "L", "F", "B"].includes(key)) return;
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
sizeBadge.textContent = "3×3";
description.textContent = TYPE_INFO[3];
loading.remove();

function render() {
  requestAnimationFrame(render);
  controls.update();
  renderer.render(scene, camera);
}
render();