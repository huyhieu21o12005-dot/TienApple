import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcInstallment, validateInstallment, buildInstallmentPayload, filterInstallments,
  installmentStatusLabel, INSTALLMENT_MONTHLY_RATE, INSTALLMENT_DOCUMENTS
} from '../../Frontend/js/installment.js';

const valid = {
  product: 'iPhone 15 Pro Max', price: '30.000.000', downPayment: '10.000.000', term: '6',
  method: 'Công ty tài chính', occupation: 'Nhân viên văn phòng',
  documents: ['CCCD / CMND', 'Bằng lái xe'], name: 'Nguyễn An', phone: '0912 345 678', note: ''
};

describe('installment - calcInstallment', () => {
  it('chia đều tiền vay theo kỳ hạn', () => {
    const r = calcInstallment({ price: 30000000, downPayment: 10000000, term: 6 }, 0);
    assert.deepEqual(r, { valid: true, loan: 20000000, monthly: 3334000, total: 30004000 });
  });

  it('cộng lãi tháng và làm tròn lên nghìn đồng', () => {
    const r = calcInstallment({ price: 12000000, downPayment: 0, term: 12 }, 0.01);
    assert.equal(r.monthly, 1120000);
  });

  it('nhận số có dấu chấm ngăn cách, trả trước để trống là 0', () => {
    assert.equal(calcInstallment({ price: '12.000.000', downPayment: '', term: 12 }, 0).loan, 12000000);
  });

  it('từ chối giá, trả trước hoặc kỳ hạn sai', () => {
    assert.equal(calcInstallment({ price: 0, term: 6 }).valid, false);
    assert.equal(calcInstallment({ price: 1000000, downPayment: 1000000, term: 6 }).valid, false);
    assert.equal(calcInstallment({ price: 1000000, downPayment: -5, term: 6 }).valid, false);
    assert.equal(calcInstallment({ price: 1000000, term: 5 }).valid, false);
    assert.equal(calcInstallment({ price: 900000000, term: 6 }).valid, false);
    assert.equal(calcInstallment().valid, false);
    assert.equal(INSTALLMENT_MONTHLY_RATE >= 0, true);
  });
});

describe('installment - validateInstallment', () => {
  it('chấp nhận biểu mẫu hợp lệ và chuẩn hóa số điện thoại', () => {
    const r = validateInstallment(valid);
    assert.equal(r.valid, true);
    assert.equal(r.phone, '0912345678');
  });

  it('hồ sơ đính kèm và ghi chú là tùy chọn', () => {
    assert.equal(validateInstallment({ ...valid, documents: [], note: '' }).valid, true);
  });

  it('báo lỗi từng trường', () => {
    assert.equal(validateInstallment({}).valid, false);
    assert.equal(validateInstallment(null).valid, false);
    assert.equal(validateInstallment({ ...valid, product: ' ' }).valid, false);
    assert.equal(validateInstallment({ ...valid, price: 'abc' }).valid, false);
    assert.equal(validateInstallment({ ...valid, price: '900000000' }).valid, false);
    assert.equal(validateInstallment({ ...valid, downPayment: '30000000' }).valid, false);
    assert.equal(validateInstallment({ ...valid, downPayment: 'x' }).valid, false);
    assert.equal(validateInstallment({ ...valid, term: '7' }).valid, false);
    assert.equal(validateInstallment({ ...valid, method: 'Khác' }).valid, false);
    assert.equal(validateInstallment({ ...valid, occupation: '' }).valid, false);
    assert.equal(validateInstallment({ ...valid, documents: ['Thẻ ATM'] }).valid, false);
    assert.equal(validateInstallment({ ...valid, name: '' }).valid, false);
    assert.equal(validateInstallment({ ...valid, phone: '123' }).valid, false);
  });
});

describe('installment - buildInstallmentPayload', () => {
  it('đổi biểu mẫu thành số nguyên và chuỗi trong giới hạn', () => {
    const p = buildInstallmentPayload(valid);
    assert.equal(p.price, 30000000);
    assert.equal(p.downPayment, 10000000);
    assert.equal(p.term, 6);
    assert.equal(p.phone, '0912345678');
    assert.equal(p.documents, 'CCCD / CMND, Bằng lái xe');
  });

  it('cắt độ dài, bỏ hồ sơ lạ, trả trước trống là 0', () => {
    const p = buildInstallmentPayload({ ...valid, downPayment: '', product: 'x'.repeat(300), name: 'y'.repeat(300), note: 'z'.repeat(900), documents: ['Lạ', INSTALLMENT_DOCUMENTS[0]] });
    assert.equal(p.downPayment, 0);
    assert.ok(p.product.length <= 100 && p.name.length <= 100 && p.note.length <= 500);
    assert.equal(p.documents, INSTALLMENT_DOCUMENTS[0]);
    assert.equal(buildInstallmentPayload({ ...valid, documents: undefined }).documents, '');
  });
});

describe('installment - quản trị', () => {
  const list = [
    { code: 'TG1001', customer_name: 'An', phone: '0912345678', product: 'iPhone 15', status: 'new' },
    { code: 'TG1002', customer_name: 'Bình', phone: '0987654321', product: 'Galaxy S24', status: 'approved' }
  ];

  it('lọc theo trạng thái và từ khóa', () => {
    assert.equal(filterInstallments(list).length, 2);
    assert.equal(filterInstallments(list, { status: 'approved' })[0].code, 'TG1002');
    assert.equal(filterInstallments(list, { query: 'galaxy' }).length, 1);
    assert.equal(filterInstallments(list, { query: '0912' })[0].code, 'TG1001');
    assert.deepEqual(filterInstallments(null), []);
  });

  it('nhãn trạng thái', () => {
    assert.equal(installmentStatusLabel('reviewing'), 'Đang xét hồ sơ');
    assert.equal(installmentStatusLabel('lạ'), 'lạ');
    assert.equal(installmentStatusLabel(null), '');
  });
});
