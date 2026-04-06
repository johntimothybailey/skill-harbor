import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://skill-harbor.dev",
  integrations: [
    starlight({
      title: "Skill Harbor",
      logo: {
        src: "./src/assets/hero.png",
      },
      favicon: "/favicon.svg",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/johntimothybailey/skill-harbor",
        },
      ],
      customCss: [],
      sidebar: [
        {
          label: "Introduction",
          items: [
            { label: "Overview", slug: "introduction" },
            { label: "Quickstart", slug: "quickstart" },
            { label: "Skill Standards", slug: "concepts/skill-standards" },
            { label: "The Manifest & .harbor", slug: "concepts/manifest" },
          ],
        },
        {
          label: "Commands Deep Dive",
          items: [
            { label: "Fathom", slug: "concepts/fathom" },
            { label: "Voyager", slug: "concepts/voyager" },
            { label: "Governance & Lockdown", slug: "concepts/governance" },
            { label: "Global Fleet", slug: "concepts/global-fleet" },
            { label: "The Toolkit", slug: "concepts/toolkit" },
          ],
        },
        {
          label: "CLI Reference",
          items: [
            { label: "Commands", slug: "reference/commands" },
          ],
        },
      ],
    }),
  ],
});
