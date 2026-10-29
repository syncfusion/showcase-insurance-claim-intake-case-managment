// Starts the critical downloads from index.html (factory/standards/app-source-baseline.md, "Loading
// states"; app-plan.md, "Frame first and faster loading on Azure"). Without it each file is found only
// after the one before it has run: the entry script, then the theme stylesheet it adds, then the route's
// page chunk, one slow round trip after another (1.1-1.3 s each from the Azure host).
//
// At build time it maps each route to its page chunk and that chunk's imports, and finds the theme
// stylesheets; the script it adds to <head> preloads, for the address being opened, the theme the inline
// theme script chose and the route's chunks (modulepreload). Build only: the dev server is unchanged.
export default function startupPreload({ base, routes, defaultRoute, themes }) {
  return {
    name: 'startup-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const files = Object.values(bundle);
        const chunkFor = suffix => files.find(file => file.type === 'chunk' && file.facadeModuleId?.replaceAll('\\', '/').endsWith(suffix));
        const withImports = (chunk, seen = new Set()) => {
          if (!chunk || seen.has(chunk.fileName)) return seen;
          seen.add(chunk.fileName);
          for (const name of chunk.imports ?? []) withImports(bundle[name], seen);
          return seen;
        };
        const map = Object.fromEntries(Object.entries(routes).map(([route, modules]) =>
          [route, [...new Set([].concat(modules).flatMap(module => [...withImports(chunkFor(module))]))]]));
        const asset = test => files.find(file => file.type === 'asset' && test.test(file.fileName))?.fileName;
        const sheets = { light: asset(themes.light), dark: asset(themes.dark) };
        const missing = Object.entries(map).filter(([, list]) => !list.length).map(([route]) => route);
        if (missing.length || !sheets.light || !sheets.dark) console.warn(`startup-preload: no chunk for ${missing.join(', ') || '-'}; themes ${JSON.stringify(sheets)}`);
        const script = `<script>(function () {
      var base = ${JSON.stringify(base)}, routes = ${JSON.stringify(map)}, sheets = ${JSON.stringify(sheets)};
      var route = location.pathname.slice(location.pathname.indexOf(base) === 0 ? base.length : 1).split('/')[0] || ${JSON.stringify(defaultRoute)};
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      function add(rel, file, as) { if (!file) return; var link = document.createElement('link'); link.rel = rel; link.href = base + file; if (as) link.as = as; document.head.appendChild(link); }
      add('preload', dark ? sheets.dark : sheets.light, 'style');
      (routes[route] || []).forEach(function (file) { add('modulepreload', file); });
    })();</script>`;
        // Before any stylesheet link: a browser holds an inline script until the stylesheets above it have
        // loaded, which would delay these preloads by a whole round trip. index.html marks the place, right
        // after the theme script (the preloads need its data-theme).
        const marker = '<!-- startup-preload -->';
        return html.includes(marker) ? html.replace(marker, script) : html.replace(/<link rel="stylesheet"|<script type="module"/, match => `${script}\n    ${match}`);
      }
    }
  };
}
