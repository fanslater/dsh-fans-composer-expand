/**
 * dsh-fans-composer-expand — 浏览器半边。
 *
 * 三件事：
 *   1. 在 composer 工具行（conversation.input.right，发送按钮旁官方预留的
 *      可点击控件位）放一个展开/收起按钮：点击在「默认封顶高度」与
 *      「展开书写视图」之间切换输入框，长草稿不再挤在小窗口里滚动。
 *   2. 展开期间自愈：DSH 重建会话滚动容器或输入卡片（切视图、切会话）时，
 *      MutationObserver 自动把展开样式与「回车换行」重新应用到新 DOM，
 *      不需要按钮重新挂载。
 *   3. 插件配置页：注册到插件页的 plugins.bundle.config（键为本包名），
 *      配置只出现在「插件 → fans输入框扩展」详情页、简介与组件行之间；
 *      绝不注册进 DSH 设置。
 *
 * 高度机制（复刻自 dsh-composer-expand v0.1.4，最小/最高高度均可配置）：
 *   - 会话滚动容器带 data-conversation-scroll，其内部的 data-composer-seat
 *     是输入卡片本体（data-conversation-composer-overlay 锚点只存在于
 *     Trajectory 视图，默认 ChatView 没有，因此不使用）。
 *   - 展开时在滚动容器上切换 fans-composer-expand-on 类：该类把 seat 上的
 *     --dsh-composer-text-max-height（DSH 默认 336px 封顶）放宽为「配置的
 *     最高高度」（默认 480px，范围 240–1200），并给输入面设置「配置的最小
 *     高度」（默认 300px，范围 120–2000）。
 *   - 内容超过最高高度后由 data-input-scroll 内部滚动（overflow-y: auto），
 *     滚动条由浏览器原生绘制，不再继续长高遮挡对话内容。
 *   - textarea 时代靠隐藏镜像 data-input-mirror 定高；Lexical 时代
 *     （0.1.2-alpha.1+）暴露 data-input-scroll（封顶滚动容器）与
 *     data-composer-input（contenteditable 宿主）。CSS 同时锚定两代 +
 *     旧镜像，从不触碰每次构建都会变的哈希类名。
 *
 * 回车拦截：Lexical 时代 harness 在可编辑根节点上用 bubble 阶段 keydown
 * 派发送，同元素上的监听抢不过它；本插件改为在每个 composer seat 上绑
 * CAPTURE 阶段 keydown —— 祖先的捕获监听先于目标上的任何监听执行 ——
 * 对普通回车 stopPropagation()：harness 收不到该键，contenteditable
 * 原生插入换行，Lexical 对齐外部 DOM 变化。带修饰键（Shift/Ctrl/Cmd/Alt）
 * 的回车、IME 组合输入（isComposing）、以及斜杠/@ 触发菜单（seat 内出现
 * [role="listbox"]）打开时不拦截，回车保持原行为。
 *
 * 按钮、配置页文案：按钮文案经 harness locale 服务注册（中英双语）；
 * 配置页为 fans 系列统一的「暂存 + 保存配置 / 恢复默认」交互，配置保存在
 * 本机 localStorage，保存后立即生效（动态重写样式表，无需刷新）。
 */

