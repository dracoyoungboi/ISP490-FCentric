import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, PackageCheck, Printer, Truck } from "lucide-react";
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
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import DispatchDialog from "@/components/outbound/DispatchDialog";
import BangSanPhamXuat from "@/components/outbound/phieu-xuat/BangSanPhamXuat";
import ThuocTinhPhieuXuat from "@/components/outbound/phieu-xuat/ThuocTinhPhieuXuat";
import useLoTheoDong from "@/components/outbound/phieu-xuat/useLoTheoDong";
import {
  BO_LOC_DONG_XUAT,
  LOAI_XUAT,
  cauThieuLo,
  laPhieuPos,
  lyDoKhoaXuat,
  quyenPhieuXuat,
  tachGhiChuPhieuXuat,
  tinhBuocPhieuXuat,
} from "@/components/outbound/phieu-xuat/phieuXuat";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { getApiErrorMessage } from "@/utils/apiError";
import { hasAnyRole, ROLES } from "@/utils/roles";

const DANH_SACH = "/goods-issues";
const KHONG_CO_DONG = [];
// Backend ném RuntimeException "Không tìm thấy phiếu xuất kho" (500) khi không có phiếu
const TUY_CHON_LOI = Object.freeze({ coi500LaKhongThay: true });
// Câu máy chủ "Không tìm thấy …" trùng ý tiêu đề "Không tìm thấy phiếu xuất kho" → không hiện thêm
const locCauMayChu = (cau) => (/^\s*không tìm thấy/i.test(cau) ? null : cau);

