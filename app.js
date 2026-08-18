/* ============================================================
 * app.js —— 小派学 Python 的核心逻辑
 * 路由 / 练习引擎 / SRS 自动复习 / XP 连击 / 练习场 / 演示 / 礼花
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 工具 ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function yesterdayStr() {
    const d = new Date(Date.now() - 864e5);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const fmtDate = (ts) => {
    const d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  };
  const isHttp = location.protocol === 'http:' || location.protocol === 'https:';

  /* ---------------- 存储 ---------------- */
  const STORE_KEY = 'xpai_progress_v1';
  const mem = {};
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return mem; }
    },
    save(v) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { Object.assign(mem, v); }
    }
  };

  /* ---------------- 状态 ---------------- */
  const S = Object.assign({
    xp: 0, streak: 0, lastDay: '', totalAnswered: 0, correctAnswered: 0,
    chapters: {}
  }, store.load());

  function save() { store.save(S); }

  const SRS_DAYS = [1, 3, 7, 21];
  const LEVELS = ['初学者', '新手上路', '小试牛刀', '渐入佳境', 'Python 学徒', '代码行者', 'AI 玩家', '编程高手', '大师之路', '传奇人物'];

  function chState(id) { return S.chapters[id] || { stage: 0 }; }
  const isLearned = (id) => chState(id).stage >= 1;
  const isMastered = (id) => chState(id).stage >= 5;
  const isDue = (id) => {
    const c = chState(id);
    return c.stage >= 1 && c.stage <= 4 && c.dueAt && c.dueAt <= Date.now();
  };
  function level() { return Math.floor(S.xp / 150) + 1; }
  function levelProgress() { return (S.xp % 150) / 150; }

  /* ---------------- 全局渲染 ---------------- */
  function renderInline(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  // 测验题：含换行时把后半部分渲染成代码块
  function renderQText(text) {
    if (text.indexOf('\n') >= 0) {
      const nl = text.indexOf('\n');
      const head = text.slice(0, nl);
      const code = text.slice(nl + 1);
      return '<div class="q-text">' + renderInline(head) + '</div>' +
        '<pre class="q-code">' + highlightPy(code) + '</pre>';
    }
    return '<div class="q-text">' + renderInline(text) + '</div>';
  }

  function highlightPy(code) {
    const RE = /(f?(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'))|(#[^\n]*)|(\bdef\s+[A-Za-z_]\w*)|(\b(?:if|elif|else|for|while|in|and|or|not|return|break|continue|True|False|None)\b)|(\b(?:print|len|range|int|float|str|bool|abs|sum|min|max|type|list|input)\b)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([^\w\s])/g;
    let out = '', last = 0, m;
    while ((m = RE.exec(code))) {
      out += escapeHtml(code.slice(last, m.index));
      const [, str, cm, defn, kw, blt, num] = m;
      if (str) out += '<span class="tok-str">' + escapeHtml(str) + '</span>';
      else if (cm) out += '<span class="tok-cm">' + escapeHtml(cm) + '</span>';
      else if (defn) {
        const p = defn.split(/\s+/);
        out += '<span class="tok-kw">' + p[0] + '</span> <span class="tok-fn">' + escapeHtml(p[1]) + '</span>';
      } else if (kw) out += '<span class="tok-kw">' + kw + '</span>';
      else if (blt) out += '<span class="tok-blt">' + blt + '</span>';
      else if (num) out += '<span class="tok-num">' + num + '</span>';
      else out += escapeHtml(m[0]);
      last = RE.lastIndex;
    }
    out += escapeHtml(code.slice(last));
    return out;
  }

  const _codeBank = [];
  function codeBlockHTML(code, runnable) {
    let btn = '';
    if (runnable) {
      _codeBank.push(code);
      btn = '<button class="run-btn" data-run="' + (_codeBank.length - 1) + '">▶ 运行</button>';
    }
    return '<div class="code-wrap"><div class="code-head">' +
      '<span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>' +
      '<span class="lang">PYTHON</span>' + btn + '</div>' +
      '<pre><code>' + highlightPy(code) + '</code></pre></div>';
  }

  function renderBlocks(blocks) {
    return blocks.map(function (b) {
      switch (b.t) {
        case 'h': return '<div class="block"><h3>' + b.text + '</h3></div>';
        case 'p': return '<div class="block"><p>' + renderInline(b.text) + '</p></div>';
        case 'list': return '<div class="block"><ul>' + b.items.map(function (i) { return '<li>' + renderInline(i) + '</li>'; }).join('') + '</ul></div>';
        case 'code': return '<div class="block">' + codeBlockHTML(b.code, b.run) + '</div>';
        case 'tip': {
          return '<div class="tip ' + b.kind + '"><div>' +
            '<div class="t-t">' + b.title + '</div><div class="t-x">' + renderInline(b.text) + '</div></div></div>';
        }
        case 'demo': return '<div class="demo" data-demo="' + b.type + '"></div>';
      }
      return '';
    }).join('');
  }

  function chapterCard(ch) {
    const st = chState(ch.id);
    let status = '<span class="c-status new">未学习</span>';
    if (isMastered(ch.id)) status = '<span class="c-status done">已掌握</span>';
    else if (isDue(ch.id)) status = '<span class="c-status due">待复习</span>';
    else if (isLearned(ch.id)) status = '<span class="c-status done">已学完</span>';
    const pct = Math.min(100, st.stage >= 5 ? 100 : st.stage * 20);
    const num = String(DATA.chapters.indexOf(ch) + 1).padStart(2, '0');
    return '<div class="chapter-card" data-nav="ch/' + ch.id + '">' +
      '<div class="c-num">' + num + '</div>' +
      '<div class="c-t">' + ch.title + ' <span class="chip">' + ch.tag + '</span></div>' +
      '<div class="c-d">' + ch.desc + '</div>' +
      '<div class="c-meta">' + ch.time + status + '</div>' +
      '<div class="progress-strip"><i style="width:' + pct + '%"></i></div></div>';
  }

  function mountDemos() {
    $$('[data-demo]').forEach(function (el) {
      mountDemo(el.dataset.demo, el);
    });
  }

  /* ---------------- 演示组件 ---------------- */
  function mountDemo(type, el) {
    if (type === 'if') {
      el.innerHTML = '<div class="d-ttl">试试条件判断：拖动滑块</div>' +
        '<div class="if-demo">' +
        '<div class="ctrl"><label>年龄（age）</label><input type="range" min="0" max="30" value="15">' +
        '<div class="val">15 岁</div></div>' +
        '<div class="flow">' +
        '<div class="node"><span class="arr">①</span> if age &gt;= 18：成年</div>' +
        '<div class="node"><span class="arr">②</span> else：未成年</div>' +
        '</div></div>';
      const input = $('input', el), flow = $('.flow', el), val = $('.val', el);
      const nodes = $$('.node', el);
      function upd() {
        const a = +input.value;
        val.textContent = a + ' 岁';
        const adult = a >= 18;
        nodes[0].classList.toggle('hit', adult);
        nodes[0].classList.toggle('miss', !adult);
        nodes[1].classList.toggle('hit', !adult);
        nodes[1].classList.toggle('miss', adult);
      }
      input.addEventListener('input', upd);
      upd();
    } else if (type === 'loop') {
      el.innerHTML = '<div class="d-ttl">看 for 循环怎么跑</div>' +
        '<div class="loop-demo">' +
        '<div style="display:flex;gap:10px"><button class="btn sm primary" data-lp="for">▶ 播放 for</button>' +
        '<button class="btn sm" data-lp="while">▶ 播放 while</button></div>' +
        '<div class="bars" id="loopBars"></div>' +
        '<div class="logline" id="loopLog">点击按钮，看看循环每一步发生了什么</div></div>';
      const bars = $('#loopBars', el), log = $('#loopLog', el);
      const CH = ['紫', '蓝', '青', '绿', '金'];
      let timer = null;
      function reset() {
        clearInterval(timer);
        bars.innerHTML = '';
        const heights = [18, 36, 54, 72, 90];
        CH.forEach(function (c, i) {
          const b = document.createElement('div');
          b.className = 'bar';
          b.style.background = 'linear-gradient(180deg,' + c + ', #6d28d9)';
          b.style.height = '0px';
          b.textContent = '';
          b.dataset.h = heights[i];
          bars.appendChild(b);
        });
        return $$('.bar', bars);
      }
      $('[data-lp=for]', el).addEventListener('click', function () {
        const bs = reset();
        let i = 0;
        log.innerHTML = 'for i in <b>range(5)</b>: 开始循环…';
        timer = setInterval(function () {
          if (i >= 5) { clearInterval(timer); log.innerHTML = '✅ 循环结束！range(5) 依次取出 0,1,2,3,4'; return; }
          bs[i].style.height = bs[i].dataset.h + 'px';
          bs[i].textContent = i;
          log.innerHTML = 'i = <b>' + i + '</b> → 执行循环体，然后 i 自动 +1';
          i++;
        }, 650);
      });
      $('[data-lp=while]', el).addEventListener('click', function () {
        const bs = reset();
        let n = 0;
        log.innerHTML = 'while n &lt; 3: 开始循环…';
        timer = setInterval(function () {
          if (n >= 3) { clearInterval(timer); log.innerHTML = '✅ 条件 n&lt;3 不满足了，循环停下'; return; }
          bs[n].style.height = bs[n].dataset.h + 'px';
          bs[n].textContent = n;
          log.innerHTML = 'n = <b>' + n + '</b>（满足 n&lt;3）→ 执行，然后 n += 1';
          n++;
        }, 700);
      });
    } else if (type === 'list') {
      el.innerHTML = '<div class="d-ttl">列表列车：输入内容点「上车」</div>' +
        '<div class="list-demo">' +
        '<div class="train" id="listTrain"></div>' +
        '<div class="inrow"><input id="listInput" placeholder="输入一个元素，比如：苹果" maxlength="10">' +
        '<button class="btn sm primary" id="listAdd">上车 +</button>' +
        '<button class="btn sm" id="listPop">下车 -</button></div></div>';
      const train = $('#listTrain', el), input = $('#listInput', el);
      const items = [];
      function render() {
        train.innerHTML = items.map(function (v, i) {
          return '<div class="car">' + escapeHtml(v) + '<span class="idx">[' + i + ']</span></div>';
        }).join('') || '<div style="color:var(--text-faint);font-size:13px;padding:14px">列车还是空的，快加点东西～</div>';
      }
      $('#listAdd', el).addEventListener('click', function () {
        const v = input.value.trim();
        if (!v) return;
        items.push(v);
        input.value = '';
        render();
      });
      $('#listPop', el).addEventListener('click', function () {
        if (items.length) { items.pop(); render(); }
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#listAdd', el).click(); });
      render();
    } else if (type === 'chat') {
      el.innerHTML = '<div class="chat-demo">' +
        '<div class="chat-win" id="chatWin"></div>' +
        '<div class="chat-in"><input id="chatInput" placeholder="跟小派说点什么…（你好 / 名字 / python）">' +
        '<button class="btn sm primary" id="chatSend">发送</button></div>' +
        '<div class="chat-hint">提示：它只会回答预设好的关键词——这就是「规则版」AI。点击下方代码块的「运行」按钮，看看它的 Python 源代码。</div></div>';
      const win = $('#chatWin', el), input = $('#chatInput', el);
      function botReply(text) {
        if (text.indexOf('你好') >= 0) return '你好呀！我是规则版小AI 🤖';
        if (text.indexOf('名字') >= 0) return '我叫小派，是这里的 AI 助教';
        if (text.toLowerCase().indexOf('python') >= 0) return 'Python 是 AI 世界的通用语言！';
        if (text.indexOf('再见') >= 0) return '再见！记得复习哦';
        return '我还没学会回答『' + text + '』，试试问问我：你好 / 名字 / python';
      }
      function addMsg(who, text, delay) {
        const d = document.createElement('div');
        d.className = 'chat-msg ' + who;
        if (who === 'bot') d.innerHTML = '<span class="who">🤖 规则版小AI</span>';
        d.textContent = text;
        win.appendChild(d);
        win.scrollTop = win.scrollHeight;
        return d;
      }
      function send() {
        const t = input.value.trim();
        if (!t) return;
        addMsg('user', t);
        input.value = '';
        const typing = addMsg('bot', '');
        typing.innerHTML = '<span class="who">🤖 规则版小AI</span><span class="typing"><i></i><i></i><i></i></span>';
        setTimeout(function () {
          typing.innerHTML = '<span class="who">🤖 规则版小AI</span>' + escapeHtml(botReply(t));
          win.scrollTop = win.scrollHeight;
        }, 500 + Math.random() * 500);
      }
      $('#chatSend', el).addEventListener('click', send);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      addMsg('bot', '你好！我是规则版小AI 🤖 试试问我：你好 / 名字 / python');
    }
  }

  /* ---------------- 练习场 ---------------- */
  let pyodideReady = null, pyodideFailed = false, currentEngine = 'mini';

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('脚本加载失败: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensurePyodide() {
    if (pyodideReady) return pyodideReady;
    if (pyodideFailed) return Promise.reject(new Error('pyodide 不可用'));
    pyodideReady = (async function () {
      await loadScript('pyodide/pyodide.js');
      if (typeof loadPyodide !== 'function') throw new Error('loadPyodide 未定义');
      const py = await loadPyodide({ indexURL: 'pyodide/' });
      py.setStdout({ batched: function (s) { playgroundLine(String(s)); } });
      py.setStderr({ batched: function (s) { playgroundLine(String(s), true); } });
      return py;
    })().catch(function (e) {
      pyodideFailed = true;
      pyodideReady = null;
      throw e;
    });
    return pyodideReady;
  }

  function currentEngineLabel() { return currentEngine === 'pyodide' ? '完整 Python 3.12' : '内置迷你引擎'; }

  function playgroundLine(text, isErr) {
    const out = $('#pgOut');
    if (!out) return;
    if (out.dataset.cleared === '1') { out.innerHTML = ''; delete out.dataset.cleared; }
    const d = document.createElement('div');
    d.textContent = text;
    if (isErr) d.className = 'err';
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  }

  async function runCode(code) {
    const out = $('#pgOut');
    out.innerHTML = '';
    const eng = $('#pgEngine');
    try {
      const py = await ensurePyodide();
      currentEngine = 'pyodide';
      eng.textContent = '引擎：完整 Python 3.12';
      eng.classList.remove('mini');
      await py.runPythonAsync(code);
      if (!out.textContent.trim()) {
        out.innerHTML = '<span class="hint">（运行成功，没有输出——代码里没有 print）</span>';
      }
    } catch (e) {
      if (pyodideFailed) {
        currentEngine = 'mini';
        eng.textContent = '引擎：内置迷你引擎（离线）';
        eng.classList.add('mini');
        const r = MiniPy.run(code, {});
        (r.output || '').split('\n').forEach(function (l) { if (l !== '') playgroundLine(l); });
        if (!r.ok) playgroundLine('❌ ' + (r.error || '出错了'), true);
        else if (r.output === '') playgroundLine('（没有输出——代码运行成功但没有 print）', false);
      } else {
        playgroundLine('❌ ' + String(e.message || e), true);
      }
    }
  }

  function openPlayground(code) {
    const pg = $('#playground');
    $('#pgCode').value = code;
    pg.style.display = 'flex';
    pg.classList.add('open');
    runCode(code);
    $('#pgCode').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function closePlayground() {
    $('#playground').style.display = 'none';
    $('#playground').classList.remove('open');
  }

  const EXAMPLES = [
    { name: '你好，世界', code: 'print("你好，世界！")\nprint("我在学 Python 🐍")' },
    { name: '变量与 f-string', code: 'name = "小派"\nage = 18\nprint(f"我是{name}，今年{age}岁")' },
    { name: 'if 成绩判断', code: 'score = 85\nif score >= 90:\n    print("优秀！")\nelif score >= 60:\n    print("及格啦")\nelse:\n    print("继续加油")' },
    { name: 'for 循环', code: 'for i in range(5):\n    print(f"第 {i+1} 次循环")' },
    { name: 'while 倒计时', code: 'n = 5\nwhile n > 0:\n    print(f"倒计时 {n}")\n    n -= 1\nprint("发射！🚀")' },
    { name: '累加 1 到 100', code: 'total = 0\nfor i in range(1, 101):\n    total += i\nprint(f"1+2+...+100 = {total}")' },
    { name: '九九乘法表', code: 'for a in range(1, 10):\n    row = ""\n    for b in range(1, a + 1):\n        row += f"{b}×{a}={a*b}  "\n    print(row)' },
    { name: '列表与统计', code: 'scores = [88, 92, 75, 100, 69]\nprint(f"共 {len(scores)} 门课")\ntotal = 0\nfor s in scores:\n    total += s\nprint(f"平均分：{total / len(scores)}")' },
    { name: '字典学生档案', code: 'student = {"name": "小派", "age": 18, "city": "北京"}\nfor key, value in student.items():\n    print(f"{key}: {value}")' },
    { name: '函数：打招呼', code: 'def greet(name, emoji):\n    return f"你好，{name}！{emoji}"\n\nprint(greet("小派", "👋"))\nprint(greet("AI", "🤖"))' },
    { name: '规则版小 AI', code: 'def bot_reply(text):\n    if "你好" in text:\n        return "你好呀！我是规则版小AI 🤖"\n    elif "名字" in text:\n        return "我叫小派，是这里的 AI 助教"\n    elif "python" in text.lower():\n        return "Python 是 AI 世界的通用语言！"\n    elif "再见" in text:\n        return "再见！记得复习哦"\n    else:\n        return f"我还没学会回答『{text}』"\n\nprint(bot_reply("你好"))\nprint(bot_reply("python 是什么"))\nprint(bot_reply("今天天气"))' },
    { name: '找秘密数字', code: 'secret = 42\nguess = 0\ntries = 0\nwhile guess != secret:\n    guess += 1\n    tries += 1\nprint(f"猜了 {tries} 次终于找到 {guess}！")' }
  ];

  function initPlayground() {
    const sel = $('#pgExamples');
    EXAMPLES.forEach(function (ex, i) {
      const o = document.createElement('option');
      o.value = i; o.textContent = ex.name;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      $('#pgCode').value = EXAMPLES[+sel.value].code;
      runCode($('#pgCode').value);
    });
    $('#pgRun').addEventListener('click', function () { runCode($('#pgCode').value); });
    $('#pgClear').addEventListener('click', function () {
      $('#pgCode').value = '# 在这里写你的 Python 代码\nprint("你好，Python！")';
      $('#pgOut').innerHTML = '<span class="hint">已清空。点「运行」试试吧～</span>';
    });
    $('#pgClose').addEventListener('click', closePlayground);
    $('#pgCode').value = EXAMPLES[0].code;
  }

  /* ---------------- 练习引擎 ---------------- */
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  function startQuiz(container, opts) {
    let qs = shuffle(opts.pool);
    if (opts.n) qs = qs.slice(0, opts.n);
    let i = 0, correct = 0;
    const total = qs.length;

    function finish() {
      const pass = correct / total >= 0.6;
      S.xp += correct * 10;
      S.totalAnswered += total;
      S.correctAnswered += correct;
      save();
      if (opts.onFinish) opts.onFinish(correct, total, pass);
      let html = '<div class="quiz-done">' +
        '<div class="big">' + (pass ? '🎉' : '💪') + '</div>' +
        '<h3>' + (pass ? '太棒了！' : '别灰心，再来一次') + '</h3>' +
        '<p>答对 <b>' + correct + '</b> / ' + total + ' 题 · 获得 <b style="color:var(--yellow)">+' + (correct * 10) + ' XP</b>' +
        (pass ? ' · 通过！' : ' · 正确率 ≥ 60% 算通过') + '</p>' +
        '<div style="margin-top:18px;display:flex;gap:10px;justify-content:center">' +
        '<button class="btn sm" data-retry>再来一次</button>' +
        '<button class="btn sm primary" data-goto="' + (opts.goto || 'home') + '">继续</button>' +
        '</div></div>';
      container.innerHTML = html;
      if (pass) confetti();
      $('[data-retry]', container).addEventListener('click', function () {
        startQuiz(container, opts);
      });
      const go = $('[data-goto]', container);
      if (go) go.addEventListener('click', function () { location.hash = '#/' + go.dataset.goto; });
    }

    function renderQ() {
      if (i >= total) return finish();
      const q = qs[i];
      const opts2 = shuffle(q.options.map(function (t, idx) { return { t: t, idx: idx }; }));
      container.innerHTML =
        '<div class="q-card">' +
        renderQText(q.q) +
        '<div class="q-options">' + opts2.map(function (o, k) {
          return '<div class="q-opt" data-i="' + o.idx + '" data-k="' + k + '">' +
            '<span class="k">' + LETTERS[k] + '</span><span>' + renderInline(o.t) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="q-explain" style="display:none"></div>' +
        '<div class="q-foot"><span class="quiz-progress">第 ' + (i + 1) + ' / ' + total + ' 题 · 已答对 ' + correct + ' 题</span></div></div>';

      const card = $('.q-card', container);
      const options = $$('.q-opt', container);
      let locked = false;
      options.forEach(function (opt) {
        opt.addEventListener('click', function () {
          if (locked) return;
          locked = true;
          const chosen = +opt.dataset.i;
          const isRight = chosen === q.answer;
          if (isRight) correct++;
          options.forEach(function (o) {
            o.classList.add('disabled');
            if (+o.dataset.i === q.answer) o.classList.add('correct');
          });
          if (!isRight) opt.classList.add('wrong');
          const ex = $('.q-explain', card);
          ex.style.display = 'block';
          ex.innerHTML = (isRight ? '✅ <b>回答正确！</b> ' : '❌ <b>再想想～</b> ') + escapeHtml(q.explain);
          const foot = $('.q-foot', card);
          const btn = document.createElement('button');
          btn.className = 'btn sm primary';
          btn.textContent = i + 1 >= total ? '查看结果' : '下一题 →';
          btn.addEventListener('click', function () { i++; renderQ(); });
          foot.appendChild(btn);
        });
      });
    }
    container.innerHTML = '<div class="quiz-head">小节测验<span class="quiz-progress">准备开始…</span></div>';
    renderQ();
  }

  /* ---------------- 页面渲染 ---------------- */
  const view = () => $('#view');

  function renderHome() {
    const due = DATA.chapters.filter(function (c) { return isDue(c.id); });
    const nextCh = DATA.chapters.find(function (c) { return !isLearned(c.id); });
    const learnedCount = DATA.chapters.filter(function (c) { return isLearned(c.id); }).length;
    const masteredCount = DATA.chapters.filter(function (c) { return isMastered(c.id); }).length;
    const total = DATA.chapters.length;
    const pct = Math.round(learnedCount / total * 100);
    const tip = DATA.aiTips[Math.floor(Math.random() * DATA.aiTips.length)];

    let tasks = '';
    if (due.length) {
      tasks = due.map(function (c) {
        return '<div class="task-item" data-nav="review">' +
          '<span class="t-dot"></span>' +
          '<span class="t-t">复习：第 ' + c.id.slice(2) + ' 章 · ' + c.title + '</span>' +
          '<span class="t-d">今天该复习了</span></div>';
      }).join('');
    } else if (nextCh) {
      tasks = '<div class="task-item" data-nav="ch/' + nextCh.id + '">' +
        '<span class="t-dot"></span>' +
        '<span class="t-t">继续学习：' + nextCh.title + '</span>' +
        '<span class="t-d">' + nextCh.time + ' · ' + nextCh.desc + '</span></div>';
    } else {
      tasks = '<div class="task-item" data-nav="review">' +
        '<span class="t-dot"></span>' +
        '<span class="t-t">全部章节学完啦</span>' +
        '<span class="t-d">去复习页巩固一下，或者玩玩练习场</span></div>';
    }

    view().innerHTML =
      '<div class="view">' +
      '<div class="hero">' +
      '<div class="float-chip c1">print("Hello, AI")</div>' +
      '<div class="float-chip c2">if age &gt;= 18:</div>' +
      '<div class="float-chip c3">for i in range(5):</div>' +
      '<div class="hero-badge">基于上海高一信息课编程水平设计</div>' +
      '<div class="hero-title-row">' +
      '<h1>🐍 你好，<span class="hi">小派</span>！</h1>' +
      '<span class="creator">创作者：董晨</span>' +
      '</div>' +
      '<p>' + renderInline('从高一信息课学过的 `print`、变量、`if` 出发，一路写到会聊天的「规则版小 AI」——5 章 · 约 40 分钟，配练习与自动复习，接轨 AI 时代。') + '</p>' +
      '<div class="cta">' +
      '<button class="btn primary" data-nav="' + (nextCh ? 'ch/' + nextCh.id : 'review') + '">' + (nextCh ? '继续学习' : '去复习') + '</button>' +
      '<button class="btn" data-nav="practice">综合练习</button>' +
      '<button class="btn" data-nav="ai">AI 专区</button>' +
      (isHttp ? '<button class="btn" data-share>分享给同学</button>' : '') +
      '</div></div>' +

      '<div class="stats">' +
      '<div class="stat"><div class="ring-wrap">' +
      '<svg width="86" height="86"><circle cx="43" cy="43" r="36" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>' +
      '<circle cx="43" cy="43" r="36" fill="none" stroke="url(#gg)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (2 * Math.PI * 36) + '" stroke-dashoffset="' + (2 * Math.PI * 36 * (1 - pct / 100)) + '"/>' +
      '<defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#6d28d9"/></linearGradient></defs></svg>' +
      '<div class="ring-txt">' + pct + '%<small>进度</small></div></div>' +
      '<div><div class="num">' + learnedCount + '/' + total + '</div><div class="lbl">章节已学</div></div></div>' +

      '<div class="stat"><div><div class="num" style="color:var(--yellow)">' + S.xp + '</div><div class="lbl">累计 XP · Lv.' + level() + ' ' + LEVELS[Math.min(level() - 1, LEVELS.length - 1)] + '</div></div></div>' +
      '<div class="stat"><div><div class="num" style="color:var(--pink)">' + S.streak + '</div><div class="lbl">连续学习天数</div></div></div>' +
      '<div class="stat"><div><div class="num" style="color:var(--cyan)">' + S.correctAnswered + '</div><div class="lbl">累计答对题目</div></div></div>' +
      '</div>' +

      '<div class="section-title">今日任务</div>' +
      tasks +

      '<div class="section-title">课程地图</div>' +
      '<div class="chapter-grid">' + DATA.chapters.map(chapterCard).join('') + '</div>' +

      '<div class="section-title">今日 AI 一句话</div>' +
      '<div class="ai-card"><div class="txt"><b>' + tip + '</b><br><span style="font-size:12.5px;color:var(--text-faint)">来自「AI 大冒险」章 · 打开 <a href="#/ai" style="color:var(--accent2)">AI 专区</a> 了解更多</span></div></div>' +
      '</div>';
  }

  function renderCourse() {
    view().innerHTML =
      '<div class="view">' +
      '<div class="lesson-head">' +
      '<div><h2>课程</h2><div class="meta"><span class="chip">5 章</span><span class="chip">约 40 分钟</span><span class="chip">学完自动安排复习</span></div></div></div>' +
      '<p style="color:var(--text-dim);font-size:14.5px;line-height:1.9;margin-top:10px">' + renderInline('从上海高一信息课学过的 `print`、变量、`if` 出发，一路学到列表、字典、函数，最后用它们写一个「规则版小 AI」。每章末尾有 3-4 道小题，答对 60% 即通过。') + '</p>' +
      '<div class="chapter-grid" style="margin-top:18px">' + DATA.chapters.map(chapterCard).join('') + '</div>' +
      '</div>';
  }

  function renderLesson(chId, opts) {
    const ch = DATA.chapters.find(function (c) { return c.id === chId; });
    if (!ch) { location.hash = '#/course'; return; }
    const idx = DATA.chapters.indexOf(ch);
    const prev = DATA.chapters[idx - 1], next = DATA.chapters[idx + 1];
    const ai = opts && opts.ai;
    const num = String(idx + 1).padStart(2, '0');
    view().innerHTML =
      '<div class="view">' +
      (ai ? '<div class="tip ai" style="margin-bottom:16px"><div><div class="t-t">AI 专区</div><div class="t-x">这一章把 AI 概念和 Python 串起来：大模型怎么工作、怎么用 Python 调用 AI、再亲手写一个会聊天的「规则版小 AI」。</div></div></div>' : '') +
      '<div class="lesson-head">' +
      '<div class="big-ic">' + num + '</div>' +
      '<div><h2>' + ch.title + '</h2>' +
      '<div class="meta"><span class="chip">' + ch.tag + '</span><span class="chip">' + ch.time + '</span>' +
      (isMastered(ch.id) ? '<span class="chip" style="color:var(--green)">已掌握</span>' : (isDue(ch.id) ? '<span class="chip" style="color:var(--yellow)">该复习了</span>' : '')) +
      '</div></div></div>' +
      renderBlocks(ch.blocks) +
      '<div class="quiz-box" id="quizBox"></div>' +
      '<div style="display:flex;gap:10px;margin-top:26px;justify-content:space-between;flex-wrap:wrap">' +
      (prev ? '<button class="btn" data-nav="ch/' + prev.id + '">← ' + prev.title + '</button>' : '<span></span>') +
      (next ? '<button class="btn primary" data-nav="ch/' + next.id + '">' + next.title + ' →</button>' : '<button class="btn primary" data-nav="cheats">查看速查卡 →</button>') +
      '</div></div>';
    mountDemos();
    startQuiz($('#quizBox'), {
      pool: DATA.quizzes.filter(function (q) { return q.ch === chId; }),
      mode: 'lesson', goto: next ? 'ch/' + next.id : 'course',
      onFinish: function (correct, total, pass) {
        if (pass && !isLearned(chId)) {
          const now = Date.now();
          S.chapters[chId] = { stage: 1, learnedAt: now, dueAt: now + SRS_DAYS[0] * 864e5 };
          save();
          toast('🎉 完成第 ' + (idx + 1) + ' 章！1 天后记得来复习', 'chapter');
          setTimeout(function () { location.hash = '#/review'; }, 1600);
        } else if (pass && isDue(chId)) {
          advanceStage(chId);
        }
      }
    });
  }

  function renderPractice() {
    view().innerHTML =
      '<div class="view">' +
      '<div class="lesson-head">' +
      '<div><h2>综合练习</h2><div class="meta"><span class="chip">' + DATA.quizzes.length + ' 题</span><span class="chip">全部章节混合</span><span class="chip">每题 +10 XP</span></div></div></div>' +
      '<p style="color:var(--text-dim);font-size:14.5px;line-height:1.9;margin:10px 0 4px">把所有章节的题目打乱来一轮，检验一下真正的掌握程度。答对 60% 以上算通过。</p>' +
      '<div class="quiz-box" id="quizBox" style="margin-top:14px"></div></div>';
    startQuiz($('#quizBox'), {
      pool: DATA.quizzes, mode: 'practice', goto: 'home'
    });
  }

  function renderReview() {
    const due = DATA.chapters.filter(function (c) { return isDue(c.id); });
    const upcoming = DATA.chapters.filter(function (c) {
      const st = chState(c.id);
      return st.stage >= 1 && st.stage <= 4 && !isDue(c.id);
    });
    const mastered = DATA.chapters.filter(function (c) { return isMastered(c.id); });
    const fresh = DATA.chapters.filter(function (c) { return !isLearned(c.id); });

    let dueHtml = '';
    if (due.length) {
      dueHtml = due.map(function (c) {
        return '<div class="task-item" data-review="' + c.id + '">' +
          '<span class="t-dot"></span>' +
          '<span class="t-t">' + c.title + '</span>' +
          '<span class="t-d">今天到期 · 点击开始复习</span></div>';
      }).join('');
    } else {
      dueHtml = '<div class="empty">今天没有到期的复习任务，做得很棒！<br>按记忆规律，学完当天后的第 1、3、7、21 天会提醒你复习。</div>';
    }
    const upcomingHtml = upcoming.length ? upcoming.map(function (c) {
      const st = chState(c.id);
      return '<div class="task-item" style="cursor:default">' +
        '<span class="t-dot" style="opacity:.45"></span>' +
        '<span class="t-t">' + c.title + '</span>' +
        '<span class="t-d">下一次复习：' + fmtDate(st.dueAt) + '</span></div>';
    }).join('') : '';
    const masteredHtml = mastered.length ? mastered.map(function (c) {
      return '<span class="chip" style="color:var(--green);margin:4px 6px 0 0;display:inline-block">' + c.title + '</span>';
    }).join('') : '<span style="color:var(--text-faint);font-size:13px">还没有——完成 4 轮复习就能永久掌握一个章节</span>';
    const freshHtml = fresh.length ? fresh.map(function (c) {
      return '<span class="chip" style="margin:4px 6px 0 0;display:inline-block">' + c.title + '</span>';
    }).join('') : '';

    view().innerHTML =
      '<div class="view">' +
      '<div class="lesson-head">' +
      '<div><h2>复习中心</h2><div class="meta"><span class="chip">遗忘曲线记忆法</span><span class="chip">第 1/3/7/21 天</span></div></div></div>' +
      '<div class="review-hero"><div><h3>为什么这样安排复习？</h3>' +
      '<p>人脑会遗忘，但「在快忘记时再学一遍」能让记忆越来越牢。学完一章后，系统会在第 1、3、7、21 天提醒你，4 轮之后基本永久掌握。</p></div></div>' +
      '<div class="section-title">今日待复习（' + due.length + '）</div>' + dueHtml +
      '<div class="section-title">即将复习</div>' + (upcomingHtml || '<div class="empty">暂无已安排的计划。</div>') +
      '<div class="section-title">已掌握</div><div style="margin-top:4px">' + masteredHtml + '</div>' +
      '<div class="section-title">还没学</div><div style="margin-top:4px">' + (freshHtml || '<span style="color:var(--text-faint);font-size:13px">全学完啦！</span>') + '</div>' +
      '</div>';
  }

  function renderCheats() {
    view().innerHTML =
      '<div class="view">' +
      '<div class="lesson-head">' +
      '<div><h2>速查卡</h2><div class="meta"><span class="chip">5 张</span><span class="chip">随时翻看</span></div></div></div>' +
      '<p style="color:var(--text-dim);font-size:14.5px;line-height:1.9;margin-top:10px">把每章最核心的语法浓缩成一张卡。忘了就翻，翻完可以在下面的练习场跑一遍示例。</p>' +
      '<div class="cheat-grid" style="margin-top:16px">' + DATA.cheats.map(function (c) {
        return '<div class="cheat-card"><h4>' + c.title + '</h4><table>' +
          c.items.map(function (it) { return '<tr><td>' + escapeHtml(it[0]) + '</td><td>' + escapeHtml(it[1]) + '</td></tr>'; }).join('') +
          '</table><button class="btn sm" style="margin-top:12px" data-run-code="' + _codeBankPush(c.code) + '">运行示例</button></div>';
      }).join('') + '</div>' +
      '<div class="section-title">练习场</div>' +
      '<p style="color:var(--text-dim);font-size:13.5px">也可以直接在里面写代码：</p>' +
      '<button class="btn primary" style="margin-top:10px" data-open-pg>打开练习场</button>' +
      '</div>';
  }

  function _codeBankPush(code) {
    _codeBank.push(code);
    return _codeBank.length - 1;
  }

  function advanceStage(chId) {
    const c = chState(chId);
    if (c.stage >= 5) return;
    c.stage++;
    if (c.stage <= 4) {
      c.dueAt = c.learnedAt + SRS_DAYS[c.stage - 1] * 864e5;
      save();
      toast('✅ 复习完成！下一次：' + SRS_DAYS[c.stage - 1] + ' 天后');
    } else {
      save();
      toast('🏆 恭喜，本章已永久掌握！', 'master');
    }
  }

  function renderReviewQuiz(chId) {
    const ch = DATA.chapters.find(function (c) { return c.id === chId; });
    const cheat = DATA.cheats.find(function (c) { return c.ch === chId; });
    view().innerHTML =
      '<div class="view">' +
      '<div class="lesson-head">' +
      '<div><h2>复习 · ' + ch.title + '</h2>' +
      '<div class="meta"><span class="chip">先看速查卡</span><span class="chip">3 道小题</span><span class="chip">通过后进入下一轮间隔</span></div></div></div>' +
      '<div class="cheat-card" style="margin-top:14px"><h4>' + cheat.title + '</h4><table>' +
      cheat.items.map(function (it) { return '<tr><td>' + escapeHtml(it[0]) + '</td><td>' + escapeHtml(it[1]) + '</td></tr>'; }).join('') +
      '</table></div>' +
      '<div class="quiz-box" id="quizBox" style="margin-top:18px"></div></div>';
    startQuiz($('#quizBox'), {
      pool: DATA.quizzes.filter(function (q) { return q.ch === chId; }),
      mode: 'review', n: 3, goto: 'review',
      onFinish: function (correct, total, pass) {
        if (pass) advanceStage(chId);
      }
    });
  }

  function renderAI() {
    renderLesson('ch5', { ai: true });
  }

  /* ---------------- 路由 ---------------- */
  const NAV = [
    { id: 'home', label: '首页' },
    { id: 'course', label: '课程' },
    { id: 'practice', label: '练习' },
    { id: 'review', label: '复习' },
    { id: 'cheats', label: '速查卡' },
    { id: 'ai', label: 'AI 专区' }
  ];

  function buildNav() {
    const nav = $('.nav');
    nav.innerHTML = NAV.map(function (n) {
      return '<div class="nav-item" data-nav="' + n.id + '"><span class="lbl">' + n.label + '</span>' +
        (n.id === 'review' ? '<span class="badge" id="dueBadge" style="display:none">0</span>' : '') + '</div>';
    }).join('');
  }

  function updateDueBadge() {
    const b = $('#dueBadge');
    if (!b) return;
    const n = DATA.chapters.filter(function (c) { return isDue(c.id); }).length;
    b.style.display = n > 0 ? 'inline-block' : 'none';
    b.textContent = n;
  }

  function updateTopbar(title) {
    $('#crumb').textContent = title;
    $('#xpPill').innerHTML = 'Lv.' + level() + ' ' + LEVELS[Math.min(level() - 1, LEVELS.length - 1)] +
      ' <span class="bar"><i style="width:' + (levelProgress() * 100) + '%"></i></span>' + S.xp + ' XP';
    $('#streakPill').innerHTML = S.streak + ' 天';
  }

  function setActiveNav(id) {
    $$('.nav-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.nav === id);
    });
  }

  function route() {
    const h = (location.hash || '#/home').slice(1); // '/home'
    const parts = h.split('/').filter(Boolean);     // ['home'] | ['ch','ch1']
    const page = parts[0] || 'home';
    updateDueBadge();
    if (page === 'home') { renderHome(); setActiveNav('home'); updateTopbar('首页'); }
    else if (page === 'course') { renderCourse(); setActiveNav('course'); updateTopbar('课程'); }
    else if (page === 'ch') {
      const chFound = DATA.chapters.find(function (c) { return c.id === parts[1]; });
      renderLesson(parts[1]);
      setActiveNav('course');
      updateTopbar(chFound ? '课程 · ' + chFound.title : '课程');
    }
    else if (page === 'practice') { renderPractice(); setActiveNav('practice'); updateTopbar('综合练习'); }
    else if (page === 'review') {
      if (parts[1] === 'quiz' && parts[2]) { renderReviewQuiz(parts[2]); setActiveNav('review'); updateTopbar('复习 · 小测'); }
      else { renderReview(); setActiveNav('review'); updateTopbar('复习中心'); }
    }
    else if (page === 'cheats') { renderCheats(); setActiveNav('cheats'); updateTopbar('速查卡'); }
    else if (page === 'ai') { renderAI(); setActiveNav('ai'); updateTopbar('AI 专区'); }
    else { renderHome(); setActiveNav('home'); updateTopbar('首页'); }
    view().scrollTop = 0;
  }

  /* ---------------- 事件委托 ---------------- */
  document.addEventListener('click', function (e) {
    const navEl = e.target.closest('[data-nav]');
    if (navEl) {
      location.hash = '#/' + navEl.dataset.nav;
      return;
    }
    const runBtn = e.target.closest('[data-run]');
    if (runBtn) {
      const code = _codeBank[+runBtn.dataset.run];
      if (code !== undefined) openPlayground(code);
      return;
    }
    const runCodeBtn = e.target.closest('[data-run-code]');
    if (runCodeBtn) {
      const code = _codeBank[+runCodeBtn.dataset.runCode];
      if (code !== undefined) openPlayground(code);
      return;
    }
    if (e.target.closest('[data-open-pg]')) { openPlayground(EXAMPLES[0].code); return; }
    const rv = e.target.closest('[data-review]');
    if (rv) { location.hash = '#/review/quiz/' + rv.dataset.review; return; }
  });

  /* ---------------- 礼花与提示 ---------------- */
  function confetti() {
    const c = $('#confetti');
    const ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const colors = ['#a78bfa', '#f9a8d4', '#fbbf24', '#34d399', '#67e8f9', '#ffffff'];
    const parts = [];
    for (let i = 0; i < 130; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 160,
        y: innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 13,
        vy: -Math.random() * 11 - 3,
        g: 0.35 + Math.random() * 0.2,
        s: 5 + Math.random() * 7,
        c: colors[Math.floor(Math.random() * colors.length)],
        r: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3
      });
    }
    let frames = 0;
    (function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach(function (p) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
        ctx.restore();
      });
      frames++;
      if (frames < 110) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, c.width, c.height);
    })();
  }

  function toast(msg, kind) {
    const box = $('#toast');
    const t = document.createElement('div');
    t.className = 'toast-item';
    t.innerHTML = (kind === 'chapter' ? '📘 ' : kind === 'master' ? '🏆 ' : '✨ ') + escapeHtml(msg);
    box.appendChild(t);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { t.remove(); }, 320);
    }, 2600);
  }

  /* ---------------- 粒子动画 ---------------- */
  function initParticles() {
    const canvas = $('#particles');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, raf = null;
    const mouse = { x: -9999, y: -9999 };
    let particles = [];
    const COUNT = Math.min(90, Math.max(36, Math.floor(window.innerWidth / 16)));

    function makeParticle(spread) {
      return {
        x: Math.random() * W,
        y: spread ? Math.random() * H : -12,
        r: 0.7 + Math.random() * 1.9,
        vx: (Math.random() - 0.5) * 0.22,
        vy: 0.10 + Math.random() * 0.32,
        hue: Math.random() < 0.55 ? 262 : (Math.random() < 0.5 ? 195 : 300),
        alpha: 0.25 + Math.random() * 0.45,
        tw: Math.random() * Math.PI * 2,
        ts: 0.008 + Math.random() * 0.018
      };
    }
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function step() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.tw += p.ts;
        // 鼠标附近的粒子被轻轻推开
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 16000 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / 126) * 0.55;
          p.x += dx / d * f;
          p.y += dy / d * f;
        }
        if (p.y > H + 14) { p.y = -14; p.x = Math.random() * W; }
        if (p.x < -14) p.x = W + 14; else if (p.x > W + 14) p.x = -14;
        const a = p.alpha * (0.6 + 0.4 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.fillStyle = 'hsla(' + p.hue + ', 92%, 78%, ' + a.toFixed(3) + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.r > 1.7) {
          ctx.beginPath();
          ctx.fillStyle = 'hsla(' + p.hue + ', 92%, 78%, ' + (a * 0.15).toFixed(3) + ')';
          ctx.arc(p.x, p.y, p.r * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(step);
    }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.addEventListener('mouseleave', function () { mouse.x = -9999; mouse.y = -9999; });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (!raf) raf = requestAnimationFrame(step);
    });
    resize();
    particles = [];
    for (let i = 0; i < COUNT; i++) particles.push(makeParticle(true));
    raf = requestAnimationFrame(step);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    // 粒子动画
    initParticles();
    // 连击计算
    const today = todayStr();
    if (S.lastDay !== today) {
      if (S.lastDay === yesterdayStr()) S.streak = (S.streak || 0) + 1;
      else S.streak = 1;
      S.lastDay = today;
      save();
      if (S.streak >= 2) setTimeout(function () { toast('连续学习 ' + S.streak + ' 天，保持住！', 'chapter'); }, 800);
    }
    buildNav();
    initPlayground();

    // 重置进度
    $('#resetBtn').addEventListener('click', function () {
      if (confirm('确定要清空所有学习进度吗？此操作无法撤销。')) {
        try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
        location.reload();
      }
    });

    // 分享给同学（仅在 http/https 下显示按钮）
    document.addEventListener('click', function (e) {
      const sh = e.target.closest('[data-share]');
      if (!sh) return;
      const url = location.href.split('#')[0];
      if (navigator.share) {
        navigator.share({ title: document.title, text: '从高一信息课到 AI 时代：40 分钟 Python 入门，一起学！', url: url })
          .catch(function () { /* 用户取消 */ });
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast('链接已复制，去微信粘贴给同学吧！', 'chapter'); }
        catch (err) { prompt('复制这个链接发给同学：', url); }
        ta.remove();
      }
    });

    window.addEventListener('hashchange', route);
    route();
    // 预热完整引擎（后台静默加载）
    ensurePyodide().then(function () {
      currentEngine = 'pyodide';
      const eng = $('#pgEngine');
      if (eng) { eng.textContent = '引擎：完整 Python 3.12'; eng.classList.remove('mini'); }
    }).catch(function () { /* 保持迷你引擎 */ });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
