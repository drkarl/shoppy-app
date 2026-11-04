import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/settings/", "/callback/"],
    },
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || "https://shoppy.app"}/sitemap.xml`,
  };
}
