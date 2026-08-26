import type { NextConfig } from "next";

// GitHub Pages serves this as a project site, not the domain root, so root-relative
// URLs need the repo name prefixed. GITHUB_REPOSITORY is only set in GitHub Actions.
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
