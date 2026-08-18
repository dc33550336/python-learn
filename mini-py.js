/* ============================================================
 * mini-py.js —— 浏览器内置的微型 Python 解释器（教学子集）
 *
 * 支持：print、变量、算术/比较/逻辑运算、f-string、if/elif/else、
 *       for/while/break/continue、列表、字典、函数 def/return、
 *       内置函数 print/len/range/int/float/str/bool/abs/sum/min/max/type/list
 *       常用方法 append/remove/pop/count/index/sort/get/keys/values/items、
 *       upper/lower/split/replace/strip/startswith/endswith/join
 *
 * 不支持（页面上会有提示）：input()、import、类、lambda、列表推导式、
 *       多行括号表达式等。
 *
 * 用法：
 *   const result = MiniPy.run(code, { onPrint: (s) => {...} });
 *   result = { ok: boolean, output: string, error: string|null, line: number|null }
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------------- 错误类型 ---------------- */
  function PyError(message, line) {
    const e = new Error(message);
    e.name = 'PyError';
    e.line = line || null;
    return e;
  }

  /* ---------------- 工具 ---------------- */
  function typeName(v) {
    if (v === null) return 'None';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
    if (typeof v === 'string') return 'str';
    if (typeof v === 'boolean') return 'bool';
    if (Array.isArray(v)) return 'list';
    if (v instanceof Map) return 'dict';
    return 'function';
  }

  function truthy(v) {
    if (v === null || v === false) return false;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof Map) return v.size > 0;
    return true;
  }

  function toStr(v) {
    if (v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return '[' + v.map(toRepr).join(', ') + ']';
    if (v instanceof Map) {
      const parts = [];
      v.forEach((val, key) => { parts.push(toRepr(key) + ': ' + toRepr(val)); });
      return '{' + parts.join(', ') + '}';
    }
    return '<function>';
  }

  function toRepr(v) {
    if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    return toStr(v);
  }

  function deepEq(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
      return true;
    }
    if (a instanceof Map) {
      if (!(b instanceof Map) || a.size !== b.size) return false;
      let ok = true;
      a.forEach((v, k) => { if (!deepEq(v, b.get(k))) ok = false; });
      return ok;
    }
    return false;
  }

  /* ---------------- 行拆分与注释处理 ---------------- */
  function stripComment(line) {
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === inStr) inStr = null;
      } else if (c === '"' || c === "'") {
        inStr = c;
      } else if (c === '#') {
        return line.slice(0, i);
      }
    }
    return line;
  }

  function splitLines(code) {
    const raw = code.split(/\r?\n/);
    const lines = [];
    for (let i = 0; i < raw.length; i++) {
      const lineNo = i + 1;
      const text = raw[i];
      if (/^\s*$/.test(text)) continue;
      let indent = 0;
      while (indent < text.length && text[indent] === ' ') indent++;
      if (text[indent] === '\t') throw new PyError('请用空格缩进，不要使用 Tab 键', lineNo);
      const content = stripComment(text).trimEnd().trim();
      if (!content) continue;
      lines.push({ indent, text: content, lineNo });
    }
    return lines;
  }

  /* ---------------- 表达式解析 ---------------- */
  function unescapeStr(s) {
    return s.replace(/\\(.)/g, (m, ch) => {
      if (ch === 'n') return '\n';
      if (ch === 't') return '\t';
      return ch; // \\ \" \' \{ 等原样返回
    });
  }

  function parseFString(raw) {
    const parts = [];
    let buf = '';
    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      if (ch === '\\') { buf += raw[i] + (raw[i + 1] || ''); i += 2; continue; }
      if (ch === '{') {
        if (raw[i + 1] === '{') { buf += '{'; i += 2; continue; }
        let j = i + 1, depth = 0, inStr = null;
        while (j < raw.length) {
          const c2 = raw[j];
          if (inStr) { if (c2 === '\\') j++; else if (c2 === inStr) inStr = null; }
          else if (c2 === '"' || c2 === "'") inStr = c2;
          else if (c2 === '(' || c2 === '[' || c2 === '{') depth++;
          else if (c2 === ')' || c2 === ']' || c2 === '}') { if (depth === 0) break; depth--; }
          j++;
        }
        if (j >= raw.length) throw new PyError("f-string 里缺少结束的 '}'", null);
        if (buf) { parts.push({ type: 'text', value: unescapeStr(buf) }); buf = ''; }
        parts.push({ type: 'expr', src: raw.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
      if (ch === '}') {
        if (raw[i + 1] === '}') { buf += '}'; i += 2; continue; }
        throw new PyError("f-string 里出现多余的 '}'（要输出 { 请写 {{）", null);
      }
      buf += ch;
      i++;
    }
    if (buf) parts.push({ type: 'text', value: unescapeStr(buf) });
    return parts;
  }

  function tokenizeExpr(src) {
    const tokens = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (/[0-9]/.test(c)) {
        let j = i;
        while (j < n && /[0-9]/.test(src[j])) j++;
        if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) {
          j++;
          while (j < n && /[0-9]/.test(src[j])) j++;
        }
        tokens.push({ type: 'num', value: parseFloat(src.slice(i, j)) });
        i = j; continue;
      }
      if (c === 'f' && (src[i + 1] === '"' || src[i + 1] === "'")) {
        const quote = src[i + 1];
        let j = i + 2;
        let raw = '';
        while (j < n) {
          const c2 = src[j];
          if (c2 === '\\') { raw += c2 + (src[j + 1] || ''); j += 2; continue; }
          if (c2 === quote) break;
          raw += c2; j++;
        }
        if (j >= n) throw new PyError('字符串缺少结束引号', null);
        tokens.push({ type: 'fstr', parts: parseFString(raw) });
        i = j + 1; continue;
      }
      if (c === '"' || c === "'") {
        const quote = c;
        let j = i + 1;
        let raw = '';
        while (j < n) {
          const c2 = src[j];
          if (c2 === '\\') { raw += c2 + (src[j + 1] || ''); j += 2; continue; }
          if (c2 === quote) break;
          raw += c2; j++;
        }
        if (j >= n) throw new PyError('字符串缺少结束引号', null);
        tokens.push({ type: 'str', value: unescapeStr(raw) });
        i = j + 1; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
        const word = src.slice(i, j);
        if (word === 'in' || word === 'and' || word === 'or' || word === 'not') tokens.push({ type: 'op', value: word });
        else tokens.push({ type: 'name', value: word });
        i = j; continue;
      }
      // 两字符操作符
      const two = src.substr(i, 2);
      if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '//', '**', '%=', '//='].indexOf(two) >= 0) {
        tokens.push({ type: 'op', value: two });
        i += 2; continue;
      }
      if ('+-*/%()[]{}.,:<>'.indexOf(c) >= 0) {
        tokens.push({ type: 'op', value: c });
        i++; continue;
      }
      throw new PyError("看不懂这个符号: '" + c + "'", null);
    }
    return tokens;
  }

  const PREC = {
    'or': 1, 'and': 2,
    '==': 4, '!=': 4, '<': 4, '<=': 4, '>': 4, '>=': 4, 'in': 4,
    '+': 5, '-': 5,
    '*': 6, '/': 6, '//': 6, '%': 6,
    '**': 8
  };
  const COMPARE_OPS = ['==', '!=', '<', '<=', '>', '>=', 'in'];

  function Parser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  Parser.prototype.peek = function () { return this.tokens[this.pos] || null; };
  Parser.prototype.next = function () { return this.tokens[this.pos++] || null; };
  Parser.prototype.expectOp = function (op) {
    const t = this.next();
    if (!t || t.type !== 'op' || t.value !== op) throw new PyError("这里应该是一个 '" + op + "'", null);
    return t;
  };

  Parser.prototype.parseExpr = function () {
    return this.parseBinary(0);
  };

  Parser.prototype.parseBinary = function (minPrec) {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (!t || t.type !== 'op') break;
      const prec = PREC[t.value];
      if (prec === undefined || prec < minPrec) break;
      // 比较运算可以链式：a < b < c
      if (COMPARE_OPS.indexOf(t.value) >= 0) {
        this.next();
        const ops = [{ op: t.value, rhs: this.parseBinary(prec + 1) }];
        while (this.peek() && this.peek().type === 'op' && COMPARE_OPS.indexOf(this.peek().value) >= 0) {
          const t2 = this.next();
          ops.push({ op: t2.value, rhs: this.parseBinary(PREC[t2.value] + 1) });
        }
        left = { type: 'chain', first: left, ops: ops };
        continue;
      }
      this.next();
      const rightMin = (t.value === '**') ? prec : prec + 1;
      left = { type: 'bin', op: t.value, left: left, right: this.parseBinary(rightMin) };
    }
    return left;
  };

  Parser.prototype.parseUnary = function () {
    const t = this.peek();
    if (t && t.type === 'op') {
      if (t.value === '-') { this.next(); return { type: 'neg', operand: this.parseUnary() }; }
      if (t.value === '+') { this.next(); return this.parseUnary(); }
      if (t.value === 'not') { this.next(); return { type: 'not', operand: this.parseUnary() }; }
      if (t.value === '**') { this.next(); return { type: 'bin', op: '**', left: { type: 'num', value: 0 }, right: this.parseUnary() }; }
    }
    if (t && t.type === 'name' && (t.value === 'not')) {
      this.next();
      return { type: 'not', operand: this.parseUnary() };
    }
    return this.parsePostfix();
  };

  Parser.prototype.parsePostfix = function () {
    let node = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (!t || t.type !== 'op') break;
      if (t.value === '(') {
        this.next();
        const args = [];
        if (this.peek() && !(this.peek().type === 'op' && this.peek().value === ')')) {
          args.push(this.parseExpr());
          while (this.peek() && this.peek().type === 'op' && this.peek().value === ',') {
            this.next();
            args.push(this.parseExpr());
          }
        }
        this.expectOp(')');
        if (node.type === 'name') node = { type: 'call', name: node.name, args: args };
        else if (node.type === 'attr') node = { type: 'method', obj: node.obj, name: node.name, args: args };
        else throw new PyError('这里不能调用', null);
      } else if (t.value === '[') {
        this.next();
        let start = null, end = null, isSlice = false;
        if (this.peek() && this.peek().type === 'op' && this.peek().value === ':') {
          isSlice = true;
          this.next();
          if (this.peek() && !(this.peek().type === 'op' && this.peek().value === ']')) end = this.parseExpr();
        } else {
          start = this.parseExpr();
          if (this.peek() && this.peek().type === 'op' && this.peek().value === ':') {
            isSlice = true;
            this.next();
            if (this.peek() && !(this.peek().type === 'op' && this.peek().value === ']')) end = this.parseExpr();
          }
        }
        this.expectOp(']');
        node = { type: 'index', obj: node, index: start, end: end, isSlice: isSlice };
      } else if (t.value === '.') {
        this.next();
        const nameTok = this.next();
        if (!nameTok || nameTok.type !== 'name') throw new PyError("'.' 后面应该跟方法名", null);
        node = { type: 'attr', obj: node, name: nameTok.value };
      } else break;
    }
    return node;
  };

  Parser.prototype.parsePrimary = function () {
    const t = this.next();
    if (!t) throw new PyError('表达式不完整', null);
    if (t.type === 'num' || t.type === 'str') return t;
    if (t.type === 'fstr') return { type: 'fstr', parts: t.parts };
    if (t.type === 'name') {
      if (t.value === 'True') return { type: 'bool', value: true };
      if (t.value === 'False') return { type: 'bool', value: false };
      if (t.value === 'None') return { type: 'none' };
      return { type: 'name', name: t.value };
    }
    if (t.type === 'op') {
      if (t.value === '(') {
        const e = this.parseExpr();
        this.expectOp(')');
        return e;
      }
      if (t.value === '[') {
        const items = [];
        if (this.peek() && !(this.peek().type === 'op' && this.peek().value === ']')) {
          items.push(this.parseExpr());
          while (this.peek() && this.peek().type === 'op' && this.peek().value === ',') {
            this.next();
            items.push(this.parseExpr());
          }
        }
        this.expectOp(']');
        return { type: 'list', items: items };
      }
      if (t.value === '{') {
        const pairs = [];
        if (this.peek() && !(this.peek().type === 'op' && this.peek().value === '}')) {
          for (;;) {
            const k = this.parseExpr();
            this.expectOp(':');
            const v = this.parseExpr();
            pairs.push([k, v]);
            if (this.peek() && this.peek().type === 'op' && this.peek().value === ',') this.next();
            else break;
          }
        }
        this.expectOp('}');
        return { type: 'dict', pairs: pairs };
      }
    }
    throw new PyError("这里应该是一个值或表达式（出现了 '" + (t.value || t.type) + "'）", null);
  };

  function parseExprText(src, lineNo) {
    try {
      const tokens = tokenizeExpr(src);
      if (tokens.length === 0) throw new PyError('表达式是空的', lineNo);
      const p = new Parser(tokens);
      const node = p.parseExpr();
      if (p.peek() !== null) {
        const rest = p.peek().value || p.peek().type;
        throw new PyError("表达式后面多出了 '" + rest + "'", lineNo);
      }
      return node;
    } catch (e) {
      if (e instanceof PyError) { e.line = e.line || lineNo; throw e; }
      throw e;
    }
  }

  /* ---------------- 语句树解析 ---------------- */
  // 在顶层（不在括号/字符串内）查找赋值符号 '='，支持 +=、-= 等复合赋值
  function findTopLevelAssign(text) {
    let depth = 0, inStr = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '(' || c === '[' || c === '{') { depth++; continue; }
      if (c === ')' || c === ']' || c === '}') { depth--; continue; }
      if (c === '=' && depth === 0) {
        if (text[i + 1] === '=') continue; // ==
        const prev = text[i - 1] || '';
        if ('=!<>'.indexOf(prev) >= 0) continue; // == != <= >=
        let j = i - 1, op = '=';
        while (j >= 0 && '+-*/%'.indexOf(text[j]) >= 0) { op = text[j] + op; j--; }
        return { lhs: text.slice(0, i - (op.length - 1)), op: op, rhs: text.slice(i + 1) };
      }
    }
    return null;
  }

  function parseProgram(code) {
    const lines = splitLines(code);
    if (lines.length === 0) return { type: 'body', nodes: [] };

    function parseBody(i, parentIndent) {
      const nodes = [];
      while (i < lines.length) {
        const ln = lines[i];
        if (ln.indent <= parentIndent) break;
        const res = parseStmt(i);
        nodes.push(res.node);
        i = res.next;
      }
      return { nodes: nodes, next: i };
    }

    function parseStmt(i) {
      const ln = lines[i];
      const indent = ln.indent;
      let m;

      if ((m = ln.text.match(/^(if|elif)\s+(.+):$/))) {
        const cond = parseExprText(m[2], ln.lineNo);
        const body = parseBody(i + 1, indent);
        if (body.nodes.length === 0) throw new PyError("'" + m[1] + "' 后面缺少缩进的代码", ln.lineNo);
        const branches = [{ cond: cond, body: body.nodes }];
        let next = body.next;
        let elseBody = null;
        while (next < lines.length && lines[next].indent === indent) {
          const t = lines[next].text;
          const m2 = t.match(/^elif\s+(.+):$/);
          if (m2) {
            const c = parseExprText(m2[1], lines[next].lineNo);
            const b = parseBody(next + 1, indent);
            if (b.nodes.length === 0) throw new PyError('elif 后面缺少缩进的代码', lines[next].lineNo);
            branches.push({ cond: c, body: b.nodes });
            next = b.next;
          } else if (/^else\s*:$/.test(t)) {
            const b = parseBody(next + 1, indent);
            if (b.nodes.length === 0) throw new PyError('else 后面缺少缩进的代码', lines[next].lineNo);
            elseBody = b.nodes;
            next = b.next;
            break;
          } else break;
        }
        return { node: { type: 'if', branches: branches, elseBody: elseBody }, next: next };
      }
      if (/^else\s*:$/.test(ln.text)) throw new PyError('else 前面没有对应的 if', ln.lineNo);

      if ((m = ln.text.match(/^for\s+(.+?)\s+in\s+(.+):$/))) {
        const varPart = m[1].trim();
        const vars = varPart.split(',').map(s => s.trim());
        for (const v of vars) if (!/^[A-Za-z_]\w*$/.test(v)) throw new PyError("for 的循环变量写法不对: '" + varPart + "'", ln.lineNo);
        const iterable = parseExprText(m[2], ln.lineNo);
        const body = parseBody(i + 1, indent);
        if (body.nodes.length === 0) throw new PyError('for 后面缺少缩进的代码', ln.lineNo);
        return { node: { type: 'for', vars: vars, iterable: iterable, body: body.nodes }, next: body.next };
      }
      if ((m = ln.text.match(/^while\s+(.+):$/))) {
        const cond = parseExprText(m[1], ln.lineNo);
        const body = parseBody(i + 1, indent);
        if (body.nodes.length === 0) throw new PyError('while 后面缺少缩进的代码', ln.lineNo);
        return { node: { type: 'while', cond: cond, body: body.nodes }, next: body.next };
      }
      if ((m = ln.text.match(/^def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:$/))) {
        const params = m[2].split(',').map(s => s.trim()).filter(s => s !== '');
        for (const p of params) if (!/^[A-Za-z_]\w*$/.test(p)) throw new PyError("函数参数写法不对: '" + p + "'", ln.lineNo);
        const body = parseBody(i + 1, indent);
        if (body.nodes.length === 0) throw new PyError("函数 '" + m[1] + "' 缺少函数体", ln.lineNo);
        return { node: { type: 'def', name: m[1], params: params, body: body.nodes }, next: body.next };
      }
      if (/^break$/.test(ln.text)) return { node: { type: 'break' }, next: i + 1 };
      if (/^continue$/.test(ln.text)) return { node: { type: 'continue' }, next: i + 1 };
      if (/^return$/.test(ln.text)) return { node: { type: 'return', value: null }, next: i + 1 };
      if ((m = ln.text.match(/^return\s+(.+)$/))) {
        return { node: { type: 'return', value: parseExprText(m[1], ln.lineNo) }, next: i + 1 };
      }

      // 赋值语句（含 += 等，以及 列表[i] = 值 / 字典[键] = 值）
      const eq = findTopLevelAssign(ln.text);
      if (eq) {
        const lhs = eq.lhs.trim();
        const im = lhs.match(/^([A-Za-z_]\w*)\s*\[(.+)\]$/);
        if (im) {
          if (eq.op !== '=') throw new PyError("列表/字典的元素不能用 '" + eq.op + "'，请用 = 直接赋值", ln.lineNo);
          const idxNode = parseExprText(im[2], ln.lineNo);
          const rhs = parseExprText(eq.rhs, ln.lineNo);
          return { node: { type: 'assignIdx', name: im[1], index: idxNode, value: rhs }, next: i + 1 };
        }
        const nm = lhs.match(/^([A-Za-z_]\w*)$/);
        if (nm) {
          const rhs = parseExprText(eq.rhs, ln.lineNo);
          return { node: { type: 'assign', name: nm[1], op: eq.op, value: rhs }, next: i + 1 };
        }
        throw new PyError("赋值语句左边不支持: '" + lhs + "'", ln.lineNo);
      }
      // 表达式语句（例如直接调用函数）
      const expr = parseExprText(ln.text, ln.lineNo);
      return { node: { type: 'expr', expr: expr }, next: i + 1 };
    }

    const body = parseBody(0, -1);
    if (body.next < lines.length) throw new PyError('第 ' + lines[body.next].lineNo + ' 行的缩进有问题', lines[body.next].lineNo);
    return { type: 'body', nodes: body.nodes };
  }

  /* ---------------- 求值 ---------------- */
  function Scope(parent) {
    this.vars = Object.create(null);
    this.parent = parent || null;
  }
  Scope.prototype.hasOwn = function (name) { return Object.prototype.hasOwnProperty.call(this.vars, name); };
  Scope.prototype.lookup = function (name) {
    let s = this;
    while (s) { if (s.hasOwn(name)) return s.vars[name]; s = s.parent; }
    return undefined;
  };
  Scope.prototype.assign = function (name, val) {
    let s = this;
    while (s) { if (s.hasOwn(name)) { s.vars[name] = val; return; } s = s.parent; }
    this.vars[name] = val;
  };

  const BUILTINS = {
    print: { min: 0, max: 99 },
    len: { min: 1, max: 1 },
    range: { min: 1, max: 3 },
    int: { min: 1, max: 1 },
    float: { min: 1, max: 1 },
    str: { min: 1, max: 1 },
    bool: { min: 1, max: 1 },
    abs: { min: 1, max: 1 },
    sum: { min: 1, max: 1 },
    min: { min: 1, max: 99 },
    max: { min: 1, max: 99 },
    type: { min: 1, max: 1 },
    list: { min: 1, max: 1 }
  };

  function callBuiltin(name, args, ctx, line) {
    const spec = BUILTINS[name];
    if (!spec) throw new PyError("没有这个内置函数: '" + name + "'", line);
    if (args.length < spec.min || args.length > spec.max) {
      throw new PyError(name + "() 参数数量不对（需要 " + spec.min + '-' + spec.max + ' 个）', line);
    }
    const arg = (i) => args[i];
    const num = (i) => {
      const v = args[i];
      if (typeof v !== 'number') throw new PyError(typeName(v) + " 类型不能用于这个运算（需要数字）", line);
      return v;
    };
    switch (name) {
      case 'print': {
        const text = args.map(toStr).join(' ');
        ctx.hooks.print(text);
        return null;
      }
      case 'len': {
        const v = args[0];
        if (typeof v === 'string') return v.length;
        if (Array.isArray(v)) return v.length;
        if (v instanceof Map) return v.size;
        throw new PyError("len() 不能用于 " + typeName(v), line);
      }
      case 'range': {
        let start = 0, stop, step = 1;
        if (args.length === 1) stop = num(0);
        else { start = num(0); stop = num(1); if (args.length === 3) step = num(2); }
        if (step === 0) throw new PyError('range() 的步长不能为 0', line);
        const out = [];
        if (step > 0) { for (let i = start; i < stop; i += step) out.push(Math.floor(i)); }
        else { for (let i = start; i > stop; i += step) out.push(Math.floor(i)); }
        return out;
      }
      case 'int': {
        const v = args[0];
        if (typeof v === 'number') return Math.trunc(v);
        if (typeof v === 'string') {
          const t = v.trim();
          if (/^[+-]?\d+$/.test(t)) return parseInt(t, 10);
          if (/^[+-]?\d+\.\d+$/.test(t)) return Math.trunc(parseFloat(t));
          throw new PyError("无法把 '" + v + "' 转换成整数", line);
        }
        throw new PyError("int() 不能用于 " + typeName(v), line);
      }
      case 'float': {
        const v = args[0];
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          const t = v.trim();
          if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return parseFloat(t);
          throw new PyError("无法把 '" + v + "' 转换成小数", line);
        }
        throw new PyError("float() 不能用于 " + typeName(v), line);
      }
      case 'str': return toStr(args[0]);
      case 'bool': return truthy(args[0]);
      case 'abs': { const v = num(0); return Math.abs(v); }
      case 'sum': {
        const v = args[0];
        if (!Array.isArray(v)) throw new PyError('sum() 需要一个列表', line);
        let s = 0;
        for (const x of v) { if (typeof x !== 'number') throw new PyError('sum() 的列表里有非数字', line); s += x; }
        return s;
      }
      case 'min': case 'max': {
        let items = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        if (items.length === 0) throw new PyError(name + '() 至少要有一个参数', line);
        let best = items[0];
        for (let i = 1; i < items.length; i++) {
          const cmp = compareValues(items[i], best, line);
          if (name === 'min' ? cmp < 0 : cmp > 0) best = items[i];
        }
        return best;
      }
      case 'type': return "<class '" + typeName(args[0]) + "'>";
      case 'list': {
        const v = args[0];
        if (typeof v === 'string') return v.split('');
        if (Array.isArray(v)) return v.slice();
        if (v instanceof Map) return Array.from(v.keys());
        throw new PyError('list() 不能用于 ' + typeName(v), line);
      }
    }
    return null;
  }

  function compareValues(a, b, line) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : (a > b ? 1 : 0);
    throw new PyError("不能比较 " + typeName(a) + " 和 " + typeName(b), line);
  }

  function callMethod(obj, name, args, ctx, line) {
    if (Array.isArray(obj)) {
      switch (name) {
        case 'append': obj.push(args[0]); return null;
        case 'remove': {
          const idx = obj.findIndex(x => deepEq(x, args[0]));
          if (idx < 0) throw new PyError('列表中找不到要删除的元素: ' + toRepr(args[0]), line);
          obj.splice(idx, 1); return null;
        }
        case 'pop': {
          if (args.length === 0) return obj.pop();
          const idx = args[0];
          if (typeof idx !== 'number' || idx < 0 || idx >= obj.length) throw new PyError('pop() 的下标越界', line);
          return obj.splice(idx, 1)[0];
        }
        case 'count': { let c = 0; for (const x of obj) if (deepEq(x, args[0])) c++; return c; }
        case 'index': {
          const idx = obj.findIndex(x => deepEq(x, args[0]));
          if (idx < 0) throw new PyError('列表中找不到: ' + toRepr(args[0]), line);
          return idx;
        }
        case 'sort': obj.sort((x, y) => compareValues(x, y, line)); return null;
        default: throw new PyError("列表没有 '" + name + "' 这个方法", line);
      }
    }
    if (typeof obj === 'string') {
      switch (name) {
        case 'upper': return obj.toUpperCase();
        case 'lower': return obj.toLowerCase();
        case 'strip': return obj.trim();
        case 'split': return obj.split(args.length ? String(args[0]) : ' ');
        case 'replace': {
          if (args.length < 2) throw new PyError('replace() 需要两个参数', line);
          return obj.split(String(args[0])).join(String(args[1]));
        }
        case 'startswith': return obj.startsWith(String(args[0]));
        case 'endswith': return obj.endsWith(String(args[0]));
        case 'join': {
          if (!Array.isArray(args[0])) throw new PyError('join() 的参数需要是列表', line);
          return args[0].map(toStr).join(obj);
        }
        default: throw new PyError("字符串没有 '" + name + "' 这个方法", line);
      }
    }
    if (obj instanceof Map) {
      switch (name) {
        case 'get': {
          if (obj.has(args[0])) return obj.get(args[0]);
          return args.length > 1 ? args[1] : null;
        }
        case 'keys': return Array.from(obj.keys());
        case 'values': return Array.from(obj.values());
        case 'items': return Array.from(obj.entries());
        case 'pop': {
          const k = args[0];
          if (!obj.has(k)) throw new PyError("字典里没有键: " + toRepr(k), line);
          const v = obj.get(k); obj.delete(k); return v;
        }
        default: throw new PyError("字典没有 '" + name + "' 这个方法", line);
      }
    }
    throw new PyError(typeName(obj) + " 类型没有 '" + name + "' 方法", line);
  }

  function arith(op, a, b, line) {
    if (op === '+') {
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (typeof a === 'number' && typeof b === 'number') return a + b;
      throw new PyError(typeName(a) + " 不能和 " + typeName(b) + " 直接相加（数字+数字，或 字符串+字符串 才行；数字转字符串用 str()）", line);
    }
    if (op === '*') {
      if (typeof a === 'number' && typeof b === 'number') return a * b;
      if (typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, Math.trunc(b)));
      if (typeof a === 'number' && typeof b === 'string') return b.repeat(Math.max(0, Math.trunc(a)));
      throw new PyError("'*' 不能用于 " + typeName(a) + " 和 " + typeName(b), line);
    }
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new PyError("'" + op + "' 需要两个数字，但给的是 " + typeName(a) + " 和 " + typeName(b), line);
    }
    switch (op) {
      case '-': return a - b;
      case '/': {
        if (b === 0) throw new PyError('除数不能为 0', line);
        return a / b;
      }
      case '//': {
        if (b === 0) throw new PyError('除数不能为 0', line);
        return Math.floor(a / b);
      }
      case '%': {
        if (b === 0) throw new PyError('除数不能为 0', line);
        return ((a % b) + b) % b;
      }
      case '**': return Math.pow(a, b);
    }
    throw new PyError("不支持的运算: '" + op + "'", line);
  }

  function evalNode(node, ctx) {
    switch (node.type) {
      case 'num': return node.value;
      case 'str': return node.value;
      case 'bool': return node.value;
      case 'none': return null;
      case 'fstr': {
        let out = '';
        for (const p of node.parts) {
          if (p.type === 'text') out += p.value;
          else out += toStr(evalNode(p.exprNode, ctx));
        }
        return out;
      }
      case 'name': {
        if (node.name === 'True') return true;
        if (node.name === 'False') return false;
        if (node.name === 'None') return null;
        const v = ctx.scope.lookup(node.name);
        if (v === undefined) throw new PyError("变量 '" + node.name + "' 还没有定义", ctx.line);
        return v;
      }
      case 'neg': return -evalNode(node.operand, ctx);
      case 'not': return !truthy(evalNode(node.operand, ctx));
      case 'bin': {
        if (node.op === 'and') {
          const a = evalNode(node.left, ctx);
          return truthy(a) ? evalNode(node.right, ctx) : a;
        }
        if (node.op === 'or') {
          const a = evalNode(node.left, ctx);
          return truthy(a) ? a : evalNode(node.right, ctx);
        }
        const a = evalNode(node.left, ctx);
        const b = evalNode(node.right, ctx);
        return arith(node.op, a, b, ctx.line);
      }
      case 'chain': {
        let prev = evalNode(node.first, ctx);
        for (const o of node.ops) {
          const rhs = evalNode(o.rhs, ctx);
          if (!applyCompare(o.op, prev, rhs, ctx.line)) return false;
          prev = rhs;
        }
        return true;
      }
      case 'list': return node.items.map(x => evalNode(x, ctx));
      case 'dict': {
        const m = new Map();
        for (const [k, v] of node.pairs) {
          const key = evalNode(k, ctx);
          if (key === null) throw new PyError('字典的键不能是 None', ctx.line);
          m.set(key, evalNode(v, ctx));
        }
        return m;
      }
      case 'index': {
        const obj = evalNode(node.obj, ctx);
        if (node.isSlice) return doSlice(obj, node.index ? evalNode(node.index, ctx) : 0, node.end ? evalNode(node.end, ctx) : null, ctx.line);
        const idx = evalNode(node.index, ctx);
        return doIndex(obj, idx, ctx.line);
      }
      case 'attr': {
        // 属性访问（非调用）暂不支持，只在方法调用场景使用
        throw new PyError("不支持直接访问属性，请使用方法调用，例如 obj.方法()", ctx.line);
      }
      case 'method': {
        const obj = evalNode(node.obj, ctx);
        const args = node.args.map(a => evalNode(a, ctx));
        return callMethod(obj, node.name, args, ctx, ctx.line);
      }
      case 'call': {
        const args = node.args.map(a => evalNode(a, ctx));
        return callFunction(node.name, args, ctx);
      }
    }
    throw new PyError('内部错误：未知表达式类型', ctx.line);
  }

  function applyCompare(op, a, b, line) {
    switch (op) {
      case '==': return deepEq(a, b);
      case '!=': return !deepEq(a, b);
      case 'in': {
        if (typeof b === 'string') { if (typeof a !== 'string') throw new PyError("'in' 判断需要字符串", line); return b.indexOf(a) >= 0; }
        if (Array.isArray(b)) return b.some(x => deepEq(x, a));
        if (b instanceof Map) return b.has(a);
        throw new PyError("'in' 的右边必须是字符串、列表或字典", line);
      }
      default: {
        const c = compareValues(a, b, line);
        if (op === '<') return c < 0;
        if (op === '<=') return c <= 0;
        if (op === '>') return c > 0;
        if (op === '>=') return c >= 0;
      }
    }
    return false;
  }

  function doIndex(obj, idx, line) {
    if (obj instanceof Map) {
      if (obj.has(idx)) return obj.get(idx);
      throw new PyError("字典里没有键: " + toRepr(idx) + "（可以用 .get() 避免报错）", line);
    }
    if (typeof idx !== 'number' || !Number.isInteger(idx)) throw new PyError('下标必须是整数', line);
    if (Array.isArray(obj)) {
      let i = idx; if (i < 0) i = obj.length + i;
      if (i < 0 || i >= obj.length) throw new PyError('列表下标越界: ' + idx + '（列表长度 ' + obj.length + '）', line);
      return obj[i];
    }
    if (typeof obj === 'string') {
      let i = idx; if (i < 0) i = obj.length + i;
      if (i < 0 || i >= obj.length) throw new PyError('字符串下标越界: ' + idx, line);
      return obj[i];
    }
    throw new PyError(typeName(obj) + " 类型不能按下标取值", line);
  }

  function doSlice(obj, start, end, line) {
    const len = typeof obj === 'string' ? obj.length : (Array.isArray(obj) ? obj.length : null);
    if (len === null) throw new PyError('切片只能用于字符串或列表', line);
    let s = start, e = end === null ? len : end;
    if (s < 0) s = Math.max(0, len + s);
    if (e < 0) e = Math.max(0, len + e);
    s = Math.min(s, len); e = Math.min(e, len);
    if (typeof obj === 'string') return obj.slice(s, e);
    return obj.slice(s, e);
  }

  function callFunction(name, args, ctx) {
    if (ctx.funcs.has(name)) {
      const fn = ctx.funcs.get(name);
      if (args.length !== fn.params.length) {
        throw new PyError("函数 " + name + "() 需要 " + fn.params.length + " 个参数，给了 " + args.length + ' 个', ctx.line);
      }
      const fnScope = new Scope(fn.closure);
      fn.params.forEach((p, i) => fnScope.assign(p, args[i]));
      const savedScope = ctx.scope;
      const savedFlow = ctx.flow;
      ctx.scope = fnScope;
      ctx.flow = null;
      try {
        runBody(fn.body, ctx);
      } finally {
        ctx.scope = savedScope;
      }
      const ret = (ctx.flow && ctx.flow.type === 'return') ? ctx.flow.value : null;
      ctx.flow = savedFlow;
      return ret;
    }
    return callBuiltin(name, args, ctx, ctx.line);
  }

  function runBody(nodes, ctx) {
    for (const node of nodes) {
      ctx.steps++;
      if (ctx.steps > ctx.maxSteps) throw new PyError('循环执行次数过多，可能是死循环（检查 while 或 for 的条件会不会一直成立）', ctx.line);
      runNode(node, ctx);
      if (ctx.flow) return;
    }
  }

  function runNode(node, ctx) {
    switch (node.type) {
      case 'body': runBody(node.nodes, ctx); return;
      case 'if': {
        for (const br of node.branches) {
          const hit = truthy(evalNode(br.cond, ctx));
          if (hit) { runBody(br.body, ctx); return; }
        }
        if (node.elseBody) runBody(node.elseBody, ctx);
        return;
      }
      case 'for': {
        const iter = evalNode(node.iterable, ctx);
        let items;
        if (Array.isArray(iter)) items = iter;
        else if (typeof iter === 'string') items = iter.split('');
        else if (iter instanceof Map) items = Array.from(iter.keys());
        else throw new PyError('for 循环只能遍历列表、字符串或字典', ctx.line);
        for (const item of items) {
          if (node.vars.length === 1) ctx.scope.assign(node.vars[0], item);
          else {
            if (!Array.isArray(item)) throw new PyError('for 需要解包成 ' + node.vars.length + ' 个变量，但取到的是 ' + typeName(item), ctx.line);
            if (item.length !== node.vars.length) throw new PyError('解包数量不匹配', ctx.line);
            node.vars.forEach((v, i) => ctx.scope.assign(v, item[i]));
          }
          runBody(node.body, ctx);
          if (ctx.flow) {
            if (ctx.flow.type === 'break') { ctx.flow = null; return; }
            if (ctx.flow.type === 'continue') { ctx.flow = null; continue; }
            return; // return 向外传递
          }
        }
        return;
      }
      case 'while': {
        while (truthy(evalNode(node.cond, ctx))) {
          runBody(node.body, ctx);
          if (ctx.flow) {
            if (ctx.flow.type === 'break') { ctx.flow = null; return; }
            if (ctx.flow.type === 'continue') { ctx.flow = null; continue; }
            return;
          }
        }
        return;
      }
      case 'def': {
        ctx.funcs.set(node.name, { params: node.params, body: node.body, closure: ctx.scope });
        return;
      }
      case 'break': ctx.flow = { type: 'break' }; return;
      case 'continue': ctx.flow = { type: 'continue' }; return;
      case 'return': ctx.flow = { type: 'return', value: node.value ? evalNode(node.value, ctx) : null }; return;
      case 'assign': {
        const val = evalNode(node.value, ctx);
        if (node.op === '=') { ctx.scope.assign(node.name, val); return; }
        const cur = ctx.scope.lookup(node.name);
        if (cur === undefined) throw new PyError("变量 '" + node.name + "' 还没有定义，不能使用 " + node.op, ctx.line);
        const op = node.op.slice(0, -1);
        ctx.scope.assign(node.name, arith(op, cur, val, ctx.line));
        return;
      }
      case 'assignIdx': {
        const val = evalNode(node.value, ctx);
        const obj = evalNode({ type: 'name', name: node.name }, ctx);
        const idx = evalNode(node.index, ctx);
        if (Array.isArray(obj)) {
          if (typeof idx !== 'number' || !Number.isInteger(idx)) throw new PyError('下标必须是整数', ctx.line);
          let i = idx; if (i < 0) i = obj.length + i;
          if (i < 0 || i >= obj.length) throw new PyError('列表下标越界: ' + idx + '（列表长度 ' + obj.length + '）', ctx.line);
          obj[i] = val;
          return;
        }
        if (typeof obj === 'string') throw new PyError('字符串不能修改（字符串是不可变的）', ctx.line);
        if (obj instanceof Map) { obj.set(idx, val); return; }
        throw new PyError(typeName(obj) + ' 类型不能按下标赋值', ctx.line);
      }
      case 'expr': evalNode(node.expr, ctx); return;
    }
    throw new PyError('内部错误：未知语句类型', ctx.line);
  }

  /* ---------------- 对外接口 ---------------- */
  function run(code, hooks) {
    const output = [];
    const ctx = {
      scope: new Scope(null),
      funcs: new Map(),
      flow: null,
      steps: 0,
      maxSteps: 500000,
      line: null,
      hooks: {
        print: function (s) { output.push(s); if (hooks && hooks.onPrint) hooks.onPrint(s); }
      }
    };
    try {
      const ast = parseProgram(code);
      if (ast.nodes.length === 0) return { ok: true, output: '', error: null, line: null };
      // 预解析 f-string 内的表达式
      (function prepExpr(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'fstr') {
          n.parts.forEach(p => { if (p.type === 'expr') p.exprNode = parseExprText(p.src, 0); });
        }
        for (const k in n) {
          if (k === 'exprNode' || k === 'parts' || k === 'type') continue;
          const v = n[k];
          if (Array.isArray(v)) v.forEach(prepExpr);
          else if (v && typeof v === 'object') prepExpr(v);
        }
      })(ast);
      runNode(ast, ctx);
      return { ok: true, output: output.join('\n'), error: null, line: null };
    } catch (e) {
      if (e instanceof PyError) {
        if (hooks && hooks.onError) hooks.onError(e.message, e.line);
        return { ok: false, output: output.join('\n'), error: e.message, line: e.line };
      }
      if (hooks && hooks.onError) hooks.onError('运行时错误: ' + e.message, null);
      return { ok: false, output: output.join('\n'), error: '运行时错误: ' + e.message, line: null };
    }
  }

  const MiniPy = {
    run: run,
    version: '1.0.0 (教学子集)',
    supported: ['print', '变量', 'if/elif/else', 'for/while', '列表', '字典', '函数', 'f-string']
  };

  global.MiniPy = MiniPy;
})(typeof window !== 'undefined' ? window : globalThis);
