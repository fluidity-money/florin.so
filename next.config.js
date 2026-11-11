const { execSync } = require('node:child_process');
const { version } = require('./package.json');

// Short commit for the footer's version stamp. Vercel hands it to the build;
// anywhere else, ask git. Empty if neither knows, and the footer then shows
// the version alone.
function commitSha() {
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
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
    NEXT_PUBLIC_COMMIT_SHA: commitSha(),
  },
};

module.exports = nextConfig;
