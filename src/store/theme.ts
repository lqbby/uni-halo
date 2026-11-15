import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 外观主题 store(换肤一期 Q1=B:明暗双套跟随系统)
 *
 * 本 store 只负责 JS 侧的主题状态,供无法靠 CSS 媒体查询解决的场景消费:
 * - 文章正文:mp-html 的 tagStyle 与转换器色值映射需按当前外观计算;
 * - 自定义导航栏:半透明底色需按外观选黑/白基底;
 * - 首页头图:博客 Banner 有浅/深两张图,按外观切换。
 *
 * 页面样式层不依赖本 store:WXSS 的 @media (prefers-color-scheme: dark)
 * + page 上的 CSS 变量双套(见 src/style/index.scss)负责跟随系统。
 * 状态由 App.vue 的 onLaunch/onThemeChange 同步,初值同步读一次系统外观。
 */
export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false)

  function setDark(value: boolean) {
    isDark.value = value
  }

  /** 从系统读取当前外观(微信 darkmode 下 getAppBaseInfo().theme 为 'light' | 'dark',其余平台为空) */
  function syncFromSystem() {
    try {
      const theme = uni.getAppBaseInfo().theme
      if (theme === 'dark' || theme === 'light') {
        isDark.value = theme === 'dark'
      }
    }
    catch {
      // 非微信端或旧基础库读不到外观时保持浅色
    }
  }

  syncFromSystem()

  return { isDark, setDark, syncFromSystem }
})
