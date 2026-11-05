(() => {
  'use strict';
  const views = {
    overview: '概要・業務フロー',
    documents: '公文書の自動仕分け',
    portal: '顧問先ポータル',
    payroll: '給与・手続の進捗',
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
    ['勤怠データの受領', 'ファイルの受領元と対象月を確認'],
    ['入力・例外の確認', '欠勤・手当などを職員が確認'],
    ['給与計算の確定', '担当職員が最終確認'],
    ['給与明細の共有', '公開対象と送信先を確認']
  ];
  const $ = id => document.getElementById(id);
  const docs = originalDocs.map(d => ({ ...d, status: 'pending', company: null, shared: false }));
  const payrollDone = [false, false, false, false];
  const history = [];
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
    for (const id of ['overview-log', 'document-log']) {
      const target = $(id);
      target.replaceChildren();
      for (const item of history.slice(0, id === 'overview-log' ? 3 : 10)) {
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
    const shared = docs.filter(d => d.shared).length;
    $('kpi-review').innerHTML = String(review) + '<small>件</small>';
    $('kpi-shared').innerHTML = String(shared) + '<small>件</small>';
    $('kpi-payroll').innerHTML = String(payrollDone.filter(Boolean).length) + '<small>/ 4</small>';
    $('nav-review').textContent = String(review);
  }
  function badgeFor(d) {
    if (d.shared) return ['共有済み', 'share'];
    if (d.status === 'classified') return ['公開承認待ち', 'ok'];
    if (d.status === 'review') return ['要確認', 'warn'];
    if (d.status === 'duplicate') return ['重複を保留', 'skip'];
    return ['未処理', 'wait'];
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
      if (d.company) infoCell.append(element('span', 'doc-id', companies[d.company].name));
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
        actionCell.append(element('span', 'doc-id', d.shared ? '公開済み' : d.status === 'review' ? '右側で確認' : '—'));
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
        d.status = 'classified';
        log(d.id + '：職員の確認で' + companies[d.company].name + 'へ割当。公開は保留。');
        renderAll();
        announce('職員確認で割り当てました。顧問先への公開は別途承認が必要です。');
      });
      card.append(select, button);
      queue.append(card);
    }
  }
  function runSort() {
    const seen = new Set();
    for (const d of docs) {
      if (d.status !== 'pending' && d.status !== 'duplicate') seen.add(d.key);
    }
    let count = 0;
    for (const d of docs) {
      if (d.status !== 'pending') continue;
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
        seen.add(d.key);
        log(d.id + '：' + companies[d.company].name + 'へ分類。公開承認待ち。');
      }
    }
    if (!count) {
      log('再実行：未処理の文書なし。既存の結果を変更しませんでした。');
      announce('再実行しても文書は追加されません。');
    } else {
      announce('仕分けを実行しました。要確認と公開承認待ちを確認してください。');
    }
    renderAll();
  }
  function shareDocument(id) {
    const d = docs.find(x => x.id === id);
    if (!d || d.status !== 'classified' || !d.company || d.shared) return;
    d.shared = true;
    log(d.id + '：職員が公開を承認。' + companies[d.company].name + 'のポータルに表示。');
    renderAll();
    announce(companies[d.company].name + 'へ共有しました（画面上の模擬処理）。');
  }
  function resetDocs() {
    docs.splice(0, docs.length, ...originalDocs.map(d => ({ ...d, status: 'pending', company: null, shared: false })));
    log('文書処理を初期化。サンプル4件を未処理へ戻しました。');
    renderAll();
    announce('文書処理を初期化しました。');
  }
  function renderPortal() {
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
    const list = $('portal-files');
    list.replaceChildren();
    let files = [];
    if (portalTab === 'public') {
      files = docs.filter(d => d.company === company && d.status === 'classified' && (role === 'staff' || d.shared))
        .map(d => ({ name: d.name, meta: d.id + ' · ' + (d.shared ? '公開済み' : '職員のみ / 公開前'), note: d.subject }));
    } else if (portalTab === 'payroll') {
      files = role === 'staff' ? [{ name: '2026年11月 給与資料の受け渡し', meta: '職員のみ / 公開前 · 架空データ', note: '公開前に対象月と閲覧者を確認' }] : [];
    } else {
      files = role === 'staff' ? [{ name: '就業規則_説明用サンプル.pdf', meta: '職員のみ / 公開前 · 架空データ', note: '版と適用日を確認する設計' }] : [];
    }
    const titles = { public: ['PUBLIC DOCUMENTS', '公文書'], payroll: ['PAYROLL FILES', '給与資料'], rules: ['POLICIES', '就業規則'] };
    $('portal-category').textContent = titles[portalTab][0];
    $('portal-section-title').textContent = titles[portalTab][1];
    $('portal-count').textContent = files.length + '件';
    if (!files.length) {
      list.append(element('div', 'empty-state', role === 'client'
        ? '公開済みの資料はまだありません。職員の確認と公開承認後に、対象の顧問先へ表示されます。'
        : '分類済みの公文書はまだありません。受信ボックスから仕分けを実行してください。'));
    } else {
      for (const file of files) {
        const card = element('article', 'file-card');
        card.append(element('span', 'file-icon', 'PDF'), element('strong', '', file.name), element('small', '', file.meta), element('p', '', file.note));
        list.append(card);
      }
    }
  }
  function renderPayroll() {
    const list = $('payroll-steps');
    list.replaceChildren();
    const completed = payrollDone.filter(Boolean).length;
    $('payroll-progress').textContent = completed + ' / 4 完了';
    $('payroll-next').textContent = completed === 4 ? 'すべて完了' : payrollLabels[completed][0];
    payrollLabels.forEach((item, index) => {
      const row = element('div', 'check-row' + (payrollDone[index] ? ' is-done' : '') + (index > 0 && !payrollDone[index - 1] ? ' is-locked' : ''));
      const button = element('button', '', payrollDone[index] ? '✓' : '');
      button.type = 'button';
      button.disabled = index > 0 && !payrollDone[index - 1];
      button.setAttribute('aria-label', item[0] + (payrollDone[index] ? 'を未完了に戻す' : 'を完了にする'));
      button.addEventListener('click', () => {
        const willComplete = !payrollDone[index];
        payrollDone[index] = willComplete;
        if (!willComplete) for (let j = index + 1; j < payrollDone.length; j++) payrollDone[j] = false;
        log('給与進捗：' + item[0] + 'を' + (willComplete ? '完了' : '未完了') + 'に変更。');
        renderAll();
        announce(item[0] + 'を更新しました。');
      });
      const copy = element('div');
      copy.append(element('strong', '', item[0]), element('small', '', item[1]));
      row.append(button, copy, element('span', 'step-number', '0' + (index + 1)));
      list.append(row);
    });
  }
  function renderAll() {
    renderDocs();
    renderPortal();
    renderPayroll();
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
  $('role-select').addEventListener('change', e => { role = e.target.value; renderPortal(); });
  $('company-select').addEventListener('change', e => { company = e.target.value; renderPortal(); });
  $('run-sort').addEventListener('click', runSort);
  $('reset-sort').addEventListener('click', resetDocs);
  $('reset-payroll').addEventListener('click', () => {
    payrollDone.fill(false);
    log('給与進捗を初期化しました。');
    renderAll();
    announce('給与進捗を初期化しました。');
  });
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
  log('デモを開始。架空の公文書4件が受信ボックスにあります。');
  renderAll();
  navigate(location.hash.slice(1));
})();
