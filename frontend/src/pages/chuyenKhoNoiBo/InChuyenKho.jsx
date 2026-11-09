import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileX, Lock } from "lucide-react";
import PrintLayout from "@/components/print/PrintLayout";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import useQuayLai from "@/hooks/useQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { companyProfileService } from "@/services/companyProfileService";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { LOAI_IN, lyDoChuaIn } from "@/components/chuyen-kho/inChuyenKho";
import { CSS_GIAY } from "@/components/print/GiayChungTu";
import { t } from "@/i18n";
import { cauGocMayChu } from "@/i18n/cauGoc";
import { GiayBienBan, GiayDieuChinh, GiayLenhDieuDong, GiayXknb, GiayYeuCau } from "./GiayChuyenKho";

/*
 * Khung trang in chuyển kho nội bộ (thanh công cụ, trạng thái tải, lỗi) dịch theo ngôn ngữ giao diện; chữ in trên giấy
 * ở GiayChuyenKho.jsx giữ tiếng Việt.
 */

/** "Yêu cầu chuyển kho" → "yêu cầu chuyển kho" (ghép sau "In …"). */
const chuDauThuong = (chu) => chu.charAt(0).toLowerCase() + chu.slice(1);

/** Lỗi tải: 401/403 → không có quyền; 404 hoặc 400 "không tìm thấy" → không tìm thấy; còn lại → lỗi chung. */
function phanLoaiLoi(loi) {
  const ma = loi?.response?.status;
  const cau = loi?.response?.data?.message ?? "";
  if (ma === 401 || ma === 403) return "khongQuyen";
  if (ma === 404 || (ma === 400 && /không tìm thấy|not found/i.test(cauGocMayChu(cau)))) return "khongThay";
  return "loi";
}

/** Số in ở lề dưới mỗi trang và ở thanh công cụ. */
function soCuaGiay(loai, du) {
  if (!du) return "";
  if (loai === "dieu-chinh") return du.soPhieu ?? "";
  if (loai === "lenh-dieu-dong") return du.soLenhDieuDong ?? "";
  if (loai === "bien-ban") return du.bienBan?.soBienBan ?? "";
  // Phiếu XKNB chưa có số: không mượn số khác (giấy đã đóng dấu "CHƯA CÓ SỐ XKNB")
  if (loai === "xknb") return du.soPhieuXknb ? `${du.kyHieuXknb} ${du.soPhieuXknb}` : "";
  return du.soPhieuChuyen ?? "";
}

/**
 * Trang in của chuyển kho nội bộ (ngoài BackofficeLayout): `/transfer-tickets/:id/print/:loai` với loai = yeu-cau |
 * lenh-dieu-dong | xknb | bien-ban, và `/transfer-tickets/adjustments/:id/print` (`dieuChinh`) cho phiếu điều chỉnh kho.
 * Bố cục cố định theo tài liệu BA (không qua cấu hình mẫu in); đầu giấy lấy hồ sơ công ty dùng chung. Không in khi chưa
 * tải xong phiếu và hồ sơ, hoặc giấy chưa dùng được cho phiếu (vd. lệnh điều động khi phiếu chưa duyệt).
 */
