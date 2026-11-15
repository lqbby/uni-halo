<script lang="ts" setup>
import { onLoad, onPageScroll, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'
import { checkUrl } from '@/utils/url'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'

definePage({
  style: {
    navigationBarTitleText: '关于项目',
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('aboutProject', '关于项目')
const appConfigStore = useAppConfigStore()

const { configs } = storeToRefs(appConfigStore)

/**
 * 应用信息:优先插件端 appInfo 配置(与登录页同源),缺省回退本站信息 LQBBY + 本地 logo。
 * 复验轮 #10 附带:插件未配置前 appInfo 是上游演示值(name=uni-halo、logo=插件 assets 演示图),
 * 演示值按未配置处理;哥哥在插件后台改成自己的后自动生效。
 */
const appInfo = computed(() => {
  const info = configs.value.featureConfig?.profile?.appInfo
  const isDemoLogo = !!info?.logo && info.logo.includes('/plugins/uni-halo/assets/')
  const isDemoName = (info?.name || '').toLowerCase() === 'uni-halo'
  return {
    name: info?.name && !isDemoName ? info.name : 'LQBBY',
    logo: info?.logo && !isDemoLogo ? checkUrl(info.logo) : '/static/logo.png',
  }
})

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: pageTitle.value,
  path: '/pages-blog/about-project/about-project',
}))

onShareTimeline(() => ({
  title: pageTitle.value,
  query: '',
}))

const links = [
  { title: '博客主页', value: 'https://www.lqbby.com', copy: 'https://www.lqbby.com', tip: '博客地址已复制', tileColor: '#53A3F2', tileLetter: '博' },
  { title: 'GitHub', value: 'https://github.com/lqbby', copy: 'https://github.com/lqbby', tip: 'GitHub 地址已复制', tileColor: '#24292f', tileLetter: 'G' },
  { title: 'RSS 订阅', value: 'https://www.lqbby.com/rss.xml', copy: 'https://www.lqbby.com/rss.xml', tip: 'RSS 地址已复制', tileColor: '#DD8736', tileLetter: 'R' },
]

function copyText(content: string, tips: string) {
  uni.setClipboardData({
    data: content,
    showToast: false,
    success: () => {
      uni.showToast({ icon: 'none', title: tips })
    },
  })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad(() => {
  uni.setNavigationBarTitle({ title: '关于项目' })
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col gap-y-3 overflow-hidden bg-page px-3 pt-2 pb-safe">
    <!-- 自定义导航 -->
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <view class="uh-blur-xl fixed top-8 h-28 w-28 rounded-full bg-[rgba(83,163,242,0.22)] -right-8" />
    <view class="uh-blur-xl fixed top-36 h-24 w-24 rounded-full bg-[rgba(99,179,255,0.26)] -left-10" />

    <view class="flex-1">
      <view class="relative">
        <view
          class="uh-global-card-glass uh-shadow-xs relative flex flex-col items-center rounded-2xl px-6 pb-7 pt-10"
        >
          <image
            class="uh-global-card-glass uh-shadow-xs h-18 w-18 border rounded-2xl" :src="appInfo.logo"
            mode="aspectFill"
          />
          <view class="text- mt-4 text-xl font-bold">
            {{ appInfo.name }}
          </view>
          <view class="mt-3 flex items-center gap-2">
            <text class="uh-chip">LQBBY 博客</text>
            <text class="uh-chip">Halo 驱动</text>
          </view>
          <view class="mt-4 text-center text-xs text-gray-500 leading-relaxed">
            LQBBY 的个人博客小程序，同步展示博客的文章与动态
          </view>
        </view>
      </view>

      <view class="mb-3 mt-6">
        <uh-section-title> 相关链接 </uh-section-title>
      </view>

      <view class="uh-global-card-glass uh-shadow-xs box-border flex flex-col gap-y-6 rounded-2xl py-4">
        <view
          v-for="(link) in links" :key="link.title" class="flex items-center gap-3 px-4"
          @click="copyText(link.copy, link.tip)"
        >
          <view
            class="uh-global-card-glass uh-shadow-xs h-9 w-9 flex shrink-0 items-center justify-center border rounded-xl"
            :style="{ backgroundColor: `${link.tileColor}1A` }"
          >
            <text class="text-sm font-bold" :style="{ color: link.tileColor }">{{ link.tileLetter }}</text>
          </view>
          <view class="min-w-0 flex flex-1 flex-col justify-center gap-y-1">
            <text class="text-3xs text-gray-900 font-semibold" :style="{ color: link.tileColor }">
              {{
                link.title }}
            </text>
            <view class="truncate text-xs text-gray-400">
              {{ link.value }}
            </view>
          </view>
          <wd-icon name="copy" size="28rpx" class="shrink-0 text-primary" />
        </view>
      </view>
    </view>
    <view class="box-border shrink-0 pb-4">
      <uh-page-copyright />
    </view>
  </view>
</template>

<style scoped lang="scss">
.uh-blur-xl {
  filter: blur(20rpx);
}
</style>
