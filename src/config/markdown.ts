import { getEnvBaseUrl } from '@/utils'

const primaryColor = '#53A3F2'

export const markdownConfig = {
  domain: getEnvBaseUrl() || '',
  tagStyle: {
    table: `
      table-layout: fixed;
      border-collapse:collapse;
      margin-bottom: 18px;
      overflow: hidden;
      font-size: 13px;
      background: #f2f6fc;
      border: 1px solid #dcdcdc;
      border-radius: 4px;
    `,
    th: `
      padding: 8px;
    `,
    td: `
      padding: 8px;
    `,
    blockquote: `
      padding: 8px 15px;
      color: #606266;
	    background-color: rgb(255 255 255 / 55%);
      backdrop-filter: blur(24rpx) saturate(160%);
      -webkit-backdrop-filter: blur(24rpx) saturate(160%);
      border-left: 5px solid ${primaryColor};
      border-radius: 4px;
      line-height: 26px;
      margin-bottom: 18px;
	    box-shadow: 0 0px 12px rgba(0, 0, 0, 0.035);
    `,
    ul: 'padding-left: 15px;line-height: 1.85;',
    ol: 'padding-left: 15px;line-height: 1.85;',
    li: 'margin-bottom: 12px;line-height: 1.85;',
    h1: `
      margin: 24px 0 20px;
      color: ${primaryColor};
      line-height: 24px;
      position: relative;
      font-size:1.2em;
    `,
    h2: `
      color: ${primaryColor};
      line-height: 24px;
      position: relative;
      margin: 22px 0 16px;
      font-size: 1.16em;
    `,
    h3: `
      color: ${primaryColor};
      line-height: 24px;
      position: relative;
      margin: 20px 0 14px;
      font-size: 1.14em;
    `,
    h4: `
      color: ${primaryColor};
      line-height: 24px;
      margin-bottom: 18px;
      position: relative;
      font-size: 1.12em;
    `,
    h5: `
      color: ${primaryColor};
      line-height: 24px;
      margin-bottom: 14px;
      position: relative;
      font-size: 1.1em;
    `,
    h6: `
      color: ${primaryColor};
      line-height: 24px;
      margin-bottom: 14px;
      position: relative;
      font-size: 14px;
    `,
    p: `
      line-height: 1.65;
    `,
    code: '  ',
    strong: 'font-weight: 700;color: rgb(248, 57, 41);',
    img: 'border-radius: 10px',
    video: 'width: 100%',
  },
  containStyle: 'padding:0;background-color:transparent;',
  /* 复验轮 #11:mp-html 图片加载/失败占位换 Q 版大肥鱼(本地 static 路径,不走 checkImageUrl 补全);
     第三轮 #13:格式由 WebP 改 PNG——微信 iOS 端 <image> 对 WebP 解码不可靠(同图在 uh-data-loading
     直引也曾不显示),PNG 全端可靠;
     第四轮 #17:加载占位(loadingGif)换哥哥定稿的羽化透明头(480px 256 色量化约 77KB,羽化渐变
     目检无色带);失败占位(emptyGif)保持第三轮抱箱款不变——error-img 接通一事已取消,维持现状 */
  loadingGif: '/static/mascot/dafeiyu-head.png',
  emptyGif: '/static/mascot/dafeiyu-empty.png',
}

/**
 * 文章阅读页专用排版(第四轮:贴近 Ethereal 网页主题正文取值)
 * 色值全部来自主题源码 variables.css / markdown.css(oklch 已换算 sRGB,站点 hue=250):
 * 主色 --primary #53A3F2、正文深色 --deep-text #1A222B、次级蓝 --btn-content #3275B4、
 * 常规底 --btn-regular-bg #E2F0FF、链接虚线 --link-underline #D4EBFF、代码块底
 * --codeblock-bg #0A1016。字号取主题 markdown.css:h2 1.55em / h3 1.25em / h4 1.1em。
 * 仅文章详情与 banner 详情使用,不影响其他共用 markdownConfig 的页面。
 * 注意:code 只给字体栈——tagStyle 会被 mp-html 合并进高亮代码块的 code 节点,
 * 在那里加底色/字色会盖住 prism 配色(实证 parser.js parseStyle 合并逻辑)。
 */
