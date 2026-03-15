/**
 * negative-support CLI — Generate negative-space 3D print supports.
 *
 * Usage:
 *   negative-support <input> [options]
 *   negative-support --version
 *   negative-support --status
 *   negative-support --activate <token>
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename, extname, resolve } from 'path';
import { generateSupports } from './index';
import { ProgressDisplay } from './progress';
import { checkLicense, activateToken, getStatus, printNoTokenMessage, printExhaustedMessage } from './license';
import { export3MF } from './threemf';
import { parseSTL } from './stl';
import { parseOBJ } from './obj';

// ── Arg parsing ──────────────────────────────────────────────────────

interface Args {
  input?: string;
  output?: string;
  margin: number;
  minVolume: number;
  angle: number;
  threeMf: boolean;
  quiet: boolean;
  version: boolean;
  activate?: string;
  status: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    margin: 0.2,
    minVolume: 1.0,
    angle: 45,
    threeMf: false,
    quiet: false,
    version: false,
    status: false,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '-o': case '--output':
        args.output = argv[++i]; break;
      case '-m': case '--margin':
        args.margin = parseFloat(argv[++i]) || 0.2; break;
      case '--min-volume':
        args.minVolume = parseFloat(argv[++i]) || 1.0; break;
      case '-a': case '--angle':
        args.angle = parseInt(argv[++i], 10) || 45; break;
      case '--3mf':
        args.threeMf = true; break;
      case '-q': case '--quiet':
        args.quiet = true; break;
      case '--version':
        args.version = true; break;
      case '--activate':
        args.activate = argv[++i]; break;
      case '--status':
        args.status = true; break;
      case '-h': case '--help':
        args.help = true; break;
      default:
        if (!arg.startsWith('-') && !args.input) args.input = arg;
        break;
    }
    i++;
  }
  return args;
}

function printHelp(): void {
  console.log(`
Usage: negative-support <input> [options]

Generate negative-space 3D print support structures from STL, OBJ, or STEP files.

Options:
  -o, --output <path>     Output path (default: <input>_supports.stl)
  -m, --margin <mm>       Gap between supports and model (default: 0.2)
  --min-volume <mm³>      Discard pieces smaller than this (default: 1.0)
  -a, --angle <degrees>   Overhang angle threshold, STEP only (default: 45)
  --3mf                   Export 3MF with model + supports
  -q, --quiet             Suppress progress display
  --version               Show version
  --status                Show license status
  --activate <token>      Activate license token
  -h, --help              Show this help
`);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Version
  if (args.version) {
    // Read from package.json
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    console.log(`negative-support ${pkg.version}`);
    return;
  }

  // Help
  if (args.help) {
    printHelp();
    return;
  }

  // License management
  if (args.status) {
    console.log(await getStatus());
    return;
  }

  if (args.activate !== undefined) {
    const [ok, msg] = await activateToken(args.activate);
    console.log(ok ? `✓ ${msg}` : `✗ ${msg}`);
    process.exit(ok ? 0 : 1);
  }

  // Need input file
  if (!args.input) {
    printHelp();
    process.exit(1);
  }

  // Check license
  const [allowed, licMsg] = await checkLicense();
  if (!allowed) {
    if (licMsg === 'exhausted') {
      printExhaustedMessage();
    } else {
      printNoTokenMessage();
    }
    process.exit(1);
  }
  if (licMsg && !args.quiet) {
    console.log(`  ${licMsg}`);
    console.log();
  }

  // Read input
  const inputPath = resolve(args.input);
  const ext = extname(inputPath).toLowerCase();
  const name = basename(inputPath, ext);

  let buffer: ArrayBuffer;
  try {
    const buf = readFileSync(inputPath);
    buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch (err) {
    console.error(`Error reading ${inputPath}: ${(err as Error).message}`);
    process.exit(1);
  }

  // Detect format
  const STEP_EXTS = new Set(['.step', '.stp']);
  const format = STEP_EXTS.has(ext) ? 'step' : ext === '.obj' ? 'obj' : 'stl';

  // Progress display
  const progress = new ProgressDisplay(!args.quiet);

  // Generate
  try {
    const result = await generateSupports(buffer, {
      format: format as 'stl' | 'obj' | 'step',
      margin: args.margin,
      angle: args.angle,
      minVolume: args.minVolume,
      onProgress: progress.onProgress,
    });

    progress.done();

    // Write output
    const outputPath = args.output || `${name}_supports.stl`;
    writeFileSync(outputPath, Buffer.from(result.stl));

    // Stats
    if (!args.quiet) {
      console.log();
      console.log(`  Pieces: ${result.stats.pieces}`);
      console.log(`  Faces:  ${result.stats.faces.toLocaleString()}`);
      console.log(`  Volume: ${result.stats.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm³`);
      console.log();
      console.log(`  → ${outputPath}`);
    }

    // 3MF export
    if (args.threeMf) {
      progress.onProgress('3MF export');

      // Parse the original model mesh for 3MF (we need both model + supports)
      let modelMesh;
      if (format === 'stl') {
        modelMesh = parseSTL(readFileSync(inputPath).buffer.slice(0));
      } else if (format === 'obj') {
        modelMesh = parseOBJ(readFileSync(inputPath).buffer.slice(0));
      } else {
        // For STEP, re-parse to get the mesh
        const { parseSTEP } = await import('./step');
        const stepResult = await parseSTEP(readFileSync(inputPath).buffer.slice(0));
        modelMesh = stepResult.mesh;
      }

      // Parse supports STL back to mesh for 3MF
      const supportsMesh = parseSTL(result.stl);

      const threemfData = export3MF(modelMesh, supportsMesh);
      const threemfPath = args.output
        ? args.output.replace(/\.stl$/i, '.3mf')
        : `${name}.3mf`;
      writeFileSync(threemfPath, Buffer.from(threemfData));

      progress.done();

      if (!args.quiet) {
        console.log(`  → ${threemfPath}`);
      }
    }

    if (!args.quiet) console.log();

  } catch (err) {
    progress.fail((err as Error).message);
    console.error();
    console.error(`  Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
