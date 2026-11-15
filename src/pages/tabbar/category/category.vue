<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { getCategoryList, getPostList } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { checkThumbnailUrl } from '@/utils/url'
import { sleep } from '@/utils/common'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { DataLoadingStatusEnum, useDataLoadingStatus } from '@/hooks/useDataLoadingStatus'
import type { ICategory } from '@/api/types/halo'

definePage({
  style: {
    navigationBarTitleText: '分类',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
    backgroundColor: '@bgColor',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('category', '分类')

const appConfigStore = useAppConfigStore()

const { configs: haloConfigs, auditData, auditModeEnabled: calcAuditModeEnabled } = storeToRefs(appConfigStore)

const siteName = computed(() => haloConfigs.value.featureConfig?.profile?.appInfo?.name || 'LQBBY')

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  path: '/pages/tabbar/category/category',
}))

onShareTimeline(() => ({
  title: `${pageTitle.value} - ${siteName.value}`,
  query: '',
}))

/* ---------------- 状态 ---------------- */
const { loadingStatus, loadMoreStatus, updateLoadingStatus, updateLoadMoreStatus, resetLoadingStatus, resetLoadMoreStatus } = useDataLoadingStatus()
const queryParams = ref({
  size: 10,
  page: 1,
  fieldSelector: ['spec.hideFromList=false'],
})
const dataList = ref<ICategory[]>([])

/* ---------------- 分类封面兜底 ----------------
 * 实证(2026-11-15):Category.spec.cover 字段存在但 7 个分类全为空值,
 * 分类本身没有图。兜底:拉一次全量文章,按文章 spec.categories(分类 metadata.name)
 * 建「分类 → 该分类最新文章封面」映射,给无封面分类补图;只拉一次,分页复用。
 */
const postCoverMap = ref<Record<string, string>>({})
const postCoverMapLoaded = ref(false)

async function ensurePostCoverMap() {
  if (postCoverMapLoaded.value) {
    return
  }
  postCoverMapLoaded.value = true
  try {
    const res = await getPostList({ page: 1, size: 100 })
    const map: Record<string, string> = {}
    for (const post of res.data.items || []) {
      const cover = checkThumbnailUrl(post.spec?.cover, true)
      if (!cover) {
        continue
      }
      for (const categoryName of post.spec?.categories || []) {
        if (!map[categoryName]) {
          map[categoryName] = cover
        }
      }
    }
    postCoverMap.value = map
  }
  catch (err) {
    console.error('获取分类封面兜底失败', err)
  }
}

function handleResetInit() {
  dataList.value = []
  queryParams.value.page = 1
  resetLoadingStatus()
}

