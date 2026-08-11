import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Export 100% statique (app entièrement côté navigateur via Supabase).
    // Permet un déploiement manuel sur Netlify sans consommer de crédits de build.
    output: 'export',
    images: { unoptimized: true },
};

export default nextConfig;
