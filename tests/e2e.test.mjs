import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  extractTopFromStatusbarToday,
  extractFromSummariesToday,
  upsertCsvByKeys,
  parseCsvSimple,
  toHours,
  pickTop,
} from '../scripts/wakapi-daily-summary.mjs';

// ── Fixtures ───────────────────────────────────────────────

const STATUSBAR_FIXTURE = {
  data: {
    grand_total: { total_seconds: 14520 },
    projects: [
      { name: 'project-alpha', total_seconds: 8000, percent: 55.1 },
      { name: 'project-beta', total_seconds: 4000, percent: 27.5 },
      { name: 'project-gamma', total_seconds: 2000, percent: 13.8 },
      { name: 'project-delta', total_seconds: 520, percent: 3.6 },
    ],
    languages: [
      { name: 'Python', total_seconds: 7000, percent: 48.2 },
      { name: 'JavaScript', total_seconds: 4000, percent: 27.5 },
      { name: 'TypeScript', total_seconds: 2500, percent: 17.2 },
      { name: 'Markdown', total_seconds: 700, percent: 4.8 },
      { name: 'TOML', total_seconds: 320, percent: 2.2 },
    ],
  },
};

const SUMMARIES_FIXTURE = {
  data: [{
    grand_total: { total_seconds: 3600 },
    projects: [
      { name: 'webapp', total_seconds: 2400, percent: 66.7 },
      { name: 'cli-tool', total_seconds: 1200, percent: 33.3 },
    ],
    languages: [
      { name: 'TypeScript', total_seconds: 3600, percent: 100 },
    ],
  }],
};

// ── E2E: Full pipeline statusbar → CSV ─────────────────────

