import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, compileStyle } from '@vue/compiler-sfc';

// 使用真实模板和样式复现系统字体放大；不执行页面脚本或缓存清理操作。
const browser = process.env.LAYOUT_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
if (!existsSync(browser)) throw new Error('请通过 LAYOUT_BROWSER 指定 Chromium 浏览器路径');
const artifacts = mkdtempSync(join(tmpdir(), 'coolapk-settings-layout-'));
const baseline = process.argv.includes('--baseline');
function source(path) {
  return parse(baseline ? execFileSync('git', ['show', 'HEAD:' + path], { encoding: 'utf8' }) : readFileSync(path, 'utf8')).descriptor;
}
const layout = source('src/pages/settings/SettingsLayout.vue');
const button = source('src/components/common/AppButton.vue');
const toggle = source('src/components/common/AppSwitch.vue');
const iconButton = source('src/components/common/AppIconButton.vue');
const vue = readFileSync('node_modules/vue/dist/vue.global.prod.js', 'utf8');
const baseCss = ['tokens.css', 'themes.css', 'reset.css'].map(name => readFileSync('src/styles/' + name, 'utf8')).join('\n');
const ids = new Map([[layout,'layout'],[button,'button'],[toggle,'toggle'],[iconButton,'icon-button']]);
const scope = descriptor => 'data-v-' + (ids.get(descriptor) || 'page');
const templateFor = (descriptor, text = descriptor.template.content) => text.replace(/<([a-zA-Z][\w-]*)(?=[\s/>])/g, '<$1 ' + scope(descriptor));
// 保留组件作用域，避免图标按钮的 size-sm 等规则污染普通按钮。
const styles = descriptor => descriptor.styles.map(style => compileStyle({source:style.content,filename:'fixture.vue',id:scope(descriptor),scoped:true}).code).join('\n');
const cases = baseline ? [['Download', 360, 1.25]] : [
  ['Download', 360, 1.25], ['Download', 320, 1.5], ['Download', 390, 1], ['Download', 1100, 1],
  ['About', 360, 1.25], ['About', 320, 1.5], ['About', 1100, 1],
];
for (const [name, width, scale] of cases) {
  const page = source('src/pages/settings/' + name + 'SettingsPage.vue');
  const template = page.template.content.replace('src="../../assets/coolapk-logo-rounded.png"', 'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"');
  const css = baseCss + styles(button) + styles(toggle) + styles(iconButton) + styles(page) + styles(layout) + '.fas,.far{display:inline-block;width:1.25em}';
  const script = `
const calls=[];
Vue.createApp({template:${JSON.stringify(templateFor(page, template))},data:()=>({
  isAndroid:true,settingsStore:{settings:{autoCleanCache:true,cacheThresholdMB:500,cacheTtlDays:7,imageQuality:'hd',maxConcurrentDownloads:3,updateSpeedLimitKBps:0}},
  displayDownloadPath:'',cacheDirectoryText:'/data/user/0/com.coolapk.desktop/cache/CoolapkDesktopCache/images',
  cacheBytes:76441190,cacheImageBytes:76441190,cacheUpdateBytes:0,cacheError:'',cacheBusy:false,historyExporting:false,historyExportResult:'',
  appVersion:'1.34.1',channelLabel:'稳定版',buildCommit:'12345678',techStack:['Tauri 2','Vue 3','TypeScript','Rust','Pinia'],repoStats:{stars:1000,forks:100,issues:10}
}),methods:{formatBytes:n=>(n/1024/1024).toFixed(1)+' MB',formatCount:String,cleanExpiredCache:()=>calls.push('expired'),clearCache:()=>calls.push('all'),checkUpdate:()=>calls.push('update')}})
.component('AppButton',{props:{variant:{default:'primary'},size:{default:'md'},icon:String,disabled:Boolean,loading:Boolean,block:Boolean},template:${JSON.stringify(templateFor(button))}})
.component('AppSwitch',{props:['modelValue','disabled'],template:${JSON.stringify(templateFor(toggle))}})
.component('AppIconButton',{props:['icon','title','size'],template:${JSON.stringify(templateFor(iconButton))}}).mount('#app');
Vue.nextTick(()=>{
  const fonts=[...document.querySelectorAll('#app *')].map(el=>[el,parseFloat(getComputedStyle(el).fontSize)]);
  for(const [el,size] of fonts) el.style.fontSize=size*${scale}+'px';
  const box=el=>el.getBoundingClientRect(),content=document.querySelector('.settings-content');
  const inside=el=>box(el).left>=box(content).left&&box(el).right<=box(content).right+1;
  const oneLine=el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length===1;};
  const controlsFit=[...document.querySelectorAll('select,button,.row-info,.cache-path')].every(inside);
  let cacheLabelsReadable=true,cacheActionsBelow=true,cacheValuesOneLine=true,clicksWork=true;
  if('${name}'==='Download'){
    cacheLabelsReadable=oneLine(document.querySelector('.cache-total-label'));
    cacheValuesOneLine=[...document.querySelectorAll('.cache-total-value,.cache-breakdown-item strong')].every(oneLine);
    cacheActionsBelow=innerWidth>600||box(document.querySelector('.cache-usage-actions')).top>=box(document.querySelector('.cache-usage-info')).bottom;
    document.querySelectorAll('.cache-usage-actions button').forEach(button=>button.click());
    clicksWork=calls.join(',')==='expired,all';
  }else{
    document.querySelector('.about-head button').click();clicksWork=calls.join(',')==='update';
  }
  parent.postMessage({name:'${name}',width:innerWidth,scale:${scale},controlsFit,cacheLabelsReadable,cacheActionsBelow,cacheValuesOneLine,clicksWork,pageFits:content.scrollWidth<=content.clientWidth+1},'*');
});`;
  const childHtml = '<!doctype html><html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style><body><div data-v-layout class="settings-layout-card ' + (width <= 600 ? 'is-mobile' : '') + '"><section data-v-layout class="settings-content"><div id="app"></div></section></div><script>' + vue + '</script><script>' + script + '</script></body></html>';
  const html = '<html><body style="margin:0"><script>addEventListener("message",e=>document.body.dataset.result=encodeURIComponent(JSON.stringify(e.data)));const frame=document.createElement("iframe");frame.style="border:0;width:' + width + 'px;height:1500px";frame.srcdoc=' + JSON.stringify(childHtml).replaceAll('<', '\\u003c') + ';document.body.append(frame);</script></body></html>';
  const id = name + '-' + width, fixture = join(artifacts, id + '.html'), screenshot = join(artifacts, id + '.png');
  writeFileSync(fixture, html);
  const result = spawnSync(browser, ['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--user-data-dir='+join(artifacts,'profile-'+id),'--window-size='+Math.max(width,500)+',1500','--virtual-time-budget=3000','--dump-dom','--screenshot='+screenshot,pathToFileURL(fixture).href], { windowsHide:true,encoding:'utf8',timeout:20000,maxBuffer:10*1024*1024 });
  if (result.error) throw result.error;
  const encoded = result.stdout.match(/data-result="([^"]+)"/)?.[1];
  if (!encoded) throw new Error('页面未返回布局结果：' + result.stderr.slice(-500));
  const check = JSON.parse(decodeURIComponent(encoded));
  console.log(JSON.stringify({ ...check, screenshot }));
  const passed = check.controlsFit && check.cacheLabelsReadable && check.cacheActionsBelow && check.cacheValuesOneLine && check.clicksWork && check.pageFits;
  if (baseline ? passed : !passed) throw new Error(baseline ? '基线未复现布局问题' : '设置页布局验证失败');
}
