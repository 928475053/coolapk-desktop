//! 只采集当前宿主进程，不枚举其他应用、命令行或 WebView 子进程。
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

static RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Default)]
struct Metrics {
    cpu_ms: Option<f64>,
    rss_bytes: Option<u64>,
    peak_rss_bytes: Option<u64>,
}

#[cfg(unix)]
fn metrics() -> Metrics {
    let mut result = Metrics::default();
    let mut usage = std::mem::MaybeUninit::<libc::rusage>::uninit();
    // getrusage 成功才读取初始化后的结构体。
    if unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) } == 0 {
        let usage = unsafe { usage.assume_init() };
        result.cpu_ms = Some((usage.ru_utime.tv_sec + usage.ru_stime.tv_sec) as f64 * 1000.0
            + (usage.ru_utime.tv_usec + usage.ru_stime.tv_usec) as f64 / 1000.0);
        let peak = usage.ru_maxrss.max(0) as u64;
        result.peak_rss_bytes = Some(if cfg!(target_vendor = "apple") { peak } else { peak.saturating_mul(1024) });
    }
    #[cfg(target_vendor = "apple")]
    {
        let mut info = std::mem::MaybeUninit::<libc::mach_task_basic_info>::uninit();
        let mut count = libc::MACH_TASK_BASIC_INFO_COUNT;
        #[allow(deprecated)]
        let status = unsafe { libc::task_info(libc::mach_task_self(), libc::MACH_TASK_BASIC_INFO,
            info.as_mut_ptr().cast(), &mut count) };
        if status == libc::KERN_SUCCESS && count == libc::MACH_TASK_BASIC_INFO_COUNT {
            result.rss_bytes = Some(unsafe { info.assume_init() }.resident_size);
        }
    }
    #[cfg(any(target_os = "linux", target_os = "android"))]
    {
        // /proc/self/status 的 VmRSS 单位固定为 kB，不读取其他进程。
        if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
            result.rss_bytes = status.lines().find_map(|line| line.strip_prefix("VmRSS:")
                .and_then(|value| value.split_whitespace().next()?.parse::<u64>().ok())
                .map(|kb| kb.saturating_mul(1024)));
        }
    }
    result
}

#[cfg(windows)]
fn metrics() -> Metrics {
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows::Win32::System::Threading::{GetCurrentProcess, GetProcessTimes};
    let mut result = Metrics::default();
    // 伪句柄指向当前进程，不需要 CloseHandle。
    let process = unsafe { GetCurrentProcess() };
    let mut created = FILETIME::default();
    let mut exited = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    if unsafe { GetProcessTimes(process, &mut created, &mut exited, &mut kernel, &mut user) }.is_ok() {
        let ticks = |time: FILETIME| ((time.dwHighDateTime as u64) << 32) | time.dwLowDateTime as u64;
        result.cpu_ms = Some((ticks(kernel) as f64 + ticks(user) as f64) / 10_000.0);
    }
    let mut memory = PROCESS_MEMORY_COUNTERS::default();
    let size = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
    memory.cb = size;
    if unsafe { GetProcessMemoryInfo(process, &mut memory, size) }.is_ok() {
        result.rss_bytes = Some(memory.WorkingSetSize as u64);
        result.peak_rss_bytes = Some(memory.PeakWorkingSetSize as u64);
    }
    result
}

fn value(value: Option<u64>) -> String {
    value.map_or_else(|| "unavailable".into(), |value| value.to_string())
}

pub fn start() {
    if RUNNING.swap(true, Ordering::Relaxed) { return; }
    if std::thread::Builder::new().name("performance-diagnostics".into()).spawn(|| {
        let started = Instant::now();
        let mut previous: Option<(Instant, f64)> = None;
        while RUNNING.load(Ordering::Relaxed) {
            let now = Instant::now();
            let sample = metrics();
            // 一个核心满载为 100%，多线程可超过 100%；第一份样本不可计算增量。
            let cpu = match (previous, sample.cpu_ms) {
                (Some((time, before)), Some(after)) => format!("{:.2}", (after - before).max(0.0) / now.duration_since(time).as_secs_f64() / 10.0),
                _ => "unavailable".into(),
            };
            let window_ms = previous.map_or(0, |(time, _)| now.duration_since(time).as_millis());
            log::info!("performance.native scope=host_process pid={} os={} uptime_ms={} window_ms={} cpu_percent_one_core={} cpu_total_ms={} rss_bytes={} peak_rss_bytes={}",
                std::process::id(), std::env::consts::OS, started.elapsed().as_millis(), window_ms, cpu,
                sample.cpu_ms.map_or_else(|| "unavailable".into(), |value| format!("{value:.0}")),
                value(sample.rss_bytes), value(sample.peak_rss_bytes));
            previous = sample.cpu_ms.map(|cpu| (now, cpu));
            // 与 JS 线程独立；系统休眠时不唤醒设备。
            std::thread::sleep(Duration::from_secs(30));
        }
    }).is_err() {
        RUNNING.store(false, Ordering::Relaxed);
        log::warn!("performance.native unavailable reason=worker_start_failed");
    }
}

pub fn stop() { RUNNING.store(false, Ordering::Relaxed); }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_process_metrics_are_readable_and_cpu_is_monotonic() {
        let before = metrics();
        let after = metrics();
        assert!(before.cpu_ms.is_some_and(|value| value.is_finite() && value >= 0.0));
        assert!(after.cpu_ms.unwrap() >= before.cpu_ms.unwrap());
        assert!(after.rss_bytes.is_some_and(|value| value > 0));
        assert!(after.peak_rss_bytes.is_some_and(|value| value > 0));
        assert_eq!(value(None), "unavailable");
    }
}
