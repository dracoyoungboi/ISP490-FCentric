import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileX, Lock } from "lucide-react";
import PrintLayout from "@/components/print/PrintLayout";
import { CSS_GIAY } from "@/components/print/GiayChungTu";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import useQuayLai from "@/hooks/useQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { companyProfileService } from "@/services/companyProfileService";
import { layDong, layDot, layPhieuDieuChinh } from "@/services/stockTakeService";
import { LOAI_IN_KIEM_KE, dongPhieuDieuChinh, lyDoChuaInKiemKe } from "@/components/kiem-ke/inKiemKe";
import { TT_DOT } from "@/components/kiem-ke/kiemKe";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { GiayBienBan, GiayDieuChinh } from "./GiayKiemKe";
import { t } from "@/i18n";
import { cauGocMayChu } from "@/i18n/cauGoc";

/* Phần riêng của giấy kiểm kê, thêm vào khung giấy dùng chung (GiayChungTu). */
const CSS_KIEM_KE = `
.giay-ct h3{font-size:13.5px;font-weight:700;margin:14px 0 2px}
.giay-ct table{margin:8px 0}
.giay-ct td.ghi,.giay-ct .ghi{font-style:italic;color:#444}
.giay-ct tr.cong td{font-weight:700}
.giay-ct .tong-hop td:nth-child(odd){width:34%}
.giay-ct .phu-luc{break-before:page;margin-top:36px;padding-top:28px;border-top:1px dashed #bbb}
.giay-ct .dau-nhap{display:inline-block;margin-top:8px;border:2px solid #c2410c;color:#c2410c;padding:3px 9px;font:700 12px Inter,Arial,sans-serif;letter-spacing:.04em;transform:rotate(-4deg)}
@media print{.giay-ct .phu-luc{margin-top:0;padding-top:0;border-top:0}}
`;

/** Lỗi tải: 401/403 → không có quyền; 404 hoặc 400 "không tìm thấy" → không tìm thấy; còn lại → lỗi chung. */
function phanLoaiLoi(loi) {
  const ma = loi?.response?.status;
  const cau = loi?.response?.data?.message ?? "";
  if (ma === 401 || ma === 403) return "khongQuyen";
  if (ma === 404 || (ma === 400 && /không tìm thấy|not found/i.test(cauGocMayChu(cau)))) return "khongThay";
  return "loi";
}

/**
 * Trang in của kiểm kê (ngoài BackofficeLayout): `/stock-take/:id/print` (`loai` = "bien-ban") và
 * `/stock-take/:id/print-adjustment` (`loai` = "dieu-chinh", chỉ Quản trị viên, Quản lý kho — route chặn vai trò).
 * Tiền (đơn giá, giá trị chênh lệch) chỉ in cho Quản trị viên, Quản lý kho; nhân viên kho in bản chỉ có số lượng.
 */
