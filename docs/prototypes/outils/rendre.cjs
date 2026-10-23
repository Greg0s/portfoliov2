// Renders a component of the Claude Design canvas (.dc.html) to a static HTML page, to look at it outside the canvas.
// Usage: node rendre.cjs <component.dc.html> '<props as JSON>' <out.html> [--blobs=<dir>] [--state='<JSON>'] [--reduce]
// Covers holes, <sc-if>, <sc-for> and <dc-import> (imported components are looked up next to the first one). Event
// handlers and refs are dropped and timers never run, so the page shows the first frame, without live animations.
// Images published on the canvas (/_blob/<id>) are taken from --blobs, a folder of files named after their id, as the
// Artifact tool saves them; it must sit under the folder that photographier.cjs serves. --state merges into the first
// component's state; --reduce answers "prefers-reduced-motion" with yes.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : true];
    })
);
const [file, propsJson, out] = args.filter((a) => !a.startsWith('--'));
if (!file || !propsJson || !out) {
  console.error("Usage: node rendre.cjs <component.dc.html> '<props as JSON>' <out.html> [--blobs=<dir>] [--state='<JSON>'] [--reduce]");
  process.exit(1);
}

global.window = { matchMedia: () => ({ matches: !!flags.reduce }) };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.performance = { now: () => 0 };
global.setInterval = () => 0;
global.clearInterval = () => {};
global.setTimeout = () => 0;
global.clearTimeout = () => {};
class DCLogic {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }
  setState(s) {
    Object.assign(this.state, typeof s === 'function' ? s(this.state) : s);
  }
}

const get = (scope, p) => p.trim().split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const head = new Set();

function findClose(s, tag, from) {
  let depth = 1;
  let i = from;
  const open = new RegExp('<' + tag + '\\b', 'g');
  const close = new RegExp('</' + tag + '>', 'g');
  while (depth > 0) {
    open.lastIndex = i;
    close.lastIndex = i;
    const o = open.exec(s);
    const c = close.exec(s);
    if (!c) throw new Error('unclosed <' + tag + '>');
    if (o && o.index < c.index) {
      depth++;
      i = o.index + 1;
    } else {
      depth--;
      i = c.index + c[0].length;
      if (depth === 0) return [c.index, i];
    }
  }
}

function component(f, props, first) {
  const html = fs.readFileSync(f, 'utf8');
  const script = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const Component = new Function('DCLogic', script + '\nreturn Component;')(DCLogic);
  const c = new Component(props);
  if (c.componentDidMount) {
    try {
      c.componentDidMount();
    } catch (e) {}
  }
  if (first && flags.state) Object.assign(c.state, JSON.parse(flags.state));
  const vals = c.renderVals();
  const helmet = html.match(/<helmet>([\s\S]*?)<\/helmet>/);
  if (helmet) for (const tag of helmet[1].match(/<link\b[^>]*>|<style\b[\s\S]*?<\/style>/g) || []) head.add(tag);
  const tpl = html.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const dir = path.dirname(f);

  const holes = (s, scope) =>
    s
      .replace(/<dc-import\b([^>]*)><\/dc-import>/g, (m, attrs) => {
        const a = {};
        attrs.replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => {
          a[k] = /^\{\{([^}]*)\}\}$/.test(v) ? get(scope, v.slice(2, -2)) : v;
        });
        const g = path.join(dir, a.name + '.dc.html');
        const p = {};
        for (const [k, v] of Object.entries(a)) if (k !== 'name' && !k.startsWith('hint-')) p[camel(k)] = v;
        return fs.existsSync(g) ? component(g, p, false) : '';
      })
      .replace(/\s(on[A-Z]\w*|ref|hint-[\w-]+)="[^"]*"/g, '')
      .replace(/\{\{([^}]*)\}\}/g, (_, p) => {
        const v = get(scope, p);
        return v == null ? '' : String(v);
      });

  const render = (s, scope) => {
    let o = '';
    let i = 0;
    const re = /<(sc-for|sc-if)\b([^>]*)>/g;
    let m;
    while ((m = re.exec(s))) {
      o += holes(s.slice(i, m.index), scope);
      const [bodyEnd, end] = findClose(s, m[1], m.index + m[0].length);
      const body = s.slice(m.index + m[0].length, bodyEnd);
      const attr = (n) => (m[2].match(new RegExp(n + '="\\{\\{([^}]*)\\}\\}"')) || [])[1];
      if (m[1] === 'sc-for') {
        const as = (m[2].match(/as="(\w+)"/) || [])[1];
        for (const item of get(scope, attr('list')) || []) o += render(body, { ...scope, [as]: item });
      } else if (get(scope, attr('value'))) {
        o += render(body, scope);
      }
      i = end;
      re.lastIndex = end;
    }
    return o + holes(s.slice(i), scope);
  };
  return render(tpl, vals);
}

const outDir = path.dirname(path.resolve(out));
const blobs = flags.blobs ? fs.readdirSync(path.resolve(flags.blobs)) : [];
const missing = new Set();
const body = component(path.resolve(file), JSON.parse(propsJson), true).replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => {
  const found = blobs.find((n) => n.startsWith(id));
  if (!found) {
    missing.add(id);
    return m;
  }
  return path.relative(outDir, path.join(path.resolve(flags.blobs), found)).split(path.sep).join('/');
});
fs.writeFileSync(
  out,
  '<!doctype html><html><head><meta charset="utf-8">' + [...head].join('') + '<style>body{margin:0;background:#000}</style></head><body>' + body + '</body></html>'
);
console.log('written', out);
if (missing.size) console.log('images not in --blobs:', [...missing].join(', '));
process.exit(0);
