/**
* 文章小组件 HTML 转换层
*
* 博客正文里有三类只有网页主题能渲染的组件标记:
* 1. content-widgets 插件的 24 种自定义标签 <xhhao-com-*>(及 Halo 渲染产物里的 <shiki-code>)
* 2. Ethereal 主题的 7 种 callout 短代码(写在 markdown 引用块里:> [!ethereal-xxx])
* 3. GitHub 风格 alert 引用块(> [!TIP] / [!NOTE] / [!WARNING] / [!IMPORTANT] / [!CAUTION] / [!QUOTE])
*
* mp-html 不认识这些标记,会吞掉属性型组件(如 pic 的图片)或把结构压坏。
* 本工具在正文进入 mp-html 之前做字符串预处理,把它们逐个改写成
* mp-html 能渲染的标准 HTML / markdown,原则是内容零丢失:
* 文字、图片、链接全部保留,折叠/复制/悬浮等交互降级为静态展示。
*
* 输入是 Halo 接口的 content.raw(markdown 与 HTML 混排)。
* fenced code 代码块与含组件标记的行内代码一律不处理(那是源码示例)。
*/

/* ---------------- 基础工具 ---------------- */

const ENTITY_MAP: Record<string, string> = {
'&quot;': '"',
'&#34;': '"',
'&apos;': "'",
'&#39;': "'",
'&lt;': '<',
'&gt;': '>',
'&nbsp;': ' ',
'&amp;': '&',
}

