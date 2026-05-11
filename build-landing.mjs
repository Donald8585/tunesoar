import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const src = readFileSync('landing/pages.ts', 'utf8');

// Extract LAYOUT_CSS
const cssStart = src.indexOf('const LAYOUT_CSS = `\n') + 'const LAYOUT_CSS = `\n'.length;
const cssEnd = src.indexOf('`;\n\nconst NAV_LOGO');
const CSS = src.slice(cssStart, cssEnd);

// Extract NAV_LOGO  
const logoStart = src.indexOf('const NAV_LOGO = `') + 'const NAV_LOGO = `'.length;
const logoEnd = src.indexOf('`;\n\nfunction layout');
const NAV_LOGO = src.slice(logoStart, logoEnd);

// Extract layout function template
const layoutFnStart = src.indexOf('return `') + 'return `'.length;
const layoutFnEnd = src.indexOf('`;\n}\n\n//');
const LAYOUT_TEMPLATE = src.slice(layoutFnStart, layoutFnEnd);

// Extract DOWNLOAD_PAGE body
const dlStart = src.indexOf('export const DOWNLOAD_PAGE = layout("Download", `\n') + 'export const DOWNLOAD_PAGE = layout("Download", `\n'.length;
const dlEnd = src.indexOf('`, "/downloads");');
const DL_BODY = src.slice(dlStart, dlEnd);

// Extract HOME_PAGE body  
const homeStart = src.indexOf('export const HOME_PAGE = layout("Context-Aware Binaural Beats", `\n') + 'export const HOME_PAGE = layout("Context-Aware Binaural Beats", `\n'.length;
const homeEnd = src.indexOf('`, "");');
const HOME_BODY = src.slice(homeStart, homeEnd);

function navLink(href, label, current) {
  return `<a href="${href}"${current === href ? ' class="active"' : ""}>${label}</a>`;
}

function buildLayout(title, body, currentPage) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiBmaWxsPSJub25lIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9IncxIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzZiMjFmZiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM0N2JmZmYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9IncyIiB4MT0iMTAwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzQ3YmZmZiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM2YjIxZmYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImRvdCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM0N2JmZmYiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODYzYmZmIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPCEtLSBTdWJ0bGUgYmFja2dyb3VuZCBjaXJjbGUgZm9yIGFueSBiZyAtLT4KICAgIDxjaXJjbGUgaWQ9ImJnYyIgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjU2IiBmaWxsPSIjMGEwYTBmIi8+CiAgPC9kZWZzPgogIDx1c2UgaHJlZj0iI2JnYyIvPgogIDwhLS0gU291bmQgd2F2ZSBsZWZ0IC0tPgogIDxwYXRoIGQ9Ik0xMjYgMjk2IFExNzYgMjE2IDIzNiAyMzYgUTI5NiAyNTYgMjQ2IDI4NiBRMTk2IDMxNiAxNDYgMjc2IiBzdHJva2U9InVybCgjdzEpIiBzdHJva2Utd2lkdGg9IjEwIiBzdHJva2UtbGluZWNhcD0icm91bmQiIGZpbGw9Im5vbmUiLz4KICA8IS0tIENlbnRlciBub2RlIC0tPgogIDxjaXJjbGUgY3g9IjI2NiIgY3k9IjI2NiIgcj0iMzQiIGZpbGw9InVybCgjZG90KSIvPgogIDxjaXJjbGUgY3g9IjI2NiIgY3k9IjI2NiIgcj0iMTQiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuODUiLz4KICA8IS0tIFNvdW5kIHdhdmUgcmlnaHQgLS0+CiAgPHBhdGggZD0iTTMyNiAyMTYgUTM3NiAxNzYgNDA2IDIwNiBRNDM2IDIzNiAzODYgMjY2IiBzdHJva2U9InVybCgjdzIpIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgZmlsbD0ibm9uZSIvPgogIDwhLS0gRWNobyAtLT4KICA8Y2lyY2xlIGN4PSI0MzAiIGN5PSIzMTAiIHI9IjEwIiBmaWxsPSIjODYzYmZmIiBvcGFjaXR5PSIwLjUiLz4KPC9zdmc+Cg=="/>
<title>${title}</title>
<style>${CSS}</style>
<script async crossorigin src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
  data-clerk-publishable-key="pk_live_Y2xlcmsudHVuZXNvYXIuY29tJA"
  data-clerk-sign-in-url="/account"
  data-clerk-sign-up-url="/account">
</script>
</head>
<body>
<nav>
  <a href="/" class="brand">${NAV_LOGO}TuneSoar</a>
  <div class="nav-right">
    ${navLink("/", "Home")}
    ${navLink("/downloads", "Downloads")}
    ${navLink("/pricing", "Pricing")}
    ${navLink("/account", "Account")}
  </div>
</nav>
<main>${body}</main>
<footer class="footer">
  <a href="/privacy">Privacy</a> &middot; 
  <a href="/terms">Terms</a> &middot; 
  <a href="/safety">Safety</a> &middot; 
  © TranceLab
</footer>
</body>
</html>`;
}

mkdirSync('landing-dist', { recursive: true });
writeFileSync('landing-dist/index.html', buildLayout('Context-Aware Binaural Beats — TuneSoar', HOME_BODY, ''));
writeFileSync('landing-dist/downloads.html', buildLayout('Download — TuneSoar', DL_BODY, '/downloads'));
writeFileSync('landing-dist/404.html', buildLayout('404 — TuneSoar', '<div style="text-align:center;padding:80px 0"><h1>404</h1><p>Page not found.</p><a href="/" class="btn primary" style="margin-top:16px">Back to Home</a></div>', ''));

console.log('Built:');
for (const f of ['index.html', 'downloads.html', '404.html']) {
  const stat = require('fs').statSync('landing-dist/' + f);
  console.log(`  ${f} (${stat.size} bytes)`);
}
