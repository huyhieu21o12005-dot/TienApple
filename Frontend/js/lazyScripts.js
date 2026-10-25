/**
 * Tien Mobile - Nạp script nặng (three.js) sau khi trang đã hiện, để không chặn lần vẽ đầu tiên.
 * Tách riêng, không phụ thuộc DOM thật để kiểm thử trong Node.
 */

const pending = new Map();

/** Nạp lần lượt các script classic: script sau chỉ gắn khi script trước đã chạy xong. Cùng một địa chỉ chỉ nạp một lần. */
export function loadScriptsInOrder(srcs, { doc = document, onEach } = {}) {
  return srcs.reduce((chain, src) => chain.then(() => {
    if (!pending.has(doc)) pending.set(doc, new Map());
    const mine = pending.get(doc);
    if (!mine.has(src)) {
      mine.set(src, new Promise((resolve, reject) => {
        const el = doc.createElement('script');
        el.src = src;
        el.onload = () => resolve(src);
        el.onerror = (e) => { mine.delete(src); reject(e instanceof Error ? e : new Error(`Không tải được ${src}`)); };
        doc.head.appendChild(el);
      }));
    }
    return mine.get(src).then((s) => { onEach?.(s); });
  }), Promise.resolve());
}

/** Chạy fn một lần khi trang đã tải xong và trình duyệt rảnh (không chạy chen vào lúc đang vẽ trang). */
export function whenPageIdle(fn, { win = window } = {}) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(() => fn(), { timeout: 2500 });
    else (win.setTimeout || setTimeout)(fn, 200);
  };
  if (win.document.readyState === 'complete') run();
  else win.addEventListener('load', run);
}