describe('E2E: statusbar response → CSV files', () => {
  let tmpDir;
  const DATE = '2026-02-14';
  const TOP_N = 10;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wakapi-e2e-'));
  });

  after(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true });
  });

  it('should produce correct daily-total.csv from statusbar', async () => {
    const { totalSeconds, projects, languages } = extractTopFromStatusbarToday(STATUSBAR_FIXTURE);
    const totalHours = toHours(totalSeconds);
    const projectsTop = pickTop(projects.sort((a, b) => b.seconds - a.seconds), TOP_N);
    const languagesTop = pickTop(languages.sort((a, b) => b.seconds - a.seconds), TOP_N);

    const totalHeader = ['date', 'total_seconds', 'total_hours', 'projects_count', 'languages_count'];
    const totalRows = [{
      date: DATE,
      total_seconds: String(totalSeconds),
      total_hours: String(totalHours),
      projects_count: String(projectsTop.length),
      languages_count: String(languagesTop.length),
    }];

    const file = path.join(tmpDir, 'daily-total.csv');
    await upsertCsvByKeys(file, totalHeader, ['date'], totalRows);

    const content = await fs.readFile(file, 'utf8');
    const { rows } = parseCsvSimple(content);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].date, '2026-02-14');
    assert.equal(rows[0].total_seconds, '14520');
    assert.equal(rows[0].total_hours, String(toHours(14520)));
    assert.equal(rows[0].projects_count, '4');
    assert.equal(rows[0].languages_count, '5');
  });

  it('should produce correct daily-top-projects.csv with ranked entries', async () => {
    const { projects } = extractTopFromStatusbarToday(STATUSBAR_FIXTURE);
    const projectsTop = pickTop(projects.sort((a, b) => b.seconds - a.seconds), TOP_N);

    const header = ['date', 'rank', 'project', 'seconds', 'hours', 'percent'];
    const projectRows = projectsTop.map((p, i) => ({
      date: DATE,
      rank: String(i + 1),
      project: p.name,
      seconds: String(p.seconds),
      hours: String(toHours(p.seconds)),
      percent: String(p.percent),
    }));

    const file = path.join(tmpDir, 'daily-top-projects.csv');
    await upsertCsvByKeys(file, header, ['date', 'rank'], projectRows);

    const content = await fs.readFile(file, 'utf8');
    const { rows } = parseCsvSimple(content);

    assert.equal(rows.length, 4);
    assert.equal(rows[0].project, 'project-alpha');
    assert.equal(rows[0].rank, '1');
    assert.equal(rows[1].project, 'project-beta');
    assert.equal(rows[1].rank, '2');
    assert.equal(rows[3].project, 'project-delta');
    assert.equal(rows[3].rank, '4');
  });

  it('should produce correct daily-top-languages.csv', async () => {
    const { languages } = extractTopFromStatusbarToday(STATUSBAR_FIXTURE);
    const languagesTop = pickTop(languages.sort((a, b) => b.seconds - a.seconds), TOP_N);

    const header = ['date', 'rank', 'language', 'seconds', 'hours', 'percent'];
    const langRows = languagesTop.map((l, i) => ({
      date: DATE,
      rank: String(i + 1),
      language: l.name,
      seconds: String(l.seconds),
      hours: String(toHours(l.seconds)),
      percent: String(l.percent),
    }));

    const file = path.join(tmpDir, 'daily-top-languages.csv');
    await upsertCsvByKeys(file, header, ['date', 'rank'], langRows);

    const content = await fs.readFile(file, 'utf8');
    const { rows } = parseCsvSimple(content);

    assert.equal(rows.length, 5);
    assert.equal(rows[0].language, 'Python');
    assert.equal(rows[0].rank, '1');
    assert.equal(rows[4].language, 'TOML');
  });

  it('should correctly upsert when running twice for the same date', async () => {
    // First write
    const file = path.join(tmpDir, 'upsert-test.csv');
    const header = ['date', 'total_seconds', 'total_hours', 'projects_count', 'languages_count'];

    await upsertCsvByKeys(file, header, ['date'], [{
      date: DATE,
      total_seconds: '1000',
      total_hours: '0.28',
      projects_count: '1',
      languages_count: '1',
    }]);

    // Second write (updated values)
    await upsertCsvByKeys(file, header, ['date'], [{
      date: DATE,
      total_seconds: '14520',
      total_hours: '4.03',
      projects_count: '4',
      languages_count: '5',
    }]);

    const content = await fs.readFile(file, 'utf8');
    const { rows } = parseCsvSimple(content);

    // Should have exactly 1 row, not 2
    assert.equal(rows.length, 1);
    assert.equal(rows[0].total_seconds, '14520');
  });

  it('should accumulate multiple dates', async () => {
    const file = path.join(tmpDir, 'multi-date.csv');
    const header = ['date', 'total_seconds', 'total_hours', 'projects_count', 'languages_count'];

    await upsertCsvByKeys(file, header, ['date'], [{
      date: '2026-02-13', total_seconds: '3600', total_hours: '1', projects_count: '2', languages_count: '3',
    }]);
    await upsertCsvByKeys(file, header, ['date'], [{
      date: '2026-02-14', total_seconds: '14520', total_hours: '4.03', projects_count: '4', languages_count: '5',
    }]);

    const content = await fs.readFile(file, 'utf8');
    const { rows } = parseCsvSimple(content);

    assert.equal(rows.length, 2);
    assert.equal(rows[0].date, '2026-02-13');
    assert.equal(rows[1].date, '2026-02-14');
  });
});

// ── E2E: summaries fallback ────────────────────────────────

describe('E2E: summaries fallback → CSV', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wakapi-e2e-fallback-'));
  });

  after(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true });
  });

  it('should use summaries when statusbar has no project/language data', async () => {
    // Simulate: statusbar only has grand_total, no breakdowns
    const statusbar = { data: { grand_total: { total_seconds: 3600 } } };
    let { totalSeconds, projects, languages } = extractTopFromStatusbarToday(statusbar);

    // Fallback needed
    assert.equal(projects.length, 0);
    assert.equal(languages.length, 0);

    const summariesData = extractFromSummariesToday(SUMMARIES_FIXTURE);
    totalSeconds = totalSeconds ?? summariesData.totalSeconds;
    projects = projects.length ? projects : summariesData.projects;
    languages = languages.length ? languages : summariesData.languages;

    const header = ['date', 'rank', 'project', 'seconds', 'hours', 'percent'];
    const projectRows = projects.sort((a, b) => b.seconds - a.seconds).map((p, i) => ({
      date: '2026-02-14',
      rank: String(i + 1),
      project: p.name,
      seconds: String(p.seconds),
      hours: String(toHours(p.seconds)),
      percent: String(p.percent),
    }));

    const file = path.join(tmpDir, 'projects.csv');
    await upsertCsvByKeys(file, header, ['date', 'rank'], projectRows);

    const { rows } = parseCsvSimple(await fs.readFile(file, 'utf8'));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].project, 'webapp');
    assert.equal(rows[1].project, 'cli-tool');
  });
});
