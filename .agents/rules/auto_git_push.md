# Quy tắc triển khai tự động lên GitHub & Web

Mỗi khi hoàn thành chỉnh sửa hoặc vá lỗi trong dự án:
1. BẮT BUỘC kiểm tra bản build và unit test (`npm test && npm run build`).
2. TỰ ĐỘNG stage, commit với commit message rõ ràng và chạy lệnh `git push origin main` đẩy thẳng lên GitHub để hệ thống CI/CD (Vercel) cập nhật trực tiếp lên website.
3. Tuyệt đối KHÔNG dừng lại ở bước sửa local mà không đẩy lên git, người dùng cần theo dõi trực tiếp kết quả trên web.
