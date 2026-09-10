import type { MetadataRoute } from "next";

// Makes the register installable from the phone's browser: "Add to Home
// Screen" then gives it a real icon and opens it without the address bar,
// which is the difference between something that reads as an app and
// something that reads as a bookmark. Next serves this at /manifest.webmanifest
// and links it from every page on its own.
//
// This does NOT make the app work offline — the data lives in Neon and every
// screen needs the network.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jainam Creation",
    // Home screens truncate at roughly 12 characters, so the long name would
    // be cut mid-word under the icon.
    short_name: "Jainam",
    description: "Job work register for Jainam Creation",
    start_url: "/",
    display: "standalone",
    // Matches the page header the phone actually shows, so the status bar
    // blends into the app instead of banding across the top.
    theme_color: "#F3F6F5",
    background_color: "#F3F6F5",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Android crops icons to its own shape (circle, squircle, teardrop).
      // Without a maskable version it pads the square one into a smaller
      // white-bordered tile.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
