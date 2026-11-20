// Liquid-glass 3D objects for the Contact section:
//  - a rocket spinning clockwise on a turntable (left)
//  - an astronaut floating and waving (right)
// Glass = mirror-ish physical material lit by a studio environment map, with alpha driven by a
// fresnel term so edges read bright/solid and the centre stays see-through on the black page.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const debug = location.search.includes("rocketdebug");
window.__spaceSnap = {};

function makeGlass({ tint = 0xffffff, edge = 1.0, base = 0.04, emissive = 0x000000, emissiveIntensity = 0 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0.85,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    iridescence: 0.45,
    iridescenceIOR: 1.35,
    specularIntensity: 1,
    envMapIntensity: 2.6,
    emissive, emissiveIntensity,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uEdge = { value: edge };
    shader.uniforms.uBase = { value: base };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform float uEdge;\nuniform float uBase;\nvoid main() {")
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.2);
        float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.a = clamp(uBase + fres * uEdge + lum * lum * 1.4, 0.0, 1.0);`
      );
  };
  return m;
}

const MATS = {
  glass: () => makeGlass({ edge: 1.5, base: 0.08 }),
  violet: () => makeGlass({ tint: 0xd6c8ff, edge: 1.9, base: 0.22, emissive: 0x7c5cff, emissiveIntensity: 0.12 }),
  cyan: () => makeGlass({ tint: 0xa5f3fc, edge: 0.9, base: 0.3, emissive: 0x67e8f9, emissiveIntensity: 0.4 }),
  glow: (color, opacity = 0.9) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
};

// One renderer + scene per host element; animates only while visible.
function stage(host, build, { cameraZ = 7.2, cameraY = 0.35 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, cameraY, cameraZ);
  camera.lookAt(0, 0.05, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa78bfa, 1.2);
  rim.position.set(-4, 1, -3);
  scene.add(rim);

  const update = build(scene);

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  let running = false, last = 0, raf = 0, clock = 0;
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock += dt;
    update(clock, dt);
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(tick);
  }
  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  update(0, 0);
  renderer.render(scene, camera);

  if (debug) {
    window.__spaceSnap[host.id] = (t = 0) => {
      update(t, 0.016);
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    };
  }

  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.05 }).observe(host);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
}

/* ------------------------------ Rocket ------------------------------ */
function buildRocket(scene) {
  const glass = MATS.glass(), finGlass = MATS.violet(), tintedGlass = MATS.cyan();
  const rocket = new THREE.Group();

  const profile = [
    [0.0, -1.05], [0.3, -1.05], [0.38, -0.9], [0.45, -0.4], [0.47, 0.1],
    [0.44, 0.55], [0.36, 0.95], [0.24, 1.3], [0.1, 1.55], [0.0, 1.66],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  rocket.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 64), glass));

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 16, 48), glass);
  ring.position.set(0, 0.45, 0.445);
  ring.rotation.x = -0.08;
  rocket.add(ring);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16), tintedGlass);
  lens.scale.set(1, 1, 0.45);
  lens.position.copy(ring.position);
  rocket.add(lens);

  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0.35);
  finShape.quadraticCurveTo(0.32, 0.05, 0.42, -0.62);
  finShape.lineTo(0.12, -0.42);
  finShape.lineTo(0, -0.5);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 4, curveSegments: 16 });
  finGeo.translate(0, 0, -0.035);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeo, finGlass);
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    fin.position.set(Math.sin(a) * 0.4, -0.55, Math.cos(a) * 0.4);
    fin.rotation.y = a - Math.PI / 2;
    rocket.add(fin);
  }

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.22, 48, 1, true), glass);
  nozzle.position.y = -1.14;
  rocket.add(nozzle);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.75, 32, 1, true), MATS.glow(0xffa94d, 0.85));
  flame.rotation.x = Math.PI;
  flame.position.y = -1.6;
  rocket.add(flame);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 24, 1, true), MATS.glow(0xfff1a8));
  core.rotation.x = Math.PI;
  core.position.y = -1.45;
  rocket.add(core);

  const pivot = new THREE.Group();
  pivot.rotation.z = -0.22;
  pivot.rotation.x = 0.12;
  pivot.add(rocket);
  scene.add(pivot);

  return (t) => {
    rocket.rotation.y = -0.6 - t * 0.7; // negative Y = clockwise seen from above
    pivot.position.y = Math.sin(t * 1.2) * 0.06;
    const f = 1 + Math.sin(t * 22) * 0.08 + Math.sin(t * 37) * 0.05;
    flame.scale.set(1, f, 1);
    core.scale.set(1, 2 - f, 1);
  };
}

/* ----------------------------- Astronaut ----------------------------- */
function buildAstronaut(scene) {
  const suit = MATS.glass(), visor = MATS.cyan(), accent = MATS.violet();
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 10, 32);
  const astro = new THREE.Group();

  // helmet + visor + collar
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), suit);
  helmet.position.y = 1.0;
  astro.add(helmet);
  const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.26, Math.PI * 0.42), visor);
  visorMesh.position.set(0, 1.0, 0.1);
  astro.add(visorMesh);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 16, 48), accent);
  collar.position.y = 0.55;
  collar.rotation.x = Math.PI / 2;
  astro.add(collar);

  // torso, chest panel with status lights, backpack
  const torso = new THREE.Mesh(capsule(0.4, 0.42), suit);
  torso.position.y = 0.05;
  astro.add(torso);
  const panel = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.26, 0.1, 4, 0.04), accent);
  panel.position.set(0, 0.12, 0.38);
  astro.add(panel);
  const lights = [0x67e8f9, 0xa78bfa, 0xfb923c].map((c, i) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), MATS.glow(c, 1));
    l.position.set(-0.11 + i * 0.11, 0.14, 0.44);
    astro.add(l);
    return l;
  });
  const pack = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.82, 0.32, 5, 0.1), suit);
  pack.position.set(0, 0.2, -0.46);
  astro.add(pack);

  // limbs: pivot groups so they can move
  function limb(x, y, r, len, mat = suit) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const seg = new THREE.Mesh(capsule(r, len), mat);
    seg.position.y = -(len / 2 + r * 0.6);
    pivot.add(seg);
    const end = new THREE.Mesh(new THREE.SphereGeometry(r * 1.2, 24, 16), accent);
    end.position.y = -(len + r * 1.3);
    pivot.add(end);
    astro.add(pivot);
    return pivot;
  }
  const armL = limb(-0.5, 0.36, 0.13, 0.42);
  const armR = limb(0.5, 0.36, 0.13, 0.42);
  const legL = limb(-0.19, -0.42, 0.15, 0.5);
  const legR = limb(0.19, -0.42, 0.15, 0.5);

  // tether curling away from the backpack
  const tetherCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, 0.0, -0.62),
    new THREE.Vector3(-0.7, -0.4, -0.9),
    new THREE.Vector3(-1.1, 0.2, -0.6),
    new THREE.Vector3(-1.5, -0.3, -0.3),
    new THREE.Vector3(-2.2, -0.1, -0.5),
  ]);
  astro.add(new THREE.Mesh(new THREE.TubeGeometry(tetherCurve, 80, 0.025, 10, false), accent));

  const pivot = new THREE.Group();
  pivot.add(astro);
  pivot.scale.setScalar(0.95);
  scene.add(pivot);

  return (t) => {
    // weightless drift: slow bob, sway and turn
    pivot.position.y = Math.sin(t * 0.6) * 0.14;
    pivot.position.x = Math.sin(t * 0.37) * 0.08;
    pivot.rotation.z = 0.18 + Math.sin(t * 0.35) * 0.16;
    pivot.rotation.x = Math.sin(t * 0.28) * 0.12;
    pivot.rotation.y = -0.45 + Math.sin(t * 0.22) * 0.55;
    // wave with the right arm, relaxed left arm, lazy legs
    armR.rotation.z = 2.35 + Math.sin(t * 2.4) * 0.28;
    armL.rotation.z = -0.55 + Math.sin(t * 0.8) * 0.12;
    armL.rotation.x = 0.25;
    legL.rotation.z = -0.12 + Math.sin(t * 0.7) * 0.08;
    legL.rotation.x = 0.35 + Math.sin(t * 0.9) * 0.1;
    legR.rotation.z = 0.15 + Math.sin(t * 0.6 + 1) * 0.08;
    legR.rotation.x = -0.15 + Math.sin(t * 0.8 + 2) * 0.1;
    lights.forEach((l, i) => { l.material.opacity = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3 + i * 2.1)); });
  };
}

const rocketHost = document.getElementById("glass-rocket");
if (rocketHost) stage(rocketHost, buildRocket);
const astroHost = document.getElementById("glass-astronaut");
if (astroHost) stage(astroHost, buildAstronaut, { cameraZ: 7.6, cameraY: 0.3 });
