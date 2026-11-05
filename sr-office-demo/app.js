(() => {
  'use strict';
  const views = {
    overview: '全体像・操作ガイド',
    portal: '① 顧問先との資料共有',
    documents: '② 公文書の取得・仕分け',
    mail: '③ Outlookメール整理',
    payroll: '④ 給与計算の自動化',
    cases: '⑤ 手続・給与の進捗管理',
    architecture: '本番構成と検証事項'
  };
  const companies = {
    abc: { name: '株式会社ABC', code: '28001234', mark: 'ABC' },
    def: { name: '有限会社北斗工業', code: '28005678', mark: 'HK' }
  };
  const originalDocs = [
    { id: 'DOC-01', name: '雇用保険 資格取得確認通知書.pdf', subject: '山田 太郎', code: '28001234', key: 'A-202611-001' },
    { id: 'DOC-02', name: '社会保険 資格取得決定通知.pdf', subject: '佐藤 花子', code: '28005678', key: 'H-202611-017' },
    { id: 'DOC-03', name: '決定通知書_スキャン.pdf', subject: '所属先を特定できない', code: '', key: 'U-202611-052' },
    { id: 'DOC-04', name: '雇用保険 資格取得確認通知書_再取得.pdf', subject: '山田 太郎', code: '28001234', key: 'A-202611-001' }
  ];
  const payrollLabels = ['架空の勤怠取得', '入力データ検証', '支給・控除・差引支給の計算', '前月との差額確認', '顧問先への共有準備'];
  const $ = id => document.getElementById(id);
  const docs = originalDocs.map(d => ({ ...d, status: 'received', company: null, shared: false }));
  const originalMails = [
    { id: 'MAIL-01', from: '担当者 <abc@example.test>', subject: '株式会社ABC 11月勤怠', attachment: '勤怠_11月.xlsx', company: 'abc' },
    { id: 'MAIL-02', from: '総務 <hokuto@example.test>', subject: '北斗工業 雇用契約書', attachment: '雇用契約書.pdf', company: 'def' },
    { id: 'MAIL-03', from: '送信者未登録 <unknown@example.test>', subject: '資料を送ります', attachment: '資料.docx', company: null },
    { id: 'MAIL-04', from: '送信者未登録 <outside@example.test>', subject: '至急確認', attachment: '更新ファイル.zip', company: null }
  ];
  const mails = originalMails.map(m => ({ ...m, status: 'pending', destination: '' }));
  const portalResources = [
    { id: 'RES-R01', type: 'rules', company: 'abc', name: '就業規則_説明用2026年版.pdf', ready: true, published: false },
    { id: 'RES-R02', type: 'rules', company: 'def', name: '就業規則_説明用2026年版.pdf', ready: true, published: false },
    { id: 'RES-P01', type: 'payroll', company: 'abc', name: '2026年11月_給与資料_説明用.pdf', ready: false, published: false }
  ];
  const payrollState = { scenario: 'normal', phase: 0, status: 'idle', issues: [], rows: [], totals: null, prepared: false };
  const cases = [
    { id: 'PROC-241', company: 'abc', title: '雇用保険 資格取得', person: '山田 太郎', owner: '田中', due: '11/12', priority: true, stage: 1, type: 'doc', doc: 'DOC-01', steps: ['依頼受付', '資料確認', '電子申請', '公文書確認', '顧問先共有', '完了'] },
    { id: 'PROC-242', company: 'def', title: '社会保険 資格取得', person: '佐藤 花子', owner: '鈴木', due: '11/15', priority: true, stage: 2, type: 'doc', doc: 'DOC-02', steps: ['依頼受付', '資料確認', '電子申請', '公文書確認', '顧問先共有', '完了'] },
    { id: 'PAY-211', company: 'abc', title: '11月分 給与計算', person: '架空の給与案件', owner: '田中', due: '11/25', priority: false, stage: 0, type: 'payroll', steps: ['勤怠受領', '事前照合', '給与計算', '差分確認', '資料共有', '完了'] }
  ];
  const history = [];
  let caseActivity = false;
  let portalViewed = false;
  let role = 'staff';
  let company = 'abc';
  let portalTab = 'public';
  let toastTimer;
  let activeView = 'overview';
  let dockDismissed = false;
  const guideFeedback = { portal: null, documents: null, mail: null, payroll: null, cases: null };
  function recordGuide(id, action, result) {
    guideFeedback[id] = { action, result };
    dockDismissed = false;
    renderGuides();
    renderActionDock();
  }
  function runGuideAction(id, state) {
    const previous = guideFeedback[id];
    if (!state.run) return;
    state.run();
    if (!state.done && id !== 'payroll' && guideFeedback[id] === previous) recordGuide(id, state.action, state.effect);
  }
  function renderActionDock() {
    const dock = $('action-dock');
    const feedback = guideFeedback[activeView];
    if (!feedback || dockDismissed) { dock.hidden = true; return; }
    const guide = $('guide-' + activeView);
    const rect = guide && guide.getBoundingClientRect();
    if (rect && rect.bottom > 90 && rect.top < window.innerHeight - 90) { dock.hidden = true; return; }
    const state = guideStage(activeView);
    const renderKey = [activeView, feedback.action, feedback.result, state.action, state.done, Boolean(state.run)].join('|');
    if (dock.dataset.renderKey === renderKey) { dock.hidden = false; return; }
    const head = element('div', 'action-dock-head');
    head.append(element('span', '', 'いま行ったこと · ' + views[activeView]));
    const close = element('button', 'action-dock-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '操作案内を閉じる');
    close.addEventListener('click', () => { dockDismissed = true; dock.hidden = true; });
    head.append(close);
    const next = element('div', 'action-dock-next');
    next.append(element('span', '', state.done ? '次の画面' : state.run ? '次に押すボタン' : 'いま自動処理中'));
    const button = element('button', '', state.run ? state.action + ' →' : '自動処理中 · 追加クリック不要');
    button.type = 'button';
    button.disabled = !state.run;
    if (state.run) button.addEventListener('click', () => runGuideAction(activeView, state));
    next.append(button);
    const locations = { portal: 'portal-files', documents: 'document-rows', mail: 'mail-rows', payroll: payrollState.status === 'ready' ? 'payroll-results' : 'payroll-pipeline', cases: 'case-rows' };
    const viewResult = element('button', 'action-dock-view', '画面で変化した場所を見る ↓');
    viewResult.type = 'button';
    viewResult.addEventListener('click', () => $(locations[activeView]).scrollIntoView({ behavior: 'smooth', block: 'center' }));
    dock.replaceChildren(head, element('strong', '', feedback.action), element('p', '', feedback.result), viewResult, next);
    dock.dataset.renderKey = renderKey;
    dock.hidden = false;
  }
  function element(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function announce(text) {
    const box = $('toast');
    box.textContent = text;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 3600);
  }
  function log(text) {
    history.unshift({ time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }), text });
    if (history.length > 16) history.pop();
    renderLogs();
  }
  function renderLogs() {
    for (const id of ['overview-log', 'document-log', 'mail-log', 'payroll-log']) {
      const target = $(id);
      target.replaceChildren();
      const entries = id === 'mail-log' ? history.filter(x => x.text.startsWith('メール')) : id === 'payroll-log' ? history.filter(x => x.text.startsWith('給与')) : history;
      for (const item of entries.slice(0, id === 'overview-log' ? 3 : 10)) {
        const li = element('li');
        li.append(element('time', '', item.time), element('span', '', item.text));
        target.append(li);
      }
    }
  }
  function companyFromCode(code) {
    return Object.keys(companies).find(id => companies[id].code === code) || null;
  }
  function updateCounts() {
    const review = docs.filter(d => d.status === 'review').length;
    const shared = docs.filter(d => d.shared).length + portalResources.filter(r => r.published).length;
    const mailReview = mails.filter(m => m.status === 'review' || m.status === 'quarantine').length;
    $('kpi-review').innerHTML = String(review) + '<small>件</small>';
    $('kpi-shared').innerHTML = String(shared) + '<small>件</small>';
    $('kpi-mail').innerHTML = String(mailReview) + '<small>件</small>';
    $('kpi-payroll').innerHTML = String(payrollState.phase) + '<small>/ 5</small>';
    $('kpi-cases').innerHTML = String(cases.filter(c => c.stage < c.steps.length - 1).length) + '<small>件</small>';
    $('nav-review').textContent = String(review);
    $('nav-mail').textContent = String(mailReview);
  }
  function badgeFor(d) {
    if (d.shared) return ['共有済み', 'share'];
    if (d.status === 'classified') return ['模擬保存済み / 公開待ち', 'ok'];
    if (d.status === 'review') return ['要確認', 'warn'];
    if (d.status === 'duplicate') return ['重複を保留', 'skip'];
    if (d.status === 'downloaded') return ['取得済み', 'ok'];
    return ['受信済み', 'wait'];
  }
  function renderDocs() {
    const body = $('document-rows');
    body.replaceChildren();
    for (const d of docs) {
      const row = element('tr');
      const nameCell = element('td');
      nameCell.append(element('span', 'doc-name', d.name), element('span', 'doc-id', d.id + ' · ' + d.subject));
      const infoCell = element('td');
      infoCell.append(element('span', 'doc-company', d.code ? '事業所番号 ' + d.code : '事業所番号なし'));
      if (d.company) infoCell.append(element('span', 'doc-id', companies[d.company].name + ' / 公文書 / 2026-11（模擬保存先）'));
      const statusCell = element('td');
      const [label, color] = badgeFor(d);
      statusCell.append(element('span', 'badge ' + color, label));
      const actionCell = element('td');
      if (d.status === 'classified' && !d.shared) {
        const btn = element('button', 'table-action', '共有を承認');
        btn.type = 'button';
        btn.addEventListener('click', () => shareDocument(d.id));
        actionCell.append(btn);
      } else {
        actionCell.append(element('span', 'doc-id', d.shared ? '公開済み' : d.status === 'review' ? '右側で確認' : d.status === 'received' ? '取得待ち' : '—'));
      }
      row.append(nameCell, infoCell, statusCell, actionCell);
      body.append(row);
    }
    renderReview();
    updateCounts();
  }
  function renderReview() {
    const queue = $('review-queue');
    queue.replaceChildren();
    const items = docs.filter(d => d.status === 'review');
    if (!items.length) {
      queue.append(element('div', 'queue-empty', '現在、要確認の文書はありません。仕分けを実行すると、判定不能な文書がここに表示されます。'));
      return;
    }
    for (const d of items) {
      const card = element('div', 'queue-item');
      card.append(element('strong', '', d.name), element('p', '', '確定情報だけでは顧問先を判断できません。'));
      const select = element('select');
      select.setAttribute('aria-label', d.name + 'の割当先');
      for (const [id, c] of Object.entries(companies)) {
        const opt = element('option', '', c.name);
        opt.value = id;
        select.append(opt);
      }
      const button = element('button', '', '確認して割り当て');
      button.type = 'button';
      button.addEventListener('click', () => {
        d.company = select.value;
        d.destination = companies[d.company].name + ' / 公文書 / 2026-11';
        d.status = 'classified';
        log(d.id + '：職員の確認で' + d.destination + 'へ模擬保存。公開は保留。');
        renderAll();
        announce('職員確認で割り当てました。顧問先への公開は別途承認が必要です。');
        recordGuide('documents', 'DOC-03の割当先を確認', d.name + 'を' + companies[d.company].name + 'の模擬保存先へ移しました。職員の公開承認までは顧問先へ表示しません。');
      });
      card.append(select, button);
      queue.append(card);
    }
  }
  function runDownload() {
    let count = 0;
    for (const d of docs) {
      if (d.status !== 'received') continue;
      d.status = 'downloaded';
      count++;
      log(d.id + '：電子申請後の公文書を取得した想定。');
    }
    renderAll();
    announce(count ? count + '件を取得済みにしました（模擬）。' : '新しい取得対象はありません。');
    recordGuide('documents', '公文書を一括取得（模擬）', count ? '架空PDF' + count + '件を受信済みから取得済みに変更しました。実際の電子申請サイトには接続していません。次に事業所番号で仕分けます。' : '未処理の公文書はありません。既存の結果を維持しました。');
  }
  function runSort() {
    if (docs.some(d => d.status === 'received')) {
      announce('先に「公文書を一括取得（模擬）」を実行してください。');
      return;
    }
    const seen = new Set(docs.filter(d => !['received', 'downloaded', 'duplicate'].includes(d.status)).map(d => d.key));
    let count = 0;
    for (const d of docs) {
      if (d.status !== 'downloaded') continue;
      count++;
      if (seen.has(d.key)) {
        d.status = 'duplicate';
        log(d.id + '：同一文書キーを検出。重複を保留。');
      } else if (!companyFromCode(d.code)) {
        d.status = 'review';
        seen.add(d.key);
        log(d.id + '：事業所番号で判定できず、要確認へ隔離。');
      } else {
        d.status = 'classified';
        d.company = companyFromCode(d.code);
        d.destination = companies[d.company].name + ' / 公文書 / 2026-11';
        seen.add(d.key);
        log(d.id + '：' + d.destination + 'へ模擬保存。公開承認待ち。');
      }
    }
    if (!count) {
      log('再実行：未処理の公文書なし。既存の結果は変更しませんでした。');
      announce('再実行しても文書は追加されません。');
    } else {
      announce('顧問先別の模擬保存を行いました。要確認と公開承認待ちを確認してください。');
    }
    renderAll();
    recordGuide('documents', '仕分けを実行', count ? 'DOC-01とDOC-02を顧問先別の模擬保存先へ、DOC-03を要確認へ、DOC-04を重複保留へ振り分けました。自動公開はしていません。' : '未処理の公文書がないため結果を変更していません。');
  }
  function shareDocument(id) {
    const d = docs.find(x => x.id === id);
    if (!d || d.status !== 'classified' || !d.company || d.shared) return;
    d.shared = true;
    const linkedCase = cases.find(c => c.doc === d.id);
    if (linkedCase) linkedCase.stage = Math.max(linkedCase.stage, 4);
    log(d.id + '：職員が公開を承認。' + companies[d.company].name + 'のポータルに表示。');
    renderAll();
    announce(companies[d.company].name + 'へ共有しました（画面上の模擬処理）。');
    recordGuide('documents', d.id + '行の「共有を承認」', d.name + 'を' + companies[d.company].name + 'の公開済み一覧へ追加しました。重複・所属不明の文書は公開していません。');
  }
  function resetDocs() {
    docs.splice(0, docs.length, ...originalDocs.map(d => ({ ...d, status: 'received', company: null, shared: false })));
    cases.find(c => c.id === 'PROC-241').stage = 1;
    cases.find(c => c.id === 'PROC-242').stage = 2;
    log('文書処理を初期化。サンプル4件を受信済みに戻しました。');
    renderAll();
    announce('文書処理を初期化しました。');
    recordGuide('documents', '文書処理を初期化', '架空の公文書4件を受信済みに戻しました。先頭からデモをやり直せます。');
  }
  function releaseResource(id) {
    const r = portalResources.find(x => x.id === id);
    if (!r || !r.ready || r.published || role !== 'staff') return;
    r.published = true;
    if (r.id === 'RES-P01') cases.find(c => c.id === 'PAY-211').stage = Math.max(cases.find(c => c.id === 'PAY-211').stage, 4);
    log(r.id + '：職員が公開を承認。' + companies[r.company].name + 'へ共有。');
    renderAll();
    announce('資料を顧問先へ公開しました（画面上の模擬処理）。');
    recordGuide('portal', r.name + 'の「公開を承認」', companies[r.company].name + '向けの架空資料を公開済みに変更しました。次は顧問先担当者の表示へ切り替え、該当タブで確認します。');
  }
  function renderPortal() {
    if (role === 'client' && portalTab === 'rules' && portalResources.some(r => r.id === 'RES-R01' && r.published)) portalViewed = true;
    $('role-select').value = role;
    const selector = $('company-select');
    if (role === 'client') company = 'abc';
    selector.value = company;
    selector.disabled = role === 'client';
    $('access-note').textContent = role === 'client'
      ? '顧問先担当者：自社の公開済み資料のみ表示'
      : '事務所職員：公開前の資料も確認できます';
    const c = companies[company];
    $('company-monogram').textContent = c.mark;
    $('company-title').textContent = c.name;
    $('company-meta').textContent = '事業所番号 ' + c.code + ' · 架空データ';
    const releasePanel = $('portal-release-panel');
    releasePanel.hidden = role === 'client';
    const releases = $('portal-release-list');
    releases.replaceChildren();
    if (role === 'staff') {
      const drafts = portalResources.filter(r => r.company === company && !r.published);
      if (!drafts.length) releases.append(element('p', 'queue-empty', 'この顧問先に公開待ちの資料はありません。'));
      for (const r of drafts) {
        const row = element('div', 'release-row');
        const copy = element('div');
        copy.append(element('strong', '', r.name), element('small', '', r.ready ? '対象顧問先・版または対象月・閲覧者を確認して公開' : '給与の前後チェック完了後に公開可能'));
        const button = element('button', 'outline', '公開を承認');
        button.type = 'button';
        button.disabled = !r.ready;
        button.addEventListener('click', () => releaseResource(r.id));
        row.append(copy, button);
        releases.append(row);
      }
    }
    const list = $('portal-files');
    list.replaceChildren();
    let files = [];
    if (portalTab === 'public') {
      files = docs.filter(d => d.company === company && d.status === 'classified' && (role === 'staff' || d.shared))
        .map(d => ({ name: d.name, meta: d.id + ' · ' + (d.shared ? '公開済み' : '職員のみ / 公開前'), note: d.subject }));
    } else {
      files = portalResources.filter(r => r.company === company && r.type === portalTab && (role === 'staff' || r.published))
        .map(r => ({ name: r.name, meta: r.id + ' · ' + (r.published ? '公開済み' : r.ready ? '職員のみ / 公開前' : '準備中'), note: '架空の説明用資料。実ファイルは含みません。' }));
    }
    const titles = { public: ['PUBLIC DOCUMENTS', '公文書'], payroll: ['PAYROLL FILES', '給与資料'], rules: ['POLICIES', '就業規則'] };
    $('portal-category').textContent = titles[portalTab][0];
    $('portal-section-title').textContent = titles[portalTab][1];
    $('portal-count').textContent = files.length + '件';
    if (!files.length) {
      list.append(element('div', 'empty-state', role === 'client'
        ? '公開済みの資料はまだありません。職員の確認と公開承認後に、対象の顧問先へ表示されます。'
        : 'この分類の資料はありません。'));
    } else {
      for (const file of files) {
        const card = element('article', 'file-card');
        card.append(element('span', 'file-icon', 'PDF'), element('strong', '', file.name), element('small', '', file.meta), element('p', '', file.note));
        list.append(card);
      }
    }
  }
  function renderMail() {
    const body = $('mail-rows');
    body.replaceChildren();
    for (const m of mails) {
      const row = element('tr');
      const message = element('td');
      message.append(element('span', 'doc-name', m.subject), element('span', 'doc-id', m.id + ' · ' + m.from));
      const attachment = element('td');
      attachment.append(element('span', 'doc-company', m.attachment));
      const destination = element('td');
      destination.append(element('span', 'doc-company', m.destination || '未設定'));
      const status = element('td');
      const labels = { pending: ['未整理', 'wait'], stored: ['模擬保存済み', 'ok'], review: ['要確認', 'warn'], quarantine: ['隔離', 'skip'] };
      status.append(element('span', 'badge ' + labels[m.status][1], labels[m.status][0]));
      row.append(message, attachment, destination, status);
      body.append(row);
    }
    const queue = $('mail-review');
    queue.replaceChildren();
    const exceptions = mails.filter(m => m.status === 'review' || m.status === 'quarantine');
    if (!exceptions.length) {
      queue.append(element('div', 'queue-empty', '現在、要確認のメールはありません。整理ルールを実行するとここに表示されます。'));
      return;
    }
    for (const m of exceptions) {
      const card = element('div', 'queue-item');
      card.append(element('strong', '', m.subject + ' / ' + m.attachment));
      card.append(element('p', '', m.status === 'quarantine' ? '許可外形式のため隔離。添付の安全性を確認するまで保存しません。' : '送信元が未登録です。職員が顧問先を確認してください。'));
      if (m.status === 'review') {
        const select = element('select');
        select.setAttribute('aria-label', m.id + 'の顧問先');
        for (const [id, c] of Object.entries(companies)) {
          const opt = element('option', '', c.name);
          opt.value = id;
          select.append(opt);
        }
        const button = element('button', '', '職員が確認して割り当て');
        button.type = 'button';
        button.addEventListener('click', () => {
          m.company = select.value;
          m.destination = companies[m.company].name + ' / 受信資料 / 2026-11';
          m.status = 'stored';
          log('メール' + m.id + '：職員が' + m.destination + 'へ模擬保存。');
          renderAll();
          announce('顧問先別の保存候補に割り当てました（模擬）。');
          recordGuide('mail', 'MAIL-03の顧問先を確認して割り当て', m.subject + 'を' + companies[m.company].name + 'の模擬保存先へ移しました。ZIP添付は引き続き隔離しています。');
        });
        card.append(select, button);
      }
      queue.append(card);
    }
  }
  function runMail() {
    let count = 0;
    for (const m of mails) {
      if (m.status !== 'pending') continue;
      count++;
      if (!/\.(pdf|xlsx|docx|csv)$/i.test(m.attachment)) {
        m.status = 'quarantine';
        log('メール' + m.id + '：許可外形式の添付を隔離。自動保存しません。');
      } else if (!m.company) {
        m.status = 'review';
        log('メール' + m.id + '：送信元が未登録のため要確認。');
      } else {
        m.status = 'stored';
        m.destination = companies[m.company].name + ' / 受信資料 / 2026-11';
        log('メール' + m.id + '：' + m.destination + 'へ模擬保存。');
      }
    }
    renderAll();
    announce(count ? 'メールを整理しました。要確認と隔離も確認してください。' : '未整理のメールはありません。');
    recordGuide('mail', '整理ルールを実行', count ? '架空メール4件を判定しました。2件は顧問先別の模擬保存先、送信元不明1件は要確認、ZIP添付1件は隔離です。実メールは読み込んでいません。' : '未整理のメールはありません。既存の判定結果を維持しました。');
  }
  function resetMail() {
    mails.splice(0, mails.length, ...originalMails.map(m => ({ ...m, status: 'pending', destination: '' })));
    log('メール処理を初期化しました。');
    renderAll();
    announce('メール処理を初期化しました。');
    recordGuide('mail', '初期化', '架空メール4件を未整理へ戻しました。整理ルールを再実行できます。');
  }
  const payrollProfiles = [
    { code: '001', name: '山田 太郎', base: 280000, overtimeRate: 2200, transport: 12000, deduction: 57000, previousNet: 245200 },
    { code: '002', name: '佐藤 花子', base: 260000, overtimeRate: 2000, transport: 10000, deduction: 52500, previousNet: 225500 },
    { code: '003', name: '高橋 健', base: 310000, overtimeRate: 2500, transport: 15000, deduction: 66000, previousNet: 257000 }
  ];
  const normalAttendance = [
    { code: '001', days: 20, overtimeHours: 6 },
    { code: '002', days: 19, overtimeHours: 4 },
    { code: '003', days: 21, overtimeHours: 2 }
  ];
  const badAttendance = [
    { code: '001', days: 20, overtimeHours: 6 },
    { code: '002', days: 19, overtimeHours: 4 },
    { code: '002', days: 19, overtimeHours: 4 },
    { code: '', days: 20, overtimeHours: 2 }
  ];
  let payrollRunSerial = 0;
  const yen = value => '¥' + Number(value).toLocaleString('ja-JP');
  const signedYen = value => (value > 0 ? '+' : value < 0 ? '−' : '±') + yen(Math.abs(value));
  function payrollAttendance() {
    return payrollState.scenario === 'exception' ? badAttendance : normalAttendance;
  }
  function payrollResetState(scenario = 'normal') {
    payrollRunSerial++;
    payrollState.scenario = scenario;
    payrollState.phase = 0;
    payrollState.status = 'idle';
    payrollState.issues = [];
    payrollState.rows = [];
    payrollState.totals = null;
    payrollState.prepared = false;
    const resource = portalResources.find(r => r.id === 'RES-P01');
    resource.ready = false;
    resource.published = false;
    cases.find(c => c.id === 'PAY-211').stage = 0;
    log('給与：説明用の計算状態を初期化。');
    renderAll();
    recordGuide('payroll', '使う架空データを選択', scenario === 'exception' ? '重複した社員コードと社員コード欠落を含むデータに切り替えました。次の実行では検証で停止します。' : '通常の架空勤怠3行に戻しました。次は「給与計算を自動実行」を押します。');
  }
  function validatePayrollInput(rows) {
    const issues = [];
    const seen = new Set();
    const known = new Set(payrollProfiles.map(p => p.code));
    rows.forEach((row, index) => {
      const position = index + 1;
      if (!row.code) issues.push(position + '行目：社員コードがありません。');
      else if (!known.has(row.code)) issues.push(position + '行目：登録されていない社員コードです。');
      else if (seen.has(row.code)) issues.push(position + '行目：社員コード' + row.code + 'が重複しています。');
      if (row.code) seen.add(row.code);
      if (!Number.isInteger(row.days) || row.days < 0 || row.days > 31) issues.push(position + '行目：勤務日数が範囲外です。');
      if (!Number.isFinite(row.overtimeHours) || row.overtimeHours < 0 || row.overtimeHours > 100) issues.push(position + '行目：残業時間が範囲外です。');
    });
    for (const profile of payrollProfiles) {
      if (!seen.has(profile.code)) issues.push('社員コード' + profile.code + 'の勤怠がありません。');
    }
    return issues;
  }
  function calculatePayroll(rows) {
    const profiles = new Map(payrollProfiles.map(p => [p.code, p]));
    return rows.map(attendance => {
      const profile = profiles.get(attendance.code);
      const overtimePay = attendance.overtimeHours * profile.overtimeRate;
      const gross = profile.base + overtimePay + profile.transport;
      const net = gross - profile.deduction;
      return { code: profile.code, name: profile.name, base: profile.base, overtimePay, transport: profile.transport, gross, deduction: profile.deduction, net, delta: net - profile.previousNet };
    });
  }
  const payrollPause = () => new Promise(resolve => setTimeout(resolve, 800));
  async function runPayrollAutomation() {
    if (payrollState.status === 'running') return;
    const serial = ++payrollRunSerial;
    payrollState.phase = 0;
    payrollState.status = 'running';
    payrollState.issues = [];
    payrollState.rows = [];
    payrollState.totals = null;
    payrollState.prepared = false;
    const resource = portalResources.find(r => r.id === 'RES-P01');
    resource.ready = false;
    resource.published = false;
    cases.find(c => c.id === 'PAY-211').stage = 0;
    renderAll();
    recordGuide('payroll', '給与計算を自動実行', '自動処理を開始しました。追加クリックは不要です。勤怠取得、入力検証、計算、前月照合、共有準備の順に進みます。');
    const rows = payrollAttendance();
    payrollState.phase = 1;
    log('給与：2026年11月の架空勤怠' + rows.length + '行を読み込み。');
    renderAll();
    recordGuide('payroll', '自動工程1/5：勤怠取得', '2026年11月の架空勤怠' + rows.length + '行を読み込みました。次に社員コード、勤務日数、残業時間を自動検証します。');
    await payrollPause();
    if (serial !== payrollRunSerial) return;
    payrollState.issues = validatePayrollInput(rows);
    payrollState.phase = 2;
    log('給与：社員コード・重複・勤務日数・残業時間を自動検証。');
    if (payrollState.issues.length) {
      payrollState.status = 'blocked';
      log('給与：' + payrollState.issues.length + '件の入力不備を検出。給与計算を保留。');
      renderAll();
      recordGuide('payroll', '自動工程2/5：入力検証', payrollState.issues.join(' ') + ' 給与額は計算せず、ここで停止しました。通常データに切り替えて再実行できます。');
      announce('入力不備を検出しました。計算せずに確認待ちにしています。');
      return;
    }
    renderAll();
    recordGuide('payroll', '自動工程2/5：入力検証', '3名の社員コード、重複、勤務日数、残業時間に不備はありません。次に基本給・時間外手当・通勤手当・架空控除額を使って計算します。');
    await payrollPause();
    if (serial !== payrollRunSerial) return;
    payrollState.rows = calculatePayroll(rows);
    payrollState.totals = payrollState.rows.reduce((total, row) => {
      total.gross += row.gross;
      total.deduction += row.deduction;
      total.net += row.net;
      total.delta += row.delta;
      return total;
    }, { gross: 0, deduction: 0, net: 0, delta: 0 });
    payrollState.phase = 3;
    log('給与：基本給＋時間外手当＋通勤手当−架空控除額で3名分を自動計算。');
    renderAll();
    recordGuide('payroll', '自動工程3/5：給与計算', '残業時間×残業単価で時間外手当を出し、基本給と通勤手当を足して総支給' + yen(payrollState.totals.gross) + '、架空控除' + yen(payrollState.totals.deduction) + 'を引いて差引支給' + yen(payrollState.totals.net) + 'を計算しました。次に前月差を確認します。');
    await payrollPause();
    if (serial !== payrollRunSerial) return;
    const largeChanges = payrollState.rows.filter(row => Math.abs(row.delta) >= 10000);
    payrollState.phase = 4;
    log('給与：前月との差を自動照合。差額1万円以上の要確認は' + largeChanges.length + '件。');
    if (largeChanges.length) {
      payrollState.issues = largeChanges.map(row => row.name + '：前月との差 ' + signedYen(row.delta) + ' を確認してください。');
      payrollState.status = 'blocked';
      renderAll();
      recordGuide('payroll', '自動工程4/5：前月照合', payrollState.issues.join(' ') + ' 差額の確認が必要なため、共有準備を停止しました。');
      announce('差額の確認が必要なため、共有準備を保留しました。');
      return;
    }
    renderAll();
    recordGuide('payroll', '自動工程4/5：前月照合', '3名の差引支給額を前月と比較しました。個人ごとの変動が1万円以上の人は0名です。次に給与資料を職員の公開承認待ちへ追加します。');
    await payrollPause();
    if (serial !== payrollRunSerial) return;
    payrollState.phase = 5;
    payrollState.status = 'ready';
    payrollState.prepared = true;
    resource.ready = true;
    const payrollCase = cases.find(c => c.id === 'PAY-211');
    payrollCase.stage = Math.max(payrollCase.stage, 3);
    log('給与：差引支給合計' + yen(payrollState.totals.net) + '。ABC社の公開承認待ちへ追加。');
    renderAll();
    announce('架空の給与計算が完了しました。資料の公開は職員承認待ちです。');
    recordGuide('payroll', '自動工程5/5：共有準備', '差引支給の合計は' + yen(payrollState.totals.net) + 'です。ABC社の給与資料を職員の公開承認待ちにしました。顧問先への自動公開はしていません。下の計算結果で3名の内訳を確認できます。');
  }
  function downloadPayrollCsv() {
    if (payrollState.status !== 'ready') return;
    const records = [
      ['社員コード', '氏名', '基本給', '時間外手当', '通勤手当', '総支給額', '控除設定額', '差引支給額', '前月比'],
      ...payrollState.rows.map(r => [r.code, r.name, r.base, r.overtimePay, r.transport, r.gross, r.deduction, r.net, r.delta])
    ];
    const csv = '\uFEFF' + records.map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-payroll-2026-11.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    log('給与：計算済みの架空結果を汎用CSVで出力。弥生取込形式ではありません。');
    renderLogs();
    announce('架空の給与計算結果CSVを出力しました。');
    recordGuide('payroll', '計算結果CSVを出力', '3名分の計算結果を汎用CSVとしてダウンロードしました。弥生製品の取込形式ではありません。');
  }
  function renderPayroll() {
    const select = $('payroll-scenario');
    select.value = payrollState.scenario;
    select.disabled = payrollState.status === 'running';
    const runButton = $('run-payroll');
    runButton.disabled = payrollState.status === 'running';
    runButton.textContent = payrollState.status === 'running' ? '自動処理中…' : payrollState.status === 'idle' ? '給与計算を自動実行 →' : 'このデータで再実行 →';
    $('payroll-progress').textContent = payrollState.phase + ' / 5 工程';
    const statusLabels = { idle: '実行待ち', running: '自動処理中', blocked: '要確認で停止', ready: '計算完了・公開承認待ち' };
    $('payroll-next').textContent = statusLabels[payrollState.status];
    const pipeline = $('payroll-pipeline');
    pipeline.replaceChildren();
    const phaseResults = [
      payrollAttendance().length + '行の勤怠を読み込み',
      payrollState.issues.length && payrollState.phase === 2 ? payrollState.issues.length + '件の不備で停止' : '社員コード・日数・残業時間を確認',
      payrollState.totals ? '差引支給合計 ' + yen(payrollState.totals.net) : '3名の給与を計算',
      payrollState.issues.length && payrollState.phase === 4 ? '前月差の確認待ち' : '1万円以上の変動 0名',
      'ABC社資料を職員の公開承認待ちへ'
    ];
    payrollLabels.forEach((label, index) => {
      const done = payrollState.phase > index;
      const step = element('div', 'payroll-pipeline-step' + (done ? ' is-done' : payrollState.status === 'running' && payrollState.phase === index ? ' is-active' : ''));
      const detail = done ? phaseResults[index] : payrollState.status === 'running' && payrollState.phase === index ? '処理中 · 追加クリック不要' : '待機';
      step.append(element('span', 'payroll-pipeline-num', done ? '✓' : String(index + 1).padStart(2, '0')), element('strong', '', label), element('small', '', detail));
      pipeline.append(step);
    });
    const input = $('payroll-input-rows');
    input.replaceChildren();
    const profiles = new Map(payrollProfiles.map(p => [p.code, p]));
    for (const row of payrollAttendance()) {
      const p = profiles.get(row.code);
      const tr = element('tr');
      for (const value of [p ? p.name + '（' + p.code + '）' : '社員コードなし', row.days + '日', row.overtimeHours + '時間', p ? yen(p.base) : '—', p ? yen(p.overtimeRate) : '—', p ? yen(p.transport) : '—', p ? yen(p.deduction) : '—']) tr.append(element('td', '', value));
      input.append(tr);
    }
    const issues = $('payroll-issues');
    issues.hidden = payrollState.issues.length === 0;
    const issueList = $('payroll-issue-list');
    issueList.replaceChildren();
    for (const issue of payrollState.issues) issueList.append(element('li', '', issue));
    const results = $('payroll-results');
    results.hidden = payrollState.rows.length === 0;
    $('payroll-result-status').textContent = payrollState.status === 'ready' ? '職員の公開承認待ち' : payrollState.status === 'blocked' ? '差額確認待ち' : '自動処理中';
    $('download-payroll-csv').disabled = payrollState.status !== 'ready';
    const resultRows = $('payroll-result-rows');
    resultRows.replaceChildren();
    for (const row of payrollState.rows) {
      const tr = element('tr');
      for (const value of [row.name, yen(row.base), yen(row.overtimePay), yen(row.transport), yen(row.gross), yen(row.deduction), yen(row.net), signedYen(row.delta)]) tr.append(element('td', '', value));
      resultRows.append(tr);
    }
    const totals = payrollState.totals;
    $('payroll-gross').textContent = totals ? yen(totals.gross) : '—';
    $('payroll-deductions').textContent = totals ? yen(totals.deduction) : '—';
    $('payroll-net').textContent = totals ? yen(totals.net) : '—';
    $('payroll-variance').textContent = totals ? signedYen(totals.delta) : '—';
  }
  function caseCanComplete(c) {
    if (c.type === 'payroll') return portalResources.some(r => r.id === 'RES-P01' && r.published);
    return docs.some(d => d.id === c.doc && d.shared);
  }
  function advanceCase(id) {
    const c = cases.find(x => x.id === id);
    if (!c || c.stage >= c.steps.length - 1) return;
    if (c.stage >= c.steps.length - 3 && !caseCanComplete(c)) {
      announce('関連する資料が顧問先に公開されるまで完了にできません。');
      recordGuide('cases', c.id + 'の次の工程', '関連する公文書または給与資料がまだ職員承認されていないため、工程は進めていません。①の公開待ちで承認した後に再試行します。');
      return;
    }
    c.stage++;
    caseActivity = true;
    log('案件' + c.id + '：' + c.steps[c.stage] + 'へ更新。担当 ' + c.owner + '。');
    renderAll();
    announce(c.title + 'を「' + c.steps[c.stage] + '」に更新しました。');
    recordGuide('cases', c.id + '行の「次へ：' + c.steps[c.stage] + '」', c.title + 'の工程を「' + c.steps[c.stage] + '」に変更しました。担当は' + c.owner + '、期限は2026/' + c.due + 'です。実際の申請や通知はしていません。');
  }
  function renderCases() {
    const active = cases.filter(c => c.stage < c.steps.length - 1);
    $('case-active').textContent = active.length + '件';
    $('case-due').textContent = active.filter(c => c.priority).length + '件';
    $('case-done').textContent = cases.length - active.length + '件';
    const selectedCompany = $('case-company').value;
    const selectedState = $('case-state').value;
    const visible = cases.filter(c => (selectedCompany === 'all' || c.company === selectedCompany) &&
      (selectedState === 'all' || (selectedState === 'active' ? c.stage < c.steps.length - 1 : c.stage === c.steps.length - 1)));
    const body = $('case-rows');
    body.replaceChildren();
    $('case-empty').hidden = visible.length > 0;
    for (const c of visible) {
      const row = element('tr');
      const title = element('td');
      title.append(element('span', 'doc-name', c.title), element('span', 'doc-id', c.id + ' · ' + c.person));
      const owner = element('td');
      owner.append(element('span', 'doc-company', companies[c.company].name), element('span', 'doc-id', '担当 ' + c.owner));
      const due = element('td');
      due.append(element('span', 'doc-company', '2026/' + c.due));
      const stage = element('td');
      stage.append(element('span', 'badge ' + (c.stage === c.steps.length - 1 ? 'share' : c.priority ? 'warn' : 'ok'), c.steps[c.stage]));
      const action = element('td');
      if (c.stage < c.steps.length - 1) {
        const button = element('button', 'table-action', '次へ：' + c.steps[c.stage + 1]);
        button.type = 'button';
        const publicationStep = c.stage >= c.steps.length - 3;
        button.disabled = publicationStep && !caseCanComplete(c);
        button.title = button.disabled ? '関連する資料の公開承認が必要です' : '';
        button.addEventListener('click', () => advanceCase(c.id));
        action.append(button);
        if (button.disabled) action.append(element('small', 'doc-id', '資料公開後に進行可能'));
      } else action.append(element('span', 'doc-id', '完了'));
      row.append(title, owner, due, stage, action);
      body.append(row);
    }
  }
  const guideMeta = {
    portal: { number: '①', title: '顧問先との安全な資料共有', source: '架空の就業規則PDF', operation: '職員が公開を承認し、顧問先表示に切り替える', outcome: '公開済みの資料だけが顧問先画面に表示される', boundary: '画面上の役割切替です。本番の認証・アクセス権ではありません。' },
    documents: { number: '②', title: '電子申請後の公文書処理', source: '電子申請後に届いた想定の架空PDF4件', operation: '取得 → 事業所番号で照合 → 職員が公開承認', outcome: '対象顧問先に表示。重複・不明書類は保留', boundary: '実際の電子申請サイトからの取得やSharePoint保存は行いません。' },
    mail: { number: '③', title: 'Outlookメール・添付整理', source: '架空の受信メール4件と添付', operation: '送信元と拡張子で分類し、保存先候補を決める', outcome: '2件を保存候補、1件を要確認、1件を隔離', boundary: 'Outlookに接続せず、実メールや添付を読み込みません。' },
    payroll: { number: '④', title: '給与計算を一括で自動実行', source: '架空の勤怠3行・基本給・残業単価・通勤手当・控除設定額', operation: '入力検証 → 簡易給与計算 → 前月比較 → 共有準備', outcome: '3名分の総支給・控除・差引支給を算出し、職員の公開承認待ちにする', boundary: '法定税・社会保険料の算定や弥生製品への取込は行いません。' },
    cases: { number: '⑤', title: '手続・給与の進捗管理', source: '架空の手続2件・給与1件', operation: '担当・期限・工程を確認し、状態を更新する', outcome: '次の担当作業と公開前の進行制限を確認できる', boundary: '更新はブラウザ内のみで、複数人の台帳には保存しません。' }
  };
  function guideStage(id) {
    const next = { portal: 'documents', documents: 'mail', mail: 'payroll', payroll: 'cases', cases: 'overview' };
    const nextLabel = { portal: '② 公文書の取得・仕分けへ', documents: '③ Outlookメール整理へ', mail: '④ 給与計算の自動化へ', payroll: '⑤ 進捗管理へ', cases: '全体像に戻る' };
    function complete(effect) { return { done: true, step: 0, total: 0, action: nextLabel[id], effect, run: () => navigate(next[id]) }; }
    if (id === 'portal') {
      const rule = portalResources.find(r => r.id === 'RES-R01');
      if (portalViewed) return complete('株式会社ABCの顧問先表示で、公開済みの就業規則を確認しました。');
      if (company !== 'abc') return { step: 1, total: 3, action: '対象を株式会社ABCに戻す', effect: 'このデモで公開する就業規則の顧問先をそろえます。', run: () => { company = 'abc'; renderAll(); } };
      if (role !== 'staff' && !rule.published) return { step: 1, total: 3, action: '事務所職員の表示に切り替える', effect: '公開承認できる職員画面に戻ります。', run: () => { role = 'staff'; renderAll(); } };
      if (!rule.published) return { step: 1, total: 3, action: '就業規則の公開を承認する', effect: '株式会社ABC向けの架空資料が「公開済み」になります。実ファイルは配信しません。', run: () => releaseResource('RES-R01') };
      if (role !== 'client') return { step: 2, total: 3, action: '顧問先担当者の表示に切り替える', effect: '職員専用の公開待ち一覧が隠れ、ABC社の公開済み資料だけを表示する役割になります。', run: () => { role = 'client'; renderAll(); } };
      return { step: 3, total: 3, action: '就業規則タブを開いて確認する', effect: '先ほど公開したABC社向けの資料カードが見えます。', run: () => {
        portalTab = 'rules';
        document.querySelectorAll('[data-doc-tab]').forEach(tab => {
          const active = tab.dataset.docTab === 'rules';
          tab.classList.toggle('is-active', active);
          tab.setAttribute('aria-selected', String(active));
        });
        renderAll();
        recordGuide('portal', '就業規則タブを開く', 'ABC社向けの公開済み就業規則を表示しました。職員の公開承認前には顧問先画面へ表示されません。');
      } };
    }
    if (id === 'documents') {
      const target = docs.find(d => d.id === 'DOC-01');
      if (target.shared) return complete('DOC-01をABC社に公開。重複と顧問先不明の文書は自動公開されません。');
      if (docs.some(d => d.status === 'received')) return { step: 1, total: 3, action: '公文書を一括取得（模擬）', effect: '4件の表示が「取得済み」に変わります。実際のダウンロードは行いません。', run: runDownload };
      if (docs.some(d => d.status === 'downloaded')) return { step: 2, total: 3, action: '仕分けを実行', effect: '2件は顧問先別の模擬保存、1件は不明で要確認、1件は重複保留になります。', run: runSort };
      return { step: 3, total: 3, action: 'DOC-01行の「共有を承認」', effect: '職員の承認後、ABC社のポータルへ公開済みとして表示されます。', run: () => shareDocument('DOC-01') };
    }
    if (id === 'mail') {
      if (mails.some(m => m.status !== 'pending')) return complete('分類結果は保存候補2件、要確認1件、隔離1件。実メールは処理していません。');
      return { step: 1, total: 1, action: '整理ルールを実行', effect: '既知の送信元2件は保存先候補へ、不明な1件は要確認、ZIP添付1件は隔離になります。', run: runMail };
    }
    if (id === 'payroll') {
      if (payrollState.prepared) return complete('3名分の支給額・控除額・差引支給額を自動計算し、前月比較と共有準備まで完了しました。');
      if (payrollState.status === 'running') {
        const running = [
          ['勤怠データを読み込み中', '架空の11月勤怠3行を取り込みます。'],
          ['社員コードと勤怠を自動検証中', '社員コードの欠落・重複、勤務日数、残業時間を確認します。'],
          ['3名分の給与を自動計算中', '基本給・時間外手当・通勤手当から総支給を求め、架空の控除額を引きます。'],
          ['前月との差額を自動照合中', '差引支給額の前月差が1万円以上なら共有準備を止めます。'],
          ['給与資料の共有準備中', '計算結果を職員の公開承認待ちにします。顧問先へは自動公開しません。']
        ];
        const phase = Math.min(payrollState.phase, 4);
        return { step: phase + 1, total: 5, action: running[phase][0], effect: running[phase][1], run: null };
      }
      if (payrollState.status === 'blocked') return { step: 1, total: 1, action: '通常データに切り替えて再実行する', effect: '不備データの確認事項を残して計算を止めました。通常データを使い、今度は自動で最後まで進めます。', run: () => { payrollResetState('normal'); runPayrollAutomation(); } };
      return { step: 1, total: 1, action: '給与計算を自動実行', effect: '架空の3名分を検証・計算・前月比較し、給与資料を職員の公開承認待ちにします。', run: runPayrollAutomation };
    }
    if (caseActivity) return complete('案件の工程が更新され、担当・期限・次の操作が一覧で確認できます。');
    const caseToAdvance = cases.find(c => c.id === 'PROC-241');
    return { step: 1, total: 1, action: 'PROC-241行の「次へ：' + caseToAdvance.steps[caseToAdvance.stage + 1] + '」', effect: '案件の現在工程と次の操作が更新されます。実際の申請や通知は行いません。', run: () => advanceCase('PROC-241') };
  }
  function renderGuides() {
    for (const id of ['portal', 'documents', 'mail', 'payroll', 'cases']) {
      const meta = guideMeta[id];
      const state = guideStage(id);
      const slot = $('guide-' + id);
      const head = element('div', 'guide-head');
      const title = element('div');
      title.append(element('span', 'guide-kicker', 'DEMO ' + meta.number + ' / ⑤  ·  架空データ'), element('h2', '', meta.title), element('p', '', '上の白いボタンを順番に押してください。押した結果は下の緑色の欄に残ります。'));
      head.append(title, element('span', 'guide-mode', '外部サービスへの接続なし'));
      const flow = element('div', 'guide-flow');
      for (const [label, value] of [['入力', meta.source], ['この画面で行うこと', meta.operation], ['確認できる結果', meta.outcome]]) {
        const card = element('div', 'guide-flow-item');
        card.append(element('small', '', label), element('strong', '', value));
        flow.append(card);
      }
      const now = element('div', 'guide-now' + (state.done ? ' is-complete' : ''));
      const copy = element('div');
      copy.append(element('span', 'guide-step', state.done ? 'この画面は完了 · 次の画面へ' : state.run ? '次に押すボタン ' + state.step + ' / ' + state.total : 'いま自動処理中 ' + state.step + ' / ' + state.total), element('strong', '', state.done ? '操作と結果を確認しました' : state.action), element('p', '', state.effect));
      const button = element('button', 'guide-cta', state.run ? (state.done ? '次へ：' : '押す：') + state.action + ' →' : '自動処理中 · 追加クリック不要');
      button.type = 'button';
      button.setAttribute('aria-label', state.action);
      if (state.run) button.addEventListener('click', () => runGuideAction(id, state));
      else button.disabled = true;
      now.append(copy, button);
      const feedback = guideFeedback[id];
      const result = element('div', 'guide-result' + (feedback ? '' : ' is-empty'));
      result.append(element('span', '', feedback ? '押した結果 · ここに残ります' : '操作前 · まず上のボタンを押してください'), element('strong', '', feedback ? '押した操作：' + feedback.action : '上の白いボタンが、この画面の最初の操作です。'), element('p', '', feedback ? feedback.result : '押すと、実行内容と結果、次に押すボタンをここに表示します。'));
      slot.replaceChildren(head, now, result, flow, element('p', 'guide-boundary', meta.boundary + ' ブラウザを再読み込みするとデモの状態は初期化されます。'));
    }
  }
  function renderScenario() {
    const items = [
      { title: '① 顧問先との資料共有', done: portalViewed, guide: '就業規則を公開承認 → 顧問先表示へ切替 → 資料を確認', view: 'portal' },
      { title: '② 公文書の取得・仕分け', done: docs.some(d => d.shared), guide: '架空の4件を取得 → 仕分け → DOC-01の共有を承認', view: 'documents' },
      { title: '③ Outlookメール・添付整理', done: mails.some(m => m.status !== 'pending'), guide: '4件を分類し、保存候補・要確認・隔離を確認', view: 'mail' },
      { title: '④ 給与計算の自動化', done: payrollState.prepared, guide: '一括実行 → 3名分の給与計算 → 前月比較 → 共有準備', view: 'payroll' },
      { title: '⑤ 手続・給与の進捗管理', done: caseActivity, guide: '案件の工程を更新し、次の担当作業を確認', view: 'cases' }
    ];
    const done = items.filter(item => item.done).length;
    $('scenario-count').textContent = done + ' / 5 試した';
    $('side-progress').textContent = done + ' / 5';
    $('side-progress-bar').style.width = (done * 20) + '%';
    const list = $('scenario-list');
    list.replaceChildren();
    items.forEach((item, index) => {
      const button = element('button', 'scenario-item' + (item.done ? ' is-done' : ''));
      button.type = 'button';
      const num = element('span', 'scenario-num', String(index + 1).padStart(2, '0'));
      const copy = element('span', 'scenario-copy');
      copy.append(element('strong', '', item.title), element('small', '', item.guide));
      button.append(num, copy, element('span', 'scenario-state', item.done ? '試した ✓' : 'デモを開く →'));
      button.addEventListener('click', () => navigate(item.view));
      list.append(button);
    });
  }
  function renderAll() {
    renderDocs();
    renderPortal();
    renderMail();
    renderPayroll();
    renderCases();
    renderGuides();
    renderActionDock();
    renderScenario();
    updateCounts();
    renderLogs();
  }
  function navigate(id) {
    if (!views[id]) id = 'overview';
    activeView = id;
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== id; });
    document.querySelectorAll('[data-nav]').forEach(n => {
      const active = n.dataset.nav === id && n.classList.contains('nav-item');
      n.classList.toggle('is-active', active);
      if (n.classList.contains('nav-item')) {
        if (active) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
      }
    });
    $('breadcrumb').textContent = views[id];
    if (location.hash !== '#' + id) historyReplace(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
    renderActionDock();
  }
  function historyReplace(id) {
    window.history.replaceState(null, '', '#' + id);
  }
  document.querySelectorAll('[data-nav], [data-go]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      navigate(button.dataset.nav || button.dataset.go);
    });
  });
  document.querySelectorAll('[data-doc-tab]').forEach(button => {
    button.addEventListener('click', () => {
      portalTab = button.dataset.docTab;
      document.querySelectorAll('[data-doc-tab]').forEach(tab => {
        const active = tab === button;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      renderAll();
      recordGuide('portal', button.textContent + 'タブを開く', portalTab === 'rules' ? '公開済みの就業規則が顧問先担当者の画面に表示されます。未公開資料は表示されません。' : '選んだ分類の資料一覧へ切り替えました。公開前の資料は顧問先担当者には表示されません。');
    });
  });
  $('role-select').addEventListener('change', e => { role = e.target.value; renderAll(); recordGuide('portal', '表示する役割を変更', role === 'client' ? '顧問先担当者の表示に切り替えました。職員専用の公開待ち一覧を隠し、ABC社の公開済み資料だけを表示します。' : '事務所職員の表示に戻しました。公開待ちの資料を確認できます。'); });
  $('company-select').addEventListener('change', e => { company = e.target.value; renderAll(); recordGuide('portal', '対象の顧問先を変更', companies[company].name + 'の資料一覧へ切り替えました。'); });
  $('run-download').addEventListener('click', runDownload);
  $('run-sort').addEventListener('click', runSort);
  $('reset-sort').addEventListener('click', resetDocs);
  $('run-mail').addEventListener('click', runMail);
  $('reset-mail').addEventListener('click', resetMail);
  $('reset-payroll').addEventListener('click', () => payrollResetState());
  $('payroll-scenario').addEventListener('change', e => payrollResetState(e.target.value));
  $('run-payroll').addEventListener('click', runPayrollAutomation);
  $('download-payroll-csv').addEventListener('click', downloadPayrollCsv);
  $('case-company').addEventListener('change', renderCases);
  $('case-state').addEventListener('change', renderCases);
  $('jump-to-scope').addEventListener('click', () => $('scope').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
  window.addEventListener('scroll', renderActionDock, { passive: true });
  window.addEventListener('resize', renderActionDock);
  log('デモを開始。公文書4件、メール4件、進捗3件の架空データを読み込みました。');
  renderAll();
  navigate(location.hash.slice(1));
})();
