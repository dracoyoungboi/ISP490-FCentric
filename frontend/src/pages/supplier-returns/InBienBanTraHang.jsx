import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileX, Lock } from "lucide-react";
import PrintLayout from "@/components/print/PrintLayout";
import { CSS_GIAY } from "@/components/print/GiayChungTu";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import useQuayLai from "@/hooks/useQuayLai";
import useNutVeTrangIn from "@/hooks/useNutVeTrangIn";
import { toast } from "@/lib/thongBaoNhanh";
import { companyProfileService } from "@/services/companyProfileService";
import { bienBanTraHangService } from "@/services/bienBanTraHangService";
import { t } from "@/i18n";
import { cauGocMayChu } from "@/i18n/cauGoc";
import { CSS_BIEN_BAN_TRA_HANG, GiayBienBanTraHang } from "./GiayBienBanTraHang";

/** Lỗi tải: 401/403 → không có quyền; 404 hoặc 400 "không tìm thấy" → không tìm thấy; còn lại → lỗi chung. */
function phanLoaiLoi(loi) {
  const ma = loi?.response?.status;
  const cau = loi?.response?.data?.message ?? "";
  if (ma === 401 || ma === 403) return "khongQuyen";
  if (ma === 404 || (ma === 400 && /không tìm thấy|not found/i.test(cauGocMayChu(cau)))) return "khongThay";
  return "loi";
}

/**
 * Trang in biên bản trả hàng nhà cung cấp (ngoài BackofficeLayout): `/supplier-returns/:id/print`, A4 dọc, ký 3 bên.
 * Bố cục cố định (không qua cấu hình mẫu in), đầu giấy lấy hồ sơ công ty dùng chung như giấy chuyển kho, kiểm kê. In
 * được ở mọi trạng thái, kể cả biên bản mới lập ở phiếu Nháp; biên bản đã hủy in kèm dấu "ĐÃ HỦY". Khung trang dịch theo
 * ngôn ngữ giao diện, chữ trên giấy ở GiayBienBanTraHang.jsx giữ tiếng Việt.
 */
export default function InBienBanTraHang() {
  const { id } = useParams();
  const [bb, setBb] = useState(null);
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
      const kq = await bienBanTraHangService.chiTiet(id);
      setBb(kq ?? null);
      if (kq == null) setLoi("khongThay");
    } catch (e) {
      console.error("Lỗi tải dữ liệu in biên bản trả hàng:", e);
      const kieu = phanLoaiLoi(e);
      setLoi(kieu);
      if (kieu === "loi") toast.error(t("Không thể tải dữ liệu phiếu in"));
    } finally {
      setDangTai(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => taiHoSo());
  }, [taiHoSo]);

  useEffect(() => {
    if (id) queueMicrotask(() => tai());
  }, [id, tai]);

  // Mở trong cùng thẻ thì lùi về trang trước; mở thẳng bằng đường dẫn thì về phiếu nhập của biên bản (chưa tải được thì
  // về danh sách phiếu nhập kho)
  const ve = useQuayLai(bb?.phieuNhapKhoId ? `/goods-receipts/${bb.phieuNhapKhoId}` : "/goods-receipts");
  // Trang in ở thẻ riêng: nút về trong khối lỗi cũng là Đóng thẻ, như nút trên thanh
  const nutVeIn = useNutVeTrangIn(ve);
  const nutVe = (
    <Button onClick={nutVeIn.ve} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
      {nutVeIn.nhan}
    </Button>
  );

  const dangTaiHoSo = !hoSo && !loiHoSo;
  const sanSang = Boolean(bb && hoSo && !loi && !dangTai);
  const so = bb?.soBienBan ?? "";

  let noiDung;
  if (dangTai || dangTaiHoSo) {
    noiDung = <LoadingState rows={5} label={t("Đang tải dữ liệu phiếu in")} className="mx-auto max-w-xl" />;
  } else if (loi === "khongQuyen") {
    noiDung = (
      <EmptyState
        icon={Lock}
        title={t("Bạn không có quyền xem phiếu này.")}
        description={t("Tài khoản của bạn không có quyền truy cập phiếu này.")}
        action={nutVe}
      />
    );
  } else if (loi === "khongThay" || (!loi && !bb)) {
    noiDung = (
      <EmptyState
        icon={FileX}
        title={t("Không tìm thấy biên bản trả hàng")}
        description={t("Biên bản có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
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
  } else {
    noiDung = (
      <div className="giay-ct">
        <style>{CSS_GIAY + CSS_BIEN_BAN_TRA_HANG}</style>
        <GiayBienBanTraHang bb={bb} hoSo={hoSo} />
      </div>
    );
  }

  return (
    <PrintLayout
      title={sanSang && so ? t("In phiếu: {{so}}", { so }) : t("In biên bản trả hàng nhà cung cấp")}
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
