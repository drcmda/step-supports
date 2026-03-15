#!/usr/bin/env python3
"""Validate Python pipeline against golden baselines."""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from negative_support.cli import compute_supports_mesh, load_mesh

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
BASELINES_DIR = os.path.join(os.path.dirname(__file__), 'baselines')

# Tolerances
VOL_TOL = 0.02      # 2% total volume
PIECE_VOL_TOL = 0.05  # 5% per piece

def test_mesh_baseline(model_name: str) -> bool:
    """Test mesh pipeline against golden baseline."""
    baseline_path = os.path.join(BASELINES_DIR, f'{model_name}_mesh.json')
    if not os.path.exists(baseline_path):
        print(f'  SKIP: no baseline at {baseline_path}')
        return True

    with open(baseline_path) as f:
        baseline = json.load(f)

    if 'error' in baseline:
        print(f'  SKIP: baseline has error: {baseline["error"]}')
        return True

    stl_path = os.path.join(MODELS_DIR, f'{model_name}.stl')
    mesh, _ = load_mesh(stl_path)
    result = compute_supports_mesh(mesh, margin=baseline['params']['margin'], min_volume=1.0)

    if result is None:
        print(f'  FAIL: no supports generated')
        return False

    pieces = result.split(only_watertight=False)
    pieces.sort(key=lambda p: abs(p.volume), reverse=True)

    total_vol = sum(abs(p.volume) for p in pieces)
    base_vol = baseline['total_volume']
    vol_delta = abs(total_vol - base_vol) / base_vol if base_vol > 0 else 0

    ok = True

    # Check piece count
    if len(pieces) != baseline['total_pieces']:
        print(f'  FAIL: pieces {len(pieces)} != baseline {baseline["total_pieces"]}')
        ok = False

    # Check total volume
    if vol_delta > VOL_TOL:
        print(f'  FAIL: volume {total_vol:.1f} vs baseline {base_vol:.1f} ({vol_delta*100:.1f}% > {VOL_TOL*100}%)')
        ok = False

    # Check per-piece volumes
    for i, (piece, base_piece) in enumerate(zip(pieces, baseline['pieces'])):
        pv = abs(piece.volume)
        bv = base_piece['volume']
        pdelta = abs(pv - bv) / bv if bv > 0 else 0
        if pdelta > PIECE_VOL_TOL:
            print(f'  FAIL: piece {i} volume {pv:.1f} vs {bv:.1f} ({pdelta*100:.1f}% > {PIECE_VOL_TOL*100}%)')
            ok = False

    if ok:
        print(f'  ✓ {len(pieces)} pieces, {total_vol:.1f} mm³ (delta: {vol_delta*100:.2f}%)')

    return ok


def main():
    models = ['test_model', 'follower', 'handle']
    all_pass = True

    print('=' * 60)
    print('Python Pipeline: Mesh Baselines')
    print('=' * 60)

    for model in models:
        print(f'\n{model}:')
        if not test_mesh_baseline(model):
            all_pass = False

    print('\n' + '=' * 60)
    if all_pass:
        print('✓ All Python tests passed')
    else:
        print('✗ Some Python tests failed')
        sys.exit(1)


if __name__ == '__main__':
    main()
