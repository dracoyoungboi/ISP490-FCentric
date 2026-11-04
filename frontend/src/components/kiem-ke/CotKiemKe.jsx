import { useState } from "react";
import { FileCheck2, Lock, LockOpen } from "lucide-react";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/formatters";
import { LOAI_PHAM_VI, moTaKhoa, moTaPhamVi, nhanPhamVi, tienCoDau } from "./kiemKe";

// Nhật ký: số mục hiện trước, còn lại mở bằng "Xem thêm"
const SO_NHAT_KY_HIEN = 6;
// Kệ trong phạm vi: số thẻ kệ hiện trước
const SO_KE_HIEN = 12;

const MAU_KHOA = {
  toan: "bg-bo-warning-soft text-bo-warning",
  min: "bg-bo-primary-soft text-bo-primary-strong",
  chua: "bg-slate-100 text-slate-600",
  mo: "bg-bo-success-soft text-bo-success",
};

function TheKhoa({ dot }) {
  const k = moTaKhoa(dot);
  const Icon = k.kieu === "mo" || k.kieu === "chua" ? LockOpen : Lock;
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-semibold", MAU_KHOA[k.kieu])}>
      <Icon className="size-3.5" aria-hidden="true" />
      {k.nhan}
    </span>
  );
}

/**
 * Cột phải của Chi tiết đợt kiểm kê: phạm vi và khóa, người chủ trì, lý do, mốc thời gian; phiếu điều chỉnh (đợt đã
 * duyệt); nhật ký thao tác (mới nhất trên cùng).
 */
