#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Rasterises public/icon.svg into the PNG sizes required by PWA + iOS.
 *
 * Outputs (all in `public/`):
 *   - icon-192.png            (manifest, "any" purpose)
 *   - icon-512.png            (manifest, "any" purpose, splash source)
 *   - icon-maskable-512.png   (manifest, "maskable" purpose — adds safe area padding)
 *   - apple-touch-icon.png    (180×180, used by iOS when pinning to home screen)
 *   - favicon-32.png          (browser tab)
 *
 * Run after editing icon.svg:
 *   node scripts/generate-pwa-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public', 'icon.svg');

async function main() {
  const svg = await readFile(src);

  const targets = [
    { out: 'icon-192.png', size: 192 },
    { out: 'icon-512.png', size: 512 },
    { out: 'apple-touch-icon.png', size: 180 },
    { out: 'favicon-32.png', size: 32 },
  ];

  for (const t of targets) {
    const buf = await sharp(svg, { density: 384 })
      .resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await writeFile(join(root, 'public', t.out), buf);
    console.log(`✓ ${t.out} (${t.size}×${t.size})`);
  }

  // Maskable icon: 512×512 with 10% safe-zone padding all around so the OS
  // can crop it into a circle/squircle without clipping the mark.
  const inner = 410;
  const maskable = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 91, g: 141, b: 239, alpha: 1 } },
  })
    .composite([
      {
        input: await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer(),
        gravity: 'center',
      },
    ])
    .png()
    .toBuffer();
  await writeFile(join(root, 'public', 'icon-maskable-512.png'), maskable);
  console.log('✓ icon-maskable-512.png (512×512, maskable safe-zone)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
