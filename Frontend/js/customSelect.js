/**
 * Tien Mobile - Dropdown tùy chỉnh thay cho <select> gốc của trình duyệt.
 * <select> thật vẫn giữ nguyên làm nguồn dữ liệu (value, sự kiện change, form),
 * chỉ phần hiển thị được thay bằng nút và danh sách theo phong cách của website.
 */

/**
 * Vị trí mục kế tiếp khi bấm phím mũi tên, Home, End (bỏ qua mục bị vô hiệu hóa).
 * @param {number} current vị trí hiện tại (-1 nếu chưa có)
 * @param {string} key ArrowDown | ArrowUp | Home | End
 * @param {boolean[]} disabled cờ vô hiệu hóa từng mục
 * @returns {number}
 */
export function moveIndex(current, key, disabled) {
  const count = disabled.length;
  if (count === 0) return -1;
  const ok = (i) => i >= 0 && i < count && !disabled[i];
  if (key === 'Home') { for (let i = 0; i < count; i++) if (ok(i)) return i; return current; }
  if (key === 'End') { for (let i = count - 1; i >= 0; i--) if (ok(i)) return i; return current; }
  const step = key === 'ArrowUp' ? -1 : 1;
  for (let i = current + step; i >= 0 && i < count; i += step) if (ok(i)) return i;
  return ok(current) ? current : -1;
}

let uid = 0;

function build(select) {
  const id = `cs${++uid}`;
  const wrap = document.createElement('div');
  wrap.className = 'cs' + (select.classList.contains('w-full') ? ' cs-block' : '');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = `cs-trigger ${select.className}`;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${id}-list`);
  const labelledBy = select.id && document.querySelector(`label[for="${select.id}"]`);
  if (labelledBy) {
    if (!labelledBy.id) labelledBy.id = `${id}-label`;
    trigger.setAttribute('aria-labelledby', labelledBy.id);
  } else if (select.getAttribute('aria-label')) {
    trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
  }

  const text = document.createElement('span');
  text.className = 'cs-text';
  const chevron = document.createElement('span');
  chevron.className = 'cs-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(text, chevron);

  const list = document.createElement('ul');
  list.className = 'cs-list';
  list.id = `${id}-list`;
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  select.parentNode.insertBefore(wrap, select);
  wrap.append(select, trigger, list);
  select.classList.add('cs-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  let active = -1;
  let options = [];

  const render = () => {
    options = [...select.options];
    list.innerHTML = '';
    options.forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'cs-option';
      li.id = `${id}-o${i}`;
      li.setAttribute('role', 'option');
      li.dataset.index = String(i);
      li.textContent = opt.textContent;
      if (opt.value === '') li.classList.add('cs-empty');
      if (opt.disabled) li.setAttribute('aria-disabled', 'true');
      list.appendChild(li);
    });
    sync();
  };

  const sync = () => {
    const selected = select.selectedIndex;
    const opt = options[selected];
    text.textContent = opt ? opt.textContent : '';
    trigger.classList.toggle('cs-placeholder', !opt || opt.value === '');
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === selected)));
  };

  const setActive = (i) => {
    active = i;
    [...list.children].forEach((li, idx) => li.classList.toggle('cs-active', idx === i));
    const li = list.children[i];
    if (li) {
      trigger.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView({ block: 'nearest' });
    } else {
      trigger.removeAttribute('aria-activedescendant');
    }
  };

  const place = () => {
    const r = trigger.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const height = Math.min(list.scrollHeight, 280);
    const up = below < height + 12 && r.top > below;
    list.style.minWidth = `${r.width}px`;
    list.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8))}px`;
    list.style.maxHeight = `${Math.max(120, Math.min(280, (up ? r.top : below) - 12))}px`;
    if (up) { list.style.top = 'auto'; list.style.bottom = `${window.innerHeight - r.top + 6}px`; }
    else { list.style.bottom = 'auto'; list.style.top = `${r.bottom + 6}px`; }
  };

  const isOpen = () => !list.hidden;
  const close = () => {
    if (!isOpen()) return;
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    window.removeEventListener('scroll', onViewport, true);
    window.removeEventListener('resize', close);
    document.removeEventListener('pointerdown', onOutside, true);
  };
  const onViewport = (e) => { if (!list.contains(e.target)) close(); };
  const onOutside = (e) => { if (!wrap.contains(e.target)) close(); };

  const open = () => {
    if (isOpen() || select.disabled) return;
    document.querySelectorAll('.cs-list:not([hidden])').forEach((el) => { el.hidden = true; });
    render();
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    place();
    setActive(Math.max(0, select.selectedIndex));
    window.addEventListener('scroll', onViewport, true);
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', onOutside, true);
  };

  const choose = (i) => {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    const changed = select.selectedIndex !== i;
    select.selectedIndex = i;
    sync();
    close();
    trigger.focus();
    if (changed) {
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  trigger.addEventListener('click', () => (isOpen() ? close() : open()));
  list.addEventListener('pointerdown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.cs-option');
    if (li) choose(Number(li.dataset.index));
  });
  list.addEventListener('pointermove', (e) => {
    const li = e.target.closest('.cs-option');
    if (li && Number(li.dataset.index) !== active) setActive(Number(li.dataset.index));
  });

  trigger.addEventListener('keydown', (e) => {
    const disabled = [...select.options].map((o) => o.disabled);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (!isOpen()) { open(); return; }
      setActive(moveIndex(active, e.key, disabled));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen()) choose(active); else open();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      close();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const q = e.key.toLowerCase();
      const start = isOpen() ? active : select.selectedIndex;
      const labels = [...select.options].map((o) => o.textContent.trim().toLowerCase());
      const hit = labels.findIndex((l, i) => i > start && l.startsWith(q) && !disabled[i]);
      const first = hit >= 0 ? hit : labels.findIndex((l, i) => l.startsWith(q) && !disabled[i]);
      if (first >= 0) { if (isOpen()) setActive(first); else { select.selectedIndex = first; sync(); select.dispatchEvent(new Event('change', { bubbles: true })); } }
    }
  });

  // Đồng bộ khi mã nguồn đổi giá trị, khi reset form hoặc khi danh sách mục thay đổi
  select.addEventListener('change', sync);
  select.form?.addEventListener('reset', () => setTimeout(sync, 0));
  new MutationObserver(render).observe(select, { childList: true });
  select.addEventListener('focus', () => trigger.focus());

  render();
}

/**
 * Thay mọi <select> trong phạm vi bằng dropdown tùy chỉnh (bỏ qua <select multiple> và [data-native]).
 * @param {ParentNode} [root]
 */
export function enhanceSelects(root = document) {
  root.querySelectorAll('select:not([multiple]):not([data-native]):not(.cs-native)').forEach(build);
}
