import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  csvEscape,
  rowsToCsv,
  parseCsvSimple,
  upsertCsvByKeys,
  extractTopFromStatusbarToday,
  extractFromSummariesToday,
  toHours,
  ymdLocal,
  pickTop,
} from '../scripts/wakapi-daily-summary.mjs';

// ── csvEscape ──────────────────────────────────────────────

describe('csvEscape', () => {
  it('should return empty string for null/undefined', () => {
    assert.equal(csvEscape(null), '');
    assert.equal(csvEscape(undefined), '');
  });

  it('should pass through simple strings', () => {
    assert.equal(csvEscape('hello'), 'hello');
    assert.equal(csvEscape('123'), '123');
  });

  it('should quote strings containing commas', () => {
    assert.equal(csvEscape('a,b'), '"a,b"');
  });

  it('should quote strings containing double quotes', () => {
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  });

  it('should quote strings containing newlines', () => {
    assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
  });
});

// ── rowsToCsv ──────────────────────────────────────────────

describe('rowsToCsv', () => {
  it('should produce header + rows', () => {
    const csv = rowsToCsv(['a', 'b'], [['1', '2'], ['3', '4']]);
    assert.equal(csv, 'a,b\n1,2\n3,4\n');
  });

  it('should handle empty rows', () => {
    const csv = rowsToCsv(['x'], []);
    assert.equal(csv, 'x\n');
  });

  it('should escape values in rows', () => {
    const csv = rowsToCsv(['name'], [['hello, world']]);
    assert.equal(csv, 'name\n"hello, world"\n');
  });
});

// ── parseCsvSimple ─────────────────────────────────────────

describe('parseCsvSimple', () => {
  it('should parse basic CSV', () => {
    const { header, rows } = parseCsvSimple('a,b\n1,2\n3,4\n');
    assert.deepEqual(header, ['a', 'b']);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].a, '1');
    assert.equal(rows[0].b, '2');
    assert.equal(rows[1].a, '3');
    assert.equal(rows[1].b, '4');
  });

  it('should handle quoted fields with commas', () => {
    const { rows } = parseCsvSimple('name,val\n"hello, world",42\n');
    assert.equal(rows[0].name, 'hello, world');
    assert.equal(rows[0].val, '42');
  });

  it('should handle escaped double quotes', () => {
    const { rows } = parseCsvSimple('name\n"say ""hi"""\n');
    assert.equal(rows[0].name, 'say "hi"');
  });
});

// ── toHours ────────────────────────────────────────────────

describe('toHours', () => {
  it('should convert seconds to hours with 2 decimal places', () => {
    assert.equal(toHours(3600), 1);
    assert.equal(toHours(5400), 1.5);
    assert.equal(toHours(0), 0);
  });

  it('should round to 2 decimal places', () => {
    assert.equal(toHours(100), 0.03);
  });
});

// ── ymdLocal ───────────────────────────────────────────────

describe('ymdLocal', () => {
  it('should return YYYY-MM-DD format', () => {
    const result = ymdLocal(new Date(2026, 1, 14)); // Feb 14, 2026
    assert.equal(result, '2026-02-14');
  });

  it('should pad single-digit month and day', () => {
    const result = ymdLocal(new Date(2026, 0, 5)); // Jan 5, 2026
    assert.equal(result, '2026-01-05');
  });
});

// ── pickTop ────────────────────────────────────────────────

describe('pickTop', () => {
  it('should return top N items', () => {
    const items = [1, 2, 3, 4, 5];
    assert.deepEqual(pickTop(items, 3), [1, 2, 3]);
  });

  it('should return all if fewer than N', () => {
    assert.deepEqual(pickTop([1, 2], 5), [1, 2]);
  });

  it('should handle empty/null', () => {
    assert.deepEqual(pickTop([], 3), []);
    assert.deepEqual(pickTop(null, 3), []);
    assert.deepEqual(pickTop(undefined, 3), []);
  });
});

// ── extractTopFromStatusbarToday ───────────────────────────

