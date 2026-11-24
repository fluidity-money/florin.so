"""Classify release-to-release changes, including deleted and renamed files."""

import os
from fnmatch import fnmatchcase
import subprocess


SCOPE_PATTERNS = {
	'go': ('*.go', 'go.mod', 'go.sum', 'go.work', 'go.work.sum', 'cmd/*', 'db/*',
		'*.graphql', '*.gql', 'lib/*.json'),
	'web': ('*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs', '*.css', '*.scss',
		'app/*', 'components/*', 'hooks/*', 'public/*', 'tests/*', 'lib/*.json',
		'package.json', 'package-lock.json', '.npmrc', 'vercel.json', 'tsconfig*.json',
		'*.graphql', '*.gql'),
}
SHARED_FILES = {'.env.example', 'Makefile', 'Dockerfile', 'docker.sh',
	'.github/workflows/deploy-vercel.yml'}
SHARED_CI = {
	'.github/scripts/release_changes.py',
	'.github/workflows/release-changes.yml',
}


def classify(paths):
	changed = dict.fromkeys(('go', 'web', 'docs'), False)
	for path in paths:
		if path in SHARED_CI:
			return dict.fromkeys(changed, True)
		if path.startswith('docs/') or path == '.github/workflows/deploy-docs.yml':
			changed['docs'] = True
			continue
		for scope, patterns in SCOPE_PATTERNS.items():
			if path in SHARED_FILES or any(fnmatchcase(path, p) for p in patterns):
				changed[scope] = True
	return changed


def release_changes():
	# Ignore the current tag itself; choose the nearest release in parent history.
	base = subprocess.run(
		['git', 'describe', '--tags', '--match', 'release-*', '--abbrev=0', 'HEAD^'],
		capture_output=True, text=True,
	)
	if base.returncode:
		print('No preceding reachable release: checking all scopes.')
		return dict.fromkeys(('go', 'web', 'docs'), True)
	print(f'Comparing {base.stdout.strip()} with HEAD')
	paths = subprocess.check_output([
		'git', 'diff', '--name-only', '--no-renames', '-z', base.stdout.strip(), 'HEAD',
	]).decode().split('\0')
	return classify(paths)


if __name__ == '__main__':
	changes = release_changes()
	with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
		for scope, changed in changes.items():
			print(f'{scope}={str(changed).lower()}', file=output)
			print(f'{scope}: {changed}')
