(() => {
  'use strict';
  const views = {
    overview: '概要・業務フロー',
    documents: '公文書の取得・仕分け',
    portal: '顧問先ポータル',
    mail: 'Outlookメール整理',
    payroll: '給与計算の前後作業',
    cases: '手続・給与の進捗管理',
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
  const payrollLabels = [
    ['勤怠データの受領', '対象月・受領元を確認'],
    ['計算前の事前照合', '社員コードと重複行を確認'],
    ['計算後の差分確認', '変動金額を職員が確認'],
    ['給与資料の共有準備', '公開承認はポータルで実施']
  ];
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
  const payrollDone = [false, false, false, false];
  const payrollState = { received: false, prechecked: false, issues: [false, false], csv: false, reconciled: false, differenceChecked: false, prepared: false };
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
    for (const id of ['overview-log', 'document-log', 'mail-log']) {
      const target = $(id);
      target.replaceChildren();
      for (const item of (id === 'mail-log' ? history.filter(x => x.text.startsWith('メール')) : history).slice(0, id === 'overview-log' ? 3 : 10)) {
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
    $('kpi-payroll').innerHTML = String(payrollDone.filter(Boolean).length) + '<small>/ 4</small>';
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
  }
  function resetDocs() {
    docs.splice(0, docs.length, ...originalDocs.map(d => ({ ...d, status: 'received', company: null, shared: false })));
    cases.find(c => c.id === 'PROC-241').stage = 1;
    cases.find(c => c.id === 'PROC-242').stage = 2;
    log('文書処理を初期化。サンプル4件を受信済みに戻しました。');
    renderAll();
    announce('文書処理を初期化しました。');
  }
  function releaseResource(id) {
    const r = portalResources.find(x => x.id === id);
    if (!r || !r.ready || r.published || role !== 'staff') return;
    r.published = true;
    if (r.id === 'RES-P01') cases.find(c => c.id === 'PAY-211').stage = Math.max(cases.find(c => c.id === 'PAY-211').stage, 4);
    log(r.id + '：職員が公開を承認。' + companies[r.company].name + 'へ共有。');
    renderAll();
    announce('資料を顧問先へ公開しました（画面上の模擬処理）。');
  }
  function renderPortal() {
    if (role === 'client' && (docs.some(d => d.shared) || portalResources.some(r => r.published))) portalViewed = true;
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
  }
  function resetMail() {
    mails.splice(0, mails.length, ...originalMails.map(m => ({ ...m, status: 'pending', destination: '' })));
    log('メール処理を初期化しました。');
    renderAll();
    announce('メール処理を初期化しました。');
  }
  function payrollResetState() {
    payrollState.received = false;
    payrollState.prechecked = false;
    payrollState.issues = [false, false];
    payrollState.csv = false;
    payrollState.reconciled = false;
    payrollState.differenceChecked = false;
    payrollState.prepared = false;
    const resource = portalResources.find(r => r.id === 'RES-P01');
    resource.ready = false;
    resource.published = false;
    cases.find(c => c.id === 'PAY-211').stage = 0;
    log('給与の前後作業を初期化しました。');
    renderAll();
    announce('給与の前後作業を初期化しました。');
  }
  function runPrecheck() {
    if (!payrollState.received || payrollState.prechecked) return;
    payrollState.prechecked = true;
    log('給与：勤怠3行を事前照合。社員コード欠落と重複を検出。');
    renderAll();
    announce('2件の確認事項が見つかりました。');
  }
  function resolvePayrollIssue(index) {
    if (!payrollState.prechecked || payrollState.issues[index]) return;
    payrollState.issues[index] = true;
    log('給与：' + (index === 0 ? '社員コード欠落' : '重複行') + 'を職員が確認済みに変更。');
    renderAll();
    announce('確認事項を解消しました（模擬）。');
  }
  function downloadPayrollCsv() {
    if (!payrollState.prechecked || !payrollState.issues.every(Boolean) || payrollState.csv) return;
    const rows = [
      ['社員コード', '氏名', '対象月', '出勤日数', '労働時間'],
      ['001', '山田 太郎', '2026-11', '20', '160'],
      ['002', '佐藤 花子', '2026-11', '19', '152'],
      ['003', '高橋 健', '2026-11', '21', '168']
    ];
    const csv = '\uFEFF' + rows.map(row => row.join(',')).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-attendance-2026-11.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    payrollState.csv = true;
    log('給与：架空の確認用CSVを出力。製品の直接取込形式ではありません。');
    renderAll();
    announce('架空データの確認用CSVを出力しました。');
  }
  function runReconcile() {
    if (!payrollState.csv || payrollState.reconciled) return;
    payrollState.reconciled = true;
    log('給与：計算後の架空データを照合。手当差額8,000円を要確認へ。');
    renderAll();
    announce('差額8,000円が見つかりました。職員の確認が必要です。');
  }
  function approveDifference() {
    if (!payrollState.reconciled || payrollState.differenceChecked) return;
    payrollState.differenceChecked = true;
    log('給与：担当職員が架空の手当差額8,000円を確認済みに変更。');
    renderAll();
    announce('差分を確認済みにしました（模擬）。');
  }
  function preparePayrollShare() {
    if (!payrollState.differenceChecked || payrollState.prepared) return;
    payrollState.prepared = true;
    portalResources.find(r => r.id === 'RES-P01').ready = true;
    log('給与：資料を株式会社ABCの公開承認待ちに追加。');
    renderAll();
    announce('顧問先ポータルの公開承認待ちに追加しました。');
  }
  function renderPayroll() {
    payrollDone[0] = payrollState.received;
    payrollDone[1] = payrollState.prechecked && payrollState.issues.every(Boolean);
    payrollDone[2] = payrollState.csv && payrollState.reconciled && payrollState.differenceChecked;
    payrollDone[3] = payrollState.prepared;
    const completed = payrollDone.filter(Boolean).length;
    $('payroll-progress').textContent = completed + ' / 4 完了';
    $('payroll-next').textContent = completed === 4 ? '公開承認を待つ' : payrollLabels[completed][0];
    const list = $('payroll-steps');
    list.replaceChildren();
    payrollLabels.forEach((item, index) => {
      const row = element('div', 'check-row' + (payrollDone[index] ? ' is-done' : ''));
      if (index === 0 && !payrollState.received) {
        const button = element('button', '', '✓');
        button.type = 'button';
        button.setAttribute('aria-label', '勤怠データの受領を確認');
        button.addEventListener('click', () => {
          payrollState.received = true;
          log('給与：11月勤怠データの受領元と対象月を確認。');
          renderAll();
          announce('勤怠データの受領を確認しました。');
        });
        row.append(button);
      } else row.append(element('span', 'step-icon', payrollDone[index] ? '✓' : ''));
      const copy = element('div');
      copy.append(element('strong', '', item[0]), element('small', '', item[1]));
      row.append(copy, element('span', 'step-number', '0' + (index + 1)));
      list.append(row);
    });
    $('run-precheck').disabled = !payrollState.received || payrollState.prechecked;
    $('download-payroll-csv').disabled = !payrollDone[1] || payrollState.csv;
    $('run-reconcile').disabled = !payrollState.csv || payrollState.reconciled;
    $('prepare-payroll-share').disabled = !payrollState.differenceChecked || payrollState.prepared;
    const pre = $('precheck-results');
    pre.replaceChildren();
    if (!payrollState.prechecked) pre.append(element('p', 'queue-empty', payrollState.received ? '事前チェックを実行して、確認事項を表示してください。' : '勤怠受領を確認した後、事前チェックを実行できます。'));
    else {
      const issues = [
        ['社員コードの欠落', '架空の3行目。名寄せ前に本人と社員コードを確認します。'],
        ['同じ勤怠行の重複', '同一社員・対象月の行が2件。二重計上を防ぎます。']
      ];
      issues.forEach((issue, i) => {
        const row = element('div', 'result-row' + (payrollState.issues[i] ? ' is-done' : ''));
        const copy = element('div');
        copy.append(element('strong', '', issue[0]), element('small', '', issue[1]));
        row.append(copy);
        if (payrollState.issues[i]) row.append(element('span', 'badge ok', '職員確認済み'));
        else {
          const button = element('button', 'outline', '確認して修正');
          button.type = 'button';
          button.addEventListener('click', () => resolvePayrollIssue(i));
          row.append(button);
        }
        pre.append(row);
      });
    }
    const post = $('reconcile-results');
    post.replaceChildren();
    if (!payrollState.reconciled) post.append(element('p', 'queue-empty', '確認用CSVを出力した後、計算後の架空データを照合できます。'));
    else {
      const row = element('div', 'result-row' + (payrollState.differenceChecked ? ' is-done' : ''));
      const copy = element('div');
      copy.append(element('strong', '', '前月比：手当 +8,000円'), element('small', '', '変動理由と根拠を職員が確認。自動で給与額を確定しません。'));
      row.append(copy);
      if (payrollState.differenceChecked) row.append(element('span', 'badge ok', '職員確認済み'));
      else {
        const button = element('button', 'outline', '差分を確認済みにする');
        button.type = 'button';
        button.addEventListener('click', approveDifference);
        row.append(button);
      }
      post.append(row);
    }
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
      return;
    }
    c.stage++;
    caseActivity = true;
    log('案件' + c.id + '：' + c.steps[c.stage] + 'へ更新。担当 ' + c.owner + '。');
    renderAll();
    announce(c.title + 'を「' + c.steps[c.stage] + '」に更新しました。');
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
  function renderScenario() {
    const items = [
      { title: '公文書の取得・仕分け', done: docs.some(d => d.shared), guide: '一括取得 → 仕分け → DOC-01の共有を承認', view: 'documents' },
      { title: '顧問先との資料共有', done: portalViewed, guide: '職員で資料を公開し、表示する役割を「顧問先担当者」に切り替える', view: 'portal' },
      { title: 'Outlookメール・添付整理', done: mails.some(m => m.status !== 'pending'), guide: '「整理ルールを実行」を押し、保存候補・要確認・隔離を比べる', view: 'mail' },
      { title: '弥生給与の前後作業', done: payrollState.prepared, guide: '勤怠受領 → 事前チェック → CSV → 差分確認 → 共有準備', view: 'payroll' },
      { title: '手続・給与の進捗管理', done: caseActivity, guide: '案件の「次へ」を押し、資料公開前の進行制限も確認する', view: 'cases' }
    ];
    $('scenario-count').textContent = items.filter(item => item.done).length + ' / 5 試した';
    const list = $('scenario-list');
    list.replaceChildren();
    items.forEach((item, index) => {
      const button = element('button', 'scenario-item' + (item.done ? ' is-done' : ''));
      button.type = 'button';
      const num = element('span', 'scenario-num', String(index + 1).padStart(2, '0'));
      const copy = element('span', 'scenario-copy');
      copy.append(element('strong', '', item.title), element('small', '', item.guide));
      button.append(num, copy, element('span', 'scenario-state', item.done ? '試した ✓' : '画面を開く →'));
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
    renderScenario();
    updateCounts();
    renderLogs();
  }
  function navigate(id) {
    if (!views[id]) id = 'overview';
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
      renderPortal();
    });
  });
  $('role-select').addEventListener('change', e => { role = e.target.value; renderAll(); });
  $('company-select').addEventListener('change', e => { company = e.target.value; renderPortal(); });
  $('run-download').addEventListener('click', runDownload);
  $('run-sort').addEventListener('click', runSort);
  $('reset-sort').addEventListener('click', resetDocs);
  $('run-mail').addEventListener('click', runMail);
  $('reset-mail').addEventListener('click', resetMail);
  $('reset-payroll').addEventListener('click', payrollResetState);
  $('run-precheck').addEventListener('click', runPrecheck);
  $('download-payroll-csv').addEventListener('click', downloadPayrollCsv);
  $('run-reconcile').addEventListener('click', runReconcile);
  $('prepare-payroll-share').addEventListener('click', preparePayrollShare);
  $('case-company').addEventListener('change', renderCases);
  $('case-state').addEventListener('change', renderCases);
  $('jump-to-scope').addEventListener('click', () => $('scope').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
  log('デモを開始。公文書4件、メール4件、進捗3件の架空データを読み込みました。');
  renderAll();
  navigate(location.hash.slice(1));
})();
