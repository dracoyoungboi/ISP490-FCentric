import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import NutSaoChep from "@/components/shared/NutSaoChep";
import { formatDate } from "@/utils/formatters";

function NhanNhom({ children }) {
  return <div className="text-xs font-medium leading-4 text-bo-muted">{children}</div>;
}

/** Một dòng liên hệ có nút sao chép (số điện thoại, email): bấm xong nút hiện dấu tích "Đã chép" tại chỗ. */
function DongSaoChep({ giaTri, nhanSaoChep, kieu }) {
  if (!giaTri) return null;
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1">
      <span className={cn("min-w-0 flex-1 truncate text-[13px] text-slate-700", kieu)} title={giaTri}>
        {giaTri}
      </span>
      <NutSaoChep giaTri={giaTri} nhan={nhanSaoChep} />
    </div>
  );
}

function HanGiao({ giao }) {
  if (giao.loai === "quaHan") return <span className="whitespace-nowrap font-medium text-bo-danger"> · quá hạn {giao.soNgay} ngày</span>;
  if (giao.loai === "homNay") return <span className="whitespace-nowrap font-medium text-bo-warning"> · hôm nay</span>;
  if (giao.loai === "conLai") return <span className="whitespace-nowrap text-bo-muted"> · còn {giao.soNgay} ngày</span>;
  return null;
}

/**
 * Cột thuộc tính bên phải (kiểu Linear): nhà cung cấp, kho nhận, yêu cầu gốc, người tạo, hạn giao.
 * Dưới 1280px: xuống dưới bảng, các nhóm xếp 2 cột (từ 640px).
 */
export default function ThuocTinhDonMua({ don, giao, soDonCuaNcc }) {
  const ncc = don.nhaCungCap;
  const kho = don.khoNhap;
  const yeuCau = don.yeuCauMuaHang;

  return (
    <aside
      aria-label="Thông tin đơn mua hàng"
      className="grid min-w-0 content-start gap-x-8 border-t border-bo-border bg-bo-surface-subtle px-4 pb-5 sm:grid-cols-2 sm:px-6 xl:block xl:border-l xl:border-t-0"
    >
      <section className="border-b border-slate-200/70 py-4 sm:col-span-1">
        <NhanNhom>Nhà cung cấp</NhanNhom>
        {ncc ? (
          <>
            <Link
              to={`/supplier/${ncc.id}`}
              className="mt-2 inline-block font-semibold text-bo-primary hover:text-bo-primary-hover hover:underline"
            >
              {ncc.tenNhaCungCap || "—"}
            </Link>
            <div className="mt-0.5 text-[13px] text-bo-muted">
              {ncc.maNhaCungCap ? <span className="font-mono">{ncc.maNhaCungCap}</span> : null}
              {soDonCuaNcc != null ? `${ncc.maNhaCungCap ? " · " : ""}${soDonCuaNcc} đơn mua` : null}
            </div>
            {ncc.nguoiLienHe ? <div className="mt-3 text-sm text-bo-foreground">{ncc.nguoiLienHe}</div> : null}
            <DongSaoChep giaTri={ncc.soDienThoai} nhanSaoChep="Sao chép số điện thoại" kieu="tabular-nums" />
            <DongSaoChep giaTri={ncc.email} nhanSaoChep="Sao chép email" />
          </>
        ) : (
          <div className="mt-2 text-sm text-bo-muted">Đơn chưa gắn nhà cung cấp.</div>
        )}
      </section>

      <section className="border-b border-slate-200/70 py-4">
        <NhanNhom>Kho nhận</NhanNhom>
        <div className="mt-2 text-sm font-medium text-bo-foreground">
          {kho?.tenKho || "—"}
          {kho?.maKho ? <span className="ml-1.5 font-mono font-normal text-bo-muted">{kho.maKho}</span> : null}
        </div>
        {kho?.diaChi ? <div className="mt-0.5 text-[13px] leading-5 text-bo-muted">{kho.diaChi}</div> : null}
      </section>

      <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2.5 pt-4 text-[13px] leading-5 sm:col-span-2 xl:col-span-1">
        <dt className="text-bo-muted">Yêu cầu gốc</dt>
        <dd className="m-0 min-w-0">
          {yeuCau?.id ? (
            <Link to={`/purchase-requests/${yeuCau.id}`} className="font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">
              {yeuCau.soYeuCauMuaHang || `#${yeuCau.id}`}
            </Link>
          ) : (
            <span className="text-bo-muted">—</span>
          )}
        </dd>
        <dt className="text-bo-muted">Người tạo</dt>
        <dd className="m-0 min-w-0 break-words text-bo-foreground">{don.nguoiTao?.hoTen || "—"}</dd>
        <dt className="text-bo-muted">Giao dự kiến</dt>
        <dd className="m-0 min-w-0 tabular-nums text-bo-foreground">
          {don.ngayGiaoDuKien ? (
            <>
              {formatDate(don.ngayGiaoDuKien)}
              <HanGiao giao={giao} />
            </>
          ) : (
            <span className="text-bo-muted">—</span>
          )}
        </dd>
      </dl>
    </aside>
  );
}
