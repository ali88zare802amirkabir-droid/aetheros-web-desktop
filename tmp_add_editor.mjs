import fs from 'fs';
const p = 'src/apps/settings/defs.ts';
let d = fs.readFileSync(p,'utf8');
d = d.trim().replace(/\];$/, '');
d += ",\n  { id:'editor.font', section:'finder', label:'Editor font', labelFa:'فونت ویرایشگر', control:'select', options:[{value:'JetBrains Mono',label:'JetBrains Mono'},{value:'Fira Code',label:'Fira Code'},{value:'Consolas',label:'Consolas'},{value:'monospace',label:'monospace'}], default:'JetBrains Mono', keywords:['editor','font'] },\n  { id:'editor.fontSize', section:'finder', label:'Editor font size', labelFa:'اندازه فونت ویرایشگر', control:'slider', min:10, max:18, step:1, unit:'px', default:13, keywords:['editor','size'] },\n  { id:'editor.wrap', section:'finder', label:'Word wrap', labelFa:'شکستن خط', control:'toggle', default:true, keywords:['wrap'] }\n];\n";
fs.writeFileSync(p,d);
console.log('ok');
