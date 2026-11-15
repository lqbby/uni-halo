<script setup lang="ts">
import type { CustomTabBarItem } from './types'
import { storeToRefs } from 'pinia'
import { getI18nText } from './i18n'
import { tabbarStore } from './store'
import { useThemeStore } from '@/store/theme'

const props = defineProps<{
  item: CustomTabBarItem
  index: number
  customClass?: string
}>()

function getImageByIndex(index: number, item: CustomTabBarItem) {
  if (!item.iconActive) {
    console.warn('image 模式下，需要配置 iconActive (高亮时的图片），否则无法切换高亮图片')
    return item.icon
  }
  return tabbarStore.curIdx === index ? item.iconActive : item.icon
}

function isActive(index: number) {
  return tabbarStore.curIdx === index
}

const { isDark } = storeToRefs(useThemeStore())

/** uiLib 图标色:按选中态 × 外观直接给十六进制(与 --eth-* 双套同值,不走 var 解析) */
function iconColor(index: number) {
  if (isActive(index)) {
    return isDark.value ? '#63B3FF' : '#53A3F2'
  }
  return isDark.value ? '#8FA1B5' : '#303133'
}

const useTitle = ref(false)

const _customClass = computed(() => {
  return `${props.customClass} ${useTitle.value ? 'py-0.5' : 'py-2'}`
})
</script>

<template>
  <view class="box-border flex flex-col items-center justify-center overflow-hidden rounded-full px-3" :class="_customClass">
    <template v-if="item.iconType === 'uiLib'">
      <wd-icon :name="item.icon" size="52rpx" :color="iconColor(index)" />
    </template>
    <template v-if="item.iconType === 'unocss' || item.iconType === 'iconfont'">
      <view class="flex-1 text-26px" :class="[item.icon]" />
    </template>
    <template v-if="item.iconType === 'image'">
      <image
        :src="getImageByIndex(index, item)" mode="scaleToFill"
        class="shrink-0"
        :class="[useTitle ? 'w-6 h-6' : 'w-7 h-7']"
      />
    </template>
    <view v-if="useTitle" class="mt-1px shrink-0 text-10px">
      {{ getI18nText(item.text) }}
    </view>
    <!-- 角标显示 -->
    <view v-if="item.badge">
      <template v-if="item.badge === 'dot'">
        <view class="absolute right-0 h-2 w-2 rounded-full bg-red-400 -top-2" />
      </template>
      <template v-else>
        <view class="absolute z-20 box-border h-5 min-w-5 center rounded-full bg-red-400 px-1 text-center text-xs text-white -right-2 -top-2">
          {{ item.badge > 99 ? '99+' : item.badge }}
        </view>
      </template>
    </view>
  </view>
</template>
