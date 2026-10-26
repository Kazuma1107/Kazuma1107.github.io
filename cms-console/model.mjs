export const roles = {admin:'管理者',editor:'編集者',viewer:'閲覧者'};
export const statuses = {published:'公開中',review:'承認待ち',draft:'下書き'};
export function seed() {
  const categories=[{id:'company',name:'企業情報',path:'/company/'},{id:'business',name:'事業情報',path:'/business/'},{id:'news',name:'ニュース',path:'/news/'},{id:'recruit',name:'採用情報',path:'/recruit/'},{id:'sustainability',name:'サステナビリティ',path:'/sustainability/'}];
  const titles=['私たちについて','ものづくりを支える事業','新製品の取り扱いを開始しました','未来をつくる仲間へ','地域とともに歩む取り組み'];
  const pages=Array.from({length:100},(_,i)=>{const c=categories[i%5], n=Math.floor(i/5)+1, title=titles[i%5]+(n>1?` ${String(n).padStart(2,'0')}`:'');const body=`<h2>${title}</h2><p>地域と産業の未来を、ともにつくる。</p><p>NORTHFIELD GROUPは、一人ひとりの想いを確かな価値へと変えていきます。この文章は操作デモ用の架空コンテンツです。</p><h3>私たちが大切にすること</h3><ul><li>現場の声から考える</li><li>持続可能な仕組みを育てる</li><li>新しい可能性に挑戦する</li></ul>`;const status=i<82?'published':i<89?'review':'draft';return {id:i+1,title,slug:`${c.path}page-${n}/`,category:c.id,status,body,updated:'2026/10/26',version:1,live:status==='published'?{title,body}:null,revisions:[]};});
  return {schema:1,pages,categories,inquiries:[{id:'INQ-024',name:'青葉製作所（架空）',subject:'製品の仕様・お見積もりについて',category:'製品相談',status:'未対応',owner:'未割り当て',body:'製品NF-102の仕様を確認したく、ご連絡いたしました。カタログと見積もりについて教えてください。',history:[]},{id:'INQ-023',name:'北山商事（架空）',subject:'お取引に関するご相談',category:'取引相談',status:'対応中',owner:'営業担当',body:'新規のお取引について担当者様へご相談したいです。',history:[{at:'2026/10/25 14:30',text:'営業担当に確認を依頼。',by:'管理者'}]},{id:'INQ-022',name:'サンプル応募者（架空）',subject:'採用に関するお問い合わせ',category:'採用',status:'完了',owner:'採用担当',body:'募集職種について教えてください。',history:[{at:'2026/10/24 10:20',text:'募集ページを案内し、対応を完了。',by:'管理者'}]}],products:[{id:'NF-101',name:'産業用センサーユニット',price:24800,revision:1},{id:'NF-102',name:'高精度コントローラー',price:58000,revision:1}],sync:{failed:false,last:null,log:[]},audit:[{at:'2026/10/26 09:30',actor:'サンプル管理者',action:'初期データを準備',target:'100ページ / 5カテゴリー'}]};
}
const now=()=>new Date().toLocaleString('ja-JP',{hour12:false});
export function canEdit(role,page){return role==='admin'||(role==='editor'&&page.category==='business');}
export function command(state,role,action,input={}){
  const s=structuredClone(state), log=(what,target)=>s.audit.unshift({at:now(),actor:roles[role]||'閲覧者',action:what,target});
  if(!roles[role])throw Error('役割が不正です。');
  const admin=()=>{if(role!=='admin')throw Error('この操作は管理者のみ実行できます。');};
  if(['save','submit','publish','return','restore'].includes(action)){
    const p=s.pages.find(x=>x.id===input.id);if(!p)throw Error('ページが見つかりません。');
    if(!canEdit(role,p))throw Error('このカテゴリーを編集する権限がありません。');
    if(action==='save'){
      if(!input.title?.trim()||input.title.trim().length>100)throw Error('タイトルは1〜100文字で入力してください。');
      if(!input.body?.trim()||input.body.length>20000)throw Error('本文は1〜20,000文字で入力してください。');
      if(p.status==='review')throw Error('承認待ちです。差し戻してから編集してください。');
      if(!s.categories.some(c=>c.id===input.category))throw Error('カテゴリーを選択してください。');
      if(role==='editor'&&input.category!=='business')throw Error('編集者は事業情報のみ編集できます。');
      p.revisions.unshift({title:p.title,body:p.body,category:p.category,version:p.version,at:now()});p.revisions=p.revisions.slice(0,10);
      p.title=input.title.trim();p.body=input.body;p.category=input.category;p.version++;p.status='draft';log('下書きを保存',p.title);
    }
    if(action==='submit'){if(p.status!=='draft')throw Error('下書きのみ申請できます。');p.status='review';log('公開を申請',p.title);}
    if(action==='publish'){admin();if(p.status!=='review')throw Error('承認待ちのページのみ公開できます。');p.status='published';p.live={title:p.title,body:p.body};log('承認して公開',p.title);}
    if(action==='return'){admin();if(p.status!=='review')throw Error('承認待ちのページのみ差し戻せます。');p.status='draft';log('下書きに差し戻し',p.title);}
    if(action==='restore'){admin();if(p.status==='review')throw Error('差し戻してから復元してください。');const r=p.revisions.find(x=>x.version===input.version);if(!r)throw Error('履歴がありません。');const old={title:p.title,body:p.body,category:p.category,version:p.version,at:now()};p.title=r.title;p.body=r.body;p.category=r.category;p.version++;p.status='draft';p.revisions.unshift(old);p.revisions=p.revisions.slice(0,10);log('過去版を下書きに復元',p.title);}
    p.updated=new Date().toLocaleDateString('ja-JP');
  } else if(action==='inquiry'){
    admin();const q=s.inquiries.find(x=>x.id===input.id);if(!q)throw Error('問い合わせがありません。');
    if(!['未対応','対応中','完了'].includes(input.status))throw Error('状態が不正です。');
    if(!input.note?.trim()||input.note.length>1000)throw Error('対応メモを1〜1,000文字で入力してください。');
    q.status=input.status;q.owner=input.owner?.trim().slice(0,50)||'未割り当て';q.history.push({at:now(),text:input.note.trim(),by:roles[role]});log('問い合わせ対応を記録',q.id);
  } else if(action==='category'){
    admin();const name=input.name?.trim(),id=input.id?.trim();
    if(!name||name.length>30||!id||!/^[a-z][a-z0-9-]{1,29}$/.test(id))throw Error('名称は30文字以内、キーは英小文字で始まる2〜30文字の英数字・ハイフンで指定してください。');
    if(s.categories.some(c=>c.id===id||c.name===name))throw Error('同じカテゴリーが既にあります。');
    s.categories.push({id,name,path:`/${id}/`});log('カテゴリーを追加',name);
  } else if(action==='sync'){
    admin();const feed=[{id:'NF-101',name:'産業用センサーユニット',price:25800,revision:2},{id:'NF-102',name:'高精度コントローラー',price:58000,revision:1},{id:'NF-103',name:'小型データロガー',price:32800,revision:1}];
    let add=0,update=0,skip=0,fail=0;
    for(const row of feed){if(input.fail&&row.id==='NF-103'){fail++;continue;}const old=s.products.find(x=>x.id===row.id);if(!old){s.products.push(row);add++;}else if(old.revision<row.revision){Object.assign(old,row);update++;}else skip++;}
    s.sync.failed=fail>0;s.sync.last=now();s.sync.log.unshift({at:now(),text:`追加 ${add} / 更新 ${update} / 変更なし ${skip} / 失敗 ${fail}`,error:fail>0});s.sync.log=s.sync.log.slice(0,8);log(fail?'商品同期（一部失敗）':'商品同期完了（模擬）',s.sync.log[0].text);
  } else throw Error('未対応の操作です。');
  s.audit=s.audit.slice(0,60);return s;
}
