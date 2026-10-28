import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import { SO_DON_HIEN } from "@/config/bangChungTu";
import { getDonBanHangStatus } from "@/constants/donBanHang";
import { TRANG_THAI_DON } from "@/constants/trangThaiXuatBan";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { nhanBangChung } from "./tinhPhieuNhat";

/**
 * Cột phải của màn Thực hiện nhặt hàng: Kho xuất, Người nhặt, Ghi chú và "Đơn trong phiếu" — hiện trước SO_DON_HIEN
 * đơn (việc cần làm trước, đơn hủy cuối), còn lại "Xem thêm n đơn". Mỗi đơn: mã (mở chi tiết đơn bán), tiền,
 * trạng thái đơn, kênh · khách, tóm tắt hàng; đơn từ bước đóng gói trở đi có bằng chứng và nút Bằng chứng (đã qua
 * đóng gói thì chỉ xem lại), chờ đóng gói có thêm Đóng gói. `dsDon`: kết quả dsDonTrongPhieu.
 */
export default function CotPhieuNhat({ phieu, dsDon, onMoBangChung, onDongGoi }) {
  const idDs = useId();
  const [moHet, setMoHet] = useState(false);
  const conAn = Math.max(0, dsDon.length - SO_DON_HIEN);
  const hien = moHet || conAn === 0 ? dsDon : dsDon.slice(0, SO_DON_HIEN);
  const coDonHuy = dsDon.some((d) => d.huy);

  return (
    <CotThuocTinh nhan="Thông tin phiếu nhặt hàng">
      <NhomThuocTinh>
        <BangThuocTinh
          muc={[
            { ma: "kho", nhan: "Kho xuất", giaTri: phieu.tenKhoXuat },
            {
              ma: "nguoi",
              nhan: "Người nhặt",
              giaTri: phieu.tenNguoiNhat || <span className="text-bo-muted">Chưa phân công</span>,
            },
            { ma: "ghiChu", nhan: "Ghi chú", giaTri: phieu.ghiChu },
          ]}
        />
      </NhomThuocTinh>

      <NhomThuocTinh nhan="Đơn trong phiếu">
        {dsDon.length ? (
          <ul id={idDs} className="m-0 grid list-none gap-2 p-0">
            {hien.map((don) => (
              <li key={don.so} className="min-w-0">
                <TheDon don={don} onMoBangChung={onMoBangChung} onDongGoi={onDongGoi} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] leading-5 text-bo-muted">Không có đơn nào.</p>
        )}
        {conAn > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={moHet}
            aria-controls={idDs}
            onClick={() => setMoHet((x) => !x)}
            className="mt-2 w-full text-[13px] font-medium text-bo-primary hover:bg-bo-surface hover:text-bo-primary-hover"
          >
            {moHet ? "Thu gọn" : `Xem thêm ${conAn} đơn`}
          </Button>
        ) : null}
        {coDonHuy ? (
          <p className="mt-2.5 text-xs leading-4 text-bo-muted">
            Đơn gạch ngang đã hủy: không tạo phiếu xuất, số cần nhặt đã tự trừ.
          </p>
        ) : null}
      </NhomThuocTinh>
    </CotThuocTinh>
  );
}

function TheDon({ don, onMoBangChung, onDongGoi }) {
  const { so, info, huy, trangThai } = don;
  const nhanTrangThai = trangThai != null ? getDonBanHangStatus(trangThai).label : null;
  const bangChung = huy ? null : nhanBangChung(info);
  const kieuMa = cn(
    "text-[13px] font-semibold tabular-nums",
    huy ? "text-slate-400 line-through" : "text-bo-foreground",
  );

  return (
    <article className={cn("grid gap-1 rounded-lg border border-bo-border px-3 py-2.5", huy ? "bg-[#fbfcfd]" : "bg-bo-surface")}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {info?.id != null ? (
          <Link
            to={`/sales-orders/${info.id}`}
            title="Mở chi tiết đơn bán hàng"
            className={cn(
              kieuMa,
              "rounded hover:text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
            )}
          >
            {so}
          </Link>
        ) : (
          <span className={kieuMa}>{so}</span>
        )}
        {info?.tongCong != null ? (
          <span className="shrink-0 text-xs tabular-nums text-bo-muted">{formatCurrency(info.tongCong)}</span>
        ) : null}
        {nhanTrangThai ? <StatusBadge className="ml-auto" label={nhanTrangThai} quyTrinh="donBan" /> : null}
      </div>
      {info ? (
        <div className="text-xs leading-4 text-bo-muted">
          {info.tenKenh || "Trực tiếp"}
          {info.tenKhachHang ? ` · ${info.tenKhachHang}` : ""}
        </div>
      ) : null}
      {info?.tomTatHang ? (
        <p className="line-clamp-2 text-xs leading-4 text-slate-600" title={info.tomTatHang}>
          {info.tomTatHang}
        </p>
      ) : null}
      {bangChung ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
          <span
            className={cn(
              "mr-auto inline-flex items-center gap-1 text-xs font-medium",
              bangChung.du ? "text-bo-success" : bangChung.chiXem ? "text-bo-muted" : "text-bo-warning",
            )}
          >
            {bangChung.du ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : (
              <Camera className="size-3.5" aria-hidden="true" />
            )}
            {bangChung.nhan}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMoBangChung(info)}
            title={bangChung.chiXem ? "Xem lại bằng chứng đóng gói" : "Xem hoặc tải lên bằng chứng đóng gói"}
            aria-label={`Bằng chứng đóng gói đơn ${so}`}
            className="h-7 border-bo-border bg-bo-surface px-2 text-xs font-medium text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
          >
            Bằng chứng
          </Button>
          {trangThai === TRANG_THAI_DON.CHO_DONG_GOI ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onDongGoi(info)}
              aria-label={`Đóng gói đơn ${so}`}
              className="h-7 bg-bo-primary px-2.5 text-xs font-semibold text-white hover:bg-bo-primary-hover"
            >
              Đóng gói
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
