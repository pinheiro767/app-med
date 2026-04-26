export function correlacaoPearson(x, y) {

  const n = x.length;

  if (n === 0) return 0;

  let somaX = 0;
  let somaY = 0;
  let somaXY = 0;
  let somaX2 = 0;
  let somaY2 = 0;

  for (let i = 0; i < n; i++) {

    somaX += x[i];
    somaY += y[i];

    somaXY += x[i] * y[i];
    somaX2 += x[i] * x[i];
    somaY2 += y[i] * y[i];

  }

  const numerador =
    (n * somaXY) - (somaX * somaY);

  const denominador =
    Math.sqrt(
      (n * somaX2 - somaX * somaX) *
      (n * somaY2 - somaY * somaY)
    );

  if (denominador === 0) return 0;

  return numerador / denominador;

}
