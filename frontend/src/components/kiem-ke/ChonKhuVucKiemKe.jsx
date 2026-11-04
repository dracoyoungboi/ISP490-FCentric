import { Fragment } from "react";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { ngayNgan } from "./phamViKiemKe";

// Dải kệ thu nhỏ: mỗi kệ một ô 10×14px; khu nhiều kệ chỉ vẽ tối đa 3 hàng (128px chứa 9 ô mỗi hàng), phần còn lại ghi "+n"
const KE_TOI_DA = 27;
const MAU_KE = {
  co_hang: "bg-slate-500",
  trong: "bg-slate-200",
  ban: "bg-amber-400",
  bao_tri: "bg-white ring-1 ring-inset ring-slate-300",
};
// data-viz: sọc chéo cho kệ bảo trì (không có lớp Tailwind sẵn cho nền sọc)
const SOC = { backgroundImage: "repeating-linear-gradient(135deg, #94a3b8 0 1.5px, transparent 1.5px 4px)" };
const CHU_GIAI = [
  ["co_hang", "Có hàng"],
  ["trong", "Trống"],
  ["ban", "Đợt khác đang giữ"],
  // Máy chủ chặn Bắt đầu khi phạm vi có kệ bảo trì (đưa kệ về hoạt động hoặc bỏ khu khỏi phạm vi), không bỏ qua
  ["bao_tri", "Bảo trì (chặn bắt đầu)"],
];
const TITLE_KIEM_GAN_NHAT = "Chỉ tính đợt theo khu vực / toàn kho đã duyệt";

function OKe({ loai, className }) {
  return <span className={cn("h-3.5 w-2.5 shrink-0 rounded-[2px]", MAU_KE[loai], className)} style={loai === "bao_tri" ? SOC : undefined} />;
}

function DaiKe({ ke, phanLoai }) {
  if (!ke.length) return <span className="text-xs text-bo-muted">Chưa có kệ</span>;
  const ve = ke.length > KE_TOI_DA ? ke.slice(0, KE_TOI_DA - 1) : ke;
  return (
    <span className="flex flex-wrap items-center gap-[3px]" aria-hidden="true">
      {ve.map((k) => (
        <OKe key={k.id} loai={phanLoai(k)} />
      ))}
      {ve.length < ke.length ? <span className="text-[11px] leading-[14px] text-bo-muted tabular-nums">+{soVN(ke.length - ve.length)}</span> : null}
    </span>
  );
}

function KiemGanNhat({ luc, lichSu }) {
  if (lichSu === "loi") return <span className="text-bo-muted" title="Chưa tải được lịch sử kiểm kê">—</span>;
  if (lichSu === "dang") return <span className="text-bo-muted">…</span>;
  if (!luc) return <span className="font-medium text-bo-warning">Chưa kiểm</span>;
  return (
    <span className="text-slate-600" title={`Đợt kiểm gần nhất được duyệt lúc ${luc.toLocaleString("vi-VN")}`}>
      {ngayNgan(luc)}
    </span>
  );
}

// Một khung lưới cho cả hàng tiêu đề và các hàng khu: hẹp (điện thoại, cột trái chật) chỉ 2 cột ô tick | khu, số liệu
// xuống dưới tên; bảng rộng từ 576px thì đủ 5 cột. Theo bề rộng CỦA BẢNG (@container/bangkhu), không theo khổ màn hình.
const LUOI = "grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 @xl/bangkhu:grid-cols-[16px_minmax(0,1fr)_128px_76px_88px]";

/**
 * Bảng chọn khu vực của đợt kiểm kê (phạm vi Theo khu vực): mỗi khu một hàng — ô tick, tên + mã (kệ đang thuộc đợt khác,
 * kệ bảo trì ghi cam), dải kệ thu nhỏ, số kệ / kệ có hàng, tổng sản phẩm trên sổ kệ, lần kiểm gần nhất. Chân bảng: chú giải màu,
 * Chọn tất cả / Bỏ chọn hết.
 *
 * - `dsKhu`: khu của kho (đã bỏ nhóm "Khác"), mỗi khu `{ id, ma, ten, ke: [{ id, ma, dangChua, … }] }`.
 * - `chon` (Set id khu), `onDoi(ids, bat)`: tick / bỏ tick. `khoa`: không sửa được (đợt không còn là nháp…).
 * - `phanLoai(ke)`: "co_hang" | "trong" | "ban" | "bao_tri".
 * - `kiemGanNhat`: Map id khu → Date. `lichSu`: "dang" | "loi" | "xong" (lỗi tải: cột hiện "—", không chặn gì).
 */
