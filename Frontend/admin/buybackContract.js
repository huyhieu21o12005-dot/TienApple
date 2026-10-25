/**
 * Tien Mobile - Hợp đồng mua bán điện thoại đã qua sử dụng khi THU MÁY của khách (cửa hàng là Bên mua).
 * Thuần logic (không DOM) để kiểm thử trong Node. Cấu trúc trả về dùng chung với contractHtml() của invoiceHelpers.js.
 * Căn cứ: Bộ luật Dân sự 2015 (mua bán tài sản) và Luật Bảo vệ quyền lợi người tiêu dùng; điều khoản cam kết nguồn gốc,
 * không khóa iCloud/Google, không báo mất, không nợ trả góp theo thông lệ mua bán máy cũ.
 */

import { SHOP } from './invoiceHelpers.js';
import { parseMoney } from '../js/installment.js';

const BLANK = '..............................';
const BLANK_SHORT = '..................';
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readTriple(n, full) {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  const out = [];
  if (tram > 0 || full) out.push(`${DIGITS[tram]} trăm`);
  if (chuc > 1) out.push(`${DIGITS[chuc]} mươi`);
  else if (chuc === 1) out.push('mười');
  else if (tram > 0 || full) if (donvi > 0) out.push('lẻ');
  if (donvi > 0) {
    if (donvi === 1 && chuc > 1) out.push('mốt');
    else if (donvi === 5 && chuc > 0) out.push('lăm');
    else out.push(DIGITS[donvi]);
  }
  return out.join(' ');
}

/** 12500000 -> "Mười hai triệu năm trăm nghìn đồng"; không hợp lệ -> ''. */
export function moneyInWords(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > 999999999999) return '';
  if (n === 0) return 'Không đồng';
  const units = ['', ' nghìn', ' triệu', ' tỷ'];
  const groups = [];
  let rest = n;
  while (rest > 0) { groups.push(rest % 1000); rest = Math.floor(rest / 1000); }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const full = i < groups.length - 1;
    parts.push(readTriple(groups[i], full) + units[i]);
  }
  const text = `${parts.join(' ')} đồng`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const money = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')} đồng`;
const text = (v) => String(v ?? '').trim();
const or = (v, blank = BLANK_SHORT) => text(v) || blank;

function longDate(value) {
  const d = value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) return `ngày ${BLANK_SHORT} tháng ${BLANK_SHORT} năm ${BLANK_SHORT}`;
  return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

