import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, LE, MoreLink } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import { formatSo, formatTienNgan } from "@/pages/dashboard/admin/tong-quan/tongQuanFormat";
import TrangVaiTro from "@/pages/dashboard/vai-tro/TrangVaiTro";
import { BoCuc, DO, DaySo, FOCUS, HangCoNut, NgatTaiCham, Nut, ThaoTacNhanh, VIEN } from "@/pages/dashboard/vai-tro/khung";
import { phimTab } from "@/pages/dashboard/vai-tro/banPhim";
import { THU_TU } from "@/pages/dashboard/vai-tro/lop";
import { buocQuyTrinh, duongDanYeuCauNhap, lichTheoNgay, tenBienThe, theSoMuaHang } from "@/pages/dashboard/vai-tro/soLieuVaiTro";

/**
 * Tổng quan của NHÂN VIÊN MUA HÀNG (mọi kho). Hàng 1: 4 ô số. Hàng 2 (rộng hết trang): quy trình mua 4 bước, mỗi
 * bước một số và một nút việc tiếp theo. Dưới: lịch hàng về 7 ngày · mã Kho tổng cần mua thêm; cột phải: tạo nhanh ·
 * nhà cung cấp chính và số đơn giao đúng hạn.
 */
export default function DashboardPurchaseStaff() {
  return (
    <TrangVaiTro vaiTro="nhan_vien_mua_hang">
      {({ data, loading, loi, reload }) => {
        const m = data?.muaHang;
        const thoiDiem = data?.thoiDiem;
        return (
          <>
            <DaySo loading={loading} error={loi("chiSo")} onRetry={reload} the={m?.chiSo ? theSoMuaHang(m.chiSo, data.cauHinh, thoiDiem) : []} />
            <QuyTrinhMua buoc={m?.quyTrinh ? buocQuyTrinh(m.quyTrinh, data.cauHinh) : []} loading={loading} error={loi("quyTrinh")} onRetry={reload} />
            <BoCuc
              chinh={[
                <LichHangVe key="lich" className={THU_TU[2]} ngay={m?.lich && thoiDiem ? lichTheoNgay(m.lich, thoiDiem) : null} loading={loading} error={loi("lich")} onRetry={reload} />,
                <CanMuaThem key="cm" className={THU_TU[3]} cm={m?.canMua} loading={loading} error={loi("canMua")} onRetry={reload} />,
              ]}
              phai={[
                <ThaoTacNhanh
                  key="tn"
                  className={THU_TU[1]}
                  ds={[
                    { ten: "Tạo đơn mua", to: "/purchase-orders/create" },
                    { ten: "Yêu cầu báo giá", to: "/quotation-requests/create" },
                    { ten: "Thêm nhà cung cấp", to: "/supplier/new" },
                  ]}
                />,
                <NhaCungCap key="ncc" className={THU_TU[4]} ds={m?.nhaCungCap} loading={loading} error={loi("nhaCungCap")} onRetry={reload} />,
              ]}
            />
          </>
        );
      }}
    </TrangVaiTro>
  );
}

