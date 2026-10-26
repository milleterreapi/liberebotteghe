/* =====================================================================
   Libere Botteghe — «La piazza»
   Una piazza disegnata dal vivo: le botteghe vere in fila, la fontana,
   i lampioni, il traffico sulla strada, il cielo che segue l'ora vera
   (alba, giorno, tramonto, notte) e gli omini delle persone collegate
   in questo momento (presenza in tempo reale, senza nomi per i visitatori).
   Nessuna libreria: un solo <canvas>.
   ===================================================================== */
(function(){
"use strict";
const TAU = Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
const RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : {matches:false};
function hash(s){ let h=2166136261; s=String(s); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rng(seed){ let x=(seed>>>0)||1; return ()=>{ x^=x<<13; x>>>=0; x^=x>>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
const R = Math.random;
const pick = (a,r=R)=>a[Math.floor(r()*a.length)];
function c3(h){ h=String(h).replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join(""); const n=parseInt(h,16); return [n>>16&255,n>>8&255,n&255]; }
const mx=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const css=(a,al)=>al==null?`rgb(${a[0]|0},${a[1]|0},${a[2]|0})`:`rgba(${a[0]|0},${a[1]|0},${a[2]|0},${al})`;
const shade=(h,t)=>css(mx(c3(h), t<0?[0,0,0]:[255,255,255], Math.abs(t)));

/* ---------- il sole vero (formula astronomica semplificata) ---------- */
function sunAt(date, lat, lon){
  const r=Math.PI/180, n=(date.getTime()-946728000000)/864e5;
  const L=(280.46+0.9856474*n)%360, g=((357.528+0.9856003*n)%360)*r;
  const lam=(L+1.915*Math.sin(g)+0.02*Math.sin(2*g))*r, eps=(23.439-4e-7*n)*r;
  const ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam)), dec=Math.asin(Math.sin(eps)*Math.sin(lam));
  const gmst=((18.697374558+24.06570982441908*n)%24+24)%24;
  const H=(gmst*15+lon)*r-ra, la=lat*r;
  const el=Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(H));
  const az=Math.atan2(-Math.sin(H), Math.tan(dec)*Math.cos(la)-Math.sin(la)*Math.cos(H));
  return { el:el/r, az:((az/r)+360)%360 };
}
const fmtRome = new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit",hour12:false});
function romeHM(d){ const p=fmtRome.formatToParts(d); const h=+p.find(x=>x.type==="hour").value%24, m=+p.find(x=>x.type==="minute").value; return h*60+m; }

/* ---------- stato (sopravvive ai ridisegni della pagina) ---------- */
const G = {
  host:null, cv:null, ctx:null, ui:null, opts:null, raf:0, last:0, visible:true,
  vw:0, H:0, U:1, dpr:1, W:0, camX:0, camT:null, vel:0, drag:null,
  shops:[], items:[], lamps:[], benches:[], fountain:null, skyline:[], stars:[], clouds:[],
  npcs:[], cars:[], birds:[], peers:new Map(), me:null, sel:null,
  tOff:0, play:false, hint:true, lastPub:0, pubTimer:0, t:0, carT:2, layoutKey:"", adT:5, planeT:6, planes:[], adIdx:0, planeIdx:0
};
const T = s => (G.opts && G.opts.t) ? G.opts.t(s) : s;

const SKIN=["#f1c7a5","#e0ac87","#c98e66","#a86f4c","#7b4f35","#f5d5bb"];
const HAIR=["#2b1d14","#4a3122","#7a4b2a","#b07a3c","#d9b46a","#1b1b1b","#8f8f8f"];
const CLOTH=["#1f6b88","#c8372d","#5c7a2e","#e3b21b","#7a5cb8","#1489a3","#d0663a","#3c4a5e","#b85c7a","#2f8a6a"];
const PANTS=["#2f3a4a","#3b3226","#5a4a3a","#24324a","#6b5b4a"];
const CARS=["#c8372d","#f1c232","#1f6b88","#e8e2d4","#5c7a2e","#7fb2c8","#2f2f35","#d97a3a"];

/* ---------- impaginazione della piazza ---------- */
function layout(){
  const o=G.opts, vw=G.vw, H=G.H, U=G.U=H/400;
  const yB=G.yB=H*0.60, yC=G.yC=H*0.80;
  G.yR=H*0.835; G.lane=[H*0.885, H*0.958];
  const sh=H*0.40, sw=Math.round(sh*0.92), fw=Math.round(sw*0.42);
  const items=[]; let x=U*26;
  const list=(o.shops||[]).slice(0,60);
  list.forEach((s,i)=>{
    if (i>0 && i%2===0){ items.push({type:"palazzo", x, w:fw, h:H*0.47, seed:hash(s.id+"p")}); x+=fw; }
    items.push({type:"shop", x, w:sw, h:sh, s, seed:hash(s.id)}); x+=sw+U*6;
  });
  if (o.free){ items.push({type:"palazzo", x, w:fw, h:H*0.47, seed:7}); x+=fw; items.push({type:"free", x, w:sw, h:sh, seed:11}); x+=sw; }
  items.push({type:"palazzo", x, w:fw, h:H*0.47, seed:3}); x+=fw;
  const W=G.W=Math.max(vw, x+U*26);
  if (x+U*26 < vw){ const shift=(vw-(x+U*26))/2; items.forEach(it=>it.x+=shift); }
  G.items=items;
  /* lampioni sul bordo della strada, panchine, fontana */
  G.lamps=[]; for(let lx=U*90; lx<W; lx+=Math.max(U*230, vw*0.42)) G.lamps.push({x:lx});
  G.fountain={ x: W>vw*1.6 ? W*0.5 : vw*0.62, y:lerp(yB,yC,0.55), r:U*44 };
  G.benches=[]; G.lamps.forEach((l,i)=>{ if(i%2===1 && Math.abs(l.x-G.fountain.x)>U*90) G.benches.push({x:l.x+U*38}); });
  /* sfondo lontano: colline, campanile, cupole, palme */
  const r=rng(99), sk=[]; const span=W*0.35+vw+200;
  for(let bx=-40; bx<span; ){ const k=r(); const w=U*(28+r()*50);
    if (k<0.14) sk.push({k:"campanile", x:bx, w:U*24, h:U*(120+r()*30)});
    else if (k<0.26) sk.push({k:"cupola", x:bx, w:U*70, h:U*(70+r()*20)});
    else if (k<0.38) sk.push({k:"palma", x:bx, w:U*20, h:U*(70+r()*30)});
    else sk.push({k:"casa", x:bx, w, h:U*(40+r()*55)});
    bx+= (sk[sk.length-1].w) + U*(r()*14); }
  G.skyline=sk;
  if (!G.stars.length){ const r2=rng(5); for(let i=0;i<90;i++) G.stars.push({x:r2(), y:r2()*0.5, s:r2()*1.3+0.4, p:r2()*TAU}); }
  if (!G.clouds.length){ for(let i=0;i<5;i++) G.clouds.push({x:R(), y:0.06+R()*0.22, s:0.6+R()*0.8, v:0.004+R()*0.006}); }
  if (G.camX>W-vw) G.camX=Math.max(0,W-vw);
  /* il tuo omino */
  if (!G.me){ G.me=mkOmino({real:true, me:true, kind:o.me.kind}); if (o.me.c) G.me.c=o.me.c; const fx=clamp(G.camX+vw*(0.32+R()*0.3),20,W-20);
    G.me.x=G.me.tx=fx; G.me.y=G.me.ty=lerp(yB+U*14, yC-U*8, 0.45+R()*0.4); if (o.me.kind==="a") placeAtShop(G.me, o.me.shop); }
  G.me.c=o.me.c||G.me.c; G.me.kind=o.me.kind;
  if (!G.birds.length) for(let i=0;i<6;i++) G.birds.push(mkBird());
}
function shopItem(id){ return G.items.find(it=>it.type==="shop" && it.s.id===id); }
function doorOf(it){ return it.x + it.w*0.74; }
function placeAtShop(o, id){ const it=shopItem(id); if(!it) return; o.x=o.tx=doorOf(it)+G.U*16; o.y=o.ty=G.yB+G.U*12; }
function floorY(f){ return lerp(G.yB+G.U*10, G.yC-G.U*6, clamp(f,0,1)); }
function floorF(y){ return clamp((y-(G.yB+G.U*10))/((G.yC-G.U*6)-(G.yB+G.U*10)),0,1); }

function mkOmino(p){
  const r=p.seed!=null?rng(p.seed):R;
  return Object.assign({ x:0,y:0,tx:0,ty:0, ph:r()*TAU, sp:(16+r()*12), wait:0, mv:false, dir:1,
    c:pick(CLOTH,r), skin:pick(SKIN,r), hair:pick(HAIR,r), pants:pick(PANTS,r), hat:r()<0.18, bag:r()<0.3, dog:r()<0.07, kid:r()<0.12, al:1 }, p);
}
function mkBird(){ return { x:R()*G.W, y:lerp(G.yB+G.U*20,G.yC-G.U*6,R()), ph:R()*TAU, fly:0, vx:0, vy:0, away:0 }; }

/* ---------- quanta gente a quest'ora ---------- */
function crowdAt(min){ const h=min/60;
  if (h<6) return 0.15; if (h<8) return 0.45; if (h<12.5) return 0.8; if (h<15.5) return 0.5; if (h<17.5) return 0.75; if (h<21.5) return 1.25; if (h<23.5) return 0.6; return 0.25; }
function trafficAt(min){ const h=min/60; if (h<5.5) return 0.12; if (h<7) return 0.4; if (h<9.5) return 1.2; if (h<13) return 0.8; if (h<15) return 0.9; if (h<19.5) return 1.1; if (h<22) return 0.6; return 0.25; }

function now(){ return new Date(Date.now()+G.tOff); }

/* ---------- aggiornamento ---------- */
function update(dt){
  const U=G.U, min=romeHM(now()), still=RM.matches;
  G.t+=dt;
  if (G.play){ G.tOff += dt*1000*60*48; }           /* una giornata in 30 secondi */
  /* camera */
  if (!G.drag){ if (G.camT!=null){ G.camX=lerp(G.camX,G.camT,Math.min(1,dt*6)); if(Math.abs(G.camX-G.camT)<0.5){ G.camX=G.camT; G.camT=null; } }
    else if (Math.abs(G.vel)>5){ G.camX-=G.vel*dt; G.vel*=Math.pow(0.04,dt); } else G.vel=0; }
  G.camX=clamp(G.camX,0,Math.max(0,G.W-G.vw));
  /* comparse: aumentano e calano con l'ora */
  const want=Math.round(clamp(crowdAt(min)*(G.W/170),2,46));
  const alive=G.npcs.filter(n=>!n.leaving).length;
  if (alive<want && R()<dt*2){ const n=mkOmino({}); const off=R()<0.5; n.x = off ? (G.camX>60?G.camX-30:-20) : (G.camX+G.vw<G.W-60?G.camX+G.vw+30:G.W+20); if(R()<0.35) n.x=R()*G.W; n.y=floorY(R()); n.al=n.x>=G.camX&&n.x<=G.camX+G.vw?0:1; newTarget(n); G.npcs.push(n); }
  if (alive>want+2 && R()<dt){ const n=G.npcs.find(n=>!n.leaving); if(n){ n.leaving=true; n.tx = n.x<G.W/2?-40:G.W+40; n.ty=n.y; n.wait=0; } }
  for (const n of G.npcs){ if(n.al<1) n.al=Math.min(1,n.al+dt*1.5); stepWalker(n,dt,still); if(!n.mv && n.wait<=0 && !n.leaving) newTarget(n); }
  G.npcs=G.npcs.filter(n=>!(n.leaving && (n.x<-30||n.x>G.W+30)));
  /* persone vere */
  stepWalker(G.me,dt,still);
  for (const p of G.peers.values()){ if(p.al<1) p.al=Math.min(1,p.al+dt*1.5); stepWalker(p,dt,still); }
  /* traffico */
  G.carT-=dt; if (!still && G.carT<=0){ spawnCar(); G.carT=(2.2+R()*3.5)/trafficAt(min); }
  /* pubblicità comprata con le monete: camion sulla strada, aerei con lo striscione */
  const ads=G.opts.ads||{}, cam=ads.camion||[], aer=ads.aereo||[];
  G.adT-=dt; if (!still && G.adT<=0){ if (cam.length){ spawnAd(cam[G.adIdx++%cam.length]); G.adT=12+R()*10; } else { spawnAd(null); G.adT=45+R()*30; } }
  G.planeT-=dt; if (!still && G.planeT<=0){ if (light().dark<0.55){ G.planes.push(mkPlane(aer.length?aer[G.planeIdx++%aer.length]:null)); G.planeT=aer.length?16+R()*12:60+R()*40; } else G.planeT=15; }
  for (const p of G.planes) p.x+=p.v*p.dir*dt;
  G.planes=G.planes.filter(p=>p.dir>0 ? p.x-p.bw-G.U*60 < G.vw+40 : p.x+p.bw+G.U*60 > -40);
  for (const c of G.cars){ c.x+=c.v*c.dir*dt; c.wh+=c.v*dt/(c.r||5); }
  G.cars=G.cars.filter(c=>c.dir>0 ? c.x < G.camX+G.vw+c.len+200 : c.x > G.camX-c.len-200);
  /* piccioni: volano via se passa qualcuno */
  for (const b of G.birds){
    if (b.fly){ b.x+=b.vx*dt; b.y+=b.vy*dt; b.vy-=U*30*dt; b.ph+=dt*30; b.fly-=dt; if(b.fly<=0){ Object.assign(b,mkBird()); b.x=G.camX+R()*G.vw; } continue; }
    b.ph+=dt*(2+R()*3);
    const near=[G.me,...G.peers.values(),...G.npcs].some(o=>Math.abs(o.x-b.x)<U*22 && Math.abs(o.y-b.y)<U*12) || G.cars.some(c=>Math.abs(c.x-b.x)<U*30 && b.y>G.yC-U*10);
    if (near && !still){ b.fly=2.2; b.vx=(R()<0.5?-1:1)*U*(60+R()*50); b.vy=-U*(60+R()*30); }
  }
  /* pubblico la mia posizione (al massimo una volta al secondo) */
  if (G.mePending && G.t-G.lastPub>1){ G.lastPub=G.t; G.mePending=false; publish(); }
}
function stepWalker(o,dt,still){
  if (o.wait>0){ o.wait-=dt; o.mv=false; return; }
  const dx=o.tx-o.x, dy=o.ty-o.y, d=Math.hypot(dx,dy);
  if (d<1.5){ o.mv=false; if(o.arrive){ const f=o.arrive; o.arrive=null; f(); } return; }
  if (still){ o.x=o.tx; o.y=o.ty; o.mv=false; return; }
  const sp=o.sp*G.U*(o.me&&d>G.U*200?2.2:1)*(o.kid?1.15:1);
  const st=Math.min(d, sp*dt); o.x+=dx/d*st; o.y+=dy/d*st; o.mv=true; o.ph+=dt*sp/G.U*0.42; if(Math.abs(dx)>0.5) o.dir=dx>0?1:-1;
}
function newTarget(n){
  const U=G.U;
  if (R()<0.4){ const shops=G.items.filter(it=>it.type!=="palazzo"); const it=pick(shops); if(it){ n.tx=it.x+it.w*(0.25+R()*0.5); n.ty=G.yB+U*(10+R()*6); n.wait=0; n.arrive=()=>{ n.wait=2+R()*5; }; return; } }
  let tx=clamp(n.x+(R()-0.5)*G.vw*0.9, 10, G.W-10), ty=floorY(R());
  const f=G.fountain; if (Math.hypot(tx-f.x,(ty-f.y)*2)<f.r*1.25){ ty = ty<f.y ? f.y-f.r*0.7 : f.y+f.r*0.7; ty=clamp(ty,floorY(0),floorY(1)); }
  n.tx=tx; n.ty=ty; n.arrive=()=>{ n.wait=R()<0.5?0.5+R()*3:0; };
}
function spawnAd(shop){
  const U=G.U, dir=R()<0.5?1:-1, sc=dir<0?1.18:1.05, len=U*150*sc;
  const x = dir>0 ? G.camX-len-40 : G.camX+G.vw+len+40;
  G.cars.push({type:"adtruck", shop, dir, x, v:U*46*(0.9+R()*0.2), len, sc, y:dir>0?G.lane[0]:G.lane[1], wh:0, r:6});
}
function mkPlane(shop){
  const U=G.U, dir=R()<0.5?1:-1, txt = shop ? shop.nome : T("Libere Botteghe · fatto a mano in Italia");
  const fs=Math.round(U*13); G.ctx.font=`${fs}px Gloock, Georgia, serif`;
  const bw=Math.min(G.vw*0.8, G.ctx.measureText(txt).width+U*30), bh=U*24;
  return { shop, txt, fs, bw, bh, dir, y:Math.max(G.H*0.13, 78)+R()*G.H*0.05, v:Math.max(40, G.vw/16), x: dir>0 ? -U*60 : G.vw+U*60, ph0:R()*TAU, house:!shop };
}
function spawnCar(){
  const U=G.U, k=R(); const dir=R()<0.5?1:-1;
  const type = k<0.5?"auto":k<0.68?"vespa":k<0.8?"ape":k<0.88?"bici":k<0.95?"furgone":"bus";
  const len = {auto:50,vespa:24,ape:38,bici:22,furgone:64,bus:120}[type]*U*(dir<0?1.3:1.15);
  const v = U*({auto:70,vespa:62,ape:34,bici:24,furgone:58,bus:44}[type])*(0.85+R()*0.3);
  const x = dir>0 ? G.camX-len-40 : G.camX+G.vw+len+40;
  G.cars.push({type, dir, x, v, len, sc:dir<0?1.3:1.15, y:dir>0?G.lane[0]:G.lane[1], c:pick(CARS), c2:pick(CLOTH), wh:0, r:5, rider:mkOmino({})});
}

/* ---------- luce: dal sole ai lampioni ---------- */
function light(){
  const d=now(), s=sunAt(d, G.opts.lat||41.9, G.opts.lon||12.5), el=s.el;
  const day=clamp((el+1)/9,0,1), dark=clamp((-el-1)/10,0,1), gold=el>-11?clamp(1-Math.abs(el-0.5)/8,0,1):0;
  const lamp=clamp((3-el)/5,0,1);
  const min=romeHM(d);
  const shopsOn = lamp * ((min>=6*60+30 && min<23*60)?1:0.12);
  return {el, az:s.az, day, dark, gold, night:dark, lamp, shopsOn, min};
}
const SKY={ dayT:c3("#5ea9dc"), dayB:c3("#d6ecf6"), golT:c3("#4f6fb4"), golB:c3("#f7a35f"), twB:c3("#d9877a"), nT:c3("#0b1534"), nB:c3("#25356a") };

/* ---------- disegno ---------- */
function draw(){
  const ctx=G.ctx, vw=G.vw, H=G.H, U=G.U, L=light();
  ctx.setTransform(G.dpr,0,0,G.dpr,0,0);
  /* cielo */
  let top, bot;
  if (L.el>=-1){ top=mx(SKY.golT,SKY.dayT,L.day); bot=mx(SKY.golB,SKY.dayB,L.day); }
  else { top=mx(SKY.golT,SKY.nT,L.dark); bot=mx(mx(SKY.golB,SKY.twB,clamp(L.dark*2,0,1)),SKY.nB,clamp((L.dark-0.3)/0.7,0,1)); }
  const roof=G.yB-G.H*0.4;
  const g=ctx.createLinearGradient(0,0,0,roof+G.U*20); g.addColorStop(0,css(top)); g.addColorStop(1,css(bot));
  ctx.fillStyle=g; ctx.fillRect(0,0,vw,G.yB+2);
  G.skyBot=bot;
  /* stelle e luna */
  if (L.night>0.05){ for(const s of G.stars){ const a=L.night*(0.55+0.45*Math.sin(G.t*1.6+s.p)); ctx.fillStyle=`rgba(255,250,235,${a*0.9})`; ctx.fillRect(s.x*vw, s.y*G.yB, s.s, s.s); } }
  const sx = el2x(L.az), sy = G.yB - (L.el/62)*(G.yB-U*30);
  if (L.el>-6){ const rr=U*(16+L.gold*6); const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,rr*4); sg.addColorStop(0,`rgba(255,${Math.round(lerp(240,190,L.gold))},${Math.round(lerp(190,110,L.gold))},0.55)`); sg.addColorStop(1,"rgba(255,220,160,0)"); ctx.fillStyle=sg; ctx.fillRect(sx-rr*4,sy-rr*4,rr*8,rr*8);
    ctx.fillStyle=css(mx(c3("#fff3c4"),c3("#ffb36b"),L.gold)); ctx.beginPath(); ctx.arc(sx,sy,rr,0,TAU); ctx.fill(); }
  if (L.night>0.3){ const mxp=el2x((L.az+180)%360), myp=G.yB*0.18+Math.abs(Math.sin((L.az+180)*Math.PI/180))*G.yB*0.12; ctx.globalAlpha=clamp((L.night-0.3)/0.4,0,1);
    const mg=ctx.createRadialGradient(mxp,myp,0,mxp,myp,U*60); mg.addColorStop(0,"rgba(220,230,255,0.25)"); mg.addColorStop(1,"rgba(220,230,255,0)"); ctx.fillStyle=mg; ctx.fillRect(mxp-U*60,myp-U*60,U*120,U*120);
    ctx.fillStyle="#f4f1e2"; ctx.beginPath(); ctx.arc(mxp,myp,U*13,0,TAU); ctx.fill(); ctx.fillStyle=css(mx(top,bot,clamp(myp/(roof+G.U*20),0,1))); ctx.beginPath(); ctx.arc(mxp+U*5,myp-U*3,U*11,0,TAU); ctx.fill(); ctx.globalAlpha=1; }
  /* nuvole */
  for (const c of G.clouds){ c.x+=c.v*(RM.matches?0:1)/60; if(c.x>1.3) c.x=-0.3; const a=0.15+0.65*L.day; const col=mx(c3("#ffffff"),c3("#ffc59a"),L.gold*0.8); const cx=c.x*vw, cy=c.y*G.yB, s=c.s*U;
    ctx.fillStyle=css(mx(col,c3("#46557e"),L.night*0.8),a*0.85); ctx.beginPath(); ctx.ellipse(cx,cy,s*46,s*13,0,0,TAU); ctx.ellipse(cx-s*20,cy+s*2,s*22,s*11,0,0,TAU); ctx.ellipse(cx+s*12,cy-s*8,s*24,s*14,0,0,TAU); ctx.fill(); }
  /* sfondo lontano (si muove più piano: profondità) */
  const farC=mx(bot, c3("#bfa983"), 0.45);
  ctx.save(); ctx.translate(-G.camX*0.35,0);
  ctx.fillStyle=css(mx(bot,c3("#9fa98a"),0.35)); ctx.beginPath(); ctx.moveTo(-50,G.yB); for(let x=-50;x<G.W*0.35+vw+60;x+=20) ctx.lineTo(x, G.yB-U*48-Math.sin(x*0.006)*U*16-Math.sin(x*0.017)*U*7); ctx.lineTo(G.W*0.35+vw+60,G.yB); ctx.fill();
  ctx.fillStyle=css(farC);
  for (const s of G.skyline){ const by=G.yB;
    if (s.k==="casa"){ ctx.fillRect(s.x,by-s.h,s.w,s.h); }
    else if (s.k==="campanile"){ ctx.fillRect(s.x,by-s.h,s.w,s.h); ctx.beginPath(); ctx.moveTo(s.x-U*2,by-s.h); ctx.lineTo(s.x+s.w/2,by-s.h-U*26); ctx.lineTo(s.x+s.w+U*2,by-s.h); ctx.fill();
      ctx.fillStyle=css(mx(farC,top,0.35)); ctx.beginPath(); ctx.arc(s.x+s.w/2,by-s.h+U*16,U*5,Math.PI,0); ctx.fillRect(s.x+s.w/2-U*5,by-s.h+U*16,U*10,U*9); ctx.fill(); ctx.fillStyle=css(farC); }
    else if (s.k==="cupola"){ ctx.fillRect(s.x,by-s.h*0.55,s.w,s.h*0.55); ctx.fillRect(s.x+s.w*0.2,by-s.h*0.72,s.w*0.6,s.h*0.2); ctx.beginPath(); ctx.arc(s.x+s.w/2,by-s.h*0.72,s.w*0.3,Math.PI,0); ctx.fill(); ctx.fillRect(s.x+s.w/2-U,by-s.h*0.72-s.w*0.3-U*12,U*2,U*12); ctx.fillRect(s.x+s.w/2-U*4,by-s.h*0.72-s.w*0.3-U*8,U*8,U*2); }
    else if (s.k==="palma"){ const px=s.x+s.w/2, py=by-s.h; ctx.strokeStyle=css(farC); ctx.lineWidth=U*3; ctx.beginPath(); ctx.moveTo(px,by); ctx.quadraticCurveTo(px+U*6,by-s.h/2,px,py); ctx.stroke();
      for(let i=0;i<7;i++){ const a=-Math.PI/2+(i-3)*0.5; ctx.beginPath(); ctx.moveTo(px,py); ctx.quadraticCurveTo(px+Math.cos(a)*U*14,py+Math.sin(a)*U*14-U*4,px+Math.cos(a)*U*26,py+Math.sin(a)*U*20+U*10); ctx.lineWidth=U*2.4; ctx.stroke(); } }
  }
  if (L.lamp>0.2){ const rr=rng(4); for (const s of G.skyline){ if(s.k!=="casa") continue; for(let k=0;k<3;k++){ if(rr()<0.45){ ctx.fillStyle=`rgba(255,214,140,${0.75*L.lamp})`; ctx.fillRect(s.x+s.w*(0.2+rr()*0.6), G.yB-s.h*(0.3+rr()*0.5), U*3, U*4); } } } }
  ctx.restore();

  /* il mondo della piazza */
  ctx.save(); ctx.translate(-Math.round(G.camX),0);
  const x0=G.camX-40, x1=G.camX+vw+40;
  /* pavimento a chianche */
  ctx.fillStyle=G.floorPat||"#dcc79c"; ctx.fillRect(x0,G.yB,x1-x0,G.yC-G.yB);
  ctx.fillStyle="rgba(120,90,40,.10)"; ctx.fillRect(x0,G.yB,x1-x0,U*5);
  /* marciapiede e strada */
  ctx.fillStyle="#cdb98f"; ctx.fillRect(x0,G.yC,x1-x0,G.yR-G.yC);
  ctx.fillStyle="#b39f74"; ctx.fillRect(x0,G.yR-U*2.2,x1-x0,U*2.2);
  ctx.fillStyle="#4b4a4f"; ctx.fillRect(x0,G.yR,x1-x0,H-G.yR);
  ctx.fillStyle="rgba(255,255,255,.75)"; const mid=(G.lane[0]+G.lane[1])/2-U*5; for(let x=Math.floor(x0/(U*60))*U*60; x<x1; x+=U*60) ctx.fillRect(x,mid,U*30,U*2.2);
  /* facciate */
  const lit=[];
  for (const it of G.items){ if (it.x+it.w<x0 || it.x>x1) continue;
    if (it.type==="palazzo") drawPalazzo(ctx,it,L,lit); else drawShop(ctx,it,L,lit); }
  /* ombra sotto le facciate */
  const sg=ctx.createLinearGradient(0,G.yB,0,G.yB+U*16); sg.addColorStop(0,"rgba(60,40,10,.18)"); sg.addColorStop(1,"rgba(60,40,10,0)"); ctx.fillStyle=sg; ctx.fillRect(x0,G.yB,x1-x0,U*16);
  /* oggetti sul pavimento, ordinati per profondità */
  const objs=[];
  objs.push({y:G.fountain.y, d:()=>drawFountain(ctx,G.fountain,L)});
  for (const b of G.benches) objs.push({y:G.yC-U*8, d:()=>drawBench(ctx,b.x,G.yC-U*8)});
  for (const n of G.npcs) if(n.x>x0-30&&n.x<x1+30) objs.push({y:n.y, d:()=>drawOmino(ctx,n)});
  for (const p of G.peers.values()) objs.push({y:p.y, d:()=>drawOmino(ctx,p)});
  objs.push({y:G.me.y, d:()=>drawOmino(ctx,G.me)});
  for (const b of G.birds) if(b.x>x0&&b.x<x1) objs.push({y:b.fly?G.yC:b.y, d:()=>drawBird(ctx,b)});
  for (const l of G.lamps) if(l.x>x0-40&&l.x<x1+40) objs.push({y:G.yC+U*1, d:()=>drawLamp(ctx,l.x,G.yC+U*1)});
  objs.sort((a,b)=>a.y-b.y).forEach(o=>o.d());
  /* traffico: prima la corsia lontana */
  G.cars.slice().sort((a,b)=>a.y-b.y).forEach(c=>drawVehicle(ctx,c,L));
  ctx.restore();

  /* gli aerei con lo striscione passano sopra i tetti */
  for (const p of G.planes) drawPlane(ctx,p,L);
  /* tinta della luce: notte blu, tramonto dorato */
  const tint = mx(mx(c3("#ffffff"),c3("#ffc896"),L.gold*0.6), c3("#3a4785"), L.dark*0.82);
  ctx.globalCompositeOperation="multiply"; ctx.fillStyle=css(tint); ctx.fillRect(0,0,vw,H);
  ctx.globalCompositeOperation="source-over";
  /* le stelle e la luna restano luminose sopra la tinta */
  if (L.night>0.3){ ctx.globalAlpha=L.night*0.6; for(const s of G.stars){ if((s.x*997|0)%3) continue; ctx.fillStyle="#fffbe8"; ctx.fillRect(s.x*vw,s.y*G.yB,s.s,s.s); } ctx.globalAlpha=1; }
  /* luci accese */
  if (L.lamp>0.02){
    const glow=0.3+0.7*L.dark, lampA=L.lamp*glow;
    ctx.save(); ctx.translate(-Math.round(G.camX),0); ctx.globalCompositeOperation="lighter";
    for (const w of lit){ const a=w.a*glow; ctx.fillStyle=`rgba(255,196,110,${0.55*a})`; ctx.fillRect(w.x,w.y,w.w,w.h);
      const gg=ctx.createRadialGradient(w.x+w.w/2,w.y+w.h,0,w.x+w.w/2,w.y+w.h,w.w*1.3); gg.addColorStop(0,`rgba(255,180,90,${0.28*a})`); gg.addColorStop(1,"rgba(255,180,90,0)"); ctx.fillStyle=gg; ctx.fillRect(w.x-w.w,w.y,w.w*3,w.h*2.2); }
    for (const l of G.lamps){ if(l.x<x0-200||l.x>x1+200) continue; const lx=l.x, ly=G.yC-U*78;
      const gg=ctx.createRadialGradient(lx,ly,0,lx,ly,U*90); gg.addColorStop(0,`rgba(255,214,140,${0.75*lampA})`); gg.addColorStop(0.25,`rgba(255,190,110,${0.25*lampA})`); gg.addColorStop(1,"rgba(255,190,110,0)"); ctx.fillStyle=gg; ctx.fillRect(lx-U*90,ly-U*90,U*180,U*180);
      const pg=ctx.createRadialGradient(lx,G.yC-U*4,0,lx,G.yC-U*4,U*80); pg.addColorStop(0,`rgba(255,200,120,${0.35*lampA})`); pg.addColorStop(1,"rgba(255,200,120,0)"); ctx.fillStyle=pg; ctx.save(); ctx.scale(1,0.35); ctx.fillRect(lx-U*80,(G.yC-U*4)/0.35-U*80,U*160,U*160); ctx.restore(); }
    for (const c of G.cars){ if (c.type==="bici") continue; const fx=c.x+c.dir*c.len*0.5, fy=c.y-U*9*c.sc;
      const hg=ctx.createRadialGradient(fx,fy,0,fx+c.dir*U*40,fy,U*70); hg.addColorStop(0,`rgba(255,240,190,${0.55*lampA})`); hg.addColorStop(1,"rgba(255,240,190,0)"); ctx.fillStyle=hg;
      ctx.beginPath(); ctx.moveTo(fx,fy-U*3); ctx.lineTo(fx+c.dir*U*110,fy-U*16); ctx.lineTo(fx+c.dir*U*110,fy+U*22); ctx.closePath(); ctx.fill();
      const bx=c.x-c.dir*c.len*0.5; ctx.fillStyle=`rgba(255,40,30,${0.7*L.lamp})`; ctx.beginPath(); ctx.arc(bx,fy+U*1,U*3.2,0,TAU); ctx.fill(); }
    ctx.restore(); ctx.globalCompositeOperation="source-over";
  }
  /* segnalino sulla bottega scelta */
  if (G.sel){ const it=G.items.find(i=>(i.type==="shop"&&i.s.id===G.sel)||(i.type==="free"&&G.sel==="__free")); if(it){ const ax=it.x+it.w/2-G.camX, ay=G.yB-it.h-U*12+Math.sin(G.t*4)*U*3;
    ctx.fillStyle="#f1c232"; ctx.strokeStyle="#2a2100"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(ax-U*9,ay-U*12); ctx.lineTo(ax+U*9,ay-U*12); ctx.lineTo(ax,ay); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
  /* l'etichetta «Tu» sopra il tuo omino */
  drawMeLabel(ctx);
}
function el2x(az){ /* est a sinistra, ovest a destra */ const t=clamp((az-60)/240,0,1); return lerp(G.vw*0.06, G.vw*0.94, t); }

function stoneLines(ctx,x,y,w,h,U,col){ ctx.strokeStyle=col; ctx.lineWidth=Math.max(0.6,U*0.7); ctx.beginPath(); const rh=U*13; for(let r=0, yy=y+rh; yy<y+h; yy+=rh, r++){ ctx.moveTo(x,yy); ctx.lineTo(x+w,yy); const off=r%2?0:U*16; for(let xx=x+off+U*16; xx<x+w; xx+=U*32){ ctx.moveTo(xx,yy-rh); ctx.lineTo(xx,yy); } } ctx.stroke(); }

function drawPalazzo(ctx,it,L,lit){
  const U=G.U, r=rng(it.seed), x=it.x, w=it.w, h=it.h, y=G.yB-h;
  const wall=pick(["#e9d3a3","#efdcb5","#e4c58f","#f0e2c4","#e7cfa0"],r);
  ctx.fillStyle=wall; ctx.fillRect(x,y,w,h);
  ctx.fillStyle=shade(wall,-0.12); ctx.fillRect(x,y,w,U*6); ctx.fillRect(x,y,U*2,h); ctx.fillRect(x+w-U*2,y,U*2,h);
  stoneLines(ctx,x,y+U*6,w,h-U*6,U,"rgba(140,105,50,.13)");
  const shut=pick(["#3f6b4a","#4c7a5a","#6b8f7a","#5b4636"],r);
  const floors=[y+h*0.14, y+h*0.46];
  for (const fy of floors){ const ww=w*0.42, wh=h*0.2, wx=x+(w-ww)/2;
    ctx.fillStyle="#3a3a40"; ctx.fillRect(wx,fy,ww,wh);
    const open=r()<0.6; if(open){ ctx.fillStyle=shut; ctx.fillRect(wx-ww*0.42,fy,ww*0.4,wh); ctx.fillRect(wx+ww*1.02,fy,ww*0.4,wh);
      if(L.lamp>0.1 && r()<0.55) lit.push({x:wx+U,y:fy+U,w:ww-U*2,h:wh-U*2,a:L.lamp*0.9}); }
    else { ctx.fillStyle=shut; ctx.fillRect(wx,fy,ww,wh); ctx.strokeStyle="rgba(0,0,0,.18)"; ctx.lineWidth=1; ctx.beginPath(); for(let k=fy+U*3;k<fy+wh;k+=U*3){ ctx.moveTo(wx,k); ctx.lineTo(wx+ww,k);} ctx.stroke(); }
    /* balconcino in ferro */
    ctx.fillStyle=shade(wall,-0.2); ctx.fillRect(wx-U*4,fy+wh,ww+U*8,U*3);
    ctx.strokeStyle="#2f2a26"; ctx.lineWidth=U*0.9; ctx.beginPath(); ctx.moveTo(wx-U*4,fy+wh-U*9); ctx.lineTo(wx+ww+U*4,fy+wh-U*9); for(let k=wx-U*4;k<=wx+ww+U*4;k+=U*4){ ctx.moveTo(k,fy+wh-U*9); ctx.lineTo(k,fy+wh);} ctx.stroke();
    if (r()<0.5){ ctx.fillStyle="#c8372d"; ctx.beginPath(); ctx.arc(wx+U*2,fy+wh-U*10,U*3,0,TAU); ctx.arc(wx+ww-U*3,fy+wh-U*10,U*3,0,TAU); ctx.fill(); ctx.fillStyle="#5c7a2e"; ctx.fillRect(wx-U,fy+wh-U*8,U*7,U*2); }
  }
  /* portone ad arco */
  const dw=w*0.5, dh=h*0.26, dx=x+(w-dw)/2, dy=G.yB-dh;
  ctx.fillStyle="#5a3b22"; ctx.beginPath(); ctx.moveTo(dx,G.yB); ctx.lineTo(dx,dy+dw/2); ctx.arc(dx+dw/2,dy+dw/2,dw/2,Math.PI,0); ctx.lineTo(dx+dw,G.yB); ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,.25)"; ctx.lineWidth=U; ctx.beginPath(); ctx.moveTo(dx+dw/2,dy+dw/4); ctx.lineTo(dx+dw/2,G.yB); ctx.stroke();
  /* lanterna a muro */
  const lx=x+w-U*6, ly=G.yB-h*0.36; ctx.fillStyle="#2f2a26"; ctx.fillRect(lx-U*3,ly,U*6,U*9); ctx.fillStyle=L.lamp>0.1?"#ffe2a0":"#cfc6a8"; ctx.fillRect(lx-U*2,ly+U*2,U*4,U*5);
  if(L.lamp>0.1) lit.push({x:lx-U*2,y:ly+U*2,w:U*4,h:U*5,a:L.lamp});
}

function shopGoods(cat){ cat=String(cat||"").toLowerCase();
  if (/ceram|terracott|maiolic/.test(cat)) return "piatti"; if (/miele|apicol/.test(cat)) return "vasetti"; if (/legno|ebanist|intagl/.test(cat)) return "legno";
  if (/tess|tela|lana|ricam|abbigl|moda/.test(cat)) return "stoffe"; if (/vino|olio|liquor|birra/.test(cat)) return "bottiglie"; if (/gioiell|orafo|bijou/.test(cat)) return "gioielli";
  if (/pelle|cuoio|borse/.test(cat)) return "borse"; if (/pian|fior|vivai/.test(cat)) return "piante"; if (/cart|libr|stamp|carta/.test(cat)) return "carta"; return "misto"; }
function drawShop(ctx,it,L,lit){
  const U=G.U, x=it.x, w=it.w, h=it.h, y=G.yB-h, r=rng(it.seed), free=it.type==="free";
  const wall=free?"#e6d6b4":pick(["#ead6a8","#efdcb4","#e5c992","#f1e4c8"],r);
  ctx.fillStyle=wall; ctx.fillRect(x,y,w,h);
  stoneLines(ctx,x,y,w,h,U,"rgba(140,105,50,.12)");
  /* cornicione */
  ctx.fillStyle=shade(wall,-0.14); ctx.fillRect(x-U*2,y,w+U*4,U*7); ctx.fillStyle=shade(wall,0.25); ctx.fillRect(x-U*2,y+U*7,w+U*4,U*1.5);
  /* insegna */
  const sy=y+U*14, shh=h*0.17, sx=x+U*8, sww=w-U*16;
  const col = free ? "#8a7a5c" : (it.s.color||"#1f6b88");
  ctx.fillStyle=free?"#efe6d2":"#fbf6ea"; ctx.fillRect(sx,sy,sww,shh); ctx.strokeStyle=col; ctx.lineWidth=U*2; ctx.strokeRect(sx+U,sy+U,sww-U*2,shh-U*2);
  ctx.fillStyle=free?"#6b5d45":shade(col,-0.25); ctx.textAlign="center"; ctx.textBaseline="middle";
  const name = free ? T("Posto libero") : (it.s.nome||"");
  let fs=Math.min(shh*0.52, U*17); ctx.font=`${fs}px Gloock, Georgia, serif`;
  while (ctx.measureText(name).width>sww-U*10 && fs>U*8.5){ fs-=0.5; ctx.font=`${fs}px Gloock, Georgia, serif`; }
  let label=name; if (ctx.measureText(label).width>sww-U*10){ while(label.length>3 && ctx.measureText(label+"…").width>sww-U*10) label=label.slice(0,-1); label=label.trim()+"…"; }
  ctx.fillText(label, x+w/2, sy+shh/2+U*0.5);
  /* tenda a righe con il bordo a smerlo */
  const ay=sy+shh+U*6, ah=h*0.13;
  if (!free){ const stripes=8, sw=(w+U*8)/stripes;
    for(let i=0;i<stripes;i++){ ctx.fillStyle=i%2?"#fbf8f1":col; ctx.fillRect(x-U*4+i*sw,ay,sw+0.5,ah); ctx.beginPath(); ctx.arc(x-U*4+i*sw+sw/2,ay+ah,sw/2,0,Math.PI); ctx.fill(); }
    ctx.fillStyle="rgba(0,0,0,.12)"; ctx.fillRect(x-U*4,ay,w+U*8,U*2.5); }
  /* vetrina e porta */
  const by=ay+ah+(free?0:U*8), bh=G.yB-by, vx=x+U*8, vw2=w*0.52, dx=x+w*0.66, dw=w*0.26;
  if (free){
    /* serranda abbassata con il cartello */
    ctx.fillStyle="#9ea3a6"; ctx.fillRect(x+U*8,ay-U*2,w-U*16,G.yB-ay+U*2);
    ctx.strokeStyle="rgba(0,0,0,.16)"; ctx.lineWidth=1; ctx.beginPath(); for(let k=ay;k<G.yB;k+=U*4){ ctx.moveTo(x+U*8,k); ctx.lineTo(x+w-U*8,k);} ctx.stroke();
    const px=x+w*0.16, py=ay+U*12, pw=w*0.68, ph=h*0.36; ctx.save(); ctx.translate(px+pw/2,py+ph/2); ctx.rotate(-0.04);
    ctx.fillStyle="#fffdf6"; ctx.fillRect(-pw/2,-ph/2,pw,ph); ctx.fillStyle="#c8372d"; ctx.fillRect(-pw/2,-ph/2,pw,ph*0.12);
    ctx.fillStyle="#2b2118"; ctx.textAlign="center"; ctx.font=`600 ${U*8.6}px "Instrument Sans", system-ui, sans-serif`; wrapText(ctx, T("Apri qui la tua bottega"), 0, -ph*0.08, pw-U*10, U*10);
    ctx.fillStyle="#1f6b88"; ctx.font=`700 ${U*7.2}px "Instrument Sans", system-ui, sans-serif`; let ct=G.opts.free.cta||""; while(ct.length>4 && ctx.measureText(ct).width>pw-U*8){ ctx.font=`700 ${parseFloat(ctx.font.split(" ")[1])-0.4}px "Instrument Sans", system-ui, sans-serif`; if(parseFloat(ctx.font.split(" ")[1])<U*5) break; } ctx.fillText(ct, 0, ph*0.33); ctx.restore();
    ctx.fillStyle="#555"; ctx.beginPath(); ctx.arc(px+pw/2,py-U*2,U*1.6,0,TAU); ctx.fill();
    it.hit={x, y, w, h}; return;
  }
  ctx.fillStyle=shade(wall,-0.18); ctx.fillRect(vx-U*2,by-U*2,vw2+U*4,bh+U*2);
  const glass=css(mx(c3("#a9c6cf"),c3("#3b3326"),clamp(L.night*0.9,0,1)));
  ctx.fillStyle=glass; ctx.fillRect(vx,by,vw2,bh-U*10);
  ctx.fillStyle=shade(wall,-0.28); ctx.fillRect(vx-U*2,G.yB-U*10,vw2+U*4,U*10);
  /* la merce in vetrina */
  drawGoods(ctx, shopGoods(it.s.categoria), vx+U*3, by+U*3, vw2-U*6, bh-U*16, r, col);
  ctx.fillStyle="rgba(255,255,255,.22)"; ctx.beginPath(); ctx.moveTo(vx+vw2*0.55,by); ctx.lineTo(vx+vw2*0.75,by); ctx.lineTo(vx+vw2*0.35,by+bh-U*10); ctx.lineTo(vx+vw2*0.15,by+bh-U*10); ctx.fill();
  if (L.shopsOn>0.05) lit.push({x:vx,y:by,w:vw2,h:bh-U*10,a:L.shopsOn});
  /* porta ad arco */
  ctx.fillStyle=shade(wall,-0.18); ctx.beginPath(); ctx.moveTo(dx-U*2,G.yB); ctx.lineTo(dx-U*2,by+dw/2); ctx.arc(dx+dw/2,by+dw/2,dw/2+U*2,Math.PI,0); ctx.lineTo(dx+dw+U*2,G.yB); ctx.fill();
  ctx.fillStyle=shade(col,-0.35); ctx.beginPath(); ctx.moveTo(dx,G.yB); ctx.lineTo(dx,by+dw/2); ctx.arc(dx+dw/2,by+dw/2,dw/2,Math.PI,0); ctx.lineTo(dx+dw,G.yB); ctx.fill();
  ctx.fillStyle=glass; ctx.beginPath(); ctx.arc(dx+dw/2,by+dw/2,dw/2-U*3,Math.PI,0); ctx.fill(); ctx.fillRect(dx+U*3,by+dw/2,dw-U*6,(G.yB-by)*0.32);
  if (L.shopsOn>0.05) lit.push({x:dx+U*3,y:by+U*4,w:dw-U*6,h:(G.yB-by)*0.32+dw/2-U*4,a:L.shopsOn*0.9});
  ctx.fillStyle="#e3b21b"; ctx.beginPath(); ctx.arc(dx+dw-U*5,G.yB-(G.yB-by)*0.4,U*1.8,0,TAU); ctx.fill();
  /* cartellino «aperto» online, sempre */
  ctx.fillStyle="#fffdf6"; ctx.fillRect(dx+dw*0.18,by+dw/2+U*4,dw*0.64,U*8); ctx.fillStyle=col; ctx.font=`700 ${U*5.2}px "Instrument Sans", system-ui, sans-serif`; ctx.textAlign="center"; ctx.fillText(T("APERTO"),dx+dw/2,by+dw/2+U*8.3);
  /* vasi di piante */
  if (r()<0.7){ const px=x+w-U*3; ctx.fillStyle="#b5532e"; ctx.fillRect(px-U*5,G.yB-U*9,U*10,U*9); ctx.fillStyle="#4f7a2a"; ctx.beginPath(); ctx.arc(px,G.yB-U*14,U*7,0,TAU); ctx.fill(); ctx.fillStyle="#f1c232"; ctx.beginPath(); ctx.arc(px-U*3,G.yB-U*16,U*1.6,0,TAU); ctx.arc(px+U*3,G.yB-U*12,U*1.6,0,TAU); ctx.fill(); }
  /* artigiano in bottega adesso */
  const inShop=[...G.peers.values()].some(p=>p.kind==="a"&&p.shop===it.s.id) || (G.opts.me.kind==="a"&&G.opts.me.shop===it.s.id);
  if (inShop){ const bx=x+w/2, byy=sy-U*5; ctx.fillStyle="#1f7a4d"; roundRect(ctx,bx-U*28,byy-U*7,U*56,U*12,U*6); ctx.fill(); ctx.fillStyle="#fff"; ctx.font=`700 ${U*6.4}px "Instrument Sans", system-ui, sans-serif`; ctx.fillText(T("IN BOTTEGA ORA"),bx,byy-U*0.6); }
  it.hit={x, y, w, h};
}
function drawGoods(ctx,kind,x,y,w,h,r,col){
  const U=G.U; ctx.fillStyle="rgba(90,60,30,.55)"; const sh=[y+h*0.42, y+h*0.92];
  sh.forEach(s=>ctx.fillRect(x,s,w,U*1.6));
  const cols=["#c8372d","#1f6b88","#e3b21b","#5c7a2e","#7a5cb8","#d0663a","#fbf8f1",col];
  sh.forEach((s,row)=>{ let cx=x+U*3; while(cx<x+w-U*6){ const c=pick(cols,r);
    if (kind==="piatti"){ const rr=U*(5+r()*2.5); ctx.fillStyle="#fbf8f1"; ctx.beginPath(); ctx.arc(cx+rr,s-rr,rr,0,TAU); ctx.fill(); ctx.strokeStyle=c; ctx.lineWidth=U*1.4; ctx.beginPath(); ctx.arc(cx+rr,s-rr,rr*0.65,0,TAU); ctx.stroke(); ctx.fillStyle="#e3b21b"; ctx.beginPath(); ctx.arc(cx+rr,s-rr,rr*0.25,0,TAU); ctx.fill(); cx+=rr*2+U*2; }
    else if (kind==="vasetti"){ const ww=U*6, hh=U*(7+r()*2); ctx.fillStyle=pick(["#d99a1e","#e8b33a","#b8731a"],r); ctx.fillRect(cx,s-hh,ww,hh); ctx.fillStyle=pick(["#c8372d","#fbf8f1","#5c7a2e"],r); ctx.fillRect(cx-U*0.5,s-hh-U*2,ww+U,U*2.4); ctx.fillStyle="#fbf8f1"; ctx.fillRect(cx+U,s-hh*0.6,ww-U*2,hh*0.3); cx+=ww+U*2.5; }
    else if (kind==="bottiglie"){ const ww=U*4.4, hh=U*(11+r()*3); ctx.fillStyle=pick(["#2f5a2a","#5a1f24","#c9a227","#3c6b3a"],r); ctx.fillRect(cx,s-hh*0.7,ww,hh*0.7); ctx.fillRect(cx+ww*0.3,s-hh,ww*0.4,hh*0.3); ctx.fillStyle="#fbf8f1"; ctx.fillRect(cx+U*0.6,s-hh*0.45,ww-U*1.2,hh*0.18); cx+=ww+U*2.4; }
    else if (kind==="legno"){ const ww=U*(4+r()*6), hh=U*(6+r()*7); ctx.fillStyle=pick(["#8a5a2b","#a8743e","#6b4423","#c08a50"],r); roundRect(ctx,cx,s-hh,ww,hh,U*2); ctx.fill(); ctx.strokeStyle="rgba(0,0,0,.18)"; ctx.lineWidth=U*0.6; ctx.beginPath(); ctx.moveTo(cx+ww*0.3,s-hh+U); ctx.lineTo(cx+ww*0.35,s-U); ctx.stroke(); cx+=ww+U*2; }
    else if (kind==="stoffe"){ const ww=U*11, n=2+(r()*3|0); for(let k=0;k<n;k++){ ctx.fillStyle=pick(cols,r); ctx.fillRect(cx,s-U*3*(k+1),ww,U*2.8); } cx+=ww+U*2.5; }
    else if (kind==="gioielli"){ ctx.fillStyle="#3a2b4a"; ctx.fillRect(cx,s-U*6,U*9,U*6); ctx.strokeStyle=pick(["#e3b21b","#d9d9e0"],r); ctx.lineWidth=U*0.9; ctx.beginPath(); ctx.arc(cx+U*4.5,s-U*4,U*2.4,0,TAU); ctx.stroke(); cx+=U*12; }
    else if (kind==="borse"){ ctx.fillStyle=pick(["#8a4f2b","#5a3520","#b5763d","#2f2a26"],r); roundRect(ctx,cx,s-U*9,U*11,U*9,U*2); ctx.fill(); ctx.strokeStyle=ctx.fillStyle; ctx.lineWidth=U*1.2; ctx.beginPath(); ctx.arc(cx+U*5.5,s-U*9,U*3.5,Math.PI,0); ctx.stroke(); cx+=U*14; }
    else if (kind==="piante"){ ctx.fillStyle="#b5532e"; ctx.fillRect(cx,s-U*5,U*7,U*5); ctx.fillStyle=pick(["#4f7a2a","#5c8a3a","#3f6b2a"],r); ctx.beginPath(); ctx.arc(cx+U*3.5,s-U*9,U*5,0,TAU); ctx.fill(); if(r()<0.6){ ctx.fillStyle=pick(["#c8372d","#e3b21b","#b85c7a","#fbf8f1"],r); ctx.beginPath(); ctx.arc(cx+U*2,s-U*11,U*1.8,0,TAU); ctx.arc(cx+U*5,s-U*8,U*1.8,0,TAU); ctx.fill(); } cx+=U*10; }
    else if (kind==="carta"){ const ww=U*(2.6+r()*2), hh=U*(8+r()*4); ctx.fillStyle=c; ctx.fillRect(cx,s-hh,ww,hh); cx+=ww+U*0.6; }
    else { const k=r(); if(k<0.33){ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(cx+U*4,s-U*4,U*4,0,TAU); ctx.fill(); cx+=U*10; } else if(k<0.66){ ctx.fillStyle=c; ctx.fillRect(cx,s-U*9,U*6,U*9); cx+=U*9; } else { ctx.fillStyle=c; roundRect(ctx,cx,s-U*6,U*9,U*6,U*2); ctx.fill(); cx+=U*12; } }
  }});
}
function wrapText(ctx,text,x,y,maxW,lh){ const words=String(text).split(" "); let line="", lines=[]; for(const w of words){ const t=line?line+" "+w:w; if(ctx.measureText(t).width>maxW && line){ lines.push(line); line=w; } else line=t; } lines.push(line); const y0=y-(lines.length-1)*lh/2; lines.forEach((l,i)=>ctx.fillText(l,x,y0+i*lh)); }
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

function drawFountain(ctx,f,L){
  const U=G.U, x=f.x, y=f.y, r=f.r;
  ctx.fillStyle="rgba(60,40,10,.18)"; ctx.beginPath(); ctx.ellipse(x,y+U*4,r*1.05,r*0.3,0,0,TAU); ctx.fill();
  ctx.fillStyle="#d9c08c"; ctx.beginPath(); ctx.ellipse(x,y,r,r*0.28,0,0,TAU); ctx.fill(); ctx.fillRect(x-r,y-U*12,r*2,U*12);
  ctx.fillStyle="#e8d3a6"; ctx.beginPath(); ctx.ellipse(x,y-U*12,r,r*0.28,0,0,TAU); ctx.fill();
  ctx.fillStyle=css(mx(c3("#5fa8c4"),c3("#1d3550"),L.night*0.8)); ctx.beginPath(); ctx.ellipse(x,y-U*12,r*0.86,r*0.22,0,0,TAU); ctx.fill();
  ctx.fillStyle="#d9c08c"; ctx.fillRect(x-U*4,y-U*44,U*8,U*32); ctx.beginPath(); ctx.ellipse(x,y-U*44,U*16,U*4.5,0,0,TAU); ctx.fill();
  ctx.fillStyle="#e8d3a6"; ctx.beginPath(); ctx.arc(x,y-U*50,U*5,0,TAU); ctx.fill();
  /* l'acqua */
  ctx.strokeStyle="rgba(200,232,245,.85)"; ctx.lineWidth=U*1.4;
  for (let i=0;i<6;i++){ const a=(i/6)*TAU+G.t*0.2, dx=Math.cos(a)*U*13; ctx.beginPath(); ctx.moveTo(x+dx*0.3,y-U*46); ctx.quadraticCurveTo(x+dx*1.3,y-U*52,x+dx*2.2,y-U*16); ctx.stroke(); }
  ctx.fillStyle="rgba(220,240,250,.9)"; for(let i=0;i<10;i++){ const t=((G.t*0.9+i/10)%1), a=i*2.1; const dx=Math.cos(a)*U*26*t; ctx.fillRect(x+dx, y-U*52+U*36*t*t+U*(-8*t), U*1.3, U*1.3); }
}
function drawBench(ctx,x,y){ const U=G.U; ctx.fillStyle="rgba(60,40,10,.18)"; ctx.fillRect(x-U*20,y,U*40,U*3); ctx.fillStyle="#2f3a2f"; ctx.fillRect(x-U*18,y-U*10,U*2,U*10); ctx.fillRect(x+U*16,y-U*10,U*2,U*10); ctx.fillStyle="#8a5a2b"; ctx.fillRect(x-U*21,y-U*12,U*42,U*3); ctx.fillRect(x-U*21,y-U*20,U*42,U*3); }
function drawLamp(ctx,x,y){ const U=G.U; ctx.fillStyle="#22262a"; ctx.fillRect(x-U*1.6,y-U*76,U*3.2,U*76); ctx.fillRect(x-U*4,y-U*6,U*8,U*6); ctx.fillRect(x-U*1,y-U*80,U*14,U*2.2);
  ctx.beginPath(); ctx.moveTo(x+U*6,y-U*79); ctx.lineTo(x+U*16,y-U*79); ctx.lineTo(x+U*14,y-U*68); ctx.lineTo(x+U*8,y-U*68); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#f6e3b0"; ctx.fillRect(x+U*8.6,y-U*76.5,U*4.8,U*7); }

function drawOmino(ctx,o){
  const U=G.U, depth=floorF(o.y), s=U*(1.02+depth*0.4)*(o.kid?0.72:1), x=o.x, y=o.y;
  ctx.globalAlpha=o.al==null?1:o.al;
  const sw=o.mv?Math.sin(o.ph):0;
  ctx.fillStyle="rgba(40,25,5,.2)"; ctx.beginPath(); ctx.ellipse(x,y,s*7,s*2,0,0,TAU); ctx.fill();
  if (o.me){ ctx.strokeStyle="rgba(241,194,50,.9)"; ctx.lineWidth=U*1.6; ctx.beginPath(); ctx.ellipse(x,y,s*11+Math.sin(G.t*3)*s,s*3.4,0,0,TAU); ctx.stroke(); }
  /* gambe */
  ctx.strokeStyle=o.pants; ctx.lineWidth=s*3; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-s*1.6,y-s*13); ctx.lineTo(x-s*1.6+sw*s*5,y-s*1); ctx.moveTo(x+s*1.6,y-s*13); ctx.lineTo(x+s*1.6-sw*s*5,y-s*1); ctx.stroke();
  /* braccia */
  ctx.strokeStyle=shade(o.c,-0.2); ctx.lineWidth=s*2.4;
  ctx.beginPath(); ctx.moveTo(x-s*4.4,y-s*24); ctx.lineTo(x-s*5.5-sw*s*3,y-s*14); ctx.moveTo(x+s*4.4,y-s*24); ctx.lineTo(x+s*5.5+sw*s*3,y-s*14); ctx.stroke();
  /* corpo */
  ctx.fillStyle=o.c; roundRect(ctx,x-s*5,y-s*27,s*10,s*15,s*4); ctx.fill();
  if (o.kind==="a"){ ctx.fillStyle="#fbf8f1"; roundRect(ctx,x-s*3.6,y-s*21,s*7.2,s*9.5,s*1.5); ctx.fill(); }
  if (o.bag && !o.real){ ctx.fillStyle="#c08a50"; ctx.fillRect(x+s*(o.dir>0?4:-9),y-s*17,s*5,s*6); }
  /* testa */
  ctx.fillStyle=o.skin; ctx.beginPath(); ctx.arc(x,y-s*32,s*5,0,TAU); ctx.fill();
  ctx.fillStyle=o.hair; ctx.beginPath(); ctx.arc(x,y-s*33,s*5.2,Math.PI*1.05,Math.PI*1.95); ctx.fill();
  if (o.real){ /* la coppola: gli omini con il berretto sono persone collegate adesso */
    ctx.fillStyle=o.me?"#f1c232":shade(o.c,-0.35); ctx.beginPath(); ctx.ellipse(x,y-s*36,s*5.6,s*2.6,0,Math.PI,0); ctx.fill(); ctx.fillRect(x-s*5.6,y-s*36,s*11.2,s*1.2); ctx.beginPath(); ctx.ellipse(x+s*o.dir*5,y-s*35.4,s*3.4,s*1.1,0,0,TAU); ctx.fill(); }
  else if (o.hat){ ctx.fillStyle="#efe2c0"; ctx.beginPath(); ctx.ellipse(x,y-s*35.5,s*8,s*1.6,0,0,TAU); ctx.fill(); ctx.fillRect(x-s*4,y-s*40,s*8,s*4.6); }
  if (o.dog && !o.real){ const dx=x+o.dir*s*12, dy=y; ctx.fillStyle="#7a5232"; roundRect(ctx,dx-s*5,dy-s*7,s*10,s*4,s*2); ctx.fill(); ctx.beginPath(); ctx.arc(dx+o.dir*s*5.5,dy-s*7.5,s*2.6,0,TAU); ctx.fill(); ctx.strokeStyle="#7a5232"; ctx.lineWidth=s*1.4; ctx.beginPath(); ctx.moveTo(dx-s*3.5,dy-s*3); ctx.lineTo(dx-s*3.5+sw*s*2,dy); ctx.moveTo(dx+s*3.5,dy-s*3); ctx.lineTo(dx+s*3.5-sw*s*2,dy); ctx.stroke();
    ctx.strokeStyle="rgba(40,30,20,.6)"; ctx.lineWidth=s*0.6; ctx.beginPath(); ctx.moveTo(x+o.dir*s*5.5,y-s*14); ctx.lineTo(dx+o.dir*s*4,dy-s*8); ctx.stroke(); }
  if (o.kind==="a" && o.name && !o.me){ ctx.font=`600 ${U*7}px "Instrument Sans", system-ui, sans-serif`; ctx.textAlign="center"; const tw=ctx.measureText(o.name).width; ctx.fillStyle="rgba(255,253,246,.92)"; roundRect(ctx,x-tw/2-U*4,y-s*52,tw+U*8,U*11,U*5); ctx.fill(); ctx.fillStyle="#2b2118"; ctx.fillText(o.name,x,y-s*52+U*5.8); }
  ctx.globalAlpha=1;
}
function drawMeLabel(ctx){ const o=G.me, U=G.U, s=U*(1.02+floorF(o.y)*0.4), x=o.x-G.camX, y=o.y-s*48+Math.sin(G.t*3)*U*1.2;
  if (x<-20||x>G.vw+20) return;
  const txt=T("Tu"); ctx.font=`700 ${U*8}px "Instrument Sans", system-ui, sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; const tw=ctx.measureText(txt).width;
  ctx.fillStyle="#f1c232"; roundRect(ctx,x-tw/2-U*6,y-U*7,tw+U*12,U*14,U*7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x-U*4,y+U*6); ctx.lineTo(x+U*4,y+U*6); ctx.lineTo(x,y+U*11); ctx.fill();
  ctx.fillStyle="#2a2100"; ctx.fillText(txt,x,y+U*0.5); }
function drawBird(ctx,b){ const U=G.U; ctx.fillStyle="#6f7380";
  if (b.fly){ const f=Math.sin(b.ph)*U*4; ctx.strokeStyle="#5d616c"; ctx.lineWidth=U*1.4; ctx.beginPath(); ctx.moveTo(b.x-U*6,b.y-f); ctx.quadraticCurveTo(b.x-U*2,b.y-U*2,b.x,b.y); ctx.quadraticCurveTo(b.x+U*2,b.y-U*2,b.x+U*6,b.y-f); ctx.stroke(); return; }
  const peck=Math.max(0,Math.sin(b.ph))*U*2; ctx.beginPath(); ctx.ellipse(b.x,b.y-U*3,U*4,U*2.6,0,0,TAU); ctx.fill(); ctx.beginPath(); ctx.arc(b.x+U*3.4,b.y-U*5.4+peck,U*1.8,0,TAU); ctx.fill(); ctx.fillStyle="#e3a21b"; ctx.fillRect(b.x+U*5,b.y-U*5.6+peck,U*1.4,U*0.8); }

function drawVehicle(ctx,c,L){
  const U=G.U*c.sc; ctx.save(); ctx.translate(c.x,c.y); ctx.scale(c.dir,1);
  ctx.fillStyle="rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0,U*1,c.len*0.5,U*3,0,0,TAU); ctx.fill();
  const wheel=(wx,r)=>{ ctx.fillStyle="#1d1d20"; ctx.beginPath(); ctx.arc(wx,-r,r,0,TAU); ctx.fill(); ctx.fillStyle="#a7a9ad"; ctx.beginPath(); ctx.arc(wx,-r,r*0.45,0,TAU); ctx.fill(); ctx.strokeStyle="#666"; ctx.lineWidth=U*0.6; ctx.beginPath(); const a=c.wh; ctx.moveTo(wx+Math.cos(a)*r*0.45,-r+Math.sin(a)*r*0.45); ctx.lineTo(wx-Math.cos(a)*r*0.45,-r-Math.sin(a)*r*0.45); ctx.stroke(); };
  const glass=css(mx(c3("#bfe0ea"),c3("#2a3346"),L.night*0.85));
  const L2=c.len/2;
  if (c.type==="auto"){ /* una piccola utilitaria tonda */
    ctx.fillStyle=c.c; roundRect(ctx,-L2,-U*17,c.len,U*11,U*5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-L2+U*9,-U*16); ctx.quadraticCurveTo(-L2+U*12,-U*29,-U*2,-U*29); ctx.quadraticCurveTo(L2-U*12,-U*29,L2-U*6,-U*16); ctx.fill();
    ctx.fillStyle=glass; ctx.beginPath(); ctx.moveTo(-L2+U*12,-U*17); ctx.quadraticCurveTo(-L2+U*14,-U*26.5,-U*3,-U*26.5); ctx.lineTo(-U*3,-U*17); ctx.fill(); ctx.beginPath(); ctx.moveTo(-U*0.5,-U*17); ctx.lineTo(-U*0.5,-U*26.5); ctx.quadraticCurveTo(L2-U*13,-U*26.5,L2-U*9,-U*17); ctx.fill();
    ctx.fillStyle="#fff6c8"; ctx.beginPath(); ctx.arc(L2-U*2.5,-U*13,U*2,0,TAU); ctx.fill(); ctx.fillStyle="#b3261e"; ctx.fillRect(-L2,-U*14,U*2,U*3);
    ctx.fillStyle="#d8d8d8"; ctx.fillRect(-L2-U,-U*8.5,U*5,U*1.6); ctx.fillRect(L2-U*4,-U*8.5,U*5,U*1.6);
    wheel(-L2+U*11,U*5); wheel(L2-U*11,U*5); }
  else if (c.type==="adtruck"){
    const col=c.shop?c.shop.color:"#1f6b88", cabW=U*28, boxW=c.len-cabW-U*4, bx=-L2, by=-U*54, bh=U*42;
    ctx.fillStyle="#2f2f35"; ctx.fillRect(-L2+U*2,-U*12,c.len-U*4,U*4);
    ctx.fillStyle="#fbf8f1"; roundRect(ctx,bx,by,boxW,bh,U*3); ctx.fill(); ctx.strokeStyle="rgba(0,0,0,.18)"; ctx.lineWidth=U*0.8; ctx.stroke();
    const n=Math.max(5,Math.round(boxW/(U*13))), sw=boxW/n;
    for (let i=0;i<n;i++){ ctx.fillStyle=i%2?"#fbf8f1":col; ctx.fillRect(bx+i*sw,by,sw+0.5,U*8); ctx.beginPath(); ctx.arc(bx+i*sw+sw/2,by+U*8,sw/2,0,Math.PI); ctx.fill(); }
    ctx.save(); ctx.scale(c.dir,1); const cx=c.dir*(bx+boxW/2);
    const name=c.shop?c.shop.nome:T("Il tuo camion qui"); let fs=U*15; ctx.font=`${fs}px Gloock, Georgia, serif`;
    while (ctx.measureText(name).width>boxW-U*12 && fs>U*8){ fs-=0.5; ctx.font=`${fs}px Gloock, Georgia, serif`; }
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle=c.shop?shade(col,-0.3):"#1f6b88"; ctx.fillText(name,cx,by+bh*0.55);
    ctx.font=`600 ${U*7}px "Instrument Sans", system-ui, sans-serif`; ctx.fillStyle="#6b5d45"; ctx.fillText(c.shop?"liberebotteghe.it":T("con le monete delle missioni"),cx,by+bh*0.82);
    ctx.restore();
    ctx.fillStyle=col; roundRect(ctx,L2-cabW,-U*42,cabW,U*32,U*6); ctx.fill();
    ctx.fillStyle=glass; roundRect(ctx,L2-cabW*0.55,-U*38,cabW*0.45,U*12,U*3); ctx.fill();
    ctx.fillStyle="#d8d8d8"; ctx.fillRect(L2-U*3,-U*14,U*4,U*3);
    ctx.fillStyle="#fff6c8"; ctx.beginPath(); ctx.arc(L2-U*2,-U*18,U*2,0,TAU); ctx.fill();
    wheel(-L2+U*18,U*6); wheel(-L2+boxW-U*20,U*6); wheel(L2-U*14,U*6);
    c.hit={x:c.x-c.len/2, y:c.y+by, w:c.len, h:-by};
  }
  else if (c.type==="furgone"){ ctx.fillStyle="#f2efe6"; roundRect(ctx,-L2,-U*32,c.len*0.75,U*26,U*3); ctx.fill(); ctx.fillStyle=c.c; roundRect(ctx,-L2+c.len*0.72,-U*25,c.len*0.28,U*19,U*4); ctx.fill(); ctx.fillStyle=glass; ctx.fillRect(-L2+c.len*0.77,-U*23,c.len*0.16,U*8);
    ctx.fillStyle=c.c; ctx.font=`700 ${U*6}px "Instrument Sans", system-ui, sans-serif`; ctx.textAlign="center"; ctx.save(); ctx.scale(c.dir,1); ctx.fillText(T("CONSEGNE"),c.dir*(-L2+c.len*0.37),-U*16); ctx.restore();
    wheel(-L2+U*12,U*5.5); wheel(L2-U*10,U*5.5); }
  else if (c.type==="bus"){ ctx.fillStyle="#e07b2b"; roundRect(ctx,-L2,-U*40,c.len,U*34,U*5); ctx.fill(); ctx.fillStyle="#f6f1e4"; ctx.fillRect(-L2,-U*16,c.len,U*4);
    ctx.fillStyle=glass; for(let k=-L2+U*6;k<L2-U*14;k+=U*16) ctx.fillRect(k,-U*35,U*13,U*14); ctx.fillRect(L2-U*12,-U*35,U*10,U*20);
    if (L.lamp>0.2){ ctx.fillStyle=`rgba(255,220,150,${0.6*L.lamp})`; for(let k=-L2+U*6;k<L2-U*14;k+=U*16) ctx.fillRect(k,-U*35,U*13,U*14); }
    wheel(-L2+U*18,U*6); wheel(L2-U*20,U*6); }
  else if (c.type==="ape"){ /* l'Ape con le cassette */
    ctx.fillStyle=c.c2; roundRect(ctx,L2-U*16,-U*28,U*15,U*21,U*5); ctx.fill(); ctx.fillStyle=glass; roundRect(ctx,L2-U*12,-U*25,U*10,U*9,U*3); ctx.fill();
    ctx.fillStyle="#8a6a40"; ctx.fillRect(-L2,-U*15,c.len-U*16,U*8);
    const crate=["#e0662a","#e3b21b","#5c7a2e"]; for(let k=0;k<3;k++){ ctx.fillStyle="#b58a55"; ctx.fillRect(-L2+U*2+k*U*7,-U*21,U*6,U*6); ctx.fillStyle=crate[k]; for(let q=0;q<3;q++){ ctx.beginPath(); ctx.arc(-L2+U*3.5+k*U*7+q*U*1.6,-U*21.5,U*1.3,0,TAU); ctx.fill(); } }
    wheel(-L2+U*8,U*4); wheel(L2-U*8,U*4); }
  else if (c.type==="vespa"){ ctx.fillStyle=c.c; ctx.beginPath(); ctx.moveTo(-L2+U*2,-U*6); ctx.quadraticCurveTo(-L2,-U*16,-L2+U*10,-U*15); ctx.lineTo(U*3,-U*13); ctx.lineTo(L2-U*5,-U*24); ctx.lineTo(L2-U*2,-U*23); ctx.lineTo(L2-U*3,-U*6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="#333"; ctx.lineWidth=U*1.2; ctx.beginPath(); ctx.moveTo(L2-U*4,-U*24); ctx.lineTo(L2-U*7,-U*28); ctx.stroke();
    drawRider(ctx,-U*3,-U*15,U,c.rider,true); wheel(-L2+U*5,U*3.5); wheel(L2-U*4,U*3.5); }
  else { /* bicicletta */
    ctx.strokeStyle=c.c; ctx.lineWidth=U*1.4; wheel(-L2+U*5,U*5.5); wheel(L2-U*5,U*5.5); ctx.strokeStyle=c.c; ctx.beginPath(); ctx.moveTo(-L2+U*5,-U*5.5); ctx.lineTo(-U*1,-U*14); ctx.lineTo(L2-U*7,-U*14); ctx.lineTo(L2-U*5,-U*5.5); ctx.moveTo(-U*1,-U*14); ctx.lineTo(U*2,-U*5.5); ctx.lineTo(-L2+U*5,-U*5.5); ctx.stroke();
    drawRider(ctx,-U*2,-U*16,U,c.rider,false); }
  ctx.restore();
}
function drawPlane(ctx,p,L){
  const U=G.U, y=p.y+Math.sin(G.t*1.2+p.ph0)*U*3, x=p.x, d=p.dir;
  const tail=x-d*U*18, b1=tail-d*U*26, b2=b1-d*p.bw;            /* lo striscione sta dietro alla coda */
  const left=Math.min(b1,b2), col=p.shop?p.shop.color:"#1f6b88";
  ctx.strokeStyle="rgba(60,50,40,.55)"; ctx.lineWidth=U*0.8; ctx.beginPath(); ctx.moveTo(tail,y); ctx.lineTo(b1,y-p.bh*0.35); ctx.moveTo(tail,y); ctx.lineTo(b1,y+p.bh*0.35); ctx.stroke();
  const N=16, top=[], bot=[];
  for (let k=0;k<=N;k++){ const xx=left+p.bw*k/N, w=Math.sin(G.t*5+k*0.7)*U*2.4*(d>0?(N-k)/N:k/N); top.push([xx,y-p.bh/2+w]); bot.push([xx,y+p.bh/2+w]); }
  ctx.fillStyle="#fffdf6"; ctx.beginPath(); top.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b)); for(let k=N;k>=0;k--) ctx.lineTo(bot[k][0],bot[k][1]); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=col; ctx.lineWidth=U*2; ctx.stroke();
  ctx.font=`${p.fs}px Gloock, Georgia, serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle=p.shop?shade(col,-0.3):"#1f6b88";
  ctx.fillText(p.txt, left+p.bw/2, y+Math.sin(G.t*5+N*0.35)*U*1.2);
  /* l'aereo */
  ctx.save(); ctx.translate(x,y); ctx.scale(d,1);
  ctx.fillStyle="#c8372d"; ctx.beginPath(); ctx.moveTo(-U*18,-U*1); ctx.lineTo(-U*22,-U*10); ctx.lineTo(-U*15,-U*2); ctx.fill();
  ctx.fillStyle="#f3efe6"; ctx.beginPath(); ctx.ellipse(0,0,U*18,U*4.6,0,0,TAU); ctx.fill();
  ctx.fillStyle="#c8372d"; ctx.fillRect(-U*14,-U*1,U*28,U*2);
  ctx.fillStyle="#e3ddd0"; ctx.beginPath(); ctx.moveTo(-U*4,0); ctx.lineTo(U*6,0); ctx.lineTo(U*2,U*10); ctx.lineTo(-U*6,U*10); ctx.fill();
  ctx.fillStyle=css(mx(c3("#9fd0e4"),c3("#2a3346"),L.dark*0.8)); ctx.beginPath(); ctx.ellipse(U*7,-U*2.5,U*4,U*2.4,0,Math.PI,0); ctx.fill();
  ctx.strokeStyle="rgba(60,60,60,.7)"; ctx.lineWidth=U*1.2; const pr=Math.sin(G.t*40)*U*6; ctx.beginPath(); ctx.moveTo(U*18.5,-pr); ctx.lineTo(U*18.5,pr); ctx.stroke();
  if (L.lamp>0.3 && Math.sin(G.t*6)>0.6){ ctx.fillStyle="#ff4a3a"; ctx.beginPath(); ctx.arc(-U*20,-U*9,U*1.4,0,TAU); ctx.fill(); }
  ctx.restore();
  const xs=[left, left+p.bw, x-U*20, x+U*20], x0=Math.min(...xs), x1=Math.max(...xs);
  p.hit={x:x0-U*4, y:y-p.bh/2-U*8, w:x1-x0+U*8, h:p.bh+U*16};
}
function drawRider(ctx,x,y,U,o,helmet){ ctx.strokeStyle=o.pants; ctx.lineWidth=U*2.6; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+U*6,y+U*1); ctx.lineTo(x+U*6,y+U*8); ctx.stroke();
  ctx.fillStyle=o.c; roundRect(ctx,x-U*4,y-U*14,U*8,U*14,U*3.5); ctx.fill(); ctx.strokeStyle=shade(o.c,-0.2); ctx.lineWidth=U*2; ctx.beginPath(); ctx.moveTo(x+U*2,y-U*11); ctx.lineTo(x+U*10,y-U*8); ctx.stroke();
  ctx.fillStyle=o.skin; ctx.beginPath(); ctx.arc(x+U*1,y-U*18,U*4.2,0,TAU); ctx.fill(); if(helmet){ ctx.fillStyle="#fbf8f1"; ctx.beginPath(); ctx.arc(x+U*1,y-U*19,U*4.6,Math.PI,0); ctx.fill(); } else { ctx.fillStyle=o.hair; ctx.beginPath(); ctx.arc(x+U*1,y-U*19,U*4.3,Math.PI*1.05,Math.PI*1.95); ctx.fill(); } }

/* ---------- persone collegate (presenza in tempo reale) ---------- */
function myState(){ const o=G.opts.me; return { k:o.kind||"v", c:G.me?G.me.c:o.c, fx:+(G.me.tx/G.W).toFixed(4), fy:+floorF(G.me.ty).toFixed(3), s:o.kind==="a"?o.shop:undefined, n:o.kind==="a"?(o.name||"").slice(0,30):undefined }; }
function publish(){ try{ G.opts.net && G.opts.net.update(myState()); }catch(_){} }
function onPresence(state){
  const seen=new Set(); const myKey=G.opts.me.key;
  for (const [key,metas] of Object.entries(state||{})){ if (key===myKey) continue; const m=metas&&metas[metas.length-1]; if(!m) continue; seen.add(key);
    let p=G.peers.get(key); const fresh=!p;
    if (!p){ p=mkOmino({seed:hash(key), real:true}); p.al=0; G.peers.set(key,p); }
    p.c=/^#[0-9a-f]{6}$/i.test(m.c||"")?m.c:p.c; p.kind=m.k==="a"?"a":"v"; p.shop=m.s; p.name=m.k==="a"?String(m.n||"").slice(0,30):"";
    let tx=clamp(+m.fx||0.5,0,1)*G.W, ty=floorY(+m.fy||0.5);
    if (p.kind==="a" && p.shop){ const it=shopItem(p.shop); if(it){ tx=doorOf(it)+G.U*16; ty=G.yB+G.U*12; } }
    p.tx=tx; p.ty=ty; if (fresh){ p.x=tx; p.y=ty; }
  }
  for (const k of [...G.peers.keys()]) if(!seen.has(k)) G.peers.delete(k);
  updateCount();
}
function updateCount(){ const el=G.ui&&G.ui.querySelector(".pz-count b"); if(!el) return; const n=G.peers.size+1;
  el.textContent = n===1 ? T("Solo tu in piazza ora") : T(`${n} persone in piazza ora`); }

/* ---------- tocchi e trascinamenti ---------- */
function toWorld(e){ const r=G.cv.getBoundingClientRect(); return { x:e.clientX-r.left+G.camX, y:e.clientY-r.top, sx:e.clientX-r.left }; }
function hitShop(p){ for (const it of G.items){ if(it.type==="palazzo"||!it.hit) continue; const h=it.hit; if (p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=G.yB) return it; } return null; }
function onDown(e){ if (e.button!=null && e.button!==0) return; G.drag={x:e.clientX, y:e.clientY, cam:G.camX, moved:false, t:performance.now(), lx:e.clientX, lt:performance.now(), id:e.pointerId}; G.vel=0; G.camT=null; }
function onMove(e){
  const d=G.drag;
  if (!d){ if (e.pointerType==="mouse"){ const p=toWorld(e); G.cv.style.cursor = hitAd(p)||hitShop(p)||p.y>G.yB ? "pointer" : "grab"; } return; }
  const dx=e.clientX-d.x, dy=e.clientY-d.y;
  if (!d.moved && Math.abs(dx)>8 && Math.abs(dx)>Math.abs(dy)){ d.moved=true; try{ G.cv.setPointerCapture(d.id); }catch(_){} }
  if (!d.moved && Math.abs(dy)>10){ G.drag=null; return; }   /* sta scorrendo la pagina */
  if (d.moved){ G.camX=clamp(d.cam-dx,0,Math.max(0,G.W-G.vw)); const t=performance.now(); if(t-d.lt>0){ G.vel=lerp(G.vel,(e.clientX-d.lx)/((t-d.lt)/1000),0.4); } d.lx=e.clientX; d.lt=t; hideHint(); }
}
function onUp(e){ const d=G.drag; G.drag=null; if(!d) return; if(d.moved){ if(performance.now()-d.lt>80) G.vel=0; return; } G.vel=0; tap(toWorld(e)); }
function hitAd(p){
  for (const pl of G.planes){ const h=pl.hit; if (h && p.sx>=Math.min(h.x,h.x+h.w) && p.sx<=Math.max(h.x,h.x+h.w) && p.y>=h.y && p.y<=h.y+h.h) return {kind:"aereo", shop:pl.shop}; }
  for (const c of G.cars){ if (c.type!=="adtruck"||!c.hit) continue; const h=c.hit; if (p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h) return {kind:"camion", shop:c.shop}; }
  return null;
}
function tap(p){
  hideHint();
  const ad=hitAd(p); if (ad){ showAd(ad); return; }
  const it=hitShop(p);
  if (it){ select(it); return; }
  /* tocco sul mio omino: cambio colore della maglia */
  const s=G.U*(1.02+floorF(G.me.y)*0.4);
  if (Math.abs(p.x-G.me.x)<s*9 && p.y>G.me.y-s*42 && p.y<G.me.y+s*4){ const i=(CLOTH.indexOf(G.me.c)+1)%CLOTH.length; G.me.c=CLOTH[i]; try{ localStorage.setItem("lb-omino-c",G.me.c); }catch(_){} G.mePending=true; return; }
  if (p.y>G.yB && p.y<G.yC+G.U*4){ G.me.tx=clamp(p.x,10,G.W-10); G.me.ty=clamp(p.y,floorY(0),floorY(1)); G.me.arrive=null; G.me.wait=0; G.mePending=true; closeCard(); }
}
function select(it){
  const U=G.U; G.sel = it.type==="free" ? "__free" : it.s.id;
  G.me.tx=it.x+it.w*(it.type==="free"?0.5:0.74); G.me.ty=G.yB+U*11; G.me.wait=0; G.me.arrive=null; G.mePending=true;
  const card=G.ui.querySelector(".pz-card"); card.hidden=false;
  if (it.type==="free"){ const f=G.opts.free;
    card.innerHTML=`<button class="pz-x" type="button" aria-label="${esc(T("Chiudi"))}">×</button><span class="pz-k">${esc(T("Posto libero"))}</span><b>${esc(T("Qui c'è posto per la tua bottega"))}</b><span class="pz-sub">${esc(f.sub||"")}</span><a class="btn primary sm" href="/la-mia-bottega" data-pz-free>${esc(f.cta||T("Apri la tua bottega"))}</a>`;
  } else { const s=it.s;
    card.innerHTML=shopCardHtml(s); }
}
function shopCardHtml(s, k){
  return `<button class="pz-x" type="button" aria-label="${esc(T("Chiudi"))}">×</button><span class="pz-k">${esc(k || [s.categoria,s.paese].filter(Boolean).join(" · "))}</span><b>${esc(s.nome)}</b>${s.produttore?`<span class="pz-sub">${esc(T("di "+s.produttore))}</span>`:s.paese&&k?`<span class="pz-sub">${esc([s.categoria,s.paese].filter(Boolean).join(" · "))}</span>`:""}<a class="btn primary sm" href="/b/${encodeURIComponent(s.id)}" data-pz-open="${esc(s.id)}">${esc(T("Entra in bottega →"))}</a>`;
}
function showAd(ad){
  const card=G.ui.querySelector(".pz-card"); card.hidden=false; G.sel=ad.shop?ad.shop.id:null;
  if (ad.shop){ card.innerHTML=shopCardHtml(ad.shop, ad.kind==="aereo"?T("Striscione in cielo"):T("Camion in piazza")); return; }
  card.innerHTML=`<button class="pz-x" type="button" aria-label="${esc(T("Chiudi"))}">×</button><span class="pz-k">${esc(T("Pubblicità in piazza"))}</span><b>${esc(ad.kind==="aereo"?T("Il tuo striscione in cielo"):T("Il tuo camion in piazza"))}</b><span class="pz-sub">${esc(T("Con le monete delle missioni gli artigiani fanno girare qui il nome della loro bottega."))}</span><a class="btn primary sm" href="/la-mia-bottega" data-pz-mis>${esc(T("Scopri le missioni"))}</a>`;
}
function closeCard(){ G.sel=null; const c=G.ui&&G.ui.querySelector(".pz-card"); if(c) c.hidden=true; }
function hideHint(){ if(!G.hint) return; G.hint=false; const h=G.ui&&G.ui.querySelector(".pz-hint"); if(h) h.classList.add("gone"); }
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------- l'orologio ---------- */
function clockText(){ const m=romeHM(now()); return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"); }
function syncClock(){ const ui=G.ui; if(!ui) return; const o=ui.querySelector(".pz-time"); if(o) o.textContent=clockText(); const rg=ui.querySelector(".pz-range"); if(rg && document.activeElement!==rg) rg.value=romeHM(now()); const nb=ui.querySelector("[data-pz-now]"); if(nb) nb.hidden=!G.tOff&&!G.play; const pb=ui.querySelector("[data-pz-play]"); if(pb){ pb.setAttribute("aria-pressed",String(G.play)); pb.textContent=G.play?"❚❚":"▶"; } }

/* ---------- montaggio ---------- */
function mount(host, opts){
  G.opts=opts;
  const reuse = G.host===host && G.cv && G.cv.isConnected;
  G.host=host;
  if (!reuse){
    host.innerHTML=`<canvas class="pz-cv" aria-hidden="true"></canvas>
      <div class="pz-ui">
        <div class="pz-head"><span class="pz-eyebrow"><i class="pz-live" aria-hidden="true"></i>${esc(T("La piazza · in diretta"))}</span><h2 class="pz-title">${esc(T("Passeggia tra le botteghe"))}</h2></div>
        <div class="pz-count" role="status"><b></b><span>${esc(T("Gli omini con la coppola sono persone collegate adesso"))}</span></div>
        <div class="pz-card" hidden></div>
        <p class="pz-hint">${esc(T("Tocca la piazza per muovere il tuo omino, tocca una bottega per entrare. Trascina per passeggiare."))}</p>
        <button class="pz-arr pz-l" type="button" aria-label="${esc(T("Vai a sinistra"))}">‹</button><button class="pz-arr pz-r" type="button" aria-label="${esc(T("Vai a destra"))}">›</button>
        <div class="pz-clock"><button type="button" class="pz-cb" data-pz-play aria-pressed="false" title="${esc(T("Una giornata in 30 secondi"))}" aria-label="${esc(T("Una giornata in 30 secondi"))}">▶</button><label class="pz-rl"><span class="pz-time"></span><input class="pz-range" type="range" min="0" max="1439" step="5" aria-label="${esc(T("Ora del giorno in piazza"))}"></label><button type="button" class="pz-cb pz-now" data-pz-now hidden>${esc(T("Adesso"))}</button></div>
      </div>`;
    G.cv=host.querySelector("canvas"); G.ctx=G.cv.getContext("2d"); G.ui=host.querySelector(".pz-ui");
    if (!G.hint) G.ui.querySelector(".pz-hint").classList.add("gone");
    const cv=G.cv;
    cv.addEventListener("pointerdown",onDown); cv.addEventListener("pointermove",onMove); cv.addEventListener("pointerup",onUp); cv.addEventListener("pointercancel",()=>{ G.drag=null; });
    cv.addEventListener("wheel",e=>{ if (Math.abs(e.deltaX)>Math.abs(e.deltaY)||e.shiftKey){ e.preventDefault(); G.camT=null; G.camX=clamp(G.camX+(e.deltaX||e.deltaY),0,Math.max(0,G.W-G.vw)); hideHint(); } },{passive:false});
    G.ui.addEventListener("click",e=>{
      const t=e.target;
      if (t.closest(".pz-x")){ closeCard(); return; }
      const op=t.closest("[data-pz-open]"); if(op){ e.preventDefault(); opts.onOpen && G.opts.onOpen(op.dataset.pzOpen); return; }
      if (t.closest("[data-pz-free]")){ e.preventDefault(); G.opts.onFree && G.opts.onFree(); return; }
      if (t.closest("[data-pz-mis]")){ e.preventDefault(); (G.opts.onMissioni||G.opts.onFree) && (G.opts.onMissioni||G.opts.onFree)(); return; }
      if (t.closest(".pz-l")){ G.camT=clamp(G.camX-G.vw*0.7,0,Math.max(0,G.W-G.vw)); hideHint(); return; }
      if (t.closest(".pz-r")){ G.camT=clamp(G.camX+G.vw*0.7,0,Math.max(0,G.W-G.vw)); hideHint(); return; }
      if (t.closest("[data-pz-play]")){ G.play=!G.play; syncClock(); return; }
      if (t.closest("[data-pz-now]")){ G.play=false; G.tOff=0; syncClock(); return; }
    });
    G.ui.querySelector(".pz-range").addEventListener("input",e=>{ G.play=false; const want=+e.target.value, cur=romeHM(new Date()); G.tOff=(want-cur)*60000; syncClock(); });
    if (G.ro) G.ro.disconnect(); G.ro=new ResizeObserver(()=>resize()); G.ro.observe(host);
    if (G.io) G.io.disconnect(); G.io=new IntersectionObserver(es=>{ G.visible=es[0].isIntersecting; },{rootMargin:"60px"}); G.io.observe(host);
  }
  resize(true);
  if (G.hint && !G.hintT) G.hintT=setTimeout(hideHint, 9000);
  /* la presenza: entro in piazza */
  try{ opts.net && opts.net.start(opts.me.key, myState(), onPresence); }catch(_){}
  updateCount(); syncClock();
  if (!G.raf){ G.last=0; G.raf=requestAnimationFrame(frame); }
}
function resize(force){
  const host=G.host; if(!host) return; const vw=host.clientWidth, H=host.clientHeight; if(!vw||!H) return;
  const key=vw+"x"+H+"|"+(G.opts.shops||[]).map(s=>s.id+s.nome+s.color).join(",")+"|"+!!G.opts.free;
  if (!force && key===G.layoutKey) return;
  const oldW=G.W||0, frac=oldW?G.camX/oldW:0, oldH=G.H;
  G.vw=vw; G.H=H; G.dpr=Math.min(2, window.devicePixelRatio||1);
  G.cv.width=Math.round(vw*G.dpr); G.cv.height=Math.round(H*G.dpr);
  if (key!==G.layoutKey){
    const wasW=G.W, wasYB=G.yB, wasYC=G.yC;
    layout(); G.layoutKey=key;
    if (wasW && (wasW!==G.W || oldH!==H)){ const rx=G.W/wasW; const remap=o=>{ o.x*=rx; o.tx*=rx; if(wasYB!=null){ const f=(o.y-wasYB)/((wasYC-wasYB)||1), ft=(o.ty-wasYB)/((wasYC-wasYB)||1); o.y=lerp(G.yB,G.yC,f); o.ty=lerp(G.yB,G.yC,ft); } };
      [G.me,...G.npcs,...G.peers.values()].forEach(remap); G.camX=clamp(frac*G.W,0,Math.max(0,G.W-G.vw)); G.cars=[]; G.birds=[]; for(let i=0;i<6;i++) G.birds.push(mkBird()); }
    makeFloor();
  }
}
function makeFloor(){ const U=G.U, c=document.createElement("canvas"), w=Math.round(U*36), h=Math.round(U*16); c.width=w*2; c.height=h*2; const x=c.getContext("2d");
  x.fillStyle="#dcc79c"; x.fillRect(0,0,w*2,h*2); x.strokeStyle="rgba(130,100,50,.22)"; x.lineWidth=Math.max(1,U*0.8);
  x.beginPath(); for(let r=0;r<2;r++){ const y=r*h; x.moveTo(0,y+0.5); x.lineTo(w*2,y+0.5); const off=r%2?w/2:0; for(let k=off;k<=w*2;k+=w){ x.moveTo(k+0.5,y); x.lineTo(k+0.5,y+h); } } x.stroke();
  const rr=rng(8); for(let i=0;i<14;i++){ x.fillStyle=`rgba(${rr()<0.5?"255,250,235":"150,115,60"},.10)`; x.fillRect(rr()*w*2,rr()*h*2,U*(4+rr()*10),U*(2+rr()*5)); }
  G.floorPat=G.ctx.createPattern(c,"repeat"); }
let lastClock=0;
function frame(ts){
  if (!G.cv || !G.cv.isConnected){ G.raf=0; try{ G.opts.net && G.opts.net.stop(); }catch(_){} G.peers.clear(); return; }
  G.raf=requestAnimationFrame(frame);
  if (!G.visible || document.hidden){ G.last=0; return; }
  if (RM.matches && G.last && ts-G.last<500 && !G.drag && G.camT==null) return;
  const dt=Math.min(0.05,G.last?(ts-G.last)/1000:0.016); G.last=ts;
  update(dt); draw();
  if (ts-lastClock>1000 || G.play){ lastClock=ts; syncClock(); }
}
window.LBPiazza = { mount, sunAt, state:G };
if (typeof window.LBPiazzaReady==="function") window.LBPiazzaReady();
})();
