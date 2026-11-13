import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, PackageCheck, Printer, ShieldCheck, Truck } from "lucide-react";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { TRANG_THAI_PHIEU_XUAT } from "@/constants/trangThaiXuatBan";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import OLyDo from "@/components/chung-tu/OLyDo";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import {
  CAU_HET_THOI_HAN,
  LY_DO_CHO_GOC,
  MO_TA_HET_THOI_HAN,
  chayCoThoiHan,
  khiGocKetThuc,
  khoaKhiChoGoc,
  laLoiHetThoiHan,
} from "@/components/chung-tu/thoiHanThaoTac";
import DispatchConfirmDialog from "@/components/outbound/DispatchConfirmDialog";
import DispatchDialog from "@/components/outbound/DispatchDialog";
import PackingProofModal from "@/components/outbound/PackingProofModal";
import BangSanPhamXuat from "@/components/outbound/phieu-xuat/BangSanPhamXuat";
import ThuocTinhPhieuXuat from "@/components/outbound/phieu-xuat/ThuocTinhPhieuXuat";
import useLoTheoDong from "@/components/outbound/phieu-xuat/useLoTheoDong";
import {
  BO_LOC_DONG_XUAT,
  LOAI_XUAT,
  cauThieuLo,
  laPhieuPos,
  layThongTinGiaoVan,
  lyDoKhoaXuat,
  quyenPhieuXuat,
  tachGhiChuPhieuXuat,
  tinhBuocPhieuXuat,
} from "@/components/outbound/phieu-xuat/phieuXuat";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { getApiErrorMessage } from "@/utils/apiError";
import { hasAnyRole, ROLES } from "@/utils/roles";
import { t } from "@/i18n";
import { cauGocMayChu } from "@/i18n/cauGoc";

const DANH_SACH = "/goods-issues";
const KHONG_CO_DONG = [];
// Backend ném RuntimeException "Không tìm thấy phiếu xuất kho" (500) khi không có phiếu
const TUY_CHON_LOI = Object.freeze({ coi500LaKhongThay: true });
// Câu máy chủ "Không tìm thấy …" trùng ý tiêu đề "Không tìm thấy phiếu xuất kho" → không hiện thêm
const locCauMayChu = (cau) => (/^\s*không tìm thấy/i.test(cauGocMayChu(cau)) ? null : cau);

/**
 * Chi tiết phiếu xuất kho (`/goods-issues/:id`) · bản "một khối" (21/10/2026): đầu khối (mã, trạng thái, In, ⋯, một nút
 * chính), tiến trình 3 bước (bán hàng: Nhặt → Đóng gói → Xuất kho; chuyển kho: Tạo → Chọn lô → Xác nhận xuất;
 * phiếu POS không có), dòng thông báo thiếu lô / đã hủy, bảng sản phẩm có lô ngay trên từng dòng, cột thuộc tính.
 * Phiếu xuất chuyển kho (PX-CK) chỉ chọn lô ở đây; xác nhận xuất (người vận chuyển, giấy đi đường) và hủy làm ở màn phiếu
 * chuyển kho (đặc tả BA), nút chính mở phiếu chuyển đó.
 * Sau xuất kho / hủy: ở lại trang, tải lại ngầm, thông báo nhanh.
 * Đổi id cùng đường dẫn (lùi / tiến lịch sử) thì dựng lại màn (`key`): không giữ từ khóa, bộ lọc, hộp đang mở của phiếu trước.
 */
export default function PhieuXuatKhoDetail() {
  const { id } = useParams();
  return <ManPhieuXuatKho key={id} id={id} />;
}

