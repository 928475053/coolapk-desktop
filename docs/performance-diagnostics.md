# 性能诊断日志

Windows、macOS、Linux、Android 和 iOS 的原生客户端启动后自动输出性能日志，无需开启详细日志。使用现有的诊断日志导出入口即可将这些记录一起导出。排查长时间浏览卡顿时，在卡顿发生后、退出或重启前导出，并记录当时卡的是滚动、切换页面还是加载内容。

## 前端记录

`[frontend][performance] capabilities` 记录采样能力；`sample` 在前台启动时和每 30 秒记录一次，同时带有版本会话、页面、屏幕尺寸和可见状态等现有上下文。

| 字段 | 含义 |
| --- | --- |
| `window_ms` | 本次前台采样窗口实际长度 |
| `max_event_loop_delay_ms` | 每秒定时器的最大超时延迟，不是 FPS；系统调度也可能影响它 |
| `delayed_ticks` | 延迟至少 100ms 的采样次数 |
| `longtask_supported` / `longtasks` / `longtask_ms` | WebView 支持 Long Tasks API 时的任务数量与总耗时 |
| `mounted_elements` / `mounted_feed_cards` | 当前挂载文档的元素、动态卡片数量；不包含 KeepAlive 分离的节点 |
| `images` / `videos` / `playing_videos` | 挂载图片、视频和正在播放的视频元素数量 |
| `js_heap_used_bytes` / `js_heap_total_bytes` | WebView 提供非标准 `performance.memory` 时的 JS 堆数据，不能视为整个渲染进程内存 |
| `sample_cost_ms` | 本次 DOM 和媒体计数的耗时 |

后台暂停前端定时采样，恢复可见时重新开始计时，不将后台限频纳入前台延迟。系统休眠若未触发可见状态变化，恢复后的定时器延迟仍可能被计入，需要结合实际操作时间判断。阻塞期间 JS 不能写日志，恢复执行后才会记录延迟。不支持的指标标为 `unavailable`，不能当作零。

## 接近用户体感的指标

滚动、触摸移动、点击和按键后，在 1.5 秒活跃窗口内运行 `requestAnimationFrame` 采样；连续滚动会延长窗口，空闲时停止逐帧采样。每 30 秒将结果写入前端 `sample`。后台及 `pagehide` 会取消逐帧回调，恢复后重新开始，避免把后台空窗算成滚动停顿。

| 字段 | 含义 |
| --- | --- |
| `active_raf_frames` / `active_raf_fps` | 活跃窗口内的 rAF 间隔数量及平均回调频率；不是屏幕实际呈现 FPS |
| `frame_gap_p95_le_ms` | 95% 帧间隔落入的直方图区间上界，区间为 16/33/50/100/200/500/1000ms；超过最后区间记为 `over_1000` |
| `max_frame_gap_ms` | 活跃采样时最大 rAF 间隔 |
| `frames_ge_50ms` | 间隔至少 50ms 的次数，用于观察明显长帧 |
| `stalls_ge_100ms` / `scroll_stalls_ge_100ms` | 间隔至少 100ms 的次数，及其中开始于滚动活跃窗口内的次数 |
| `input_events` / `max_input_capture_delay_ms` | 有有效时间戳的真实 pointerdown、click、keydown 事件数，以及事件产生到捕获监听器执行的最大延迟；一次点击可能产生多个事件 |
| `input_next_raf_samples` / `max_input_to_next_raf_ms` | 输入到下一次 rAF 回调的采样数量和最大耗时；多个输入共享一帧时使用最早时间戳，不代表业务已完成或屏幕已呈现 |
| `event_timing_supported` / `timed_events` | Event Timing 能力及 API 上报的事件数；使用 16ms 上报阈值，不代表全部输入 |
| `max_event_to_render_ms` / `max_event_handler_ms` | Event Timing 上报的最大事件到渲染耗时，以及事件处理耗时 |
| `events_ge_200ms` | Event Timing 上报的至少 200ms 事件数 |
| `loaf_supported` / `long_animation_frames` | Long Animation Frames 能力及上报长动画帧数 |
| `max_long_animation_frame_ms` / `animation_blocking_ms` | 最长动画帧耗时和累计阻塞耗时 |

`[frontend][performance] jank` 记录至少 200ms 的异常，并标注 `scroll_frame_gap`、`interaction_frame_gap`、`input_to_next_raf`、`event_to_render` 或 `long_animation_frame` 类型。全局最多每 5 秒一条；完整数量保留在窗口统计中。日志继续附带当前页面、会话和可见状态，不记录按键、文本、目标节点或脚本 URL。

这些数值用于描述“滚动不顺”和“操作响应慢”的线索。rAF 发生在绘制之前，不能证明显示器实际呈现了哪一帧；主线程阻塞也可能与合成线程滚动同时发生。Event Timing 的时长经过浏览器取整，详见 [W3C Event Timing 规范](https://www.w3.org/TR/event-timing/)。这里没有将事件最大值宣称为标准 INP，也没有用固定 60Hz 推算掉帧数量。网络等待、异步业务完成时间还需结合请求日志分析。

## 原生记录

`performance.native` 由独立线程在启动时和每 30 秒记录一次，不依赖前端主线程。系统休眠或移动系统挂起应用时不会强制唤醒，恢复后的 CPU 数据使用实际经过时间计算。

| 字段 | 含义 |
| --- | --- |
| `scope=host_process` / `pid` / `os` | 仅当前 Tauri 宿主进程，不含 WebView、GPU 或其他进程 |
| `uptime_ms` / `window_ms` | 采样器运行时间、CPU 增量窗口 |
| `cpu_percent_one_core` | CPU 时间增量除以实际时间，一个核心满载为 100%，多线程可超过 100%；首个样本不可计算 |
| `cpu_total_ms` | 进程累计用户态与内核态 CPU 时间 |
| `rss_bytes` | Windows 工作集、Apple task resident size、Linux/Android `/proc/self/status` VmRSS |
| `peak_rss_bytes` | 进程历史峰值驻留内存；不会因释放内存而回落 |

API 读取失败的数值标为 `unavailable`。这些记录只包含数值和固定字段，不记录正文、账号、输入、媒体地址或其他应用信息。沿用诊断日志的轮转和导出大小限制。

分析时对比同一会话的早期与卡顿时样本。宿主进程内存稳定不能排除 WebView 内存增长；节点增长或延迟升高是排查线索，不能单独证明泄漏或定位根因。
