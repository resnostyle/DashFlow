import fs from 'fs';
import path from 'path';
import os from 'os';
import { afterAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Create a unique temp directory for this test worker's database
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'news-ticker-test-'));
process.env.DATA_DIR = tmpDir;

afterAll(() => {
  try {
    const db = require('../src/db');
    db.close();
  } catch {
    // ignore if db wasn't loaded
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
