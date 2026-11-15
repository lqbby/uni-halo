<script lang="ts" setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { getPostList } from '@/api/halo'
import { checkThumbnailUrl } from '@/utils/url'
import { useAppConfigStore } from '@/store/appConfig'
import { sleep } from '@/utils/common'

const { configs } = storeToRefs(useAppConfigStore())

const loading = ref<'loading' | 'success' | 'error'>('loading')

interface ISeriesEntry {
  name: string
  count: number
  /** 系列封面:取该系列最新一篇文章的封面(系列本身在博客侧无独立封面字段) */
  cover: string
  latestPublishTime: string
}

const seriesList = ref<ISeriesEntry[]>([])

/**
 * 与原精选分类共用插件端的版块开关(版块位置与显隐策略不变,只是内容换成系列)。
 * 语义对齐(换肤第八轮 #20 ①组归口):配置项 useCategory 本名「精选分类」开关,
 * 自 #2 系列版块取代分类版块起,该开关实际管辖的是本系列版块的显隐;
 * home.categories 已无消费方(死配置)。无独立配置面可迁,维持借用、仅此注明。
 */
const isEnableSeriesModule = computed(() => {
  return !!configs.value.featureConfig?.pages?.home?.useCategory
})

/**
 * 系列数据通路(2026-11-15 实证):博客主题的系列来自文章注解 metadata.annotations.series
 * (ethereal-companion 按注解分组渲染),Halo 内容 API 的文章列表原样带出该注解,
 * 故在端上按注解聚合即可:系列名 + 篇数 + 最新文章封面。
 */
async function handleGetSeriesList() {
  try {
    loading.value = 'loading'
    const res = await getPostList({ page: 1, size: 100 })
    const groups = new Map<string, ISeriesEntry>()
    for (const post of res.data.items || []) {
      const seriesName = post.metadata?.annotations?.series?.trim()
      if (!seriesName) {
        continue
      }
      const publishTime = post.spec?.publishTime || ''
      const existing = groups.get(seriesName)
      if (!existing) {
        groups.set(seriesName, {
          name: seriesName,
          count: 1,
          cover: checkThumbnailUrl(post.spec?.cover),
          latestPublishTime: publishTime,
        })
      }
      else {
        existing.count += 1
        // 列表默认按发布时间倒序:后遇到的更旧,只在封面缺失时用旧文封面兜底
        if (!existing.cover && post.spec?.cover) {
          existing.cover = checkThumbnailUrl(post.spec.cover)
        }
      }
    }
    seriesList.value = [...groups.values()].sort((a, b) => b.latestPublishTime.localeCompare(a.latestPublishTime))
    await sleep(300)
    loading.value = 'success'
  }
  catch (err) {
    console.error('获取系列失败', err)
    loading.value = 'error'
  }
}

function handleToArticlesPage() {
  uni.navigateTo({ url: '/pages-blog/articles/articles' })
}

function handleToSeries(entry: ISeriesEntry) {
  uni.navigateTo({
    url: `/pages-blog/series-articles/series-articles?series=${encodeURIComponent(entry.name)}`,
  })
}

onMounted(handleGetSeriesList)
</script>

<template>
  <view v-if="isEnableSeriesModule && (loading !== 'success' || seriesList.length)" class="mb-6 box-border px-3">
    <uh-section-title>
      系列
      <template #right>
        <view
          class="uh-global-card-glass uh-shadow-xs flex items-center justify-center border rounded-md p-1 text-gray-400"
          @click="handleToArticlesPage"
        >
          <wd-icon name="arrow-right" size="14px" />
        </view>
      </template>
    </uh-section-title>

    <view v-if="loading !== 'success'" class="mt-4 box-border">
      <view class="uh-global-card-glass rounded-xl shadow-none">
        <uh-data-loading
          :loading-status="loading" min-height="28vh" size="small" :use-refresh-button="true"
          @refresh="handleGetSeriesList()"
        />
      </view>
    </view>

    <view v-else class="grid grid-cols-2 mt-4 box-border w-full gap-2">
      <view
        v-for="entry in seriesList" :key="entry.name"
        class="uh-global-card-glass relative h-40 w-full overflow-hidden rounded-xl text-white"
        @click="handleToSeries(entry)"
      >
        <wd-img
          v-if="entry.cover" :src="entry.cover" class="h-full w-full" mode="aspectFill"
          lazy-load
        >
          <template #loading>
            <wd-loading size="64rpx" custom-class="text-primary" />
          </template>
        </wd-img>
        <!-- 系列内文章全无封面时的兜底:主题浅底 + 系列名首字,不用 emoji 占位 -->
        <view
          v-else
          class="uh-img-placeholder h-full w-full flex items-center justify-center"
        >
          <text class="text-4xl font-bold opacity-60">{{ entry.name.slice(0, 1) }}</text>
        </view>
        <view class="absolute left-2 top-2 z-2">
          <text class="uh-chip">系列</text>
        </view>
        <view class="absolute bottom-0 left-0 h-16 w-full from-black/0 to-black/30 bg-gradient-to-b" />
        <view class="absolute bottom-2 left-2 z-2 flex flex-col text-left">
          <text class="text-xs font-semibold">
            {{ entry.name }}
          </text>
          <text class="mt-1 text-xs text-gray-200">共 {{ entry.count }} 篇</text>
        </view>
      </view>
    </view>
  </view>
</template>