describe('extractTopFromStatusbarToday', () => {
  it('should extract from standard Wakapi statusbar response', () => {
    const statusbar = {
      data: {
        grand_total: { total_seconds: 4899 },
        projects: [
          { name: 'mod-pod', total_seconds: 4899, percent: 100 },
        ],
        languages: [
          { name: 'Unknown', total_seconds: 4836, percent: 98.73 },
          { name: 'Markdown', total_seconds: 62, percent: 1.27 },
        ],
      },
    };
    const { totalSeconds, projects, languages } = extractTopFromStatusbarToday(statusbar);
    assert.equal(totalSeconds, 4899);
    assert.equal(projects.length, 1);
    assert.equal(projects[0].name, 'mod-pod');
    assert.equal(languages.length, 2);
    assert.equal(languages[0].name, 'Unknown');
  });

  it('should handle missing projects/languages gracefully', () => {
    const statusbar = {
      data: {
        grand_total: { total_seconds: 100 },
      },
    };
    const { totalSeconds, projects, languages } = extractTopFromStatusbarToday(statusbar);
    assert.equal(totalSeconds, 100);
    assert.deepEqual(projects, []);
    assert.deepEqual(languages, []);
  });
});

// ── extractFromSummariesToday ──────────────────────────────

describe('extractFromSummariesToday', () => {
  it('should extract from WakaTime-style summaries response', () => {
    const summaries = {
      data: [{
        grand_total: { total_seconds: 7200 },
        projects: [
          { name: 'bus-sim', total_seconds: 5000, percent: 69.4 },
          { name: 'metro', total_seconds: 2200, percent: 30.6 },
        ],
        languages: [
          { name: 'GDScript', total_seconds: 7200, percent: 100 },
        ],
      }],
    };
    const { totalSeconds, projects, languages } = extractFromSummariesToday(summaries);
    assert.equal(totalSeconds, 7200);
    assert.equal(projects.length, 2);
    assert.equal(projects[0].name, 'bus-sim');
    assert.equal(languages.length, 1);
  });
});

// ── upsertCsvByKeys (integration) ─────────────────────────

describe('upsertCsvByKeys', () => {
  let tmpDir;

  it('should create a new CSV file', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wakapi-test-'));
    const file = path.join(tmpDir, 'test.csv');
    const header = ['date', 'value'];
    const rows = [{ date: '2026-02-14', value: '42' }];

    await upsertCsvByKeys(file, header, ['date'], rows);

    const content = await fs.readFile(file, 'utf8');
    assert.ok(content.includes('date,value'));
    assert.ok(content.includes('2026-02-14,42'));
  });

  it('should upsert existing rows by key', async () => {
    const file = path.join(tmpDir, 'test.csv');
    const header = ['date', 'value'];
    const rows = [{ date: '2026-02-14', value: '99' }];

    await upsertCsvByKeys(file, header, ['date'], rows);

    const content = await fs.readFile(file, 'utf8');
    // Should have updated value, not duplicated row
    assert.ok(content.includes('2026-02-14,99'));
    assert.ok(!content.includes('2026-02-14,42'));
  });

  it('should append new rows without removing existing', async () => {
    const file = path.join(tmpDir, 'test.csv');
    const header = ['date', 'value'];
    const rows = [{ date: '2026-02-15', value: '50' }];

    await upsertCsvByKeys(file, header, ['date'], rows);

    const content = await fs.readFile(file, 'utf8');
    assert.ok(content.includes('2026-02-14,99'));
    assert.ok(content.includes('2026-02-15,50'));
  });

  it('should support composite keys', async () => {
    const file = path.join(tmpDir, 'ranked.csv');
    const header = ['date', 'rank', 'project'];
    const rows = [
      { date: '2026-02-14', rank: '1', project: 'bus-sim' },
      { date: '2026-02-14', rank: '2', project: 'metro' },
    ];

    await upsertCsvByKeys(file, header, ['date', 'rank'], rows);

    // Update rank 1
    await upsertCsvByKeys(file, header, ['date', 'rank'], [
      { date: '2026-02-14', rank: '1', project: 'mod-pod' },
    ]);

    const { rows: parsed } = parseCsvSimple(await fs.readFile(file, 'utf8'));
    const rank1 = parsed.find(r => r.date === '2026-02-14' && r.rank === '1');
    assert.equal(rank1.project, 'mod-pod');
    const rank2 = parsed.find(r => r.date === '2026-02-14' && r.rank === '2');
    assert.equal(rank2.project, 'metro');
  });

  // Cleanup
  it('cleanup tmp', async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true });
  });
});
