// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// Build a map of blog post paths to accurate last-modified dates from
// frontmatter, so the sitemap can include <lastmod> without inventing dates.
const blogDir = fileURLToPath(new URL('./src/content/blog', import.meta.url));

function readPostLastModified() {
  /** @type {Map<string, string>} */
  const lastModified = new Map();
  if (!fs.existsSync(blogDir)) return lastModified;

  for (const file of fs.readdirSync(blogDir)) {
    if (!/\.mdx?$/.test(file)) continue;
    const raw = fs.readFileSync(path.join(blogDir, file), 'utf8');
    const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    if (!frontmatter || /^draft:\s*true\s*$/m.test(frontmatter)) continue;

    const dateString =
      frontmatter.match(/^updatedDate:\s*['"]?([^'"\n]+?)['"]?\s*$/m)?.[1] ??
      frontmatter.match(/^pubDate:\s*['"]?([^'"\n]+?)['"]?\s*$/m)?.[1];
    if (!dateString) continue;

    const date = new Date(dateString);
    if (Number.isNaN(date.valueOf())) continue;

    const isoDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    lastModified.set(`/blog/${file.replace(/\.mdx?$/, '')}/`, isoDate);
  }

  return lastModified;
}

const postLastModified = readPostLastModified();

// https://astro.build/config
export default defineConfig({
  site: 'https://blogs.erroroverflow.org/',
  integrations: [
    mdx(),
    sitemap({
      serialize(item) {
        const lastmod = postLastModified.get(new URL(item.url).pathname);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
    react(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
