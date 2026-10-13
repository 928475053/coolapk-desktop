/**
 * 历史版本可能已将右侧评论开启状态写入配置。
 * 首次升级时统一关闭；保存迁移标记后，只尊重用户此后主动设置的值。
 */
export function resolveDesktopCommentsOnRight(value: unknown, migrationCompleted: unknown): boolean {
  return migrationCompleted === true && value === true;
}
