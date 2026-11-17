# dsh-fans-composer-expand（fans输入框扩展）

为 DeepSeek Harness（DSH）打造的输入框展开/收起插件。在输入框（composer）工具行放一个展开/收起按钮（输入框高度暗示字形：收起时「矮框 + 向上箭头」，展开时「高框 + 向下箭头」，颜色跟随主题），点击在「默认封顶高度」与「展开书写视图」之间切换，长草稿不再挤在小窗口里滚动。

> 作者：fanslater。本插件复刻自第三方插件 [dsh-composer-expand](https://github.com/13071301808/dsh-composer-expand) v0.1.4 的全部功能效果，并在此基础上新增「展开后最小 / 最高高度」两个配置项。

## 为什么需要

DSH 默认把输入框文本封顶在一个较小高度（seat 上定义了 `--dsh-composer-text-max-height: 336px`，限制文本框滚动容器）。草稿变长后，只能在小窗口里滚动几行。本插件对短草稿保持默认行为，写长 prompt 时一键切换到大视图。

## 功能

- **展开/收起按钮在输入框工具行** — 位于 `conversation.input.right`（发送按钮旁官方预留的可点击控件位）；字形为「输入框高度暗示」，收起时矮框+向上箭头、展开时高框+向下箭头，`currentColor` 跟随 DSH 深浅主题。
- **展开到配置的最高高度** — 在会话滚动容器上切换 CSS 类；输入区同步放宽 `max-height` 到详情页配置的最高高度（默认 480px）。再点一次恢复默认封顶高度。
- **展开后最小 / 最高高度可配置（本插件新增）** — 原第三方插件写死「最小 300px、最高 70vh」；本插件在「插件 → fans输入框扩展」详情页提供两个数字输入：最小高度（范围 120–2000，默认 300）与最高高度（范围 240–1200，默认 480，且不能低于最小高度），保存后立即生效，无需刷新。内容超过最高高度后**输入框内部出现原生滚动条**，不再继续长高遮挡对话内容。
- **展开状态回车换行** — 展开时普通回车只插入换行，不触发发送；`Ctrl/Cmd + Enter` 等带修饰键快捷键仍可用于发送；斜杠 / @ 触发菜单打开时不拦截，回车正常选候选。
- **浏览器内持久化** — 展开状态写入 `localStorage[fans-composer-expand:expanded]`，刷新页面、切换工作区都保留；首次使用时自动从第三方插件的状态 key 迁移一次。
- **展开状态自愈** — 展开期间监听 DOM 重建：即使 harness 重建了会话滚动容器或输入卡片（切视图、切会话），展开样式与「回车换行」行为也会自动重新应用到新的输入框上。
- **中英文双语** — 按钮文案与提示跟随 DSH 的 `locale` 服务。
- **纯前端** — 无自定义协议、无 host 命令、无 LLM 调用、不进会话日志。
- **不依赖构建哈希** — CSS 锚定 DSH 稳定的 data 属性（`data-conversation-scroll` / `data-composer-seat` / `data-input-scroll` / `data-composer-input`，并保留 textarea 时代的 `data-input-mirror`），同时兼容 Lexical 编辑器与旧 textarea 两代 composer。
- **与第三方插件互不干扰** — CSS 类名、localStorage 键、槽位注册 id 全部独立命名；两者同时启用时只是输入框旁出现两个按钮。

## 配置（仅插件详情页）

配置页注册在 `plugins.bundle.config` 槽位（键 = 包名 `dsh-fans-composer-expand`），只出现在【插件 → 已安装插件 → fans输入框扩展】详情页、简介与组件行之间，**不出现在 DSH 设置中**。

| 配置项 | 说明 |
| --- | --- |
| 展开后最小高度（px） | 展开后即使内容很少也保持的高度。范围 120–2000，默认 300 |
| 展开后最高高度（px） | 内容超过该高度后输入框内部出现滚动条。范围 240–1200，默认 480，且不能低于最小高度（低于时按最小高度生效） |

交互为 fans 系列统一的「暂存 + 提交」模式：

- 「**保存配置**」— 表单有修改时高亮可点，保存后立即生效（样式表原地重写，无需刷新）；无修改时置灰。
- 「**恢复默认**」— 只把表单改回默认值（最小 300、最高 480），仍需点「保存配置」才会生效。
- 离开页面丢弃未保存的修改；输入非法值（超出范围）时红字提示，并按已保存值生效。

配置保存在浏览器 `localStorage[fans-composer-expand:settings:v1]`，仅本机有效。

## 安装

本插件以**打包后安装**的方式进入 DSH（不使用源码路径直连）：

```sh
# 1) 在插件源码目录打包（产物落到 ../pack）
npm pack --pack-destination ..\pack

# 2) 以 file: tarball 安装/更新；升级前先卸载同包名旧版本
dsh plugin --profile desktop remove dsh-fans-composer-expand
dsh plugin --profile desktop add "file:D:/__workspace/__workspace_ai/20261105_DSH插件整理安装/plugins/pack/dsh-fans-composer-expand-<版本>.tgz"
```

安装后重启 DSH 客户端（bundle 变更需重启），展开按钮出现在输入框工具行（发送按钮旁）；可在【插件 → 已安装插件】中确认「fans输入框扩展」。

## 工作原理

| 环节 | 机制 |
| --- | --- |
| 按钮位 | `conversation.input.right` 列表槽位（会话作用域）；`slots.inject` 注册单个 React 组件，`order: 90` |
| 切换状态 | React `useState`，初始值读 `localStorage[fans-composer-expand:expanded]`；变更时写回 |
| 高度配置 | `localStorage[fans-composer-expand:settings:v1]`；订阅式生效——保存后立即重写样式表 |
| DOM 挂钩 | `document.querySelector('[data-conversation-scroll]').classList.toggle('fans-composer-expand-on', on)` — 会话滚动容器上的官方稳定属性 |
| CSS 契约 | `.fans-composer-expand-on` 在 `[data-composer-seat]` 上覆盖 `--dsh-composer-text-max-height`（真正的 336px 上限）为 `var(--fans-composer-expand-max)`（配置的最高高度）；`[data-input-scroll]` 设最小/最大高度并 `overflow-y: auto`（原生滚动），`[data-input-mirror]` 设最小高度，`[data-composer-input]` 只设内部最小高度（配置最小高度 − 40px，保底 120px）、不再二次封顶 |
| 回车拦截 | seat 上的 capture 阶段 keydown，普通回车 `stopPropagation()`（先于 Lexical 的 bubble 发送监听）；修饰键 / IME / 候选菜单打开时不拦截 |
| 自愈 | document 级 `MutationObserver` 在节点（重）加入时重新应用类与监听 |
| 硬依赖 | `exports.inject = ['slots', 'locale']` — 均为官方 harness 客户端服务 |
| 无 host 命令 | `lib/index.js` 是空 `apply()`，整个插件纯客户端 |

## 与第三方 dsh-composer-expand 的关系

| 项 | dsh-composer-expand v0.1.4 | dsh-fans-composer-expand v1.0.2 |
| --- | --- | --- |
| 展开按钮 / 回车换行 / 自愈 / 双语 / 纯前端 | ✅ | ✅ 完整复刻 |
| 展开后最小高度 | 写死 300px | 详情页配置，120–2000px，默认 300 |
| 展开后最高高度 | 写死 70vh | 详情页配置，240–1200px，默认 480，到顶后原生滚动条 |
| 配置入口 | 无 | 仅本插件详情页（`plugins.bundle.config`） |
| 状态存储键 | `dsh-composer-expand:expanded` | `fans-composer-expand:expanded`（自动迁移旧值） |
| CSS 类名 | `dsh-composer-expand-on` | `fans-composer-expand-on` |

两者可并存，互不影响；确认本插件工作正常后，建议禁用或卸载第三方插件，避免出现两个按钮。

## 已知限制

- 状态按浏览器记忆，不按会话。DSH 同一时刻只渲染一个 composer，目前无感知差异。
- 展开后的实际高度由内容撑开，介于「最小高度」与「最高高度」之间；超出最高高度时内部滚动，滚动条为浏览器原生样式。

## License

MIT © fanslater
