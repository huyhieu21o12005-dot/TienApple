/**
 * Tien Mobile - Supabase Configuration
 * 
 * Thay thế các giá trị bên dưới bằng thông tin từ dự án Supabase của bạn:
 * Project Settings -> API -> Project URL & Project API Keys (anon / public)
 * 
 * LƯU Ý BẢO MẬT:
 * - CHỈ dùng Anon Key (Public Key).
 * - TUYỆT ĐỐI KHÔNG dùng Service Role Key trên Client / Frontend.
 */

export const SUPABASE_URL = "https://kyyfafnkhbcgpedgllag.supabase.co";
// Publishable key: được phép công khai trong mã trình duyệt, bảo mật dựa vào RLS.
export const SUPABASE_ANON_KEY = "sb_publishable_KgFVQG_8I_w3kOwwhimO4g_R6WJ1Ssn";

/**
 * Kiểm tra xem cấu hình Supabase đã được điền hợp lệ hay chưa
 */
export function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL === 'string' &&
    SUPABASE_URL.trim() !== '' &&
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    typeof SUPABASE_ANON_KEY === 'string' &&
    SUPABASE_ANON_KEY.trim() !== '' &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
  );
}
