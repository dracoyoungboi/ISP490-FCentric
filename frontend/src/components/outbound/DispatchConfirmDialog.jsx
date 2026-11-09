import { useRef, useState } from "react";
import { Truck, Settings2, ShieldCheck, CheckCircle2 } from "lucide-react";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { GiaTriSaoChep } from "@/components/chung-tu/CotThuocTinh";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { t } from "@/i18n";

/**
 * Hộp thoại Xác nhận xuất kho tinh gọn cho đơn ĐÃ CÓ thông tin giao vận (đơn sàn Lazada, Shopee, TikTok Shop, Shopify...)
 * Hiển thị tóm tắt thông tin vận chuyển có sẵn để thủ kho đối soát 1-chạm mà không cần gõ lại.
 */
export default function DispatchConfirmDialog({
  open,
  onOpenChange,
  soPhieuXuat,
  tongSoLuong,
  thongTinGiaoVan,
  onConfirm,
  onMoNangCao,
}) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onConfirm({
        donViVanChuyen: thongTinGiaoVan?.donViVanChuyen || null,
        maVanDon: thongTinGiaoVan?.maVanDon || null,
        phiVanChuyenThucTe: thongTinGiaoVan?.cuocThucTe != null ? Number(thongTinGiaoVan.cuocThucTe) : null,
        ghiChu: null,
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const tongSl = tongSoLuong != null ? t(" (tổng số lượng {{tongSoLuong}})", { tongSoLuong: Number(tongSoLuong).toLocaleString("vi-VN") }) : "";
  let nhanCod = thongTinGiaoVan?.nhanThanhToan;
  if (!nhanCod && thongTinGiaoVan?.tienThuHoCod != null) {
    const codNum = Number(thongTinGiaoVan.tienThuHoCod);
    nhanCod = codNum > 0 ? t("Thu hộ (COD): {{codNum}} ₫", { codNum: soVN(codNum) }) : t("Đã thanh toán (COD: 0 đ)");
  }

  return (
    <HopXacNhanChungTu
      mo={open}
      onDoiMo={onOpenChange}
      tieuDe={t("Xác nhận xuất kho & Bàn giao vận chuyển")}
      moTa={t("Phiếu {{soPhieuXuat}}{{tongSl}} sẽ được trừ tồn kho vật lý và cập nhật trạng thái bàn giao.", { soPhieuXuat, tongSl })}
      nhanXacNhan={t("Xác nhận xuất kho")}
      iconXacNhan={Truck}
      dangChay={submitting}
      rong
      onXacNhan={submit}
    >
      <div className="rounded-xl border border-bo-primary/20 bg-bo-primary-soft/30 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-bo-primary/15">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-bo-primary text-white">
              <Truck className="size-4" />
            </span>
            <div>
              <span className="text-xs font-medium text-bo-muted">{t("Đơn vị vận chuyển")}</span>
              <p className="font-semibold text-slate-800">
                {thongTinGiaoVan?.donViVanChuyen || t("Đơn vị vận chuyển sàn")}
              </p>
            </div>
          </div>
          {thongTinGiaoVan?.chiDanDongKiem ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <ShieldCheck className="size-3.5" />
              {thongTinGiaoVan.chiDanDongKiem}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
          <div>
            <span className="text-xs text-slate-500">{t("Mã vận đơn (Tracking)")}</span>
            {thongTinGiaoVan?.maVanDon ? (
              <GiaTriSaoChep
                giaTri={thongTinGiaoVan.maVanDon}
                nhanSaoChep={t("Sao chép mã vận đơn")}
                className="font-mono font-semibold text-bo-primary"
              />
            ) : (
              <p className="font-mono text-slate-400">{t("Chưa có mã")}</p>
            )}
          </div>

          <div>
            <span className="text-xs text-slate-500">{t("Hình thức thu tiền")}</span>
            <p className="font-medium text-slate-700">{nhanCod || t("Đã thanh toán")}</p>
          </div>

          {thongTinGiaoVan?.maDinhTuyen ? (
            <div>
              <span className="text-xs text-slate-500">{t("Mã chia chọn định tuyến")}</span>
              <p>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-800">
                  {thongTinGiaoVan.maDinhTuyen}
                </span>
                {thongTinGiaoVan.maTramPhat ? (
                  <span className="ml-1.5 font-mono text-xs text-slate-500">
                    ({thongTinGiaoVan.maTramPhat})
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}

          {thongTinGiaoVan?.maKienHang ? (
            <div>
              <span className="text-xs text-slate-500">{t("Mã kiện hàng (Package ID)")}</span>
              <GiaTriSaoChep
                giaTri={thongTinGiaoVan.maKienHang}
                nhanSaoChep={t("Sao chép mã kiện hàng")}
                className="font-mono text-xs text-slate-600"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="size-3.5" />
          {t("Thông tin giao vận đã sẵn sàng từ sàn TMĐT")}
        </span>
        {onMoNangCao ? (
          <button
            type="button"
            disabled={submitting}
            onClick={onMoNangCao}
            className="inline-flex items-center gap-1 font-medium text-bo-primary hover:underline focus:outline-none"
          >
            <Settings2 className="size-3.5" />
            {t("Chỉnh sửa cước / ghi chú")}
          </button>
        ) : null}
      </div>
    </HopXacNhanChungTu>
  );
}
