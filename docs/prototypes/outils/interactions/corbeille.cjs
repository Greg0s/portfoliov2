// Steps through the recycle bin: the screen's dialog (Ecran), the cut and the new draw (Bureau), the shared veil (Main).
const fs = require('fs');
const dir = process.argv[2];
const load = (name) => fs.readFileSync(dir + '/' + name + '.dc.html', 'utf8').match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
let raf = [];
global.window = { matchMedia: () => ({ matches: false }) };
global.requestAnimationFrame = (f) => { raf.push(f); return raf.length; };
global.cancelAnimationFrame = () => {};
let timers = [];
global.setTimeout = (f, ms) => { timers.push({ f, ms }); return timers.length; };
const runTimers = (ms) => { const due = timers.filter((t) => t.ms === ms); timers = timers.filter((t) => t.ms !== ms); due.forEach((t) => t.f()); };
global.clearTimeout = () => {};
global.setInterval = () => 0;
global.clearInterval = () => {};
class DCLogic { constructor(p) { this.props = p || {}; this.state = {}; } setState(s) { Object.assign(this.state, typeof s === 'function' ? s(this.state) : s); } }
const make = (name) => new Function('DCLogic', load(name) + '\nreturn Component;')(DCLogic);
const Ecran = make('Ecran');
const Bureau = make('Bureau');
const Main = make('Main');
const flush = () => { while (raf.length) { const q = raf; raf = []; q.forEach((f) => f(16)); } };
let failed = 0;
const check = (label, ok, extra) => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + label + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!ok) failed++; };

// Ecran: the icon and its dialog.
let e = new Ecran({});
let v = e.renderVals();
check('board alone: the bin answers, dialog hidden', v.binPE === 'auto' && v.dlgOp === 0 && v.dlgVis === 'hidden' && v.img.bin === '/_blob/80b3380bf07ebd40a1d2a8f9697f305c');
v.binIn();
v = e.renderVals();
check('hover: a light frame around the icon', v.binBg === 'rgba(255, 255, 255, 0.12)');
v.binClick();
v = e.renderVals();
check('click: the dialog opens in the middle, the icon stays selected', v.dlgOp === 1 && v.dlgVis === 'visible' && v.dlgPE === 'auto' && v.binBg === 'rgba(140, 200, 255, 0.24)');
v.binNo();
check('« Non » closes it', e.renderVals().dlgOp === 0);
e.renderVals().binClick();
e.renderVals().binYes();
runTimers(450);
v = e.renderVals();
check('board alone: « Oui » then the message, with its single « Ok »', v.dlgOp === 0 && v.doneOp === 1 && v.doneVis === 'visible' && v.binPE === 'none');
v.binOk();
check('« Ok » closes the message', e.renderVals().doneOp === 0 && e.renderVals().binPE === 'auto');
let calls = 0;
e = new Ecran({ page: '', still: '', onEmpty: () => calls++ });
v = e.renderVals();
check('in the office at rest: the bin answers', v.binPE === 'auto');
v.binClick();
e.renderVals().yesIn();
check('« Oui » lights up under the mouse', e.renderVals().yesBg === '#5BBDEA');
e.renderVals().binYes();
v = e.renderVals();
check('« Oui »: the office is told once, the dialog closes', calls === 1 && v.dlgOp === 0);
e.renderVals().binClick();
e.props = { page: '', still: '', onEmpty: () => calls++, round: 1 };
e.componentDidUpdate({ page: '', round: 0 });
v = e.renderVals();
check('a new draw closes the dialog, no message yet', e.state.binOpen === false && v.doneOp === 0);
runTimers(450);
v = e.renderVals();
check('0.45 s later, the scene back: the message, and the bin waits', v.doneOp === 1 && v.donePE === 'auto' && v.binPE === 'none');
v.okIn();
check('« Ok » lights up under the mouse', e.renderVals().okBg === '#5BBDEA');
e.renderVals().binOk();
check('« Ok »: back to the desktop, the bin answers again', e.renderVals().doneOp === 0 && e.renderVals().binPE === 'auto');
check('a window over the desktop: the bin does not answer', new Ecran({ page: 'LinkedIn', onEmpty: () => {} }).renderVals().binPE === 'none');
check('no handler (phone, arrival, boards): the bin does not answer', new Ecran({ page: '', still: '' }).renderVals().binPE === 'none' && new Ecran({ still: 'true' }).renderVals().binPE === 'none');

// Bureau: who gets the handler.
check('desktop at rest: the screen gets the handler', typeof new Bureau({ mode: 'Ordinateur' }).renderVals().binEmpty === 'function');
check('phone, arrival or still: no handler', new Bureau({ mode: 'Mobile' }).renderVals().binEmpty === null && new Bureau({ arrival: 0.9 }).renderVals().binEmpty === null && new Bureau({ still: true }).renderVals().binEmpty === null);

// Bureau alone: its own veil.
let b = new Bureau({ mode: 'Ordinateur' });
const anims = [];
b.els.veil = { animate: (frames, opts) => { const a = { frames, opts, cancel() {} }; anims.push(a); return a; } };
b.state.cartel = 'film';
const before = b.state.round;
b.emptyBin();
b.emptyBin();
check('alone: the veil darkens in 0.25 s, once even on a double click', anims.length === 1 && anims[0].opts.duration === 250 && anims[0].frames[1].opacity === 1 && b.state.veil === true && b.state.round === before);
anims[0].onfinish();
check('in the dark: new draw, label closed, fresh desktop', b.state.round === before + 1 && b.state.cartel === '');
flush();
check('then it lifts in 0.35 s', anims.length === 2 && anims[1].opts.duration === 350 && anims[1].frames[1].opacity === 0);
anims[1].onfinish();
check('and lets go of the pointer', b.state.veil === false && b.renderVals().veilPE === 'none');

// Bureau in the journey: the journey's veil takes over.
b = new Bureau({ mode: 'Ordinateur', embedded: true });
let asked = null;
b.els.root = { dispatchEvent: (ev) => { if (ev.type === 'b612cut' && ev.bubbles) { ev.detail.handled = true; asked = ev.detail; } return true; } };
b.els.veil = { animate: () => { throw new Error('own veil used'); } };
b.emptyBin();
check('in the journey: the cut is handed to the journey, nothing drawn yet', asked && b.state.round === 0 && !b.state.veil);
asked.inDark();
check('drawn when the journey is dark', b.state.round === 1);

// Main: the shared cut.
const m = new Main({});
let dark = 0;
const ev = { detail: { handled: false, inDark: () => dark++ } };
m.onCut(ev);
check('the journey takes the cut and, without a veil, draws at once', ev.detail.handled === true && dark === 1);
const mAnims = [];
m.veil = { animate: (frames, opts) => { const a = { frames, opts, cancel() {} }; mAnims.push(a); return a; } };
const ev2 = { detail: { handled: false, inDark: () => dark++ } };
m.onCut(ev2);
check('with its veil: 0.25 s to black first', mAnims.length === 1 && mAnims[0].opts.duration === 250 && dark === 1 && m.cutting === true);
mAnims[0].onfinish();
flush();
mAnims[1].onfinish();
check('then the office draws, and the veil lifts in 0.35 s', dark === 2 && mAnims[1].opts.duration === 350 && m.cutting === false);
let landed = null;
m.land = (u) => { landed = u; };
m.veil = null;
m.navigate('projets');
check('header links still land through the same cut', landed !== null && Math.abs(landed - m.plateau(0)) < 1e-9);

console.log(failed ? failed + ' failed' : 'all good');
process.exit(failed ? 1 : 0);
