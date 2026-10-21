# 🏆 FAMINH ONLINE JUDGE PLATFORM
### Nền tảng Luyện Lập Trình & Chấm Bài Tự Động Chuẩn Themis - Bảo Mật Phân Quyền Giáo Viên

Hệ thống được thiết kế riêng cho tổ chức **FAMINH**, hoạt động theo cơ chế chấm điểm thi Học sinh giỏi của phần mềm **Themis**.

---

## 🔒 HỆ THỐNG BẢO MẬT & PHÂN QUYỀN (ANTI-TAMPERING)
Nhằm mục đích bàn giao website cho học sinh tự do luyện tập mà **tuyệt đối không để học sinh truy cập vào khu vực Admin để sửa đề, xem trộm test case hoặc phá website**:

1. **Mặc định 100% người dùng là USER (Học sinh)**:
   - Các thanh menu quản trị (*Quản lý Chủ đề*, *Quản lý Đề & Test*) bị ẩn hoàn toàn.
   - Nút chuyển đổi tự do giữa Admin/User đã bị gỡ bỏ triệt để.
2. **Cổng xác thực Giáo viên (Admin Authentication Gate)**:
   - Trên thanh điều hướng chỉ có nút kín đáo **"Giáo viên"** với biểu tượng ổ khóa.
   - Khi nhấp vào, hộp thoại xác thực bảo mật mở ra yêu cầu nhập **Mật mã Quản trị viên (Admin Passcode)**.
   - **Mật khẩu mặc định ban đầu:** `faminh@2026`
   - **Cơ chế chống dò pass (Anti-Brute-Force)**: Tự động khóa cổng đăng nhập 30 giây nếu nhập sai quá 5 lần liên tiếp.
3. **Route Guard (Tường lửa bảo vệ)**:
   - Nếu học sinh cố tình nhập đường dẫn hoặc kích hoạt sự kiện truy cập trang Admin, hệ thống tự động chặn và đá về trang bài tập, đồng thời hiển thị hộp thoại yêu cầu mật mã.
4. **Tính năng Đổi Mật Khẩu Admin**:
   - Sau khi Giáo viên đăng nhập thành công, có thể nhấn biểu tượng chìa khóa ở góc trên để đổi mật khẩu riêng bất cứ lúc nào.
5. **Nút Đăng xuất Admin (Khóa hệ thống ngay lập tức)**:
   - Trước khi đưa máy cho học sinh hoặc rời khỏi máy, Giáo viên chỉ cần bấm **"Đăng xuất"** $\rightarrow$ Hệ thống lập tức khóa toàn bộ quyền Admin và chuyển về chế độ Học sinh.

---

## 🎨 NHẬN DIỆN THƯƠNG HIỆU FAMINH
- **Logo chính thức FAMINH**: Tích hợp tại thanh điều hướng Navbar, Favicon trình duyệt, Hero Banner trang chủ, cửa sổ xác thực và phần chân trang Footer.
- **Tông màu chủ đạo**: Đỏ đô / Rose / Dark Slate mang đậm phong cách khối hình lục giác đỏ của FAMINH.
- **Tiêu đề website**: `FAMINH - Nền Tảng Luyện Lập Trình & Chấm Bài Tự Động`.

---

## 🚀 TRUY CẬP HỆ THỐNG
- **Địa chỉ đang chạy:** [http://localhost:5173/](http://localhost:5173/)
- **Mật khẩu Admin mặc định:** `faminh@2026` *(khuyến nghị Giáo viên đổi lại sau khi đăng nhập).*
