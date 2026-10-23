// Steps through the wall pictures of Bureau (draw, overlays, labels on hover and tap) with a stub runtime.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const script = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
global.window = { matchMedia: () => ({ matches: false }) };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.setTimeout = () => 0;
global.clearTimeout = () => {};
global.setInterval = () => 0;
global.clearInterval = () => {};
class DCLogic { constructor(p) { this.props = p || {}; this.state = {}; } setState(s) { Object.assign(this.state, typeof s === 'function' ? s(this.state) : s); } }
const Component = new Function('DCLogic', script + '\nreturn Component;')(DCLogic);
let failed = 0;
const check = (label, ok, extra) => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + label + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!ok) failed++; };

// The draw: each frame draws from its own pictures; with several, never the same one twice in a row.
let c0 = new Component({});
check('each frame draws one of its own pictures', Object.entries(c0.art().frames).every(([id, f]) => c0.state.pick[id] >= 0 && c0.state.pick[id] < f.pool.length));
c0.art().frames.photo.pool = [{ src: 'a' }, { src: 'b' }, { src: 'c' }];
let repeats = 0;
let seen = new Set();
let last = c0.draw();
for (let i = 0; i < 600; i++) {
  const next = c0.draw(last);
  if (next.photo === last.photo) repeats++;
  seen.add(next.photo);
  last = next;
}
check('a frame with several pictures changes at each draw, through all of them', repeats === 0 && seen.size === 3);

// Desktop.
let c = new Component({ mode: 'Ordinateur' });
let v = c.renderVals();
check('desktop: six pictures on the wall, one on the desk; no label for the wave on the desk, whose credits are unknown', v.wall.length === 6 && v.onDesk.length === 1 && v.tags.length === 6 && !v.tags.some((t) => t.id === 'bureau'));
check('each picture has an image, a matrix and a focus', v.wall.concat(v.onDesk).every((t) => /^\/_blob\/[0-9a-f]{32}$/.test(t.src) && /^matrix3d\(/.test(t.tf) && /%/.test(t.focus)));
check('boxes in the format of their frame', v.wall.concat(v.onDesk).every((t) => Math.abs(t.w / t.h - { film: 16 / 9, peinture: 3 / 2, affiche: 2 / 3, photo: 0.8, 'photo-paysage': 4 / 3, pochette: 1, bureau: 0.8 }[t.id]) < 0.02));
const by = (id) => v.tags.find((t) => t.id === id);
check('labels hidden at first, hover areas live', v.tags.every((t) => t.op === 0) && v.tagPE === 'auto');
check('Nighthawks: title in italics, then author and year', by('peinture').main === 'Nighthawks' && by('peinture').mainStyle === 'italic' && by('peinture').sub === 'Edward Hopper, 1942' && by('peinture').kind === 'Peinture');
check('album cover: Drivin Thru the Night, Petit Biscuit, 2020', by('pochette').main === 'Drivin Thru the Night' && by('pochette').mainStyle === 'italic' && by('pochette').sub === 'Petit Biscuit, 2020' && !by('pochette').hasNote);
check('landscape photo: Earthrise with its processing note', by('photo-paysage').main === 'Earthrise' && by('photo-paysage').sub === 'Bill Anders, Apollo 8 (NASA), 1968' && by('photo-paysage').noteLead === 'Traitement : ' && by('photo-paysage').noteText === 'Jim Weigang');
check('wall portrait: the umbrella, only its author known, upright, nothing else', by('photo').main === 'Liam Wong' && by('photo').mainStyle === 'normal' && !by('photo').hasSub && !by('photo').hasNote);
check('films under their French title, the original below', by('film').kind === 'Image de film' && by('affiche').kind === 'Affiche de film' && by('affiche').main === 'Projet Dernière Chance' && by('affiche').sub === 'Phil Lord et Christopher Miller, 2026' && by('affiche').noteText === 'Project Hail Mary' && by('film').noteText === 'Spider-Man: Into the Spider-Verse');
check('nowhere a placeholder credit', !v.tags.some((t) => /préciser/.test(t.main + t.sub)));
check('no tap on desktop', v.tags.every((t) => t.tap === null));
by('peinture').enter();
v = c.renderVals();
check('hover: the painting label shows, alone', by('peinture').op === 1 && by('peinture').y === 0 && v.tags.filter((t) => t.op === 1).length === 1);
by('affiche').leave();
check('leaving another picture keeps it', c.state.cartel === 'peinture');
by('peinture').leave();
v = c.renderVals();
check('leave: it hides, quicker than it showed', v.tags.every((t) => t.op === 0) && by('peinture').dur === 140 && by('peinture').y === 4);
check('labels stay on screen', v.tags.every((t) => Number(t.tl) >= 16 && Number(t.tl) <= 1440 - 266));
c.state.cartel = 'film';
c.props = { mode: 'Ordinateur', arrival: 0.9 };
v = c.renderVals();
check('during the arrival: no label, no hover areas', v.tags.every((t) => t.op === 0) && v.tagPE === 'none');
c.componentDidUpdate({ mode: 'Ordinateur', arrival: 1 });
check('scrolling back closes the label', c.state.cartel === '');
c = new Component({ mode: 'Ordinateur', still: true });
c.state.cartel = 'film';
v = c.renderVals();
check('still boards: no label, no hover areas', v.tags.every((t) => t.op === 0) && v.tagPE === 'none');

// Phone.
c = new Component({ mode: 'Mobile' });
v = c.renderVals();
check('phone: no picture on the wall, the desk frame only, the wave without a label', v.wall.length === 0 && v.onDesk.length === 1 && v.tags.length === 0);
// With credits given to the desk frame's picture, its label works by tap.
c.art().frames.bureau.pool = [{ src: '/_blob/00000000000000000000000000000000', author: 'Test' }];
v = c.renderVals();
check('phone, with credits: one label, for the desk frame', v.tags.length === 1 && v.tags[0].id === 'bureau');
check('phone: tap only, label above the frame', v.tags[0].enter === null && v.tags[0].leave === null && typeof v.tags[0].tap === 'function' && v.tags[0].lift === '-100%');
v.tags[0].tap();
v = c.renderVals();
check('tap: label shown, outside layer on', v.tags[0].op === 1 && v.bubbleCatch === true);
v.tags[0].tap();
v = c.renderVals();
check('tap again: hidden', v.tags[0].op === 0 && !v.bubbleCatch);
v.tags[0].tap();
v = c.renderVals();
v.closeAll();
v = c.renderVals();
check('tap outside closes it', v.tags[0].op === 0 && !v.bubbleCatch);
v.tags[0].tap();
c.renderVals().toggleMenu();
v = c.renderVals();
check('the address bubble closes the label', c.state.cartel === '' && c.state.menu === true);
v.tags[0].tap();
check('a tap on the frame closes the bubble', c.state.cartel === 'bureau' && c.state.menu === false);
c.props = { mode: 'Ordinateur' };
c.componentDidUpdate({ mode: 'Mobile' });
check('changing the frame closes the label', c.state.cartel === '');
c = new Component({ mode: 'Mobile', bare: true });
c.art().frames.bureau.pool = [{ src: '/_blob/00000000000000000000000000000000', author: 'Test' }];
c.renderVals().tags[0].tap();
check('no outside layer on the bare boards', !c.renderVals().bubbleCatch);

console.log(failed ? failed + ' failed' : 'all good');
process.exit(failed ? 1 : 0);
