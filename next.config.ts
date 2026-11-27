/** @type {import("next").NextConfig} */
const nextConfig = {
  // The API routes read data/ at runtime (and seed a new Redis database from
  // it on Vercel), so make sure those files ship with the serverless functions.
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*"],
  },
};

export default nextConfig;
