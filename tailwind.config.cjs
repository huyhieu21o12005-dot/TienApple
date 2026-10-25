/** Cấu hình Tailwind cho web bán hàng (trang chủ và chi tiết sản phẩm). Biên dịch: npm run build:css */
module.exports = {
  content: ['./Frontend/*.html', './Frontend/js/**/*.js', './Frontend/admin/modelImages.js'],
  theme: {
    extend: {
      colors: { brand: { black: '#1D1D1F', gray: '#6E6E73', light: '#F5F5F7', border: '#D2D2D7', blue: '#0071E3' } },
      fontFamily: { sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'] }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')]
};
