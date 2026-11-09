import { useEffect, useRef, useState, useCallback } from "react";
import { X, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import LoadingState from "@/components/shared/LoadingState";
import PackingProofSection from "@/components/outbound/PackingProofSection";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import { dongGoiService } from "@/services/dongGoiService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { t } from "@/i18n";

export default function PackingProofModal({
  isOpen,
  onClose,
  donId,
  soDonHang,
  tongTienDonHang,
  readOnly = false,
  lyDoKhoaXoa = "",
  onProofChanged,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loi, setLoi] = useState(null); // câu lỗi lần tải gần nhất (không có dữ liệu thì hiện thay phần bằng chứng)
  const khungRef = useRef(null);
  const nutDongRef = useRef(null);
  // Đang quay / tải tệp trong phần bằng chứng: đóng hộp phải xác nhận (đóng là dừng quay, dừng tải)
  const [ban, setBan] = useState(false);
  const [hoiDong, setHoiDong] = useState(false);
  const dong = () => (ban ? setHoiDong(true) : onClose());
  // Đơn đang mở trong hộp (null khi đóng). Lời gọi tải của đơn khác — vd. video tải xong sau khi đã đóng hộp gọi
  // onRefresh cũ — không được ghi dữ liệu của đơn đó vào hộp đang mở đơn khác (bấm Xóa sẽ xóa nhầm đơn).
  const donDangMoRef = useRef(null);

  const fetchProofs = useCallback(async () => {
    if (!donId || !isOpen || donDangMoRef.current !== donId) return;
    setLoading(true);
    setLoi(null);
    try {
      const res = await dongGoiService.layBangChung(donId);
      if (donDangMoRef.current === donId) setData(res);
    } catch (err) {
      if (donDangMoRef.current === donId) {
        const cau = getApiErrorMessage(err, t("Không tải được bằng chứng đóng gói"));
        setLoi(cau);
        toast.error(cau);
      }
    } finally {
      if (donDangMoRef.current === donId) setLoading(false);
    }
  }, [donId, isOpen]);

  useEffect(() => {
    donDangMoRef.current = isOpen ? donId : null;
    if (isOpen) {
      // Mở hộp / đổi đơn: bỏ dữ liệu đơn trước, hiện "Đang tải" tới khi có dữ liệu đơn này
      setData(null);
      fetchProofs();
    } else {
      setData(null);
      setLoi(null);
      setBan(false);
      setHoiDong(false);
    }
  }, [isOpen, donId, fetchProofs]);

  // Mở hộp: tiêu điểm vào nút Đóng để phím (Esc, Tab) đi trong hộp, không ở lại nút đã mở hộp phía sau lớp phủ
  useEffect(() => {
    if (isOpen) nutDongRef.current?.focus();
  }, [isOpen]);

  // Esc đóng hộp — trừ khi Esc dành cho lớp nằm trên (hộp chụp ảnh, hộp xem lớn, hộp xác nhận: phần tử fixed khác)
  const khiBamPhim = (suKien) => {
    if (suKien.key !== "Escape" || suKien.defaultPrevented || suKien.nativeEvent?.defaultPrevented) return;
    if (suKien.target?.closest?.(".fixed") !== khungRef.current) return;
    suKien.stopPropagation();
    dong();
  };

  if (!isOpen) return null;

  return (
    <div ref={khungRef} onKeyDown={khiBamPhim} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div role="dialog" aria-modal="true" aria-labelledby="hop-bang-chung-tieu-de" className="relative w-full max-w-3xl rounded-xl bg-bo-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bo-border px-5 py-3.5 bg-bo-surface-subtle">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-bo-primary" aria-hidden="true" />
            <h3 id="hop-bang-chung-tieu-de" className="text-base font-semibold text-slate-800">
              {t("Bằng chứng đóng gói · Đơn {{so}}", { so: soDonHang || data?.soDonHang || `#${donId}` })}
            </h3>
          </div>
          <button
            ref={nutDongRef}
            type="button"
            onClick={dong}
            aria-label={t("Đóng")}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading && !data ? (
            <LoadingState className="min-h-48" label={t("Đang tải thông tin bằng chứng")} />
          ) : !data && loi ? (
            // Không tải được: không vẽ ô trống (trông như đơn chưa có bằng chứng, hoặc sai số ô ảnh / video)
            <DongThongBao tone="bad" actions={<NutChu onClick={fetchProofs}>{t("Thử lại")}</NutChu>}>
              {t("Không tải được bằng chứng của đơn: {{loi}}.", { loi: loi.replace(/[.!\s]+$/, "") })}
            </DongThongBao>
          ) : readOnly && data && !data.danhSachBangChung?.length ? (
            // Chỉ xem mà không còn tệp: nói rõ lý do thay vì vẽ ô trống "Chưa có ảnh" (không ai chụp thêm được nữa)
            <p className="py-8 text-center text-sm text-bo-muted">
              {data.ngayTuXoa
                ? t("Tệp bằng chứng đã tự xóa sau hạn lưu (hết hạn {{ngayTuXoa}}).", { ngayTuXoa: formatDate(data.ngayTuXoa) })
                : t("Đơn không có bằng chứng đóng gói.")}
            </p>
          ) : (
            <PackingProofSection
              donId={donId}
              soDonHang={soDonHang || data?.soDonHang}
              tongTienDonHang={tongTienDonHang != null ? tongTienDonHang : data?.tongTienDonHang}
              yeuCauVideo={data?.yeuCauVideo}
              huongDan={data?.huongDan}
              thoiLuongVideoToiThieu={data?.thoiLuongVideoToiThieu}
              thoiLuongVideoToiDa={data?.thoiLuongVideoToiDa}
              danhSachBangChung={data?.danhSachBangChung || []}
              daDuBangChung={data?.daDuBangChung}
              coTieuDe={false}
              className="-mx-5 -mt-5 border-t-0"
              onRefresh={() => {
                fetchProofs();
                if (onProofChanged) onProofChanged();
              }}
              readOnly={readOnly}
              lyDoKhoaXoa={lyDoKhoaXoa}
              onBanDoi={setBan}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-bo-border px-5 py-3 bg-bo-surface-subtle flex justify-end">
          <button
            type="button"
            onClick={dong}
            className="rounded-md border border-slate-300 bg-bo-surface px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {t("Đóng")}
          </button>
        </div>
      </div>

      <HopXacNhanChungTu
        mo={hoiDong}
        onDoiMo={(mo) => {
          if (!mo) setHoiDong(false);
        }}
        tieuDe={t("Đóng khi bằng chứng chưa lưu xong?")}
        moTa={t("Video đang quay hoặc tệp đang tải lên sẽ bị bỏ, phải chụp, quay hoặc chọn tệp lại.")}
        nhanXacNhan={t("Đóng")}
        kieu="nguyHiem"
        onXacNhan={() => {
          setHoiDong(false);
          onClose();
        }}
      />
    </div>
  );
}
