/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    // These are optional native/log-prettifier imports pulled in by wallet UI
    // connector exports. Neither is used by Florin's browser-only ZeroDev flow.
    config.resolve.alias['@react-native-async-storage/async-storage'] = false;
    config.resolve.alias['pino-pretty'] = false;
    return config;
  },
};

module.exports = nextConfig;