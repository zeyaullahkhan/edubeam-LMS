/**
 * Map YouTube video URLs onto lectures from channel CSV exports.
 *
 * USAGE
 * -----
 *   Place channel export CSV files into:
 *     C:/Users/Khan/Downloads/channel exports/
 *   Each CSV must have columns: Title, Link, Publish Date (UTC)
 *   (this is YouTube Studio's default export format)
 *
 *   node scripts/import-youtube-urls.mjs            # dry run — show match counts
 *   node scripts/import-youtube-urls.mjs --write    # save URLs to DB
 */

import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('../node_modules/xlsx');
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const EXPORT_DIR = 'C:/Users/Khan/Downloads/channel exports';
const WRITE = process.argv.includes('--write');
const DB_URL = process.env.DATABASE_URL ?? 'file:C:/Development/edubeam-lms/packages/db/prisma/dev.db';

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

// ── Hindi → English subject mapping ──────────────────────────────────────────
// Keys are checked via String.includes(), longer phrases first.
const HINDI_SUBJECT_MAP = [
  ['सामाजिक विज्ञान',    'socialscience'],
  ['जीव विज्ञान',        'biology'],
  ['रसायन विज्ञान',      'chemistry'],
  ['भौतिक विज्ञान',      'physics'],
  ['राजनीति विज्ञान',    'politicalscience'],
  ['राजनीति शास्त्र',    'politicalscience'],
  ['नागरिक शास्त्र',     'politicalscience'],
  ['विज्ञान',             'science'],
  ['गणित',               'mathematics'],
  ['अंग्रेज़ी',           'english'],
  ['अंग्रेजी',            'english'],
  ['हिंदी',              'hindi'],
  ['संस्कृत',            'sanskrit'],
  ['इतिहास',             'history'],
  ['भूगोल',              'geography'],
  ['अर्थशास्त्र',         'economics'],
  ['रसायन',              'chemistry'],
  ['भौतिकी',             'physics'],
];

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function hindiSubject(title) {
  for (const [hindi, english] of HINDI_SUBJECT_MAP) {
    if (String(title).includes(hindi)) return english;
  }
  return null;
}

/** Extract DDMMYYYY from "(DD.MM.YYYY)" in title. */
function titleDate(title) {
  const m = String(title).match(/\((\d{1,2})\.(\d{1,2})\.(\d{4})\)/);
  return m ? `${m[1].padStart(2, '0')}${m[2].padStart(2, '0')}${m[3]}` : null;
}

/** Extract DDMMYYYY from ISO publish date "2026-06-15T...". */
function publishDate(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}${m[2]}${m[1]}` : null;
}

/** Extract class integer from "कक्षा 07" or "कक्षा: 9". */
function titleClass(title) {
  const m = String(title).match(/कक्षा[:\s]*0*(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Extract part integer: the number immediately before (DD.MM.YYYY). */
function titlePart(title) {
  // matches "भाग: 13 (15.06.2026)" or "गणित: 01 (15.06.2026)"
  const m = String(title).match(/(\d+)\s*\(\d{1,2}\.\d{1,2}\.\d{4}\)/);
  return m ? Number(m[1]) : null;
}

/** Extract YouTube URL from a cell string. */
function extractUrl(cell) {
  const s = String(cell ?? '').trim();
  const m = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return `https://www.youtube.com/watch?v=${s}`;
  return null;
}

// ── DB lecture key builders ───────────────────────────────────────────────────

