# Erroroverflow Blogs

Practical debugging notes and guides on embedded systems and React Native development.

**Live site: [blogs.erroroverflow.org](https://blogs.erroroverflow.org)**

Built with [Astro](https://astro.build), Tailwind CSS v4, and shadcn/ui. Deployed on Cloudflare.

## Commands

All commands are run from the root of the project:

| Command            | Action                                     |
| :----------------- | :----------------------------------------- |
| `bun install`      | Install dependencies                       |
| `bun dev`          | Start local dev server at `localhost:4321` |
| `bun run build`    | Build the production site to `./dist/`     |
| `bun preview`      | Preview the production build locally       |
| `bun astro check`  | Type-check the project                     |

> Use `bun run build`, not `bun build` — the latter runs Bun's bundler.

## Project structure

```text
├── public/            # static assets (fonts, icons, webmanifest)
├── src/
│   ├── assets/        # post hero images
│   ├── components/    # Astro components + shadcn/ui in src/components/ui/
│   ├── content/
│   │   └── blog/      # active posts (Markdown)
│   ├── layouts/
│   ├── pages/
│   └── styles/
├── astro.config.mjs
└── package.json
```

## Writing a post

Add a Markdown file to `src/content/blog/` with the following frontmatter:

```yaml
---
title: "Post title"
description: "Meta description"
pubDate: "30 Aug 2026"
heroImage: "../../assets/hero.png"  # optional
heroAlt: "Describe the hero image"  # optional
---
```

Posts are rendered by `src/pages/blog/[...slug].astro` using `getCollection('blog')`.

## Credit

Based on the [Astro blog starter](https://astro.build) and the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).
