<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { collectSiteDefaults } from '@/utils/preference'
import { useMaintenanceIntercept } from '@/hooks/useMaintenanceIntercept'
import { waitForUpgradeCheck } from '@/utils/checkUpdate'

definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '正在初始化...',
  },
})

/* ---------------- 常量 ---------------- */
const homePagePath = '/pages/tabbar/home/home'

// 本地开发快速跳转页面,发布请置为 false
const DEV_MODE = false
const DEV_TO_TYPE = 'page' as 'page' | 'tabbar'
const DEV_TO_PATH = `/pages-blog/love/love`

/* ---------------- 状态 ---------------- */
const appConfigStore = useAppConfigStore()
const { configs } = storeToRefs(appConfigStore)
const { bootstrap } = appConfigStore
const { applySiteDefaults } = useSettingStore()
// 维护拦截
const { reason, interceptOrContinue, redirectToMaintenance } = useMaintenanceIntercept()

const entering = ref(false)

/** 初始化并进入应用(启动页加载与"进入应用"按钮共用) */
async function enterApp() {
  if (entering.value)
    return
  entering.value = true
  try {
    // 有升级时等升级弹窗关闭后再继续
    await waitForUpgradeCheck()

    // 获取配置
    const { ok } = await bootstrap()
    if (!ok) {
      uni.switchTab({ url: homePagePath })
      return
    }

    // 审核模式数据已随 bootstrap 拉取
    applySiteDefaults(collectSiteDefaults(configs.value))

    // 拦截:主插件未激活 或 维护模式开启(任一命中)→ 跳转维护页
    if (await interceptOrContinue()) {
      return
    }
    uni.switchTab({ url: homePagePath })
  }
  catch (err) {
    console.error('入口页初始化失败', err)
    redirectToMaintenance(reason.value)
  }
  finally {
    entering.value = false
  }
}

onLoad(async () => {
  // 本地开发,快速跳转页面,发布请设置 DEV_MODE = false
  if (DEV_MODE && DEV_TO_PATH) {
    if (DEV_TO_TYPE === 'tabbar') {
      uni.switchTab({ url: DEV_TO_PATH })
    }
    else {
      uni.navigateTo({
        animationType: 'fade-in',
        url: DEV_TO_PATH,
      })
    }
    return
  }

  enterApp()
})
</script>

<template>
  <view class="relative min-h-screen w-screen flex flex-col items-center justify-center overflow-hidden bg-page">
    <view
      class="fixed left-0 top-0 z-0 h-[46vh] w-full uh-auth-wash"
    />

    <view
      class="breathe uh-blur-52 pointer-events-none absolute left-[-60rpx] top-[16vh] z-0 h-[260rpx] w-[260rpx] rounded-full bg-white/40"
    />
    <view
      class="uh-blur-52 pointer-events-none absolute right-[-48rpx] top-[8vh] z-0 h-[200rpx] w-[200rpx] rounded-full bg-[rgba(83,163,242,0.28)]"
    />
    <view
      class="uh-blur-52 pointer-events-none absolute bottom-[14vh] right-[72rpx] z-0 h-[160rpx] w-[160rpx] rounded-full bg-white/40"
    />
    <view
      class="uh-blur-52 pointer-events-none absolute bottom-[6vh] left-[48rpx] z-0 h-[140rpx] w-[140rpx] rounded-full uh-deco-blob opacity-90"
    />

    <view class="relative z-10 h-28 w-28">
      <view
        class="bob uh-global-card-glass absolute inset-0 flex items-center justify-center border-4 border-white rounded-full border-solid uh-logo-ring"
      >
        <!-- 第五轮 #18:启动加载图换羽化大肥鱼头(与 uh-data-loading 加载态同图) -->
        <image src="/static/mascot/dafeiyu-head.png" mode="aspectFit" class="h-[160rpx] w-[160rpx]" />
      </view>
    </view>

    <view class="relative z-10 mt-8 text-lg font-black leading-8">
      <uh-text-underline>正在初始化...</uh-text-underline>
    </view>
    <view class="mt-4 flex flex-col items-center">
      <text class="text-center text-xs text-gray-600 font-medium leading-6">
        稍等，正在加载所需要的资源
        <text class="block">
          马上就好~
        </text>
      </text>
    </view>

    <uh-button
      custom-class="mt-6 uh-global-button-glass !shadow-none !border !rounded-full text-sm !px-6 !border !py-2 !bg-primary !text-gray-900"
      @click="enterApp"
    >
      进入应用
    </uh-button>
  </view>
</template>

<style scoped lang="scss">
.uh-blur-52 {
  filter: blur(52rpx);
}

/* 光斑呼吸 */
.breathe {
  animation: breathe 5s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.28;
  }

  50% {
    transform: scale(1.18);
    opacity: 0.4;
  }
}

/* 表情圆浮动 */
.bob {
  animation: bob 3.2s ease-in-out infinite;
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }

  50% {
    transform: translateY(-14rpx) rotate(2deg);
  }
}
</style>
