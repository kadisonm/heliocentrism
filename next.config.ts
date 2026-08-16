import type { NextConfig } from "next";

// GitHub Pages serves this as a project site — https://<user>.github.io/<repo>/,
// not the domain root — so every root-relative URL (Next's own /_next/static
// chunks, and any hardcoded public/ asset path like /wordmark.svg) needs the
// repo name prefixed or it 404s once deployed. GITHUB_REPOSITORY (format
// "owner/repo") is only set inside GitHub Actions, so this only applies to
// the Pages build, not local dev/build.
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePath = repo ? `/${repo}` : "";

const nextConfig: NextConfig = {
    output: "export",
    basePath,
    assetPrefix: basePath,
    // Root-relative asset paths hardcoded in JSX (e.g. <img src="/wordmark.svg">)
    // aren't rewritten by basePath automatically — components read this to
    // prefix them manually. See src/components/nav/index.tsx.
    env: {
        NEXT_PUBLIC_BASE_PATH: basePath,
    },
};

export default nextConfig;
