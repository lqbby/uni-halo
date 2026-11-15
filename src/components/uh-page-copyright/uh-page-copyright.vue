<script setup lang="ts">
	import { computed } from 'vue'
	import { storeToRefs } from 'pinia'
	import { useAppConfigStore } from '@/store/appConfig'
	import { sanitizeBrandingText } from '@/utils/branding'

	const { configs } = storeToRefs(useAppConfigStore())
	const copyrightConfig = computed(() => configs.value?.featureConfig?.profile?.copyrightConfig)
	/**
	 * 页脚文案(复验轮 #14):插件端演示值含上游名(「2026 uni-halo 丨 开源项目@LQBBY」),
	 * 命中品牌标记按未配置处理、回退本站文案;哥哥在插件后台改成自己的后自动原样生效。
	 */
	const displayContent = computed(() => sanitizeBrandingText(copyrightConfig.value?.content, '「 LQBBY 丨 个人博客 」'))
</script>

<template>
	<view v-if="copyrightConfig?.enabled" class="box-border mt-6 px-6 text-center">
		<text class="text-11px text-gray-400">{{ displayContent }}</text>
	</view>
</template>