window.__ModuleLoader__.load({
	id: "dsh-fans-composer-expand",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		const ID = "fans-composer-expand";
		const BUNDLE_NAME = "dsh-fans-composer-expand";
		const CONFIG_SLOT = "plugins.bundle.config";
		const COMPOSER_SLOT = "conversation.input.right";
		const BUTTON_ID = "fans-composer-expand";

		// ── 存储键 ──────────────────────────────────────────────────────
		// 展开状态：独立 key，与第三方 dsh-composer-expand 互不干扰；
		// 首次读取时从旧插件 key 迁移一次，已展开的迁移后仍展开。
		const EXPANDED_KEY = ID + ":expanded";
		const LEGACY_EXPANDED_KEY = "dsh-composer-expand:expanded";
		const EXPANDED_ON = "1";
		const EXPANDED_OFF = "0";

		// 配置：只保存在本机 localStorage。
		const SETTINGS_KEY = ID + ":settings:v1";
		const SETTINGS_DEFAULTS = { expandedMinHeight: 300, expandedMaxHeight: 480 };
		const MIN_HEIGHT_FLOOR = 120;
		const MIN_HEIGHT_CEIL = 2000;
		const MAX_HEIGHT_FLOOR = 240;
		const MAX_HEIGHT_CEIL = 1200;

		// ── 高度常量（上下限都来自配置，上限决定滚动条出现位置） ─────────
		// contenteditable 宿主的内部最小高度 = 配置最小高度 − 内边距余量，
		// 并保底 120px，避免配置过小时编辑面塌陷。
		const INNER_FLOOR = 120;
		const INNER_PADDING = 40;

		const CLASS_ON = ID + "-on";
		const STYLE_TAG_ID = ID + "/button.css";

		// ── 配置读写 ────────────────────────────────────────────────────

		/** 把任意输入收敛为合法的最小高度（整数，闭区间 [120, 2000]）。 */
		function clampMinHeight(value) {
			const n = typeof value === "number" ? value : Number(value);
			if (!Number.isFinite(n)) return SETTINGS_DEFAULTS.expandedMinHeight;
			return Math.round(Math.min(MIN_HEIGHT_CEIL, Math.max(MIN_HEIGHT_FLOOR, n)));
		}

		/** 把任意输入收敛为合法的最大高度（整数，闭区间 [240, 1200]），且不低于最小高度。 */
		function clampMaxHeight(value, minHeightPx) {
			const n = typeof value === "number" ? value : Number(value);
			const fallback = Math.max(minHeightPx, SETTINGS_DEFAULTS.expandedMaxHeight);
			if (!Number.isFinite(n)) return fallback;
			const rounded = Math.round(Math.min(MAX_HEIGHT_CEIL, Math.max(MAX_HEIGHT_FLOOR, n)));
			return Math.max(minHeightPx, rounded);
		}

		function normalizeSettings(raw) {
			if (raw === null || typeof raw !== "object") return { ...SETTINGS_DEFAULTS };
			const min = clampMinHeight(raw.expandedMinHeight);
			return { expandedMinHeight: min, expandedMaxHeight: clampMaxHeight(raw.expandedMaxHeight, min) };
		}

		const settingsListeners = new Set();
		let settingsCache = null;

		function readSettings() {
			try {
				if (typeof localStorage === "undefined") return { ...SETTINGS_DEFAULTS };
				const text = localStorage.getItem(SETTINGS_KEY);
				if (text === null) return { ...SETTINGS_DEFAULTS };
				return normalizeSettings(JSON.parse(text));
			} catch (error) {
				return { ...SETTINGS_DEFAULTS };
			}
		}

		function currentSettings() {
			if (settingsCache === null) settingsCache = readSettings();
			return settingsCache;
		}

		function persistSettings(next) {
			settingsCache = next;
			try {
				if (typeof localStorage !== "undefined") {
					localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
				}
			} catch (error) {
				/* 存储不可用时仅本次会话内生效 */
			}
			applyHeightCss(next);
			for (const listener of settingsListeners) {
				try {
					listener(next);
				} catch (error) {
					/* 订阅者已卸载 */
				}
			}
		}

		function updateSettings(patch) {
			persistSettings(normalizeSettings({ ...currentSettings(), ...patch }));
		}

		function subscribeSettings(listener) {
			settingsListeners.add(listener);
			return () => {
				settingsListeners.delete(listener);
			};
		}

		function useSettings() {
			const [value, setValue] = React.useState(currentSettings);
			React.useEffect(() => subscribeSettings(setValue), []);
			return value;
		}

		// ── 样式 ────────────────────────────────────────────────────────

		/**
		 * 由配置生成整份样式表：最小高度参与其中，因此配置变更时整份重写
		 * （写入同一个 <style> 标签，保存后立即生效）。
		 */
		function buildCss(minHeightPx, maxHeightPx) {
			const inner = Math.max(INNER_FLOOR, minHeightPx - INNER_PADDING);
			return [
				"." + CLASS_ON + " { --" + ID + "-min: " + minHeightPx + "px; --" + ID + "-max: " + maxHeightPx + "px; }",
				// 放宽真正的高度上限：seat 上的 --dsh-composer-text-max-height
				// （DSH 默认 336px）封顶了输入滚动容器；在 seat 上覆盖该变量即
				// 放宽封顶。该变量两代 composer 都挂在 seat 上，规则通用。
				"." + CLASS_ON + " [data-composer-seat] { --dsh-composer-text-max-height: var(--" + ID + "-max) !important; }",
				// 下限：内容再少也保持足够书写空间。textarea 时代镜像 /
				// Lexical 时代滚动容器，两代都锚定。
				"." + CLASS_ON + " [data-input-mirror] { min-height: var(--" + ID + "-min) !important; }",
				// 上限 + 滚动：达到配置高度后由滚动容器内部滚动，滚动条由浏览器
				// 原生绘制，和 DSH 原生输入框一致。
				"." + CLASS_ON + " [data-input-scroll] { min-height: var(--" + ID + "-min) !important; max-height: var(--" + ID + "-max) !important; overflow-y: auto !important; }",
				// 编辑面本身不封顶，交给上面的滚动容器；否则内容会被裁掉而不是滚动。
				"." + CLASS_ON + " [data-composer-input] { min-height: " + inner + "px !important; max-height: none !important; }",
				"." + CLASS_ON + " [data-composer-seat] textarea { max-height: none !important; }",
				// 按钮样式：color: inherit 跟随主题，不引入突兀配色。
				".fcexp-btn { display: inline-flex; align-items: center; gap: 4px; height: 24px; border: 1px solid rgba(127,127,137,.35); background: transparent; color: inherit; border-radius: 999px; padding: 0 9px; font-size: 12px; line-height: 1; cursor: pointer; opacity: .75; white-space: nowrap; font-variant-numeric: tabular-nums; transition: opacity .12s ease, background-color .12s ease; }",
				".fcexp-btn:hover { opacity: 1; background: rgba(127,127,137,.12); }",
				'.fcexp-btn[data-on="true"] { opacity: 1; background: rgba(127,127,137,.18); border-color: rgba(127,127,137,.6); }',
				".fcexp-glyph { display: inline-flex; align-items: center; }",
			].join("\n");
		}

		function ensureStyleTag() {
			let tag = document.querySelector('style[data-plugin-css="' + STYLE_TAG_ID + '"]');
			if (tag === null) {
				tag = document.createElement("style");
				tag.dataset.plugin = ID;
				tag.dataset.pluginCss = STYLE_TAG_ID;
				document.head.appendChild(tag);
			}
			return tag;
		}

		/** 用当前配置重写样式表；每次 apply 与每次保存配置都会调用。 */
		function applyHeightCss(settings) {
			if (typeof document === "undefined") return;
			ensureStyleTag().textContent = buildCss(settings.expandedMinHeight, settings.expandedMaxHeight);
		}

		// ── 展开状态（localStorage 持久化 + 旧插件迁移） ────────────────

		function readStored() {
			try {
				let value = localStorage.getItem(EXPANDED_KEY);
				if (value === null) {
					const legacy = localStorage.getItem(LEGACY_EXPANDED_KEY);
					if (legacy === EXPANDED_ON || legacy === EXPANDED_OFF) {
						localStorage.setItem(EXPANDED_KEY, legacy);
						value = legacy;
					}
				}
				return value === EXPANDED_ON;
			} catch (error) {
				return false;
			}
		}

		function writeStored(on) {
			try {
				localStorage.setItem(EXPANDED_KEY, on ? EXPANDED_ON : EXPANDED_OFF);
			} catch (error) {
				/* 私密模式下仅本次会话生效 */
			}
		}

		// ── 展开态 DOM 管理（复刻第三方：类切换 + 回车拦截 + 自愈） ─────

		/**
		 * 保持展开态作用于 DSH 当前显示的任何 DOM。on 为 true 时必须满足：
		 *   1. 会话滚动根带有 CLASS_ON 类；
		 *   2. 每个 composer seat 捕获阶段拦截编辑器内的普通回车，使其换行
		 *      而不是触发 harness 发送（带修饰键的快捷键仍可发送）。
		 * harness 可能在不重挂按钮的情况下替换滚动根/seat（切视图、切会话），
		 * 所以首轮清扫后还需 document 级 MutationObserver 在节点（重）加入时
		 * 重新应用。返回清理函数：断开 observer、移除类、解绑本轮监听。
		 */
		function manageExpandedDom(on) {
			if (typeof document === "undefined") return;

			if (!on) {
				document.querySelectorAll("[data-conversation-scroll]." + CLASS_ON).forEach(function (root) {
					root.classList.remove(CLASS_ON);
				});
				writeStored(false);
				return;
			}

			writeStored(true);

			const bound = new Set();
			const handleKeyDown = function (event) {
				if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
				const target = event.target;
				if (typeof Element === "undefined" || !(target instanceof Element)) return;
				const seat = target.closest("[data-composer-seat]");
				if (!seat) return;
				const editable = target.closest('[data-composer-input], textarea, [contenteditable="true"]');
				if (!editable || !seat.contains(editable)) return; // 只拦截编辑器内输入
				if (seat.querySelector('[role="listbox"]')) return; // 触发菜单打开：回车选候选
				event.stopPropagation();
			};
			const applyClass = function () {
				const root = document.querySelector("[data-conversation-scroll]");
				if (root) root.classList.add(CLASS_ON);
			};
			const bindSeats = function () {
				document.querySelectorAll("[data-composer-seat]").forEach(function (seat) {
					if (bound.has(seat)) return;
					seat.addEventListener("keydown", handleKeyDown, true);
					bound.add(seat);
				});
			};
			const sweep = function () {
				applyClass();
				bindSeats();
			};

			sweep();
			const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(function (mutations) {
				for (let i = 0; i < mutations.length; i++) {
					if (mutations[i].addedNodes.length > 0) {
						sweep();
						return;
					}
				}
			});
			if (observer) observer.observe(document.documentElement, { childList: true, subtree: true });

			return function () {
				if (observer) observer.disconnect();
				document.querySelectorAll("[data-conversation-scroll]." + CLASS_ON).forEach(function (root) {
					root.classList.remove(CLASS_ON);
				});
				bound.forEach(function (seat) {
					seat.removeEventListener("keydown", handleKeyDown, true);
				});
			};
		}

		// ── 文案（按钮经 harness locale 服务，中英双语） ────────────────

		const ZH = {
			"button.collapse.label": "收起",
			"button.collapse.title": "恢复输入框默认高度",
			"button.expand.label": "展开",
			"button.expand.title": "把输入框高度扩大到设定上限（默认 " + SETTINGS_DEFAULTS.expandedMaxHeight + "px），方便写长 prompt；最小与最大高度都可在插件详情页配置",
			"slot.label": "展开输入框",
		};
		const EN = {
			"button.collapse.label": "Collapse",
			"button.collapse.title": "Restore the composer to its default height",
			"button.expand.label": "Expand",
			"button.expand.title": "Grow the composer to the configured maximum (default " + SETTINGS_DEFAULTS.expandedMaxHeight + "px) so long drafts stay readable; both the minimum and maximum height are configurable on the plugin detail page",
			"slot.label": "Expand composer",
		};

		// ── 展开按钮 ────────────────────────────────────────────────────

		/**
		 * 按钮字形（G2 · 输入框高度暗示，currentColor 跟随 DSH 深浅主题）：
		 * 收起态 = 矮框 + 向上箭头（提示点击展开）；展开态 = 高框 + 向下箭头
		 * （提示点击收起）。与插件图标的「输入框 + 双向箭头」同一语义。
		 */
		function Glyph({ on }) {
			return h(
				"svg",
				{
					width: 14,
					height: 14,
					viewBox: "0 0 16 16",
					fill: "none",
					"aria-hidden": "true",
					focusable: "false",
				},
				h("path", {
					d: on
						? "M8 4.8 V10.4 M5.5 8 L8 10.4 L10.5 8"
						: "M8 1.8 V6.6 M5.5 4.1 L8 1.8 L10.5 4.1",
					stroke: "currentColor",
					strokeWidth: 1.6,
					strokeLinecap: "round",
					strokeLinejoin: "round",
				}),
				h("rect", {
					x: 3.2,
					y: on ? 2.2 : 8.8,
					width: 9.6,
					height: on ? 11.6 : 5.4,
					rx: 1.4,
					stroke: "currentColor",
					strokeWidth: 1.5,
				}),
			);
		}

		function ExpandButton(props) {
			const [on, setOn] = React.useState(readStored);
			const [, setLocaleTick] = React.useState(0);

			React.useEffect(
				() => ctxLocaleSubscribe(setLocaleTick),
				[],
			);
			React.useEffect(() => manageExpandedDom(on), [on]);

			const onClick = React.useCallback(function () {
				setOn(function (v) {
					return !v;
				});
			}, []);
			const label = on ? t("button.collapse.label") : t("button.expand.label");
			const title = on ? t("button.collapse.title") : t("button.expand.title");

			return h(
				"button",
				{
					type: "button",
					className: "fcexp-btn",
					title: title,
					"aria-pressed": on ? "true" : "false",
					"data-on": on ? "true" : "false",
					onClick: onClick,
				},
				h("span", { className: "fcexp-glyph", "aria-hidden": "true" }, h(Glyph, { on: on })),
				h("span", null, label),
			);
		}

		// locale 服务在 apply 阶段绑定；组件渲染晚于 apply，这里先声明承接
		// 变量。服务任何一环不可用都不影响文案：t() 会按界面语言快照在本地
		// 字典兜底（无法识别语言时最终回退中文，本插件面向中文界面）。
		let localeBind = null;
		let localeGetLocale = null;
		let ctxLocaleSubscribe = function () {
			return function () {};
		};

		/** 读取界面语言快照（形如 zh / zh-cn / en），读不到返回空串。 */
		function detectLang() {
			if (localeGetLocale === null) return "";
			try {
				const snap = localeGetLocale();
				const id =
					snap && (snap.locale !== undefined
						? snap.locale
						: snap.id !== undefined
							? snap.id
							: snap.language !== undefined
								? snap.language
								: snap.current);
				return typeof id === "string" ? id.toLowerCase() : "";
			} catch (error) {
				return "";
			}
		}

		/** 按钮文案：界面语言快照 → harness bind 取词 → 本地字典（中文优先）。 */
		function t(key) {
			const lang = detectLang();
			const dict = lang.indexOf("zh") === 0 ? ZH : lang.indexOf("en") === 0 ? EN : null;
			if (dict !== null && typeof dict[key] === "string") return dict[key];
			if (localeBind !== null) {
				try {
					const v = localeBind(key);
					if (typeof v === "string" && v !== key) return v;
				} catch (error) {
					/* bind 取词失败，走本地字典兜底 */
				}
			}
			return ZH[key] || EN[key] || key;
		}

		// ── 插件配置页（仅本插件详情页，fans 系列统一交互） ─────────────
		// 注册到 plugins.bundle.config（键 = 本包名），渲染在详情页简介与
		// 组件行之间；绝不注册进 DSH 设置。暂存 + 「保存配置」提交：有修改
		// 高亮可点、无修改置灰；「恢复默认」只重置表单仍需保存；离开页面
		// 丢弃未保存修改；保存时解析输入框当前值，避免丢数据。

		const configStyles = {
			form: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 },
			formTitle: { fontSize: 14, fontWeight: 600, margin: 0 },
			formHint: { fontSize: 12, opacity: 0.55, margin: 0 },
			field: { display: "flex", flexDirection: "column", gap: 6 },
			fieldLabel: { fontSize: 13, fontWeight: 500 },
			fieldDesc: { fontSize: 11, opacity: 0.55 },
			input: {
				width: 96,
				padding: "6px 8px",
				borderRadius: 6,
				border: "1px solid rgba(127,127,127,0.35)",
				background: "transparent",
				color: "inherit",
				font: "inherit",
				outline: "none",
			},
			inputError: { borderColor: "rgba(239,68,68,0.65)" },
			errorText: { fontSize: 11, color: "#ef4444" },
			footer: { display: "flex", alignItems: "center", gap: 12, paddingTop: 4, flexWrap: "wrap" },
			button: {
				outline: "none",
				padding: "6px 12px",
				borderRadius: 6,
				border: "1px solid rgba(127,127,127,0.35)",
				background: "transparent",
				color: "inherit",
				font: "inherit",
				cursor: "pointer",
			},
			buttonPrimary: { borderColor: "rgba(47,107,255,0.9)", background: "rgba(47,107,255,0.92)", color: "#ffffff", fontWeight: 600 },
			buttonDisabled: { opacity: 0.45, cursor: "default" },
			statusText: { fontSize: 11, opacity: 0.6 },
		};

		function ConfigPage({ view }) {
			const saved = useSettings();
			// 草稿保持输入文本，保存时才解析，避免输入过程中被改写丢数据。
			const [draftMin, setDraftMin] = React.useState(() => String(saved.expandedMinHeight));
			const [draftMax, setDraftMax] = React.useState(() => String(saved.expandedMaxHeight));
			const [justSaved, setJustSaved] = React.useState(false);

			React.useEffect(() => {
				setDraftMin(String(saved.expandedMinHeight));
				setDraftMax(String(saved.expandedMaxHeight));
				setJustSaved(false);
			}, [saved]);

			if (view === "summary") {
				return h("span", null, "输入框展开/收起按钮 + 展开后最小/最高高度配置");
			}

			const trimmedMin = draftMin.trim();
			const trimmedMax = draftMax.trim();
			const parsedMin = Number(trimmedMin);
			const parsedMax = Number(trimmedMax);
			const minOutOfRange = trimmedMin !== "" && (!Number.isFinite(parsedMin) || parsedMin < MIN_HEIGHT_FLOOR || parsedMin > MIN_HEIGHT_CEIL);
			const maxOutOfRange = trimmedMax !== "" && (!Number.isFinite(parsedMax) || parsedMax < MAX_HEIGHT_FLOOR || parsedMax > MAX_HEIGHT_CEIL);
			const nextMin = minOutOfRange ? saved.expandedMinHeight : clampMinHeight(parsedMin);
			const nextMax = maxOutOfRange ? saved.expandedMaxHeight : clampMaxHeight(parsedMax, nextMin);
			// 最高高度低于最小高度时按最小高度生效，这里只做提示，不阻断保存。
			const maxRaised = !minOutOfRange && !maxOutOfRange && trimmedMin !== "" && trimmedMax !== "" && Number.isFinite(parsedMax) && parsedMax < nextMin;
			const dirty =
				!minOutOfRange &&
				!maxOutOfRange &&
				trimmedMin !== "" &&
				trimmedMax !== "" &&
				(nextMin !== saved.expandedMinHeight || nextMax !== saved.expandedMaxHeight);

			const save = () => {
				if (!dirty) return;
				updateSettings({ expandedMinHeight: nextMin, expandedMaxHeight: nextMax });
				setJustSaved(true);
			};

			const resetDraft = () => {
				setJustSaved(false);
				setDraftMin(String(SETTINGS_DEFAULTS.expandedMinHeight));
				setDraftMax(String(SETTINGS_DEFAULTS.expandedMaxHeight));
			};

			return h(
				"div",
				{ style: configStyles.form },
				h("h3", { style: configStyles.formTitle }, "fans输入框扩展"),
				h(
					"p",
					{ style: configStyles.formHint },
					"展开/收起按钮在输入框工具行（发送按钮旁）。展开后输入框至少保持「最小高度」，内容变多时长高，到达「最高高度」后停止长高并在输入框内部出现滚动条，不会继续遮挡对话内容。配置只保存在本机，且只出现在这个插件详情页，保存后立即生效。",
				),
				h(
					"div",
					{ style: configStyles.field },
					h("div", { style: configStyles.fieldLabel }, "展开后最小高度（px）"),
					h("div", { style: configStyles.fieldDesc }, "展开后即使内容很少也保持的高度，范围 " + MIN_HEIGHT_FLOOR + "–" + MIN_HEIGHT_CEIL + "，默认 " + SETTINGS_DEFAULTS.expandedMinHeight + "。"),
					h("input", {
						type: "number",
						min: MIN_HEIGHT_FLOOR,
						max: MIN_HEIGHT_CEIL,
						step: 10,
						value: draftMin,
						onChange: (event) => {
							setJustSaved(false);
							setDraftMin(event.target.value);
						},
						style: minOutOfRange ? { ...configStyles.input, ...configStyles.inputError } : configStyles.input,
					}),
					minOutOfRange
						? h("div", { style: configStyles.errorText }, "请输入 " + MIN_HEIGHT_FLOOR + "–" + MIN_HEIGHT_CEIL + " 之间的数值，当前按已保存值 " + saved.expandedMinHeight + " 生效")
						: null,
				),
				h(
					"div",
					{ style: configStyles.field },
					h("div", { style: configStyles.fieldLabel }, "展开后最高高度（px）"),
					h("div", { style: configStyles.fieldDesc }, "超过该高度后输入框内部出现滚动条，范围 " + MAX_HEIGHT_FLOOR + "–" + MAX_HEIGHT_CEIL + "，默认 " + SETTINGS_DEFAULTS.expandedMaxHeight + "，且不能低于最小高度。"),
					h("input", {
						type: "number",
						min: MAX_HEIGHT_FLOOR,
						max: MAX_HEIGHT_CEIL,
						step: 10,
						value: draftMax,
						onChange: (event) => {
							setJustSaved(false);
							setDraftMax(event.target.value);
						},
						style: maxOutOfRange ? { ...configStyles.input, ...configStyles.inputError } : configStyles.input,
					}),
					maxOutOfRange
						? h("div", { style: configStyles.errorText }, "请输入 " + MAX_HEIGHT_FLOOR + "–" + MAX_HEIGHT_CEIL + " 之间的数值，当前按已保存值 " + saved.expandedMaxHeight + " 生效")
						: maxRaised
							? h("div", { style: configStyles.statusText }, "最高高度低于最小高度，保存时将按最小高度 " + nextMin + " 生效")
							: null,
				),
				h(
					"div",
					{ style: configStyles.footer },
					h(
						"button",
						{
							type: "button",
							onClick: save,
							disabled: !dirty,
							style: dirty
								? { ...configStyles.button, ...configStyles.buttonPrimary }
								: { ...configStyles.button, ...configStyles.buttonDisabled },
						},
						"保存配置",
					),
					h("button", { type: "button", onClick: resetDraft, style: configStyles.button }, "恢复默认"),
					h(
						"span",
						{ style: configStyles.statusText },
						dirty ? "有未保存的修改" : justSaved ? "已保存并生效" : "与已保存的设置一致",
					),
				),
				h(
					"p",
					{ style: configStyles.formHint },
					"「恢复默认」只把表单改回默认值（最小 " + SETTINGS_DEFAULTS.expandedMinHeight + "、最高 " + SETTINGS_DEFAULTS.expandedMaxHeight + "），仍需点「保存配置」才会生效。",
				),
			);
		}

		// ── apply：注册按钮槽位与配置页槽位 ─────────────────────────────

		function apply(ctx) {
			// 先按当前配置落一份样式（保存配置时也会重写）。
			applyHeightCss(currentSettings());

			// 注册字典并绑定取词：优先字典对象重载（一次注册全部语言，便于
			// harness 识别命名空间并跟随界面语言切换），失败再退回逐语言注册；
			// 任何一环失败都只降级到 t() 的本地字典兜底，不影响按钮显示。
			try {
				if (ctx.locale && typeof ctx.locale.register === "function") {
					try {
						const off = ctx.locale.register(ID, { zh: ZH, en: EN });
						if (typeof off === "function" && typeof ctx.effect === "function") {
							ctx.effect(() => off, ID + ": locale dicts");
						}
					} catch (error) {
						ctx.locale.register(ID, "zh", ZH);
						ctx.locale.register(ID, "en", EN);
					}
				}
			} catch (error) {
				console.error(ID + ": locale registration failed: " + String(error));
			}
			try {
				if (ctx.locale && typeof ctx.locale.bind === "function") localeBind = ctx.locale.bind(ID);
			} catch (error) {
				localeBind = null;
			}
			try {
				if (ctx.locale && typeof ctx.locale.getLocale === "function") {
					localeGetLocale = function () {
						return ctx.locale.getLocale();
					};
				}
			} catch (error) {
				localeGetLocale = null;
			}
			try {
				if (ctx.locale && typeof ctx.locale.subscribe === "function") {
					ctxLocaleSubscribe = function (setState) {
						return ctx.locale.subscribe(function () {
							setState(function (x) {
								return x + 1;
							});
						});
					};
				}
			} catch (error) {
				ctxLocaleSubscribe = function () {
					return function () {};
				};
			}

			const slots = ctx.slots;
			if (!slots || typeof slots.inject !== "function" || typeof slots.register !== "function") return;

			ctx.effect(
				() =>
					slots.inject(COMPOSER_SLOT, () =>
						slots.register(
							{ name: COMPOSER_SLOT, id: BUTTON_ID, order: 90, label: () => t("slot.label") },
							(props) => h(ExpandButton, props),
						),
					),
				ID + ": composer button",
			);
			ctx.effect(
				() => slots.inject(CONFIG_SLOT, () => slots.register({ name: CONFIG_SLOT, key: BUNDLE_NAME }, ConfigPage)),
				ID + ": bundle config page",
			);
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		exports.__test = { buildCss, clampMinHeight, clampMaxHeight, normalizeSettings, SETTINGS_DEFAULTS };
		return module.exports;
	},
});
