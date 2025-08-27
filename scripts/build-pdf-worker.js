#!/usr/bin/env node

import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const workerSrc = join(projectRoot, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const workerDest = join(projectRoot, 'public/pdf.worker.min.js');

if (!existsSync(workerSrc)) {
  console.error('❌ PDF.js worker not found at:', workerSrc);
  console.error('Make sure pdfjs-dist is installed: npm install pdfjs-dist');
  process.exit(1);
}

try {
  copyFileSync(workerSrc, workerDest);
  console.log('✅ PDF.js worker copied to public directory');
} catch (error) {
  console.error('❌ Failed to copy PDF.js worker:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}