export const articleMarkdownConfig = {
  ...markdownConfig,
  tagStyle: {
    ...markdownConfig.tagStyle,
    h1: 'font-size:1.7em;font-weight:800;line-height:1.3;color:#1A222B;margin:26px 0 16px;',
    h2: 'font-size:1.55em;font-weight:700;line-height:1.35;color:#53A3F2;margin:28px 0 12px;',
    h3: 'font-size:1.25em;font-weight:700;line-height:1.4;color:#1A222B;margin:24px 0 10px;',
    h4: 'font-size:1.1em;font-weight:700;line-height:1.4;color:#1A222B;margin:20px 0 8px;',
    h5: 'font-size:1em;font-weight:700;color:#1A222B;margin:18px 0 8px;',
    h6: 'font-size:0.9em;font-weight:700;color:#3275B4;margin:16px 0 8px;',
    p: 'line-height:1.75;',
    a: 'color:#53A3F2;font-weight:500;border-bottom:1px dashed #D4EBFF;',
    strong: 'font-weight:700;color:#53A3F2;',
    code: 'font-family:Menlo,Consolas,\'Courier New\',monospace;',
    pre: 'background:#0A1016;color:#FFFFFF;border-radius:12px;padding:14px 16px;margin:14px 0;',
    blockquote: 'background:rgba(83,163,242,0.06);border-left:3px solid #53A3F2;border-radius:10px;padding:10px 16px 10px 18px;color:#24394F;line-height:1.75;margin:16px 0;',
    table: 'table-layout:fixed;border-collapse:collapse;margin:14px 0 18px;font-size:13.5px;background:#FFFFFF;border:1px solid rgba(83,163,242,0.15);border-radius:12px;overflow:hidden;',
    th: 'background:#E2F0FF;color:#3275B4;font-weight:600;padding:8px 12px;border:1px solid rgba(83,163,242,0.15);',
    td: 'padding:8px 12px;border:1px solid rgba(83,163,242,0.15);',
    img: 'border-radius:12px;border:1px solid rgba(83,163,242,0.15);',
    hr: 'border:none;border-top:1px solid rgba(83,163,242,0.35);margin:26px 0;',
    ul: 'padding-left:15px;line-height:1.75;',
    ol: 'padding-left:15px;line-height:1.75;',
    li: 'margin-bottom:6px;line-height:1.75;',
  },
}

/**
 * 文章阅读页深色排版(换肤一期:接入主题深色套,与浅色版同结构只换色值)
 * 取值:variables.css :root.dark —— 主色 #63B3FF、--deep-text #C4CFDB、
 * --btn-content #7CB3EB、--btn-regular-bg #283747、--card-bg #181E24、
 * 链接虚线 --link-underline #224A71;代码块底 #0A1016 双套同值不变;
 * blockquote 字色为深色 deep-text 向主色混 18%(与浅色 #24394F 同法)。
 * 页面按 useThemeStore().isDark 在 articleMarkdownConfig 与本配置间切换。
 */
export const articleMarkdownConfigDark = {
  ...articleMarkdownConfig,
  tagStyle: {
    ...articleMarkdownConfig.tagStyle,
    h1: 'font-size:1.7em;font-weight:800;line-height:1.3;color:#C4CFDB;margin:26px 0 16px;',
    h2: 'font-size:1.55em;font-weight:700;line-height:1.35;color:#63B3FF;margin:28px 0 12px;',
    h3: 'font-size:1.25em;font-weight:700;line-height:1.4;color:#C4CFDB;margin:24px 0 10px;',
    h4: 'font-size:1.1em;font-weight:700;line-height:1.4;color:#C4CFDB;margin:20px 0 8px;',
    h5: 'font-size:1em;font-weight:700;color:#C4CFDB;margin:18px 0 8px;',
    h6: 'font-size:0.9em;font-weight:700;color:#7CB3EB;margin:16px 0 8px;',
    a: 'color:#63B3FF;font-weight:500;border-bottom:1px dashed #224A71;',
    strong: 'font-weight:700;color:#63B3FF;',
    blockquote: 'background:rgba(99,179,255,0.08);border-left:3px solid #63B3FF;border-radius:10px;padding:10px 16px 10px 18px;color:#B3CAE2;line-height:1.75;margin:16px 0;',
    table: 'table-layout:fixed;border-collapse:collapse;margin:14px 0 18px;font-size:13.5px;background:#181E24;border:1px solid rgba(99,179,255,0.15);border-radius:12px;overflow:hidden;',
    th: 'background:#283747;color:#7CB3EB;font-weight:600;padding:8px 12px;border:1px solid rgba(99,179,255,0.15);',
    td: 'padding:8px 12px;border:1px solid rgba(99,179,255,0.15);',
    img: 'border-radius:12px;border:1px solid rgba(99,179,255,0.15);',
    hr: 'border:none;border-top:1px solid rgba(99,179,255,0.35);margin:26px 0;',
  },
}

/** 按当前外观取文章正文 tagStyle(浅色=第四轮原配置,深色=主题深色套) */
export function getArticleTagStyle(isDark: boolean) {
  return isDark ? articleMarkdownConfigDark.tagStyle : articleMarkdownConfig.tagStyle
}

export const chatMarkdownConfig = {
  ...markdownConfig,
  tagStyle: {
    ...markdownConfig.tagStyle,
    p: `
      line-height: 1.65;
      margin-top: 0px;
      margin-bottom: 0px;
    `,
  },
}
