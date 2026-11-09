import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Printer, Truck } from "lucide-react";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import CotThuocTinh, { BangThuocTinh, ChungTuLienQuan, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { cauChungTuRong, soVN } from "@/components/chung-tu/bangChungTu";
import { chayGioiHan } from "@/components/chung-tu/chayGioiHan";
import {
  CAU_HET_THOI_HAN,
  MO_TA_HET_THOI_HAN,
  chayCoThoiHan,
  khiGocKetThuc,
  khoaKhiChoGoc,
  laLoiHetThoiHan,
} from "@/components/chung-tu/thoiHanThaoTac";
import { getGoodsReceiptStatus, getGoodsReceiptTypeLabel } from "@/constants/goodsReceipt";
import useHangChuaCoKeCuaChungTu from "@/components/kiem-ke/useHangChuaCoKeCuaChungTu";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useQuayLai from "@/hooks/useQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/dateTime";
import BangHangNhan from "./BangHangNhan";
import { LOAI_PHIEU_NHAP, cauChoNhap, demLo, dongPhieuNhap, moTaXacNhan, quyTacPhieuNhap } from "./tinhPhieuNhapChuyenKho";
import { t } from "@/i18n";

const B = ({ children }) => <b className="font-semibold text-bo-foreground">{children}</b>;

/**
 * Chi tiết phiếu nhập kho nhánh cũ · bản "một khối" (chốt 21/10/2026, artboard NhapChuyenKho): phiếu nhập chuyển kho,
 * phiếu nhập hoàn trả do hủy chuyển kho và phiếu nhập khách trả hàng. Đầu khối (loại phiếu ở dòng phụ, nút chính theo
 * loại), dòng thông báo, bảng hàng gom theo sản phẩm với lô kế thừa, cột phải: kho nhận, chuyển từ, người nhập, phiếu
 * chuyển kho. Phiếu nhập từ đơn mua dùng ChiTietNhapTuDonMua (không qua đây).
 * Phiếu nhập của phiếu chuyển kho do máy chủ lập khi nhận hàng ở màn phiếu chuyển nên chỉ xem; phiếu nháp lập theo cách
 * cũ thì nút chính mở phiếu chuyển (tinhPhieuNhapChuyenKho.quyTacPhieuNhap).
 *
 * `onReload`: tải lại ngầm phiếu (PhieuNhapKhoDetail) sau thao tác.
 */
export default function ChiTietNhapChuyenKho({ data, onReload }) {
  const navigate = useNavigate();
  const quayLai = useQuayLai("/goods-receipts");
  const id = data.id;
  const items = useMemo(() => data.items ?? [], [data.items]);
  const quyTac = quyTacPhieuNhap(data);
  const trangThai = getGoodsReceiptStatus(data.trangThai);
  // Hàng của phiếu đã nhập mà chưa có kệ ở kho nhận (khách trả, nhận chuyển kho): dòng nhắc "Xếp kệ"
  const chuaKe = useHangChuaCoKeCuaChungTu({ kho: { id: data.khoId }, phieuNhapId: id, bat: quyTac.daNhap });

  // Hộp thoại đang mở: "nhap" | null
  const [hop, setHop] = useState(null);
  const [dangXuLy, setDangXuLy] = useState(false);
  // Hết thời hạn mà máy chủ có thể vẫn đang làm: khóa nút thao tác tới khi lời gọi gốc kết thúc (khiGocKetThuc)
  const [choGoc, setChoGoc] = useState(false);
  const huyChoGocRef = useRef(null);
  // Màn đã gỡ (rời trang trong lúc chờ): nhánh hết thời hạn bỏ qua báo lỗi, khóa nút, tải lại; gỡ thì hủy chờ
  const daGoRef = useRef(false);
  useEffect(() => {
    daGoRef.current = false;
    return () => {
      daGoRef.current = true;
      huyChoGocRef.current?.();
    };
  }, []);

  // Lô kế thừa của từng biến thể: cùng API màn nhập từ đơn mua đang dùng (một yêu cầu mỗi biến thể, tối đa
  // SO_VIEC_DONG_THOI yêu cầu cùng lúc). Biến thể tải lỗi → null ("Không tải được lô"), không chặn các biến thể khác.
  const khoaLo = `${id}|${data.trangThai}|${items.map((i) => `${i.bienTheSanPhamId}:${i.soLuongCanNhap}`).join(",")}`;
  const taiLo = useCallback(async () => {
    const ketQua = await chayGioiHan(items.map((i) => () => phieuNhapKhoService.getLotInput(id, i.bienTheSanPhamId)));
    return Object.fromEntries(
      items.map((i, k) => [i.bienTheSanPhamId, ketQua[k].ok ? (Array.isArray(ketQua[k].giaTri?.data) ? ketQua[k].giaTri.data : []) : null]),
    );
  }, [id, items]);
  const loQ = useTaiDuLieu(taiLo, khoaLo, { enabled: items.length > 0 });

  const dong = useMemo(() => dongPhieuNhap(items, loQ.data), [items, loQ.data]);
  const bang = useBangChungTu(dong, { theo: "nhom" });
  const soLo = demLo(dong);

  // Khóa nút thao tác tới khi lời gọi gốc kết thúc (tối đa THOI_HAN_CHO_GOC_MS) rồi tải lại; màn gỡ thì hủy chờ
  function khoaToiKhiGocXong(loi) {
    huyChoGocRef.current?.();
    setChoGoc(true);
    huyChoGocRef.current = khiGocKetThuc(loi, () => {
      huyChoGocRef.current = null;
      setChoGoc(false);
      onReload?.();
    });
  }

  async function chay(thaoTac, cauThanhCong, cauLoi) {
    setDangXuLy(true);
    try {
      await chayCoThoiHan(() => thaoTac(id));
      toast.success(cauThanhCong);
      setHop(null);
      onReload?.();
    } catch (e) {
      if (laLoiHetThoiHan(e)) {
        if (daGoRef.current) return;
        // Máy chủ chưa trả lời sau thời hạn: đóng hộp, báo lỗi, tải lại ngầm; máy chủ có thể vẫn đang ghi nhận nên khóa
        // nút tới khi lời gọi gốc kết thúc rồi tải lại lần nữa
        setHop(null);
        toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
        onReload?.();
        khoaToiKhiGocXong(e);
        return;
      }
      // Lỗi thì giữ hộp thoại mở, câu của máy chủ hiện nguyên văn
      toast.error(getApiErrorMessage(e, cauLoi));
    } finally {
      setDangXuLy(false);
    }
  }

  const xacNhanNhap = () => chay(phieuNhapKhoService.complete, quyTac.cauThanhCong, t("Xác nhận nhập kho thất bại"));

  const khachTra = quyTac.loai === LOAI_PHIEU_NHAP.KHACH_TRA;
  let nutChinh = null;
  if (quyTac.apiNhan && quyTac.choNhap) {
    nutChinh = {
      ma: "nhap",
      nhan: quyTac.nhanNut,
      icon: Check,
      onClick: () => setHop("nhap"),
      khoa: bang.rong,
      lyDo: bang.rong ? cauChungTuRong(t("phiếu nhập kho"), { dauCham: false }) : "",
      hienLyDo: true,
    };
  } else if (quyTac.moPhieuChuyen) {
    nutChinh = {
      ma: "phieuChuyen",
      nhan: t("Mở phiếu chuyển kho"),
      icon: Truck,
      dieuHuong: true,
      onClick: () => navigate(`/transfer-tickets/${data.phieuXuatGocId}`),
    };
  }
  const thongBao = quyTac.choNhap && !bang.rong
    ? <DongThongBao tone="info">{cauChoNhap(data)}</DongThongBao>
    : quyTac.daHuy
      ? <DongThongBao tone="neutral">{t("Phiếu nhập đã hủy.")}</DongThongBao>
      : chuaKe.soLo > 0
        ? (
          <DongThongBao tone="warn" actions={<NutChu onClick={() => navigate(chuaKe.duongDan)}>{t("Xếp kệ")}</NutChu>}>
            <B>{t("{{soLuong}} sản phẩm", { count: Number(chuaKe.soLuong) || 0, soLuong: soVN(chuaKe.soLuong) })}</B>{" "}
            {t("({{soLo}} lô) của phiếu chưa có kệ ở {{tenKho}}: người nhặt hàng chưa thấy chỗ lấy cho tới khi xếp.", { count: Number(chuaKe.soLo) || 0, soLo: soVN(chuaKe.soLo), tenKho: data.tenKho ?? t("kho nhận") })}
          </DongThongBao>
        )
        : null;

  return (
    <>
      <KhungChungTu
        dau={
          <DauChungTu
            ma={data.soPhieuNhap}
            trangThai={{ label: trangThai.label, quyTrinh: "phieuNhap" }}
            dongPhu={[
              t(getGoodsReceiptTypeLabel(data)),
              <B key="sp">{t("{{soSanPham}} sản phẩm", { count: Number(bang.tong.soSanPham) || 0, soSanPham: soVN(bang.tong.soSanPham) })}, {t("{{soBienThe}} biến thể", { count: Number(bang.tong.soDong) || 0, soBienThe: soVN(bang.tong.soDong) })}</B>,
              <span key="sl">{t("tổng số lượng")} <B>{soVN(bang.tong.soLuong)}</B></span>,
              soLo ? <B key="lo">{t("{{soLo}} lô", { count: soLo, soLo: soVN(soLo) })}</B> : null,
            ]}
            onQuayLai={quayLai}
            nhanQuayLai={t("Về danh sách phiếu nhập kho")}
            nutPhu={quyTac.inDuoc ? { ma: "in", nhan: t("In phiếu"), icon: Printer, onClick: () => navigate(`/goods-receipts/${id}/print`) } : null}
            saoChepMa={{ giaTri: data.soPhieuNhap, nhan: t("Sao chép mã phiếu") }}
            nutChinh={khoaKhiChoGoc(nutChinh, choGoc)}
          />
        }
        thongBao={thongBao}
        chinh={<BangHangNhan bang={bang} />}
        cotPhai={
          <CotThuocTinh nhan={t("Thông tin phiếu nhập kho")}>
            <NhomThuocTinh>
              <BangThuocTinh
                muc={[
                  { ma: "kho", nhan: t("Kho nhận"), giaTri: data.tenKho ? <span className="font-semibold">{data.tenKho}</span> : null },
                  { ma: "tu", nhan: t("Chuyển từ", { context: "kho_nguon" }), giaTri: data.tenKhoChuyenTu, an: khachTra },
                  { ma: "nguon", nhan: t("Nguồn hàng"), giaTri: t("Khách trả hàng"), an: !khachTra },
                  { ma: "ngay", nhan: t("Ngày nhập"), giaTri: formatDateTime(data.ngayNhap), an: !quyTac.daNhap },
                  { ma: "nguoi", nhan: t("Người nhập"), giaTri: data.tenNguoiNhap, an: !quyTac.daNhap },
                ]}
              />
            </NhomThuocTinh>
            <ChungTuLienQuan
              ds={data.phieuXuatGocId ? [{
                khoa: "phieu-chuyen",
                loai: t("Phiếu chuyển kho nội bộ"),
                ma: data.soPhieuChuyenKhoGoc || t("Mở phiếu chuyển kho"),
                to: `/transfer-tickets/${data.phieuXuatGocId}`,
              }] : []}
            />
          </CotThuocTinh>
        }
      />

      <HopXacNhanChungTu
        mo={hop === "nhap"}
        onDoiMo={(mo) => !mo && setHop(null)}
        tieuDe={quyTac.tieuDeHop}
        moTa={moTaXacNhan(data, bang.tong, soLo)}
        nhanXacNhan={quyTac.nhanNut}
        iconXacNhan={Check}
        dangChay={dangXuLy}
        onXacNhan={xacNhanNhap}
      />
    </>
  );
}
