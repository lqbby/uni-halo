<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getBlogStatistics } from '@/api/halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { useLoveModuleUnlock } from '@/hooks/useLoveModuleUnlock'
import { checkUpdates } from '@/utils/checkUpdate'
import { checkAvatarUrl, checkImageUrl } from '@/utils/url'
import { getAvatarFallbackText } from '@/utils/avatar'
import { sanitizeBrandingText } from '@/utils/branding'
import { t } from '@/locale'
import { usePageScroll } from '@/hooks/usePageScroll'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDialog } from '@wot-ui/ui'
import { DIALOG_CANCEL_BUTTON_PROPS, DIALOG_CONFIRM_BUTTON_PROPS } from '@/config/dialog'
import type { IBlogStats } from '@/api/types/halo'

const dialog = useDialog()

definePage({
  style: {
    navigationBarTitleText: '博主',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const { configs } = storeToRefs(useAppConfigStore())
const tokenStore = useTokenStore()
const userStore = useUserStore()
const { scrollY, updatePageScrollValue } = usePageScroll()
/** 页面标题（插件端可配置，留空回退内置默认） */
const pageTitle = usePageTitle('blogger', '关于博主')

const haloConfigs = computed(() => configs.value)
/** 登录态(进入页面时刷新过期判断) */
const hasLogin = computed(() => tokenStore.updateNowTime().hasLogin)

/* ---------- 登录配置---------- */
const loginConfig = computed(() => configs.value.loginConfig?.client)
const loginEntryVisible = computed(() =>
  loginConfig.value?.passwordLoginEnabled !== false
  || loginConfig.value?.wechatLoginEnabled === true)

/* ---------------- 计算属性 ---------------- */
const bloggerInfo = computed(() => {
  const blogger = haloConfigs.value.featureConfig?.profile?.blogger as
    | { nickname?: string, avatar?: string, description?: string }
    | undefined
  return {
    nickname: blogger?.nickname || '',
    avatar: checkAvatarUrl(blogger?.avatar),
    description: blogger?.description || '',
  }
})
const showComment = computed(() => haloConfigs.value.featureConfig?.pages?.postDetail?.showComment)
const pageConfig = computed(() => haloConfigs.value.featureConfig?.pages?.blogger as
  | { bgImageUrl?: string, waveImageUrl?: string, commonFeaturesMode?: 'grid' | 'list' }
  | undefined)

/**
 * 插件自带演示素材判定(复验轮 #10):插件 assets/static 下是上游演示图
 * (uni_halo_profile_bg.jpeg 黄绿背景 / uni_halo_about_wave.gif),
 * 哥哥未在插件后台换成自己的图之前按「未配置」处理,不渲染演示图。
 */
function isPluginDemoAsset(url?: string): boolean {
  return !!url && url.includes('/plugins/uni-halo/assets/')
}

/** 头部背景图:演示素材视为未配置(回退主题渐变),哥哥在插件后台换成自己的图后自动生效 */
const calcBgImageUrl = computed(() => {
  const url = pageConfig.value?.bgImageUrl
  return url && !isPluginDemoAsset(url) ? checkImageUrl(url) : ''
})

/** 波浪图:同上,演示素材不渲染 */
const calcWaveImageUrl = computed(() => {
  const url = pageConfig.value?.waveImageUrl
  return url && !isPluginDemoAsset(url) ? checkImageUrl(url) : ''
})

/* ---------------- 分享 ---------------- */

onShareAppMessage(() => ({
  title: `${bloggerInfo.value.nickname}`,
  path: '/pages/tabbar/blogger/blogger',
  imageUrl: bloggerInfo.value.avatar,
}))

onShareTimeline(() => ({
  title: `${bloggerInfo.value.nickname}`,
  query: '',
  imageUrl: bloggerInfo.value.avatar,
}))

/* ---------------- 状态 ---------------- */
const statistics = ref<IBlogStats>({ post: 0, comment: 0, category: 0, visit: 0, upvote: 0 })

/** 主行统计 */
const allStats = computed(() => [
  { key: 'post', label: '内容', value: statistics.value.post, visible: true },
  { key: 'visit', label: '访客', value: statistics.value.visit, visible: true },
  { key: 'category', label: '分类', value: statistics.value.category, visible: true },
  { key: 'comment', label: '评论', value: statistics.value.comment, visible: showComment.value },
  { key: 'upvote', label: '点赞', value: statistics.value.upvote, visible: true },
].filter(item => item.visible))

interface INavIconStyle {
  /** 风格标识（animal-font=动物字体 / emoji-font=emoji 字体 / ri=remixicon） */
  key: string
  prefix: string
  iconName: string
}

interface INavItem {
  key: string
  title: string
  /** 图标风格集合 */
  icons?: INavIconStyle[]
  /** 当前生效风格 key，缺省取 icons[0] */
  iconMode?: string
  iconColor?: string
  bgColor: string
  color?: string
  subTitle?: string
  path: string | null
  openType?: string
  show: boolean
  group: 'blog' | 'more'
}

interface IMyPageEntry {
  key?: string
  title?: string
  subTitle?: string
  color?: string
  iconColor?: string
  bgColor?: string
  iconPrefix?: string
  icon?: string
  icons?: INavIconStyle[]
  iconMode?: string
  path?: string
  visible?: boolean
}

const configuredFeatures = computed(() => {
  const mp = haloConfigs.value.featureConfig?.pages?.mine as
    | { commonFeatures?: IMyPageEntry[], otherFeatures?: IMyPageEntry[] }
    | undefined
  if (!mp || (!mp.commonFeatures?.length && !mp.otherFeatures?.length)) {
    return null
  }
  return mp
})

/** 当前应用版本号 */
function getAppVersion() {
  return `v${uni.getAppBaseInfo().appVersion || ''}`
}

/** 应用版本固定项(点击检查更新) */
const appVersionItem: INavItem = {
  key: 'app-version',
  title: '应用版本',
  icons: [{ key: 'ri', prefix: 'ri', iconName: 'information-2-line' }],
  color: '#a1887f',
  iconColor: '#a1887f',
  bgColor: '#a1887f24',
  subTitle: getAppVersion(),
  path: null,
  show: true,
  group: 'more',
}

/**
 * 解析条目当前生效的图标风格（iconMode 优先，缺省取 icons[0]）
 * 呈现归口（换肤第八轮 #20 ①组，与首页快捷导航对齐）：图标走配置（服务端已统一切 ri 线性套），
 * 颜色由代码统一主题主色——条目的逐项 bgColor/color 不再消费（后台表达不了全员统一主题色）。
 */
function resolveNavItemIcon(item: INavItem): INavIconStyle | null {
  if (!item.icons?.length) {
    return null
  }
  return item.icons.find(i => i.key === item.iconMode) ?? item.icons[0]
}

function handleAppVersion() {
  checkUpdates(true)
}

const navList = ref<INavItem[]>([])
/**
 * 常用功能显示方式(插件端「功能设置 → 页面设置 → 关于页」配置,缺省网格;
 * 切为列表时常用/其他功能均为分组列表,并恢复站点统计卡片展示)
 */
const featureMode = computed<'grid' | 'list'>(() =>
  pageConfig.value?.commonFeaturesMode === 'list' ? 'list' : 'grid',
)

/** 分组渲染(过滤后空组整组隐藏；组标题按常用功能/其他功能分组) */
const calcNavGroups = computed(() => {
  const visible = [...navList.value.filter(n => n.show)]
  const groupDefs: { key: 'blog' | 'more', title: string }[] = [
    { key: 'blog', title: '常用功能' },
    { key: 'more', title: '其他功能' },
  ]
  return groupDefs
    .map(def => ({ ...def, items: visible.filter(n => n.group === def.key) }))
    .filter(group => group.items.length > 0)
    .map(group => group.key === 'more' ? { ...group, items: [...group.items].sort(n => n.key === 'app-version' ? 1 : -1) } : group)
})

const commonFeatures = computed(() => {
  return navList.value.filter(f => f.show && f.group === 'blog')
})
const otherFeatures = computed(() => {
  return [...navList.value.filter(f => f.show && f.group === 'more'), appVersionItem]
})

/* ---------------- 功能导航 ---------------- */

async function handleGetNavList() {
  // 配置模式：插件端 mine 两组（常用功能→blog、其他功能→more）
  const mp = configuredFeatures.value
  if (mp) {
    const mapEntry = (e: IMyPageEntry, group: 'blog' | 'more'): INavItem | null => {
      if (!e.key) {
        return null
      }
      return {
        key: e.key,
        title: e.title || '',
        icons: e.icons?.length ? e.icons : (e.icon ? [{ key: 'emoji-font', prefix: e.iconPrefix || '', iconName: e.icon }] : undefined),
        iconMode: e.iconMode,
        bgColor: e.bgColor || '#969696F2',
        color: e.color,
        iconColor: e.iconColor,
        /* 复验轮 #14:副标题是插件端下发文案,演示值含上游作者名(「小莫唐尼的开源项目」)时按未配置处理、不显示 */
        subTitle: sanitizeBrandingText(e.subTitle),
        path: e.path || null,
        show: e.visible !== false,
        group,
      }
    }
    navList.value = [
      ...(mp.commonFeatures || []).map(e => mapEntry(e, 'blog')).filter((n): n is INavItem => n !== null),
      ...(mp.otherFeatures || []).map(e => mapEntry(e, 'more')).filter((n): n is INavItem => n !== null),
    ]
    return
  }
  navList.value = []
}

/* ---------------- 数据加载 ---------------- */
async function handleGetData() {
  try {
    const res = await getBlogStatistics()
    statistics.value = res.data
  }
  catch (err) {
    uni.showToast({ icon: 'none', title: t('common.loadFailedRetry') })
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

/* ---------------- 交互 ---------------- */
/* 恋爱模块解锁拦截(目前仅恋爱日记设密码,命中锁定则先解锁再跳转;样式不变) */
const {
  unlockModalVisible,
  unlockTip,
  handleUnlockRequest,
  handleUnlockSuccess,
  interceptNavigateByPath,
} = useLoveModuleUnlock()

function handleNavGoTo(data: { path: string }) {
  const { path } = data
  if (!path) {
    return
  }

  // 命中恋爱模块且锁定 → 弹解锁弹窗,解锁成功后由 hook 自动跳转
  if (interceptNavigateByPath(path)) {
    return
  }

  uni.navigateTo({ url: path })
}

/** 前往登录页 */
function handleGoLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

/** 登录入口点击:未登录去登录页,已登录则询问退出 */
function handleLoginEntry() {
  if (!hasLogin.value) {
    handleGoLogin()
    return
  }
  dialog.confirm({
    title: '提示',
    msg: '确定退出登录吗？',
    zIndex: 9999,
    confirmButtonProps: DIALOG_CONFIRM_BUTTON_PROPS,
    cancelButtonProps: DIALOG_CANCEL_BUTTON_PROPS,
  }).then(() => {
    tokenStore.logout()
  }).catch(() => {})
}

/* ---------------- 生命周期 ---------------- */
watch(haloConfigs, () => {
  handleGetNavList()
}, { deep: true, immediate: true })

handleGetData()

// 从登录页返回时刷新登录态展示
onShow(() => {
  tokenStore.updateNowTime()
})

onPullDownRefresh(() => {
  handleGetData()
})

onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})
</script>

<template>
  <wd-dialog />
  <view class="box-border min-h-screen w-screen bg-page pb-2">
    <uh-mine-navbar :scroll-y="scrollY" :default-title="pageTitle" />

    <!-- 头部背景(背景图 + 遮罩 + wave;博主信息移入下方身份卡。无自配背景图时走主题双套渐变,复验轮 #10) -->
    <view class="relative h-80 w-full" :class="calcBgImageUrl ? '' : 'uh-blogger-hero-bg'">
      <image
        v-if="calcBgImageUrl"
        :src="calcBgImageUrl"
        class="absolute left-0 top-0 z-0 h-full w-full"
        mode="aspectFill"
        lazy-load
      />

      <!-- 遮罩 -->
      <view class="absolute left-0 top-0 z-1 h-full w-full bg-white/5" style="backdrop-filter:blur(4rpx)" />
      <image
        v-if="calcWaveImageUrl" :src="calcWaveImageUrl" mode="scaleToFill"
        class="gif-wave absolute bottom-0 left-0 z-10 h-18 w-full" style="mix-blend-mode: screen;"
      />
      <!-- 过渡 -->
      <view class="absolute bottom-0 left-0 z-10 h-18 w-full from-black/0 to-page bg-gradient-to-b" />
    </view>

    <!-- 博主身份卡(换肤一期 Q8=C:仿博客关于页身份卡;数据走现有 bloggerInfo + 站点统计,两种功能模式都显示) -->
    <view class="uh-global-card-glass uh-shadow-xs relative z-20 mx-4 rounded-3xl p-5 -mt-24">
      <view class="flex items-center gap-4">
        <wd-avatar
          :src="bloggerInfo.avatar"
          :text="getAvatarFallbackText(bloggerInfo.nickname)"
          shape="round"
          custom-class="!h-16 !w-16 !font-bold !text-xl"
          mode="aspectFill"
        />
        <view class="min-w-0 flex-1">
          <view class="truncate text-lg text-gray-900 font-bold">
            {{ bloggerInfo.nickname }}
          </view>
          <view class="mt-1 line-clamp-2 text-xs text-gray-500 leading-5">
            {{ bloggerInfo.description || '这个博主很懒，竟然没写介绍~' }}
          </view>
        </view>
      </view>
      <view class="my-4 border-t border-black/5 border-t-solid" />
      <view class="flex">
        <view v-for="item in allStats" :key="item.key" class="flex-1 text-center">
          <view class="text-lg text-gray-900 font-bold">
            {{ item.value }}
          </view>
          <view class="mt-0.5 text-xs text-gray-500">
            {{ item.label }}
          </view>
        </view>
      </view>
    </view>

    <!-- 功能导航：非分组模式 -->
    <template v-if="featureMode === 'grid'">
      <view v-if="commonFeatures.length !== 0" class="relative z-10 box-border overflow-hidden p-4">
        <view class="uh-global-card-glass uh-shadow-xs grid grid-cols-5 box-border gap-3.5 border rounded-3xl p-4">
          <view
            v-for="(nav) in commonFeatures" :key="nav.key"
            class="flex flex-col items-center justify-between"
            @click="nav.key === 'app-version' ? handleAppVersion() : handleNavGoTo(nav)"
          >
            <view
              class="uh-global-card-glass uh-shadow-xs h-12 w-12 flex items-center justify-center border rounded-2xl"
            >
              <wd-icon :class-prefix="resolveNavItemIcon(nav)?.prefix" :name="resolveNavItemIcon(nav)?.iconName" size="52rpx" color="var(--eth-primary)" />
            </view>
            <text class="mt-1 w-full truncate text-center text-xs text-gray-900">
              {{ nav.title }}
            </text>
          </view>
        </view>
      </view>
      <template v-if="otherFeatures.length !== 0">
        <view class="mb-3 mt-2 box-border px-4">
          <uh-section-title>
            其他功能
          </uh-section-title>
        </view>
        <view class="uh-global-card-glass uh-shadow-xs mx-4 overflow-hidden rounded-2xl">
          <view
            v-for="(nav, index) in otherFeatures" :key="nav.key"
            class="flex items-center justify-between px-4"
            :class="index < otherFeatures.length - 1 ? 'border-b border-b-solid border-black/5' : ''"
            @click="handleNavGoTo(nav)"
          >
            <view class="nav-left flex items-center gap-3 py-2.5">
              <view
                class="uh-global-card-glass uh-shadow-xs h-8 w-8 flex items-center justify-center border rounded-xl"
              >
                <wd-icon :class-prefix="resolveNavItemIcon(nav)?.prefix" :name="resolveNavItemIcon(nav)?.iconName" size="36rpx" color="var(--eth-primary)" />
              </view>
              <text class="nav-title text-sm text-gray-900">
                {{ nav.title }}
              </text>
            </view>
            <view class="nav-right flex items-center gap-2">
              <text class="nav-right-text text-xs text-gray-400">{{ nav.subTitle }}</text>
              <wd-icon name="arrow-right" size="24rpx" class="text-gray-400" />
            </view>
          </view>
        </view>
      </template>
    </template>

    <!-- 功能导航：分组模式 -->
    <template v-else-if="featureMode === 'list'">
      <template v-for="group in calcNavGroups" :key="group.key">
        <view class="mb-3 mt-3 box-border px-4">
          <uh-section-title>
            {{ group.title }}
          </uh-section-title>
        </view>
        <view class="uh-global-card-glass uh-shadow-xs mx-4 overflow-hidden rounded-2xl">
          <view
            v-for="(nav, index) in group.items" :key="nav.key"
            class="nav-item flex items-center justify-between px-4"
            :class="index < group.items.length - 1 ? 'border-b border-b-solid border-black/5' : ''"
            @click="nav.key === 'app-version' ? handleAppVersion() : handleNavGoTo(nav)"
          >
            <view class="nav-left flex items-center gap-3 py-2.5">
              <view
                class="uh-global-card-glass uh-shadow-xs h-8 w-8 flex items-center justify-center border rounded-xl"
              >
                <wd-icon :class-prefix="resolveNavItemIcon(nav)?.prefix" :name="resolveNavItemIcon(nav)?.iconName" size="36rpx" color="var(--eth-primary)" />
              </view>
              <text class="nav-title text-sm text-gray-900">
                {{ nav.title }}
              </text>
            </view>
            <view class="nav-right flex items-center gap-2">
              <text class="nav-right-text text-xs text-gray-400">{{ nav.subTitle }}</text>
              <wd-icon name="arrow-right" size="24rpx" class="text-gray-400" />
            </view>
          </view>
        </view>
      </template>
    </template>

    <!-- 登录入口(任一登录方式开启才显示) -->
    <view v-if="loginEntryVisible" class="box-border flex justify-center px-4 pt-6" @click="handleLoginEntry">
      <uh-button class="w-full flex-1" :custom-class="`uh-global-card-glass uh-shadow-xs !rounded-full !py-2.5 !text-3xs ${hasLogin ? '!bg-red-400 !text-white' : '!bg-primary'}`">
        {{ hasLogin ? `退出登录${userStore.userInfo.nickname ? `(${userStore.userInfo.nickname})` : ''}` : '登录' }}
      </uh-button>
    </view>

    <uh-page-copyright />

    <!-- 恋爱模块解锁弹窗(解锁成功自动跳转) -->
    <uh-unlock-popup
      v-model:show="unlockModalVisible" title="请解锁" captcha-enabled
      :tip="unlockTip" placeholder="请输入密码" confirm-text="进入" :request="handleUnlockRequest"
      @success="handleUnlockSuccess"
    />
  </view>
</template>
