import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve('cat-cafe'),files=['index','about','cats','visit','contact'];let links=0;
for(const file of files){const html=fs.readFileSync(path.join(root,file+'.html'),'utf8');assert.equal((html.match(/<h1>/g)||[]).length,1,file+' must have one h1');assert(html.includes('noindex,nofollow'));assert(!html.includes('<!-- PAGE:'));for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){let url=m[1].split(/[?#]/)[0];if(!url||url.startsWith('http'))continue;let target=path.resolve(root,url);if(url.endsWith('/'))target=path.join(target,'index.html');assert(fs.existsSync(target),'missing '+file+': '+url);links++;}}
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');assert(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage)\b/.test(js),'No transmission/persistence in demo');
for(const name of ['hero','mugi','sumi','hana'])assert(fs.statSync(path.join(root,'assets',name+'.webp')).size>10000);
console.log('PASS: 5 static pages, '+links+' local references, image assets, no form transmission or storage.');
