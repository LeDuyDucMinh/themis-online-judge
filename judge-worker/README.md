# HƯỚNG DẪN CHẠY JUDGE WORKER TRÊN VPS (103.149.170.5)

Đây là tiến trình Worker siêu nhẹ (chỉ tốn ~35MB RAM) chạy ngầm trên VPS để chấm bài theo cơ chế **Hàng đợi Bất đồng bộ (Async Queue) & Supabase Realtime**.

---

### Cách 1: Chạy thử trực tiếp bằng Node.js (Chỉ 1 lệnh)

Mở SSH vào VPS của bạn và chạy:

```bash
cd /root/themis-online-judge/judge-worker
node worker.js
```

Khi có bài nộp, màn hình sẽ hiển thị log thời gian thực:
```
[14:55:00] 🚀 Bắt đầu chấm bài [sub_17949...] | Bài: NGUYENTO | Học sinh: Đức Minh
[14:55:01] ✅ Hoàn tất [sub_17949...] trong 0.28s | Kết quả: AC (20/20) | Điểm: 10.0/10
```

---

### Cách 2: Chạy ngầm 24/7 với PM2 (Khuyên dùng)

Để Worker tự động khởi động cùng VPS và không bao giờ bị tắt:

```bash
# 1. Cài đặt PM2 (nếu chưa có)
npm install -g pm2

# 2. Vào thư mục và khởi chạy
cd /root/themis-online-judge/judge-worker
pm2 start ecosystem.config.cjs

# 3. Lưu lại để tự động chạy khi khởi động lại VPS
pm2 save
pm2 startup
```

Các lệnh quản lý PM2 tiện ích:
- Xem trạng thái: `pm2 status`
- Xem log chấm bài: `pm2 logs themis-judge-worker`
- Khởi động lại: `pm2 restart themis-judge-worker`
