"use strict";
/* ════════════════════════════════════════════════════════════════
   arcade.js — gedeelde bouwstenen voor de canvas-arcadespellen
   (Planeetverdediger, Neontunnel en Sterrensprong):
   canvas schalen, vaste tijdstap, gesynthetiseerd geluid,
   neon-sprites, tekst, records en pauzeren bij een app-wissel.

   Verwachte opbouw van de pagina:
     <div id="wrap"><div id="spel"><canvas id="cv"></canvas> …knoppen… </div></div>
════════════════════════════════════════════════════════════════ */
const Arcade = (() => {
  const LETTER = '"Segoe UI", system-ui, -apple-system, sans-serif';

  /* ── Canvas: vaste logische maat W×H, geschaald naar de beschikbare ruimte ── */
  function maakCanvas(cv, W, H) {
    const ctx = cv.getContext('2d');
    const spel = cv.parentElement, wrap = spel.parentElement;
    let laatste = '';
    function pas() {
      const bw = wrap.clientWidth - 16, bh = wrap.clientHeight - 16;
      const dpr = window.devicePixelRatio || 1;
      const maat = bw + 'x' + bh + '@' + dpr;
      if (maat === laatste) return;
      laatste = maat;
      const s = Math.max(0.3, Math.min(bw / W, bh / H));
      spel.style.width = (W * s) + 'px';
      spel.style.height = (H * s) + 'px';
      cv.width = Math.round(W * s * dpr);
      cv.height = Math.round(H * s * dpr);
      ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    }
    window.addEventListener('resize', pas);
    if (window.ResizeObserver) new ResizeObserver(pas).observe(wrap);
    pas();
    return ctx;
  }

  // positie van een pointer-event in logische coördinaten
  function punt(cv, e, W, H) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }

  /* ── Lus met vaste tijdstap: 60 updates per seconde, op elk scherm even snel ── */
  function lus(update, teken) {
    const STAP = 1000 / 60;
    let vorige = null, acc = 0;
    function frame(nu) {
      if (vorige === null) vorige = nu;
      acc += nu - vorige;
      vorige = nu;
      if (acc > 250) acc = 250;            // na een tab-wissel niet inhalen
      let n = 0;
      while (acc >= STAP && n++ < 5) { update(); acc -= STAP; }
      teken();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ── Geluid: alles met WebAudio opgewekt, geen bestanden ──
     start() moet vanuit een klik of toets komen: browsers blokkeren geluid daarvoor. */
  function maakGeluid(sleutel, knop) {
    let ac = null, master = null, ruis = null, aan = true;
    try { aan = localStorage.getItem(sleutel) !== 'uit'; } catch (e) {}
    const laatst = {};

    const g = {
      get aan() { return aan; },
      start() {
        if (!aan) return;
        if (!ac) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ac = new AC();
          master = ac.createGain();
          master.gain.value = 0.25;
          master.connect(ac.destination);
          const len = Math.floor(ac.sampleRate * 1.2);
          ruis = ac.createBuffer(1, len, ac.sampleRate);
          const d = ruis.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === 'suspended') ac.resume();
      },
      toon(f, duur, vorm, vol, naar, wacht = 0) {
        if (!aan || !ac) return;
        const t = ac.currentTime + wacht;
        const o = ac.createOscillator(), gn = ac.createGain();
        o.type = vorm;
        o.frequency.setValueAtTime(f, t);
        if (naar) o.frequency.exponentialRampToValueAtTime(naar, t + duur);
        gn.gain.setValueAtTime(vol, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + duur);
        o.connect(gn); gn.connect(master);
        o.start(t); o.stop(t + duur + 0.02);
      },
      knal(duur, vol, freq, naar = 50) {
        if (!aan || !ac) return;
        const t = ac.currentTime;
        const s = ac.createBufferSource(); s.buffer = ruis;
        const f = ac.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(freq, t);
        f.frequency.exponentialRampToValueAtTime(naar, t + duur);
        const gn = ac.createGain();
        gn.gain.setValueAtTime(vol, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + duur);
        s.connect(f); f.connect(gn); gn.connect(master);
        s.start(t); s.stop(t + duur);
      },
      // hooguit één keer per `ms` milliseconden van dezelfde soort: geen ratelende brij
      mag(soort, ms) {
        const nu = performance.now();
        if (laatst[soort] && nu - laatst[soort] < ms) return false;
        laatst[soort] = nu;
        return true;
      },
      wissel() {
        aan = !aan;
        try { localStorage.setItem(sleutel, aan ? 'aan' : 'uit'); } catch (e) {}
        if (aan) g.start();
        werkKnopBij();
      },
    };
    function werkKnopBij() {
      if (!knop) return;
      knop.textContent = aan ? '🔊 Geluid' : '🔇 Geluid';
      knop.classList.toggle('uit', !aan);
    }
    if (knop) knop.addEventListener('click', () => { g.wissel(); knop.blur(); });
    werkKnopBij();
    return g;
  }

  /* ── Sprites: de neon-gloed (shadowBlur) is duur, dus één keer vooraf tekenen ── */
  const SPR = 2;
  function sprite(w, h, teken) {
    const c = document.createElement('canvas');
    c.width = w * SPR; c.height = h * SPR;
    const g = c.getContext('2d');
    g.scale(SPR, SPR);
    g.translate(w / 2, h / 2);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    teken(g);
    return { c, w, h };
  }
  function tekenSprite(ctx, s, x, y, hoek = 0, schaal = 1, schaalY = schaal) {
    if (!hoek && schaal === 1 && schaalY === 1) { ctx.drawImage(s.c, x - s.w / 2, y - s.h / 2, s.w, s.h); return; }
    ctx.save();
    ctx.translate(x, y);
    if (hoek) ctx.rotate(hoek);
    ctx.drawImage(s.c, -s.w / 2 * schaal, -s.h / 2 * schaalY, s.w * schaal, s.h * schaalY);
    ctx.restore();
  }
  function poly(g, pts) {
    g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
  }
  function regelmatig(g, n, r, start = 0) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = start + i * Math.PI * 2 / n; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    poly(g, pts);
  }
  // neon-lijn: gekleurde gloed + een dunne lichte kern
  function neon(g, pad, kleur, dikte = 2.5, gloed = 10, vulling = 'rgba(10,10,28,0.88)') {
    if (vulling) { g.fillStyle = vulling; pad(); g.fill(); }
    g.save();
    g.shadowColor = kleur; g.shadowBlur = gloed;
    g.strokeStyle = kleur; g.lineWidth = dikte;
    pad(); g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = Math.max(0.6, dikte * 0.32);
    pad(); g.stroke();
  }
  // gloeiend bolletje (kogels, lichtjes)
  function bol(kleur, r, kern = '#fff') {
    return sprite(r * 2 + 16, r * 2 + 16, g => {
      g.shadowColor = kleur; g.shadowBlur = 9;
      g.fillStyle = kleur; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0; g.fillStyle = kern; g.beginPath(); g.arc(0, 0, r * 0.5, 0, Math.PI * 2); g.fill();
    });
  }

  /* ── Tekst ── */
  function tekst(ctx, t, x, y, maat, kleur, uitlijning = 'center', gewicht = 700) {
    ctx.font = `${gewicht} ${maat}px ${LETTER}`;
    ctx.textAlign = uitlijning;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = kleur;
    ctx.fillText(t, x, y);
  }
  function gloeiTekst(ctx, t, x, y, maat, kleur, gloed = 14) {
    ctx.font = `900 ${maat}px ${LETTER}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = kleur; ctx.shadowBlur = gloed;
    ctx.fillStyle = kleur;
    ctx.fillText(t, x, y);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(t, x, y);
  }
  const getal = n => Math.floor(n).toLocaleString('nl-NL');

  /* ── Record (alleen in deze browser) ── */
  function record(sleutel) {
    return {
      lees() { try { return Number(localStorage.getItem(sleutel)) || 0; } catch (e) { return 0; } },
      bewaar(v) { try { localStorage.setItem(sleutel, String(Math.floor(v))); } catch (e) {} },
    };
  }

  const aanraak = () => window.matchMedia('(pointer: coarse)').matches;

  // pauzeren als je van tabblad of app wisselt
  function pauzeBijWissel(pauzeer) {
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauzeer(); });
    window.addEventListener('blur', pauzeer);
  }

  const willekeurig = (a, b) => a + Math.random() * (b - a);

  return { LETTER, maakCanvas, punt, lus, maakGeluid, sprite, tekenSprite, poly, regelmatig, neon, bol,
           tekst, gloeiTekst, getal, record, aanraak, pauzeBijWissel, willekeurig };
})();
