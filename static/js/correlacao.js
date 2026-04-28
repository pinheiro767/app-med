export function correlacaoPearson(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y)) return 0;
  if (x.length !== y.length) return 0;
  if (x.length < 2) return 0;

  const pares = [];

  for (let i = 0; i < x.length; i++) {
    const vx = Number(x[i]);
    const vy = Number(y[i]);

    if (Number.isFinite(vx) && Number.isFinite(vy)) {
      pares.push([vx, vy]);
    }
  }

  const n = pares.length;
  if (n < 2) return 0;

  let somaX = 0;
  let somaY = 0;
  let somaXY = 0;
  let somaX2 = 0;
  let somaY2 = 0;

  for (const [vx, vy] of pares) {
    somaX += vx;
    somaY += vy;
    somaXY += vx * vy;
    somaX2 += vx * vx;
    somaY2 += vy * vy;
  }

  const numerador =
    (n * somaXY) - (somaX * somaY);

  const denominador = Math.sqrt(
    (n * somaX2 - somaX * somaX) *
    (n * somaY2 - somaY * somaY)
  );

  if (!Number.isFinite(denominador) || denominador === 0) {
    return 0;
  }

  const r = numerador / denominador;

  if (!Number.isFinite(r)) return 0;

  return Number(r.toFixed(4));
}