/* Quy trình mua: thẻ rộng (≥ 720px) 4 cột nối bằng mũi tên; thẻ hẹp thành danh sách bước. */
function QuyTrinhMua({ buoc, loading, error, onRetry }) {
  return (
    <Card
      title="Quy trình mua hàng"
      scope="việc đang mở ở từng bước"
      scopeClassName="@max-[520px]:hidden"
      right={<MoreLink to="/purchase-orders">Đơn mua</MoreLink>}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      <ol className="grid grid-cols-1 @min-[720px]:grid-cols-4">
        {buoc.map((b, i) => (
          <li
            key={b.key}
            className={cn(
              "relative flex min-w-0 gap-3 border-t border-[#eef1f5] px-5 py-4 first:border-t-0 @max-[719px]:py-3 @max-[520px]:px-4",
              "@min-[720px]:flex-col @min-[720px]:gap-0 @min-[720px]:border-l @min-[720px]:border-t-0 @min-[720px]:first:border-l-0",
            )}
          >
            <span
              className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold @min-[720px]:mb-3", b.gap ? "bg-bo-primary text-white" : "bg-[#eef1f5] text-[#475467]")}
              title={b.gap ? "Đến lượt bạn" : undefined}
            >
              {i + 1}
              {b.gap ? <span className="sr-only"> (đến lượt bạn)</span> : null}
            </span>
            <div className="flex min-w-0 flex-1 flex-col @max-[719px]:flex-row @max-[719px]:items-center @max-[719px]:gap-3">
              <div className="min-w-0 flex-1 @min-[720px]:flex-none">
                <p className="text-[13px] font-medium text-bo-muted">{b.ten}</p>
                <p className="mt-0.5">
                  <span className={cn("text-2xl font-semibold leading-8 tracking-[-0.02em]", b.so ? "text-bo-heading" : "text-[#8792a2]")}>{formatSo(b.so)}</span>{" "}
                  <span className="text-[13px] text-bo-muted">{b.donVi}</span>
                </p>
                <p className="mt-0.5 min-h-5 text-xs leading-5">
                  {b.tre ? <span className={cn("font-medium", DO)}>{b.tre}</span> : b.chuY ? <span className="font-medium text-[#a34a06]">{b.chuY}</span> : <span className="text-bo-muted">{b.phu}</span>}
                </p>
              </div>
              <div className="shrink-0 @min-[720px]:mt-auto @min-[720px]:pt-3">
                <Nut to={b.to} className="max-w-[148px] whitespace-normal text-center leading-4 @min-[720px]:w-full @min-[720px]:max-w-none">
                  {b.viec}
                </Nut>
              </div>
            </div>
            {i < buoc.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute -right-3 top-[26px] z-[1] hidden size-6 place-items-center rounded-full border border-[#e4e8ee] bg-white text-bo-muted shadow-sm @min-[720px]:grid"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* Lịch hàng về: ô "Trễ" và 7 ngày từ hôm nay; bấm ô để xem đơn của ngày đó. */
function LichHangVe({ ngay, className, loading, error, onRetry }) {
  const [chon, setChon] = useState(null);
  const ds = ngay ?? [];
  const macDinh = ds.find((n) => n.tre && n.so)?.key ?? ds.find((n) => n.homNay)?.key;
  const d = ds.find((n) => n.key === (chon ?? macDinh));
  return (
    <Card
      className={className}
      title="Lịch hàng về"
      scope="7 ngày tới"
      right={<MoreLink to="/purchase-orders?trangThai=dang-van-chuyen">Đơn đang giao</MoreLink>}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      <div
        role="tablist"
        aria-label="Chọn ngày"
        className={cn(LE, "grid grid-cols-4 gap-1.5 pt-4 @min-[480px]:grid-cols-8")}
        onKeyDown={(e) => d && phimTab(e, ds.map((n) => n.key), d.key, setChon, "lich-")}
      >
        {ds.map((n) => {
          const on = n.key === d?.key;
          return (
            <button
              key={n.key}
              id={`lich-${n.key}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="lich-ds"
              tabIndex={on ? 0 : -1}
              aria-label={n.tre ? `Đã trễ hạn, ${n.so} đơn` : `${n.homNay ? "Hôm nay, " : ""}${n.ten} ${n.ngay}, ${n.so} đơn`}
              onClick={() => setChon(n.key)}
              className={cn(
                FOCUS,
                "flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-lg border py-2 transition-[border-color,background-color,box-shadow]",
                on ? "border-bo-primary shadow-[0_0_0_1px_#1677ff]" : "border-[#e4e8ee] bg-white hover:border-[#c9d3e0]",
              )}
            >
              <span className={cn("text-[11px] leading-4", n.tre && n.so ? cn("font-medium", DO) : n.homNay ? "font-semibold text-bo-primary" : "text-bo-muted")}>
                {n.tre ? "Trễ" : n.homNay ? "Hôm nay" : n.thu}
              </span>
              <span className="grid h-5 place-items-center text-base font-semibold leading-5 text-bo-heading">
                {n.tre ? <AlertTriangle className="size-4 text-[#8792a2]" aria-hidden="true" /> : n.ngay}
              </span>
              <span className={cn("text-[11px] leading-4", n.so ? (n.tre ? cn("font-semibold", DO) : "font-semibold text-bo-foreground") : "text-bo-muted")}>{n.so ? `${n.so} đơn` : "–"}</span>
            </button>
          );
        })}
      </div>
      {d ? (
        <div id="lich-ds" role="tabpanel" aria-labelledby={`lich-${d.key}`}>
          <p className={cn(LE, "pb-1 pt-4 text-[13px] font-medium text-bo-foreground")}>{d.tre ? "Đơn đã quá ngày giao" : `${d.homNay ? "Hôm nay · " : ""}${d.ten} ${String(d.ngay).padStart(2, "0")}/${d.iso.slice(5, 7)}`}</p>
          {d.ds.length ? (
            <ul>
              {d.ds.map((x) => (
                <li key={x.key} className={cn("border-t first:border-t-0", VIEN)}>
                  <Link to={x.to} className={cn(LE, FOCUS, "flex items-center gap-3 py-2.5 transition-colors hover:bg-[#fafbfc]")}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-bo-foreground">{x.doiTac}</span>
                      <span className="block text-xs text-bo-muted">
                        {x.ma} · {x.sl}
                      </span>
                    </span>
                    {x.tt ? <span className={cn("shrink-0 text-[13px] font-medium tabular-nums", DO)}>{x.tt}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn(LE, "pb-5 pt-2 text-sm text-bo-muted")}>{d.tre ? "Không có đơn nào trễ hạn." : "Không có hàng về ngày này."}</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}

/* Nhà cung cấp có giá trị đặt mua lớn nhất 30 ngày qua và số đơn giao đúng hạn. */
function NhaCungCap({ ds, className, loading, error, onRetry }) {
  const list = ds ?? [];
  return (
    <Card className={className} title="Nhà cung cấp" scope="30 ngày qua" right={<MoreLink to="/supplier">Tất cả</MoreLink>} loading={loading} error={error} onRetry={onRetry}>
      {list.length === 0 ? (
        <p className={cn(LE, "py-6 text-sm text-bo-muted")}>Chưa có đơn mua nào được chốt trong 30 ngày qua.</p>
      ) : (
        <ul>
          {list.map((n) => {
            const coTre = n.denHan > 0 && n.dungHan < n.denHan;
            return (
              <li key={n.id} className={cn("border-t first:border-t-0", VIEN)}>
                <Link to={`/supplier/${n.id}`} className={cn(LE, FOCUS, "block py-2.5 transition-colors hover:bg-[#fafbfc]")}>
                  <span className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 text-sm text-bo-foreground">{n.ten}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-bo-heading">{formatTienNgan(n.giaTri)}</span>
                  </span>
                  <span className={cn("block text-xs", coTre ? DO : "text-bo-muted")}>
                    {n.denHan ? `Giao đúng hạn ${formatSo(n.dungHan)}/${formatSo(n.denHan)} đơn` : "Chưa có đơn đến hạn giao"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* Mã Hết / Sắp hết ở Kho tổng mà hàng đang về vẫn chưa đủ; đã có yêu cầu nhập đang mở thì không đề xuất tạo thêm. */
function CanMuaThem({ cm, className, loading, error, onRetry }) {
  const dong = cm?.dong ?? [];
  return (
    <Card
      className={className}
      title="Cần mua thêm"
      scope="Kho tổng, dưới ngưỡng tồn"
      scopeClassName="@max-[520px]:hidden"
      right={cm?.khoTongId != null ? <MoreLink to={`/reports/inventory?kho=${cm.khoTongId}`}>Báo cáo</MoreLink> : null}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {cm && cm.khoTongId == null ? (
        <p className={cn(LE, "py-6 text-sm text-bo-muted")}>Chưa có Kho tổng đang hoạt động.</p>
      ) : dong.length === 0 ? (
        <p className={cn(LE, "py-6 text-sm text-bo-muted")}>Kho tổng không có mã nào cần mua thêm.</p>
      ) : (
        <>
          <ul>
            {dong.map((r) => {
              const bien = tenBienThe(r.tenMau, r.tenKichCo);
              return (
                <HangCoNut
                  key={r.bienTheId}
                  ten={
                    <>
                      {r.tenSanPham}
                      {bien ? <span className="text-bo-muted"> · {bien}</span> : null}
                    </>
                  }
                  phu={
                    <span className={r.khaDung > 0 ? undefined : DO}>
                      <NgatTaiCham chu={`Kho tổng còn ${formatSo(r.khaDung)}${r.dangVe ? ` · đang về ${formatSo(r.dangVe)}` : ""} · ngưỡng ${formatSo(r.nguong)}`} />
                    </span>
                  }
                  nut={
                    r.yeuCauMoId != null ? (
                      <Link to={`/purchase-requests/${r.yeuCauMoId}`} className={cn(FOCUS, "whitespace-nowrap rounded text-[13px] leading-8 text-bo-muted hover:text-bo-foreground hover:underline")}>
                        {r.yeuCauMoMa ? `Đã có ${r.yeuCauMoMa}` : "Đã có yêu cầu nhập"}
                      </Link>
                    ) : (
                      <Nut to={duongDanYeuCauNhap(r, cm.khoTongId)}>Yêu cầu nhập {formatSo(r.soLuongDeXuat)}</Nut>
                    )
                  }
                />
              );
            })}
          </ul>
          {cm.tongSo > dong.length ? (
            <p className={cn(LE, "border-t py-3 text-[13px] text-bo-muted", VIEN)}>Còn {formatSo(cm.tongSo - dong.length)} mã khác cần mua thêm.</p>
          ) : null}
        </>
      )}
    </Card>
  );
}
