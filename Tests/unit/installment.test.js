import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcInstallment, validateInstallmentRecord, buildInstallmentRow, filterInstallments,
  installmentStatusLabel, nextDueDate, parseMoney, parseRate, INSTALLMENT_DOCUMENTS
} from '../../Frontend/js/installment.js';

const valid = {
  name: 'Nguyễn An', phone: '0912 345 678', product: 'iPhone 15 Pro Max',
  price: '30.000.000', downPayment: '10.000.000', rate: '1,5', term: '6', payMethod: 'Tiền mặt',
  documents: ['CCCD / CMND', 'Bằng lái xe'], startDate: '2026-10-24', paidMonths: '0', note: ''
};

describe('installment - parse', () => {
  it('parseMoney chấp nhận dấu chấm/phẩy/đ và từ chối chữ', () => {
    assert.equal(parseMoney('30.000.000đ'), 30000000);
    assert.equal(parseMoney(' 1,500 '), 1500);
    assert.ok(Number.isNaN(parseMoney('abc')));
    assert.ok(Number.isNaN(parseMoney('')));
  });

  it('parseRate nhận 1,5 / 1.5 / 2% / rỗng = 0, từ chối sai', () => {
    assert.equal(parseRate('1,5'), 1.5);
    assert.equal(parseRate('2%'), 2);
    assert.equal(parseRate(''), 0);
    assert.ok(Number.isNaN(parseRate('1.555')));
    assert.ok(Number.isNaN(parseRate('x')));
  });
});

describe('installment - calcInstallment', () => {
  it('lãi 0: chia đều tiền vay, làm tròn lên nghìn', () => {
    const r = calcInstallment({ price: 30000000, downPayment: 10000000, rate: 0, term: 6 });
    assert.deepEqual(r, { valid: true, loan: 20000000, interest: 4000, monthly: 3334000, total: 30004000 });
  });

  it('cộng lãi %/tháng trên khoản vay', () => {
    const r = calcInstallment({ price: 30000000, downPayment: 10000000, rate: '1,5', term: 6 });
    // 20.000.000/6 = 3.333.333 + 300.000 = 3.633.333 -> 3.634.000
    assert.equal(r.monthly, 3634000);
    assert.equal(r.total, 10000000 + 3634000 * 6);
    assert.equal(r.interest, 3634000 * 6 - 20000000);
  });

  it('trả trước để trống là 0; nhận chuỗi có dấu chấm', () => {
    const r = calcInstallment({ price: '12.000.000', downPayment: '', rate: '0', term: 12 });
    assert.equal(r.loan, 12000000);
    assert.equal(r.monthly, 1000000);
  });

  it('từ chối đầu vào sai', () => {
    assert.equal(calcInstallment().valid, false);
    assert.equal(calcInstallment({ price: 0, term: 6 }).valid, false);
    assert.equal(calcInstallment({ price: 1000000, downPayment: 1000000, term: 6 }).valid, false);
    assert.equal(calcInstallment({ price: 1000000, term: 0 }).valid, false);
    assert.equal(calcInstallment({ price: 1000000, term: 61 }).valid, false);
    assert.equal(calcInstallment({ price: 1000000, term: 6, rate: 101 }).valid, false);
    assert.equal(calcInstallment({ price: 1000000, term: 6, rate: 'x' }).valid, false);
    assert.equal(calcInstallment({ price: 900000000, term: 6 }).valid, false);
  });
});

describe('installment - validateInstallmentRecord', () => {
  it('chấp nhận hồ sơ hợp lệ và chuẩn hóa số điện thoại', () => {
    const r = validateInstallmentRecord(valid);
    assert.equal(r.valid, true);
    assert.equal(r.phone, '0912345678');
  });

  it('giấy tờ, ghi chú, trả trước, lãi, kỳ đã đóng là tùy chọn', () => {
    assert.equal(validateInstallmentRecord({ ...valid, documents: [], note: '', downPayment: '', rate: '', paidMonths: '' }).valid, true);
  });

  it('báo lỗi từng trường', () => {
    assert.equal(validateInstallmentRecord(null).valid, false);
    assert.equal(validateInstallmentRecord({}).valid, false);
    for (const patch of [
      { name: ' ' }, { phone: '123' }, { product: '' }, { price: 'abc' }, { price: '900000000' },
      { downPayment: '30000000' }, { downPayment: 'x' }, { rate: '120' }, { rate: 'x' },
      { term: '0' }, { term: '61' }, { term: '2.5' }, { payMethod: 'Bitcoin' },
      { documents: ['Thẻ ATM'] }, { startDate: '24/10/2026' }, { paidMonths: '7' }, { paidMonths: '-1' }
    ]) {
      assert.equal(validateInstallmentRecord({ ...valid, ...patch }).valid, false, JSON.stringify(patch));
    }
  });
});

describe('installment - buildInstallmentRow', () => {
  it('đổi biểu mẫu thành dòng bảng installments', () => {
    const row = buildInstallmentRow(valid);
    assert.equal(row.original_price, 30000000);
    assert.equal(row.down_payment, 10000000);
    assert.equal(row.interest_rate, 1.5);
    assert.equal(row.term_months, 6);
    assert.equal(row.phone, '0912345678');
    assert.equal(row.documents, 'CCCD / CMND, Bằng lái xe');
    assert.equal(row.note, null);
    assert.equal(row.start_date, '2026-10-24');
  });

  it('cắt độ dài, bỏ giấy tờ lạ, thiếu thì dùng mặc định', () => {
    const row = buildInstallmentRow({ ...valid, product: 'x'.repeat(300), name: 'y'.repeat(300), note: 'z'.repeat(900), documents: ['Lạ'], downPayment: '', startDate: '', paidMonths: '' });
    assert.ok(row.product.length <= 100 && row.customer_name.length <= 100 && row.note.length <= 500);
    assert.equal(row.documents, null);
    assert.equal(row.down_payment, 0);
    assert.equal(row.start_date, undefined);
    assert.equal(row.paid_months, 0);
    assert.equal(buildInstallmentRow({ ...valid, documents: undefined }).documents, null);
    assert.ok(INSTALLMENT_DOCUMENTS.length > 0);
  });
});

describe('installment - quản trị', () => {
  const list = [
    { code: 'TG1001', customer_name: 'An', phone: '0912345678', product: 'iPhone 15', status: 'active' },
    { code: 'TG1002', customer_name: 'Bình', phone: '0987654321', product: 'Galaxy S24', status: 'completed' }
  ];

  it('lọc theo trạng thái và từ khóa', () => {
    assert.equal(filterInstallments(list).length, 2);
    assert.equal(filterInstallments(list, { status: 'completed' })[0].code, 'TG1002');
    assert.equal(filterInstallments(list, { query: 'galaxy' }).length, 1);
    assert.equal(filterInstallments(list, { query: '0912' })[0].code, 'TG1001');
    assert.deepEqual(filterInstallments(null), []);
    assert.equal(filterInstallments([null, ...list]).length, 2);
  });

  it('nhãn trạng thái và ngày kỳ tới', () => {
    assert.equal(installmentStatusLabel('active'), 'Đang góp');
    assert.equal(installmentStatusLabel('lạ'), 'lạ');
    assert.equal(installmentStatusLabel(null), '');
    assert.equal(nextDueDate('2026-01-31', 0, 6), '2026-02-28');
    assert.equal(nextDueDate('2026-01-15', 2, 6), '2026-04-15');
    assert.equal(nextDueDate('2026-01-15', 6, 6), '');
    assert.equal(nextDueDate('2026-01-15', 'x', 6), '');
  });
});
