import { useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, LE, MoreLink } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import { formatSo } from "@/pages/dashboard/admin/tong-quan/tongQuanFormat";
import TrangVaiTro from "@/pages/dashboard/vai-tro/TrangVaiTro";
import { BoCuc, CAM, DongThoiGian, FOCUS, HangCoNut, NgatTaiCham, Nut, XANH } from "@/pages/dashboard/vai-tro/khung";
import { THU_TU } from "@/pages/dashboard/vai-tro/lop";
import { NHOM_VIEC_CHUNG, gioPhut, nhomHangSapVe, thoiDiemNgan, viecChungDong } from "@/pages/dashboard/vai-tro/soLieuVaiTro";
import { phimTab } from "@/pages/dashboard/vai-tro/banPhim";

/**
 * Tổng quan của NHÂN VIÊN KHO: màn làm việc, không phải màn báo cáo. Theo kho làm việc (ô đầu trang).
 * Phiếu nhặt đang giao cho bạn (vòng tiến độ, nút làm tiếp) · việc bạn đã xong hôm nay · việc chung của kho theo
 * năm ô đếm (bấm ô để xem danh sách) · hàng sắp về theo dòng thời gian.
 */
export default function DashboardWarehouseStaff() {
  return (
    <TrangVaiTro vaiTro="nhan_vien_kho" theoKho>
      {({ data, loading, loi, reload }) => {
        const n = data?.nhanVienKho;
        const thoiDiem = data?.thoiDiem;
        return (
          <BoCuc
            chinh={[
              <ViecCuaBan key="cb" className={THU_TU[1]} ds={n?.cuaBan} thoiDiem={thoiDiem} loading={loading} error={loi("cuaBan")} onRetry={reload} />,
              <ViecChung key="vc" className={THU_TU[3]} vc={n?.viecChung} thoiDiem={thoiDiem} loading={loading} error={loi("viecChung")} onRetry={reload} />,
            ]}
            phai={[
              <HomNay key="hn" className={THU_TU[2]} so={n?.homNay} thoiDiem={thoiDiem} loading={loading} error={loi("homNay")} onRetry={reload} />,
              <DongThoiGian
                key="sv"
                className={THU_TU[4]}
                tieuDe="Hàng sắp về"
                nhom={n?.sapVe ? nhomHangSapVe(n.sapVe.ds, thoiDiem) : []}
                right={
                  n?.sapVe && n.sapVe.tong > n.sapVe.ds.length && data?.kho ? (
                    <MoreLink to={data.kho.laKhoTong ? `/purchase-orders?trangThai=dang-van-chuyen&kho=${data.kho.id}` : "/transfer-tickets?trangThai=dang-van-chuyen"}>
                      Xem tất cả {formatSo(n.sapVe.tong)}
                    </MoreLink>
                  ) : null
                }
                trong="Không có hàng nào sắp về trong 7 ngày tới."
                loading={loading}
                error={loi("sapVe")}
                onRetry={reload}
              />,
            ]}
          />
        );
      }}
    </TrangVaiTro>
  );
}

function VongTienDo({ da, tong }) {
  const pt = tong ? Math.min(100, Math.round((da / tong) * 100)) : 0;
  const co = 72;
  const day = 7;
  const r = (co - day) / 2;
  const C = 2 * Math.PI * r;
  return (
    <div className="relative size-[72px] shrink-0" role="img" aria-label={`Đã nhặt ${formatSo(da)}/${formatSo(tong)} sản phẩm`}>
      <svg viewBox={`0 0 ${co} ${co}`} className="size-full -rotate-90" aria-hidden="true">
        <circle cx={co / 2} cy={co / 2} r={r} fill="none" stroke="#e3ecfb" strokeWidth={day} />
        {pt ? <circle cx={co / 2} cy={co / 2} r={r} fill="none" stroke={XANH} strokeWidth={day} strokeLinecap="round" strokeDasharray={`${(pt / 100) * C} ${C}`} /> : null}
      </svg>
      <span className="absolute inset-0 grid place-content-center text-center">
        <span className="text-base font-semibold leading-5 text-bo-heading">{pt}%</span>
      </span>
    </div>
  );
}

