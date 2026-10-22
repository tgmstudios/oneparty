// Costume contest leaderboard: a full-screen layer on the display (hub state S.contest). The host drives it from the control panel:
// board.on shows it, board.reveal counts how many places are uncovered starting from the LAST of the top N (drum-roll style, winner last).
// Guest-supplied text only ever goes through textContent.
const el = (cls, tag = 'div') => { const n = document.createElement(tag); n.className = cls; return n; };
const MEDAL = ['👑', '🥈', '🥉'];

export function createBoard(root) {
  root.innerHTML = '<div class="bd-head"><div class="bd-k"></div><div class="bd-t">COSTUME CONTEST</div><div class="bd-s"></div></div><div class="bd-list"></div><div class="bd-foot"></div>';
  const kicker = root.querySelector('.bd-k'), sub = root.querySelector('.bd-s'), list = root.querySelector('.bd-list'), foot = root.querySelector('.bd-foot');
  let sig = '', rows = [], wasDone = false;

  // 3D ballroom (leaderboard3d.js): lazy-loaded the first time the board shows. Any failure just leaves the 2D rows below as the fallback.
  let b3 = null, b3Load = false, b3Fail = false, b3Model = null, b3Off = 0;
  const fail3d = e => { b3Fail = true; b3 = null; root.classList.remove('b3d'); root.querySelector('.bd-3d')?.remove(); console.warn('leaderboard 3d off:', e?.message || e); };
  function show3d(model) {
    b3Model = model; clearTimeout(b3Off);
    if (b3Fail) return;
    if (b3) { try { b3.update(model); } catch (e) { fail3d(e); } return; }
    if (b3Load) return; b3Load = true;
    import('./leaderboard3d.js').then(m => { if (!root.classList.contains('on') || b3Fail) return; b3 = m.createBoard3D(root, { onError: fail3d }); root.classList.add('b3d'); b3.update(b3Model); }).catch(fail3d).finally(() => { b3Load = false; });
  }
  function hide3d() { clearTimeout(b3Off); if (b3) b3Off = setTimeout(() => { b3?.dispose(); b3 = null; root.classList.remove('b3d'); }, 800); }

  function confetti() {
    const colors = ['#ffd23f', '#ff6a10', '#ff3d81', '#46d3ff', '#9b6bff', '#46d37a'];
    for (let i = 0; i < 90; i++) {
      const c = el('bd-conf'); c.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};--dx:${(Math.random() - 0.5) * 30}vw;--r:${Math.random() * 900 - 450}deg;animation-duration:${3.2 + Math.random() * 2.8}s;animation-delay:${Math.random() * 0.9}s;width:${0.5 + Math.random() * 0.6}vw;height:${0.8 + Math.random() * 1}vw`;
      root.appendChild(c); setTimeout(() => c.remove(), 7500);
    }
  }
  function build(n) {
    list.replaceChildren(); rows = [];
    for (let i = 0; i < n; i++) {
      const row = el('bd-row'), rank = el('bd-rank'), img = el('bd-img', 'img'), mid = el('bd-mid'), t = el('bd-c'), who = el('bd-n'), bar = el('bd-bar'), fill = el('bd-fill'), votes = el('bd-v');
      img.alt = ''; bar.appendChild(fill); mid.append(t, who, bar); row.append(rank, img, mid, votes); list.appendChild(row);
      rows.push({ row, rank, img, t, who, fill, votes });
    }
  }

  return {
    update(S) {
      const C = S?.contest, b = C?.board, on = !!(b?.on && C);
      root.classList.toggle('on', on);
      if (!on) { sig = ''; hide3d(); return; }
      const n = Math.min(b.top || 5, C.ranking.length), revealed = Math.min(n, b.reveal || 0);
      const s = JSON.stringify([n, revealed, C.ranking.slice(0, n).map(r => [r.id, r.name, r.costume, r.image, r.votes, r.rank]), C.config?.votingOpen, C.config?.title]);
      if (s === sig) return; sig = s;
      show3d({ n, revealed, rows: C.ranking.slice(0, n).map(r => ({ id: r.id, name: r.name, costume: r.costume, image: r.image, votes: r.votes, rank: r.rank })), voting: !!C.config?.votingOpen });
      kicker.textContent = (S.event?.title || '').toUpperCase();
      sub.textContent = revealed >= n && n ? 'THE WINNERS' : C.config?.votingOpen ? 'VOTING IS OPEN' : 'AND THE WINNER IS…';
      if (rows.length !== n) build(n);
      const top = Math.max(1, ...C.ranking.slice(0, n).map(r => r.votes));
      for (let i = 0; i < n; i++) {
        const r = C.ranking[i], x = rows[i], shown = i >= n - revealed;
        const wasShown = x.row.classList.contains('show');
        x.row.classList.toggle('show', shown); x.row.classList.toggle('win', shown && r.rank === 1);
        x.rank.textContent = shown ? (MEDAL[r.rank - 1] || r.rank) : '?';
        x.t.textContent = shown ? r.costume : '• • •'; x.who.textContent = shown ? r.name : '';
        x.votes.textContent = shown ? r.votes + (r.votes === 1 ? ' vote' : ' votes') : '';
        x.fill.style.width = shown ? Math.max(2, Math.round(r.votes / top * 100)) + '%' : '0%';
        if (shown && r.image) { if (x.img.getAttribute('src') !== r.image) x.img.src = r.image; x.img.style.visibility = 'visible'; } else { x.img.removeAttribute('src'); x.img.style.visibility = 'hidden'; }
        if (shown && !wasShown) { x.row.classList.remove('pop'); void x.row.offsetWidth; x.row.classList.add('pop'); }
      }
      foot.textContent = C.totals ? `${C.totals.entries} costumes · ${C.totals.votes} votes` : '';
      const done = n > 0 && revealed >= n; if (done && !wasDone && !b3) confetti(); wasDone = done;
    },
  };
}
