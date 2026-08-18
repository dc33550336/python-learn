/* ============================================================
 * data.js —— 课程内容数据（5 章，约 40 分钟学习量）
 *
 * blocks 类型说明：
 *   h     : 小标题
 *   p     : 段落（`code` 反引号会渲染为行内代码）
 *   list  : 要点列表
 *   code  : 代码块 { code, run: 是否可一键运行 }
 *   tip   : 提示框 { kind: 'ai'|'note'|'warn', title, text }
 *   demo  : 交互演示 { type: 'if'|'loop'|'list'|'chat' }
 *   quiz  : 小节测验（由 app.js 自动附加在每章末尾）
 * ============================================================ */
const DATA = {
  aiTips: [
    "大模型的核心工作，其实是「预测下一个词」",
    "token 是 AI 眼中的文字碎片——文字被切开，模型才能读",
    "提示词（prompt）就是给 AI 下达的「指令」",
    "幻觉：AI 会一本正经地胡说八道，重要信息要自己核实",
    "API 是程序之间对话的「接口」，Python 通过它调用 AI",
    "现在学 Python，就是给未来 AI 时代的自己存本钱"
  ],

  chapters: [
    {
      id: 'ch1', icon: '🧩', title: '温故知新', time: '约5分钟', tag: '回顾',
      desc: '快速回顾 print、变量、数据类型，补上新手必踩的坑',
      blocks: [
        { t: 'p', text: '你在上海高一信息课上已经接触过 `print`、变量和数据类型。这一章我们花 5 分钟快速巩固，再补上 3 个新手最容易踩的坑。' },
        { t: 'h', text: '打印与变量' },
        { t: 'code', run: true, code: 'name = "小派"\nage = 18\nprint("你好，" + name)      # 字符串拼接\nprint(f"我今年 {age} 岁")   # f-string，更优雅' },
        { t: 'p', text: '`f"..."` 里的 `{变量}` 会被替换成变量的值，这是现在最推荐的做法。' },
        { t: 'h', text: '四种基本数据类型' },
        { t: 'list', items: [
          '`int` 整数：`18`、`-3`、`0`',
          '`float` 小数：`3.14`、`0.5`',
          '`str` 文本：`"你好"`、`\'Python\'`',
          '`bool` 布尔：`True` / `False`'
        ] },
        { t: 'code', run: true, code: 'price = "19.9"        # 注意：这是字符串\nprice = float(price)  # 转换成小数\nprint(price + 1)      # 20.9\nprint(int("42"))      # 字符串 → 整数\nprint(str(100))       # 整数 → 字符串' },
        { t: 'tip', kind: 'warn', title: '三个必避的坑', text: '① 字符串不能直接和数字相加（用 `str()` 转换）；② 变量名不能以数字开头、不能用连字符（`my_name` 可以，`my-name` 不行）；③ 缩进统一用 4 个空格，别用 Tab。' },
        { t: 'tip', kind: 'ai', title: 'AI 小贴士', text: '大模型（ChatGPT、DeepSeek 这些）本质上也是程序，工程师们正是用 Python 搭建它们的工具链。你现在学的每一点，都是通往 AI 的路。' }
      ]
    },
    {
      id: 'ch2', icon: '⚖️', title: '条件判断', time: '约8分钟', tag: '新课',
      desc: '用 if / elif / else 和逻辑运算，让程序自己拿主意',
      blocks: [
        { t: 'p', text: '你已经在用 `if/else` 了。这节补上 `elif`（否则如果）和逻辑运算 `and`（且）、`or`（或）、`not`（非）。' },
        { t: 'h', text: '多分支判断：elif' },
        { t: 'code', run: true, code: 'score = 85\nif score >= 90:\n    print("优秀！")\nelif score >= 60:\n    print("及格啦")\nelse:\n    print("继续加油")' },
        { t: 'p', text: '从上往下依次检查，命中第一个成立的分支就执行，后面的不再看。' },
        { t: 'h', text: '逻辑运算：and / or / not' },
        { t: 'code', run: true, code: 'age = 17\nhas_ticket = True\nif age >= 18 and has_ticket:\n    print("可以入场")\nelse:\n    print("还不行哦")' },
        { t: 'demo', type: 'if' },
        { t: 'tip', kind: 'warn', title: '新手常犯', text: '比较用 `==`（双等号），赋值用 `=`（单等号），写反了程序不会报错但逻辑会错；`if` 结尾的冒号别忘。' },
        { t: 'tip', kind: 'ai', title: 'AI 小贴士', text: '提示词（prompt）的本质也是「条件判断」——大模型会按你的指令，决定走哪条「生成路径」。你给 AI 的约束越清晰，它的回答越准确。' }
      ]
    },
    {
      id: 'ch3', icon: '🔁', title: '循环', time: '约10分钟', tag: '新课',
      desc: '用 for / while 让程序重复干活，告别手工劳动',
      blocks: [
        { t: 'p', text: '写程序最爽的一点：重复的活交给机器。`for` 适合「知道循环几次」，`while` 适合「不知道几次，满足条件就一直转」。' },
        { t: 'h', text: 'for + range：固定次数' },
        { t: 'code', run: true, code: 'for i in range(5):          # range(5) → 0,1,2,3,4\n    print(f"第 {i+1} 次打印")' },
        { t: 'p', text: '`range(起点, 终点)` 是「含头不含尾」：`range(2, 6)` 是 2、3、4、5。' },
        { t: 'h', text: 'while：条件循环' },
        { t: 'code', run: true, code: 'count = 0\nwhile count < 3:\n    print("正在努力...")\n    count += 1        # 别忘了更新条件！' },
        { t: 'h', text: 'break 与 continue' },
        { t: 'code', run: true, code: 'for i in range(10):\n    if i == 5:\n        break          # 立刻结束整个循环\n    if i % 2 == 0:\n        continue       # 跳过本次，进入下一次\n    print(i)            # 打印 1 3' },
        { t: 'demo', type: 'loop' },
        { t: 'tip', kind: 'warn', title: '死循环警告', text: '`while` 里如果忘记更新条件变量（比如漏掉 `count += 1`），循环会永远转下去。练习场有保护机制，但真实环境会卡死，要小心！' },
        { t: 'tip', kind: 'ai', title: 'AI 小贴士', text: '大模型的「训练」就是把海量文本反复循环处理——每轮循环都微调参数，循环几百万次后，模型就「看」懂了语言的规律。' }
      ]
    },
    {
      id: 'ch4', icon: '📦', title: '列表与字典', time: '约10分钟', tag: '新课',
      desc: 'Python 里最常用的两个「收纳箱」',
      blocks: [
        { t: 'p', text: '变量只能装一个值，可现实里数据往往是一大堆。`列表` 和 `字典` 就是 Python 的两个「收纳箱」。' },
        { t: 'h', text: '列表 [ ]：按顺序排队的货架' },
        { t: 'code', run: true, code: 'colors = ["红", "绿", "蓝"]\nprint(colors[0])        # 红（下标从 0 开始！）\ncolors.append("紫")    # 末尾加一个\ncolors[1] = "黄"       # 修改\nprint(colors)\nprint(len(colors))     # 长度' },
        { t: 'code', run: true, code: 'fruits = ["苹果", "香蕉", "橙子"]\nfor f in fruits:\n    print(f"今天吃 {f}")' },
        { t: 'demo', type: 'list' },
        { t: 'h', text: '字典 { }：按名字找东西的储物柜' },
        { t: 'code', run: true, code: 'student = {"name": "小派", "age": 18, "city": "北京"}\nprint(student["name"])   # 小派\nstudent["age"] = 19      # 修改\nstudent["hobby"] = "Python"  # 新增\nfor key, value in student.items():\n    print(f"{key}: {value}")' },
        { t: 'p', text: '列表按「位置」找（下标），字典按「名字」找（键）。用 `d.get("键", 默认值)` 取值更安全，键不存在也不会报错。' },
        { t: 'tip', kind: 'ai', title: 'AI 小贴士', text: 'AI 服务的接口返回的数据通常是 JSON——它的长相和 Python 字典几乎一模一样。学会字典，你就学会了和 AI 服务「对话」的语法。' }
      ]
    },
    {
      id: 'ch5', icon: '🤖', title: 'AI 大冒险', time: '约7分钟', tag: 'AI × Python',
      desc: '认识大模型，亲手写一个会聊天的「规则版小 AI」',
      blocks: [
        { t: 'p', text: '恭喜通关！你已经握住了 Python 的基础语法。这一章我们把 **AI** 和 **Python** 串起来——这可能是当下最值得的方向。' },
        { t: 'h', text: '大模型是怎么「长大」的？' },
        { t: 'p', text: '大模型（ChatGPT、DeepSeek 等）不是被人「一行行写出来」的，而是「喂」出来的：' },
        { t: 'list', items: [
          '收集海量文本：书籍、网页、代码、对话……',
          '让模型反复练习「预测下一个词」',
          '预测错了就微调内部参数，直到越来越准'
        ] },
        { t: 'code', run: true, code: '# 一句话总结大模型\nprint("收集数据 → 预测下一个词 → 调整参数")\nprint("循环几百万次，模型就变聪明了")' },
        { t: 'h', text: '三个必懂的概念' },
        { t: 'list', items: [
          '`token`：文字被切成的「词块」，AI 眼中的最小单位',
          '`上下文窗口`：AI 一次最多能「记住」多少内容',
          '`幻觉`：AI 一本正经地生成不准确的内容——要警惕！'
        ] },
        { t: 'h', text: '让 Python 调用 AI（先收藏这段）' },
        { t: 'p', text: '真正的 AI 程序 = Python 基础 + 调用模型 API + 设计提示词。调用大模型，就像调用一个「超级函数」：' },
        { t: 'code', run: false, code: 'import requests\n\n# 以 DeepSeek 开放平台为例（需要注册并获取 API Key）\nAPI_URL = "https://api.deepseek.com/chat/completions"\nheaders = {\n    "Authorization": "Bearer 你的API_KEY",\n    "Content-Type": "application/json"\n}\ndata = {\n    "model": "deepseek-chat",\n    "messages": [{"role": "user", "content": "你好！"}]   # ← 提示词在这里\n}\nresp = requests.post(API_URL, headers=headers, json=data)\nprint(resp.json()["choices"][0]["message"]["content"])' },
        { t: 'p', text: '这段代码需要联网和 API Key，现在还不能直接运行——但请你先收藏它，等你学到「requests 请求」和「字典」，就能回来亲手点亮它。' },
        { t: 'h', text: '动手实践：写一个「规则版小 AI」' },
        { t: 'p', text: '没有 API Key 也能体验 AI 对话！我们用刚学的 `if/elif` 和函数，写一个会回应你的聊天机器人。先在下面聊天框试试手感，再点「运行 Python 版」看它的代码：' },
        { t: 'demo', type: 'chat' },
        { t: 'code', run: true, code: 'def bot_reply(text):\n    if "你好" in text:\n        return "你好呀！我是规则版小AI 🤖"\n    elif "名字" in text:\n        return "我叫小派，是这里的 AI 助教"\n    elif "python" in text.lower():\n        return "Python 是 AI 世界的通用语言！"\n    elif "再见" in text:\n        return "再见！记得复习哦"\n    else:\n        return f"我还没学会回答『{text}』，试试问问我：你好 / 名字 / python"\n\nprint(bot_reply("你好"))\nprint(bot_reply("python 是什么"))\nprint(bot_reply("今天天气"))' },
        { t: 'p', text: '**思考题**：这个「小 AI」和真正的大模型差别在哪？' },
        { t: 'list', items: [
          '规则版：人写死的 `if/elif`，只能回答预设好的内容',
          '大模型：从数据里「学」出来的规律，能回答从没见过的提问'
        ] },
        { t: 'tip', kind: 'ai', title: '出发吧！', text: 'Python 基础 + AI 概念 + 一点点好奇心，就是 AI 时代的入场券。你已经在路上了，剩下的交给每天的 30-60 分钟。' }
      ]
    }
  ],

  quizzes: [
    { ch: 'ch1', q: '`print("3" + "5")` 会输出什么？', options: ['"35"（拼接后的字符串）', '8（数字相加）', '报错', '35'], answer: 0, explain: '字符串用 + 是「拼接」，所以结果是 "35"；数字相加才会得到 8。' },
    { ch: 'ch1', q: '`int("42")` 的结果是什么类型？', options: ['int 整数', 'str 字符串', 'float 小数', 'bool 布尔'], answer: 0, explain: 'int() 把内容转换成整数，所以结果是整数 42。' },
    { ch: 'ch1', q: '下面哪个是正确的变量名？', options: ['2name', 'my_name', 'my-name', 'class'], answer: 1, explain: '变量名不能以数字开头（2name ✗）、不能用连字符（my-name ✗）、不能用保留字（class ✗）。' },
    { ch: 'ch2', q: '判断变量 x 是否在 10 到 20 之间（含边界），正确写法是？', options: ['10 <= x <= 20', 'x >= 10 or x <= 20', '10 > x > 20', 'x == 10..20'], answer: 0, explain: 'Python 支持链式比较，一个表达式搞定「大于等于 10 且小于等于 20」。' },
    { ch: 'ch2', q: '`True and False` 的结果是？', options: ['False', 'True', '报错', 'None'], answer: 0, explain: 'and（且）要求两边都为真才为真，只要有一个 False，结果就是 False。' },
    { ch: 'ch2', q: 'x = 7，执行下面代码会输出什么？\nif x % 2 == 0: print("偶数") else: print("奇数")', options: ['奇数', '偶数', '报错', '什么都不输出'], answer: 0, explain: '% 是取余。7 除以 2 余 1，不等于 0，所以走 else 分支输出「奇数」。' },
    { ch: 'ch3', q: '`range(3)` 会生成哪些数字？', options: ['0, 1, 2', '1, 2, 3', '0, 1, 2, 3', '3'], answer: 0, explain: 'range(n) 从 0 开始、到 n-1 结束，所以 range(3) 是 0、1、2。' },
    { ch: 'ch3', q: '下面代码会打印几次「你好」？\nfor i in range(2, 6): print("你好")', options: ['4 次', '2 次', '6 次', '5 次'], answer: 0, explain: 'range(2, 6) 含头不含尾：2、3、4、5 共 4 个数，所以打印 4 次。' },
    { ch: 'ch3', q: 'break 的作用是？', options: ['立刻结束整个循环', '跳过本次循环继续', '让程序报错', '重新开始循环'], answer: 0, explain: 'break 是「急刹车」，遇到它整个循环立刻结束；想跳过本次就用 continue。' },
    { ch: 'ch4', q: '`len(["a", "b", "c"])` 的结果是？', options: ['3', '2', '1', '报错'], answer: 0, explain: 'len() 返回列表里元素的个数，这里有 3 个元素。' },
    { ch: 'ch4', q: '想给列表末尾添加一个元素，用哪个方法？', options: ['append', 'add', 'push', 'insert'], answer: 0, explain: 'Python 里是 colors.append("紫")；push 是 JavaScript 的写法，注意区分。' },
    { ch: 'ch4', q: 'd = {"name": "小派"}，下面哪行代码会报错？', options: ['d["age"]', 'd.get("name")', 'd["name"]', 'd.get("age")'], answer: 0, explain: '用 [] 取不存在的键会报 KeyError；用 .get() 不存在时返回 None，更安全。' },
    { ch: 'ch5', q: '大模型的「训练」本质上是？', options: ['反复预测文本中的下一个词并调整参数', '程序员手工编写所有规则', '给电脑加更多内存', '把整个互联网下载到本地'], answer: 0, explain: '大模型的核心训练方式就是「预测下一个词」，错了就微调参数，循环亿万次。' },
    { ch: 'ch5', q: 'token 是什么？', options: ['文字被切分成的词块', '一种加密密码', '模型的品牌名', '一种网络协议'], answer: 0, explain: '模型不认识完整句子，只认识切好的「词块」token，就像人读字词一样。' },
    { ch: 'ch5', q: 'AI 的「幻觉」指什么？', options: ['一本正经地生成不准确的内容', '电脑死机蓝屏', '模型进入了休眠状态', '网络连接断开'], answer: 0, explain: '幻觉是模型自信地编造错误信息，所以重要内容一定要自己核实。' },
    { ch: 'ch5', q: '想让 Python 程序调用大模型，最常用的方式是？', options: ['调用模型的 API 接口', '把文本复制粘贴进程序', '打开命令行终端', '重装操作系统'], answer: 0, explain: '程序之间通过 API 对话：Python 发请求、传提示词，模型返回回答——就像调用一个超级函数。' }
  ],

  cheats: [
    {
      ch: 'ch1', title: '第 1 章 · 温故知新',
      items: [
        ['print("你好")', '在屏幕上输出文字'],
        ['name = "小派"', '把值存进变量'],
        ['int / float / str / bool', '整数 / 小数 / 文本 / 布尔'],
        ['int("42") → 42', '字符串转整数（float/str 同理）'],
        ['f"我是{name}"', '格式化字符串，{} 里放变量']
      ],
      code: 'name = "小派"\nage = 18\nprint(f"你好，我是{name}，今年{age}岁")'
    },
    {
      ch: 'ch2', title: '第 2 章 · 条件判断',
      items: [
        ['if 条件:', '条件成立就执行下面的缩进代码'],
        ['elif 条件:', '否则如果……（可接多个）'],
        ['else:', '以上都不满足时执行'],
        ['==  !=  <  >  <=  >=', '比较运算符（== 是判断相等！）'],
        ['and / or / not', '且 / 或 / 非']
      ],
      code: 'score = 85\nif score >= 90:\n    print("优秀")\nelif score >= 60:\n    print("及格")\nelse:\n    print("加油")'
    },
    {
      ch: 'ch3', title: '第 3 章 · 循环',
      items: [
        ['range(5) → 0,1,2,3,4', '生成数字序列（含头不含尾）'],
        ['for i in range(n):', '固定循环 n 次'],
        ['while 条件:', '条件成立就一直循环'],
        ['break', '立刻结束整个循环'],
        ['continue', '跳过本次，进入下一次']
      ],
      code: 'for i in range(3):\n    print(i)     # 0 1 2\n\nn = 0\nwhile n < 3:\n    print("哈!")\n    n += 1'
    },
    {
      ch: 'ch4', title: '第 4 章 · 列表与字典',
      items: [
        ['[ ] 列表 / { } 字典', '有序货架 / 按键取值'],
        ['colors[0]', '按下标取值（从 0 开始）'],
        ['append() / len()', '末尾添加 / 长度'],
        ['d["键"] 或 d.get("键")', '取字典值（get 更安全）'],
        ['items() / keys() / values()', '遍历字典的三件套']
      ],
      code: 'colors = ["红", "蓝"]\ncolors.append("绿")\nstudent = {"name": "小派", "age": 18}\nfor k, v in student.items():\n    print(k, v)'
    },
    {
      ch: 'ch5', title: '第 5 章 · 函数与 AI',
      items: [
        ['def 函数名(参数):', '把代码打包成「遥控器」'],
        ['return 值', '把结果交出来给调用者'],
        ['token', '文字切成的词块，AI 的最小单位'],
        ['提示词（prompt）', '你给 AI 下达的指令'],
        ['API / 幻觉', '程序调用 AI 的接口 / AI 编造的错误信息']
      ],
      code: 'def greet(name):\n    return f"你好，{name}！"\n\nprint(greet("小派"))   # 你好，小派！'
    }
  ]
};
