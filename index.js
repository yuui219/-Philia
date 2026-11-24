// ============ Philia（酒馆助手脚本）============
// 黑白卡片风 UI / 缩略图多重兜底加载 / 角标多选 / 点图直接应用 / 自定义标题·签名·头像·壁纸·主色
// 新增：美化页「批量」多选删除 · 标签栏「预览」3D 翻页预览美化（只同时渲染 3 张，轻量）
(() => {
  const P = window.parent;
  const D = P.document;
  const $P = P.$;
  const ID = 'bgmgr';
  const KEY = 'bgmgr_theme_map';
  const CFG = 'bgmgr_cfg';

  // ---------- 清理旧实例 ----------
  D.getElementById(ID + '-root')?.remove();
  D.getElementById(ID + '-style')?.remove();
  D.getElementById(ID + '-menu')?.remove();
  D.getElementById(ID + '-fx')?.remove();
  if (P.__bgmgr_timer) clearInterval(P.__bgmgr_timer);
  P.__bgmgr_swap = false; // 上次扫描中途被重载会遗留这个标记，导致绑定背景永远不生效
  const GEN = (P.__bgmgr_gen = (P.__bgmgr_gen || 0) + 1); // 旧实例的扫描循环会据此自动退出
  $P(D).off('.' + ID).off('.' + ID + 'snap');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- 工具 ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (P.toastr?.[t] ? P.toastr[t](m) : console.log(m));
  const hdr = (json = true) => {
    const h = { ...P.SillyTavern.getContext().getRequestHeaders() };
    if (!json) { delete h['Content-Type']; delete h['content-type']; }
    return h;
  };
  const getMap = () => { try { return JSON.parse(P.localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const setMap = m => P.localStorage.setItem(KEY, JSON.stringify(m));
  const DEF = { title: 'Philia', sub: "I'm the only one still thinking of you.", avatar: '', accent: '#000000', dark: false, wall: '', veil: 88, tmode: 'all', bfx: { bright: 100, op: 100, bl: 0 } };
  const getCfg = () => { try { return { ...DEF, ...JSON.parse(P.localStorage.getItem(CFG) || '{}') }; } catch { return { ...DEF }; } };
  const setCfg = c => { try { P.localStorage.setItem(CFG, JSON.stringify(c)); } catch { toast('保存设置失败（可能图片太大）', 'error'); } };
  let cfg = getCfg();
  cfg.bfx = { ...DEF.bfx, ...(cfg.bfx || {}) };
  const META = 'bgmgr_theme_meta';
  const getMeta = () => { try { return { pins: [], cats: {}, list: [], ...JSON.parse(P.localStorage.getItem(META) || '{}') }; } catch { return { pins: [], cats: {}, list: [] }; } };
  const setMeta = m => P.localStorage.setItem(META, JSON.stringify(m));
  const blurPx = v => +(Math.pow(v / 100, 2) * 12).toFixed(2); // 0-100 滑块，低段更细腻
  function applyBgFx() {
    let el = D.getElementById(ID + '-fx');
    if (!el) { el = D.createElement('style'); el.id = ID + '-fx'; D.head.appendChild(el); }
    const f = cfg.bfx, px = blurPx(f.bl);
    el.textContent = (f.bright == 100 && f.op == 100 && px == 0) ? '' :
      `#bg1,#bg_custom{filter:brightness(${f.bright}%) blur(${px}px)!important;opacity:${f.op / 100}!important;${px >= 1 ? 'transform:scale(1.05);' : ''}}`;
  }
  const curTheme = () => D.querySelector('#themes')?.value || '';
  const themes = () => [...D.querySelectorAll('#themes option')].map(o => o.value);
  const curBgName = () => {
    const s = D.querySelector('#bg1')?.style.backgroundImage || '';
    const m = s.match(/backgrounds\/([^"')]+)/);
    try { return m ? decodeURIComponent(m[1]) : ''; } catch { return m ? m[1] : ''; }
  };

  // ---------- 图片加载（多重兜底，解决不显示） ----------
  const base = P.location.origin + P.location.pathname.replace(/[^/]*$/, '');
  const urlCache = (P.__bgmgr_urls = P.__bgmgr_urls || {});
  function candidates(name) {
    const e = encodeURIComponent(name);
    const dom = D.querySelector(`.bg_example[bgfile="${CSS.escape(name)}"] img`)?.getAttribute('src');
    return [...new Set([
      dom && new URL(dom, base).href,
      `${base}thumbnail?type=bg&file=${e}`,
      `${base}backgrounds/${e}`,
      `${P.location.origin}/thumbnail?type=bg&file=${e}`,
      `${P.location.origin}/backgrounds/${e}`,
    ].filter(Boolean))];
  }
  async function loadImg(img, name, full) {
    if (urlCache[(full ? 'f:' : 't:') + name]) { img.src = urlCache[(full ? 'f:' : 't:') + name]; return; }
    const list = full ? candidates(name).filter(u => u.includes('backgrounds/')) : candidates(name);
    let i = 0;
    const next = async () => {
      if (i < list.length) { img.src = list[i++]; return; }
      // 终极兜底：带登录凭据 fetch 成 blob
      for (const u of candidates(name)) {
        try {
          const r = await P.fetch(u, { headers: hdr(false), credentials: 'include' });
          if (r.ok) {
            const b = await r.blob();
            if (b.type.startsWith('image/')) {
              const o = P.URL.createObjectURL(b);
              urlCache[(full ? 'f:' : 't:') + name] = o;
              img.onerror = null; img.src = o; return;
            }
          }
        } catch {}
      }
      img.onerror = null;
      img.removeAttribute('src');
      img.parentElement?.classList.add('noimg');
    };
    img.onerror = next;
    img.onload = () => { urlCache[(full ? 'f:' : 't:') + name] = img.src; img.onerror = null; };
    next();
  }
  const io = new P.IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { io.unobserve(en.target); loadImg(en.target, en.target.dataset.n); }
  }), { rootMargin: '120px' });

  // ---------- 与酒馆背景库交互 ----------
  async function listBg() {
    let arr = [];
    try {
      const r = await P.fetch('/api/backgrounds/all', { method: 'POST', headers: hdr(), body: JSON.stringify({}) });
      const j = await r.json();
      arr = Array.isArray(j) ? j : (j.images || j.backgrounds || j.files || []);
    } catch (e) { console.warn('[背景管家] 读取列表接口失败', e); }
    const norm = x => {
      if (typeof x === 'string') return x;
      if (x && typeof x === 'object') {
        const v = x.filename ?? x.file ?? x.name ?? x.bg ?? x.path ?? x.url;
        if (typeof v === 'string') return v.replace(/^.*backgrounds\//, '');
      }
      return '';
    };
    let list = arr.map(norm).filter(Boolean);
    // 兜底：接口读不到时，从酒馆页面已有的背景项里取
    if (!list.length) {
      list = [...D.querySelectorAll('.bg_example[bgfile]')].map(e => e.getAttribute('bgfile')).filter(Boolean);
    }
    list = [...new Set(list)];
    if (!list.length) return list;
    // 按导入时间排序（新的在前）：读取文件的 Last-Modified 并缓存
    try {
      const SK = 'bgmgr_bg_order', TK = 'bgmgr_bg_time';
      let seen = JSON.parse(P.localStorage.getItem(SK) || '[]');
      let times = JSON.parse(P.localStorage.getItem(TK) || '{}');
      if (!Array.isArray(seen)) seen = [];
      const old = new Set(seen), now = new Set(list);
      const firstRun = !seen.length;
      const fresh = list.filter(n => !old.has(n));
      seen = [...fresh, ...seen.filter(n => now.has(n))];
      Object.keys(times).forEach(k => { if (!now.has(k)) delete times[k]; });
      // 新增的先记当前时间（兜底），其余缺失的请求文件时间
      if (!firstRun) fresh.forEach(n => { if (!(n in times)) times[n] = 0; });
      const missing = seen.filter(n => !(n in times) || times[n] === 0);
      let qi = 0;
      const worker = async () => {
        while (qi < missing.length) {
          const n = missing[qi++];
          try {
            const r = await P.fetch(`${base}backgrounds/${encodeURIComponent(n)}`, { method: 'HEAD', credentials: 'include', cache: 'no-cache' });
            const t = r.ok ? Date.parse(r.headers.get('last-modified') || '') : NaN;
            if (t) times[n] = t;
            else if (!firstRun && fresh.includes(n)) times[n] = Date.now();
          } catch { if (!firstRun && fresh.includes(n)) times[n] = Date.now(); }
        }
      };
      if (missing.length) await Promise.all(Array.from({ length: 8 }, worker));
      P.localStorage.setItem(SK, JSON.stringify(seen));
      P.localStorage.setItem(TK, JSON.stringify(times));
      return [...seen].sort((a, b) => (times[b] || 0) - (times[a] || 0));
    } catch { return list; }
  }
  async function refreshST() {
    try { const m = await P.eval("import('/scripts/backgrounds.js')"); await m.getBackgrounds(); }
    catch (e) { console.warn('[背景管家] 刷新酒馆背景列表失败', e); }
  }
  async function uploadFiles(files) {
    let ok = 0;
    for (const f of files) {
      try {
        const fd = new P.FormData(); fd.append('avatar', f);
        const r = await P.fetch('/api/backgrounds/upload', { method: 'POST', headers: hdr(false), body: fd });
        if (r.ok) {
          ok++;
          try { const tm = JSON.parse(P.localStorage.getItem('bgmgr_bg_time') || '{}'); delete tm[f.name]; P.localStorage.setItem('bgmgr_bg_time', JSON.stringify(tm)); } catch {}
        }
      } catch (e) { console.warn(e); }
    }
    return ok;
  }
  async function deleteBg(name) {
    const r = await P.fetch('/api/backgrounds/delete', { method: 'POST', headers: hdr(), body: JSON.stringify({ bg: name }) });
    return r.ok;
  }
  const tabCache = {};
  const dropCache = () => Object.keys(tabCache).forEach(k => delete tabCache[k]);
  async function applyBg(name) {
    dropCache();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const ok = () => curBgName() === name;
    const waitOk = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (ok()) return true; await sleep(30); } return ok(); };
    const sel1 = () => D.querySelector(`.bg_example[bgfile="${CSS.escape(name)}"]`);
    const url = `url("backgrounds/${encodeURIComponent(name)}")`;
    // 方式1：模拟点击酒馆自己的背景项
    try {
      let el = sel1();
      if (!el) { await refreshST(); el = sel1(); }
      if (el) {
        el.click();
        if (await waitOk(700)) return true;
      }
    } catch (e) { console.warn('[背景管家] 方式1失败', e); }
    // 方式2：调用酒馆 setBackground
    for (const p of [`${base}scripts/backgrounds.js`, '/scripts/backgrounds.js']) {
      try {
        const m = await P.eval(`import(${JSON.stringify(p)})`);
        await m.setBackground(name, url);
        if (await waitOk(500)) return true;
        break;
      } catch (e) { console.warn('[背景管家] 方式2失败', p, e); }
    }
    // 方式3：直接改背景层样式（临时生效）
    const bg1 = D.querySelector('#bg1');
    if (bg1) {
      bg1.style.backgroundImage = url;
      await sleep(100);
      toast('已临时应用（酒馆未记录，刷新后可能恢复）', 'warning');
      return true;
    }
    toast('应用背景失败：找不到酒馆背景层 #bg1', 'error');
    return false;
  }
  function switchTheme(n) {
    const s = D.querySelector('#themes');
    if (!s) return toast('找不到美化下拉框', 'error');
    if (![...s.options].some(o => o.value === n)) return toast('找不到该美化：' + n, 'error');
    s.value = n;
    // 原生事件会同时触发 jQuery 和原生监听，酒馆怎么绑定都能响应
    s.dispatchEvent(new P.Event('change', { bubbles: true }));
    toast('已切换美化：' + n, 'success');
    scheduleBound();
  }
  // 切换美化后自动套用绑定的背景（延迟等酒馆先应用完美化，并在稍后复查一次）
  let bindTimer, bindSeq = 0;
  function scheduleBound() {
    clearTimeout(bindTimer);
    const seq = ++bindSeq;
    bindTimer = setTimeout(async () => {
      const theme = curTheme();
      const b = getMap()[theme];
      if (!b) return;
      // 多次复查：酒馆应用美化较慢/被其他脚本改回去时也能补上
      for (const wait of [0, 700, 1800]) {
        if (wait) await sleep(wait);
        if (seq !== bindSeq || P.__bgmgr_swap || curTheme() !== theme) return;
        if (curBgName() === b) continue;
        try { await applyBg(b); } catch (e) { console.warn('[Philia] 套用绑定背景失败', e); }
      }
    }, 350);
  }
  $P(D).on('change.' + ID, '#themes', scheduleBound);

  // ---------- 样式 ----------
  const st = D.createElement('style');
  st.id = ID + '-style';
  st.textContent = `
  @keyframes ${ID}In{from{opacity:0;transform:translate(-50%,-47%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  #${ID}-mask{position:fixed;inset:0;z-index:30999;background:#0000003a;display:none}
  #${ID}-mask.open{display:block}
  #${ID}-panel{--bg:#ececef;--card:#fff;--ink:#141416;--mut:#9b9ba3;--line:#efeff2;--acc:#000;--acc2:#4a4a4a;--on:#fff;
    --sh:0 1px 4px #0000000a;--grad:linear-gradient(110deg,var(--acc) 40%,var(--acc2));
    position:fixed;left:var(--pl,50%);top:var(--pt,50%);transform:translate(-50%,-50%);width:var(--pw,min(92vw,390px));height:var(--ph,min(84dvh,690px));max-width:100vw;z-index:31000;
    display:none;flex-direction:column;border-radius:28px;overflow:hidden;color:var(--ink);
    background:linear-gradient(180deg,#f3f3f5,#e6e6ea);
    box-shadow:0 14px 44px #00000038;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;box-sizing:border-box;font-size:13px}
  #${ID}-panel.dark{--bg:#232326;--card:#1d1d20;--ink:#f3f3f3;--mut:#7c7c84;--line:#2c2c30;--sh:0 1px 4px #0006;background:linear-gradient(180deg,#171719,#0f0f10)}
  #${ID}-panel.open{display:flex;animation:${ID}In .18s ease}
  #${ID}-panel *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  #${ID}-panel .in{display:flex;flex-direction:column;height:100%;padding:10px;gap:8px}
  #${ID}-panel .card{background:var(--card);border-radius:20px;box-shadow:var(--sh)}
  /* 头部：深色卡片 */
  #${ID}-panel .hd{padding:11px 13px 10px;display:flex;flex-direction:column;gap:9px;flex:none;background:var(--card);color:var(--ink);
    box-shadow:var(--sh);border-radius:20px}
  #${ID}-panel .pf{display:flex;align-items:center;gap:11px}
  #${ID}-panel .av{width:42px;height:42px;border-radius:14px;background:var(--bg) center/cover no-repeat;flex:none;
    display:flex;align-items:center;justify-content:center;font-size:17px;overflow:hidden}
  #${ID}-panel .tt{flex:1;min-width:0}
  #${ID}-panel .tt b{display:block;font-size:16px;font-weight:700;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #${ID}-panel .tt span{display:block;font-size:10.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
  #${ID}-panel .x{width:26px;height:26px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;flex:none;align-self:flex-start}
  #${ID}-panel .stats{display:flex;text-align:center;font-size:14px;font-weight:700;border-top:1px dashed var(--line);padding-top:7px}
  #${ID}-panel .stats>div{flex:1;line-height:1.2}
  #${ID}-panel .stats>div+div{border-left:1px solid var(--line)}
  #${ID}-panel .stats small{display:block;font-size:8.5px;color:var(--mut);font-weight:500;margin-top:1px;letter-spacing:.1em;text-transform:uppercase}
  /* 标签：分段 */
  #${ID}-panel .tabs{display:flex;padding:3px;gap:2px;flex:none;border-radius:18px}
  #${ID}-panel .tab{flex:1;text-align:center;padding:7px 0;border-radius:15px;cursor:pointer;font-size:12.5px;letter-spacing:.06em;color:var(--mut);transition:.18s}
  #${ID}-panel .tab.on{background:var(--grad);color:var(--on);font-weight:600;box-shadow:0 2px 6px #0003}
  /* 主体 */
  #${ID}-panel .view{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;scrollbar-width:none;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;transform:translateZ(0)}
  #${ID}-panel .view::-webkit-scrollbar{display:none}
  #${ID}-panel .view>*{flex:none}
  #${ID}-panel .dockslot:empty{display:none}
  #${ID}-panel .sec{display:flex;justify-content:space-between;align-items:center;padding:0 6px;gap:8px}
  #${ID}-panel .sec b{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase}
  #${ID}-panel .sec b::before{content:'';display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--acc);margin-right:6px;vertical-align:middle;position:relative;top:-1px}
  #${ID}-panel .sec span{font-size:10.5px;color:var(--mut)}
  #${ID}-panel .gh{cursor:pointer;user-select:none;padding:2px 6px}
  #${ID}-panel .gh b::before{display:none}
  #${ID}-panel .gh i{font-style:normal;margin-left:8px;opacity:.55;cursor:pointer}
  /* 搜索：精简 */
  #${ID}-panel .srch{display:flex;gap:6px;padding:0;background:none;box-shadow:none;align-items:center}
  #${ID}-panel .sbox{flex:1;min-width:0;display:flex;align-items:center;gap:5px;background:var(--card);box-shadow:var(--sh);border-radius:12px;padding:0 10px;height:26px}
  #${ID}-panel .sbox input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);padding:0;font-size:11px;outline:none;height:100%}
  #${ID}-panel .sbox span{font-size:11px}
  #${ID}-panel .srch .pill{height:26px;padding:0 12px;font-size:10.5px;letter-spacing:.1em;border-radius:12px;background:var(--card);color:var(--ink);box-shadow:var(--sh);font-weight:600}
  #${ID}-panel .srch .pill:active{background:var(--grad);color:var(--on)}
  #${ID}-panel .pill{padding:7px 13px;border-radius:14px;background:var(--grad);color:var(--on);font-size:12px;cursor:pointer;
    white-space:nowrap;text-align:center;user-select:none;display:flex;align-items:center;justify-content:center;transition:transform .1s}
  #${ID}-panel .pill.ghost{background:var(--bg);color:var(--ink)}
  #${ID}-panel .pill.dis{opacity:.35;pointer-events:none}
  #${ID}-panel .pill:active,#${ID}-panel .chip:active,#${ID}-panel .tab:active{transform:scale(.96)}
  #${ID}-panel .chips{display:flex;gap:6px;flex-wrap:wrap}
  #${ID}-panel .chips.mid{flex-wrap:nowrap;gap:8px}
  #${ID}-panel .chips.mid .chip{flex:1;text-align:center;padding:7px 0}
  #${ID}-panel .chip{padding:5px 11px;border-radius:13px;background:var(--card);box-shadow:var(--sh);font-size:11.5px;cursor:pointer;user-select:none;color:var(--mut);transition:transform .1s}
  #${ID}-panel .chip.on{background:var(--grad);color:var(--on)}
  #${ID}-panel .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:9px}
  #${ID}-panel .it{position:relative;aspect-ratio:1;border-radius:15px;overflow:hidden;cursor:pointer;background:var(--bg);transition:transform .12s;box-shadow:inset 0 0 0 1px #0000000d;content-visibility:auto;contain-intrinsic-size:auto 100px;contain:layout paint style}
  #${ID}-panel .it img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
  #${ID}-panel .it.noimg::after{content:'🖼';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;opacity:.35}
  #${ID}-panel .it.sel{box-shadow:0 0 0 2px var(--card),0 0 0 4px var(--acc);transform:scale(.94)}
  #${ID}-panel .it .ck{position:absolute;top:5px;right:5px;width:19px;height:19px;border-radius:50%;background:#ffffffc8;
    display:flex;align-items:center;justify-content:center;font-size:10.5px;color:var(--on);z-index:2;box-shadow:0 1px 3px #0003}
  #${ID}-panel .it.sel .ck{background:var(--grad)}
  #${ID}-panel .it .tag{position:absolute;left:5px;bottom:5px;font-size:9px;background:#000b;color:#fff;border-radius:8px;padding:1px 6px}
  #${ID}-panel .it .bd{position:absolute;left:5px;top:5px;font-size:10px;background:#0009;border-radius:8px;padding:0 5px}
  #${ID}-panel .add{aspect-ratio:1;border-radius:15px;border:1.5px dashed #bdbdc4;display:flex;align-items:center;justify-content:center;font-size:24px;color:#b0b0b8;cursor:pointer}
  #${ID}-panel .tip{padding:2px 12px 10px;font-size:10.5px;color:var(--mut);line-height:1.6}
  /* 底部操作条 */
  #${ID}-panel .dock{display:flex;padding:3px;border-radius:20px;background:var(--grad);box-shadow:0 3px 10px #0002}
  #${ID}-panel .dk{flex:1;text-align:center;padding:9px 0;font-size:12.5px;color:var(--on);cursor:pointer;border-radius:17px;user-select:none}
  #${ID}-panel .dk+.dk{border-left:1px solid #ffffff1f}
  #${ID}-panel .dk:active{background:#ffffff22}
  #${ID}-panel .dk.red{color:#ff9a9a}
  #${ID}-panel .dk.dis{opacity:.3;pointer-events:none}
  /* 美化行 */
  #${ID}-panel .row{display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:18px;background:var(--card);box-shadow:var(--sh);content-visibility:auto;contain-intrinsic-size:auto 56px}
  #${ID}-panel .row.cur{background:linear-gradient(135deg,#000,#3b3b3b);color:#fff}
  #${ID}-panel .row.cur .sm{color:#aaa}
  #${ID}-panel .row .th{width:40px;height:40px;border-radius:12px;background:var(--bg);overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;font-size:17px;color:#aaa;cursor:pointer;border:1.5px dashed transparent}
  #${ID}-panel .row .th.empty{border-color:#bdbdc4}
  #${ID}-panel .row .th img{width:100%;height:100%;object-fit:cover}
  #${ID}-panel .row .nm{flex:1;min-width:0;font-size:13px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #${ID}-panel .row .sm{font-size:10.5px;color:var(--mut);font-weight:400;margin-top:2px;overflow:hidden;text-overflow:ellipsis}
  #${ID}-panel .row .btns{display:flex;gap:5px;flex:none}
  #${ID}-panel .row .pill{padding:6px 10px;font-size:11.5px;border-radius:12px}
  #${ID}-panel .row.cur .pill{background:#fff;color:#000}
  #${ID}-panel .row.cur .pill.ghost{background:#ffffff26;color:#fff}
  /* 弹层 */
  #${ID}-panel .sheet{position:absolute;inset:0;z-index:20;display:none;flex-direction:column;justify-content:flex-end;background:#00000040}
  #${ID}-panel .sheet.open{display:flex}
  #${ID}-panel .sbody{border-radius:24px 24px 0 0;max-height:78%;display:flex;flex-direction:column;padding:12px 2px 12px;background:var(--card);gap:6px}
  #${ID}-panel .sbody .sec{padding:0 14px}
  #${ID}-panel .sbody .sgrid{overflow-y:auto;scrollbar-width:none}
  #${ID}-panel .sbody .pad{padding:0 14px;display:flex;flex-direction:column;gap:8px}
  #${ID}-panel .sbody textarea{width:100%;border:0;background:var(--bg);color:var(--ink);border-radius:12px;padding:8px 10px;font-size:12px;outline:none;resize:none;font-family:inherit}
  /* 设置 */
  #${ID}-panel .set{padding:11px;display:flex;flex-direction:column;gap:9px}
  #${ID}-panel .set label{font-size:10px;color:var(--mut);display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;letter-spacing:.08em;text-transform:uppercase}
  #${ID}-panel .set input[type=text]{width:100%;border:0;background:var(--bg);color:var(--ink);border-radius:11px;padding:6px 10px;font-size:12px;outline:none;height:28px}
  #${ID}-panel .prof{display:flex;gap:10px;align-items:center}
  #${ID}-panel .prof .av2{width:44px;height:44px;border-radius:14px;background:var(--grad) center/cover no-repeat;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--on);font-size:16px}
  #${ID}-panel .prof .col{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
  #${ID}-panel .sw{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  #${ID}-panel .sw i{width:24px;height:24px;border-radius:8px;cursor:pointer;border:2px solid transparent;box-shadow:inset 0 0 0 1px #0002}
  #${ID}-panel .sw i.on{border-color:var(--ink)}
  #${ID}-panel .set input[type=range]{width:100%;accent-color:var(--acc);height:16px;margin:0}
  #${ID}-panel .rs{font-style:normal;cursor:pointer;margin-left:7px;opacity:.7;font-size:12px}
  #${ID}-panel .two{display:flex;gap:6px}
  #${ID}-panel .two .pill{flex:1}
  /* 美化页：批量删除 */
  #${ID}-panel .row.multi{cursor:pointer}
  #${ID}-panel .row .ck2{width:20px;height:20px;border-radius:50%;flex:none;border:1.5px solid #bdbdc4;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--on)}
  #${ID}-panel .row.multi.sel{box-shadow:0 0 0 2px var(--acc)}
  #${ID}-panel .row.multi.sel .ck2{background:var(--grad);border-color:transparent}
  #${ID}-panel .row.multi.cur{opacity:.55}
  #${ID}-panel .row.multi .btns{display:none}
  /* 预览：3D 翻页 */
  #${ID}-panel .pv{display:none;flex:1;min-height:0;flex-direction:column;position:relative;border-radius:20px;background:var(--card);box-shadow:var(--sh);--cw:180px;--ch:288px;--sc:.46;--fh:624px}
  #${ID}-panel .pv.open{display:flex}
  #${ID}-panel .pv .ph{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 2px;flex:none}
  #${ID}-panel .pv .pt{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}
  #${ID}-panel .pv .stage{flex:1;min-height:0;position:relative;perspective:900px;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
  #${ID}-panel .pv .cards{position:absolute;inset:0;transform-style:preserve-3d}
  #${ID}-panel .pv .cd{position:absolute;left:50%;top:50%;width:var(--cw);height:var(--ch);margin-left:calc(var(--cw)/-2);margin-top:calc(var(--ch)/-2);border-radius:16px;background:var(--card);box-shadow:0 8px 24px #0004;will-change:transform;-webkit-backface-visibility:hidden;backface-visibility:hidden;transition:transform .34s cubic-bezier(.22,.8,.24,1),opacity .34s;cursor:pointer}
  #${ID}-panel .pv .cd[data-p="0"]{transform:translate3d(0,0,40px);cursor:default}
  #${ID}-panel .pv .cd[data-p="1"]{transform:translate3d(calc(var(--cw)*.7),0,-60px) rotateY(62deg) scale(.72)}
  #${ID}-panel .pv .cd[data-p="-1"]{transform:translate3d(calc(var(--cw)*-.7),0,-60px) rotateY(-62deg) scale(.72)}
  #${ID}-panel .pv .cd[data-p="2"]{transform:translate3d(calc(var(--cw)*.8),0,-120px) rotateY(65deg) scale(.55);opacity:0;pointer-events:none}
  #${ID}-panel .pv .cd[data-p="-2"]{transform:translate3d(calc(var(--cw)*-.8),0,-120px) rotateY(-65deg) scale(.55);opacity:0;pointer-events:none}
  #${ID}-panel .pv .cd::after{content:'';position:absolute;inset:0;border-radius:16px;background:#000;opacity:0;will-change:opacity;transition:opacity .34s;z-index:2;pointer-events:none}
  #${ID}-panel .pv .cd[data-p="1"]::after,#${ID}-panel .pv .cd[data-p="-1"]::after{opacity:.3}
  #${ID}-panel .pv .cd .ld{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px;text-align:center;font-size:12px;font-weight:600;color:var(--ink);word-break:break-all}
  #${ID}-panel .pv .cd .ld small{font-size:10px;font-weight:400;color:var(--mut)}
  #${ID}-panel .pv .cd iframe{position:absolute;left:0;top:0;width:390px;height:var(--fh);border:0;transform-origin:0 0;transform:scale(var(--sc));border-radius:calc(16px / var(--sc));opacity:0;transition:opacity .25s;pointer-events:none;background:transparent}
  #${ID}-panel .pv .cd iframe.ready{opacity:1}
  #${ID}-panel .pv .nav{position:absolute;top:50%;margin-top:-24px;width:34px;height:48px;display:flex;align-items:center;justify-content:center;font-size:34px;line-height:1;color:var(--mut);opacity:.75;cursor:pointer;z-index:10}
  #${ID}-panel .pv .nav.l{left:0}
  #${ID}-panel .pv .nav.r{right:0}
  #${ID}-panel .pv .nav.off{opacity:.2;pointer-events:none}
  #${ID}-panel .pv .pi{flex:none;padding:6px 14px 14px;display:flex;flex-direction:column;gap:10px}
  #${ID}-panel .pv .pnm{text-align:center;min-width:0}
  #${ID}-panel .pv .pnm b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #${ID}-panel .pv .pnm span{display:block;font-size:10.5px;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #${ID}-panel .pv input[type=range]{width:100%;accent-color:var(--acc);height:16px;margin:0}
  #${ID}-panel .pv .two .pill{padding:7px 2px;font-size:11.5px}
  `;
  D.head.appendChild(st);

  // ---------- DOM ----------
  const root = D.createElement('div');
  root.id = ID + '-root';
  root.innerHTML = `
    <div id="${ID}-mask"></div>
    <div id="${ID}-panel">
      <div class="in">
        <div class="card hd">
          <div class="pf">
            <div class="av"></div>
            <div class="tt"><b></b><span></span></div>
            <div class="x">✕</div>
          </div>
          <div class="stats"></div>
        </div>
        <div class="card tabs">
          <div class="tab on" data-t="bg">背景</div>
          <div class="tab" data-t="theme">美化</div>
          <div class="tab act" data-t="preview">预览</div>
          <div class="tab" data-t="set">设置</div>
        </div>
        <div class="view"></div>
        <div class="pv">
          <div class="stage"><div class="cards"></div><div class="nav l">‹</div><div class="nav r">›</div></div>
          <div class="pi">
            <div class="pnm"><b></b><span></span></div>
            <input type="range" min="0" max="0" value="0">
            <div class="two"><div class="pill ghost" data-p="one">读取此套</div><div class="pill ghost" data-p="scan">扫描全部</div><div class="pill" data-p="apply">应用此美化</div></div>
          </div>
        </div>
        <div class="dockslot"></div>
      </div>
      <div class="sheet"><div class="sbody"></div></div>
    </div>
    <input type="file" id="${ID}-file" multiple accept="image/*,video/*" style="display:none">
    <input type="file" id="${ID}-avf" accept="image/*" style="display:none">`;
  D.body.appendChild(root);

  const mask = root.querySelector(`#${ID}-mask`);
  const panel = root.querySelector(`#${ID}-panel`);
  const view = panel.querySelector('.view');
  const dockslot = panel.querySelector('.dockslot');
  const pv = panel.querySelector('.pv');
  const fileInput = root.querySelector(`#${ID}-file`);
  const avInput = root.querySelector(`#${ID}-avf`);

  let tab = 'bg';
  let bgs = [];
  let kw = '';
  const sel = new Set();

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }
  async function applyCfg() {
    panel.classList.toggle('dark', !!cfg.dark);
    panel.style.setProperty('--acc', cfg.accent);
    { const n = parseInt(cfg.accent.slice(1), 16), mix = c => Math.round(c + (255 - c) * 0.27);
      panel.style.setProperty('--acc2', '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => mix(c).toString(16).padStart(2, '0')).join('')); }
    panel.style.setProperty('--on', luminance(cfg.accent) > 0.6 ? '#111' : '#fff');
    const av = panel.querySelector('.av');
    av.style.backgroundImage = cfg.avatar ? `url(${cfg.avatar})` : '';
    av.textContent = cfg.avatar ? '' : '🖼';
    panel.querySelector('.tt b').textContent = '@' + cfg.title;
    panel.querySelector('.tt span').textContent = cfg.sub;
  }
  function stats() {
    const m = getMap();
    const bound = Object.keys(m).length;
    panel.querySelector('.stats').innerHTML =
      `<div>${bgs.length}<small>Backgrounds</small></div><div>${themes().length}<small>Themes</small></div><div>${bound}<small>Bound</small></div>`;
  }

  // ---------- 自适应：按可视视口计算大小与位置（适配不同手机/键盘/横竖屏） ----------
  function fit() {
    const vv = P.visualViewport;
    const W = vv ? vv.width : P.innerWidth, H = vv ? vv.height : P.innerHeight;
    const L = vv ? vv.offsetLeft : 0, T = vv ? vv.offsetTop : 0;
    const w = Math.min(W * 0.94, 390);
    const h = Math.min(Math.max(H * 0.86, Math.min(320, H * 0.96)), 690, H * 0.96);
    panel.style.setProperty('--pw', w + 'px');
    panel.style.setProperty('--ph', h + 'px');
    panel.style.setProperty('--pl', (L + W / 2) + 'px');
    panel.style.setProperty('--pt', (T + H / 2) + 'px');
    if (pv.classList.contains('open')) P.requestAnimationFrame(pvLayout);
  }
  {
    const k = '__' + ID + '_fit';
    if (P[k]) { P.removeEventListener('resize', P[k]); P.removeEventListener('orientationchange', P[k]); P.visualViewport?.removeEventListener('resize', P[k]); P.visualViewport?.removeEventListener('scroll', P[k]); }
    let raf = 0;
    P[k] = () => { if (!panel.classList.contains('open')) return; P.cancelAnimationFrame(raf); raf = P.requestAnimationFrame(fit); };
    P.addEventListener('resize', P[k]); P.addEventListener('orientationchange', P[k]);
    P.visualViewport?.addEventListener('resize', P[k]); P.visualViewport?.addEventListener('scroll', P[k]);
  }
  async function togglePanel(force) {
    const open = force ?? !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    mask.classList.toggle('open', open);
    if (open) { fit(); applyCfg(); render(); reload(); setTimeout(snapCur, 300); if (tab === 'preview') openPv(); }
    else closePv();
  }
  panel.querySelector('.x').onclick = () => togglePanel(false);
  mask.onclick = () => togglePanel(false);
  // 点击面板外空白处关闭（酒馆自身弹窗/提示不算）
  $P(D).on('pointerdown.' + ID, e => {
    if (!panel.classList.contains('open')) return;
    const t = e.target;
    if (panel.contains(t) || t.closest?.('#toast-container, .popup, dialog, #' + ID + '-menu')) return;
    togglePanel(false);
  });

  // ---------- 魔法棒菜单入口 ----------
  function addMenuItem() {
    const menu = D.querySelector('#extensionsMenu');
    if (!menu || D.getElementById(ID + '-menu')) return;
    const item = D.createElement('div');
    item.id = ID + '-menu';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    item.innerHTML = '<div class="fa-solid fa-image extensionsMenuExtensionButton"></div><span>Philia</span>';
    item.onclick = () => {
      const m = D.querySelector('#extensionsMenu');
      if (m && P.getComputedStyle(m).display !== 'none') D.querySelector('#extensionsMenuButton')?.click();
      togglePanel(true);
    };
    menu.appendChild(item);
  }
  addMenuItem();
  P.__bgmgr_timer = setInterval(addMenuItem, 2000);
  window.addEventListener('pagehide', () => clearInterval(P.__bgmgr_timer));

  panel.querySelector('.tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (!t) return;
    const nt = t.dataset.t;
    if (nt === tab) return;
    const leavingPv = tab === 'preview';
    // 把当前页面的节点收起来缓存，切回时直接放回（不重新渲染）
    if (!leavingPv) {
      const f = D.createDocumentFragment(), d = D.createDocumentFragment(), sc = view.scrollTop;
      while (view.firstChild) f.appendChild(view.firstChild);
      while (dockslot.firstChild) d.appendChild(dockslot.firstChild);
      tabCache[tab] = { f, d, sc };
    }
    tab = nt;
    panel.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
    if (leavingPv) { closePv(); view.style.display = ''; dockslot.style.display = ''; }
    if (nt === 'preview') { view.style.display = 'none'; dockslot.style.display = 'none'; openPv(); return; }
    const c = tabCache[tab];
    if (c) { delete tabCache[tab]; view.appendChild(c.f); dockslot.appendChild(c.d); view.scrollTop = c.sc; }
    else render(true);
  });

  fileInput.onchange = async () => {
    const files = [...fileInput.files]; fileInput.value = '';
    if (!files.length) return;
    toast(`正在导入 ${files.length} 个文件…`);
    const ok = await uploadFiles(files);
    toast(`导入完成：成功 ${ok} / ${files.length}`, ok ? 'success' : 'error');
    await refreshST(); await reload();
  };
  avInput.onchange = () => {
    const f = avInput.files[0]; avInput.value = '';
    if (!f) return;
    const fr = new P.FileReader();
    fr.onload = () => {
      const im = new P.Image();
      im.onload = () => {
        const c = D.createElement('canvas'); const s = 160;
        c.width = c.height = s;
        const k = Math.max(s / im.width, s / im.height);
        const w = im.width * k, h = im.height * k;
        c.getContext('2d').drawImage(im, (s - w) / 2, (s - h) / 2, w, h);
        cfg.avatar = c.toDataURL('image/jpeg', 0.85);
        setCfg(cfg); applyCfg(); render();
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  };

  let lastSig = null;
  async function reload(force) {
    try { bgs = await listBg(); } catch (e) { bgs = []; toast('读取背景列表失败', 'error'); }
    [...sel].forEach(n => { if (!bgs.includes(n)) sel.delete(n); });
    const sig = bgs.join('\n');
    if (sig === lastSig && !force) return;
    lastSig = sig;
    render();
  }
  const boundTo = name => { const m = getMap(); return Object.keys(m).filter(k => m[k] === name); };

  function render(keep) {
    if (!keep) dropCache();
    try {
      stats();
      if (tab === 'preview') return;
      dockslot.innerHTML = '';
      view.scrollTop = 0;
      if (tab === 'bg') renderBg();
      else if (tab === 'theme') renderTheme();
      else renderSet();
    } catch (e) {
      console.error('[背景管家] 渲染失败', e);
      view.innerHTML = `<div class="card tip">渲染出错：${esc(e.message)}<br>请点上方其他标签重试</div>`;
      toast('背景管家渲染出错：' + e.message, 'error');
    }
  }

  // ---------- 背景页 ----------
  let curShown = [];
  const itemEls = new Map();
  function renderDock() {
    const t = curTheme();
    const one = sel.size === 1 ? [...sel][0] : null;
    dockslot.innerHTML = `<div class="dock">
        <div class="dk ${one ? '' : 'dis'}" data-a="use">应用</div>
        <div class="dk ${one && t ? '' : 'dis'}" data-a="bind">绑定美化</div>
        <div class="dk red ${sel.size ? '' : 'dis'}" data-a="del">删除${sel.size ? ' (' + sel.size + ')' : ''}</div>
      </div>`;
    dockslot.querySelectorAll('[data-a]').forEach(b => (b.onclick = () => actBg(b.dataset.a, curShown)));
  }
  // 多选时只局部更新，不重建网格（避免缩略图重新加载）
  function refreshSel() {
    itemEls.forEach((el, n) => {
      const on = sel.has(n);
      el.classList.toggle('sel', on);
      el.querySelector('.ck').textContent = on ? '✓' : '';
    });
    const c = view.querySelector('.cnt'); if (c) c.textContent = `已选 ${sel.size} / ${curShown.length}`;
    const a = view.querySelector('[data-a="all"]'); if (a) a.textContent = sel.size === curShown.length && curShown.length ? '取消全选' : '全选';
    renderDock();
  }
  function markCur(name) {
    itemEls.forEach((el, n) => {
      el.querySelector('.tag')?.remove();
      if (n === name) el.insertAdjacentHTML('beforeend', '<div class="tag">当前</div>');
    });
  }
  function renderBg() {
    const t = curTheme();
    const shown = bgs.filter(n => n.toLowerCase().includes(kw.toLowerCase()));
    const now = curBgName();
    const keep = view.scrollTop;
    curShown = shown; itemEls.clear();
    view.innerHTML = `
      <div class="card srch"><div class="sbox"><input type="text" placeholder="Please enter the content…" value="${esc(kw)}"></div><div class="pill" data-a="url">URL</div></div>
      <div class="sec"><b>Backgrounds</b><span class="cnt">已选 ${sel.size} / ${shown.length}</span></div>
      <div class="chips mid">
        <div class="chip" data-a="all">${sel.size === shown.length && shown.length ? '取消全选' : '全选'}</div>
        <div class="chip" data-a="inv">反选</div>
        <div class="chip" data-a="clr">清空</div>
        <div class="chip" data-a="ref">刷新</div>
      </div>
      <div class="card"><div class="grid"></div>
        <div class="tip">点图片 = 应用　·　右上角圆圈 = 多选　·　当前美化：${esc(t || '无')}</div></div>
`;
    renderDock();
    const grid = view.querySelector('.grid');
    const add = D.createElement('div');
    add.className = 'add'; add.textContent = '+'; add.onclick = () => fileInput.click();
    grid.appendChild(add);
    shown.forEach(n => {
      const it = D.createElement('div');
      it.className = 'it' + (sel.has(n) ? ' sel' : '');
      it.title = n;
      const b = boundTo(n).length;
      it.innerHTML = `<img data-n="${esc(n)}" alt="" decoding="async" loading="lazy">
        <div class="ck">${sel.has(n) ? '✓' : ''}</div>
        ${b ? '<div class="bd">🔗</div>' : ''}${n === now ? '<div class="tag">当前</div>' : ''}`;
      it.querySelector('.ck').onclick = e => {
        e.stopPropagation();
        sel.has(n) ? sel.delete(n) : sel.add(n);
        refreshSel();
      };
      it.onclick = async () => { toast('正在应用…'); if (await applyBg(n)) { toast('已应用', 'success'); markCur(n); } };
      grid.appendChild(it);
      itemEls.set(n, it);
      io.observe(it.querySelector('img'));
    });
    const inp = view.querySelector('.sbox input');
    let dt; inp.oninput = () => { clearTimeout(dt); dt = setTimeout(() => { kw = inp.value; const pos = inp.selectionStart; renderBg(); const i2 = view.querySelector('.sbox input'); i2.focus(); i2.setSelectionRange(pos, pos); }, 200); };
    view.querySelectorAll('[data-a]').forEach(b => (b.onclick = () => actBg(b.dataset.a, shown)));
    view.scrollTop = keep;
  }

  async function actBg(a, shown = bgs) {
    if (a === 'imp') return fileInput.click();
    if (a === 'url') return openUrlSheet();
    if (a === 'ref') { try { P.localStorage.removeItem('bgmgr_bg_time'); } catch {} await refreshST(); return reload(); }
    if (a === 'all') { sel.size === shown.length ? sel.clear() : shown.forEach(n => sel.add(n)); return refreshSel(); }
    if (a === 'inv') { shown.forEach(n => (sel.has(n) ? sel.delete(n) : sel.add(n))); return refreshSel(); }
    if (a === 'clr') { sel.clear(); return refreshSel(); }
    if (a === 'use') { const n = [...sel][0]; if (await applyBg(n)) markCur(n); return; }
    if (a === 'bind') {
      const m = getMap(); m[curTheme()] = [...sel][0]; setMap(m);
      toast(`已绑定到美化「${curTheme()}」`, 'success'); return render();
    }
    if (a === 'del') {
      if (!P.confirm(`确定删除选中的 ${sel.size} 张背景？此操作不可恢复。`)) return;
      const m = getMap(); let ok = 0;
      for (const n of [...sel]) {
        if (await deleteBg(n)) { ok++; Object.keys(m).forEach(k => { if (m[k] === n) delete m[k]; }); if (cfg.wall === n) cfg.wall = ''; }
      }
      setMap(m); setCfg(cfg); sel.clear();
      toast(`已删除 ${ok} 张`, ok ? 'success' : 'error');
      await refreshST(); applyCfg(); await reload();
    }
  }

  // ---------- URL 导入 ----------
  async function importUrls(list) {
    let ok = 0, fail = 0;
    for (const u of list) {
      try {
        let r;
        try { r = await P.fetch(u); if (!r.ok) throw 0; }
        catch { r = await P.fetch(`${base}proxy/${u}`, { headers: hdr(false) }); if (!r.ok) throw 0; }
        const b = await r.blob();
        if (!/^(image|video)\//.test(b.type)) throw 0;
        let name = decodeURIComponent(new URL(u).pathname.split('/').pop() || 'bg').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
        if (!/\.\w{2,4}$/.test(name)) name += '.' + (b.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        ok += await uploadFiles([new P.File([b], name, { type: b.type })]);
      } catch { fail++; }
    }
    toast(`URL 导入：成功 ${ok}${fail ? '，失败 ' + fail : ''}`, ok ? 'success' : 'error');
    if (fail && !ok) toast('可能被跨域拦截，可在酒馆 config 里开启 CORS 代理', 'warning');
    await refreshST(); await reload();
  }
  function openUrlSheet() {
    sbody.innerHTML = `
      <div class="sec"><b>从 URL 导入</b><span class="xs" style="cursor:pointer;font-size:14px">✕</span></div>
      <div class="pad">
        <textarea rows="4" placeholder="每行一个图片链接"></textarea>
        <div class="two"><div class="pill ghost" data-s="c">取消</div><div class="pill" data-s="g">导入</div></div>
        <div class="tip" style="padding:0">本地图片请点网格里的 ＋</div>
      </div>`;
    const close = () => sheet.classList.remove('open');
    sbody.querySelector('.xs').onclick = close;
    sbody.querySelector('[data-s=c]').onclick = close;
    sbody.querySelector('[data-s=g]').onclick = () => {
      const list = sbody.querySelector('textarea').value.split(/\s+/).filter(u => /^https?:\/\//i.test(u));
      if (!list.length) return toast('请输入 http(s) 链接', 'warning');
      close(); toast(`正在导入 ${list.length} 个链接…`); importUrls(list);
    };
    sheet.classList.add('open');
  }

  // ---------- 美化页 ----------
  const sheet = panel.querySelector('.sheet');
  const sbody = sheet.querySelector('.sbody');
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.classList.remove('open'); });
  let tq = '';
  const folded = new Set();

  function autoCats(names) {
    const tok = n => {
      const m = n.match(/^\s*[【\[\(（「『《]([^】\]\)）」』》]{1,12})[】\]\)）」』》]/);
      if (m) return m[1].trim();
      return (n.split(/[\s\-_—–·|｜:：()（）\[\]【】.+]+/).filter(Boolean)[0]) || '';
    };
    const cnt = {};
    names.forEach(n => { const k = tok(n).toLowerCase(); if (k) cnt[k] = (cnt[k] || 0) + 1; });
    const out = {};
    names.forEach(n => { const t = tok(n); out[n] = t && cnt[t.toLowerCase()] >= 2 ? t : '其他'; });
    return out;
  }

  function openSheet(theme) {
    const m = getMap();
    const cur = m[theme];
    sbody.innerHTML = `
      <div class="sec"><b>选择背景</b><span class="xs" style="cursor:pointer;font-size:14px">✕</span></div>
      <div class="sec" style="padding-top:0"><span>为「${esc(theme)}」绑定，点图片即绑定</span></div>
      <div class="sgrid"><div class="grid"></div></div>
      <div class="pad two">
        <div class="pill ghost ${cur ? '' : 'dis'}" data-s="ub">解绑</div>
        ${theme === curTheme() ? '' : '<div class="pill" data-s="sw">切换到此美化</div>'}
      </div>`;
    const g = sbody.querySelector('.grid');
    if (!bgs.length) g.innerHTML = '<div class="tip" style="grid-column:1/-1">还没有背景，先去「背景」页导入</div>';
    bgs.forEach(n => {
      const it = D.createElement('div');
      it.className = 'it' + (n === cur ? ' sel' : '');
      it.innerHTML = `<img data-n="${esc(n)}" alt="" decoding="async" loading="lazy">${n === cur ? '<div class="tag">已绑定</div>' : ''}`;
      it.onclick = async () => {
        const mm = getMap(); mm[theme] = n; setMap(mm);
        toast(`「${theme}」已绑定背景`, 'success');
        sheet.classList.remove('open');
        if (theme === curTheme()) await applyBg(n);
        render();
      };
      g.appendChild(it);
      io.observe(it.querySelector('img'));
    });
    sbody.querySelector('.xs').onclick = () => sheet.classList.remove('open');
    sbody.querySelectorAll('[data-s]').forEach(x => {
      x.onclick = () => {
        if (x.dataset.s === 'ub') { const mm = getMap(); delete mm[theme]; setMap(mm); toast('已解绑'); }
        if (x.dataset.s === 'sw') { switchTheme(theme); }
        sheet.classList.remove('open');
        render();
      };
    });
    sheet.classList.add('open');
  }

  // 置顶 / 分类菜单
  function openMenu(theme) {
    const me = getMeta();
    const pinned = me.pins.includes(theme);
    const mine = me.cats[theme] || '';
    sbody.innerHTML = `
      <div class="sec"><b>${esc(theme)}</b><span class="xs" style="cursor:pointer;font-size:14px">✕</span></div>
      <div class="pad">
        <div class="pill ${pinned ? 'ghost' : ''}" data-m="pin">${pinned ? '取消置顶' : '📌 置顶'}</div>
        <div class="sec" style="padding:4px 0 0"><b>手动分类</b></div>
        <div class="chips">
          <div class="chip ${mine ? '' : 'on'}" data-m="cat" data-c="">未分类</div>
          ${me.list.map(c => `<div class="chip ${c === mine ? 'on' : ''}" data-m="cat" data-c="${esc(c)}">${esc(c)}</div>`).join('')}
          <div class="chip" data-m="new">＋ 新分类</div>
        </div>
      </div>`;
    sbody.querySelector('.xs').onclick = () => sheet.classList.remove('open');
    sbody.querySelectorAll('[data-m]').forEach(x => {
      x.onclick = () => {
        const mm = getMeta();
        const a = x.dataset.m;
        if (a === 'pin') {
          mm.pins = pinned ? mm.pins.filter(p => p !== theme) : [theme, ...mm.pins];
        } else if (a === 'cat') {
          x.dataset.c ? (mm.cats[theme] = x.dataset.c) : delete mm.cats[theme];
        } else if (a === 'new') {
          const nm = (P.prompt('新分类名称') || '').trim();
          if (!nm) return;
          if (!mm.list.includes(nm)) mm.list.push(nm);
          mm.cats[theme] = nm;
        }
        setMeta(mm);
        sheet.classList.remove('open');
        render();
      };
    });
    sheet.classList.add('open');
  }

  // ---------- 批量删除美化 ----------
  let tmulti = false;
  const tsel = new Set();
  const trows = new Map();
  const selVis = () => [...tsel].filter(n => trows.has(n));
  function renderTDock() {
    if (!tmulti) { dockslot.innerHTML = ''; return; }
    const n = selVis().length;
    dockslot.innerHTML = `<div class="dock">
        <div class="dk" data-t="all">${n && n === trows.size ? '取消全选' : '全选'}</div>
        <div class="dk" data-t="inv">反选</div>
        <div class="dk red ${n ? '' : 'dis'}" data-t="del">删除${n ? ' (' + n + ')' : ''}</div>
        <div class="dk" data-t="done">完成</div>
      </div>`;
    dockslot.querySelectorAll('[data-t]').forEach(b => (b.onclick = () => actTheme(b.dataset.t)));
  }
  // 多选时只局部更新，不重建列表
  function refreshTSel() {
    trows.forEach((el, n) => {
      const on = tsel.has(n);
      el.classList.toggle('sel', on);
      const c = el.querySelector('.ck2'); if (c) c.textContent = on ? '✓' : '';
    });
    const c = view.querySelector('.tcnt'); if (c) c.textContent = `已选 ${selVis().length} / ${trows.size}`;
    renderTDock();
  }
  async function actTheme(a) {
    if (a === 'all') { const all = [...trows.keys()]; selVis().length === all.length ? all.forEach(n => tsel.delete(n)) : all.forEach(n => tsel.add(n)); return refreshTSel(); }
    if (a === 'inv') { trows.forEach((_, n) => (tsel.has(n) ? tsel.delete(n) : tsel.add(n))); return refreshTSel(); }
    if (a === 'done') { tmulti = false; tsel.clear(); return renderTheme(); }
    if (a === 'del') return deleteThemes(selVis());
  }
  async function deleteThemes(names) {
    if (!names.length) return;
    if (!P.confirm(`确定删除选中的 ${names.length} 套美化？此操作不可恢复。`)) return;
    toast(`正在删除 ${names.length} 套美化…`);
    const m = getMap(), me = getMeta();
    let ok = 0, fail = 0;
    for (const n of names) {
      if (n === curTheme()) { fail++; continue; } // 使用中的不删
      try {
        const r = await P.fetch('/api/themes/delete', { method: 'POST', headers: hdr(), body: JSON.stringify({ name: n }) });
        if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status);
        D.querySelectorAll('#themes option').forEach(o => { if (o.value === n) o.remove(); });
        delete m[n]; delete me.cats[n]; me.pins = me.pins.filter(p => p !== n);
        tsel.delete(n); ok++;
      } catch (e) { console.warn('[Philia] 删除美化失败', n, e); fail++; }
    }
    setMap(m); setMeta(me);
    pruneSnaps(); PV.sig = '';
    toast(`已删除 ${ok} 套${fail ? '，失败 ' + fail : ''}`, fail ? (ok ? 'warning' : 'error') : 'success');
    stats(); if (tab === 'theme') renderTheme();
  }

  function themeRow(n, m, cur) {
    const b = m[n];
    const pin = getMeta().pins.includes(n);
    const row = D.createElement('div');
    row.className = 'row' + (n === cur ? ' cur' : '') + (tmulti ? ' multi' : '') + (tmulti && tsel.has(n) ? ' sel' : '');
    row.innerHTML = `
      ${tmulti ? `<div class="ck2">${n === cur ? '—' : tsel.has(n) ? '✓' : ''}</div>` : ''}
      <div class="th ${b ? '' : 'empty'}" data-a="pick">${b ? `<img data-n="${esc(b)}" decoding="async" loading="lazy">` : '+'}</div>
      <div class="nm">${pin ? '📌 ' : ''}${esc(n)}<div class="sm">${tmulti && n === cur ? '使用中（不能删除）' : b ? '🔗 ' + esc(b) : '未绑定背景'}</div></div>
      <div class="btns">
        ${n === cur ? '<div class="pill ghost" style="pointer-events:none">使用中</div>' : '<div class="pill" data-a="sw">切换</div>'}
        <div class="pill ghost" data-a="pick">背景</div>
        <div class="pill ghost" data-a="menu">⋯</div>
      </div>`;
    const im = row.querySelector('img'); if (im) io.observe(im);
    if (tmulti) {
      if (n !== cur) {
        trows.set(n, row);
        row.onclick = () => { tsel.has(n) ? tsel.delete(n) : tsel.add(n); refreshTSel(); };
      }
      return row;
    }
    row.querySelectorAll('[data-a]').forEach(x => {
      x.onclick = () => {
        const a = x.dataset.a;
        if (a === 'sw') { switchTheme(n); setTimeout(render, 200); }
        if (a === 'pick') openSheet(n);
        if (a === 'menu') openMenu(n);
      };
    });
    return row;
  }

  function renderTheme() {
    const cur = curTheme();
    const m = getMap();
    const me = getMeta();
    const q = tq.trim().toLowerCase();
    const names = themes().filter(n => !q || n.toLowerCase().includes(q));
    const pins = me.pins.filter(p => names.includes(p));
    const rest = names.filter(n => !pins.includes(n));
    const mode = cfg.tmode;
    trows.clear();
    view.innerHTML = `
      <div class="card srch"><div class="sbox"><input type="text" placeholder="搜索美化…" value="${esc(tq)}"></div><div class="pill" data-a="multi">${tmulti ? '完成' : '批量'}</div></div>
      <div class="chips">
        ${[['all', '全部'], ['manual', '手动分类'], ['auto', '自动分类']].map(([k, l]) => `<div class="chip ${mode === k ? 'on' : ''}" data-md="${k}">${l}</div>`).join('')}
        ${mode === 'manual' ? '<div class="chip" data-md="newcat">＋ 分类</div>' : ''}
      </div>
      ${tmulti ? '<div class="sec"><b>Select</b><span class="tcnt"></span></div>' : ''}
      <div class="list" style="display:flex;flex-direction:column;gap:8px"></div>
      <div class="tip" style="text-align:center">点缩略图/「背景」绑定背景　·　「⋯」置顶或分类<br>切换美化时自动换上绑定的背景</div>`;
    const list = view.querySelector('.list');
    const heading = (title, count, key, extra = '') => {
      const h = D.createElement('div');
      h.className = 'sec gh';
      const f = folded.has(key);
      h.innerHTML = `<b>${f ? '▸' : '▾'} ${esc(title)}</b><span>${count}${extra}</span>`;
      h.onclick = e => {
        if (e.target.dataset.cx) return;
        f ? folded.delete(key) : folded.add(key);
        renderTheme();
      };
      list.appendChild(h);
      return f;
    };
    if (pins.length) {
      heading('📌 置顶', pins.length, 'pin');
      if (!folded.has('pin')) pins.forEach(n => list.appendChild(themeRow(n, m, cur)));
    }
    const addGroup = (title, arr, key, extra) => {
      const f = heading(title, arr.length, key, extra);
      if (!f) arr.forEach(n => list.appendChild(themeRow(n, m, cur)));
    };
    if (mode === 'all') {
      if (pins.length) heading('其余', rest.length, 'rest');
      if (!folded.has('rest')) rest.forEach(n => list.appendChild(themeRow(n, m, cur)));
    } else if (mode === 'manual') {
      me.list.forEach(c => {
        const arr = rest.filter(n => me.cats[n] === c);
        if (q && !arr.length) return;
        addGroup(c, arr, 'm:' + c, ` <i data-cx="ren" data-c="${esc(c)}">✎</i><i data-cx="del" data-c="${esc(c)}">✕</i>`);
      });
      const un = rest.filter(n => !me.list.includes(me.cats[n]));
      if (un.length) addGroup('未分类', un, 'm:未分类');
    } else {
      const ac = autoCats(rest);
      const groups = {};
      rest.forEach(n => (groups[ac[n]] = groups[ac[n]] || []).push(n));
      Object.keys(groups).sort((x, y) => (x === '其他') - (y === '其他') || groups[y].length - groups[x].length)
        .forEach(k => addGroup(k, groups[k], 'a:' + k));
    }
    if (!names.length) list.insertAdjacentHTML('beforeend', '<div class="tip" style="text-align:center">没有匹配的美化</div>');
    view.querySelector('[data-a="multi"]').onclick = () => { tmulti = !tmulti; tsel.clear(); renderTheme(); };
    refreshTSel();

    // 分类的重命名 / 删除
    list.querySelectorAll('[data-cx]').forEach(x => {
      x.onclick = e => {
        e.stopPropagation();
        const c = x.dataset.c, mm = getMeta();
        if (x.dataset.cx === 'del') {
          if (!P.confirm(`删除分类「${c}」？里面的美化会回到未分类。`)) return;
          mm.list = mm.list.filter(v => v !== c);
          Object.keys(mm.cats).forEach(k => { if (mm.cats[k] === c) delete mm.cats[k]; });
        } else {
          const nn = (P.prompt('新的分类名称', c) || '').trim();
          if (!nn || nn === c) return;
          mm.list = mm.list.map(v => (v === c ? nn : v));
          Object.keys(mm.cats).forEach(k => { if (mm.cats[k] === c) mm.cats[k] = nn; });
        }
        setMeta(mm); renderTheme();
      };
    });
    view.querySelectorAll('[data-md]').forEach(x => {
      x.onclick = () => {
        if (x.dataset.md === 'newcat') {
          const nm = (P.prompt('新分类名称') || '').trim();
          if (!nm) return;
          const mm = getMeta(); if (!mm.list.includes(nm)) mm.list.push(nm); setMeta(mm);
        } else { cfg.tmode = x.dataset.md; setCfg(cfg); }
        renderTheme();
      };
    });
    const inp = view.querySelector('.sbox input');
    let dt; inp.oninput = () => { clearTimeout(dt); dt = setTimeout(() => { tq = inp.value; const pos = inp.selectionStart; renderTheme(); const i2 = view.querySelector('.sbox input'); i2.focus(); i2.setSelectionRange(pos, pos); }, 200); };
  }

  // ---------- 设置页 ----------
  const COLORS = ['#000000', '#3a3a3a', '#b0b0b0', '#fde6ec', '#ffb3c7', '#a8c7fa', '#b8e0c8', '#e8d8ff'];
  const FX = [
    ['bright', '亮度', 20, 150, v => v + '%'],
    ['op', '透明度', 10, 100, v => v + '%'],
    ['bl', '模糊', 0, 100, v => blurPx(v) + 'px'],
  ];
  function renderSet() {
    view.innerHTML = `
      <div class="sec"><b>Profile</b><span class="clr" style="cursor:pointer">清除头像</span></div>
      <div class="card set"><div class="prof">
        <div class="av2" style="${cfg.avatar ? `background-image:url(${cfg.avatar})` : ''}">${cfg.avatar ? '' : '＋'}</div>
        <div class="col"><input type="text" data-k="title" placeholder="标题" value="${esc(cfg.title)}"><input type="text" data-k="sub" placeholder="签名" value="${esc(cfg.sub)}"></div>
      </div></div>
      <div class="sec"><b>Tavern background</b><span class="rsall" style="cursor:pointer">全部重置</span></div>
      <div class="card set">
        ${FX.map(([k, l, mn, mx, f]) => `<div><label><span>${l}</span><span><span data-v="${k}">${f(cfg.bfx[k])}</span><i class="rs" data-rs="${k}">↺</i></span></label>
          <input type="range" min="${mn}" max="${mx}" value="${cfg.bfx[k]}" data-fx="${k}"></div>`).join('')}
      </div>
      <div class="sec"><b>Appearance</b></div>
      <div class="card set">
        <div class="sw">${COLORS.map(c => `<i data-c="${c}" class="${c === cfg.accent ? 'on' : ''}" style="background:${c}"></i>`).join('')}
          <input type="color" value="${cfg.accent}" data-a="color" style="width:28px;height:24px;border:0;background:none;padding:0"></div>
        <div class="two"><div class="pill ${cfg.dark ? 'ghost' : ''}" data-a="light">浅色</div><div class="pill ${cfg.dark ? '' : 'ghost'}" data-a="dark">深色</div></div>
        <div class="pill ghost" data-a="reset">恢复默认外观</div>
      </div>`;
    view.querySelectorAll('input[type=text]').forEach(i => {
      i.oninput = () => { cfg[i.dataset.k] = i.value; setCfg(cfg); applyCfg(); };
    });
    view.querySelector('.av2').onclick = () => avInput.click();
    view.querySelector('.clr').onclick = () => { cfg.avatar = ''; setCfg(cfg); applyCfg(); renderSet(); };
    const fx = k => FX.find(x => x[0] === k);
    const sync = k => {
      view.querySelector(`[data-v="${k}"]`).textContent = fx(k)[4](cfg.bfx[k]);
      view.querySelector(`[data-fx="${k}"]`).value = cfg.bfx[k];
    };
    view.querySelectorAll('[data-fx]').forEach(i => {
      i.oninput = () => { cfg.bfx[i.dataset.fx] = +i.value; setCfg(cfg); applyBgFx(); sync(i.dataset.fx); };
    });
    view.querySelectorAll('[data-rs]').forEach(i => {
      i.onclick = () => { cfg.bfx[i.dataset.rs] = DEF.bfx[i.dataset.rs]; setCfg(cfg); applyBgFx(); sync(i.dataset.rs); };
    });
    view.querySelector('.rsall').onclick = () => { cfg.bfx = { ...DEF.bfx }; setCfg(cfg); applyBgFx(); FX.forEach(x => sync(x[0])); };
    view.querySelectorAll('[data-c]').forEach(i => (i.onclick = () => { cfg.accent = i.dataset.c; setCfg(cfg); applyCfg(); renderSet(); }));
    view.querySelector('[data-a=color]').oninput = e => { cfg.accent = e.target.value; setCfg(cfg); applyCfg(); };
    view.querySelectorAll('.pill[data-a]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'light') cfg.dark = false;
        if (a === 'dark') cfg.dark = true;
        if (a === 'reset') { if (!P.confirm('恢复默认外观？')) return; cfg = { ...DEF, bfx: cfg.bfx, tmode: cfg.tmode }; }
        setCfg(cfg); applyCfg(); renderSet();
      };
    });
  }

  // ---------- 预览：3D 翻页 ----------
  // 为了不卡：同一时间最多只画 左/中/右 三张（沙箱 iframe，无脚本），其余只是空壳；
  // 切换动画只用 transform（GPU），iframe 在动画开始后才分批创建；滑远了的会被回收
  const PV = { open: false, ready: false, list: [], idx: 0, cards: new Map(), tm: 0, generation: 0, direction: 1, css: null, cssUrl: '', sig: '', err: '', nss: 0, lk: '', last: 0 };
  const pvStage = pv.querySelector('.stage');
  const pvCards = pv.querySelector('.cards');
  const pvRange = pv.querySelector('input[type=range]');
  const PV_W = 390, PV_RATIO = 1.6, PV_H = Math.round(PV_W * PV_RATIO);
  const themeCache = new Map();
  const pcol = (v, d) => (typeof v === 'string' && /^[#\w\s(),.%-]+$/.test(v) ? v : d);
  const pnum = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const cssUrl = u => String(u).replace(/["'()\\<>\s]/g, ch => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0'));

  // 主题数据：内存 themeCache + IndexedDB 快照（刷新不丢，容量远大于 localStorage）
  let themeFetching = null;
  let scanning = false;
  // 美化名称严格区分大小写，避免不同名称命中同一份缓存
  const getTheme = n => themeCache.get(String(n ?? ''));
  const looksTheme = t => t && typeof t === 'object' && !Array.isArray(t) && t.name != null;
  const toThemes = v => {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
    if (Array.isArray(v)) return v.map(x => { if (typeof x === 'string') { try { return JSON.parse(x); } catch { return null; } } return x; }).filter(looksTheme);
    if (v && typeof v === 'object') return Object.values(v).filter(looksTheme);
    return [];
  };
  const unwrap = t => {
    if ('main_text_color' in t || 'custom_css' in t) return t;
    for (let v of Object.values(t)) {
      if (typeof v === 'string' && v.length > 20 && v[0] === '{') { try { v = JSON.parse(v); } catch {} }
      if (v && typeof v === 'object' && !Array.isArray(v) && ('main_text_color' in v || 'custom_css' in v)) return { ...v, name: t.name };
    }
    return t;
  };
  const isFull = t => !!t && typeof t === 'object' && ('main_text_color' in t || 'custom_css' in t);
  const snaps = new Map(); // 实测记录（优先级最高）
  const idb = {
    db: null, _p: null,
    open() {
      return (this._p ??= new Promise(res => {
        try {
          const rq = P.indexedDB.open('philia_db', 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore('snaps', { keyPath: 'name' });
          rq.onsuccess = () => { this.db = rq.result; res(this.db); };
          rq.onerror = rq.onblocked = () => res(null);
        } catch { res(null); }
      }));
    },
    async tx(mode, fn) {
      const db = await this.open();
      if (!db) return null;
      return new Promise(res => {
        try {
          const t = db.transaction('snaps', mode);
          const r = fn(t.objectStore('snaps'));
          t.oncomplete = () => res(r?.result ?? true);
          t.onerror = t.onabort = () => res(null);
        } catch { res(null); }
      });
    },
    all() { return this.tx('readonly', s => s.getAll()); },
    put(t) { try { return this.tx('readwrite', s => s.put(JSON.parse(JSON.stringify(t)))); } catch { return Promise.resolve(null); } },
    del(n) { return this.tx('readwrite', s => s.delete(n)); },
    clear() { return this.tx('readwrite', s => s.clear()); },
  };
  function putTheme(t, force) {
    if (!isFull(t) || t.name == null) return;
    const k = String(t.name);
    if (!force && snaps.has(k)) return; // 实测记录不被接口数据覆盖
    themeCache.set(k, t);
  }
  const putThemes = list => list.map(unwrap).forEach(t => putTheme(t));
  let snapsP = null;
  function loadSnaps() {
    return (snapsP ??= (async () => {
      const rows = await idb.all();
      (rows || []).forEach(t => { if (t?.name != null) snaps.set(String(t.name), t); });
      if (rows !== null) { // 迁移旧版 localStorage 里的快照
        try {
          const old = JSON.parse(P.localStorage.getItem('bgmgr_theme_snap') || '{}');
          for (const t of Object.values(old)) if (t?.name != null && isFull(t) && !snaps.has(String(t.name))) { snaps.set(String(t.name), t); await idb.put(t); }
          P.localStorage.removeItem('bgmgr_theme_snap');
        } catch {}
      }
      snaps.forEach(t => putTheme(t, true));
    })());
  }
  function pruneSnaps() { // 美化被删除后清掉对应记录
    const have = new Set(themes());
    [...snaps.keys()].forEach(n => {
      if (have.has(n)) return;
      snaps.delete(n); themeCache.delete(n); idb.del(n);
    });
  }
  let modP = null;
  function powerMod() {
    return (modP ??= (async () => {
      const urls = [];
      // 优先用酒馆真实加载 power-user.js 的地址，保证拿到的是同一个模块实例
      try { const e = P.performance.getEntriesByType('resource').find(x => /\/scripts\/power-user\.js/.test(x.name)); if (e) urls.push(e.name); } catch {}
      urls.push(`${base}scripts/power-user.js`, '/scripts/power-user.js');
      for (const u of [...new Set(urls)]) {
        try { const m = await P.eval(`import(${JSON.stringify(u)})`); if (m && 'themes' in m) return m; }
        catch (e) { console.warn('[Philia] 模块读取失败', u, e); }
      }
      return null;
    })());
  }
  async function modThemesList() { const m = await powerMod(); return m ? toThemes(m.themes).map(unwrap) : []; }

  async function fetchThemesOnce() {
    let err = '';
    try {
      const r = await P.fetch('/api/settings/get', { method: 'POST', headers: hdr(), body: '{}', cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      let list = toThemes(j.themes);
      if (!list.length) for (const v of Object.values(j)) { list = toThemes(v); if (list.length) break; }
      putThemes(list);
    } catch (e) { err = String(e?.message ?? e); console.warn('[Philia] /api/settings/get 失败', e); }
    if (themes().some(n => n && !isFull(getTheme(n)))) {
      try { putThemes(await modThemesList()); } catch (e) { console.warn('[Philia] 模块兜底失败', e); }
    }
    if (!themeCache.size && !snaps.size) throw new Error(err || '接口和酒馆模块里都没有美化数据');
  }
  function loadThemeData(force) {
    const sig = themes().filter(Boolean).join('|');
    if (!force && PV.sig === sig) return Promise.resolve();
    return (themeFetching ??= (async () => {
      try {
        await loadSnaps();
        try { await fetchThemesOnce(); PV.err = ''; }
        catch (e) { PV.err = String(e?.message ?? e); console.warn('[Philia] 读取美化数据失败', e); }
        PV.sig = sig;
      } finally { themeFetching = null; }
    })());
  }

  // 正在使用的美化：读酒馆当前设置（可能刚改过还没保存）。优先 power_user，再退回 CSS 变量
  const PV_KEYS = ['blur_strength', 'shadow_width', 'font_scale', 'chat_width', 'chat_display', 'avatar_style', 'noShadows', 'hideChatAvatars_enabled',
    'expand_message_actions', 'waifuMode', 'fast_ui_mode', 'reduced_motion', 'timer_enabled', 'timestamps_enabled', 'timestamp_model_icon',
    'message_token_count_enabled', 'mesIDDisplay_enabled', 'compact_input_area'];
  const puNow = () => P.SillyTavern.getContext().powerUserSettings ?? {};
  function liveTheme(name) {
    const css = P.getComputedStyle(D.documentElement);
    const pu = puNow();
    const t = { name };
    for (const [cv, f] of Object.entries(PV_COLOR_VARS)) {
      const a = pu[f];
      t[f] = typeof a === 'string' && a ? a : css.getPropertyValue(cv).trim();
    }
    PV_KEYS.forEach(k => { if (pu[k] !== undefined) t[k] = pu[k]; });
    t.custom_css = pu.custom_css ?? D.getElementById('customCSS')?.value ?? D.getElementById('custom-style')?.textContent ?? '';
    return t;
  }
  const themeSig = t => JSON.stringify([...Object.values(PV_COLOR_VARS).map(f => t[f]), ...PV_KEYS.map(k => t[k]), String(t.custom_css ?? '')]);
  const themeObj = name => (name === curTheme() ? liveTheme(name) : getTheme(name) ?? { name });

  // 把当前美化的实时样式记一份（要连续两次读到一样才算数，避免读到切换到一半的状态）
  async function snapCur() {
    const n = curTheme();
    if (!n || P.__bgmgr_swap || scanning) return;
    const pu = puNow();
    if (pu.theme !== undefined && pu.theme !== n) return;
    const a = themeSig(liveTheme(n));
    await sleep(350);
    if (curTheme() !== n || P.__bgmgr_swap || scanning) return;
    const t = liveTheme(n);
    if (themeSig(t) !== a) return;
    snaps.set(n, t); putTheme(t, true); idb.put(t);
  }
  $P(D).on('change.' + ID + 'snap', '#themes', () => setTimeout(snapCur, 1800));
  setTimeout(() => loadSnaps().then(snapCur), 1800);
  // 用户在酒馆里保存 / 更新 / 删除美化后，对应记录作废并重新记录
  $P(D).on('click.' + ID, '#ui-preset-save-button, #ui-preset-update-button, #ui-preset-delete-button', () => {
    setTimeout(() => { PV.sig = ''; pruneSnaps(); const n = curTheme(); if (n) { snaps.delete(n); idb.del(n); } snapCur(); }, 700);
  });

  // 主题 → 酒馆 CSS 变量 / body class（与酒馆应用美化时一致）
  const PV_COLOR_VARS = {
    '--SmartThemeBodyColor': 'main_text_color', '--SmartThemeEmColor': 'italics_text_color',
    '--SmartThemeUnderlineColor': 'underline_text_color', '--SmartThemeQuoteColor': 'quote_text_color',
    '--SmartThemeBlurTintColor': 'blur_tint_color', '--SmartThemeChatTintColor': 'chat_tint_color',
    '--SmartThemeUserMesBlurTintColor': 'user_mes_blur_tint_color', '--SmartThemeBotMesBlurTintColor': 'bot_mes_blur_tint_color',
    '--SmartThemeShadowColor': 'shadow_color', '--SmartThemeBorderColor': 'border_color',
  };
  function pvVars(t) {
    const out = [];
    const add = (k, v) => v != null && v !== '' && out.push(k + ':' + v);
    for (const [k, f] of Object.entries(PV_COLOR_VARS)) add(k, pcol(t[f], ''));
    add('--blurStrength', pnum(t.blur_strength));
    add('--shadowWidth', pnum(t.shadow_width));
    add('--fontScale', pnum(t.font_scale));
    if (pnum(t.chat_width) != null) add('--sheldWidth', pnum(t.chat_width) + 'vw');
    add('--doc-height', PV_H + 'px');
    return out.join(';');
  }
  const PV_FLAGS = [
    ['noShadows', 'noShadows', true], ['hideChatAvatars_enabled', 'hideChatAvatars', true],
    ['expand_message_actions', 'expandMessageActions', true], ['waifuMode', 'waifuMode', true],
    ['fast_ui_mode', 'no-blur', true], ['reduced_motion', 'reduced-motion', true],
    ['timer_enabled', 'no-timer', false], ['timestamps_enabled', 'no-timestamps', false],
    ['timestamp_model_icon', 'no-modelIcons', false], ['message_token_count_enabled', 'no-tokenCount', false],
    ['mesIDDisplay_enabled', 'no-mesIDDisplay', false],
  ];
  function pvBodyCls(t) {
    const cls = new Set([...D.body.classList].filter(c => !c.startsWith(ID)));
    const cd = pnum(t.chat_display);
    if (cd != null) {
      cls.delete('bubblechat'); cls.delete('documentstyle');
      if (cd === 1) cls.add('bubblechat');
      if (cd === 2) cls.add('documentstyle');
    }
    const as = pnum(t.avatar_style);
    if (as != null) {
      ['big-avatars', 'square-avatars', 'rounded-avatars'].forEach(c => cls.delete(c));
      if (as === 1) cls.add('big-avatars');
      if (as === 2) cls.add('square-avatars');
      if (as === 3) cls.add('rounded-avatars');
    }
    for (const [field, c, addWhenTrue] of PV_FLAGS) {
      if (typeof t[field] !== 'boolean') continue;
      if (t[field] === addWhenTrue) cls.add(c); else cls.delete(c);
    }
    return [...cls].join(' ');
  }

  // 酒馆自己的样式只读一次，内联进预览框（不发请求）；跳过当前美化的自定义 CSS 和各脚本自己的样式
  const PV_SKIP = new Set(['custom-style', ID + '-style', ID + '-fx', 'tpb-style', 'tpb-font', 'tpb-bound-bg']);
  const absUrls = (css, bs) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => {
    if (/^(data:|blob:|#)/i.test(u)) return m;
    try { return 'url("' + new URL(u, bs).href + '")'; } catch { return m; }
  });
  function sheetText(sh, depth = 0) {
    const bs = sh.href || P.location.href;
    let rules;
    try { rules = sh.cssRules; } catch { return sh.href ? '@import url("' + sh.href + '");' : ''; }
    let out = '';
    for (const r of rules) {
      if (r.type === 3) { if (r.styleSheet && depth < 4) out += sheetText(r.styleSheet, depth + 1); }
      else if (r.type === 5 && r.cssText.length > 30000 && r.cssText.includes('data:')) continue;
      else out += absUrls(r.cssText, bs) + '\n';
    }
    return out;
  }
  function pvBaseCss() {
    if (PV.css != null && PV.nss === D.styleSheets.length) return PV.css;
    let css = '';
    for (const sh of D.styleSheets) {
      if (PV_SKIP.has(sh.ownerNode?.id) || sh.disabled) continue;
      css += sheetText(sh);
    }
    PV.nss = D.styleSheets.length;
    if (PV.cssUrl) { P.URL.revokeObjectURL(PV.cssUrl); PV.cssUrl = ''; }
    return (PV.css = css.replace(/<\/style/gi, '<\\/style'));
  }
  function pvCssUrl() {
    if (!PV.cssUrl) PV.cssUrl = P.URL.createObjectURL(new Blob([pvBaseCss()], { type: 'text/css' }));
    return PV.cssUrl;
  }
  const splitImports = css => {
    const imports = [];
    const rest = css.replace(/@import\s+[^;]+;/gi, m => (imports.push(m), ''));
    return { imports: imports.join('\n'), rest };
  };

  const PV_SAMPLE = (cn, un) => [
    { user: false, html: '<p>用舍由时，行藏在我，袖手何妨闲处看。</p><p><q>“花间明月，松下凉风，输我北窗一枕。”</q></p><p><em>' + cn + '放下书卷，抬眼望向窗外的细雨。</em></p><pre><code>枕上诗书闲处好，门前风景雨来佳。</code></pre><blockquote><p>薄纱厨。轻羽扇。枕冷簟凉深院。</p></blockquote>' },
    { user: true, html: '<p><q>“雨停了，要不要出去走走？”</q><em>' + un + '推开半扇窗。</em></p>' },
    { user: false, html: '<p><em>她轻轻点头，眉眼带笑。</em></p><p><q>“好呀，正想去看看后院新开的海棠。”</q></p><p><u>这是一段下划线文字</u>，还有<strong>加粗</strong>和<code>行内代码</code>。</p>' },
  ];
  function pvMes(m, i, last) {
    return `<div class="mes${last ? ' last_mes' : ''}" mesid="${i}" ch_name="${esc(m.name)}" is_user="${m.user}" is_system="false" force_avatar="false">
<div class="mesAvatarWrapper"><div class="avatar"><img src="${esc(m.av)}" alt=""></div><div class="mesIDDisplay">#${i}</div><div class="mes_timer"></div><div class="tokenCounterDisplay">${96 + i * 41}t</div></div>
<div class="mes_block">
<div class="ch_name flex-container justifySpaceBetween"><div class="flex-container flex1 alignitemscenter"><div class="flex-container alignItemsBaseline"><span class="name_text">${esc(m.name)}</span><small class="timestamp">2026年11月21日 ${String(18 + i).padStart(2, '0')}:0${i}</small></div></div><div class="mes_buttons"><div class="mes_button extraMesButtonsHint fa-solid fa-ellipsis"></div><div class="mes_button mes_edit fa-solid fa-pencil"></div></div></div>
<div class="mes_text">${m.html}</div>
</div>
${last && !m.user ? '<div class="swipe_right fa-solid fa-chevron-right"></div>' : ''}
</div>`;
  }
  const PV_TOP = [
    ['ai-config-button', 'fa-sliders'], ['sys-settings-button', 'fa-plug'], ['advanced-formatting-button', 'fa-font'],
    ['WI-SP-button', 'fa-book-atlas'], ['user-settings-button', 'fa-user-cog'], ['backgrounds-button', 'fa-panorama'],
    ['extensions-settings-button', 'fa-cubes'], ['persona-management-button', 'fa-face-smile'], ['rightNavHolder', 'fa-address-card'],
  ];
  function pvDoc(t) {
    const c = P.SillyTavern.getContext();
    const ch = c.characters?.[c.characterId];
    const cn = ch?.name ?? c.name2 ?? '角色';
    const un = c.name1 ?? '你';
    const cAv = ch?.avatar ? '/thumbnail?type=avatar&file=' + encodeURIComponent(ch.avatar) : 'img/ai4.png';
    const uf = D.querySelector('#user_avatar_block .avatar-container.selected')?.getAttribute('data-avatar-id');
    const uAv = uf ? '/thumbnail?type=persona&file=' + encodeURIComponent(uf) : 'img/user-default.png';
    const chat = PV_SAMPLE(esc(cn), esc(un))
      .map((m, i, a) => pvMes({ ...m, name: m.user ? un : cn, av: m.user ? uAv : cAv }, i, i === a.length - 1)).join('');
    // 背景：这套美化绑定的；没绑就用当前酒馆背景（应用后看到的就是它）
    const bf = getMap()[t.name] || curBgName();
    const bgStyle = bf
      ? `background-image:url(${cssUrl(base + 'backgrounds/' + encodeURIComponent(bf))}),url(${cssUrl(base + 'thumbnail?type=bg&file=' + encodeURIComponent(bf))});background-color:#000`
      : 'background-color:#000';
    const custom = splitImports(String(t.custom_css ?? '')).rest.replace(/<\/style/gi, '<\\/style');
    const icons = PV_TOP.map(([id, ic]) => `<div id="${id}" class="drawer"><div class="drawer-toggle drawer-header"><div class="drawer-icon fa-solid fa-fw closedIcon ${ic}"></div></div></div>`).join('');
    const compact = typeof t.compact_input_area === 'boolean' ? t.compact_input_area : (P.SillyTavern.getContext().powerUserSettings?.compact_input_area ?? true);
    return `<!DOCTYPE html><html style="${esc(pvVars(t))}"><head><meta charset="utf-8"><base href="${esc(P.location.href)}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link id="pvbase" rel="stylesheet" href="${esc(pvCssUrl())}">
<style>html,body{margin:0;overflow:hidden}#chat{scrollbar-width:none}#chat::-webkit-scrollbar{display:none}</style>
<style id="custom-style">${custom}</style>
<style>#chat,#chat .mes,#chat .mes_block,#chat .mes_text,#chat .auto_hide{content-visibility:visible!important}</style>
<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>
<style id="pvlite">*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}</style></head>
<body class="${esc(pvBodyCls(t))}">
<div id="bg1" style="${esc(bgStyle)}"></div><div id="top-bar"></div><div id="top-settings-holder">${icons}</div>
<div id="sheld"><div id="chat">${chat}</div>
<div id="form_sheld"><div id="send_form"${compact ? ' class="compact"' : ''}><div id="nonQRFormItems">
<div id="leftSendForm" class="alignContentCenter"><div id="options_button" class="fa-solid fa-bars interactable"></div><div id="extensionsMenuButton" class="fa-solid fa-magic-wand-sparkles interactable"></div></div>
<textarea id="send_textarea" placeholder="输入消息……" rows="1"></textarea>
<div id="rightSendForm" class="alignContentCenter"><div id="send_but" class="fa-solid fa-paper-plane interactable"></div></div>
</div></div></div></div>
</body></html>`;
  }

  // 按预览区大小算出卡片尺寸；iframe 始终按 390 宽渲染（和手机一致），再整体缩小
  function pvLayout() {
    const w = pvStage.clientWidth, h = pvStage.clientHeight;
    if (!w || !h) return;
    const cw = Math.max(120, Math.min(w * 0.6, (h * 0.94) / PV_RATIO, 260));
    const lk = cw.toFixed(1) + '|' + h;
    if (PV.lk === lk) return; // 尺寸没变就不要重设，避免所有卡片重新缩放造成闪屏
    PV.lk = lk;
    pv.style.setProperty('--cw', cw.toFixed(1) + 'px');
    pv.style.setProperty('--ch', (cw * PV_RATIO).toFixed(1) + 'px');
    pv.style.setProperty('--sc', (cw / PV_W).toFixed(4));
    pv.style.setProperty('--fh', PV_H + 'px');
  }
  function pvCard(i) {
    const el = D.createElement('div');
    el.className = 'cd';
    el.dataset.p = i - PV.idx;
    el.dataset.i = i;
    el.dataset.name = PV.list[i];
    el.innerHTML = `<div class="ld">${esc(PV.list[i])}<small>加载中…</small></div>`;
    return el;
  }
  // 只保留当前卡片和左右邻卡，减少手机同时布局及绘制的 iframe 数量
  function pvPlace() {
    for (const [i, el] of PV.cards) {
      if (Math.abs(i - PV.idx) > 1 || el.dataset.name !== PV.list[i]) {
        el.remove(); PV.cards.delete(i);
      }
    }
    for (let i = PV.idx - 1; i <= PV.idx + 1; i++) {
      if (i < 0 || i >= PV.list.length) continue;
      let el = PV.cards.get(i);
      if (!el || el.dataset.name !== PV.list[i]) {
        el?.remove();
        el = pvCard(i); PV.cards.set(i, el); pvCards.appendChild(el);
      }
      el.dataset.p = i - PV.idx;
    }
  }
  const idle = fn => (P.requestIdleCallback ? P.requestIdleCallback(fn, { timeout: 800 }) : setTimeout(fn, 60));
  function pvMount(el, i, expectedName) {
    const name = expectedName ?? PV.list[i];
    if (!PV.open || !el?.isConnected || PV.cards.get(i) !== el ||
        PV.list[i] !== name || el.dataset.name !== name) return;
    const t = themeObj(name);
    if (!t || String(t.name) !== name || !isFull(t)) return;
    const f = D.createElement('iframe');
    f.setAttribute('sandbox', 'allow-same-origin'); // 不允许脚本：美化 CSS 只能改样式
    f.tabIndex = -1;
    el.appendChild(f);
    const doc = f.contentDocument;
    if (!doc) return f.remove();
    doc.open(); doc.write(pvDoc(t)); doc.close();
    const imp = splitImports(String(t.custom_css ?? '')).imports;
    if (imp) { const s = doc.createElement('style'); s.textContent = imp; doc.head.prepend(s); }
    const pin = () => { const c = f.isConnected && f.contentDocument?.getElementById('chat'); if (c) c.scrollTop = c.scrollHeight; };
    pin();
    [300, 1200].forEach(ms => setTimeout(pin, ms));
    let shown = false;
    const show = () => {
      if (shown || !f.isConnected || PV.cards.get(i) !== el || el.dataset.name !== name) return;
      shown = true;
      P.requestAnimationFrame(() => {
        if (!f.isConnected || PV.cards.get(i) !== el || el.dataset.name !== name) return;
        pin(); f.classList.add('ready');
        setTimeout(() => { const ld = el.querySelector('.ld'); if (ld) ld.style.display = 'none'; }, 320);
      });
    };
    const link = doc.getElementById('pvbase');
    link?.addEventListener('load', show);
    link?.addEventListener('error', show);
    setTimeout(show, 2500);
  }

  // 补全某套美化的完整数据（只读，不会改动任何设置）
  function ensureFull(name) {
    if (name === curTheme() || isFull(getTheme(name))) return Promise.resolve();
    return (async () => {
      try {
        const mt = (await modThemesList()).find(t => String(t.name) === name);
        if (isFull(mt)) { putThemes([mt]); return; }
      } catch {}
      const tries = [
        () => P.fetch(`${base}user/themes/${encodeURIComponent(name)}.json`, { credentials: 'include', cache: 'no-store' }),
        () => P.fetch('/api/themes/get', { method: 'POST', headers: hdr(), body: JSON.stringify({ name }) }),
      ];
      for (const f of tries) {
        try {
          const r = await f();
          if (!r.ok) continue;
          const t = unwrap(await r.json());
          if (isFull(t)) { putThemes([{ ...t, name }]); return; }
        } catch {}
      }
    })();
  }

  // ---------- 读取（扫描）美化 ----------
  const waitVisible = async () => { while (D.hidden) await sleep(500); };
  // 切到某套美化，等样式「真的变过去并且稳定」再读取；每套最多 4 秒，绝不会无限等待
  async function captureTheme(n, prevSig) {
    const s = D.querySelector('#themes');
    const fire = () => { s.value = n; s.dispatchEvent(new P.Event('change', { bubbles: true })); };
    fire();
    const t0 = Date.now();
    let last = '', stable = 0, changed = false, refired = false;
    while (Date.now() - t0 < 4000) {
      await sleep(80);
      if (s.value !== n && !refired) { refired = true; fire(); }
      const pu = puNow();
      if (pu.theme !== undefined && pu.theme !== n) { stable = 0; continue; }
      const live = liveTheme(n), sg = themeSig(live);
      if (sg !== prevSig) changed = true;
      if (sg === last) stable++; else { stable = 0; last = sg; }
      if (stable >= 3 && (changed || Date.now() - t0 > 900)) {
        // 切换动画结束后再做最后一次核验，避免把上一套或切换中的样式记到当前名称下
        await sleep(160);
        if (s.value !== n) { stable = 0; continue; }
        const finalPu = puNow();
        if (finalPu.theme !== undefined && finalPu.theme !== n) { stable = 0; continue; }
        const finalTheme = liveTheme(n);
        const finalSig = themeSig(finalTheme);
        if (finalSig !== last) {
          stable = 0;
          last = finalSig;
          if (finalSig !== prevSig) changed = true;
          continue;
        }
        return finalTheme;
      }
    }
    return null;
  }
  async function runCapture(todo, opts = {}) {
    if (scanning) { scanning = false; return; } // 再点一次 = 停止
    const s = D.querySelector('#themes');
    if (!s) return toast('找不到美化下拉框', 'error');
    const orig = curTheme();
    todo = todo.filter(n => n && n !== orig);
    if (!todo.length) return toast('没有需要读取的美化', 'info');
    if (opts.ask && !P.confirm(opts.ask(todo.length, orig))) return;
    const btn = pv.querySelector('[data-p="scan"]'), one = pv.querySelector('[data-p="one"]'), ap = pv.querySelector('[data-p="apply"]');
    const label = pv.querySelector('.pnm span');
    scanning = true; P.__bgmgr_swap = true;
    btn.textContent = '停止'; one.classList.add('dis'); ap.classList.add('dis');
    clearTimeout(PV.tm);
    pvCards.querySelectorAll('iframe').forEach(f => f.remove()); // 扫描期间不渲染预览，避免卡顿
    let done = 0, fail = 0, prev = themeSig(liveTheme(orig));
    try {
      for (let k = 0; k < todo.length; k++) {
        if (!scanning || GEN !== P.__bgmgr_gen) break;
        const n = todo[k];
        await waitVisible();
        label.textContent = `读取中 ${k + 1} / ${todo.length}：${n}`;
        let t = null;
        try { t = await captureTheme(n, prev); } catch (e) { console.warn('[Philia] 读取失败', n, e); }
        if (t) { prev = themeSig(t); snaps.set(n, t); putTheme(t, true); await idb.put(t); done++; } else fail++;
      }
    } finally {
      try { // 切回原来的美化并确认
        for (let k = 0; k < 3; k++) { const r = await captureTheme(orig, prev); if (r && curTheme() === orig) break; }
      } catch (e) { console.warn(e); }
      P.__bgmgr_swap = false; scanning = false;
      btn.textContent = '扫描全部';
      toast(`已记录 ${done} 套${fail ? '，失败 ' + fail : ''}，已切回「${orig}」`, fail ? (done ? 'warning' : 'error') : 'success');
      PV.generation++;
      PV.cards.forEach(el => { delete el.dataset.miss; delete el.dataset.busy; });
      stats();
      if (PV.open) { PV.ready = true; pvInfo(); pvFrames(true); }
      scheduleBound();
    }
  }
  async function scanAll() {
    if (scanning) { scanning = false; return; }
    await loadSnaps(); await loadThemeData();
    const orig = curTheme();
    let todo = themes().filter(n => n && n !== orig && !isFull(getTheme(n)));
    let force = false;
    if (!todo.length) {
      if (!P.confirm('所有美化都已记录过了。\n要清空记录并全部重新扫描吗？')) return;
      snaps.clear(); await idb.clear();
      todo = themes().filter(n => n && n !== orig); force = true;
    }
    return runCapture(todo, force ? {} : {
      ask: (c, o) => `将逐个切换 ${c} 套美化来读取样式（每套约 0.5~1 秒），期间界面会闪动，结束后自动切回「${o}」。\n\n注意：当前美化里没保存的修改会丢失，请先在酒馆里保存。继续？`,
    });
  }
  function readOne() {
    const n = PV.list[PV.idx];
    if (!n || n === curTheme()) return;
    return runCapture([n], { ask: (c, o) => `将临时切换到「${n}」读取样式，然后自动切回「${o}」。\n当前美化里没保存的修改会丢失。继续？` });
  }

  // 当前卡片优先；异步补全完成后再次核对索引、名称和卡片身份，杜绝旧请求串位
  function pvStep() {
    if (!PV.open || !PV.ready || scanning) return;
    const order = [PV.idx, PV.idx + PV.direction, PV.idx - PV.direction];
    for (const i of order) {
      if (i < 0 || i >= PV.list.length) continue;
      const el = PV.cards.get(i);
      if (!el || el.dataset.busy || el.dataset.miss || el.querySelector('iframe')) continue;
      const name = PV.list[i];
      const token = String(PV.generation);
      el.dataset.busy = token;
      ensureFull(name).catch(e => console.warn('[Philia] 补全美化数据失败', e)).then(() => {
        const valid = () => PV.open && PV.ready && !scanning &&
          PV.generation === Number(token) && PV.list[i] === name &&
          PV.cards.get(i) === el && el.isConnected && el.dataset.name === name;
        if (!valid()) {
          if (el.dataset.busy === token) delete el.dataset.busy;
          return;
        }
        if (name === curTheme() || (isFull(getTheme(name)) && String(getTheme(name).name) === name)) {
          idle(() => {
            if (el.dataset.busy === token) delete el.dataset.busy;
            if (!valid()) return;
            if (Date.now() - PV.last < 240) { PV.tm = setTimeout(pvStep, 260); return; }
            try { pvMount(el, i, name); } catch (e) { console.warn('[Philia] 预览渲染失败', e); }
            pvInfo();
            PV.tm = setTimeout(pvStep, 100);
          });
        } else {
          if (el.dataset.busy === token) delete el.dataset.busy;
          if (!valid()) return;
          el.dataset.miss = '1';
          const sm = el.querySelector('.ld small'); if (sm) sm.textContent = '未记录样式';
          pvInfo();
          PV.tm = setTimeout(pvStep, 60);
        }
      });
      return;
    }
  }
  function pvFrames(now) { clearTimeout(PV.tm); PV.tm = setTimeout(pvStep, now ? 0 : 320); }
  function pvInfo() {
    const n = PV.list[PV.idx];
    if (n == null) return;
    const isCur = n === curTheme();
    const b = getMap()[n];
    const miss = PV.ready && !isCur && !isFull(getTheme(n));
    pv.querySelector('.pnm b').textContent = n;
    if (!scanning) pv.querySelector('.pnm span').textContent = miss
      ? '⚠ 还没记录这套的样式 · 点「读取此套」'
      : `${PV.idx + 1} / ${PV.list.length}${isCur ? ' · 使用中' : ''}${b ? ' · 🔗 ' + b : ''}`;
    pvRange.value = PV.idx;
    const ap = pv.querySelector('[data-p="apply"]');
    ap.textContent = isCur ? '使用中' : '应用此美化';
    ap.classList.toggle('dis', isCur || scanning);
    pv.querySelector('[data-p="one"]').classList.toggle('dis', !miss || scanning);
    pv.querySelector('.nav.l').classList.toggle('off', PV.idx <= 0);
    pv.querySelector('.nav.r').classList.toggle('off', PV.idx >= PV.list.length - 1);
  }
  function pvGo(i) {
    if (!PV.open) return;
    i = Math.max(0, Math.min(PV.list.length - 1, i));
    if (i === PV.idx) return;
    PV.direction = i > PV.idx ? 1 : -1;
    PV.idx = i; PV.last = Date.now(); PV.generation++;
    pvPlace(); pvInfo(); pvFrames();
  }
  async function openPv() {
    const names = themes().filter(Boolean);
    if (!names.length) return toast('还没有美化可预览', 'warning');
    if (PV.open) return;
    PV.generation++; PV.direction = 1;
    PV.list = names; PV.ready = false; modP = null;
    PV.idx = Math.max(0, names.indexOf(curTheme()));
    PV.open = true;
    pv.classList.add('open');
    pvRange.max = names.length - 1;
    pvLayout(); pvPlace(); pvInfo();
    await loadThemeData();
    if (!PV.open) return;
    PV.generation++; PV.ready = true;
    pvInfo();
    pvFrames(true);
  }
  function closePv() {
    if (!PV.open) return;
    PV.open = false; PV.ready = false; PV.generation++;
    clearTimeout(PV.tm);
    pv.classList.remove('open');
    pvCards.innerHTML = '';
    PV.cards.clear();
  }

  pv.querySelector('[data-p="apply"]').onclick = () => {
    const n = PV.list[PV.idx];
    if (!n || n === curTheme()) return;
    switchTheme(n);
    setTimeout(pvInfo, 400);
    setTimeout(() => { if (tab === 'theme') render(true); }, 450);
  };
  pv.querySelector('[data-p="scan"]').onclick = scanAll;
  pv.querySelector('[data-p="one"]').onclick = readOne;
  pv.querySelector('.nav.l').onclick = () => pvGo(PV.idx - 1);
  pv.querySelector('.nav.r').onclick = () => pvGo(PV.idx + 1);
  pvRange.oninput = () => pvGo(+pvRange.value);
  // 滑动 / 点侧边卡片切换
  {
    let sx = null, sy = 0;
    pvStage.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    pvStage.addEventListener('pointercancel', () => { sx = null; });
    pvStage.addEventListener('pointerup', e => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2) return pvGo(PV.idx + (dx < 0 ? 1 : -1));
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        // 3D 变换后的卡片命中判断不稳，按点击位置在中间卡片左边还是右边来判断
        const c = pvCards.querySelector('.cd[data-p="0"]')?.getBoundingClientRect();
        if (!c || e.target.closest?.('.nav')) return;
        if (e.clientX < c.left) pvGo(PV.idx - 1);
        else if (e.clientX > c.right) pvGo(PV.idx + 1);
      }
    });
  }
  $P(D).on('keydown.' + ID, e => {
    if (!PV.open) return;
    if (e.key === 'ArrowLeft') pvGo(PV.idx - 1);
    else if (e.key === 'ArrowRight') pvGo(PV.idx + 1);
  });

  applyCfg();
  applyBgFx();
  render();
})();