export default function CotKiemKe({ dot, nhatKy, phieu }) {
  const [moHetNhatKy, setMoHetNhatKy] = useState(false);
  const [moHetKe, setMoHetKe] = useState(false);
  const dsKe = Array.isArray(dot.viTri) ? dot.viTri : [];
  const keHien = moHetKe ? dsKe : dsKe.slice(0, SO_KE_HIEN);
  const ds = Array.isArray(nhatKy) ? nhatKy : [];
  const nhatKyHien = moHetNhatKy ? ds : ds.slice(0, SO_NHAT_KY_HIEN);

  return (
    <CotThuocTinh nhan="Thông tin đợt kiểm kê">
      <NhomThuocTinh nhan="Phạm vi">
        <BangThuocTinh
          muc={[
            { nhan: "Kho", giaTri: dot.kho?.ten },
            // Kiểu + chi tiết phạm vi trên một dòng: "Khu vực: Khu A, Khu B" · "Toàn bộ kho"
            {
              nhan: "Phạm vi",
              giaTri:
                // Toàn kho, đợt cũ không ghi kiểu, Đột xuất: chỉ tên kiểu (mô tả "Mọi kệ của …" chỉ lặp lại)
                !dot.loaiKiemKe || dot.loaiKiemKe === "toan_bo" || dot.loaiKiemKe === "dot_xuat" || !moTaPhamVi(dot, 4)
                  ? nhanPhamVi(dot.loaiKiemKe)
                  : `${LOAI_PHAM_VI[dot.loaiKiemKe]?.ngan ?? nhanPhamVi(dot.loaiKiemKe)}: ${moTaPhamVi(dot, 4)}`,
            },
            { nhan: "Khóa", giaTri: <TheKhoa dot={dot} /> },
          ]}
        />
        {dsKe.length && dot.trangThai !== 0 ? (
          <div className="mt-3">
            <span className="text-xs leading-4 text-bo-muted">Kệ trong phạm vi ({soVN(dsKe.length)})</span>
            <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-1.5 p-0">
              {keHien.map((k) => (
                <li
                  key={k.id}
                  className="inline-flex h-6 items-center rounded-md border border-bo-border bg-white px-1.5 font-mono text-xs text-slate-700"
                >
                  {k.ma}
                </li>
              ))}
              {dsKe.length > SO_KE_HIEN && !moHetKe ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setMoHetKe(true)}
                    className="h-6 rounded-md px-1.5 text-xs font-semibold text-bo-primary hover:bg-bo-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                  >
                    +{soVN(dsKe.length - SO_KE_HIEN)} kệ
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </NhomThuocTinh>

      <NhomThuocTinh nhan="Thông tin">
        <BangThuocTinh
          muc={[
            { nhan: "Tên đợt", giaTri: dot.ten },
            { nhan: "Người chủ trì", giaTri: dot.nguoiChuTri?.hoTen },
            { nhan: "Lý do", giaTri: dot.lyDo ? <span className="whitespace-pre-line">{dot.lyDo}</span> : null },
            { nhan: "Ghi chú", giaTri: dot.ghiChu ? <span className="whitespace-pre-line">{dot.ghiChu}</span> : null, an: !dot.ghiChu },
            { nhan: "Dự kiến", giaTri: dot.ngayDuKienBatDau ? formatDateTime(dot.ngayDuKienBatDau) : null, an: !dot.ngayDuKienBatDau },
            { nhan: "Lý do hủy", giaTri: dot.lyDoHuy, an: !dot.lyDoHuy },
          ]}
        />
      </NhomThuocTinh>

      {phieu ? (
        <NhomThuocTinh nhan="Phiếu điều chỉnh tồn">
          <div className="rounded-md border border-bo-border bg-white px-3 py-2.5">
            <span className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-bo-success" aria-hidden="true" />
              <span className="font-mono text-[13px] font-semibold text-bo-heading">{phieu.soPhieu}</span>
              <span className="ml-auto text-xs text-bo-muted tabular-nums">{soVN(phieu.soDong)} dòng</span>
            </span>
            <dl className="m-0 mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px] leading-5">
              <dt className="text-bo-muted">Tăng</dt>
              <dd className="m-0 text-right font-medium tabular-nums text-bo-primary-strong">{tienCoDau(phieu.tongGiaTriTang)}</dd>
              <dt className="text-bo-muted">Giảm</dt>
              <dd className="m-0 text-right font-medium tabular-nums text-bo-danger">{tienCoDau(-Math.abs(Number(phieu.tongGiaTriGiam) || 0))}</dd>
              <dt className="font-medium text-bo-foreground">Ròng</dt>
              <dd className="m-0 text-right font-semibold tabular-nums text-bo-heading">{tienCoDau(phieu.giaTriChenhLechThuan)}</dd>
            </dl>
            <p className="mt-2 text-xs leading-4 text-bo-muted">
              {phieu.nguoiDuyet?.hoTen ? `${phieu.nguoiDuyet.hoTen} · ` : ""}
              {formatDateTime(phieu.ngayDieuChinh)}
            </p>
          </div>
        </NhomThuocTinh>
      ) : null}

      <NhomThuocTinh nhan="Nhật ký" rong>
        {ds.length ? (
          <>
            <ol className="m-0 grid list-none gap-0 p-0">
              {nhatKyHien.map((n, i) => (
                <li key={`${n.luc}-${i}`} className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-2.5 pb-3 last:pb-0">
                  <span aria-hidden="true" className="relative flex justify-center">
                    <span className={cn("mt-1.5 size-2 rounded-full", i === 0 ? "bg-bo-primary" : "bg-slate-300")} />
                    {i < nhatKyHien.length - 1 ? <span className="absolute bottom-[-6px] top-4 w-px bg-slate-200" /> : null}
                  </span>
                  <span className="min-w-0 text-[13px] leading-5">
                    <span className="block break-words text-bo-foreground">{n.noiDung || n.hanhDong}</span>
                    <span className="block text-xs leading-4 text-bo-muted">
                      {n.nguoi?.hoTen ? `${n.nguoi.hoTen} · ` : ""}
                      {formatDateTime(n.luc)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            {ds.length > SO_NHAT_KY_HIEN ? (
              <button
                type="button"
                onClick={() => setMoHetNhatKy((x) => !x)}
                className="mt-2 rounded text-xs font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
              >
                {moHetNhatKy ? "Thu gọn" : `Xem thêm ${soVN(ds.length - SO_NHAT_KY_HIEN)} mục`}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-bo-muted">
            {nhatKy == null
              ? "Chưa tải được nhật ký."
              : Number(dot.trangThai) === 0
                ? "Chưa có thao tác nào."
                : "Không có nhật ký: đợt lập trước khi hệ thống ghi nhật ký kiểm kê."}
          </p>
        )}
      </NhomThuocTinh>
    </CotThuocTinh>
  );
}
