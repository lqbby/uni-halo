<script lang="ts" setup>
import { ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getPostList } from '@/api/halo'
import { sleep } from '@/utils/common'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import { usePageScroll } from '@/hooks/usePageScroll'
import type { IPost } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '系列',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
const { loadingStatus, updateLoadingStatus } = useDataLoadingStatus()
const seriesName = ref('')
const navbarTitle = ref('系列')
const dataList = ref<IPost[]>([])

/**
 * 系列文章列表:系列维度在博客侧只是文章注解(metadata.annotations.series),
 * 无独立接口,端上拉全量文章后按注解过滤;系列是连载体裁,按发布时间正序(从第一期读起)。
 */
async function handleGetData() {
  updateLoadingStatus(DataLoadingStatusEnum.Loading)
  try {
    const res = await getPostList({ page: 1, size: 100 })
    dataList.value = (res.data.items || [])
      .filter(post => post.metadata?.annotations?.series?.trim() === seriesName.value)
      .sort((a, b) => (a.spec?.publishTime || '').localeCompare(b.spec?.publishTime || ''))
    navbarTitle.value = `${seriesName.value}（共${dataList.value.length}篇）`
    await sleep(300)
    updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
  }
  catch (err) {
    console.error(err)
    updateLoadingStatus(DataLoadingStatusEnum.Error)
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

function handleToArticleDetail(article: IPost) {
  uni.navigateTo({
    url: `/pages-blog/article-detail/article-detail?name=${article.metadata.name}`,
    animationType: 'slide-in-right',
  })
}

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onLoad((options) => {
  seriesName.value = decodeURIComponent(options?.series || '')
  navbarTitle.value = seriesName.value || '系列'
  handleGetData()
})

onPullDownRefresh(() => {
  handleGetData()
})

onShareAppMessage(() => ({
  title: navbarTitle.value,
  path: `/pages-blog/series-articles/series-articles?series=${encodeURIComponent(seriesName.value)}`,
}))

onShareTimeline(() => ({
  title: navbarTitle.value,
  query: `series=${encodeURIComponent(seriesName.value)}`,
}))
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col bg-page">
    <!-- 自定义导航 -->
    <uh-navbar :scroll-y="scrollY" :default-title="navbarTitle" title-color="text-gray-900" />

    <!-- 加载/错误/空占位(状态机) -->
    <view v-if="loadingStatus !== 'success'">
      <uh-data-loading :loading-status="loadingStatus" empty-text="该系列下暂无文章" min-height="65vh" @refresh="handleGetData" />
    </view>

    <block v-else>
      <view class="box-border flex flex-col gap-y-3 p-3">
        <uh-article-card
          v-for="(article, index) in dataList" :key="index" :article="article"
          variant="list" @on-click="handleToArticleDetail"
        />
      </view>
    </block>
  </view>
</template>
