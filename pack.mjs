// pack.mjs — 將 archive.org 下載的 DOS 遊戲 zip 打包成 js-dos bundle
//
// 用法：node pack.mjs <遊戲.zip> <啟動指令>
// 範例：node pack.mjs JINYONG.zip "call play.bat"
//       node pack.mjs DOOM.zip "doom.exe"
//
// 需要先安裝：npm install jszip

import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

const [,, inputZip, startCmd] = process.argv;

if (!inputZip || !startCmd) {
  console.error('❌ 用法：node pack.mjs <遊戲.zip> <啟動指令>');
  console.error('   範例：node pack.mjs JINYONG.zip "call play.bat"');
  process.exit(1);
}

if (!fs.existsSync(inputZip)) {
  console.error(`❌ 找不到檔案：${inputZip}`);
  process.exit(1);
}

console.log(`📦 讀取 ${inputZip}...`);
const data = fs.readFileSync(inputZip);
const original = await JSZip.loadAsync(data);
const newZip = new JSZip();

// 複製所有原始遊戲檔案
const entries = Object.entries(original.files);
console.log(`📂 共 ${entries.length} 個檔案，打包中...`);

for (const [name, entry] of entries) {
  if (entry.dir) {
    newZip.folder(name);
  } else {
    newZip.file(name, await entry.async('nodebuffer'));
  }
}

// 注入 .jsdos/dosbox.conf（js-dos v8 必要）
newZip.file('.jsdos/dosbox.conf', `[cpu]
cycles=max

[autoexec]
mount c .
c:
${startCmd}
`);

console.log(`⚙️  注入 .jsdos/dosbox.conf，啟動指令：${startCmd}`);

const out = await newZip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 6 }
});

const outName = path.basename(inputZip, '.zip') + '.jsdos';
fs.writeFileSync(outName, out);
console.log(`✅ 完成：${outName}（${(out.length / 1024 / 1024).toFixed(1)} MB）`);
console.log(`👉 把 ${outName} 放進專案資料夾，更新 index.html 的 url 即可`);