/** Phiếu nhặt đang giao cho bạn ở kho này: phiếu đang nhặt trước. */
function ViecCuaBan({ ds, thoiDiem, className, loading, error, onRetry }) {
  const list = ds ?? [];
  return (
    <Card
      className={className}
      title="Việc của bạn"
      scope={list.length ? `${list.length} phiếu nhặt đang giao cho bạn` : null}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {list.length === 0 ? (
        <p className={cn(LE, "py-6 text-sm text-bo-muted")}>Chưa có phiếu nhặt nào giao cho bạn. Nhận việc ở danh sách việc chung bên dưới.</p>
      ) : (
        <ul>
          {list.map((v, i) => {
            const dangNhat = v.trangThai === "dang_nhat";
            return (
              <li key={v.id} className={cn(LE, "flex flex-wrap items-center gap-x-5 gap-y-4 border-t border-[#eef1f5] py-4 first:border-t-0")}>
                <VongTienDo da={v.daQuet} tong={v.canNhat} />
                <div className="min-w-0 flex-[1_1_220px]">
                  <p className="text-xs font-medium text-bo-muted">{dangNhat ? "Đang nhặt hàng" : "Nhặt hàng · chưa bắt đầu"}</p>
                  <p className="mt-0.5 text-base font-semibold text-bo-heading">
                    {/* Phiếu nhặt của phiếu chuyển kho không có đơn: ghi số phiếu chuyển thay cho "0 đơn" */}
                    {v.ma} <span className="font-normal text-bo-muted">· {v.soPhieuChuyen ? `Chuyển kho ${v.soPhieuChuyen}` : `${formatSo(v.soDon)} đơn`}</span>
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-bo-muted">
                    {v.ngayTao && (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                        Tạo lúc {thoiDiemNgan(v.ngayTao, thoiDiem)}
                      </span>
                    )}
                    <span className="tabular-nums">
                      {formatSo(v.daQuet)}/{formatSo(v.canNhat)} sản phẩm
                    </span>
                  </p>
                </div>
                <Nut to={`/goods-issues/pick-lists/${v.id}`} kieu={i === 0 ? "chinh" : "phu"} co="vua" className="@max-[520px]:h-10 @max-[520px]:w-full">
                  {dangNhat ? "Tiếp tục nhặt" : "Bắt đầu nhặt"}
                </Nut>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Việc bạn đã làm xong hôm nay ở kho này. */
function HomNay({ so, thoiDiem, className, loading, error, onRetry }) {
  const o = so
    ? [
        { key: "nhap", ten: "Đã nhận", so: so.sanPhamDaNhap, phu: `sản phẩm · ${formatSo(so.phieuDaNhap)} phiếu` },
        { key: "nhat", ten: "Đã nhặt", so: so.sanPhamDaNhat, phu: `sản phẩm · ${formatSo(so.phieuDaNhat)} phiếu` },
        { key: "xuat", ten: "Đã xuất kho", so: so.phieuDaXuat, phu: "phiếu" },
      ]
    : [];
  return (
    <Card className={className} title="Hôm nay của bạn" scope={thoiDiem ? `đến ${gioPhut(thoiDiem)}` : null} loading={loading} error={error} onRetry={onRetry}>
      <div className="grid grid-cols-3 gap-px bg-[#eef1f5]">
        {o.map((s) => (
          <div key={s.key} className="min-w-0 bg-bo-surface px-5 py-4 @max-[440px]:px-4">
            <p className="truncate text-[13px] leading-5 text-bo-muted">{s.ten}</p>
            <p className="mt-0.5 text-xl font-semibold leading-7 text-bo-heading">{formatSo(s.so)}</p>
            <p className="text-xs leading-4 text-bo-muted">
              <NgatTaiCham chu={s.phu} />
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Việc chung của kho: năm ô đếm (bấm để xem), dưới là việc chờ lâu nhất trước. */
function ViecChung({ vc, thoiDiem, className, loading, error, onRetry }) {
  const [tab, setTab] = useState(null);
  const tabHien = tab ?? NHOM_VIEC_CHUNG.find((t) => vc?.[t.key]?.tong)?.key ?? "nhanHang";
  const nhom = NHOM_VIEC_CHUNG.find((t) => t.key === tabHien);
  const g = vc?.[tabHien];
  const ds = g?.ds ?? [];
  return (
    <Card
      className={className}
      title="Việc chung của kho"
      scope="việc đang chờ ở kho này"
      scopeClassName="@max-[520px]:hidden"
      right={g && g.tong > ds.length ? <MoreLink to={nhom.to}>Xem tất cả {formatSo(g.tong)}</MoreLink> : null}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      <div
        role="tablist"
        aria-label="Công đoạn"
        className={cn(LE, "grid grid-cols-3 gap-2 pb-1 pt-4 @min-[600px]:grid-cols-5")}
        onKeyDown={(e) => phimTab(e, NHOM_VIEC_CHUNG.map((t) => t.key), tabHien, setTab, "viec-chung-")}
      >
        {NHOM_VIEC_CHUNG.map((x) => {
          const on = x.key === tabHien;
          const n = vc?.[x.key]?.tong ?? 0;
          return (
            <button
              key={x.key}
              id={`viec-chung-${x.key}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="viec-chung-ds"
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(x.key)}
              className={cn(
                FOCUS,
                "flex min-w-0 cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow]",
                on ? "border-bo-primary shadow-[0_0_0_1px_#1677ff]" : "border-[#e4e8ee] bg-bo-surface hover:border-[#c9d3e0]",
              )}
            >
              <span className="truncate text-[13px] text-bo-muted">{x.ten}</span>
              <span className={cn("text-xl font-semibold leading-7", n ? "text-bo-heading" : "text-[#8792a2]")}>{formatSo(n)}</span>
            </button>
          );
        })}
      </div>
      <div id="viec-chung-ds" role="tabpanel" aria-labelledby={`viec-chung-${tabHien}`}>
        {ds.length === 0 ? (
          <p className={cn(LE, "py-4 text-sm text-bo-muted")}>{nhom.trong}</p>
        ) : (
          <ul className="pt-2">
            {ds.map((v) => {
              const d = viecChungDong(v);
              const moc = v.thoiDiem ? `${d.moc} ${thoiDiemNgan(v.thoiDiem, thoiDiem)}` : "";
              return (
                <HangCoNut
                  key={`${v.loai}-${v.id}`}
                  ten={
                    <>
                      <b className="font-semibold">{v.ma}</b> · {d.moTa}
                    </>
                  }
                  phu={
                    v.choLau ? (
                      <span className={CAM}>
                        <NgatTaiCham chu={moc ? `${moc} · đang chờ lâu` : "Đang chờ lâu"} />
                      </span>
                    ) : (
                      moc
                    )
                  }
                  nut={<Nut to={d.to}>{d.nut}</Nut>}
                />
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
