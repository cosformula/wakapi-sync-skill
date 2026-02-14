import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const WAKAPI_URL = process.env.WAKAPI_URL;
const WAKAPI_API_KEY = process.env.WAKAPI_API_KEY;
const skip = !WAKAPI_URL || !WAKAPI_API_KEY;

describe('E2E Live: wakapi-daily-summary against real API', { skip }, () => {
  let tmpDir;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wakapi-live-e2e-'));
  });

  after(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true });
  });

  it('should run the script and produce 3 CSV files', () => {
    const scriptPath = path.resolve(import.meta.dirname, '..', 'scripts', 'wakapi-daily-summary.mjs');

    execFileSync('node', [scriptPath], {
      env: {
        ...process.env,
        WAKAPI_URL,
        WAKAPI_API_KEY,
        WAKAPI_OUT_DIR: tmpDir,
        WAKAPI_TOP_N_PROJECTS: '10',
        WAKAPI_TOP_N_LANGUAGES: '10',
      },
      timeout: 30000,
    });

    // Verify files exist
    const files = ['daily-total.csv', 'daily-top-projects.csv', 'daily-top-languages.csv'];
    for (const f of files) {
      const stat = fs.stat(path.join(tmpDir, f));
      assert.ok(stat, `${f} should exist`);
    }
  });

  it('daily-total.csv should have correct header and at least 1 data row', async () => {
    const content = await fs.readFile(path.join(tmpDir, 'daily-total.csv'), 'utf8');
    const lines = content.trim().split('\n');

    assert.equal(lines[0], 'date,total_seconds,total_hours,projects_count,languages_count');
    assert.ok(lines.length >= 2, 'should have header + at least 1 row');

    // Validate row structure
    const cols = lines[1].split(',');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(cols[0]), 'date should be YYYY-MM-DD');
    assert.ok(Number(cols[1]) >= 0, 'total_seconds should be >= 0');
    assert.ok(Number(cols[2]) >= 0, 'total_hours should be >= 0');
  });

  it('daily-top-projects.csv should have correct header and valid rows', async () => {
    const content = await fs.readFile(path.join(tmpDir, 'daily-top-projects.csv'), 'utf8');
    const lines = content.trim().split('\n');

    assert.equal(lines[0], 'date,rank,project,seconds,hours,percent');

    if (lines.length >= 2) {
      const cols = lines[1].split(',');
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(cols[0]), 'date should be YYYY-MM-DD');
      assert.equal(cols[1], '1', 'first row rank should be 1');
      assert.ok(cols[2].length > 0, 'project name should not be empty');
    }
  });

  it('daily-top-languages.csv should have correct header and valid rows', async () => {
    const content = await fs.readFile(path.join(tmpDir, 'daily-top-languages.csv'), 'utf8');
    const lines = content.trim().split('\n');

    assert.equal(lines[0], 'date,rank,language,seconds,hours,percent');

    if (lines.length >= 2) {
      const cols = lines[1].split(',');
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(cols[0]), 'date should be YYYY-MM-DD');
      assert.equal(cols[1], '1', 'first row rank should be 1');
      assert.ok(cols[2].length > 0, 'language name should not be empty');
    }
  });

  it('should be idempotent (running twice does not duplicate rows)', async () => {
    const scriptPath = path.resolve(import.meta.dirname, '..', 'scripts', 'wakapi-daily-summary.mjs');

    execFileSync('node', [scriptPath], {
      env: {
        ...process.env,
        WAKAPI_URL,
        WAKAPI_API_KEY,
        WAKAPI_OUT_DIR: tmpDir,
      },
      timeout: 30000,
    });

    const content = await fs.readFile(path.join(tmpDir, 'daily-total.csv'), 'utf8');
    const dataLines = content.trim().split('\n').slice(1);
    const dates = dataLines.map(l => l.split(',')[0]);
    const uniqueDates = new Set(dates);
    assert.equal(dates.length, uniqueDates.size, 'no duplicate date rows after running twice');
  });
});
