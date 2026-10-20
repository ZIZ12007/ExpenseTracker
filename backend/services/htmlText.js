/**
 * Turns an uploaded HTML timetable into text the AI can read.
 *
 * The file is never rendered by the app - it is only read as text - so the
 * scripts and styles are dropped rather than executed anywhere.
 */
const decodeEntities = (value) => value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

/**
 * Extracts readable text from an HTML document, keeping the table structure
 * (one row per line, cells separated by a pipe).
 */
const htmlToText = (html) => {
    const withoutCode = String(html || '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ');

    const withRows = withoutCode
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        .replace(/<\s*\/\s*(tr|p|div|li|h[1-6])\s*>/gi, '\n')
        .replace(/<\s*\/\s*(td|th)\s*>/gi, ' | ')
        .replace(/<\s*(td|th)\b[^>]*>/gi, ' | ');

    const text = decodeEntities(withRows.replace(/<[^>]+>/g, ' '));

    return text
        .split('\n')
        .map((line) => line.replace(/[ \t]+/g, ' ').replace(/(\s*\|\s*)+/g, ' | ').replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').trim())
        .filter((line) => line && line !== '|')
        .join('\n')
        .slice(0, 12000);
};

module.exports = { htmlToText, decodeEntities };
