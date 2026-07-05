import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  images: {
    remotePatterns: [{ protocol: "https", hostname: "trae-api-cn.mchost.guru" }],
    domains: ["trae-api-cn.mchost.guru"],
  },

  // Webpack 构建优化（生产环境 chunk 拆分 + tree-shaking）
  webpack: (config, { isServer, dev }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          framework: {
            test: /[\\\/]node_modules[\\\/](react|react-dom|scheduler)[\\\/]/,
            name: "framework",
            priority: 40,
            chunks: "all",
          },
          mermaid: {
            test: /[\\\/]node_modules[\\\/]mermaid[\\\/]/,
            name: "mermaid",
            priority: 30,
            chunks: "all",
          },
          highlight: {
            test: /[\\\/]node_modules[\\\/]highlight\.js[\\\/]/,
            name: "highlight",
            priority: 25,
            chunks: "all",
          },
          markdown: {
            test: /[\\\/]node_modules[\\\/](react-markdown|remark-|rehype-|unified)[\\\/]/,
            name: "markdown",
            priority: 20,
            chunks: "all",
          },
          vendor: {
            test: /[\\\/]node_modules[\\\/]/,
            name: "vendors",
            priority: 10,
            chunks: "all",
          },
        },
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