function handleInitPage() {
  handleResetInit()
  handleGetData()
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  if (!loadMoreStatus.value.active) {
    updateLoadingStatus(DataLoadingStatusEnum.Loading)
  }
  // 审核模式
  if (calcAuditModeEnabled.value) {
    resetLoadMoreStatus()
    const auditCategoryDetails = auditData.value.categoryDetails || []
    try {
      dataList.value = auditCategoryDetails.map(item => ({
        metadata: { name: item.name },
        spec: {
          displayName: item.title || item.name,
          slug: '',
          cover: checkThumbnailUrl(item.cover, true),
          priority: item.priority,
        },
        postCount: item.postCount ?? 0,
      } as ICategory))
      await sleep(600)
      updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
      updateLoadMoreStatus({
        active: false,
        status: 'noMore',
        hasNext: false,
      })
      uni.stopPullDownRefresh()
    }
    catch (err) {
      console.error(err)
      updateLoadingStatus(DataLoadingStatusEnum.Error)
    }
    return
  }

  try {
    const res = await getCategoryList({ ...queryParams.value })

    // 有分类缺封面时才拉兜底映射(分类自身 cover 全为空,见上方说明)
    if (res.data.items.some(item => !item.spec.cover)) {
      await ensurePostCoverMap()
    }

    const tempItems = res.data.items.map((item) => {
      const ownCover = checkThumbnailUrl(item.spec.cover, true)
      return {
        ...item,
        postCount: item.postCount ?? 0,
        spec: { ...item.spec, cover: ownCover || postCoverMap.value[item.metadata.name] || '' },
      }
    })

    dataList.value = loadMoreStatus.value.active
      ? dataList.value.concat(tempItems)
      : tempItems

    if (!loadMoreStatus.value.active) {
      await sleep(600)
      updateLoadingStatus(dataList.value.length === 0 ? DataLoadingStatusEnum.Empty : DataLoadingStatusEnum.Success)
    }

    updateLoadMoreStatus({
      active: false,
      status: res.data.hasNext ? 'loadMore' : 'noMore',
      hasNext: res.data.hasNext,
    })
  }
  catch (err) {
    console.error(err)
    if (loadMoreStatus.value.active) {
      updateLoadMoreStatus({
        active: false,
        status: 'error',
      })
    }
    else {
      updateLoadingStatus(DataLoadingStatusEnum.Error)
    }
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

function handleToCategory(category: ICategory) {
  if (calcAuditModeEnabled.value) {
    return
  }
  uni.navigateTo({
    url: `/pages-blog/category-articles/category-articles?name=${category.metadata.name}&title=${category.spec.displayName}`,
  })
}

onMounted(() => {
  handleInitPage()
})

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onPullDownRefresh(() => {
  handleResetInit()
  handleGetData()
})

onReachBottom(() => {
  // 如果正在请求，需要阻止继续发起请求
  if (loadMoreStatus.value.active && loadMoreStatus.value.status === 'loading') {
    return
  }
  // 有更多数据时，继续加载数据
  if (loadMoreStatus.value.hasNext) {
    queryParams.value.page += 1
    updateLoadMoreStatus({
      active: true,
      status: 'loading',
    })
    handleGetData()
  }
})
</script>

<template>
  <view class="box-border min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :use-back="false" :default-title="pageTitle" title-color="text-gray-900" />

    <uh-data-loading v-if="loadingStatus !== DataLoadingStatusEnum.Success" min-height="65vh" :loading-status="loadingStatus" />

    <block v-else>
      <view class="grid grid-cols-2 mt-3 box-border gap-3 p-3 pt-0">
        <view
          v-for="(item, index) in dataList" :key="index"
          class="uh-global-card-glass uh-shadow-xs box-border w-full overflow-hidden rounded-2xl"
          @click="handleToCategory(item)"
        >
          <!-- 封面:分类自身 cover 优先,缺失时已在数据层用该分类最新文章封面兜底 -->
          <view class="h-28 w-full overflow-hidden">
            <wd-img v-if="item.spec.cover" :src="item.spec.cover" class="block h-full w-full" mode="aspectFill" lazy-load>
              <template #loading>
                <wd-loading size="64rpx" custom-class="text-primary" />
              </template>
            </wd-img>
            <!-- 仍无图(分类下无文章):主题浅底 + 分类名首字,不用 emoji 占位 -->
            <view v-else class="uh-img-placeholder h-full w-full flex items-center justify-center">
              <text class="text-3xl font-bold opacity-60">{{ item.spec.displayName?.slice(0, 1) }}</text>
            </view>
          </view>
          <!-- 信息区:卡面实底上的主题排版(名称 + 篇数 + 主色箭头) -->
          <view class="box-border w-full flex items-center gap-2 px-3 py-2.5">
            <view class="min-w-0 flex flex-1 flex-col gap-0.5">
              <text class="truncate text-sm text-gray-900 font-bold">
                {{ item.spec.displayName }}
              </text>
              <text class="text-xs text-gray-500">
                共 {{ item.postCount ?? 0 }} 篇
              </text>
            </view>
            <wd-icon name="arrow-right" size="28rpx" class="shrink-0 text-primary" />
          </view>
        </view>
      </view>
      <uh-data-loadmore :status="loadMoreStatus.status" :text="loadMoreStatus.text" />
    </block>
  </view>
</template>
