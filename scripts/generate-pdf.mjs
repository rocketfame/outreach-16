#!/usr/bin/env node
/**
 * Generate AGENT_HANDOFF.pdf from AGENT_HANDOFF.html using Puppeteer.
 * Run: node scripts/generate-pdf.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, '..', 'docs');
const htmlPath = join(docsDir, 'AGENT_HANDOFF.html');
const pdfPath = join(docsDir, 'AGENT_HANDOFF.pdf');

async function main() {
  const puppeteer = await import('puppeteer');
  const html = readFileSync(htmlPath, 'utf-8');
  const browser = await puppeteer.default.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    printBackground: true,
  });
  await browser.close();
  console.log('PDF saved to:', pdfPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
