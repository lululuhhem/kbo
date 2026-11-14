/* 기록 → 능력치 → 연봉 계산 (index.html, data.html 공용) */
(function (G) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const reg = (raw, mean, n, k) => mean + (raw - mean) * (n / (n + k)); // 표본 적으면 평균 쪽으로

  // 타자: c 컨택, p 파워, e 선구, s 주력, d 수비
  function hitterRatings(st, pos) {
    const PA = st.PA || ((st.AB || 0) + (st.BB || 0) + (st.HBP || 0)) || 1;
    const AB = st.AB || PA * 0.88;
    const H = st.H || 0, D = st['2B'] || 0, T = st['3B'] || 0, HR = st.HR || 0;
    const avg = AB > 0 ? H / AB : 0;
    const k = (st.SO || 0) / PA;
    const iso = AB > 0 ? (D + 2 * T + 3 * HR) / AB : 0;
    const bb = ((st.BB || 0) + (st.HBP || 0)) / PA;
    let c = 50 + (avg - 0.265) * 420 - (k - 0.17) * 110;
    let p = 45 + (iso - 0.13) * 210 + (HR / PA - 0.024) * 420;
    let e = 50 + (bb - 0.09) * 340;
    let s = 40 + ((st.SB || 0) / PA) * 420 + (T / PA) * 1400;
    c = reg(c, 42, PA, 120); p = reg(p, 42, PA, 120); e = reg(e, 45, PA, 120); s = reg(s, 45, PA, 80);
    let d = st.DEF != null ? st.DEF : 55;
    return { c: Math.round(clamp(c, 20, 99)), p: Math.round(clamp(p, 20, 99)), e: Math.round(clamp(e, 20, 99)), s: Math.round(clamp(s, 20, 99)), d: Math.round(clamp(d, 20, 99)) };
  }

  function ipToOuts(ip) {
    if (ip == null) return 0;
    if (typeof ip === 'number') { const w = Math.floor(ip); const f = Math.round((ip - w) * 10); return w * 3 + (f >= 1 && f <= 2 ? f : Math.round((ip - w) * 3)); }
    const s = String(ip).trim();
    let m = s.match(/^(\d+)\s+(\d)\/3$/); if (m) return (+m[1]) * 3 + (+m[2]);
    m = s.match(/^(\d)\/3$/); if (m) return +m[1];
    m = s.match(/^(\d+)\s*([⅓⅔])$/); if (m) return (+m[1]) * 3 + (m[2] === '⅓' ? 1 : 2);
    m = s.match(/^([⅓⅔])$/); if (m) return m[1] === '⅓' ? 1 : 2;
    m = s.match(/^(\d+)\.(\d)$/); if (m) return (+m[1]) * 3 + Math.min(2, +m[2]);
    const n = parseFloat(s); return isNaN(n) ? 0 : Math.round(n * 3);
  }

  // 투수: stf 구위, ctl 제구, sta 체력
  function pitcherRatings(st, roles) {
    const outs = st.OUTS != null ? st.OUTS : ipToOuts(st.IP);
    const ip = Math.max(outs / 3, 0.1);
    const k9 = (st.SO || 0) * 9 / ip, bb9 = ((st.BB || 0) + (st.HBP || 0) * 0.5) * 9 / ip, hr9 = (st.HR != null ? st.HR : ip * 0.09) * 9 / ip;
    const era = st.ERA != null ? +st.ERA : ((st.ER || 0) * 9 / ip);
    let stf = 50 + (k9 - 7.6) * 6.5 - (hr9 - 0.9) * 10 + (4.5 - era) * 3;
    let ctl = 50 - (bb9 - 3.6) * 11 + (4.5 - era) * 2.5;
    const roleSP = (roles || []).includes('SP'), roleRP = (roles || []).includes('RP');
    let G = st.G, GS = st.GS;
    if (G == null) G = roleSP ? Math.max(1, Math.round(ip / (roleRP ? 3.5 : 5.5))) : Math.max(1, Math.round(ip));
    if (GS == null) GS = (ip / G >= 3.2) ? G : 0;
    // 선발 등판이 적은 투수(롱릴리프·마무리)는 불펜 체력으로 계산
    const startShare = G ? GS / G : 0;
    let sta;
    if (GS >= 3 && startShare >= 0.5) sta = 55 + ((ip / Math.max(GS, 1)) - 5) * 14;
    else if (GS >= 3) { const spIp = Math.min(ip, GS * 5); sta = 40 + ((spIp / GS) - 4) * 10; }
    else sta = 25 + (ip / Math.max(G, 1) - 1) * 15 + (roleSP && !G ? 30 : 0);
    stf = reg(stf, 45, ip, 40); ctl = reg(ctl, 45, ip, 40);
    return { stf: Math.round(clamp(stf, 20, 99)), ctl: Math.round(clamp(ctl, 20, 99)), sta: Math.round(clamp(sta, 15, 95)) };
  }

  const POS_BONUS = { C: 5, SS: 4, CF: 3, '2B': 2, '3B': 1, RF: 0, LF: -1, '1B': -2 };
  // 능력치로 예상 OPS (경기 시뮬레이션과 같은 감각)
  function estOPS(r) {
    const obp = 0.330 + (r.c - 50) * 0.0022 + (r.e - 50) * 0.0022;
    const slg = 0.410 + (r.c - 50) * 0.0020 + (r.p - 50) * 0.0045;
    return obp + slg;
  }
  function hitterOvr(r, pos) {
    let best = -3;
    (pos || []).forEach(x => { if (POS_BONUS[x] != null && POS_BONUS[x] > best) best = POS_BONUS[x]; });
    const v = 50 + (estOPS(r) - 0.740) * 120 + best + (r.d - 55) * 0.15 + (r.s - 50) * 0.05;
    return Math.round(clamp(v, 25, 99));
  }
  function pitcherOvr(r, roles) {
    roles = roles || [];
    const spV = 62 + ((r.stf * 0.47 + r.ctl * 0.35 + r.sta * 0.18) - 55) * 1.9;
    const rpV = 55 + ((r.stf * 0.56 + r.ctl * 0.44) - 45) * 2.2;
    let v;
    if (roles.includes('SP') && roles.includes('RP')) v = Math.max(rpV, (spV + rpV) / 2);
    else if (roles.includes('SP')) v = spV;
    else v = rpV;
    return Math.round(clamp(v, 25, 99));
  }
  // 연봉(억 원). kind: 'H' 타자 / 'P' 투수, roles: 투수 역할
  function salary(ovr, kind, roles) {
    let s;
    if (kind === 'H') s = 0.5 + 46 * Math.pow(clamp((ovr - 38) / 55, 0, 1), 1.8);
    else s = 0.5 + 48 * Math.pow(clamp((ovr - 42) / 53, 0, 1), 2.2);
    if (kind === 'P') {
      roles = roles || [];
      if (roles.includes('CP')) s *= 1.1;            // 마무리 프리미엄
      else if (!roles.includes('SP')) s *= 0.8;       // 중간 계투
    }
    return Math.round(s * 10) / 10;
  }
  G.KBORatings = { hitterRatings, pitcherRatings, hitterOvr, pitcherOvr, salary, ipToOuts, estOPS };
})(typeof window !== 'undefined' ? window : globalThis);