export default function InChuyenKho({ dieuChinh = false }) {
  const { id, loai: loaiDuongDan } = useParams();
  const loai = dieuChinh ? "dieu-chinh" : loaiDuongDan;
  const mau = LOAI_IN[loai];
  const duongDanVe = dieuChinh ? `/transfer-tickets/adjustments/${id}` : `/transfer-tickets/${id}`;

  const [duLieu, setDuLieu] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState(null);
  const [hoSo, setHoSo] = useState(null);
  const [loiHoSo, setLoiHoSo] = useState(false);

  const taiHoSo = useCallback(async () => {
    setLoiHoSo(false);
    setHoSo(null);
    try {
      setHoSo(await companyProfileService.get());
    } catch (e) {
      console.error("Lỗi tải hồ sơ công ty:", e);
      setLoiHoSo(true);
    }
  }, []);

  const tai = useCallback(async () => {
    setDangTai(true);
    setLoi(null);
    try {
      const kq = dieuChinh ? await phieuChuyenKhoService.phieuDieuChinh(id) : await phieuChuyenKhoService.chiTiet(id);
      setDuLieu(kq ?? null);
      if (kq == null) setLoi("khongThay");
    } catch (e) {
      console.error("Lỗi tải dữ liệu in chuyển kho:", e);
      const loai = phanLoaiLoi(e);
      setLoi(loai);
      if (loai === "loi") toast.error(t("Không thể tải dữ liệu phiếu in"));
    } finally {
      setDangTai(false);
    }
  }, [dieuChinh, id]);

  useEffect(() => {
    queueMicrotask(() => taiHoSo());
  }, [taiHoSo]);

  useEffect(() => {
    if (id && mau) queueMicrotask(() => tai());
  }, [id, mau, tai]);

  // Mở từ phiếu thì lùi về đúng trang đó (không chồng thêm lịch sử); mở thẳng bằng đường dẫn thì mở phiếu
  const ve = useQuayLai(duongDanVe);
  const nutVe = (
    <Button onClick={ve} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
      {t("Quay lại")}
    </Button>
  );

  const chuaIn = !mau ? t("Không có mẫu in này cho phiếu chuyển kho.") : dieuChinh ? null : lyDoChuaIn(loai, duLieu);
  const so = soCuaGiay(loai, duLieu);
  const dangTaiHoSo = !hoSo && !loiHoSo;
  const sanSang = Boolean(mau && duLieu && hoSo && !loi && !chuaIn && !dangTai);

  let noiDung;
  if (!mau) {
    noiDung = <EmptyState icon={FileX} title={t("Không có mẫu in này")} description={chuaIn} action={nutVe} />;
  } else if (dangTai || dangTaiHoSo) {
    noiDung = <LoadingState rows={5} label={t("Đang tải dữ liệu phiếu in")} className="mx-auto max-w-xl" />;
  } else if (loi === "khongQuyen") {
    noiDung = (
      <EmptyState
        icon={Lock}
        title={t("Bạn không có quyền xem phiếu này.")}
        description={t("Tài khoản của bạn không có quyền truy cập phiếu này hoặc phiếu thuộc kho khác kho đang làm việc.")}
        action={nutVe}
      />
    );
  } else if (loi === "khongThay" || (!loi && !duLieu)) {
    noiDung = (
      <EmptyState
        icon={FileX}
        title={dieuChinh ? t("Không tìm thấy phiếu điều chỉnh kho") : t("Không tìm thấy phiếu chuyển kho")}
        description={t("Phiếu có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
        action={nutVe}
      />
    );
  } else if (loi === "loi") {
    noiDung = (
      <ErrorState
        title={t("Không thể tải phiếu in")}
        description={t("Không thể tải dữ liệu phiếu. Vui lòng thử lại.")}
        onRetry={tai}
        className="mx-auto max-w-xl"
      />
    );
  } else if (loiHoSo) {
    noiDung = (
      <ErrorState
        title={t("Không thể tải hồ sơ công ty")}
        description={t("Không thể tải hồ sơ công ty từ máy chủ. Không in khi chưa tải xong hồ sơ.")}
        onRetry={taiHoSo}
        className="mx-auto max-w-xl"
      />
    );
  } else if (chuaIn) {
    noiDung = <EmptyState icon={FileX} title={t("Chưa in được {{tenGiay}}", { tenGiay: t(mau.tieuDe).toLowerCase() })} description={chuaIn} action={nutVe} />;
  } else {
    noiDung = (
      <div className="giay-ct">
        <style>{CSS_GIAY}</style>
        {loai === "dieu-chinh" ? <GiayDieuChinh pdc={duLieu} hoSo={hoSo} /> : null}
        {loai === "yeu-cau" ? <GiayYeuCau ct={duLieu} hoSo={hoSo} /> : null}
        {loai === "lenh-dieu-dong" ? <GiayLenhDieuDong ct={duLieu} hoSo={hoSo} /> : null}
        {loai === "xknb" ? <GiayXknb ct={duLieu} hoSo={hoSo} /> : null}
        {loai === "bien-ban" ? <GiayBienBan ct={duLieu} hoSo={hoSo} /> : null}
      </div>
    );
  }

  return (
    <PrintLayout
      title={mau ? `${t("In {{tenGiay}}", { tenGiay: chuDauThuong(t(mau.tieuDe)) })}${so && sanSang ? `: ${so}` : ""}` : t("In phiếu chuyển kho")}
      onBack={ve}
      onPrint={() => window.print()}
      disablePrint={!sanSang}
      // i18n-giu-nguyen: lề dưới in trên giấy
      pageFooter={sanSang && so ? `Số ${so}` : null}
    >
      {noiDung}
    </PrintLayout>
  );
}