function numberOf(value) {
  const d = value ? new Date(value) : new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `Số: TM-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * Kiểm tra biểu mẫu trước khi in.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBuyback(d = {}) {
  const errors = [];
  if (!text(d.sellerName)) errors.push('Vui lòng nhập họ tên người bán.');
  if (!text(d.sellerCccd)) errors.push('Vui lòng nhập số CCCD/CMND của người bán.');
  if (!text(d.model)) errors.push('Vui lòng nhập tên máy.');
  if (!text(d.imei)) errors.push('Vui lòng nhập IMEI hoặc số serial.');
  const price = parseMoney(d.price);
  if (!Number.isFinite(price) || price <= 0) errors.push('Vui lòng nhập giá thu máy.');
  return { valid: errors.length === 0, errors };
}

/**
 * @param {object} d dữ liệu biểu mẫu (xem buyback.js)
 * @returns {object} cấu trúc hợp đồng cho contractHtml()
 */
export function buildBuybackContract(d = {}) {
  const price = parseMoney(d.price);
  const priceOk = Number.isFinite(price) && price > 0;
  const device = [
    ['Tên máy', or(d.model, BLANK)],
    ['Dung lượng / Màu sắc', [text(d.storage), text(d.color)].filter(Boolean).join(' / ') || BLANK_SHORT],
    ['IMEI / Số serial', or(d.imei, BLANK)],
    ['Tình trạng', or(d.condition, BLANK)],
    ['Sức khỏe pin', or(d.battery, BLANK_SHORT)],
    ['Phụ kiện kèm theo', or(d.accessories, 'Không')]
  ];
  return {
    title: 'HỢP ĐỒNG MUA BÁN ĐIỆN THOẠI ĐÃ QUA SỬ DỤNG',
    number: numberOf(d.date),
    place: 'Thủ Đức',
    dateText: longDate(d.date),
    intro: 'Căn cứ Bộ luật Dân sự năm 2015, Luật Bảo vệ quyền lợi người tiêu dùng và thỏa thuận của hai bên, hôm nay hai bên cùng ký hợp đồng mua bán điện thoại đã qua sử dụng với các điều khoản sau:',
    parties: [
      {
        heading: 'BÊN A - BÊN BÁN (khách hàng)',
        rows: [
          ['Họ và tên', or(d.sellerName, BLANK)],
          ['Năm sinh', or(d.sellerBirth)],
          ['CCCD/CMND số', `${or(d.sellerCccd, BLANK_SHORT)} cấp ngày ${or(d.cccdDate)} nơi cấp ${or(d.cccdPlace)}`],
          ['Địa chỉ', or(d.sellerAddress, BLANK)],
          ['Điện thoại', or(d.sellerPhone)]
        ]
      },
      {
        heading: 'BÊN B - BÊN MUA (cửa hàng)',
        rows: [
          ['Đơn vị', SHOP.name],
          ['Địa chỉ', SHOP.address || BLANK],
          ['Điện thoại', SHOP.hotline],
          ['Đại diện', or(d.shopRep, `${BLANK_SHORT} Chức vụ: ${BLANK_SHORT}`)]
        ]
      }
    ],
    articles: [
      { heading: 'Điều 1. Đối tượng hợp đồng', paragraphs: ['Bên A đồng ý bán và Bên B đồng ý mua một chiếc điện thoại đã qua sử dụng với thông tin sau:'], rows: device },
      {
        heading: 'Điều 2. Giá mua bán và thanh toán',
        rows: [
          ['Giá mua bán', priceOk ? money(price) : BLANK],
          ['Bằng chữ', (priceOk && moneyInWords(price)) || BLANK]
        ],
        paragraphs: [
          `Hình thức thanh toán: ${d.payMethod === 'transfer' ? '☒ Chuyển khoản   ☐ Tiền mặt' : d.payMethod === 'cash' ? '☐ Chuyển khoản   ☒ Tiền mặt' : '☐ Tiền mặt   ☐ Chuyển khoản'}.`,
          'Bên B thanh toán đủ một lần cho Bên A ngay khi hai bên ký hợp đồng và Bên A bàn giao máy. Giá trên đã bao gồm mọi chi phí, Bên A không phải trả thêm khoản nào.'
        ]
      },
      {
        heading: 'Điều 3. Cam kết của Bên A',
        paragraphs: [
          '3.1. Bên A là chủ sở hữu hợp pháp của chiếc điện thoại, có nguồn gốc rõ ràng, không phải tài sản có được từ hành vi vi phạm pháp luật; máy không đang tranh chấp, cầm cố, thế chấp hay bị cơ quan có thẩm quyền ngăn chặn giao dịch.',
          '3.2. Máy không bị báo mất, không nằm trong danh sách chặn IMEI, không còn nợ trả góp, nợ cước hay nghĩa vụ tài chính nào gắn với máy.',
          '3.3. Bên A đã đăng xuất tài khoản iCloud/Apple ID/Google, tắt Tìm iPhone/Find My Device/khóa FRP, gỡ mật khẩu màn hình và đã sao lưu, xóa toàn bộ dữ liệu cá nhân trước khi bàn giao. Bên B không chịu trách nhiệm về dữ liệu còn sót lại trên máy.',
          '3.4. Thông tin về tình trạng máy mà Bên A cung cấp là trung thực. Nếu sau khi giao dịch phát hiện máy vi phạm các cam kết trên (khóa iCloud, báo mất, có tranh chấp, thay đổi IMEI...), Bên A có trách nhiệm hoàn trả toàn bộ số tiền đã nhận và bồi thường thiệt hại phát sinh cho Bên B, đồng thời tự chịu trách nhiệm trước pháp luật.'
        ]
      },
      {
        heading: 'Điều 4. Bàn giao và kiểm tra',
        paragraphs: [
          'Bên A bàn giao máy và phụ kiện kèm theo (nếu có) tại cửa hàng của Bên B. Bên B kiểm tra ngoại hình, chức năng và IMEI ngay khi nhận; hai bên xác nhận tình trạng máy như mô tả tại Điều 1.',
          'Bên B có quyền từ chối mua nếu kiểm tra phát hiện máy không đúng mô tả, khóa tài khoản hoặc không rõ nguồn gốc, mà không phải bồi thường.'
        ]
      },
      {
        heading: 'Điều 5. Chuyển quyền sở hữu',
        paragraphs: ['Quyền sở hữu và rủi ro đối với chiếc điện thoại chuyển từ Bên A sang Bên B kể từ thời điểm Bên B nhận máy và thanh toán đủ tiền. Sau thời điểm này Bên A không còn quyền khiếu nại về giá bán.']
      },
      {
        heading: 'Điều 6. Điều khoản chung',
        paragraphs: [
          'Hai bên cam kết thực hiện đúng các điều khoản trong hợp đồng. Mọi tranh chấp được giải quyết trước hết bằng thương lượng, hòa giải; nếu không thành thì đưa ra Tòa án nhân dân có thẩm quyền.',
          'Hợp đồng lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản, có hiệu lực kể từ ngày ký.'
        ]
      }
    ],
    signatures: ['BÊN BÁN - BÊN A (ký, ghi rõ họ tên)', 'ĐẠI DIỆN BÊN MUA - BÊN B (ký, ghi rõ họ tên, đóng dấu)']
  };
}
