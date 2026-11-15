<script setup lang="ts">
interface IProps {
  position?: 'left' | 'right'
}

const props = withDefaults(defineProps<IProps>(), {
  position: 'left',
})

/* 装饰条与标题留白类(第四轮 #16:对齐博客本体左竖条几何,见模板注释) */
const decorationClass = computed(() => {
  return props.position === 'left' ? '-left-4' : '-right-4'
})

const titleClass = computed(() => {
  return props.position === 'left' ? 'ml-5' : 'mr-5'
})
</script>

<template>
  <view class="w-full flex items-center justify-between">
    <view class="relative shrink-0" :class="titleClass">
      <text class="text-2xs font-bold text-gray-900">
        <slot />
      </text>
      <!-- 第四轮 #16:装饰条对齐博客 Ethereal 本体(WidgetLayout / MainGridLayout 分区标题):
           标题外侧竖条——w-1(8rpx=4px)× h-4(32rpx=16px)、rounded-md(12rpx=6px)、主色 bg-primary
           (随主题双套变量翻色),垂直居中于字身,落在标题留白(ml-5=40rpx)内,条右缘距字 24rpx=博客的 12px。
           原实现是压字横条(w-4/5 × h-2=16rpx、-bottom-0.5、bg-secondary):条骑在字身下半截、
           左端探出字外,深色下尤其明显,已废弃。标题字色 text-gray-900 对齐本体 neutral-900(深色经灰阶重映射翻浅) -->
      <view class="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-md bg-primary" :class="decorationClass" />
    </view>
    <view class="flex flex-1 items-center justify-end">
      <slot name="right" />
    </view>
  </view>
</template>