export default function InKiemKe({ loai = "bien-ban" }) {
  const { id } = useParams();
  const mau = LOAI_IN_KIEM_KE[loai];
  const coTien = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
  const [phuLuc, setPhuLuc] = useState(true);

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
      const [dot, dong] = await Promise.all([layDot(id), layDong(id)]);
      if (!dot) {
        setDuLieu(null);
        setLoi("khongThay");
        return;
      }
      const phieu = loai === "dieu-chinh" && Number(dot.trangThai) === TT_DOT.DA_DUYET ? await layPhieuDieuChinh(id) : null;
      setDuLieu({ dot, dong: dong ?? [], phieu: phieu ?? null });
    } catch (e) {
      console.error("Lỗi tải dữ liệu in kiểm kê:", e);
      const kieu = phanLoaiLoi(e);
      setLoi(kieu);
      if (kieu === "loi") toast.error(t("Không thể tải dữ liệu đợt kiểm kê"));
    } finally {
      setDangTai(false);
    }
  }, [id, loai]);

  useEffect(() => {
    queueMicrotask(() => taiHoSo());
  }, [taiHoSo]);

  useEffect(() => {
    if (id && mau) queueMicrotask(() => tai());
  }, [id, mau, tai]);

  const ve = useQuayLai(`/stock-take/${id}`);
  const nutVe = (
    <Button onClick={ve} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
      {t("Quay lại")}
    </Button>
  );

  const dot = duLieu?.dot ?? null;
  let chuaIn = !mau ? t("Không có mẫu in này cho đợt kiểm kê.") : lyDoChuaInKiemKe(loai, dot, duLieu?.phieu);
  // Dòng phiếu dựng lại từ dòng lệch của đợt: số dòng phải khớp phiếu đã ghi sổ, lệch thì không in giấy sai
  if (!chuaIn && loai === "dieu-chinh" && duLieu?.phieu) {
    const soDongDot = dongPhieuDieuChinh(duLieu.dong).dong.length;
    if (soDongDot !== Number(duLieu.phieu.soDong)) {
      chuaIn = t("Phiếu {{soPhieu}} có {{soDong}} dòng nhưng đợt có {{soDongDot}} dòng lệch. Báo quản trị viên kiểm tra trước khi in.", { soPhieu: duLieu.phieu.soPhieu, soDong: duLieu.phieu.soDong, soDongDot });
    }
  }
  const so = loai === "dieu-chinh" ? duLieu?.phieu?.soPhieu ?? "" : dot?.ma ?? "";
  const dangTaiHoSo = !hoSo && !loiHoSo;
  const sanSang = Boolean(mau && dot && hoSo && !loi && !chuaIn && !dangTai);

  let noiDung;
  if (!mau) {
    noiDung = <EmptyState icon={FileX} title={t("Không có mẫu in này")} description={chuaIn} action={nutVe} />;
  } else if (dangTai || dangTaiHoSo) {
    noiDung = <LoadingState rows={5} label={t("Đang tải dữ liệu in")} className="mx-auto max-w-xl" />;
  } else if (loi === "khongQuyen") {
    noiDung = (
      <EmptyState
        icon={Lock}
        title={t("Bạn không có quyền xem đợt kiểm kê này.")}
        description={t("Tài khoản của bạn không có quyền truy cập đợt này hoặc đợt thuộc kho khác kho đang làm việc.")}
        action={nutVe}
      />
    );
  } else if (loi === "khongThay" || (!loi && !dot)) {
    noiDung = (
      <EmptyState
        icon={FileX}
        title={t("Không tìm thấy đợt kiểm kê")}
        description={t("Đợt có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
        action={nutVe}
      />
    );
  } else if (loi === "loi") {
    noiDung = (
      <ErrorState
        title={t("Không thể tải dữ liệu in")}
        description={t("Không thể tải đợt kiểm kê. Vui lòng thử lại.")}
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
    noiDung = <EmptyState icon={FileX} title={t("Chưa in được {{ten}}", { ten: mau.tieuDe.toLowerCase() })} description={chuaIn} action={nutVe} />;
  } else {
    noiDung = (
      <div className="giay-ct">
        <style>{CSS_GIAY + CSS_KIEM_KE}</style>
        {loai === "dieu-chinh" ? (
          <GiayDieuChinh dot={dot} dongApi={duLieu.dong} phieu={duLieu.phieu} hoSo={hoSo} />
        ) : (
          <GiayBienBan dot={dot} dongApi={duLieu.dong} hoSo={hoSo} coTien={coTien} phuLuc={phuLuc} />
        )}
      </div>
    );
  }

  const tuyChon =
    loai === "bien-ban" && sanSang ? (
      <label className="flex cursor-pointer items-center gap-2 text-sm text-bo-foreground select-none">
        <Checkbox checked={phuLuc} onCheckedChange={(v) => setPhuLuc(v === true)} aria-label={t("In kèm phụ lục bảng kiểm đếm")} />
        <span className="max-sm:hidden">{t("In kèm phụ lục")}</span>
        {/* Màn rất hẹp (320px) không đủ chỗ cho chữ cạnh nút Quay lại, In phiếu: chỉ còn ô chọn (có aria-label) */}
        <span className="sm:hidden max-[359px]:hidden">{t("Phụ lục")}</span>
      </label>
    ) : null;

  return (
    <PrintLayout
      title={
        mau
          ? t("In {{ten}}{{so}}", { ten: `${mau.tieuDe.charAt(0).toLowerCase()}${mau.tieuDe.slice(1)}`, so: so && sanSang ? `: ${so}` : "" })
          : t("In kiểm kê")
      }
      onBack={ve}
      onPrint={() => window.print()}
      disablePrint={!sanSang}
      // i18n-giu-nguyen: chân trang in trên giấy
      pageFooter={sanSang && so ? `Số ${so}` : null}
      toolbarExtra={tuyChon}
    >
      {noiDung}
    </PrintLayout>
  );
}