/** 解码常见 HTML 实体(属性值/纯文本提取用) */
export function decodeEntities(text: string): string {
return text.replace(/&(?:quot|#34|apos|#39|lt|gt|nbsp|amp);/g, m => ENTITY_MAP[m] || m)
}

/** 转义为可安全放进 HTML 文本节点的内容 */
export function escapeHtml(text: string): string {
return text
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
}

/** 转义为可安全放进双引号属性值的内容 */
function escapeAttr(text: string): string {
return escapeHtml(text).replace(/"/g, '&quot;')
}

type Attrs = Record<string, string | true>

/** 解析标签属性串(机器生成,双引号为主,兼容无值布尔属性) */
function parseAttrs(attrStr: string): Attrs {
const attrs: Attrs = {}
const re = /([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g
let m: RegExpExecArray | null
while ((m = re.exec(attrStr))!== null) {
const name = m[1].toLowerCase()
const value = m[2]!== undefined? m[2]: m[3]
attrs[name] = value === undefined? true: decodeEntities(value)
}
return attrs
}

function attrText(attrs: Attrs, name: string): string {
const v = attrs[name]
return typeof v === 'string'? v: ''
}

/** 去掉所有标签,提取纯文本(代码块内容用) */
function stripToText(html: string): string {
return decodeEntities(html.replace(/<[^>]+>/g, ''))
}

/**
* HTML 岛内部的行内 markdown 渲染:按插件规范标签内容只认 HTML,但不少文章
* 在标签里写了 markdown 行内语法(**加粗** / *斜体* / `代码` / [链接](url) /
* ![图](src)),网页端靠 Halo 全局 markdown 渲染兜底;进了小程序后这些内文
* 位于 mp-html 的 HTML 块内部,marked 不会再处理,必须在这里先转成 HTML。
* 顺序刻意:先藏已有的 <code>/<pre> 段与 markdown 代码段(内部符号一律字面,
* 不许动),再转图片→链接→加粗→斜体。allowLinks=false 时不转链接/图片
* (用于按钮文案等本身就在 <a> 里的文本,避免嵌套链接)。
* 注意:正则禁用 lookbehind(iOS JavaScriptCore 旧版本不支持,会整模块解析失败)。
*/
function fixInlineMd(fragment: string, allowLinks = true): string {
const stash: string[] = []
const keep = (html: string): string => {
stash.push(html)
return `\u0001MD${stash.length - 1}\u0001`
}
let s = fragment.replace(/<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/gi, m => keep(m))
// markdown 代码段:整段藏起,还原时以 <code> 呈现,内部 ** 等符号保持字面
s = s.replace(/(`+)([\s\S]*?)\1/g, (m, ticks: string, body: string) => {
if (body.includes('\n') && ticks.length < 3)
return m // 跨行且非三反引号:不是行内代码段,不动
return keep(`<code>${body}</code>`)
})
if (allowLinks) {
s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, '<img src="$2" alt="$1">')
s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, '<a href="$2">$1</a>')
}
s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
// 斜体:加粗处理完后剩下的单星号对;贴着另一颗星或首尾空白的不是斜体
s = s.replace(/\*([^*\n]+)\*/g, (m, body: string, offset: number, str: string) => {
if (str[offset - 1] === '*' || str[offset + m.length] === '*')
return m
if (/^\s/.test(body) || /\s$/.test(body))
return m
return `<em>${body}</em>`
})
s = s.replace(/\u0001MD(\d+)\u0001/g, (_, i) => stash[Number(i)])
return s
}

/** 块级内文规整:去首尾空白、段落空行转 <br>,避免 markdown 把 HTML 块截断 */
function blockInner(html: string): string {
return fixInlineMd(html.trim()).replace(/\n\s*\n/g, '<br>').replace(/\n/g, ' ')
}

/* ---------------- 配色(第四轮:对齐 Ethereal 网页主题真实取值) ----------------
* 色值来源(ethereal-fix 源码,oklch 已换算为 sRGB hex):
* - 标签版 alert/admonition/result 与 badge/status:主题 content-widgets.css 的
*   --xhhao-cw-* 语义色(亮色套):tip/success oklch(.62 .15 160)、info
*   oklch(.60 .12 250)、question oklch(.62 .15 285)、warning oklch(.68 .16 70)、
*   error oklch(.60 .20 25)。
* - GitHub alert 引用块:主题 variables.css 的 --admonitions-color-*(网页对
*   [!TIP] 等走 callout/admonition 渲染,与插件语义色不同源):tip
*   oklch(.70 .14 180)、note oklch(.70 .14 250)、important oklch(.70 .14 310)、
*   warning oklch(.70 .14 60)、caution oklch(.60 .20 25)。
* - example/bug/default 主题无对应值,保留中性/插件自有色,不冒充主题色。
* 盒模型对齐主题 admonition 卡片化:整框 1px solid 色@24%、左边 3px 实色、
* 底色 色@10%(主题为 color-mix 10% 入 card-bg,这里用等效 rgba 叠加)、
* 圆角 0.625rem≈10px、padding 0.85em/1.1em(按正文约 13~14px 折算 12/16px)。
* 主题主色 --primary = oklch(.70 .14 var(--hue)),站点 hue=250 → #53A3F2。 */

const THEME_PRIMARY = '#53A3F2'

interface Accent { color: string, icon: string}

const ACCENTS: Record<string, Accent> = {
info: { color: '#4284C5', icon: 'ℹ️'},
tip: { color: '#00A166', icon: '💡'},
question: { color: '#7F76DC', icon: '❓'},
success: { color: '#00A166', icon: '✔️'},
warning: { color: '#D58300', icon: '⚠️'},
error: { color: '#DE3B3D', icon: '✖️'},
danger: { color: '#DE3B3D', icon: '⛔'},
example: { color: '#64748B', icon: '📌'},
quote: { color: '#64748B', icon: '❝'},
bug: { color: '#DB2777', icon: '🐛'},
default: { color: '#64748B', icon: 'ℹ️'},
// GitHub alert 专用(主题 --admonitions-color-*)
'gh-tip': { color: '#00BAA2', icon: '💡'},
'gh-note': { color: '#53A3F2', icon: 'ℹ️'},
'gh-important': { color: '#B984DF', icon: '❗'},
'gh-warning': { color: '#DD8736', icon: '⚠️'},
'gh-caution': { color: '#DE3B3D', icon: '🔴'},
}

function accentOf(type: string): Accent {
return ACCENTS[type] || ACCENTS.default
}

/** hex + alpha → rgba 串(底色/边框的透明叠加,与主题 color-mix 等效) */
function rgba(hex: string, alpha: number): string {
const n = Number.parseInt(hex.slice(1), 16)
return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

const NOTE_COLORS: Record<string, string> = {
yellow: 'rgba(234,179,8,0.16)',
green: 'rgba(34,197,94,0.13)',
blue: 'rgba(59,130,246,0.12)',
pink: 'rgba(236,72,153,0.12)',
purple: 'rgba(168,85,247,0.13)',
}

const BOX_STYLE = (a: Accent) =>
`border:1px solid ${rgba(a.color, 0.24)};border-left:3px solid ${a.color};background:${rgba(a.color, 0.10)};padding:12px 16px;border-radius:10px;margin:14px 0;`
const CODE_STYLE = 'font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.6;'
/* 卡片描边取主题 --line-color(亮色 rgba(0,0,0,0.1)),圆角与提示盒同档 10px */
const CARD_BORDER = 'border:1px solid rgba(0,0,0,0.1);border-radius:10px;'

/* ---------------- 标签扫描(同名嵌套按深度配对) ---------------- */

const TAG_RE = /<(xhhao-com-[a-z0-9-]+|shiki-code)\b([^>]*)>/g

interface TagElement {
tag: string
attrs: Attrs
inner: string
start: number
end: number
raw: string
}

/** 找第一个「内部不再含未处理自定义标签」的元素(最内层优先) */
function findInnermost(html: string): TagElement | null {
TAG_RE.lastIndex = 0
let m: RegExpExecArray | null
while ((m = TAG_RE.exec(html))!== null) {
const tag = m[1]
const attrStr = m[2] || ''
const start = m.index
if (/\/\s*$/.test(attrStr)) {
return { tag, attrs: parseAttrs(attrStr.replace(/\/\s*$/, '')), inner: '', start, end: start + m[0].length, raw: m[0]}
}
// 向后按同名深度找闭合
const pairRe = new RegExp(`</?${tag}\\b[^>]*>`, 'g')
pairRe.lastIndex = start + m[0].length
let depth = 1
let pm: RegExpExecArray | null
let closeStart = -1
let closeEnd = -1
while ((pm = pairRe.exec(html))!== null) {
if (pm[0].startsWith('</')) {
depth--
if (depth === 0) {
closeStart = pm.index
closeEnd = pm.index + pm[0].length
break
}
}
else if (!/\/\s*>$/.test(pm[0])) {
depth++
}
}
if (closeStart < 0)
continue // 无闭合的残缺标签,跳过(最终由兜底剥离)
const inner = html.slice(start + m[0].length, closeStart)
if (!/<(xhhao-com-|shiki-code)/.test(inner)) {
return { tag, attrs: parseAttrs(attrStr), inner, start, end: closeEnd, raw: html.slice(start, closeEnd)}
}
// 含未处理子标签:继续找更内层(循环会命中子标签)
}
return null
}

/* ---------------- 各标签的改写 ---------------- */

interface Ctx {
/** 全文纯文本字数(reading-time 估算用) */
docTextLength: number
}

function codeBlock(lines: string[]): string {
const text = lines.map(l => l.replace(/\s+$/g, '')).join('\n').replace(/^\n+|\n+$/g, '')
/* 主题代码块:--codeblock-bg oklch(.17 .015 250)=#0A1016 深藏青 + 白字 + rounded-xl(12px) */
return `<pre style="${CODE_STYLE}background:#0A1016;color:#FFFFFF;border-radius:12px;padding:12px 14px;white-space:pre-wrap;word-break:break-all;margin:12px 0;"><code>${escapeHtml(text)}</code></pre>`
}

function commandLine(attrs: Attrs, inner: string): string {
const prompt = attrText(attrs, 'prompt')
const text = stripToText(inner).trim()
return prompt? `${prompt} ${text}`: text
}

function alertLike(attrs: Attrs, inner: string, defaultType: string): string {
const a = accentOf(attrText(attrs, 'type') || defaultType)
const title = attrText(attrs, 'title')
/* 标题行着类型色(主题 .bdm-title / .callout-title 均为类型色 + 加粗) */
const titleHtml = title
? `<div style="font-weight:700;margin-bottom:4px;color:${a.color};">${a.icon} ${escapeHtml(title)}</div>`
: ''
return `<div style="${BOX_STYLE(a)}">${titleHtml}${blockInner(inner)}</div>`
}

function linkCardBlock(href: string, title: string, desc: string, badge: string): string {
const shownTitle = title || href
const descHtml = desc? `<div style="font-size:13px;opacity:0.75;margin-top:2px;">${escapeHtml(desc)}</div>`: ''
return `<a href="${escapeAttr(href)}" style="display:block;${CARD_BORDER}padding:10px 12px;margin:10px 0;text-decoration:none;color:inherit;"><div style="font-weight:700;">${badge} ${escapeHtml(shownTitle)}</div>${descHtml}<div style="font-size:12px;opacity:0.6;margin-top:4px;word-break:break-all;">${escapeHtml(href)}</div></a>`
}

/** 提取片段里顶层 <div> 的内文(compare 的左右两栏) */
function splitTopDivs(inner: string): string[] {
const parts: string[] = []
const re = /<\/?div\b[^>]*>/g
let depth = 0
let segStart = -1
let m: RegExpExecArray | null
while ((m = re.exec(inner))!== null) {
if (m[0].startsWith('</')) {
depth--
if (depth === 0 && segStart >= 0) {
parts.push(inner.slice(segStart, m.index))
segStart = -1
}
}
else if (!/\/\s*>$/.test(m[0])) {
if (depth === 0)
segStart = m.index + m[0].length
depth++
}
}
return parts
}

function transformElement(el: TagElement, ctx: Ctx): string {
const { tag, attrs, inner} = el
switch (tag) {
case 'shiki-code':
// Halo 渲染产物里的代码块外壳,剥壳保留内层 <pre>
return inner

case 'xhhao-com-alert':
return alertLike(attrs, inner, 'info')

case 'xhhao-com-admonition':
// 折叠降级为全展开静态展示
return alertLike(attrs, inner, 'info')

case 'xhhao-com-result':
return alertLike(attrs, inner, 'success')

case 'xhhao-com-note': {
const bg = NOTE_COLORS[attrText(attrs, 'color')] || NOTE_COLORS.yellow
return `<div style="background:${bg};padding:10px 12px;border-radius:8px;margin:10px 0;">${blockInner(inner)}</div>`
}

case 'xhhao-com-quote':
/* 主题普通引用:主色 6% 底 + 3px 主色左边 + 圆角 0.7em≈10px,字色 deep-text 82% 混主色 = #24394F */
return `<blockquote style="background:rgba(83,163,242,0.06);border-left:3px solid ${THEME_PRIMARY};border-radius:10px;padding:10px 16px 10px 18px;margin:14px 0;color:#24394F;">${blockInner(inner)}</blockquote>`

case 'xhhao-com-card-list':
// 解包:内层是普通 <ul>,但 li 文本里常带 markdown 加粗/代码(实测 19 篇中
// 多篇中招),解包后是 HTML 岛、marked 不再处理,必须先做行内 markdown 渲染
return fixInlineMd(inner.trim())

case 'xhhao-com-compare': {
const leftTitle = attrText(attrs, 'left-title')
const rightTitle = attrText(attrs, 'right-title')
const divs = splitTopDivs(inner).map(d => blockInner(d))
const blocks = divs.length > 0? divs: [blockInner(inner)]
const titles = [leftTitle, rightTitle]
const rendered = blocks.map((body, i) => {
const t = titles[i] || (i === 0? leftTitle: '')
const titleHtml = t? `<div style="font-weight:700;margin-bottom:4px;">${escapeHtml(t)}</div>`: ''
return `<div style="${CARD_BORDER}padding:10px 12px;margin-bottom:8px;">${titleHtml}${body}</div>`
}).join('')
// 超过两栏的剩余内容并入最后一栏之后,保证不丢
return `<div style="margin:10px 0;">${rendered}</div>`
}

case 'xhhao-com-link-card': {
// preset 决定图标:github 用 🐙,其余(website 等)用 🔗
const badge = attrText(attrs, 'preset') === 'github'? '🐙': '🔗'
return linkCardBlock(attrText(attrs, 'href'), attrText(attrs, 'title'), attrText(attrs, 'description'), badge)
}

case 'xhhao-com-pdf':
return linkCardBlock(attrText(attrs, 'src'), attrText(attrs, 'title') || 'PDF 文档', '', '📄')

case 'xhhao-com-bilibili': {
const bvid = attrText(attrs, 'bvid')
const aid = attrText(attrs, 'aid')
const href = bvid? `https://www.bilibili.com/video/${bvid}`: (aid? `https://www.bilibili.com/video/av${aid}`: '')
if (!href)
return escapeHtml(attrText(attrs, 'title'))
return linkCardBlock(href, attrText(attrs, 'title') || '哔哩哔哩视频', '', '📺')
}

case 'xhhao-com-pic': {
const src = attrText(attrs, 'src')
if (!src)
return ''
const caption = attrText(attrs, 'caption')
const captionHtml = caption
? `<div style="text-align:center;font-size:12px;opacity:0.65;margin-top:4px;">${escapeHtml(caption)}</div>`
: ''
return `<div style="margin:10px 0;"><img src="${escapeAttr(src)}" style="width:100%;border-radius:12px;display:block;">${captionHtml}</div>`
}

case 'xhhao-com-button':
case 'xhhao-com-action-button': {
const href = attrText(attrs, 'href')
// 文案先转纯文本再转义,然后做行内 markdown 渲染(不转链接,避免 <a> 嵌套)
const labelHtml = fixInlineMd(escapeHtml(stripToText(inner).trim() || href), false)
const btnType = attrText(attrs, 'type')
const primary = btnType === 'primary' || tag === 'xhhao-com-action-button'
// 三档(主题值):primary/action = 主色 #53A3F2 底白字(action 渐变预设降级纯色);
// secondary = 常规按钮 --btn-regular-bg #E2F0FF 底 + --btn-content #3275B4 字;
// 其余描边 = --line-color 边 + btn-content 字
const style = primary
? `display:inline-block;padding:8px 18px;border-radius:8px;background:${THEME_PRIMARY};color:#ffffff;text-decoration:none;margin:6px 0;`
: btnType === 'secondary'
? 'display:inline-block;padding:8px 18px;border-radius:8px;background:#E2F0FF;text-decoration:none;color:#3275B4;margin:6px 0;'
: `display:inline-block;padding:8px 18px;border-radius:8px;${CARD_BORDER}text-decoration:none;color:#3275B4;margin:6px 0;`
if (!href)
return `<span style="${style}">${labelHtml}</span>`
return `<a href="${escapeAttr(href)}" style="${style}">${labelHtml}</a>`
}

case 'xhhao-com-command':
case 'xhhao-com-copy':
return codeBlock([commandLine(attrs, inner)])

case 'xhhao-com-key': {
const mods: string[] = []
if ('cmd' in attrs || 'meta' in attrs) mods.push('⌘')
if ('ctrl' in attrs) mods.push('⌃')
if ('alt' in attrs || 'option' in attrs) mods.push('⌥')
if ('shift' in attrs) mods.push('⇧')
const code = attrText(attrs, 'code') || stripToText(inner).trim()
return `<span style="border:1px solid rgba(128,128,128,0.55);border-bottom-width:2px;border-radius:5px;padding:0 5px;font-family:Menlo,Consolas,monospace;font-size:12px;">${escapeHtml([...mods, code].join(' '))}</span>`
}

case 'xhhao-com-badge': {
const a = accentOf(attrText(attrs, 'type') || 'default')
return `<span style="display:inline-block;padding:0 6px;border-radius:4px;font-size:12px;line-height:1.7;background:${rgba(a.color, 0.12)};border:1px solid ${rgba(a.color, 0.35)};">${fixInlineMd(inner.trim())}</span>`
}

case 'xhhao-com-status': {
const a = accentOf(attrText(attrs, 'type') || 'default')
const label = attrText(attrs, 'label')
const value = attrText(attrs, 'value')
const text = label && value? `${label}：${value}`: (label || value || stripToText(inner).trim())
return `<span style="display:inline-block;padding:0 6px;border-radius:4px;font-size:12px;line-height:1.7;background:${rgba(a.color, 0.12)};border:1px solid ${rgba(a.color, 0.35)};">${escapeHtml(text)}</span>`
}

case 'xhhao-com-blur':
return `<span style="background:rgba(128,128,128,0.22);border-radius:4px;padding:0 4px;">【剧透】${fixInlineMd(inner.trim())}</span>`

case 'xhhao-com-annotation': {
const note = attrText(attrs, 'note')
const noteHtml = note? `<span style="font-size:12px;opacity:0.7;">（${escapeHtml(note)}）</span>`: ''
return `${fixInlineMd(inner.trim())}${noteHtml}`
}

case 'xhhao-com-tip': {
const tip = attrText(attrs, 'tip')
const tipHtml = tip? `<span style="font-size:12px;opacity:0.7;">（${escapeHtml(tip)}）</span>`: ''
return `${fixInlineMd(inner.trim())}${tipHtml}`
}

case 'xhhao-com-emoji-clock': {
const clocks = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚']
return `<span>${clocks[new Date().getHours() % 12]}</span>`
}

case 'xhhao-com-reading-time': {
const words = attrText(attrs, 'words')
const total = words? Number.parseInt(words, 10): ctx.docTextLength
const minutes = Math.max(1, Math.round((Number.isFinite(total) && total > 0? total: 0) / 350))
return `<span>约 ${minutes} 分钟</span>`
}

case 'xhhao-com-task': {
/* 勾选字符着主色(主题任务复选框为主题色边/底的静态近似) */
const box = 'checked' in attrs? '☑': '☐'
return `<div style="margin:4px 0;"><span style="color:${THEME_PRIMARY};">${box}</span> ${blockInner(inner)}</div>`
}

default:
// 未知组件:剥壳保内容,内文同样做行内 markdown 渲染,零丢失兜底
return fixInlineMd(inner)
}
}

/** command-group:整组命令合并成一个代码块(在通用循环前处理,保住分组结构) */
function transformCommandGroups(html: string): string {
let out = html
for (let guard = 0; guard < 50; guard++) {
const openRe = /<xhhao-com-command-group\b([^>]*)>/g
const m = openRe.exec(out)
if (!m)
break
const start = m.index
const pairRe = /<\/?xhhao-com-command-group\b[^>]*>/g
pairRe.lastIndex = start + m[0].length
let depth = 1
let pm: RegExpExecArray | null
let closeStart = -1
let closeEnd = -1
while ((pm = pairRe.exec(out))!== null) {
if (pm[0].startsWith('</')) {
depth--
if (depth === 0) { closeStart = pm.index; closeEnd = pm.index + pm[0].length; break}
}
else if (!/\/\s*>$/.test(pm[0])) depth++
}
if (closeStart < 0)
break
const attrs = parseAttrs(m[1] || '')
const inner = out.slice(start + m[0].length, closeStart)
const lines: string[] = []
const rest = inner.replace(/<xhhao-com-command\b([^>]*)>([\s\S]*?)<\/xhhao-com-command>/g, (_, a, body) => {
lines.push(commandLine(parseAttrs(a), body))
return ''
})
const title = attrText(attrs, 'title')
const titleHtml = title? `<div style="font-weight:700;margin:10px 0 4px;">${escapeHtml(title)}</div>`: ''
const restText = rest.trim()
const restHtml = restText? processFragment(restText, { docTextLength: 0}): ''
out = out.slice(0, start) + titleHtml + codeBlock(lines) + restHtml + out.slice(closeEnd)
}
return out
}

/** task-list:整组任务合并成清单(同上,保住分组与可选标题) */
function transformTaskLists(html: string, ctx: Ctx): string {
let out = html
for (let guard = 0; guard < 50; guard++) {
const openRe = /<xhhao-com-task-list\b([^>]*)>/g
const m = openRe.exec(out)
if (!m)
break
const start = m.index
const pairRe = /<\/?xhhao-com-task-list\b[^>]*>/g
pairRe.lastIndex = start + m[0].length
let depth = 1
let pm: RegExpExecArray | null
let closeStart = -1
let closeEnd = -1
while ((pm = pairRe.exec(out))!== null) {
if (pm[0].startsWith('</')) {
depth--
if (depth === 0) { closeStart = pm.index; closeEnd = pm.index + pm[0].length; break}
}
else if (!/\/\s*>$/.test(pm[0])) depth++
}
if (closeStart < 0)
break
const attrs = parseAttrs(m[1] || '')
const inner = out.slice(start + m[0].length, closeStart)
const rows: string[] = []
const rest = inner.replace(/<xhhao-com-task\b([^>]*)>([\s\S]*?)<\/xhhao-com-task>/g, (_, a, body) => {
const box = 'checked' in parseAttrs(a)? '☑': '☐'
rows.push(`<div style="margin:4px 0;"><span style="color:${THEME_PRIMARY};">${box}</span> ${blockInner(body)}</div>`)
return ''
})
const title = attrText(attrs, 'title')
const titleHtml = title? `<div style="font-weight:700;margin-bottom:4px;">${escapeHtml(title)}</div>`: ''
const restText = rest.trim()
const restHtml = restText? processFragment(restText, ctx): ''
out = out.slice(0, start) + `<div style="margin:10px 0;">${titleHtml}${rows.join('')}${restHtml}</div>` + out.slice(closeEnd)
}
return out
}

/** 片段级处理:容器组件 → 最内层优先的通用循环 → 残缺/未知标签兜底剥离 */
function processFragment(html: string, ctx: Ctx): string {
let out = transformCommandGroups(html)
out = transformTaskLists(out, ctx)
for (let guard = 0; guard < 500; guard++) {
const el = findInnermost(out)
if (!el)
break
out = out.slice(0, el.start) + transformElement(el, ctx) + out.slice(el.end)
}
// 兜底:仍残留的自定义标签(无闭合等异常形态)剥壳保内容
out = out.replace(/<\/?(xhhao-com-[a-z0-9-]+|shiki-code)\b[^>]*>/g, '')
return out
}

/* ---------------- details 折叠块(普通 HTML 构造) ----------------
* mp-html 不信任 details/summary,会降级成 span 且正文里的 markdown 不再被
* 解析(实测 post-browserskill:summary 与满是行内代码的正文被压平、反引号
* 字面残留)。这里静态化为带边框块:summary 做加粗标题行、正文全展开,
* 正文先走组件处理再做块级内文规整(行内 markdown 在此渲染)。 */
function transformDetails(html: string, ctx: Ctx): string {
let out = html
for (let guard = 0; guard < 20; guard++) {
const open = /<details\b[^>]*>/i.exec(out)
if (!open)
break
const start = open.index
const pairRe = /<\/?details\b[^>]*>/gi
pairRe.lastIndex = start + open[0].length
let depth = 1
let pm: RegExpExecArray | null
let closeStart = -1
let closeEnd = -1
while ((pm = pairRe.exec(out))!== null) {
if (pm[0].startsWith('</')) {
depth--
if (depth === 0) { closeStart = pm.index; closeEnd = pm.index + pm[0].length; break}
}
else if (!/\/\s*>$/.test(pm[0])) depth++
}
if (closeStart < 0)
break
const innerAll = out.slice(start + open[0].length, closeStart)
const sm = innerAll.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)
const summaryHtml = sm? fixInlineMd(sm[1].trim()): ''
const body = sm? innerAll.slice(0, sm.index) + innerAll.slice(sm.index + sm[0].length): innerAll
const bodyHtml = blockInner(processFragment(body, ctx))
const summaryBlock = summaryHtml
? `<div style="font-weight:700;margin-bottom:4px;">▸ ${summaryHtml}</div>`
: ''
out = out.slice(0, start)
+ `<div style="${CARD_BORDER}padding:10px 12px;margin:10px 0;">${summaryBlock}${bodyHtml}</div>`
+ out.slice(closeEnd)
}
return out
}

/* ---------------- callout 短代码(7 种) ---------------- */

const CALLOUT_TYPES = ['tab', 'collapse', 'timeline', 'steps', 'progress', 'chat', 'columns'] as const
type CalloutType = typeof CALLOUT_TYPES[number]

interface CalloutSection { heading: string, body: string}

function renderCallout(type: CalloutType, sections: CalloutSection[], preamble: string): string {
const parts: string[] = []
if (preamble.trim())
parts.push(preamble.trim())
if (type === 'progress') {
for (const sec of sections) {
const segs = sec.heading.split('|').map(s => s.trim())
const numSeg = segs.find(s => /^\d+(?:\.\d+)?%?$/.test(s))
const label = segs.filter(s => s!== numSeg).join(' | ') || sec.heading
const pct = numSeg? Number.parseFloat(numSeg): 0
const clamped = Math.max(0, Math.min(100, pct))
parts.push(`<div style="margin:8px 0 2px;">${escapeHtml(label)}：${clamped}%</div><div style="background:#E2F0FF;border-radius:4px;height:8px;margin:0 0 8px;"><div style="width:${clamped}%;height:8px;border-radius:4px;background:${THEME_PRIMARY};"></div></div>`)
if (sec.body.trim())
parts.push(sec.body.trim())
}
return parts.join('\n\n')
}
if (type === 'chat') {
for (const sec of sections) {
const hm = sec.heading.match(/^\[(self|system)\]\s*(.+)$/)
const name = hm? hm[2]: sec.heading
const body = sec.body.trim()
parts.push(body? `**${name}**：${body}`: `**${name}**`)
}
return parts.join('\n\n')
}
sections.forEach((sec, i) => {
const heading = type === 'steps'? `${i + 1}. ${sec.heading}`: sec.heading
parts.push(`#### ${heading}`)
if (sec.body.trim())
parts.push(sec.body.trim())
})
return parts.join('\n\n')
}

/* ---------------- GitHub 风格 alert 引用块 ----------------
* raw 里还有一类提示框存的是 GitHub alert 语法:引用块首行 [!TIP] / [!NOTE] /
* [!WARNING] / [!IMPORTANT] / [!CAUTION] / [!QUOTE],可带同行标题文字
* (如「💡 Tip」「💡 一句话结论」)。网页主题会把它二次加工成提示框,mp-html
* 只当普通引用块渲染,[!TIP] 标记便原样漏出(用户真机实证)。实测 35 篇中共
* 70 处:TIP 39 / NOTE 16 / WARNING 7 / CAUTION 6 / IMPORTANT 1 / QUOTE 1,
* 形态统一为标记行 + 单/多段散文正文(无列表、无围栏)。这里转成与标签版
* alert 同款的提示块:配色取现有 ACCENTS,图标按 GitHub 语义。 */

const GH_ALERTS: Record<string, { accent: string, icon: string, name: string }> = {
tip: { accent: 'gh-tip', icon: '💡', name: 'Tip' },
note: { accent: 'gh-note', icon: 'ℹ️', name: 'Note' },
warning: { accent: 'gh-warning', icon: '⚠️', name: 'Warning' },
important: { accent: 'gh-important', icon: '❗', name: 'Important' },
caution: { accent: 'gh-caution', icon: '🔴', name: 'Caution' },
quote: { accent: 'quote', icon: '❝', name: 'Quote' },
}

/** 同行标题解析:剥掉前导 emoji/符号后,若为空或与类型默认名相同则用默认名,否则视为自定义标题 */
function ghAlertTitle(def: { name: string }, sameLine: string): string {
const cleaned = sameLine.replace(/^[^A-Za-z\u4e00-\u9fff]+/, '').trim()
if (!cleaned || cleaned.toLowerCase() === def.name.toLowerCase())
return def.name
return cleaned
}

function renderGhAlert(type: string, sameLine: string, bodyLines: string[], ctx: Ctx): string {
const def = GH_ALERTS[type]
const a = accentOf(def.accent)
const title = ghAlertTitle(def, sameLine)
// 正文先处理内嵌的 xhhao 标签(实测有正文嵌 badge 的),再做块级内文渲染
const bodyText = bodyLines.join('\n').trim()
const bodyHtml = bodyText? blockInner(processFragment(bodyText, ctx)): ''
const titleHtml = `<div style="font-weight:700;margin-bottom:4px;color:${a.color};">${def.icon} ${escapeHtml(title)}</div>`
return `<div style="${BOX_STYLE(a)}">${titleHtml}${bodyHtml}</div>`
}

/** 处理一个文本块里的 callout 引用块(行级解析),普通引用块原样放行 */
function transformCallouts(text: string, ctx: Ctx): string {
const lines = text.split('\n')
const out: string[] = []
let i = 0
while (i < lines.length) {
if (/^\s*>/.test(lines[i])) {
const block: string[] = []
while (i < lines.length && /^\s*>/.test(lines[i])) {
block.push(lines[i])
i++
}
const innerLines = block.map(l => l.replace(/^\s*>\s?/, ''))
const first = innerLines[0] || ''
const gm = first.match(/^\[!(TIP|NOTE|WARNING|IMPORTANT|CAUTION|QUOTE)\]\s*(.*)$/i)
const cm = first.match(/^\[!ethereal-(tab|collapse|timeline|steps|progress|chat|columns)\]\s*(.*)$/)
if (gm) {
out.push(renderGhAlert(gm[1].toLowerCase(), gm[2] || '', innerLines.slice(1), ctx))
}
else if (cm) {
const type = cm[1] as CalloutType
const sections: CalloutSection[] = []
let preambleLines: string[] = []
let current: CalloutSection | null = null
for (const rawLine of innerLines.slice(1)) {
const hm = rawLine.match(/^###\s+(.+)$/)
if (hm) {
current = { heading: hm[1].trim(), body: ''}
sections.push(current)
}
else if (current) {
current.body += (current.body? '\n': '') + rawLine
}
else {
preambleLines.push(rawLine)
}
}
out.push(renderCallout(type, sections, preambleLines.join('\n')))
}
else {
out.push(...block)
}
}
else {
out.push(lines[i])
i++
}
}
return out.join('\n')
}

/* ---------------- 主入口 ---------------- */

/** 掩码:含组件标记的行内代码段(源码示例)先藏起来,处理完再还原 */
function maskInlineCode(text: string, stash: string[]): string {
return text.replace(/(`+)([^`]|`(?!`))*?\1/g, (m) => {
if (m.includes('xhhao-com-') || m.includes('[!ethereal')) {
stash.push(m)
return `\u0001IC${stash.length - 1}\u0001`
}
return m
})
}

/** 对文本做 details/组件处理,但跳过 fenced code 段(callout 展平后正文里可能
* 出现顶层围栏,如 tab 分节内的命令示例——围栏内容是源码示例,一律不碰) */
function processOutsideFences(text: string, ctx: Ctx): string {
const lines = text.split('\n')
const chunks: string[] = []
let buf: string[] = []
let inFence = false
let fenceMarker = ''
const flush = () => {
if (buf.length > 0) {
chunks.push(inFence? buf.join('\n'): processFragment(transformDetails(buf.join('\n'), ctx), ctx))
buf = []
}
}
for (const line of lines) {
const fm = line.match(/^\s*(```+|~~~+)/)
if (fm && (!inFence || fm[1][0] === fenceMarker[0])) {
if (inFence) {
buf.push(line)
flush()
inFence = false
fenceMarker = ''
}
else {
flush()
inFence = true
fenceMarker = fm[1]
buf.push(line)
}
}
else {
buf.push(line)
}
}
flush()
return chunks.join('\n')
}

function processChunk(text: string, ctx: Ctx): string {
const stash: string[] = []
let out = maskInlineCode(text, stash)
out = transformCallouts(out, ctx)
out = processOutsideFences(out, ctx)
out = out.replace(/\u0001IC(\d+)\u0001/g, (_, i) => stash[Number(i)])
return out
}

/**
* 转换文章正文(markdown + HTML 混排)为 mp-html 可完整渲染的内容。
* fenced code 块原样保留;任何异常都回退原文,绝不让转换本身把文章弄坏。
*/
export function transformXhhaoContent(input: string): string {
if (!input)
return input
if (!input.includes('xhhao-com-') &&!input.includes('[!ethereal-') &&!input.includes('shiki-code') &&!input.includes('<details') &&!input.includes('[!'))
return input
try {
const ctx: Ctx = { docTextLength: stripToText(input).length}
const lines = input.split('\n')
const chunks: string[] = []
let buf: string[] = []
let inFence = false
let fenceMarker = ''
const flush = () => {
if (buf.length > 0) {
chunks.push(inFence? buf.join('\n'): processChunk(buf.join('\n'), ctx))
buf = []
}
}
for (const line of lines) {
const fm = line.match(/^\s*(```+|~~~+)/)
if (fm && (!inFence || fm[1][0] === fenceMarker[0])) {
if (inFence) {
buf.push(line)
flush()
inFence = false
fenceMarker = ''
}
else {
flush()
inFence = true
fenceMarker = fm[1]
buf.push(line)
}
}
else {
buf.push(line)
}
}
flush()
return chunks.join('\n')
}
catch (err) {
console.error('xhhao 组件转换失败,回退原文', err)
return input
}
}

/* ============================================================
 * 换肤一期:转换输出的深色映射
 * 转换器内联样式是静态字符串(浅色套),无法随外观自适应;
 * 文章页在深色下对 transformXhhaoContent 的输出再过一层本函数,
 * 把颜色 token 逐个换成主题深色套(variables.css :root.dark /
 * content-widgets.css 深色段,oklch→hex 与浅色同法换算)。
 * 只替换颜色字面量,不动任何结构/文本/链接,零丢失断言不受影响。
 * rgba() 在上文由 hex 运行时派生(格式 rgba(r,g,b,a) 无空格),
 * 故映射表同时含 hex 与三元组两种形态。
 * ============================================================ */
const XHHAO_DARK_PAIRS: Array<[string, string]> = [
  // hex 形态
  ['#53A3F2', '#63B3FF'], // 主色 primary(深 .75 .14 250)
  ['#4284C5', '#79B6F4'], // info(cw info 深 .76 .11 250)
  ['#00A166', '#56D298'], // tip/success(cw tip 深 .78 .14 160)
  ['#7F76DC', '#AFABFF'], // question(cw question 深 .78 .13 285)
  ['#D58300', '#F7AC4D'], // warning(cw warning 深 .8 .14 70)
  ['#DE3B3D', '#FF6F69'], // error/danger/gh-caution(cw error 深 .72 .18 25)
  ['#64748B', '#94A3B8'], // example/quote/default(主题无对应,slate 亮一档)
  ['#DB2777', '#F472B6'], // bug(粉彩亮一档)
  ['#00BAA2', '#00CAB1'], // gh-tip(admonitions tip 深 .75 .14 180)
  ['#B984DF', '#C994F0'], // gh-important(admonitions important 深 .75 .14 310)
  ['#DD8736', '#EE9748'], // gh-warning(admonitions warning 深 .75 .14 60)
  ['#E2F0FF', '#283747'], // btn-regular-bg(深 .33 .035 250)/进度条轨道
  ['#3275B4', '#7CB3EB'], // btn-content(深 .75 .10 250)
  ['#24394F', '#B3CAE2'], // 引用字色(deep-text 82% 混主色,深色同法)
  // rgba 三元组形态(由上方 hex 派生)
  ['83,163,242', '99,179,255'],
  ['66,132,197', '121,182,244'],
  ['0,161,102', '86,210,152'],
  ['127,118,220', '175,171,255'],
  ['213,131,0', '247,172,77'],
  ['222,59,61', '255,111,105'],
  ['100,116,139', '148,163,184'],
  ['219,39,119', '244,114,182'],
  ['0,186,162', '0,202,177'],
  ['185,132,223', '201,148,240'],
  ['221,135,54', '238,151,72'],
  // note 便签粉彩字面量(亮一档,alpha 不变)
  ['234,179,8', '253,224,71'],
  ['34,197,94', '74,222,128'],
  ['59,130,246', '96,165,250'],
  ['236,72,153', '244,114,182'],
  ['168,85,247', '192,132,252'],
  // 卡片描边 --line-color 深色形态
  ['rgba(0,0,0,0.1)', 'rgba(255,255,255,0.1)'],
]

export function applyXhhaoDarkPalette(html: string): string {
  if (!html) {
    return html
  }
  let out = html
  for (const [from, to] of XHHAO_DARK_PAIRS) {
    out = out.split(from).join(to)
  }
  return out
}
