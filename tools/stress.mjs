// Worst case: every activity with the particle pool near full and many fingers.
import pkg from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
const { chromium } = pkg;
const ROOT = resolve(import.meta.dirname, '..');
const T = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg' };
const server = await new Promise(ok => { const s = createServer(async (req,res)=>{ try{ let p=new URL(req.url,'http://x').pathname; if(p==='/')p='/index.html'; const b=await readFile(join(ROOT,p)); res.writeHead(200,{'content-type':T[extname(p)]||'application/octet-stream'}); res.end(b);}catch{res.writeHead(404).end();} }); s.listen(8139,()=>ok(s)); });
const b = await chromium.launch({ headless:true, args:['--mute-audio'] });
const ctx = await b.newContext({ viewport:{width:1180,height:820}, deviceScaleFactor:2, hasTouch:true });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8139/index.html');
await page.waitForFunction(()=>!!window.game);
await page.mouse.click(590,590);
await page.waitForFunction(()=>window.game.engine.scene?.phase==='ready',null,{timeout:25000});
await page.mouse.click(590,590);
await page.waitForTimeout(1000);
for (const id of ['balloons','animals','music','shapes','paint','ocean','hub']) {
  if (id==='hub') await page.evaluate(()=>window.game.goHub()); else await page.evaluate(s=>window.game.goScene(s), id);
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const s = window.game.engine.scene;
    const C = ['#ff5d5d','#ffd93d','#57c7ff','#a8e05f','#ff87c4'];
    // flood the pool, then keep it topped up while measuring
    for (let i=0;i<40;i++) s.p.confetti(Math.random()*1180, Math.random()*820, C, 26, 400);
    let n=0; const t0=performance.now();
    await new Promise(ok=>{const f=()=>{ if(n%12===0) s.p.confetti(Math.random()*1180, Math.random()*820, C, 26, 400); return ++n<120?requestAnimationFrame(f):ok(); };requestAnimationFrame(f);});
    return { fps: Math.round(n*1000/(performance.now()-t0)), live: s.p.live, dpr: window.game.engine.dpr.toFixed(2), q: window.game.engine.quality.toFixed(2) };
  });
  console.log(`${id.padEnd(10)} ${String(r.fps).padStart(3)}fps  ${String(r.live).padStart(4)} particles  dpr ${r.dpr} quality ${r.q}`);
}
await b.close(); server.close();
