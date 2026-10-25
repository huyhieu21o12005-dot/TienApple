# Hướng dẫn phát triển web bán hàng

## Lệnh thường dùng

| Lệnh | Việc làm |
|------|----------|
| `npm test` | Chạy toàn bộ test (phải xanh trước khi commit) |
| `npm run coverage` | Đo độ phủ, **thất bại nếu dòng/nhánh/hàm dưới 90%** |
| `npm run build:css` | Biên dịch lại `Frontend/css/tailwind.css` |

## Khi thêm hoặc đổi lớp Tailwind

Web không còn tải Tailwind từ CDN (chậm, chặn hiển thị). CSS được biên dịch sẵn vào `Frontend/css/tailwind.css`.
Mỗi lần thêm lớp Tailwind mới vào `index.html`, `product.html` hoặc `Frontend/js/*.js`, chạy `npm run build:css` rồi commit cả file CSS.
Nếu quên, test `pageAssets` sẽ báo lớp nào còn thiếu.

## Biểu tượng (Material Symbols)

Chỉ tải đúng các biểu tượng đang dùng (tham số `icon_names` trong `index.html` và `product.html`, sắp theo chữ cái).
Thêm biểu tượng mới thì thêm tên vào cả hai chỗ, test `pageAssets` sẽ báo nếu thiếu.

## Tốc độ tải

- `three.js` và mô hình 3D chỉ tải sau khi trang hiện xong (`js/lazyScripts.js`).
- Sản phẩm trang chủ đọc bằng REST trực tiếp (`createRestClient`), không tải SDK Supabase; SDK chỉ tải khi ghi đơn hàng, bảo hành, trả góp.
- `vercel.json` đặt lưu đệm: ảnh/mô hình 30 ngày, JS/CSS 1 giờ + làm mới ngầm, HTML không lưu đệm.
- Ảnh chia sẻ link (Messenger/Zalo) do `api/product-og.js` trả cho bot; người dùng thường vẫn vào trang tĩnh.