export default function ChonKhuVucKiemKe({ dsKhu, chon, onDoi, khoa = false, phanLoai, kiemGanNhat, lichSu = "xong" }) {
  const soChon = dsKhu.filter((kv) => chon.has(kv.id)).length;
  const tatCaId = dsKhu.map((kv) => kv.id);
  return (
    <div className="@container/bangkhu overflow-hidden rounded-lg border border-bo-border bg-white">
      <div className={cn(LUOI, "items-center border-b border-bo-border bg-bo-surface-subtle px-3.5 py-2 text-xs font-medium text-bo-muted")}>
        <span className="col-span-2">
          Khu vực · đã chọn{" "}
          <b className="font-semibold tabular-nums text-bo-foreground">
            {soVN(soChon)}/{soVN(dsKhu.length)}
          </b>
        </span>
        <span className="hidden @xl/bangkhu:block">Kệ</span>
        <span className="hidden text-right @xl/bangkhu:block">Trên sổ kệ</span>
        <span className="hidden text-right @xl/bangkhu:block" title={TITLE_KIEM_GAN_NHAT}>
          Kiểm gần nhất
        </span>
      </div>
      <ul className="m-0 list-none divide-y divide-slate-100 p-0">
        {dsKhu.map((kv) => {
          const daChon = chon.has(kv.id);
          const ke = kv.ke ?? [];
          const soBan = ke.filter((k) => phanLoai(k) === "ban").length;
          const soBaoTri = ke.filter((k) => phanLoai(k) === "bao_tri").length;
          const coMa = Boolean(kv.ten && kv.ma && kv.ma !== kv.ten);
          // Dòng phụ dưới tên: mã khu · kệ thuộc đợt khác · kệ bảo trì (hai mục sau chữ cam: đều chặn Bắt đầu)
          const dongPhu = [
            coMa ? kv.ma : null,
            soBan ? <span key="ban" className="font-medium text-bo-warning">{soVN(soBan)} kệ đang thuộc đợt khác</span> : null,
            soBaoTri ? <span key="bao-tri" className="font-medium text-bo-warning">{soVN(soBaoTri)} kệ bảo trì</span> : null,
          ].filter(Boolean);
          const coHang = ke.filter((k) => Number(k.dangChua) > 0).length;
          const tongSp = ke.reduce((s, k) => s + (Number(k.dangChua) || 0), 0);
          const ten = kv.ten || kv.ma || `Khu ${kv.id}`;
          const soKe = `${soVN(ke.length)} kệ · ${soVN(coHang)} có hàng`;
          const luc = kiemGanNhat?.get(Number(kv.id));
          return (
            <li key={kv.id}>
              <label
                className={cn(
                  LUOI,
                  "items-start px-3.5 py-2.5 transition-colors @xl/bangkhu:items-center",
                  daChon ? "bg-bo-primary-soft/50" : "hover:bg-bo-surface-subtle",
                  khoa ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
              >
                <input
                  type="checkbox"
                  checked={daChon}
                  disabled={khoa}
                  onChange={(e) => onDoi([kv.id], e.target.checked)}
                  className="mt-0.5 size-4 accent-bo-primary @xl/bangkhu:mt-0"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-bo-heading" title={ten}>
                    {ten}
                  </span>
                  {dongPhu.length ? (
                    <span className="block text-xs leading-4 text-bo-muted">
                      {dongPhu.map((x, i) => (
                        <Fragment key={i}>
                          {i ? " · " : null}
                          {x}
                        </Fragment>
                      ))}
                    </span>
                  ) : null}
                  {/* Bảng hẹp: số liệu xuống dưới tên */}
                  <span className="mt-1.5 grid gap-1 @xl/bangkhu:hidden">
                    <DaiKe ke={ke} phanLoai={phanLoai} />
                    <span className="text-xs leading-4 text-bo-muted tabular-nums">
                      {soKe} · {soVN(tongSp)} sp · <span title={TITLE_KIEM_GAN_NHAT}>Kiểm gần nhất</span>{" "}
                      <KiemGanNhat luc={luc} lichSu={lichSu} />
                    </span>
                  </span>
                </span>
                <span className="hidden gap-1 @xl/bangkhu:grid">
                  <DaiKe ke={ke} phanLoai={phanLoai} />
                  <span className="text-xs leading-4 text-bo-muted tabular-nums">{soKe}</span>
                </span>
                <span className="hidden text-right text-[13px] tabular-nums text-bo-foreground @xl/bangkhu:block">{soVN(tongSp)} sp</span>
                <span className="hidden text-right text-[13px] tabular-nums @xl/bangkhu:block">
                  <KiemGanNhat luc={luc} lichSu={lichSu} />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-bo-border px-3.5 py-2 text-xs text-bo-muted">
        {CHU_GIAI.map(([loai, nhan]) => (
          <span key={loai} className="inline-flex items-center gap-1.5">
            <OKe loai={loai} className="h-3" />
            {nhan}
          </span>
        ))}
        {!khoa ? (
          <span className="ml-auto flex items-center gap-4">
            {soChon < dsKhu.length ? (
              <NutChu onClick={() => onDoi(tatCaId, true)} className="text-xs">
                Chọn tất cả khu
              </NutChu>
            ) : null}
            {soChon ? (
              <NutChu onClick={() => onDoi(tatCaId, false)} className="text-xs">
                Bỏ chọn hết
              </NutChu>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
