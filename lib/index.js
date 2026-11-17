/**
 * dsh-fans-composer-expand — host 半边。
 *
 * 浏览器半边通过 conversation.input.right 槽位（展开/收起按钮 + CSS 高度
 * 切换）与 plugins.bundle.config 槽位（插件详情页配置页）完成全部 UI。
 * 这里没有命令、服务或会话钩子需要注册，但 bundle 清单要求 lib/index.js
 * 存在，因此保留一个最小的 apply() 桩。
 */
export function apply() {
  // no-op：客户端半边自包含。
}
