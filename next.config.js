const { execSync } = require('node:child_process');
const { version } = require('./package.json');

// Tag-triggered deployments provide the release tag through GitHub Actions.
// Locally, only use a tag on HEAD; untagged builds show the package version.
function releaseTag() {
	if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
		return process.env.GITHUB_REF_NAME;
	}
	try {
		return execSync('git describe --tags --exact-match HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return '';
	}
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@reown/appkit', '@reown/appkit-adapter-wagmi'],
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
		NEXT_PUBLIC_RELEASE_TAG: releaseTag(),
  },
};

module.exports = nextConfig;
