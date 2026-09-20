import path from 'node:path';
import multer from 'multer';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js'; // import the lib file directly; the package root runs a debug script
import { YoutubeTranscript } from 'youtube-transcript';

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

const httpError = (status, message) => Object.assign(new Error(message), { status });

// ---------- text cleanup ----------
// Turns raw extracted text into paragraphs separated by blank lines, each a readable size.
export function tidy(raw, max = 900) {
  const blocks = raw
    .replace(/\r\n?/g, '\n')
    .replace(/-\n(?=[a-z])/g, '') // re-join words hyphenated across lines
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);

  // Split very long paragraphs (typical for PDFs) at sentence boundaries.
  const sized = [];
  for (const block of blocks) {
    if (block.length <= max) {
      sized.push(block);
      continue;
    }
    let cur = '';
    for (const s of block.split(/(?<=[.!?])\s+/)) {
      if (cur && cur.length + 1 + s.length > max) {
        sized.push(cur);
        cur = s;
      } else cur = cur ? `${cur} ${s}` : s;
    }
    if (cur) sized.push(cur);
  }

  // Attach short lines (headings) to the paragraph that follows them.
  const out = [];
  let carry = '';
  for (const b of sized) {
    if (b.length < 60) {
      carry = carry ? `${carry} ${b}` : b;
    } else {
      out.push(carry ? `${carry}\n${b}` : b);
      carry = '';
    }
  }
  if (carry) out.length ? (out[out.length - 1] += `\n${carry}`) : out.push(carry);
  return out.join('\n\n');
}

// ---------- files ----------
export async function extractFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  let raw;
  try {
    if (ext === '.txt' || ext === '.md') raw = file.buffer.toString('utf8');
    else if (ext === '.pdf') raw = (await pdfParse(file.buffer)).text;
    else if (ext === '.docx') raw = (await mammoth.extractRawText({ buffer: file.buffer })).value;
  } catch {
    throw httpError(422, 'Could not read that file. It may be corrupted or password protected.');
  }
  if (raw === undefined) throw httpError(415, 'Upload a .txt, .md, .pdf or .docx file.');
  const text = tidy(raw);
  if (text.length < 80) {
    throw httpError(
      422,
      ext === '.pdf'
        ? 'No text found. This PDF may be scanned images. Try a text-based PDF or paste the text.'
        : 'That file has almost no text.'
    );
  }
  return { title: file.originalname, text };
}

// ---------- YouTube ----------
const YT_ID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;

export function parseVideoId(input) {
  const s = String(input).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  return s.match(YT_ID)?.[1] || null;
}

export const stamp = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// Groups caption lines into ~90 second segments. The transcript library reports offsets in
// milliseconds for one caption format and seconds for the other, so detect the unit.
export function groupTranscript(segs, windowSec = 90) {
  if (!segs.length) return [];
  const durations = segs.map((s) => s.duration).sort((a, b) => a - b);
  const scale = durations[Math.floor(durations.length / 2)] > 100 ? 1000 : 1;
  const groups = [];
  let cur = null;
  for (const s of segs) {
    const text = s.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const t = s.offset / scale;
    if (!cur || t - cur.start >= windowSec) {
      cur = { start: t, parts: [] };
      groups.push(cur);
    }
    cur.parts.push(text);
  }
  return groups.map((g) => ({ start: g.start, text: g.parts.join(' ') }));
}

export async function youtubeToText(url) {
  const id = parseVideoId(url);
  if (!id) throw httpError(400, 'That does not look like a YouTube link.');
  const noTranscript = httpError(422, 'No transcript could be fetched for this video. Paste the transcript into the box instead.');
  let segs;
  try {
    segs = await Promise.race([
      YoutubeTranscript.fetchTranscript(id),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
    ]);
  } catch {
    throw noTranscript;
  }
  const groups = groupTranscript(segs || []);
  if (!groups.length) throw noTranscript;
  return { title: `YouTube video ${id}`, videoId: id, text: groups.map((g) => `[${stamp(g.start)}] ${g.text}`).join('\n\n') };
}