document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-button');
  const menu = document.querySelector('#mobile-nav');
  if (toggle && menu) {
    const closeMenu = () => { toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'メニューを開く'); menu.hidden = true; };
    toggle.addEventListener('click', () => {
      const opened = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!opened));
      toggle.setAttribute('aria-label', opened ? 'メニューを開く' : 'メニューを閉じる');
      menu.hidden = opened;
    });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  }

  const form = document.querySelector('#trial-form');
  if (form) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const status = document.querySelector('#form-status');
      status.hidden = false;
      status.textContent = 'モックの確認画面です。入力内容は送信・保存されていません。本番では受付確認メールを送信し、スタッフが予約日時を確定する運用を想定します。';
      status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
});
