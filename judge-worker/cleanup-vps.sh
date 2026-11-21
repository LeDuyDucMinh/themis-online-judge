#!/usr/bin/env bash
set -u

echo "===================================================="
echo "🧹 DỌN DẸP Ổ CỨNG VPS JUDGE0 & CẬP NHẬT WORKER V2.1"
echo "===================================================="
echo "📊 Dung lượng ổ đĩa TRƯỚC khi dọn:"
df -h /

echo ""
echo "1️⃣  Dọn nhật ký (logs) Docker, PM2 và hệ thống..."
truncate -s 0 /var/lib/docker/containers/*/*-json.log 2>/dev/null || true
journalctl --vacuum-size=100M >/dev/null 2>&1 || true
pm2 flush >/dev/null 2>&1 || true
rm -rf /var/log/*.gz /var/log/*.[0-9] /root/.npm/_cacache 2>/dev/null || true

echo "2️⃣  Dọn dữ liệu bài chấm tạm (scratchpad) cũ trong PostgreSQL nội bộ của Judge0..."
PG_CID=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'judge0.*db|db|postgres' | head -n 1 || true)
if [ -n "${PG_CID}" ]; then
  PG_USER=$(docker exec "${PG_CID}" sh -c 'echo "${POSTGRES_USER:-judge0}"' 2>/dev/null || echo "judge0")
  PG_DB=$(docker exec "${PG_CID}" sh -c 'echo "${POSTGRES_DB:-judge0}"' 2>/dev/null || echo "judge0")
  echo "   → Tìm thấy container DB Judge0: ${PG_CID} (user=${PG_USER}, db=${PG_DB})"
  docker exec "${PG_CID}" psql -U "${PG_USER}" -d "${PG_DB}" -c "TRUNCATE TABLE submissions RESTART IDENTITY; VACUUM FULL;" 2>/dev/null \
    || docker exec "${PG_CID}" psql -U postgres -d judge0 -c "TRUNCATE TABLE submissions RESTART IDENTITY; VACUUM FULL;" 2>/dev/null \
    || echo "   ⚠️ Không truy cập được bảng submissions trong ${PG_CID} (bỏ qua an toàn)."
else
  echo "   ℹ️ Không thấy container PostgreSQL Judge0 đang chạy."
fi

echo "3️⃣  Dọn rác Docker không còn sử dụng (images/cache cũ)..."
docker system prune -f >/dev/null 2>&1 || true

echo "4️⃣  Cài lịch tự động dọn rác Judge0 mỗi 3:00 sáng hàng ngày (tránh đầy đĩa lặp lại)..."
cat << 'CRONEOF' > /etc/cron.d/themis-judge0-cleanup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 3 * * * root truncate -s 0 /var/lib/docker/containers/*/*-json.log 2>/dev/null; PG_CID=$(docker ps --format '{{.Names}}' | grep -iE 'judge0.*db|db|postgres' | head -n 1); [ -n "$PG_CID" ] && docker exec "$PG_CID" sh -c 'psql -U "${POSTGRES_USER:-judge0}" -d "${POSTGRES_DB:-judge0}" -c "DELETE FROM submissions WHERE created_at < NOW() - INTERVAL '\''1 day'\''; VACUUM;"' >/dev/null 2>&1; pm2 flush >/dev/null 2>&1
CRONEOF
chmod 644 /etc/cron.d/themis-judge0-cleanup 2>/dev/null || true

echo "5️⃣  Cập nhật worker.js bản mới (tách đôi payload test lớn + chống TLE giả)..."
if [ -d /root/themis-worker ]; then
  cd /root/themis-worker
  rm -rf .cache
  curl -sS -O https://raw.githubusercontent.com/LeDuyDucMinh/themis-online-judge/main/judge-worker/worker.js
  pm2 restart themis-worker
  sleep 2
  pm2 logs themis-worker --lines 10 --nostream || true
fi

echo ""
echo "📊 Dung lượng ổ đĩa SAU khi dọn:"
df -h /

USED_PCT=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ "${USED_PCT:-0}" -ge 80 ]; then
  echo ""
  echo "⚠️ Ổ đĩa vẫn đang dùng ${USED_PCT}%. Top thư mục chiếm dung lượng lớn nhất:"
  du -h --max-depth=2 /var /root /opt /home 2>/dev/null | sort -hr | head -n 15
fi
echo "===================================================="
echo "✅ HOÀN TẤT!"
