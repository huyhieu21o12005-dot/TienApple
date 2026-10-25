/**
 * Tien Mobile - Hộp thoại popup thay cho confirm / alert / prompt của trình duyệt.
 * Tự gắn style và DOM khi dùng lần đầu; mọi hàm trả về Promise.
 *   await confirmDialog('Xóa?', { danger: true })      -> true | false
 *   await alertDialog('Đặt hàng thành công')            -> void
 *   await promptDialog('Số tiền:', { defaultValue: 1 }) -> string | null
 */

const STYLE_ID = 'tm-dialog-style';
const CSS = `
.tm-dlg-backdrop{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45);backdrop-filter:blur(3px);animation:tmDlgFade .15s ease-out}
.tm-dlg{width:100%;max-width:400px;background:#fff;color:#1D1D1F;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.3);padding:22px 22px 16px;font-family:inherit;animation:tmDlgPop .18s ease-out}
.tm-dlg h2{margin:0 0 8px;font-size:17px;font-weight:700}
.tm-dlg p{margin:0 0 16px;font-size:14px;line-height:1.55;color:#424245;white-space:pre-line;word-break:break-word}
.tm-dlg input{width:100%;box-sizing:border-box;margin:0 0 16px;padding:10px 12px;font:inherit;font-size:15px;border:1px solid #D2D2D7;border-radius:10px}
.tm-dlg input:focus{outline:2px solid #0071E3;outline-offset:0;border-color:#0071E3}
.tm-dlg-actions{display:flex;gap:8px;justify-content:flex-end}
.tm-dlg button{font:inherit;font-size:14px;font-weight:600;padding:9px 18px;border-radius:999px;border:1px solid #D2D2D7;background:#F5F5F7;color:#1D1D1F;cursor:pointer}
.tm-dlg button.tm-ok{background:#0071E3;border-color:#0071E3;color:#fff}
.tm-dlg button.tm-danger{background:#D70015;border-color:#D70015;color:#fff}
.tm-dlg button:focus-visible{outline:2px solid #0071E3;outline-offset:2px}
@keyframes tmDlgFade{from{opacity:0}to{opacity:1}}
@keyframes tmDlgPop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@media (prefers-color-scheme:dark){.tm-dlg{background:#2C2C2E;color:#F5F5F7}.tm-dlg p{color:#D2D2D7}.tm-dlg input{background:#1C1C1E;color:#F5F5F7;border-color:#48484A}.tm-dlg button{background:#3A3A3C;border-color:#48484A;color:#F5F5F7}}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

function open({ title, message, okText, cancelText, danger, input }) {
  ensureStyle();
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'tm-dlg-backdrop';
    const box = document.createElement('div');
    box.className = 'tm-dlg';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = message;
    box.append(h, p);

    let field = null;
    if (input) {
      field = document.createElement('input');
      field.type = 'text';
      field.value = input.defaultValue ?? '';
      field.placeholder = input.placeholder ?? '';
      field.inputMode = input.inputMode || 'text';
      box.appendChild(field);
    }

    const actions = document.createElement('div');
    actions.className = 'tm-dlg-actions';
    let cancelBtn = null;
    if (cancelText) {
      cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = cancelText;
      actions.appendChild(cancelBtn);
    }
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = danger ? 'tm-danger' : 'tm-ok';
    okBtn.textContent = okText;
    actions.appendChild(okBtn);
    box.appendChild(actions);
    backdrop.appendChild(box);

    const previous = document.activeElement;
    const done = (value) => {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      if (previous && typeof previous.focus === 'function') previous.focus();
      resolve(value);
    };
    const accept = () => done(field ? field.value : true);
    const cancel = () => done(field ? null : false);
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
      else if (e.key === 'Enter' && document.activeElement !== cancelBtn) { e.preventDefault(); e.stopPropagation(); accept(); }
    }
    okBtn.addEventListener('click', accept);
    if (cancelBtn) cancelBtn.addEventListener('click', cancel);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) cancel(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(backdrop);
    (field || okBtn).focus();
    if (field) field.select();
  });
}

/** @returns {Promise<boolean>} */
export function confirmDialog(message, { title = 'Xác nhận', okText = 'Đồng ý', cancelText = 'Hủy', danger = false } = {}) {
  return open({ title, message: String(message ?? ''), okText, cancelText, danger });
}

/** @returns {Promise<void>} */
export async function alertDialog(message, { title = 'Thông báo', okText = 'Đã hiểu' } = {}) {
  await open({ title, message: String(message ?? ''), okText, cancelText: '', danger: false });
}

/** @returns {Promise<string|null>} null khi bấm Hủy hoặc Esc */
export function promptDialog(message, { title = 'Nhập thông tin', defaultValue = '', placeholder = '', inputMode = 'text', okText = 'Đồng ý', cancelText = 'Hủy' } = {}) {
  return open({ title, message: String(message ?? ''), okText, cancelText, danger: false, input: { defaultValue, placeholder, inputMode } });
}
