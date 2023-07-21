#!/bin/python

import os
import subprocess

cwd = os.getcwd()
hidden_path = os.path.join(cwd, '.hidden')

os.environ['PYTHONPATH'] = f"{os.getenv('PYTHONPATH', '')}:{hidden_path}"
os.environ['PYDEVD_DISABLE_FILE_VALIDATION'] = '1'

args = [
    'jupyter-lab',
    '--no-browser',
    '--IdentityProvider.token=',
    f'--ContentsManager.allow_hidden=True',
    f'--ServerApp.extra_static_paths',
    cwd,
]

subprocess.run(args, check=True)
