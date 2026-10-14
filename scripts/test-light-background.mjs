import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transpileModule, ModuleKind } from 'typescript';

// 读取真实调色算法与主题样式，检查浅色应用、深色隔离及恢复默认。
const moduleValue = { exports: {} };
const code = transpileModule(readFileSync('src/utils/lightBackground.ts', 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
new Function('module', 'exports', code)(moduleValue, moduleValue.exports);
const palette = moduleValue.exports.buildLightBackground('#e5e7eb');
const artifacts = mkdtempSync(join(tmpdir(), 'coolapk-light-background-'));
const fixture = join(artifacts, 'theme.html');
const vars = Object.entries(palette).map(([key,value]) => `--light-custom-${key}:${value}`).join(';');
writeFileSync(fixture, `<!doctype html><html data-theme="light"><head><style>${readFileSync('src/styles/themes.css', 'utf8')}body{background:var(--background);}article{background:var(--surface);color:var(--text-primary);}</style></head><body><article>正文预览</article><script>
  const root=document.documentElement,card=document.querySelector('article');
  const surface=()=>getComputedStyle(card).backgroundColor;
  const checks={defaultWhite:surface()==='rgb(255, 255, 255)'};
  root.setAttribute('data-light-background','custom');root.style.cssText=${JSON.stringify(vars)};
  checks.customLight=surface()!=='rgb(255, 255, 255)'&&getComputedStyle(document.body).backgroundColor==='rgb(229, 231, 235)';
  root.setAttribute('data-theme','dark');checks.darkUnchanged=surface()==='rgb(24, 27, 30)';
  root.setAttribute('data-theme','light');checks.returnToLight=surface()!=='rgb(255, 255, 255)';
  root.removeAttribute('data-light-background');checks.resetDefault=surface()==='rgb(255, 255, 255)';
  document.body.dataset.results=encodeURIComponent(JSON.stringify(checks));
  </script></body></html>`);
const browser = process.env.LAYOUT_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const result = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + join(artifacts, 'profile'), '--dump-dom', pathToFileURL(fixture).href], { windowsHide: true, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
if (result.error) throw result.error;
const encoded = result.stdout.match(/data-results="([^"]+)"/)?.[1];
if (!encoded) throw new Error('浏览器未返回主题验证结果');
const checks = JSON.parse(decodeURIComponent(encoded));
console.log(JSON.stringify({ checks, artifacts }, null, 2));
if (Object.values(checks).some(value => !value)) throw new Error('浅色界面底色验证失败');
