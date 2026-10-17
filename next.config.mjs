/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exportação estática (pasta out/) para hospedar no GitHub Pages.
  // NEXT_PUBLIC_BASE_PATH vem do workflow de deploy (ex.: "/painel-admin");
  // em desenvolvimento fica vazio e o app roda na raiz.
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: true,
};

export default nextConfig;
