import { watch } from 'vue';
import { detectAccountDevice, fallbackAccountDevice, type AccountDeviceApi, type AccountDeviceProfile } from './accountDevice';

interface DeviceSyncAuth { isLoggedIn: boolean; user: { uid: string | number } | null }
interface DeviceSyncSettings {
  settings: { deviceFingerprint: { customFingerprint: boolean } };
  setAutomaticDeviceProfile(profile: AccountDeviceProfile | null): Promise<void>;
}

/** 账号变更立即清除旧结果；迟到的请求不能覆盖新账号，也不能覆盖用户手动指纹。 */
export function setupAccountDeviceSync(auth: DeviceSyncAuth, settings: DeviceSyncSettings, api: AccountDeviceApi & { getDeviceInfo(): Promise<any> }) {
  let epoch = 0;
  return watch(() => [auth.isLoggedIn ? String(auth.user?.uid || '') : '', settings.settings.deviceFingerprint.customFingerprint] as const, async ([uid, custom], _previous, onCleanup) => {
    const requestEpoch = ++epoch;
    let active = true;
    onCleanup(() => { active = false; });
    const current = () => active && requestEpoch === epoch;
    // 清理先于任何异步请求，防止切换账号时沿用上个账号的手机。
    await settings.setAutomaticDeviceProfile(null);
    if (custom || !current()) return;
    try {
      const info = await api.getDeviceInfo().catch(() => null);
      if (!current()) return;
      // Android 真机使用系统公开设备信息；其余平台统一使用 Android 兼容协议。
      if (info?.data?.defaultProfile?.source === 'native' && info.data.defaultProfile.platform === 'android') return;
      await settings.setAutomaticDeviceProfile({ ...fallbackAccountDevice });
      if (!uid || !current()) return;
      const profile = await detectAccountDevice(uid, api, current);
      if (profile && current()) await settings.setAutomaticDeviceProfile(profile);
    } catch {
      // 网络失败保留兜底模板，不能影响登录和正常使用。
    }
  }, { immediate: true, flush: 'sync' });
}
