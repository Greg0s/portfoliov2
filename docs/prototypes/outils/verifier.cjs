// Checks a component of the Claude Design canvas (.dc.html) outside the canvas: evaluates its script with a stub runtime,
// calls renderVals for each set of props and lists the template's holes that renderVals leaves undefined.
// Usage: node verifier.cjs <component.dc.html> ['<props as JSON>' ...]
const fs = require('fs');

const [file, ...propSets] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node verifier.cjs <component.dc.html> ['<props as JSON>' ...]");
  process.exit(1);
}
const html = fs.readFileSync(file, 'utf8');
const script = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (!script) {
  console.error('No <script type="text/x-dc"> in ' + file);
  process.exit(1);
}

global.window = { matchMedia: () => ({ matches: false }) };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
class DCLogic {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }
  setState(s) {
    Object.assign(this.state, typeof s === 'function' ? s(this.state) : s);
  }
}
const Component = new Function('DCLogic', script[1] + '\nreturn Component;')(DCLogic);

// Holes like {{ false }} are literal placeholder values, and loop variables come from <sc-for as="…">.
const literal = (h) => /^(true|false|null|undefined|\d+)$/.test(h);
const holes = new Set([...html.matchAll(/\{\{\s*([\w$]+)/g)].map((x) => x[1]).filter((h) => !literal(h)));
const loopVars = new Set([...html.matchAll(/as="(\w+)"/g)].map((x) => x[1]));

let failed = false;
for (const ps of propSets.length ? propSets : ['{}']) {
  try {
    const vals = new Component(JSON.parse(ps)).renderVals();
    const missing = [...holes].filter((h) => !(h in vals) && !loopVars.has(h));
    console.log(ps, missing.length ? 'missing holes: ' + missing.join(', ') : 'ok');
    if (missing.length) failed = true;
  } catch (e) {
    console.log(ps, 'ERROR', e.message);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
