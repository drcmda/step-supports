#!/usr/bin/env python3
"""Generate golden baselines for all test models × pipeline combinations.

Run after any algorithm change to update baselines.
Usage: python tests/generate_baselines.py
"""

import json
import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from negative_support.cli import compute_supports, compute_supports_mesh, load_mesh

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
BASELINES_DIR = os.path.join(os.path.dirname(__file__), 'baselines')
MARGIN = 0.2
ANGLE = 45.0
MIN_VOLUME = 1.0

# Models and their available formats
MODELS = {
    'test_model': {'stl': True, 'step': True},
    'follower': {'stl': True, 'step': True},
    'handle': {'stl': True, 'step': True},
}


def generate_mesh_baseline(model_name: str) -> dict:
    """Generate baseline for mesh (full-shell) pipeline."""
    stl_path = os.path.join(MODELS_DIR, f'{model_name}.stl')
    mesh, _ = load_mesh(stl_path)
    result = compute_supports_mesh(mesh, margin=MARGIN, min_volume=MIN_VOLUME)

    if result is None:
        return {'model': f'{model_name}.stl', 'pipeline': 'mesh',
                'params': {'margin': MARGIN}, 'error': 'No supports generated'}

    pieces = result.split(only_watertight=False)
    pieces.sort(key=lambda p: abs(p.volume), reverse=True)

    return {
        'model': f'{model_name}.stl',
        'pipeline': 'mesh',
        'params': {'margin': MARGIN},
        'total_pieces': len(pieces),
        'total_volume': round(sum(abs(p.volume) for p in pieces), 1),
        'pieces': [{'volume': round(abs(p.volume), 1)} for p in pieces],
    }


def generate_step_baseline(model_name: str) -> dict:
    """Generate baseline for STEP (overhang detection) pipeline."""
    try:
        from build123d import import_step
    except ImportError:
        return {'model': f'{model_name}.step', 'pipeline': 'step',
                'error': 'build123d not available'}

    step_path = os.path.join(MODELS_DIR, f'{model_name}.step')
    part = import_step(step_path)
    result = compute_supports(part, margin=MARGIN, angle=ANGLE, min_volume=MIN_VOLUME)

    if result is None:
        return {'model': f'{model_name}.step', 'pipeline': 'step',
                'params': {'margin': MARGIN, 'angle': ANGLE},
                'error': 'No supports generated'}

    pieces = result.split(only_watertight=False)
    pieces.sort(key=lambda p: abs(p.volume), reverse=True)

    return {
        'model': f'{model_name}.step',
        'pipeline': 'step',
        'params': {'margin': MARGIN, 'angle': ANGLE},
        'total_pieces': len(pieces),
        'total_volume': round(sum(abs(p.volume) for p in pieces), 1),
        'pieces': [{'volume': round(abs(p.volume), 1)} for p in pieces],
    }


def main():
    os.makedirs(BASELINES_DIR, exist_ok=True)

    for model_name, formats in MODELS.items():
        if formats.get('stl'):
            print(f'Generating {model_name}_mesh baseline...')
            baseline = generate_mesh_baseline(model_name)
            path = os.path.join(BASELINES_DIR, f'{model_name}_mesh.json')
            with open(path, 'w') as f:
                json.dump(baseline, f, indent=2)
            if 'error' not in baseline:
                print(f'  {baseline["total_pieces"]} pieces, {baseline["total_volume"]} mm³')
            else:
                print(f'  {baseline["error"]}')

        if formats.get('step'):
            print(f'Generating {model_name}_step baseline...')
            baseline = generate_step_baseline(model_name)
            path = os.path.join(BASELINES_DIR, f'{model_name}_step.json')
            with open(path, 'w') as f:
                json.dump(baseline, f, indent=2)
            if 'error' not in baseline:
                print(f'  {baseline["total_pieces"]} pieces, {baseline["total_volume"]} mm³')
            else:
                print(f'  {baseline["error"]}')

    print('\nBaselines written to tests/baselines/')


if __name__ == '__main__':
    main()
