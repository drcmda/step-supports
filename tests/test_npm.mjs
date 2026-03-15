/**
 * Validate npm package pipeline against golden baselines.
 * Tests the same models/parameters as test_python.py.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const modelsDir = resolve(rootDir, 'models');
const baselinesDir = resolve(__dirname, 'baselines');
const pkgDir = resolve(rootDir, 'packages', 'negative-support');

// Import the built npm package
const { generateSupports } = await import(resolve(pkgDir, 'dist', 'index.js'));

// Tolerances (same as Python)
const VOL_TOL = 0.02;       // 2% total volume
const PIECE_VOL_TOL = 0.05; // 5% per piece

// Helper: compute volume from STL buffer (divergence theorem)
function computeVolumeFromSTL(stlBuffer) {
  const view = new DataView(stlBuffer);
  const triCount = view.getUint32(80, true);
  let vol = 0;

  for (let i = 0; i < triCount; i++) {
    const offset = 84 + i * 50 + 12; // skip normal
    const ax = view.getFloat32(offset, true), ay = view.getFloat32(offset + 4, true), az = view.getFloat32(offset + 8, true);
    const bx = view.getFloat32(offset + 12, true), by = view.getFloat32(offset + 16, true), bz = view.getFloat32(offset + 20, true);
    const cx = view.getFloat32(offset + 24, true), cy = view.getFloat32(offset + 28, true), cz = view.getFloat32(offset + 32, true);
    vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return Math.abs(vol / 6);
}

function testMeshBaseline(modelName) {
  const baselinePath = resolve(baselinesDir, `${modelName}_mesh.json`);
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch {
    console.log(`  SKIP: no baseline at ${baselinePath}`);
    return true;
  }

  if (baseline.error) {
    console.log(`  SKIP: baseline has error: ${baseline.error}`);
    return true;
  }

  const stlPath = resolve(modelsDir, `${modelName}.stl`);
  const buf = readFileSync(stlPath);

  const result = generateSupports(buf.buffer, {
    format: 'stl',
    margin: baseline.params.margin,
    minVolume: 1.0,
  });

  // result is a Promise
  return result.then(({ stl, stats }) => {
    let ok = true;

    // Check piece count
    if (stats.pieces !== baseline.total_pieces) {
      console.log(`  FAIL: pieces ${stats.pieces} != baseline ${baseline.total_pieces}`);
      ok = false;
    }

    // Check total volume
    const volDelta = Math.abs(stats.volume - baseline.total_volume) / baseline.total_volume;
    if (volDelta > VOL_TOL) {
      console.log(`  FAIL: volume ${stats.volume.toFixed(1)} vs baseline ${baseline.total_volume} (${(volDelta * 100).toFixed(1)}% > ${VOL_TOL * 100}%)`);
      ok = false;
    }

    if (ok) {
      console.log(`  ✓ ${stats.pieces} pieces, ${stats.volume.toFixed(1)} mm³ (delta: ${(volDelta * 100).toFixed(2)}%)`);
    }

    return ok;
  });
}

// Run tests
const models = ['test_model', 'follower', 'handle'];
let allPass = true;

console.log('='.repeat(60));
console.log('npm Package: Mesh Baselines');
console.log('='.repeat(60));

for (const model of models) {
  console.log(`\n${model}:`);
  const pass = await testMeshBaseline(model);
  if (!pass) allPass = false;
}

console.log('\n' + '='.repeat(60));
if (allPass) {
  console.log('✓ All npm tests passed');
} else {
  console.log('✗ Some npm tests failed');
  process.exit(1);
}
