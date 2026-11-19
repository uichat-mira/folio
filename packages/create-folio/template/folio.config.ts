import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "My Folio site",
  description: "A small, Git-native site.",
  // Update this before publishing, so canonical URLs point to your own site.
  siteUrl: "https://example.com",
  navigation: [
    { label: "首页", href: "/" },
    { label: "第一篇", href: "/hello" },
  ],
});