function ManPhieuXuatKho({ id }) {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  // null: không lỗi; { loi }: lần tải gần nhất không có phiếu (loi = null: máy chủ trả rỗng) hoặc lỗi (axios)
  const [loiTai, setLoiTai] = useState(null);
  // Mốc dữ liệu trên màn được tải (cho useTaiLaiKhiQuayLai, không tải lại ngay sau thao tác)
  const [capNhatLuc, setCapNhatLuc] = useState(null);
  // Hộp đang mở: "xuat" (xuất kho bán hàng) | "bangChung" | "huy"
  const [hop, setHop] = useState(null);
  const [dangXuLy, setDangXuLy] = useState(false);
  // Lý do hủy phiếu (bắt buộc, lưu vào ghi chú của phiếu)
  const [lyDoHuy, setLyDoHuy] = useState("");
  // Lỗi khi hủy (máy chủ từ chối, mất mạng): hiện trong hộp, giữ hộp và lý do đã nhập để thử lại (như Đơn bán)
  const [loiHuy, setLoiHuy] = useState(null);
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

  // Chỉ nhận kết quả của lần tải mới nhất: lần tải ngầm về chậm không đè dữ liệu của lần tải sau (Thử lại, đổi phiếu)
  const requestIdRef = useRef(0);
  // ngam: tải lại ngầm (quay lại tab, sau thao tác) — giữ màn đang xem, chỉ thay khi tải được dữ liệu mới
  const taiPhieu = useCallback(async ({ ngam = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (!ngam) {
      setDangTai(true);
      setLoiTai(null);
    }
    try {
      const res = await phieuXuatKhoService.getDetail(id);
      if (requestId !== requestIdRef.current) return;
      const payload = res?.data || res;
      if (payload?.phieu) {
        setData(payload);
        setLoiTai(null);
        setCapNhatLuc(new Date());
      } else if (!ngam) {
        // Máy chủ trả về rỗng: coi như không có phiếu này
        setData(null);
        setLoiTai({ loi: null });
      }
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      // Tải ngầm lỗi: im lặng, giữ dữ liệu đang hiện (như useTaiDuLieu)
      if (ngam) return;
      setData(null);
      setLoiTai({ loi: e });
    } finally {
      if (!ngam && requestId === requestIdRef.current) setDangTai(false);
    }
  }, [id]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); vẫn tải lại chi tiết mỗi khi id đổi.
  useEffect(() => {
    queueMicrotask(() => taiPhieu());
  }, [taiPhieu]);

  // Quay lại tab thì tải lại ngầm (trạng thái phiếu do kho cập nhật); không tải khi đang thao tác
  useTaiLaiKhiQuayLai(() => taiPhieu({ ngam: true }), {
    bat: Boolean(data) && !dangTai && !dangXuLy,
    lanCuoi: capNhatLuc,
  });

  const phieu = data?.phieu ?? null;
  const chiTiet = Array.isArray(data?.chiTiet) ? data.chiTiet : KHONG_CO_DONG;
  const lo = useLoTheoDong(phieu?.id ?? null, phieu?.trangThai, phieu ? chiTiet : null);

  const dong = useMemo(
    () =>
      chiTiet.map((ct) => {
        const muc = lo.theoDong[ct.id];
        return {
          id: ct.id,
          // Máy chủ mới trả tên gốc, màu, mã màu, kích cỡ, ảnh; máy chủ cũ chỉ có tenBienThe "Tên / Màu"
          tenSanPham: ct.tenSanPham || ct.tenBienThe || "",
          tenMau: ct.tenMau || "",
          maMauHex: ct.maMauHex || "",
          kichCo: ct.kichCo || "",
          anh: ct.anh || null,
          sku: ct.sku || "",
          can: docSo(ct.soLuongCanXuat),
          da: docSo(ct.soLuongDaPick),
          du: ct.duSoLuong === true,
          soLuong: docSo(ct.soLuongCanXuat),
          lo: muc?.lo?.map((l) => ({ maLo: l.maLo, soLuong: l.soLuong })) ?? [],
          trangThaiLo: muc?.trangThai,
          ct,
        };
      }),
    [chiTiet, lo.theoDong],
  );
  const bang = useBangChungTu(dong, { theo: "dong", donVi: t("dòng"), boLoc: BO_LOC_DONG_XUAT });

  // ── Đang tải / không thấy / lỗi ─────────────────────────────────────────
  if (dangTai || !phieu) {
    return (
      <PageContainer className="flex min-h-full flex-col">
        {dangTai || !loiTai ? (
          <KhungDangTai nhan={t("Đang tải phiếu xuất kho")} />
        ) : (
          <KhungLoiChungTu
            loi={loiTai.loi}
            tenChungTu={t("phiếu xuất kho")}
            tuyChonLoi={TUY_CHON_LOI}
            locCauMayChu={locCauMayChu}
            moTaKhongThay={t("Phiếu xuất kho không tồn tại, đã bị xóa hoặc thuộc kho khác với nơi làm việc đang chọn.")}
            onVeDanhSach={() => navigate(DANH_SACH)}
            onThuLai={() => taiPhieu()}
          />
        )}
      </PageContainer>
    );
  }

  // ── Tính toán ───────────────────────────────────────────────────────────
  const laCk = phieu.loaiXuat === LOAI_XUAT.CHUYEN_KHO;
  const laPos = laPhieuPos(phieu);
  const laQuanLy = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
  const quyen = quyenPhieuXuat({ phieu, laQuanLy, laPos });
  const tt = Number(phieu.trangThai);
  const chuaXuat = tt === TRANG_THAI_PHIEU_XUAT.NHAP || tt === TRANG_THAI_PHIEU_XUAT.CHO_XUAT;
  const daHuy = tt === TRANG_THAI_PHIEU_XUAT.DA_HUY;
  // Phiếu bán hàng đã đóng gói xong: xem lại bằng chứng của đơn (chỉ xem — máy chủ chặn thêm / thay / xóa)
  const coXemBangChung = !laCk && !laPos && Boolean(phieu.donBanHang?.id)
    && (tt === TRANG_THAI_PHIEU_XUAT.CHO_XUAT || tt === TRANG_THAI_PHIEU_XUAT.DA_XUAT);
  const ghiChu = tachGhiChuPhieuXuat(phieu.ghiChu);
  const thongTinGv = layThongTinGiaoVan(phieu, ghiChu);
  const soDong = bang.tong.soDong;
  const soThieu = dong.filter((d) => !d.du).length;
  const tongSl = bang.tong.soLuong;
  const buoc = tinhBuocPhieuXuat({ phieu, laPos, soDong, soDongDuLo: soDong - soThieu });
  const lyDoKhoa = lyDoKhoaXuat({ laCk, soDong, soThieu });
  const statusInfo = getPhieuXuatKhoStatus(phieu.trangThai);
  const loaiNhan = laCk ? t("Chuyển kho nội bộ") : laPos ? t("Xuất bán tại quầy") : t("Xuất bán hàng");
  // PX-CK có phiếu nhặt: lô do phiếu nhặt ghi (không chọn tay); PX-CK cũ không có phiếu nhặt: chọn lô ở từng dòng
  const moTaBang = laCk && !quyen.phieuNhat ? t("Lô chọn ở từng dòng") : laPos ? t("Lô theo nhập trước lấy trước") : t("Lô lấy từ phiếu nhặt hàng");

  // ── Thao tác ────────────────────────────────────────────────────────────
  const dongHop = (mo) => {
    if (!mo && !dangXuLy) setHop(null);
  };

  // Hết thời hạn: báo lỗi và khóa nút thao tác tới khi lời gọi gốc kết thúc (tối đa THOI_HAN_CHO_GOC_MS) rồi tải lại lần
  // nữa; màn gỡ thì hủy chờ. Nơi gọi tự đóng hộp và tải lại ngay (màn đã gỡ thì không tải lại).
  const baoHetThoiHan = (loi) => {
    if (daGoRef.current) return;
    toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
    huyChoGocRef.current?.();
    setChoGoc(true);
    huyChoGocRef.current = khiGocKetThuc(loi, () => {
      huyChoGocRef.current = null;
      setChoGoc(false);
      taiPhieu({ ngam: true });
    });
  };

  // Bán hàng: xác nhận xuất kho kèm thông tin giao vận (POST /{id}/xac-nhan-xuat-kho, SRS 6.3.2).
  // Lỗi thì giữ hộp thoại để người dùng sửa và thử lại.
  const xacNhanXuatKho = async (payload) => {
    setDangXuLy(true);
    try {
      const res = await chayCoThoiHan(() => phieuXuatKhoService.xacNhanXuatKho(phieu.id, payload));
      toast.success(res?.message || t("Xác nhận xuất kho thành công"));
      setHop(null);
      await taiPhieu({ ngam: true });
    } catch (e) {
      if (laLoiHetThoiHan(e)) {
        if (daGoRef.current) return;
        // Máy chủ chưa trả lời sau thời hạn: đóng hộp, tải lại ngầm, khóa nút tới khi lời gọi gốc kết thúc (có thể máy
        // chủ vẫn đang xuất kho)
        setHop(null);
        baoHetThoiHan(e);
        taiPhieu({ ngam: true });
        return;
      }
      toast.error(getApiErrorMessage(e, t("Không thể xác nhận xuất kho")));
    } finally {
      setDangXuLy(false);
    }
  };

  // Hủy phiếu bán hàng: PUT /phieu-xuat-kho/{id}/cancel (phiếu xuất chuyển kho hủy theo phiếu chuyển, không có nút ở đây)
  const huyPhieu = async () => {
    setDangXuLy(true);
    setLoiHuy(null);
    try {
      await chayCoThoiHan(() => phieuXuatKhoService.cancel(phieu.id, lyDoHuy.trim()));
      toast.success(t("Đã hủy phiếu xuất {{soPhieuXuat}}", { soPhieuXuat: phieu.soPhieuXuat }), { description: t("Số lượng đang giữ đã trả lại tồn kho") });
      setHop(null);
    } catch (e) {
      if (laLoiHetThoiHan(e)) {
        // Hết thời hạn: chưa rõ kết quả — đóng hộp, báo và tải lại như trước
        baoHetThoiHan(e);
        setHop(null);
      } else {
        setLoiHuy(getApiErrorMessage(e, t("Không thể hủy phiếu")));
      }
    } finally {
      setDangXuLy(false);
      // Tải lại ngầm để thấy trạng thái mới nhất (máy chủ có thể đã đổi phiếu); màn đã gỡ thì không tải lại
      if (!daGoRef.current) taiPhieu({ ngam: true });
    }
  };

  // Mở Chọn lô / Sửa lô của một dòng. Màn Chọn lô luôn tự đọc lại phiếu từ máy chủ (không nhận router state).
  const moChonLo = (ct) => navigate(`/goods-issues/${phieu.id}/pick-lot/${ct.id}`);

  const xemDongThieu = () => {
    bang.xoaTuKhoa();
    bang.datLoc("thieuLo");
  };

  const idPhieuChuyen = phieu.phieuChuyenKhoGocId;
  let nutChinhGoc = null;
  if (quyen.nutChinh === "dongGoi") {
    nutChinhGoc = {
      ma: "dongGoi",
      nhan: t("Đóng gói"),
      icon: PackageCheck,
      dieuHuong: true,
      onClick: () => navigate(`/goods-issues/packing/${phieu.donBanHang.id}`),
    };
  } else if (quyen.nutChinh === "phieuChuyen") {
    // Xác nhận xuất (người vận chuyển, giấy đi đường XKNB) làm ở màn phiếu chuyển kho
    nutChinhGoc = idPhieuChuyen != null
      ? {
        ma: "phieuChuyen",
        nhan: t("Mở phiếu chuyển để xuất"),
        icon: Truck,
        dieuHuong: true,
        kieu: lyDoKhoa ? "vien" : "chinh",
        onClick: () => navigate(`/transfer-tickets/${idPhieuChuyen}`),
      }
      : null;
  } else if (quyen.nutChinh) {
    nutChinhGoc = {
      ma: quyen.nutChinh,
      nhan: t("Xác nhận xuất kho"),
      icon: Truck,
      onClick: () => setHop("xuat"),
      khoa: Boolean(lyDoKhoa),
      lyDo: lyDoKhoa ?? undefined,
      dangChay: dangXuLy,
    };
  }
  const nutChinh = khoaKhiChoGoc(nutChinhGoc, choGoc);

  const laLazada = Boolean(
    phieu.donBanHang?.soDonHang?.startsWith("LZD-") ||
    phieu.donBanHang?.kenhBanHang?.maKenh === "LAZADA" ||
    phieu.donBanHang?.kenhBanHang?.maKenh === "LAZADA_SANDBOX" ||
    phieu.donBanHang?.kenhBanHang?.tenKenh?.toLowerCase()?.includes("lazada") ||
    phieu.donBanHang?.maDonHangKenh?.startsWith("LZD-")
  );

  const laShopee = Boolean(
    phieu.donBanHang?.soDonHang?.startsWith("SHP-") ||
    phieu.donBanHang?.kenhBanHang?.maKenh === "SHOPEE" ||
    phieu.donBanHang?.kenhBanHang?.maKenh === "SHOPEE_OFFICIAL" ||
    phieu.donBanHang?.kenhBanHang?.maKenh === "SHOPEE_SANDBOX" ||
    phieu.donBanHang?.kenhBanHang?.tenKenh?.toLowerCase()?.includes("shopee") ||
    phieu.donBanHang?.maDonHangKenh?.startsWith("SHP-")
  );

  const laDonSan = laLazada || laShopee || Boolean(phieu?.donBanHang?.maDonHangKenh);

  const soDon = phieu.donBanHang?.soDonHang;
  const moTaHuy = t("Hủy phiếu {{soPhieuXuat}}? Số lượng đang giữ được trả lại tồn kho{{phanDon}}. Không hoàn tác được.", { soPhieuXuat: phieu.soPhieuXuat, phanDon: soDon ? t("; đơn {{soDon}} quay về Chờ nhặt hàng (Đã xuất một phần nếu đơn đã xuất một phần trước đó)", { soDon }) : "" });

  const thongBao = [];
  if (chuaXuat && !laPos && soThieu > 0) {
    let hanhDongThieu = null;
    if (quyen.phieuNhat) {
      // PX-CK có phiếu nhặt: lô do phiếu nhặt ghi khi hoàn tất nhặt → mở phiếu nhặt thay vì lọc dòng thiếu lô
      hanhDongThieu = (
        <NutChu onClick={() => navigate(`/goods-issues/pick-lists/${quyen.phieuNhat.id}`)}>{t("Mở phiếu nhặt")}</NutChu>
      );
    } else if (bang.coCongCu && bang.locNhanh !== "thieuLo") {
      hanhDongThieu = <NutChu onClick={xemDongThieu}>{t("Xem các dòng thiếu lô")}</NutChu>;
    }
    thongBao.push(
      <DongThongBao key="thieu" tone="warn" actions={hanhDongThieu}>
        {cauThieuLo({ laCk, laQuanLy, soThieu, phieuNhat: quyen.phieuNhat })}
      </DongThongBao>,
    );
  }
  if (lo.soLoi > 0) {
    thongBao.push(
      <DongThongBao key="loiLo" tone="warn" actions={<NutChu onClick={lo.taiLai}>{t("Thử lại")}</NutChu>}>
        {t("Không tải được lô của {{so}} dòng.", { count: lo.soLoi, so: soVN(lo.soLoi) })}
      </DongThongBao>,
    );
  }
  if (daHuy) {
    thongBao.push(
      <DongThongBao key="huy" tone="neutral">
        {t("Phiếu đã hủy. Số lượng đang giữ đã trả lại tồn kho.")}
      </DongThongBao>,
    );
  }

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        aria-label={t("Phiếu xuất kho {{so}}", { so: phieu.soPhieuXuat || "" }).trim()}
        dau={
          <DauChungTu
            ma={phieu.soPhieuXuat}
            trangThai={{ label: statusInfo.label, quyTrinh: "phieuXuat" }}
            dongPhu={[
              loaiNhan,
              <b key="dong" className="font-semibold text-bo-foreground">{t("{{so}} biến thể", { count: soDong, so: soVN(soDong) })}</b>,
              <span key="sl">
                {t("tổng số lượng")} <b className="font-semibold text-bo-foreground">{soVN(tongSl)}</b>
              </span>,
            ]}
            onQuayLai={() => navigate(DANH_SACH)}
            nhanQuayLai={t("Về danh sách phiếu xuất kho")}
            nutPhu={quyen.coIn ? { ma: "in", nhan: t("In phiếu"), icon: Printer, onClick: () => navigate(`/goods-issues/${phieu.id}/print`) } : null}
            saoChepMa={{ giaTri: phieu.soPhieuXuat, nhan: t("Sao chép mã phiếu") }}
                        menu={[
              laDonSan && (tt === TRANG_THAI_PHIEU_XUAT.CHO_XUAT || tt === TRANG_THAI_PHIEU_XUAT.DA_XUAT)
                ? { ma: "inPackingSlip", nhan: t("In vận đơn / phiếu đóng gói sàn (A6)"), icon: Printer, onSelect: () => navigate(`/goods-issues/${phieu.id}/print-packing-slip`) }
                : null,
              coXemBangChung
                ? { ma: "bangChung", nhan: t("Xem bằng chứng đóng gói"), icon: ShieldCheck, onSelect: () => setHop("bangChung") }
                : null,
              quyen.coHuy
                ? {
                  ma: "huy",
                  nhan: t("Hủy phiếu"),
                  icon: Ban,
                  nguyHiem: true,
                  moTa: choGoc ? LY_DO_CHO_GOC : t("Trả lại số lượng đang giữ cho tồn kho"),
                  khoa: dangXuLy || choGoc,
                  onSelect: () => {
                    setLyDoHuy("");
                    setLoiHuy(null);
                    setHop("huy");
                  },
                }
                : null,
            ].filter(Boolean)}
            nutChinh={nutChinh}
          />
        }
        tienTrinh={buoc.length ? <TienTrinhChungTu nhan={t("Tiến trình phiếu xuất kho")} buoc={buoc} /> : null}
        thongBao={thongBao.length ? thongBao : null}
        chinh={
          <BangSanPhamXuat
            bang={bang}
            moTa={moTaBang}
            soThieu={soThieu}
            suaLo={quyen.suaLo}
            nhanNutLo={quyen.nhanNutLo}
            onMoLo={moChonLo}
          />
        }
        cotPhai={<ThuocTinhPhieuXuat phieu={phieu} laCk={laCk} laPos={laPos} ghiChu={ghiChu} />}
      />

      {hop === "xuat" && thongTinGv.coSanThongTin ? (
        <DispatchConfirmDialog
          open
          onOpenChange={dongHop}
          soPhieuXuat={phieu.soPhieuXuat}
          tongSoLuong={tongSl}
          thongTinGiaoVan={thongTinGv}
          onConfirm={xacNhanXuatKho}
          onMoNangCao={() => setHop("xuatNangCao")}
        />
      ) : null}

      {hop === "xuat" && !thongTinGv.coSanThongTin ? (
        <DispatchDialog
          open
          onOpenChange={dongHop}
          soPhieuXuat={phieu.soPhieuXuat}
          tongSoLuong={tongSl}
          macDinh={thongTinGv}
          onConfirm={xacNhanXuatKho}
        />
      ) : null}

      {hop === "xuatNangCao" ? (
        <DispatchDialog
          open
          onOpenChange={dongHop}
          soPhieuXuat={phieu.soPhieuXuat}
          tongSoLuong={tongSl}
          macDinh={thongTinGv}
          onConfirm={xacNhanXuatKho}
        />
      ) : null}

      <PackingProofModal
        isOpen={hop === "bangChung" && coXemBangChung}
        onClose={() => setHop(null)}
        donId={phieu.donBanHang?.id}
        soDonHang={phieu.donBanHang?.soDonHang}
        readOnly
        lyDoKhoaXoa={t("Phiếu đã đóng gói xong, không thể xóa bằng chứng")}
      />

      <HopXacNhanChungTu
        mo={hop === "huy"}
        onDoiMo={dongHop}
        tieuDe={t("Hủy phiếu xuất kho")}
        moTa={moTaHuy}
        nhanXacNhan={t("Hủy phiếu")}
        iconXacNhan={Ban}
        kieu="nguyHiem"
        dangChay={dangXuLy}
        khoaXacNhan={!lyDoHuy.trim()}
        lyDoKhoa={t("Nhập lý do hủy")}
        loi={loiHuy}
        onXacNhan={huyPhieu}
      >
        <OLyDo giaTri={lyDoHuy} onDoi={(v) => { setLyDoHuy(v); setLoiHuy(null); }} goiY={t("Ví dụ: Đơn đổi kho xuất, lập lại phiếu khác")} disabled={dangXuLy} />
      </HopXacNhanChungTu>
    </PageContainer>
  );
}
