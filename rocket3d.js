// Liquid-glass rocket that spins clockwise on a turntable in the Contact section.
// Three.js glass (MeshPhysicalMaterial transmission) lit by a studio environment map,
// so it reads as clear glass with bright reflections on the black page.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const host = document.getElementById("glass-rocket");
if (host) init(host);

function init(host) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  camera.position.set(0, 0.35, 7.2);
  camera.lookAt(0, 0.05, 0);

  // ---- materials ----
  // "Liquid glass" on black: no diffuse colour, only environment reflections + clearcoat,
  // with alpha driven by a fresnel term so edges read bright/solid and the centre stays see-through.
  function makeGlass({ tint = 0xffffff, edge = 1.0, base = 0.04, emissive = 0x000000, emissiveIntensity = 0 } = {}) {
    const m = new THREE.MeshPhysicalMaterial({
      color: tint,
      metalness: 0.85, // polished, mirror-like glass so it catches the studio reflections on a black page
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
  const glass = makeGlass({ edge: 1.5, base: 0.08 });
  const finGlass = makeGlass({ tint: 0xd6c8ff, edge: 1.9, base: 0.22, emissive: 0x7c5cff, emissiveIntensity: 0.12 });
  const tintedGlass = makeGlass({ tint: 0xa5f3fc, edge: 0.9, base: 0.3, emissive: 0x67e8f9, emissiveIntensity: 0.4 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa94d, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameCore = new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

  // ---- rocket ----
  const rocket = new THREE.Group();

  // body: lathe profile from tail to nose
  const profile = [
    [0.0, -1.05], [0.3, -1.05], [0.38, -0.9], [0.45, -0.4], [0.47, 0.1],
    [0.44, 0.55], [0.36, 0.95], [0.24, 1.3], [0.1, 1.55], [0.0, 1.66],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), glass);
  rocket.add(body);

  // porthole: glass lens + ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 16, 48), glass);
  ring.position.set(0, 0.45, 0.445);
  ring.rotation.x = -0.08;
  rocket.add(ring);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16), tintedGlass);
  lens.scale.set(1, 1, 0.45);
  lens.position.copy(ring.position);
  rocket.add(lens);

  // fins: extruded swept triangle, three around the tail
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

  // nozzle
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.22, 48, 1, true), glass);
  nozzle.position.y = -1.14;
  rocket.add(nozzle);

  // flame (additive, flickers)
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.75, 32, 1, true), flameMat);
  flame.rotation.x = Math.PI;
  flame.position.y = -1.6;
  rocket.add(flame);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 24, 1, true), flameCore);
  core.rotation.x = Math.PI;
  core.position.y = -1.45;
  rocket.add(core);

  // turntable pivot: slight forward tilt so the spin shows the silhouette
  const pivot = new THREE.Group();
  pivot.rotation.z = -0.22;
  pivot.rotation.x = 0.12;
  pivot.add(rocket);
  scene.add(pivot);

  // soft key/rim lights to make edges sparkle
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa78bfa, 1.2);
  rim.position.set(-4, 1, -3);
  scene.add(rim);

  // ---- sizing ----
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // ---- loop: only runs while the section is on screen ----
  let running = false, last = 0, raf = 0;
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    rocket.rotation.y -= dt * 0.7; // negative Y = clockwise seen from above
    const t = now / 1000;
    pivot.position.y = Math.sin(t * 1.2) * 0.06;
    const f = 1 + Math.sin(t * 22) * 0.08 + Math.sin(t * 37) * 0.05;
    flame.scale.set(1, f, 1);
    core.scale.set(1, 2 - f, 1);
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

  rocket.rotation.y = -0.6;
  renderer.render(scene, camera); // first frame (and the only one with reduced motion)

  // debug hook for previews: ?rocketdebug exposes a snapshot helper
  if (location.search.includes("rocketdebug")) {
    window.__rocketSnap = (angle = -0.6) => {
      rocket.rotation.y = angle;
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    };
  }

  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.05 }).observe(host);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
}
