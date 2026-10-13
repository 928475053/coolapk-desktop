// Linux WebKit/GTK 的媒体查询不一定与 KDE 桌面主题一致，直接读取 XDG Portal。
#[cfg(target_os = "linux")]
use zbus::{
    Connection, Proxy,
    zvariant::{OwnedValue, Value},
};

#[cfg(any(target_os = "linux", test))]
fn color_scheme(value: u32) -> Option<&'static str> {
    match value {
        1 => Some("dark"),
        2 => Some("light"),
        _ => None, // 无偏好时交由 WebView 判断。
    }
}

#[cfg(target_os = "linux")]
async fn portal(connection: &Connection) -> zbus::Result<Proxy<'_>> {
    Proxy::new(
        connection,
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.Settings",
    )
    .await
}

#[cfg(target_os = "linux")]
async fn read(proxy: &Proxy<'_>) -> zbus::Result<Option<&'static str>> {
    // ReadOne 是 v2 接口；旧 Portal 的 Read 返回双层 variant。
    let value: OwnedValue = match proxy
        .call("ReadOne", &("org.freedesktop.appearance", "color-scheme"))
        .await
    {
        Ok(value) => value,
        Err(_) => {
            proxy
                .call("Read", &("org.freedesktop.appearance", "color-scheme"))
                .await?
        }
    };
    let mut value: &Value<'_> = &value;
    while let Value::Value(inner) = value {
        value = inner;
    }
    Ok(color_scheme(u32::try_from(value)?))
}

#[tauri::command]
pub async fn get_linux_system_theme() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        let result = tokio::time::timeout(std::time::Duration::from_secs(3), async {
            let connection = Connection::session().await?;
            read(&portal(&connection).await?).await
        })
        .await;
        return result
            .ok()
            .and_then(Result::ok)
            .flatten()
            .map(str::to_owned);
    }
    #[cfg(not(target_os = "linux"))]
    None
}

#[cfg(target_os = "linux")]
pub fn monitor(app: tauri::AppHandle) {
    use futures_util::StreamExt;
    use tauri::Emitter;
    tauri::async_runtime::spawn(async move {
        loop {
            let result: zbus::Result<()> = async {
                let connection = Connection::session().await?;
                let proxy = portal(&connection).await?;
                let mut changes = proxy.receive_signal("SettingChanged").await?;
                // 先订阅再读取，避免启动过程中漏掉系统切换。
                let _ = app.emit("linux-system-theme-changed", read(&proxy).await?);
                while let Some(message) = changes.next().await {
                    let Ok((namespace, key, value)) =
                        message.body().deserialize::<(String, String, OwnedValue)>()
                    else {
                        continue;
                    };
                    if namespace != "org.freedesktop.appearance" || key != "color-scheme" {
                        continue;
                    }
                    if let Ok(value) = u32::try_from(&value) {
                        let _ = app.emit("linux-system-theme-changed", color_scheme(value));
                    }
                }
                Ok(())
            }
            .await;
            if let Err(error) = result {
                log::debug!("Linux 主题 Portal 暂不可用: {error}");
            }
            let _ = app.emit("linux-system-theme-changed", Option::<String>::None);
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn portal_preferences_do_not_force_light_when_unspecified() {
        assert_eq!(color_scheme(1), Some("dark"));
        assert_eq!(color_scheme(2), Some("light"));
        assert_eq!(color_scheme(0), None);
        assert_eq!(color_scheme(99), None);
    }
}
