// Steps through the contact actions of Bureau (the copy button on desktop, the bubble on phones) with a stub runtime.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const script = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
let raf = [];
let timers = [];
global.window = { matchMedia: () => ({ matches: false }) };
global.requestAnimationFrame = (f) => { raf.push(f); return raf.length; };
global.cancelAnimationFrame = () => { raf = []; };
global.setTimeout = (f, ms) => { timers.push({ f, ms }); return timers.length; };
global.clearTimeout = () => {};
global.setInterval = () => 0;
global.clearInterval = () => {};
const copies = [];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: (t) => { copies.push(t); return Promise.resolve(); } } } });
class DCLogic { constructor(p) { this.props = p || {}; this.state = {}; } setState(s) { Object.assign(this.state, typeof s === 'function' ? s(this.state) : s); } }
const Component = new Function('DCLogic', script + '\nreturn Component;')(DCLogic);
const flush = () => { const q = raf; raf = []; q.forEach((f) => f(16)); };
const runTimers = (ms) => { const due = timers.filter((t) => t.ms === ms); timers = timers.filter((t) => t.ms !== ms); due.forEach((t) => t.f()); };
let failed = 0;
const check = (label, ok, extra) => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + label + (extra ? ' ' + JSON.stringify(extra) : '')); if (!ok) failed++; };

// Address 290 px wide at (100, 60); its wrapper starts 10 px higher. zoom: the canvas shows it at that scale.
const ev = (x, y, zoom = 1, extra = {}) => {
  const z = zoom;
  const link = {
    getBoundingClientRect: () => ({ left: 100, top: 60, width: 290 * z, height: 30 * z }),
    parentNode: { offsetWidth: 290, getBoundingClientRect: () => ({ left: 100, top: 50, width: 290 * z, height: 40 * z }) },
  };
  return { currentTarget: link, clientX: x, clientY: y, detail: 1, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
};

// Desktop: the address opens the mail app, the icon button beside it copies it.
let c = new Component({ mode: 'Ordinateur' });
let v = c.renderVals();
check('desktop: copy icon shown, check hidden, nothing announced', v.copyIconOp === 1 && v.checkIconOp === 0 && v.copiedMsg === '');
v.copy();
v = c.renderVals();
check('click: address copied, check shown, announced', copies.length === 1 && copies[0] === 'contact@gregoiretinn.es' && v.copyIconOp === 0 && v.checkIconOp === 1 && v.checkIconS === 1 && v.copiedMsg === 'Adresse copiée');
runTimers(1800);
v = c.renderVals();
check('back to the copy icon after 1.8 s', v.copyIconOp === 1 && v.checkIconOp === 0 && v.copiedMsg === '');
v.showMail();
check('hover: mail preview on the screen', c.state.preview === 'Email');
v.hide();
runTimers(600);
check('leave: preview cleared after 0.6 s', c.state.preview === '');
c = new Component({ mode: 'Ordinateur', contact: 'Pastilles' });
v = c.renderVals();
check('an old trial value changes nothing', v.copyIconOp === 1 && !('cPills' in v) && !('cSplit' in v));

// Phone: always the bubble, whatever the desktop trial says.
c = new Component({ mode: 'Mobile' });
v = c.renderVals();
check('phone: bubble closed at first', v.menuVis === 'hidden' && v.menuOpen === 'false' && !v.bubbleCatch);
v.toggleMenu();
v = c.renderVals();
check('tap: bubble open, outside layer on', v.menuOp === 1 && v.menuVis === 'visible' && v.bubbleCatch && v.menuOpen === 'true');
v.closeMenu();
v = c.renderVals();
check('tap outside closes it', !v.bubbleCatch && v.menuOp === 0);
v.toggleMenu();
v.menuCopy();
v = c.renderVals();
check('Copier: copied, still open', v.copyWord === 'Copié' && c.state.menu === true);
runTimers(900);
check('then it closes after 0.9 s', c.state.menu === false);
c.state.menu = true;
c.componentDidUpdate({ mode: 'Mobile', arrival: 1 });
check('stays open while the office is in view', c.state.menu === true);
c.props = { mode: 'Mobile', arrival: 0.6 };
c.componentDidUpdate({ mode: 'Mobile', arrival: 1 });
check('closes when the visitor scrolls back', c.state.menu === false);
c = new Component({ mode: 'Mobile', bare: true });
c.renderVals().toggleMenu();
check('no outside layer on the bare boards', !c.renderVals().bubbleCatch);
c = new Component({ mode: 'Mobile' });
c.state.menu = true;
c.props = { mode: 'Ordinateur' };
c.componentDidUpdate({ mode: 'Mobile' });
check('switching to desktop closes the bubble', c.state.menu === false);
console.log(failed ? failed + ' failed' : 'all good');