function dbDate(l) {
  const m = String(l.date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}${m[2]}${m[1]}` : '';
}

/** Primary key: date | class | subject (no part) — uniquely identifies one subject session per day. */
function dbKeyDateClassSubject(l) {
  return `${dbDate(l)}|${l.standard}|${norm(l.subject)}`;
}

/** Fallback full key: date | class | part | norm(subject+topicBody) */
function dbKeyFull(l) {
  const part = (() => { const m = String(l.topic).match(/(?:part|भाग)\s*0*(\d+)/i); return m ? Number(m[1]) : null; })();
  const body = String(l.topic).replace(/[\s_-]*(?:part|भाग)\s*\d+\s*$/i, '');
  return `${dbDate(l)}|${l.standard}|${part ?? ''}|${norm(l.subject)}${norm(body)}`;
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    // Simple CSV parse: handle quoted fields
    const fields = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuote = !inQuote; }
      else if (c === ',' && !inQuote) { fields.push(cur); cur = ''; }
      else { cur += c; }
    }
    fields.push(cur);
    rows.push(fields);
  }
  return rows;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(EXPORT_DIR)) {
    console.error(`Export folder not found: ${EXPORT_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(EXPORT_DIR).filter(f => /\.(csv|xlsx)$/i.test(f));
  if (files.length === 0) {
    console.error(`No CSV/XLSX files in ${EXPORT_DIR}`);
    process.exit(1);
  }
  console.log(`Reading ${files.length} export file(s): ${files.join(', ')}`);

  // Build lecture indices
  const lectures = await prisma.lecture.findMany({
    select: { id: true, date: true, standard: true, subject: true, topic: true, youtubeUrl: true },
  });

  const byDateClassSubject = new Map(); // primary: date|class|subjectNorm
  const byFull = new Map();             // fallback: date|class|part|subjectTopicNorm

  for (const l of lectures) {
    const k1 = dbKeyDateClassSubject(l);
    if (!byDateClassSubject.has(k1)) byDateClassSubject.set(k1, []);
    byDateClassSubject.get(k1).push(l);

    const k2 = dbKeyFull(l);
    if (!byFull.has(k2)) byFull.set(k2, []);
    byFull.get(k2).push(l);
  }
  console.log(`Indexed ${lectures.length} lectures`);

  let videos = 0, matched = 0, seqMatched = 0, ambiguous = 0, noUrl = 0, noMatch = 0;
  const updates = [];
  const matchedIds = new Set();
  const unmatchedSamples = [];
  // Collect ambiguous cases per group key for post-pass group matching
  const ambigGroups = new Map(); // groupKey → [{url, part}]

  for (const file of files) {
    let rows;
    if (/\.xlsx$/i.test(file)) {
      const wb = XLSX.readFile(join(EXPORT_DIR, file));
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }).map(r => r.map(c => String(c ?? '')));
    } else {
      rows = parseCSV(join(EXPORT_DIR, file));
    }

    for (const row of rows) {
      if (!row || row.length < 2) continue;

      // YouTube Studio CSV: Title (col 0), Link (col 1), Publish Date (col 2)
      const titleCell = row[0] ?? '';
      const linkCell  = row[1] ?? '';
      const dateCell  = row[2] ?? '';

      // Skip header row
      if (/^title$/i.test(titleCell.trim())) continue;

      const url = extractUrl(linkCell) ?? extractUrl(titleCell);
      if (!url) { noUrl++; continue; }

      videos++;

      // ── Strategy 1: Hindi title format ──────────────────────────────────
      const date    = titleDate(titleCell) ?? publishDate(dateCell);
      const cls     = titleClass(titleCell);
      const subject = hindiSubject(titleCell);

      if (date && cls !== null && subject) {
        const key = `${date}|${cls}|${subject}`;
        const hits = byDateClassSubject.get(key);
        if (hits && hits.length === 1) {
          matched++;
          matchedIds.add(hits[0].id);
          updates.push({ id: hits[0].id, url });
          continue;
        }
        if (hits && hits.length > 1) {
          // Tiebreak 1: topic contains matching "Part N"
          const part = titlePart(titleCell);
          if (part !== null) {
            const withPart = hits.filter(l => {
              const m = String(l.topic).match(/(?:part|भाग)\s*0*(\d+)/i);
              return m ? Number(m[1]) === part : false;
            });
            if (withPart.length === 1) {
              matched++;
              matchedIds.add(withPart[0].id);
              updates.push({ id: withPart[0].id, url });
              continue;
            }

          }
          // Queue for group-based matching (resolved after main loop)
          const groupKey = `${date}|${cls}|${subject}`;
          if (!ambigGroups.has(groupKey)) ambigGroups.set(groupKey, []);
          ambigGroups.get(groupKey).push({ url, part: titlePart(titleCell) });
          ambiguous++;
          continue;
        }
      }

      // ── Strategy 2: English underscore format (old channels / events) ──
      if (/_/.test(titleCell)) {
        // Try existing full-key logic
        const segs = titleCell.split('_').map(s => s.trim()).filter(Boolean);
        const extractedDate = (() => { const m = titleCell.match(/\b(\d{2})(\d{2})(\d{4})\b/); return m ? `${m[1]}${m[2]}${m[3]}` : null; })();
        const extractedClass = (() => { const m = titleCell.match(/(?:^|[_\s])(VI{0,3}|IX|XI{0,2})(?:[_\s]|$)/); return m ? ({ VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12 })[m[1]] ?? null : null; })();
        const extractedPart = (() => { const m = titleCell.match(/(?:part|भाग)\s*0*(\d+)/i); return m ? Number(m[1]) : null; })();
        const middle = segs.slice(2, -3).join('');
        const fp = middle ? norm(middle) : norm(segs.join(''));
        const key = `${extractedDate ?? ''}|${extractedClass ?? ''}|${extractedPart ?? ''}|${fp}`;
        const hits = byFull.get(key);
        if (hits && hits.length === 1) { matched++; updates.push({ id: hits[0].id, url }); continue; }
        if (hits && hits.length > 1) { ambiguous++; continue; }
      }

      // No match
      noMatch++;
      if (unmatchedSamples.length < 15) unmatchedSamples.push(titleCell.slice(0, 100));
    }
  }

  // ── Group-based resolution for ambiguous cases ───────────────────────────
  // When N videos and N DB lectures share the same date|class|subject, match
  // them by relative ordering: sort DB lectures by topic-part number, sort
  // videos by their भाग counter, then pair them positionally.
  for (const [groupKey, vidList] of ambigGroups) {
    const [date, clsStr, subject] = groupKey.split('|');

    const hits = byDateClassSubject.get(groupKey) ?? [];
    // Only unmatched lectures (no URL yet and not matched this run)
    const available = hits.filter(l => !matchedIds.has(l.id) && !l.youtubeUrl);
    if (available.length === 0 || vidList.length === 0) continue;
    // Video count must equal available lecture count for an unambiguous assignment
    if (vidList.length !== available.length) continue;

    // Sort lectures by the part number embedded in topic (0 if none → stable order)
    const topicPart = l => {
      const m = String(l.topic).match(/(?:part|भाग)\s*0*(\d+)/i);
      return m ? Number(m[1]) : 0;
    };
    const sortedLectures = [...available].sort((a, b) => topicPart(a) - topicPart(b) || String(a.topic).localeCompare(String(b.topic)));

    // Sort videos by भाग counter (null → 0)
    const sortedVideos = [...vidList].sort((a, b) => (a.part ?? 0) - (b.part ?? 0));

    for (let i = 0; i < sortedLectures.length; i++) {
      seqMatched++;
      ambiguous--;
      matchedIds.add(sortedLectures[i].id);
      updates.push({ id: sortedLectures[i].id, url: sortedVideos[i].url });
    }
  }

  console.log(`\nVideos read:         ${videos}`);
  console.log(`Matched (direct):    ${matched}`);
  console.log(`Matched (group):     ${seqMatched}`);
  console.log(`Total matched:       ${matched + seqMatched}`);
  console.log(`No URL in row:       ${noUrl}`);
  console.log(`No matching lecture: ${noMatch}`);
  console.log(`Ambiguous (skipped): ${ambiguous}`);

  if (unmatchedSamples.length) {
    console.log('\nSample unmatched titles:');
    unmatchedSamples.forEach(s => console.log('  -', s));
  }

  if (!WRITE) {
    console.log('\nDRY RUN — no changes written. Re-run with --write to save these URLs.');
  } else {
    let written = 0;
    for (const u of updates) {
      await prisma.lecture.update({ where: { id: u.id }, data: { youtubeUrl: u.url } });
      written++;
      if (written % 200 === 0) process.stdout.write(`\r  Wrote ${written}/${updates.length}...`);
    }
    console.log(`\nWrote ${written} YouTube URLs onto lectures.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
