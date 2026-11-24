// Menú giratorio de áreas: dónde va cada tarjeta según cuál está al frente. Sin React: se prueba aparte.
// Las tarjetas giran como en un carrusel: la del frente derecha y grande; las demás a los lados, giradas y atrás.

/** Distancia más corta de la tarjeta `i` a la del frente, dando la vuelta (con 3: −1, 0 o 1). */
export function offset(i: number, front: number, n: number) {
  const d = (((i - front) % n) + n) % n;
  return d > n / 2 ? d - n : d;
}

/** Pose de una tarjeta: corrimiento (en % de su ancho), giro (grados), escala, profundidad y opacidad. */
export function pose(i: number, front: number, n: number) {
  const d = offset(i, front, n), a = Math.abs(d);
  return { d, x: d * 82, rotate: -d * 38, scale: 1 - a * 0.16, z: -a * 120, opacity: a ? 0.62 : 1, zIndex: n - a };
}

/** Siguiente tarjeta al frente con ← → (da la vuelta). */
export const step = (front: number, dir: 1 | -1, n: number) => (front + dir + n) % n;
