import { createHash } from 'node:crypto';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';

const MENU_PAGE_URL = 'https://www.wcs.edu/about-us/menus-nutrition';
const OUTPUT_PATH = new URL('../lunch-menu.js', import.meta.url);
const MAX_PDF_BYTES = 5_000_000;
const DAILY_OPTIONS = 'A variety of sandwiches, signature salads, fresh fruits, side salads, vegetables, and beverages are also offered.';

function plainText(html = '') {
    return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function findHighSchoolLunchUrl(html) {
    for (const match of html.matchAll(/<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
        if (!/^High School Lunch Menu$/i.test(plainText(match[3]))) continue;
        const url = new URL(match[2].replace(/&amp;/g, '&'), MENU_PAGE_URL);
        if (!/(^|\.)wcs\.edu$/i.test(url.hostname) || !/\.pdf(?:$|\?)/i.test(url.href)) {
            throw new Error(`WCS menu link points to an unexpected location: ${url.href}`);
        }
        return url.href;
    }
    throw new Error('The official WCS page does not contain a High School Lunch Menu PDF link.');
}

function dateKey(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

function columnForX(x) {
    if (x < 170) return 0;
    if (x < 320) return 1;
    if (x < 465) return 2;
    if (x < 610) return 3;
    return 4;
}

function parseMenuItems(items) {
    const dates = items.map((item) => ({ ...item, date: dateKey(item.text) })).filter((item) => item.date);
    if (!dates.length) throw new Error('No dated menu cells were found in the WCS PDF.');
    const rowYValues = [...new Set(dates.map((item) => item.y))].sort((a, b) => b - a);
    const menus = {};

    for (const date of dates) {
        const rowIndex = rowYValues.indexOf(date.y);
        const lowerDateY = rowYValues[rowIndex + 1] ?? 45;
        const column = columnForX(date.x);
        const cell = items
            .filter((item) => columnForX(item.x) === column && item.y < date.y - 3 && item.y > lowerDateY + 3)
            .sort((a, b) => b.y - a.y || a.x - b.x);
        const lines = [];
        for (const item of cell) {
            if (!item.text.trim()) continue;
            const existing = lines.find((line) => Math.abs(line.y - item.y) <= 2);
            if (existing) existing.parts.push(item);
            else lines.push({ y: item.y, parts: [item] });
        }

        const meals = [];
        let lastY = null;
        for (const line of lines) {
            const ordered = line.parts.sort((a, b) => a.x - b.x);
            const hasBullet = ordered.some((item) => item.text.trim() === '•');
            const text = ordered.map((item) => item.text).join(' ').replace(/\s+/g, ' ').replace(/^•\s*/, '').trim();
            if (!text) continue;
            if (hasBullet) {
                meals.push(text);
                lastY = line.y;
            } else if (meals.length && lastY - line.y <= 14 && ordered[0].x >= 35) {
                meals[meals.length - 1] += ` ${text}`;
                lastY = line.y;
            }
        }
        if (meals.length) menus[date.date] = meals;
    }

    const allDates = dates.map((item) => item.date).sort();
    const months = new Set(allDates.map((key) => key.slice(0, 7)));
    if (months.size !== 1) throw new Error('The WCS PDF contains more than one menu month.');
    if (Object.keys(menus).length < 10) throw new Error(`Only ${Object.keys(menus).length} lunch days were parsed.`);
    return { month: allDates[0].slice(0, 7), coverageStart: allDates[0], coverageEnd: allDates.at(-1), menus };
}

function previousMonth(month) {
    const [year, value] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, value - 2, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function readPreviousData(source) {
    try {
        const sandbox = {};
        vm.runInNewContext(source, sandbox, { timeout: 1000 });
        return sandbox.IndyLunchMenu || null;
    } catch {
        return null;
    }
}

function generateSource({ sourceUrl, sourceHash, updatedAt, month, coverageStart, coverageEnd, menus }) {
    const menuLines = Object.entries(menus).sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => `        ${JSON.stringify(date)}: Object.freeze(${JSON.stringify(values)})`).join(',\n');
    return `(function (global) {\n    'use strict';\n\n    // Generated from the official WCS high-school lunch PDF.\n    // Run \`npm run update-lunch\` instead of editing monthly entries by hand.\n    const OFFICIAL_MENU_URL = ${JSON.stringify(MENU_PAGE_URL)};\n    const SOURCE_DOCUMENT_URL = ${JSON.stringify(sourceUrl)};\n    const SOURCE_LABEL = 'WCS High School Lunch Menu';\n    const SOURCE_HASH = ${JSON.stringify(sourceHash)};\n    const MENU_MONTH = ${JSON.stringify(month)};\n    const UPDATED_AT = ${JSON.stringify(updatedAt)};\n    const COVERAGE_START = ${JSON.stringify(coverageStart)};\n    const COVERAGE_END = ${JSON.stringify(coverageEnd)};\n    const DAILY_OPTIONS = ${JSON.stringify(DAILY_OPTIONS)};\n\n    const MENUS = Object.freeze({\n${menuLines}\n    });\n\n    function getMenu(dateKey) {\n        const menu = MENUS[dateKey];\n        return menu ? menu.slice() : null;\n    }\n\n    global.IndyLunchMenu = Object.freeze({\n        schemaVersion: 1, ready: true, OFFICIAL_MENU_URL, SOURCE_DOCUMENT_URL, SOURCE_LABEL, SOURCE_HASH,\n        MENU_MONTH, UPDATED_AT, COVERAGE_START, COVERAGE_END, DAILY_OPTIONS, MENUS, getMenu\n    });\n})(globalThis);\n`;
}

const headers = { 'user-agent': 'IndyScheduleMenuUpdater/1.0' };
const pageResponse = await fetch(MENU_PAGE_URL, { headers });
if (!pageResponse.ok) throw new Error(`WCS menu page returned ${pageResponse.status}.`);
const sourceUrl = findHighSchoolLunchUrl(await pageResponse.text());
const pdfResponse = await fetch(sourceUrl, { headers });
if (!pdfResponse.ok) throw new Error(`WCS lunch PDF returned ${pdfResponse.status}.`);
const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
if (pdfBytes.length < 1000 || pdfBytes.length > MAX_PDF_BYTES || new TextDecoder().decode(pdfBytes.slice(0, 4)) !== '%PDF') {
    throw new Error('WCS lunch document is not a supported PDF.');
}

const sourceHash = createHash('sha256').update(pdfBytes).digest('hex');
const previous = await readFile(OUTPUT_PATH, 'utf8').catch(() => '');
const previousHash = /const SOURCE_HASH = ['"]([a-f0-9]{64})['"]/.exec(previous)?.[1];
const previousUpdatedAt = /const UPDATED_AT = ['"]([^'"]+)['"]/.exec(previous)?.[1];
const lastModified = pdfResponse.headers.get('last-modified');
const updatedAt = sourceHash === previousHash && previousUpdatedAt
    ? previousUpdatedAt
    : (lastModified && !Number.isNaN(Date.parse(lastModified)) ? new Date(lastModified).toISOString() : new Date().toISOString());

const standardFontDataUrl = `${fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url))}/`;
const pdf = await getDocument({ data: pdfBytes, standardFontDataUrl, verbosity: VerbosityLevel.ERRORS }).promise;
const textItems = [];
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    content.items.forEach((item) => textItems.push({ text: item.str, x: Number(item.transform?.[4] || 0), y: Number(item.transform?.[5] || 0) }));
}
const parsed = parseMenuItems(textItems);
const previousData = readPreviousData(previous);
const retainedMonths = new Set([previousMonth(parsed.month), parsed.month]);
const retainedMenus = Object.entries(previousData?.MENUS || {}).reduce((result, [date, items]) => {
    if (retainedMonths.has(date.slice(0, 7)) && Array.isArray(items)) result[date] = [...items];
    return result;
}, {});
const menus = { ...retainedMenus, ...parsed.menus };
const coverageStart = [parsed.coverageStart, ...Object.keys(menus)].sort()[0];
const next = generateSource({ ...parsed, sourceUrl, sourceHash, updatedAt, menus, coverageStart });
const changed = next !== previous;
if (changed) await writeFile(OUTPUT_PATH, next);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `content_changed=${changed}\n`);
console.log(`${changed ? 'Updated' : 'Verified'} ${parsed.month} lunch menu: ${Object.keys(parsed.menus).length} serving days from ${sourceUrl}`);
