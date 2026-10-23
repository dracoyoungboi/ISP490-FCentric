import { useState } from "react";
import CotThuocTinh, { BangThuocTinh, ChungTuLienQuan, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import { soVN } from "@/components/chung-tu/bangChungTu";
import StatusBadge from "@/components/shared/StatusBadge";
import { SO_DON_HIEN } from "@/config/bangChungTu";
import { getDonBanHangStatus } from "@/constants/donBanHang";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { donCungPhieuNhat } from "./tinhDongGoi";

/**
 * Cột phải của màn Đóng gói: Khách hàng (không có thì "Khách lẻ"), điện thoại, địa chỉ, kênh bán + ID đơn trên sàn ·
 * Tổng cộng (gồm phí vận chuyển — máy chủ so ngưỡng bằng chứng trên số này), kho · Chứng từ liên quan (đơn bán, phiếu
 * xuất) · Cùng phiếu nhặt: các đơn của phiếu nhặt (đơn đang mở ghi "Đơn đang mở" thay thẻ trạng thái), quá SO_DON_HIEN
 * thì "Xem thêm"; không có phiếu nhặt thì ẩn khối.
 *
 * - `phien`: PhienDongGoiDto. `phieuNhat`: `{ dang, loi, ds }` các đơn của phiếu nhặt (DanhSachNhatHangDto.danhSachDonHang)
 *   — tải sau phiên vì phiên chỉ có `maPickList`.
 */
export default function ThuocTinhDongGoi({ phien, phieuNhat }) {
  const [xemHet, setXemHet] = useState(false);
  const kenh = String(phien.tenKenh ?? "").trim();
  const cung = donCungPhieuNhat(phieuNhat?.ds, phien.donBanHangId);
  const hien = xemHet || cung.ds.length <= SO_DON_HIEN ? cung.ds : cung.ds.slice(0, SO_DON_HIEN);

  return (
    <CotThuocTinh nhan="Thông tin đơn đóng gói">
      <NhomThuocTinh nhan="Khách hàng">
        <div className="text-sm font-semibold leading-5 text-bo-foreground">{phien.tenKhachHang || "Khách lẻ"}</div>
        <BangThuocTinh
          rongNhan={112}
          className="mt-2.5"
          muc={[
            { ma: "sdt", nhan: "Điện thoại", giaTri: phien.soDienThoai ? <span className="tabular-nums">{phien.soDienThoai}</span> : null },
            { ma: "dc", nhan: "Địa chỉ", giaTri: phien.diaChiGiaoHang },
            {
              ma: "kenh",
              nhan: "Kênh bán",
              an: !kenh,
              giaTri: (
                <>
                  {kenh}
                  {phien.maDonHangKenh ? (
                    <>
                      {" · ID "}
                      <span className="break-all font-mono">{phien.maDonHangKenh}</span>
                    </>
                  ) : null}
                </>
              ),
            },
          ]}
        />
      </NhomThuocTinh>

      <NhomThuocTinh>
        <BangThuocTinh
          rongNhan={112}
          muc={[
            {
              ma: "tong",
              nhan: "Tổng cộng (gồm phí vận chuyển)",
              giaTri: <span className="font-semibold tabular-nums">{formatCurrency(phien.tongTienDonHang)}</span>,
            },
            { ma: "kho", nhan: "Kho", giaTri: phien.tenKho },
          ]}
        />
      </NhomThuocTinh>

      <ChungTuLienQuan
        ds={[
          { khoa: "don", loai: "Đơn bán hàng", ma: phien.soDonHang, to: `/sales-orders/${phien.donBanHangId}` },
          phien.phieuXuatKhoId
            ? {
              khoa: "px",
              loai: "Phiếu xuất kho",
              ma: phien.soPhieuXuat,
              to: `/goods-issues/${phien.phieuXuatKhoId}`,
              trangThai: getPhieuXuatKhoStatus(phien.trangThaiPhieu).label,
              quyTrinh: "phieuXuat",
            }
            : null,
        ]}
      />

      {phien.maPickList ? (
        <NhomThuocTinh
          nhan={
            <>
              Cùng phiếu nhặt <span className="tabular-nums">{phien.maPickList}</span>
            </>
          }
        >
          {phieuNhat?.dang ? (
            <p className="m-0 text-[13px] leading-5 text-bo-muted">Đang tải các đơn của phiếu nhặt…</p>
          ) : phieuNhat?.loi ? (
            <p className="m-0 text-[13px] leading-5 text-bo-muted">Không tải được các đơn của phiếu nhặt.</p>
          ) : (
            <>
              <p className="m-0 text-[13px] leading-5 text-bo-muted">{cung.tomTat}</p>
              <ul className="m-0 mt-2.5 grid list-none gap-1.5 p-0">
                {hien.map((d) => {
                  const dangMo = String(d.id) === String(phien.donBanHangId);
                  return (
                    <li key={d.id} className="flex min-w-0 items-center justify-between gap-2 text-[13px] leading-5">
                      <span className={cn("min-w-0 truncate font-semibold tabular-nums", dangMo ? "text-bo-primary" : "text-bo-foreground")}>
                        {d.soDonHang}
                      </span>
                      {dangMo ? (
                        <span className="shrink-0 text-xs text-bo-muted">Đơn đang mở</span>
                      ) : (
                        <StatusBadge label={getDonBanHangStatus(d.trangThai).label} quyTrinh="donBan" />
                      )}
                    </li>
                  );
                })}
              </ul>
              {cung.ds.length > SO_DON_HIEN ? (
                <button
                  type="button"
                  aria-expanded={xemHet}
                  onClick={() => setXemHet((cu) => !cu)}
                  className="mt-2 rounded text-[13px] font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                >
                  {xemHet ? "Thu gọn" : `Xem thêm ${soVN(cung.ds.length - SO_DON_HIEN)} đơn`}
                </button>
              ) : null}
            </>
          )}
        </NhomThuocTinh>
      ) : null}
    </CotThuocTinh>
  );
}
