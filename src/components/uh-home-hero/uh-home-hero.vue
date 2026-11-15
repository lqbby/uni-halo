<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/store/theme'

/**
 * 首页头图(换肤一期 Q2=C / Q4=A:仿博客 Banner)
 * - 静态单图:用博客现行 Banner 的浅/深两张网络图(图床 tc.lqbby.com,不占包体),按系统外观切换;
 * - 站名/标语原文照博客:serif 标题 "Daily LQBBY Tips & Tricks" + 三行中文标语轮换;
 * - 磨砂按钮三枚与博客一致:关于 / 归档 / RSS(映射到 app 内页面,RSS 为复制订阅地址);
 * - 底部保留原轮播组件的悬浮搜索胶囊(跳搜索页),其余首页版块结构不变。
 * 旧 uh-home-banner(插件轮播)保留未删,仅首页不再引用。
 */
const BANNER_LIGHT = 'https://tc.lqbby.com/uploads/20260902/80c3bd411bf61cdfc433e7fdbf4965cd.webp'
const BANNER_DARK = 'https://tc.lqbby.com/uploads/20251125/82d6bef0f56aca32e246b14f03429d84.webp'
const SITE_TITLE = 'Daily LQBBY Tips & Tricks'
const SLOGANS = ['生而为人，爱而无畏', '心之所向，素履以往', '保持热爱，共赴山海']
const RSS_URL = 'https://www.lqbby.com/rss.xml'

const { isDark } = storeToRefs(useThemeStore())
const bannerSrc = computed(() => (isDark.value ? BANNER_DARK : BANNER_LIGHT))

/* 标语轮换(博客为 typewriter 轮播,小程序降级为定时淡换整行) */
const sloganIndex = ref(0)
let sloganTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  sloganTimer = setInterval(() => {
    sloganIndex.value = (sloganIndex.value + 1) % SLOGANS.length
  }, 4000)
})
onUnmounted(() => {
  if (sloganTimer) {
    clearInterval(sloganTimer)
    sloganTimer = null
  }
})

function handleAbout() {
  uni.switchTab({ url: '/pages/tabbar/blogger/blogger' })
}

function handleArchives() {
  uni.navigateTo({ url: '/pages-blog/archives/archives' })
}

function handleRss() {
  uni.setClipboardData({
    data: RSS_URL,
    success: () => {
      uni.showToast({ title: 'RSS 地址已复制', icon: 'none' })
    },
  })
}

function handleSearch() {
  uni.navigateTo({ url: '/pages-blog/search/search' })
}
</script>

<template>
  <view class="relative mb-12">
    <view class="relative h-[540rpx] overflow-hidden">
      <image :src="bannerSrc" mode="aspectFill" class="absolute inset-0 h-full w-full" />
      <!-- 底部渐隐到页面底色,与下方版块衔接(底色走变量双套) -->
      <view class="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-page" />

      <view class="relative z-1 flex flex-col items-center px-6 pt-safe">
        <text class="uh-serif mt-16 text-center text-[46rpx] text-white font-bold leading-snug uh-hero-shadow">
          {{ SITE_TITLE }}
        </text>
        <text class="uh-serif mt-4 text-center text-[27rpx] text-white/90 tracking-[0.2em] uh-hero-shadow">
          {{ SLOGANS[sloganIndex] }}
        </text>

        <!-- 磨砂按钮(与博客 Banner 三按钮同款:半透明白 + 背景模糊 + 描边) -->
        <view class="mt-8 flex items-center gap-3">
          <view class="uh-hero-btn" @click="handleAbout">
            关于
          </view>
          <view class="uh-hero-btn" @click="handleArchives">
            归档
          </view>
          <view class="uh-hero-btn" @click="handleRss">
            RSS
          </view>
        </view>
      </view>
    </view>

    <!-- 悬浮搜索胶囊(沿用原轮播的交互:点击跳搜索页) -->
    <view
      class="uh-global-card-glass absolute inset-x-3 z-2 flex items-center gap-2 rounded-full px-4 py-2.5 text-gray-400 -bottom-6"
      @click="handleSearch"
    >
      <wd-icon name="search-line" size="32rpx" />
      <text class="text-xs">
        搜索文章…
      </text>
    </view>
  </view>
</template>

<style scoped>
.uh-hero-shadow {
  text-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.45);
}

.uh-hero-btn {
  padding: 12rpx 36rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.45);
  background-color: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(12rpx);
  -webkit-backdrop-filter: blur(12rpx);
  color: #fff;
  font-size: 25rpx;
  line-height: 1.4;
}
</style>
