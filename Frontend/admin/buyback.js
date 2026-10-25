/**
 * Tien Mobile - Trang lập hợp đồng thu máy: /admin/buyback.html
 * Nhập thông tin khách và máy, xem hợp đồng A4 ngay bên phải rồi in. Không gọi máy chủ, không lưu thông tin khách.
 */

import { buildBuybackContract, validateBuyback } from './buybackContract.js';
import { contractHtml } from './invoiceHelpers.js';
import { alertDialog } from '../js/dialog.js';

const $ = (id) => document.getElementById(id);
const form = $('form');

function currentData() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.date = new Date().toISOString();
  return data;
}

function render() {
  $('sheet').innerHTML = contractHtml(buildBuybackContract(currentData()));
}

form.addEventListener('input', (e) => {
  if (e.target.id === 'price') {
    const digits = e.target.value.replace(/\D/g, '');
    e.target.value = digits ? Number(digits).toLocaleString('vi-VN') : '';
  }
  $('err').hidden = true;
  render();
});

$('printBtn').addEventListener('click', async () => {
  const { valid, errors } = validateBuyback(currentData());
  if (!valid) {
    $('err').textContent = errors.join(' ');
    $('err').hidden = false;
    await alertDialog(errors.join('\n'), { title: 'Chưa đủ thông tin' });
    return;
  }
  window.print();
});

$('clearBtn').addEventListener('click', () => { form.reset(); $('err').hidden = true; render(); });

render();
