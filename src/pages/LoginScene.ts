// Escena 3D del login (three.js): una línea de producción abstracta. Las unidades pasan por las estaciones y se
// encienden en verde (pasa) o naranja (primera falla; casi todas se recuperan en la estación siguiente, como el retest).
// Decorativa: no muestra datos reales. Se carga aparte, solo en /login y después de que el formulario ya se ve.
import { AmbientLight, BoxGeometry, Color, DirectionalLight, Group, InstancedMesh, Mesh, MeshLambertMaterial, Object3D, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

const STATIONS = [-8, -4, 0, 4, 8], UNITS = 14, SPAN = 28, SPEED = 1.1; // unidades de escena y de escena por segundo

/** Estación (índice) donde falla la unidad `i` en su vuelta `lap`, o -1. Fijo, no al azar: ~30 % fallan. */
export const failAt = (i: number, lap: number) => { const k = (i * 7 + lap * 3) % 16; return k < 5 ? k : -1; };
/** 0 sin probar, 1 pasa, 2 falla: naranja solo entre la estación donde falló y la siguiente. */
export const state = (passed: number, fail: number) => (passed === 0 ? 0 : fail >= 0 && passed === fail + 1 ? 2 : 1);

/** Monta la escena en `host` y devuelve cómo quitarla. Lanza si no hay WebGL (el login deja su fondo de siempre). */
export function mountScene(host: HTMLElement) {
  const css = getComputedStyle(host), tone = (v: string) => new Color(css.getPropertyValue(v).trim());
  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // más resolución no se nota y sí cuesta
  host.append(renderer.domElement);
  const scene = new Scene(), camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 5, 16);
  camera.lookAt(0, 0.8, 0);
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(4, 8, 6);
  scene.add(new AmbientLight(0xffffff, 1.8), sun);
  const line = new Group();
  line.rotation.y = -0.3;
  scene.add(line);

  const mat = (v: string) => new MeshLambertMaterial({ color: tone(v) });
  const belt = new Mesh(new BoxGeometry(SPAN + 16, 0.12, 1.7), mat('--line'));
  belt.position.y = -0.06;
  line.add(belt);
  const post = new BoxGeometry(0.16, 2.2, 0.16), beam = new BoxGeometry(0.16, 0.16, 2.5), frame = mat('--line-strong');
  for (const x of STATIONS) {
    for (const z of [-1.17, 1.17]) { const p = new Mesh(post, frame); p.position.set(x, 1.1, z); line.add(p); }
    const b = new Mesh(beam, frame);
    b.position.set(x, 2.2, 0);
    line.add(b);
  }
  const units = new InstancedMesh(new BoxGeometry(1.1, 0.7, 1.1), new MeshLambertMaterial(), UNITS);
  line.add(units);
  const tones = [tone('--line-strong'), tone('--data-pass'), tone('--data-fail')], at = new Object3D();

  let t = 0, last = performance.now();
  const frame3d = (now: number) => {
    t += Math.min((now - last) / 1000, 0.1); // tras una pausa no da un salto
    last = now;
    for (let i = 0; i < UNITS; i++) {
      const d = (i * SPAN) / UNITS + t * SPEED, x = (d % SPAN) - SPAN / 2;
      at.position.set(x, 0.35, 0);
      at.updateMatrix();
      units.setMatrixAt(i, at.matrix);
      units.setColorAt(i, tones[state(STATIONS.filter((s) => s < x).length, failAt(i, Math.floor(d / SPAN)))]);
    }
    units.instanceMatrix.needsUpdate = true;
    units.instanceColor!.needsUpdate = true;
    renderer.render(scene, camera);
  };
  const size = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(size);
  ro.observe(host);
  size();
  // con la pestaña oculta no se dibuja nada
  const run = () => renderer.setAnimationLoop(document.hidden ? null : frame3d);
  document.addEventListener('visibilitychange', run);
  run();
  return () => {
    document.removeEventListener('visibilitychange', run);
    ro.disconnect();
    renderer.setAnimationLoop(null);
    scene.traverse((o) => { if (o instanceof Mesh) { o.geometry.dispose(); (o.material as MeshLambertMaterial).dispose(); } });
    renderer.dispose();
    renderer.domElement.remove();
  };
}
