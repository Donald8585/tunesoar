const fs = require('fs');
const src = fs.readFileSync('landing/pages.ts', 'utf8');

// Extract components using multiline regex
function extract(name, pattern) {
  const m = src.match(pattern);
  if (!m) { console.error('Failed to extract:', name); process.exit(1); }
  return m[1];
}

const CSS = extract('LAYOUT_CSS', /^const LAYOUT_CSS = `([\\s\\S]*?)`;/m);
const NAV_LOGO = extract('NAV_LOGO', /^const NAV_LOGO = `([\\s\\S]*?)`;/m);
const LAYOUT_TEMPLATE = extract('layout template', /function layout\([^)]+\): string \{[\\s\\S]*?return `([\\s\\S]*?)`;\n\}/m);
const DL_BODY = extract('DOWNLOAD_PAGE', /export const DOWNLOAD_PAGE = layout\("Download", `([\\s\\S]*?)`, "\/downloads"\)/m);
const HOME_BODY = extract('HOME_PAGE', /export const HOME_PAGE = layout\("[^"]+", `([^`]*)`/m);

function navLink(href, label, current) {
  return `<a href="${href}"${current === href ? ' class="active"' : ""}>${label}</a>`;
}

function buildLayout(title, body, currentPage) {
  return LAYOUT_TEMPLATE
    .replace(/\$\{LAYOUT_CSS\}/g, CSS)
    .replace(/\$\{NAV_LOGO\}/g, NAV_LOGO)
    .replace(/\$\{navLink\("\/", "Home"\)\}/g, navLink("/", "Home", currentPage))
    .replace(/\$\{navLink\("\/downloads", "Downloads"\)\}/g, navLink("/downloads", "Downloads", currentPage))
    .replace(/\$\{navLink\("\/pricing", "Pricing"\)\}/g, navLink("/pricing", "Pricing", currentPage))
    .replace(/\$\{navLink\("\/account", "Account"\)\}/g, navLink("/account", "Account", currentPage))
    .replace('${title}', title)
    .replace('${body}', body);
}

fs.mkdirSync('landing-dist', { recursive: true });
fs.writeFileSync('landing-dist/index.html', buildLayout('Context-Aware Binaural Beats — TuneSoar', HOME_BODY, ''));
fs.writeFileSync('landing-dist/downloads.html', buildLayout('Download — TuneSoar', DL_BODY, '/downloads'));
fs.writeFileSync('landing-dist/404.html', buildLayout('404 — TuneSoar', '<div style="text-align:center;padding:80px 0"><h1>404</h1><p>Page not found.</p><a href="/" class="btn primary" style="margin-top:16px">Back to Home</a></div>', ''));

console.log('Built:');
fs.readdirSync('landing-dist').forEach(f => console.log('  ' + f + ' (' + fs.statSync('landing-dist/' + f).size + ' bytes)'));
