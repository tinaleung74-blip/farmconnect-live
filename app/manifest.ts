import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FarmConnect",
    short_name: "FarmConnect",
    description: "Rooster ownership, care updates, Wallet, and trusted farm records.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f1e5",
    theme_color: "#07563f",
    categories: ["business", "productivity", "lifestyle"],
    icons: [
      { src: "/farmconnect/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/farmconnect/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/farmconnect/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "My Roosters", short_name: "Roosters", url: "/customer-v2/roosters", icons: [{ src: "/farmconnect/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Inbox", short_name: "Inbox", url: "/customer-v2/inbox", icons: [{ src: "/farmconnect/customer-v2-icons/inbox.png", sizes: "1254x1254" }] },
    ],
  };
}
