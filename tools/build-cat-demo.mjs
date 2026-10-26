import fs from 'node:fs';
const template=fs.readFileSync('tools/cat-cafe.template.html','utf8');
fs.mkdirSync('cat-cafe/assets',{recursive:true});
const titles={index:'猫と、人と。ひだまりのような出会いを',about:'私たちの想い',cats:'猫たちの紹介',visit:'料金・ご利用案内',contact:'お問い合わせ'};
for(const [name,title] of Object.entries(titles)){
const html=template.replace(/<!-- PAGE:(\w+) -->([\s\S]*?)<!-- END:\1 -->/g,(_,id,content)=>id===name?content:'').replace('<title>こもれび猫日和｜保護猫カフェ・制作デモ</title>','<title>'+title+'｜こもれび猫日和・制作デモ</title>');
fs.writeFileSync('cat-cafe/'+name+'.html',html);}
console.log('Generated five static pages');