/**
 * Chi tiết phiếu xuất kho (`/goods-issues/:id`) · bản "một khối" (21/10/2026): đầu khối (mã, trạng thái, In, ⋯, một nút
 * chính), tiến trình 3 bước (bán hàng: Nhặt → Đóng gói → Xuất kho; chuyển kho: Tạo → Chọn lô → Xác nhận vận chuyển;
 * phiếu POS không có), dòng thông báo thiếu lô / đã hủy, bảng sản phẩm có lô ngay trên từng dòng, cột thuộc tính.
 * Sau xuất kho / xác nhận vận chuyển / hủy: ở lại trang, tải lại ngầm, thông báo nhanh.
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
  // Hộp đang mở: "xuat" (xuất kho bán hàng) | "vanChuyen" (chuyển kho) | "huy"
  const [hop, setHop] = useState(null);
  const [dangXuLy, setDangXuLy] = useState(false);

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
          tenSanPham: ct.tenBienThe || "",
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
  const bang = useBangChungTu(dong, { theo: "dong", donVi: "dòng", boLoc: BO_LOC_DONG_XUAT });

  // ── Đang tải / không thấy / lỗi ─────────────────────────────────────────
  if (dangTai || !phieu) {
    return (
      <PageContainer className="flex min-h-full flex-col">
        {dangTai || !loiTai ? (
          <KhungDangTai nhan="Đang tải phiếu xuất kho" />
        ) : (
          <KhungLoiChungTu
            loi={loiTai.loi}
            tenChungTu="phiếu xuất kho"
            tuyChonLoi={TUY_CHON_LOI}
            locCauMayChu={locCauMayChu}
            moTaKhongThay="Phiếu xuất kho không tồn tại, đã bị xóa hoặc thuộc kho khác với nơi làm việc đang chọn."
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
  const ghiChu = tachGhiChuPhieuXuat(phieu.ghiChu);
  const soDong = bang.tong.soDong;
  const soThieu = dong.filter((d) => !d.du).length;
  const tongSl = bang.tong.soLuong;
  const buoc = tinhBuocPhieuXuat({ phieu, laPos, soDong, soDongDuLo: soDong - soThieu });
  const lyDoKhoa = lyDoKhoaXuat({ laCk, soDong, soThieu });
  const statusInfo = getPhieuXuatKhoStatus(phieu.trangThai);
  const loaiNhan = laCk ? "Chuyển kho nội bộ" : laPos ? "Xuất bán tại quầy" : "Xuất bán hàng";
  const moTaBang = laCk ? "Lô chọn ở từng dòng" : laPos ? "Lô theo nhập trước lấy trước" : "Lô lấy từ phiếu nhặt hàng";

  // ── Thao tác ────────────────────────────────────────────────────────────
  const dongHop = (mo) => {
    if (!mo && !dangXuLy) setHop(null);
  };

  // Chuyển kho: xác nhận vận chuyển (PUT /{id}/complete) — trừ tồn kho nguồn, đưa hàng vào kho Trung chuyển
  const xacNhanVanChuyen = async () => {
    setDangXuLy(true);
    try {
      await phieuXuatKhoService.complete(phieu.id);
      toast.success(`Đã xác nhận vận chuyển ${phieu.soPhieuXuat}`, {
        description: ghiChu.maPhieuChuyen ? `Phiếu chuyển ${ghiChu.maPhieuChuyen} chuyển sang Đang vận chuyển` : undefined,
      });
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể thực hiện thao tác"));
    } finally {
      // Thành công hay lỗi đều đóng hộp (như bản cũ) và tải lại ngầm: lỗi thường do phiếu vừa đổi ở nơi khác
      setHop(null);
      setDangXuLy(false);
      taiPhieu({ ngam: true });
    }
  };

  // Bán hàng: xác nhận xuất kho kèm thông tin giao vận (POST /{id}/xac-nhan-xuat-kho, SRS 6.3.2).
  // Lỗi thì giữ hộp thoại để người dùng sửa và thử lại.
  const xacNhanXuatKho = async (payload) => {
    setDangXuLy(true);
    try {
      const res = await phieuXuatKhoService.xacNhanXuatKho(phieu.id, payload);
      toast.success(res?.message || "Xác nhận xuất kho thành công");
      setHop(null);
      await taiPhieu({ ngam: true });
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể xác nhận xuất kho"));
    } finally {
      setDangXuLy(false);
    }
  };

  // Hủy phiếu (cả bán hàng và chuyển kho): PUT /phieu-xuat-kho/{id}/cancel. Bản cũ gọi nhầm
  // PUT /phieu-chuyen-kho/{id}/cancel cho phiếu chuyển kho (API của phiếu chuyển gốc) nên luôn lỗi.
  const huyPhieu = async () => {
    setDangXuLy(true);
    try {
      await phieuXuatKhoService.cancel(phieu.id);
      toast.success(`Đã hủy phiếu xuất ${phieu.soPhieuXuat}`, { description: "Số lượng đang giữ đã trả lại tồn kho" });
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể hủy phiếu"));
    } finally {
      setHop(null);
      setDangXuLy(false);
      taiPhieu({ ngam: true });
    }
  };

  // Mở Chọn lô / Sửa lô của một dòng. Màn Chọn lô luôn tự đọc lại phiếu từ máy chủ (không nhận router state).
  const moChonLo = (ct) => navigate(`/goods-issues/${phieu.id}/pick-lot/${ct.id}`);

  const xemDongThieu = () => {
    bang.xoaTuKhoa();
    bang.datLoc("thieuLo");
  };

  const nutChinh =
    quyen.nutChinh === "dongGoi"
      ? {
        ma: "dongGoi",
        nhan: "Đóng gói",
        icon: PackageCheck,
        onClick: () => navigate(`/goods-issues/packing/${phieu.donBanHang.id}`),
      }
      : quyen.nutChinh
        ? {
          ma: quyen.nutChinh,
          nhan: quyen.nutChinh === "vanChuyen" ? "Xác nhận vận chuyển" : "Xác nhận xuất kho",
          icon: Truck,
          onClick: () => setHop(quyen.nutChinh === "vanChuyen" ? "vanChuyen" : "xuat"),
          khoa: Boolean(lyDoKhoa),
          lyDo: lyDoKhoa ?? undefined,
          dangChay: dangXuLy,
        }
        : null;

  const soDon = phieu.donBanHang?.soDonHang;
  const moTaHuy = laCk
    ? `Hủy phiếu ${phieu.soPhieuXuat}? Số lượng đang giữ ở ${phieu.kho?.tenKho || "kho xuất"} được trả lại. Không hoàn tác được.`
    : `Hủy phiếu ${phieu.soPhieuXuat}? Số lượng đang giữ được trả lại tồn kho${
      soDon ? `; đơn ${soDon} quay về Chờ nhặt hàng (Đã xuất một phần nếu đơn đã xuất một phần trước đó)` : ""
    }. Không hoàn tác được.`;
  const moTaVanChuyen = `Hàng trong phiếu ${phieu.soPhieuXuat} (tổng số lượng ${soVN(tongSl)}) được trừ tồn tại ${
    phieu.kho?.tenKho || "kho xuất"
  } và chuyển sang kho Trung chuyển để bắt đầu vận chuyển. ${
    ghiChu.maPhieuChuyen ? `Phiếu chuyển ${ghiChu.maPhieuChuyen}` : "Phiếu chuyển kho"
  } chuyển sang Đang vận chuyển.`;

  const thongBao = [];
  if (chuaXuat && !laPos && soThieu > 0) {
    thongBao.push(
      <DongThongBao
        key="thieu"
        tone="warn"
        actions={
          bang.coCongCu && bang.locNhanh !== "thieuLo" ? <NutChu onClick={xemDongThieu}>Xem các dòng thiếu lô</NutChu> : null
        }
      >
        {cauThieuLo({ laCk, laQuanLy, soThieu })}
      </DongThongBao>,
    );
  }
  if (lo.soLoi > 0) {
    thongBao.push(
      <DongThongBao key="loiLo" tone="warn" actions={<NutChu onClick={lo.taiLai}>Thử lại</NutChu>}>
        Không tải được lô của {soVN(lo.soLoi)} dòng.
      </DongThongBao>,
    );
  }
  if (daHuy) {
    thongBao.push(
      <DongThongBao key="huy" tone="neutral">
        Phiếu đã hủy. Số lượng đang giữ đã trả lại tồn kho.
      </DongThongBao>,
    );
  }

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        aria-label={`Phiếu xuất kho ${phieu.soPhieuXuat || ""}`.trim()}
        dau={
          <DauChungTu
            ma={phieu.soPhieuXuat}
            trangThai={{ label: statusInfo.label, quyTrinh: "phieuXuat" }}
            dongPhu={[
              loaiNhan,
              <b key="dong" className="font-semibold text-bo-foreground">{soVN(soDong)} biến thể</b>,
              <span key="sl">
                tổng số lượng <b className="font-semibold text-bo-foreground">{soVN(tongSl)}</b>
              </span>,
            ]}
            onQuayLai={() => navigate(DANH_SACH)}
            nhanQuayLai="Về danh sách phiếu xuất kho"
            nutPhu={quyen.coIn ? { ma: "in", nhan: "In phiếu", icon: Printer, onClick: () => navigate(`/goods-issues/${phieu.id}/print`) } : null}
            saoChepMa={{ giaTri: phieu.soPhieuXuat, nhan: "Sao chép mã phiếu" }}
            menu={
              quyen.coHuy
                ? [{
                  ma: "huy",
                  nhan: "Hủy phiếu",
                  icon: Ban,
                  nguyHiem: true,
                  moTa: "Trả lại số lượng đang giữ cho tồn kho",
                  khoa: dangXuLy,
                  onSelect: () => setHop("huy"),
                }]
                : []
            }
            nutChinh={nutChinh}
          />
        }
        tienTrinh={buoc.length ? <TienTrinhChungTu nhan="Tiến trình phiếu xuất kho" buoc={buoc} /> : null}
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

      {hop === "xuat" ? (
        <DispatchDialog
          open
          onOpenChange={dongHop}
          soPhieuXuat={phieu.soPhieuXuat}
          tongSoLuong={tongSl}
          onConfirm={xacNhanXuatKho}
        />
      ) : null}

      <HopXacNhanChungTu
        mo={hop === "vanChuyen"}
        onDoiMo={dongHop}
        tieuDe="Xác nhận vận chuyển"
        moTa={moTaVanChuyen}
        nhanXacNhan="Xác nhận vận chuyển"
        iconXacNhan={Truck}
        dangChay={dangXuLy}
        onXacNhan={xacNhanVanChuyen}
      />

      <HopXacNhanChungTu
        mo={hop === "huy"}
        onDoiMo={dongHop}
        tieuDe="Hủy phiếu xuất kho"
        moTa={moTaHuy}
        nhanXacNhan="Hủy phiếu"
        iconXacNhan={Ban}
        kieu="nguyHiem"
        dangChay={dangXuLy}
        onXacNhan={huyPhieu}
      />
    </PageContainer>
  );
}
