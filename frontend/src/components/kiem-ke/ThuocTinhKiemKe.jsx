import { useEffect, useState } from "react";
import { HardDrive, TriangleAlert } from "lucide-react";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { gioNgay } from "./tinhKiemKe";

// Trong khoảng này (ms) sau lần lưu thì ghi "vừa xong" thay cho giờ
const VUA_XONG_MS = 60000;

function O({ so, nhan, mau }) {
  return (
    <div className="rounded-md border border-bo-border bg-white px-2.5 py-2">
      <span className={cn("block text-lg font-semibold leading-6 tabular-nums text-bo-foreground", mau)}>{so}</span>
      <span className="block text-xs leading-4 text-bo-muted">{nhan}</span>
    </div>
  );
}

/** "Đã lưu tạm trên máy này · vừa xong / 10:42", "Chưa có số đếm nào trên máy này" hoặc cảnh báo không lưu được. */
function TrangThaiLuu({ luu, coSo }) {
  const [bayGio, setBayGio] = useState(() => Date.now());
  const luc = luu?.luc ?? null;
  useEffect(() => {
    if (luc == null) return undefined;
    const hen = setInterval(() => setBayGio(Date.now()), VUA_XONG_MS / 2);
    return () => clearInterval(hen);
  }, [luc]);

  if (luu?.loi) {
    // Chỗ duy nhất báo trình duyệt chặn lưu tạm (không lặp ở dòng thông báo)
    return (
      <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-md border border-bo-warning/40 bg-bo-warning-soft px-2.5 py-2 text-[13px] leading-[18px] text-bo-foreground">
        <TriangleAlert className="mt-px size-4 shrink-0 text-bo-warning" aria-hidden="true" />
        <span>
          <b className="font-semibold">Không lưu tạm được trên trình duyệt này</b>
          <span className="mt-0.5 block">
            Chế độ ẩn danh hoặc trang bị chặn lưu dữ liệu: số đếm chỉ còn tới khi đóng hoặc tải lại trang. Hãy hoàn thành trong
            phiên này.
          </span>
        </span>
      </div>
    );
  }
  const chu = !coSo
    ? "Chưa có số đếm nào trên máy này"
    : luc == null
      ? "Đã lưu tạm trên máy này"
      : `Đã lưu tạm trên máy này · ${bayGio - luc < VUA_XONG_MS ? "vừa xong" : gioNgay(luc)}`;
  // Không đặt vùng tự đọc: chữ "vừa xong" đổi thành giờ sau một phút, trình đọc màn hình không cần đọc lại giữa lúc đếm
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-md border border-bo-border bg-white px-2.5 py-2 text-[13px] leading-[18px] text-bo-foreground">
      <HardDrive className="mt-px size-4 shrink-0 text-bo-muted" aria-hidden="true" />
      <span>
        <b className="font-semibold">{chu}</b>
        <span className="mt-0.5 block text-bo-muted">
          Tự lưu sau mỗi lần nhập. Chỉ tài khoản của bạn trên máy này thấy; máy chủ ghi khi bấm Hoàn thành.
        </span>
      </span>
    </div>
  );
}

/**
 * Cột phải của Chi tiết đợt kiểm kê: Kho · Người chủ trì · Ghi chú; Tiến độ đếm (đang kiểm kê, người được đếm: thanh %,
 * khớp / thừa / thiếu kèm số sản phẩm — đếm mù chỉ còn thanh %) hoặc Kết quả (đã xong: khớp / thừa / thiếu / không đếm);
 * trạng thái lưu tạm số đếm trên máy. Số "x/y lô" đã ở bước Đếm hàng, số lô chưa đếm đã ở bộ lọc "Chưa đếm (n)" nên không
 * lặp ở đây.
 *
 * - `dem`: tinhKiemKe.demKiemKe. `suaDuoc`: đang kiểm kê và người này được đếm. `luu`: `{ luc, loi }` lần lưu tạm gần nhất.
 */
export default function ThuocTinhKiemKe({ dot, dem, daXong, mu = false, suaDuoc = false, luu }) {
  const hienTienDo = daXong || suaDuoc;
  const thua = { ma: "thua", so: `+${soVN(dem.spThua)}`, nhan: `thừa · ${soVN(dem.thua)} lô`, mau: "text-bo-primary-strong" };
  const thieu = { ma: "thieu", so: `−${soVN(dem.spThieu)}`, nhan: `thiếu · ${soVN(dem.thieu)} lô`, mau: "text-bo-danger" };
  const khop = { ma: "khop", so: soVN(dem.khop), nhan: "lô khớp" };
  const o = daXong
    ? [khop, thua, thieu, { ma: "khongDem", so: soVN(dem.khongDem), nhan: "lô không đếm" }]
    : mu
      ? []
      : [khop, thua, thieu];

  return (
    <CotThuocTinh nhan="Thông tin đợt kiểm kê">
      <NhomThuocTinh>
        <BangThuocTinh
          muc={[
            { nhan: "Kho", giaTri: dot.kho?.tenKho },
            { nhan: "Người chủ trì", giaTri: dot.nguoiChuTri?.hoTen },
            { nhan: "Ghi chú", giaTri: dot.ghiChu ? <span className="whitespace-pre-line break-words">{dot.ghiChu}</span> : null },
          ]}
        />
      </NhomThuocTinh>
      {hienTienDo ? (
        <NhomThuocTinh nhan={daXong ? "Kết quả" : "Tiến độ đếm"}>
          {daXong ? null : (
            <div className="mt-1 flex items-center gap-2.5">
              <span
                role="progressbar"
                aria-label="Tiến độ đếm"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={dem.phanTram}
                className="block h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/70"
              >
                <span
                  className={cn("block h-full rounded-full", dem.chua === 0 ? "bg-bo-success" : "bg-bo-primary")}
                  // data-viz: bề rộng theo phần trăm lô đã đếm
                  style={{ width: `${dem.phanTram}%` }}
                />
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-bo-foreground">{dem.phanTram}%</span>
            </div>
          )}
          {o.length ? (
            <div className={cn("mt-2.5 grid gap-2", o.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {o.map((x) => (
                <O key={x.ma} so={x.so} nhan={x.nhan} mau={x.mau} />
              ))}
            </div>
          ) : null}
          {suaDuoc && !daXong ? <TrangThaiLuu luu={luu} coSo={dem.daDem > 0} /> : null}
        </NhomThuocTinh>
      ) : null}
    </CotThuocTinh>
  );
}
