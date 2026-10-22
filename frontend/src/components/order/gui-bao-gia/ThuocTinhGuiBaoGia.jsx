import { useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import StatusBadge from "@/components/shared/StatusBadge";
import { SO_DONG_YEU_CAU_HIEN, SO_NCC_GUI_HIEN } from "@/config/bangChungTu";
import { getYeuCauNhapHangStatus } from "@/constants/yeuCauNhapHang";
import { formatDate } from "@/utils/formatters";
import { maYeuCau, tenDongYeuCau } from "./tinhGuiBaoGia";

/**
 * Cột phải của màn Gửi yêu cầu báo giá: "Gửi đến" (nhà cung cấp đã chọn, bỏ từng người; quá SO_NCC_GUI_HIEN thì gom
 * "và n nhà cung cấp khác") · "Yêu cầu nhập hàng" (mã + trạng thái, kho nhận, cần hàng trước, người tạo, ghi chú) ·
 * "Sản phẩm cần báo giá" (SO_DONG_YEU_CAU_HIEN dòng đầu, đủ danh sách ở chi tiết yêu cầu).
 * - `daChon`: dòng nhà cung cấp đã chọn (tinhGuiBaoGia.dongNhaCungCap); `onBo(id)`.
 */
export default function ThuocTinhGuiBaoGia({ yc, id, daChon, onBo }) {
  const [moHet, setMoHet] = useState(false);
  const ma = maYeuCau(yc, id);
  const dsHien = moHet || daChon.length <= SO_NCC_GUI_HIEN ? daChon : daChon.slice(0, SO_NCC_GUI_HIEN);
  const dong = Array.isArray(yc.chiTietYeuCauMuaHangs) ? yc.chiTietYeuCauMuaHangs : [];
  const tt = getYeuCauNhapHangStatus(yc.trangThai);

  return (
    <CotThuocTinh nhan="Danh sách gửi và yêu cầu nhập hàng">
      <NhomThuocTinh nhan="Gửi đến">
        {daChon.length ? (
          <>
            <ul className="m-0 mt-1 grid list-none gap-1.5 p-0">
              {dsHien.map((d) => (
                <li key={d.id} className="flex min-w-0 items-start justify-between gap-2 rounded-md border border-bo-border bg-white px-2.5 py-2">
                  <span className="min-w-0 text-[13px] leading-[18px]">
                    <span className="block truncate font-semibold text-bo-foreground" title={d.ten}>{d.ten}</span>
                    <span className="block truncate text-xs text-bo-muted">{d.email}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onBo(d.id)}
                    aria-label={`Bỏ ${d.ten}`}
                    className="grid size-6 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {daChon.length > SO_NCC_GUI_HIEN ? (
              <NutChu className="mt-2" aria-expanded={moHet} onClick={() => setMoHet((x) => !x)}>
                {moHet ? "Thu gọn" : `và ${soVN(daChon.length - SO_NCC_GUI_HIEN)} nhà cung cấp khác`}
              </NutChu>
            ) : null}
          </>
        ) : (
          <p className="m-0 mt-1 text-[13px] leading-5 text-bo-muted">Chưa chọn nhà cung cấp nào. Chọn ở danh sách nhà cung cấp.</p>
        )}
      </NhomThuocTinh>

      <NhomThuocTinh nhan="Yêu cầu nhập hàng">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <Link to={`/purchase-requests/${yc.id ?? id}`} className="font-semibold tabular-nums text-bo-primary hover:underline">
            {ma}
          </Link>
          <StatusBadge quyTrinh="yeuCauNhap" label={tt.label} />
        </div>
        <BangThuocTinh
          muc={[
            { nhan: "Kho nhận", giaTri: yc.khoNhap?.tenKho },
            { nhan: "Cần hàng trước", giaTri: yc.ngayGiaoDuKien ? formatDate(yc.ngayGiaoDuKien) : null },
            { nhan: "Người tạo", giaTri: yc.nguoiTao?.hoTen },
            { nhan: "Ghi chú", giaTri: yc.ghiChu ? <span className="whitespace-pre-line break-words">{yc.ghiChu}</span> : null },
          ]}
        />
      </NhomThuocTinh>

      <NhomThuocTinh nhan="Sản phẩm cần báo giá">
        <ul className="m-0 mt-1 grid list-none gap-1.5 p-0">
          {dong.slice(0, SO_DONG_YEU_CAU_HIEN).map((ct, i) => (
            <li key={ct.id ?? i} className="flex min-w-0 justify-between gap-3 text-[13px] leading-[18px]">
              <span className="min-w-0 truncate text-slate-700" title={tenDongYeuCau(ct)}>{tenDongYeuCau(ct)}</span>
              <span className="shrink-0 font-medium tabular-nums text-bo-foreground">{soVN(docSo(ct.soLuongDat))}</span>
            </li>
          ))}
        </ul>
        {dong.length > SO_DONG_YEU_CAU_HIEN ? (
          <Link to={`/purchase-requests/${yc.id ?? id}`} className="mt-2 inline-block text-[13px] font-semibold text-bo-primary hover:underline">
            Xem đủ {soVN(dong.length)} biến thể ở yêu cầu
          </Link>
        ) : null}
      </NhomThuocTinh>
    </CotThuocTinh>
  );
}
