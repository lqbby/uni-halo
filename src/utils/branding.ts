/**
 * 上游品牌文案守卫(复验轮 #14):
 * 插件配置由服务端运行时下发,哥哥未在插件后台改过的演示值里含上游作者/项目名
 * (如「小莫唐尼的开源项目」、copyright 里的 uni-halo)。这类字段代码侧按「未配置」处理:
 * 命中上游标记的用户可见文案一律换成 fallback,不让上游品牌漏到界面上;
 * 哥哥在插件后台改成自己的文案后不含标记,自动原样生效。
 */
const UPSTREAM_BRANDING_MARKERS = ['小莫唐尼', 'xiaoxiaomo', 'uni-halo', 'ialley']

/** 文案是否含上游品牌标记(大小写不敏感) */
export function hasUpstreamBranding(text?: string | null): boolean {
  if (!text) {
    return false
  }
  const lower = text.toLowerCase()
  return UPSTREAM_BRANDING_MARKERS.some(marker => lower.includes(marker))
}

/** 命中上游品牌标记时返回 fallback,否则原样返回 */
export function sanitizeBrandingText(text: string | undefined | null, fallback = ''): string {
  return text && !hasUpstreamBranding(text) ? text : fallback
}
