import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);
const fontAwesomeRoot = join(require.resolve('@fortawesome/fontawesome-free/package.json'), '..');
const moduleId = 'virtual:android-icons.css';

/** Android 使用内置 SVG 遮罩，避免系统字体替换或字体加载失败导致私用区字符显示为方框。 */
export function createAndroidIconCss(names: Iterable<string>, root = fontAwesomeRoot): string {
  const rules: string[] = [];
  const maskedSelectors: string[] = [];
  for (const name of new Set(names)) {
    if (!/^fa-[a-z0-9-]+$/.test(name)) continue;
    for (const [style, classes] of [['solid', ['fas', 'fa-solid', 'fa']], ['regular', ['far', 'fa-regular']], ['brands', ['fab', 'fa-brands']]] as const) {
      const path = join(root, 'svgs', style, `${name.slice(3)}.svg`);
      if (!existsSync(path)) continue;
      // 保留供应商 SVG 的许可证注释；数据 URI 随 CSS 打包，不产生额外网络请求。
      const uri = `data:image/svg+xml,${encodeURIComponent(readFileSync(path, 'utf8'))}`;
      const selectors = classes.map(className => `:root[data-icon-renderer="svg"] .${className}.${name}::before`).join(',');
      maskedSelectors.push(selectors);
      rules.push(`${selectors}{--app-icon-svg:url("${uri}");}`);
    }
  }
  if (!rules.length) return '';
  // 通用布局只输出一次；保持图标的颜色、尺寸和宿主元素上的旋转动画。
  rules.push(`${maskedSelectors.join(',')}{content:""!important;display:inline-block;width:100%;height:1em;vertical-align:-.125em;background-color:currentColor;-webkit-mask:var(--app-icon-svg) center/contain no-repeat;mask:var(--app-icon-svg) center/contain no-repeat;}`);
  return rules.join('\n');
}

/** 从组件与配置中收集图标名称，同时覆盖旧名称别名和动态切换的图标，避免打包整套图标。 */
export function androidIconSvgPlugin(): Plugin {
  let sourceRoot = '';
  return {
    name: 'android-icon-svg',
    configResolved(config) { sourceRoot = join(config.root, 'src'); },
    resolveId(id) { if (id === moduleId) return `\0${moduleId}`; },
    load(id) {
      if (id !== `\0${moduleId}`) return;
      const names = new Set<string>();
      const visit = (directory: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) { if (entry.name !== '__tests__') visit(path); }
          else if (/\.(vue|ts|css)$/.test(entry.name)) {
            this.addWatchFile(path);
            for (const match of readFileSync(path, 'utf8').matchAll(/\bfa-[a-z0-9-]+\b/g)) names.add(match[0]);
          }
        }
      };
      visit(sourceRoot);
      return createAndroidIconCss(names);
    },
  };
}
