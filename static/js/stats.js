function media(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;

  const nums = arr
    .map(Number)
    .filter(v => Number.isFinite(v));

  if (nums.length === 0) return 0;

  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function mediana(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;

  const nums = arr
    .map(Number)
    .filter(v => Number.isFinite(v))
    .sort((a, b) => a - b);

  if (nums.length === 0) return 0;

  const mid = Math.floor(nums.length / 2);

  return nums.length % 2
    ? nums[mid]
    : (nums[mid - 1] + nums[mid]) / 2;
}

function desvioPadrao(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;

  const nums = arr
    .map(Number)
    .filter(v => Number.isFinite(v));

  if (nums.length === 0) return 0;

  const m = media(nums);

  const variancia =
    nums.reduce((sum, v) => sum + (v - m) ** 2, 0) / nums.length;

  return Math.sqrt(variancia);
}
