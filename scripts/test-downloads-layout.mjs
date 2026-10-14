import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from '@vue/compiler-sfc';

// 渲染原有页面模板和样式；任务使用本地样本，不调用下载或上传接口。
const browser = process.env.LAYOUT_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
if (!existsSync(browser)) throw new Error('请通过 LAYOUT_BROWSER 指定 Chromium 浏览器路径');
const artifacts = mkdtempSync(join(tmpdir(), 'coolapk-downloads-layout-'));
const baseline = process.argv.includes('--baseline');
const source = baseline ? execFileSync('git',['show','HEAD:src/pages/DownloadsPage.vue'],{encoding:'utf8'}) : readFileSync('src/pages/DownloadsPage.vue','utf8');
const page = parse(source).descriptor;
const empty = parse(readFileSync('src/components/common/EmptyState.vue','utf8')).descriptor;
const emptyMode = process.argv.includes('--empty');
const button = parse(readFileSync('src/components/common/AppButton.vue','utf8')).descriptor;
const css = ['tokens.css','themes.css','reset.css'].map(name => readFileSync('src/styles/' + name,'utf8')).join('\n') + page.styles.map(style => style.content.replace(/:deep\(([^)]+)\)/g,'$1')).join('\n') + empty.styles.map(style => style.content).join('\n') + button.styles.map(style => style.content).join('\n') + '.fas,.far{display:inline-block;width:1.25em}';
const vue = readFileSync('node_modules/vue/dist/vue.global.prod.js','utf8');
const task = { id:'layout-test',kind:'apk',title:'搜狗输入法测试长名称',packageName:'com.sohu.inputmethod.sogou.' + 'verylongpackage'.repeat(8),versionName:'20.17.0',logoUrl:'',fileName:'sogou-' + 'longfilename'.repeat(8) + '.apk',targetPath:'',status:'paused',downloaded:24500000,total:98671000,speed:0,error:'' };
for (const [width, scale] of baseline ? [[360,1.25]] : [[360,1.25],[320,1.5],[390,1],[1440,1]]) {
  const script = `
const task = ${JSON.stringify(task)};
const values = {selectedMode:'download',selectedTab:'active',downloadStore:{completedTotalBytes:0,historyTasks:[],tasks:[task]},uploadStore:{activeCount:0,historyTasks:[]},allTransferSpeed:0,allActiveCount:1,completedCount:0,activeTasksHint:'下载已暂停',completedTasksHint:'暂无完成记录',storageCardHint:'暂无占用',currentActiveCount:1,currentHistoryCount:0,downloadDirTooltip:'默认下载目录',hasActiveDownloading:false,hasActivePaused:true,activeTasks:[task],visibleTasks:[task],visibleUploadTasks:[],isAndroid:true};
if (${emptyMode}) Object.assign(values,{allActiveCount:0,currentActiveCount:0,activeTasks:[],visibleTasks:[],hasActivePaused:false});
Vue.createApp({template:${JSON.stringify(page.template.content)},data:()=>values,methods:{formatBytes:()=> '94.1 MB',taskSizeText:()=> '94.1 MB',statusIcon:()=> 'fas fa-pause',statusText:()=> '已暂停',progressPercent:()=>25,progressSizeText:()=> '23.4 MB / 94.1 MB',remainingTimeText:()=> '',formatDate:()=> '',handleClearHistory:()=>{}}}).component('AppButton',{props:{variant:{default:'primary'},size:{default:'md'},icon:String,disabled:Boolean,loading:Boolean,block:Boolean},template:${JSON.stringify(button.template.content)}}).component('EmptyState',{props:['icon','title','description'],template:${JSON.stringify(empty.template.content)}}).component('AppImage',{template:'<div></div>'}).mount('#app');
Vue.nextTick(() => {
  const fonts = [...document.querySelectorAll('#app *')].map(el => [el,parseFloat(getComputedStyle(el).fontSize)]);
  for(const [el,size] of fonts) el.style.fontSize = size * ${scale} + 'px';
  const page=document.querySelector('.downloads-page'),card=document.querySelector('.download-card'),pkg=document.querySelector('.meta-pkg'),title=document.querySelector('.downloads-title');
  const box=el=>el.getBoundingClientRect();
  const summaryBoxes=[...document.querySelectorAll('.summary-card')].map(box);
  const range=document.createRange();range.selectNodeContents(title);
  parent.postMessage({width:innerWidth,scale:${scale},pageWidth:page.clientWidth,pageScrollWidth:page.scrollWidth,packageFits:!pkg||box(pkg).left>=box(card).left&&box(pkg).right<=box(card).right&&(innerWidth>900||pkg.scrollWidth<=pkg.clientWidth+1),titleOneLine:box(title.closest('.header-main')).width<=1||range.getClientRects().length===1,summarySameRow:innerWidth>600||summaryBoxes.every(b=>Math.abs(b.top-summaryBoxes[0].top)<1),emptyCompact:!${emptyMode}||innerWidth>600||(box(document.querySelector('.downloads-empty')).top<400&&box(document.querySelector('.downloads-empty')).height<360),progressVisible:${emptyMode}||box(document.querySelector('.download-progress-track')).width>0,actionsVisible:${emptyMode}||[...document.querySelectorAll('.download-actions button')].some(el=>el.textContent.includes('继续'))},'*');
});`;
  const childHtml = '<!doctype html><html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style><body><div id="app"></div><script>' + vue + '</script><script>' + script + '</script></body></html>';
  const encodedHtml = JSON.stringify(childHtml).replaceAll('<','\\u003c');
  const html = '<html><body style="margin:0"><script>addEventListener("message",event=>{document.body.dataset.result=encodeURIComponent(JSON.stringify(event.data));});const frame=document.createElement("iframe");frame.style="border:0;width:' + width + 'px;height:1500px";frame.srcdoc=' + encodedHtml + ';document.body.append(frame);</script></body></html>';
  const fixture=join(artifacts,width+'.html'),screenshot=join(artifacts,width+'.png');
  writeFileSync(fixture,html);
  const result=spawnSync(browser,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--user-data-dir='+join(artifacts,'profile-'+width),'--window-size='+Math.max(width,500)+',1500','--virtual-time-budget=3000','--dump-dom','--screenshot='+screenshot,pathToFileURL(fixture).href],{windowsHide:true,encoding:'utf8',timeout:20000,maxBuffer:10*1024*1024});
  if(result.error) throw result.error;
  const encoded=result.stdout.match(/data-result="([^"]+)"/)?.[1];
  if(!encoded) throw new Error('页面未返回布局验证结果：'+result.stderr.slice(-500));
  const check=JSON.parse(decodeURIComponent(encoded));
  console.log(JSON.stringify({...check,screenshot}));
  const passed=check.pageScrollWidth<=check.pageWidth+1&&check.packageFits&&check.titleOneLine&&check.progressVisible&&check.actionsVisible&&check.summarySameRow&&check.emptyCompact;
  if(baseline ? passed : !passed) throw new Error(baseline ? '基线未复现布局问题' : '上传下载布局验证失败');
}
