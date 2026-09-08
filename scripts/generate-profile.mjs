import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const text = (x, y, value, size = 14, fill = '#a1a1aa', extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const svg = (height, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="${height}" viewBox="0 0 880 ${height}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title><rect width="880" height="${height}" rx="16" fill="#0d1117"/><g font-family="Arial, Helvetica, sans-serif">${body}</g></svg>\n`;

export function summarize(days) {
  if (!days.length) throw new Error('Contribution calendar is empty');
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let total = 0, longest = 0, run = 0, active = 0;
  for (let i = 0; i < sorted.length; i++) {
    const day = sorted[i];
    if (!Number.isInteger(day.contributionCount) || day.contributionCount < 0) throw new Error('Invalid contribution count');
    if (i && Date.parse(day.date) - Date.parse(sorted[i - 1].date) !== 86400000) throw new Error('Calendar has missing or duplicate days');
    total += day.contributionCount;
    run = day.contributionCount > 0 ? run + 1 : 0;
    if (day.contributionCount > 0) active++;
    longest = Math.max(longest, run);
  }
  let current = 0;
  let last = sorted.length - 1;
  if (sorted[last].contributionCount === 0) last--;
  while (last >= 0 && sorted[last--].contributionCount > 0) current++;
  return { total, longest, current, active, days: sorted };
}

async function main() {
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required');
  const query = `query { user(login: "Daudu-Joseph") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`;
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  const result = await response.json();
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  const calendar = result.data.user.contributionsCollection.contributionCalendar;
  const stats = summarize(calendar.weeks.flatMap(w => w.contributionDays));
  if (stats.total !== calendar.totalContributions) throw new Error('Calendar total does not match daily counts');
  await mkdir('dist', { recursive: true });
  const updated = new Date().toISOString().slice(0, 10);
  const range = `${stats.days[0].date} to ${stats.days.at(-1).date}`;

  const metrics = [[stats.total, 'CONTRIBUTIONS'], [stats.current, 'CURRENT STREAK · DAYS'], [stats.longest, 'LONGEST STREAK · DAYS'], [stats.active, 'ACTIVE DAYS']];
  await writeFile('dist/profile-stats.svg', svg(200, `GitHub activity: ${stats.total} profile-visible contributions`,
    text(32, 33, 'GITHUB / ACTIVITY', 12, '#fafafa', 'letter-spacing="3"') +
    text(848, 33, 'LAST 12 MONTHS', 10, '#a1a1aa', 'text-anchor="end" letter-spacing="2"') +
    metrics.map(([value, label], i) => text(110 + i * 220, 105, value, 38, '#fafafa', 'text-anchor="middle" font-weight="700"') + text(110 + i * 220, 132, label, 10, '#a1a1aa', 'text-anchor="middle" letter-spacing="1"')).join('') +
    text(32, 180, `Profile-visible activity · ${range}`, 11) + text(848, 180, `Updated ${updated} UTC`, 11, '#a1a1aa', 'text-anchor="end"')));

  const recent = stats.days.slice(-30);
  const max = Math.max(4, ...recent.map(d => d.contributionCount));
  const ceiling = Math.ceil(max / 4) * 4;
  const coords = recent.map((d, i) => [60 + i * 790 / (recent.length - 1), 208 - d.contributionCount / ceiling * 132]);
  const points = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  let graph = text(32, 34, "JOSEPH'S CONTRIBUTION GRAPH", 12, '#fafafa', 'letter-spacing="2"') + text(848, 34, 'LAST 30 DAYS', 10, '#a1a1aa', 'text-anchor="end" letter-spacing="2"');
  for (let i = 0; i <= 4; i++) {
    const y = 208 - i * 33;
    graph += `<path d="M60 ${y}H850" stroke="#27272a" stroke-width="1"/>` + text(45, y + 4, i * ceiling / 4, 10, '#a1a1aa', 'text-anchor="end"');
  }
  graph += `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".23"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><polygon points="60,208 ${points} 850,208" fill="url(#area)"/><polyline points="${points}" fill="none" stroke="#fafafa" stroke-width="2" stroke-linejoin="round"/>`;
  coords.forEach(([x, y], i) => {
    graph += `<circle cx="${x}" cy="${y}" r="2.8" fill="#fafafa"><title>${recent[i].date}: ${recent[i].contributionCount} contributions</title></circle>`;
    if (i % 5 === 0 || i === recent.length - 1) graph += text(x, 229, recent[i].date.slice(5), 10, '#a1a1aa', 'text-anchor="middle"');
  });
  graph += text(32, 262, 'Daily contributions visible on my GitHub profile', 11);
  await writeFile('dist/contribution-graph.svg', svg(282, "Joseph's contribution graph — last 30 days", graph));

  for (const light of [false, true]) {
    const bg = light ? '#f5f5f5' : '#0d1117';
    const fg = light ? '#18181b' : '#fafafa';
    const muted = light ? '#52525b' : '#a1a1aa';
    const banner = svg(240, "Hey there, I'm Higgins — Joseph Daudu", `<path d="M32 35H848M32 207H848" stroke="${light ? '#d4d4d8' : '#303036'}"/>` +
      text(440, 67, 'JOSEPH DAUDU / HIGGINS', 11, muted, 'text-anchor="middle" letter-spacing="4"') +
      text(440, 123, "Hey there, I'm Higgins.", 42, fg, 'text-anchor="middle" font-weight="700"') +
      text(440, 160, 'IT Manager · Technology Lead · Product Engineer', 16, muted, 'text-anchor="middle"') +
      text(440, 191, 'LAGOS, NIGERIA  /  DAUDU.FRAMER.WEBSITE', 10, muted, 'text-anchor="middle" letter-spacing="2"')).replace('fill="#0d1117"', `fill="${bg}"`);
    await writeFile(`dist/banner-${light ? 'light' : 'dark'}.svg`, banner);
  }

  for (const file of ['github-snake.svg', 'github-snake-dark.svg']) {
    let snake = await readFile(`dist/${file}`, 'utf8');
    if (!snake.includes('--cb:') || !snake.includes('<style>')) throw new Error('Unexpected snake SVG format');
    snake = snake.replace(/--cb:[^;}]+/, '--cb:transparent');
    snake = snake.replace('<style>', '<rect x="-16" y="-32" width="880" height="192" rx="12" fill="#0d1117"/><style>');
    await writeFile(`dist/${file}`, snake);
  }
  console.log(`Generated profile assets: ${stats.total} profile-visible contributions (${range}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
