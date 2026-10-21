import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, RotateCcw } from "lucide-react";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import StatusBadge from "@/components/shared/StatusBadge";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import DongThongBao from "@/components/chung-tu/DongThongBao";
import { KhungDangTai, KhungKhongThay, KhungLoiChungTu, KhungLoiTai } from "@/components/chung-tu/KhungTaiChungTu";
import { phanLoaiLoiTai } from "@/components/chung-tu/loiTai";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import BangLoChonLo from "@/components/outbound/phieu-xuat/BangLoChonLo";
import DaiTongChonLo from "@/components/outbound/phieu-xuat/DaiTongChonLo";
import {
  banDoDaLay,
  datLaiTheoFifo,
  kiemTraLuuLo,
  loDauFifo,
  loaiKhongThayChonLo,
  loiLuuCanTaiLai,
  quyenChonLo,
  sapXepLo,
  tongChon,
  trangThaiChonLo,
} from "@/components/outbound/phieu-xuat/chonLo";
import useQuayLai from "@/hooks/useQuayLai";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { hasAnyRole, ROLES } from "@/utils/roles";

/** Dòng phiếu xuất đọc từ GET /api/v1/phieu-xuat-kho/{id}. */
function dongTuChiTiet(phieu, ct) {
  return {
    bienTheSanPhamId: ct.bienTheSanPhamId,
    sku: ct.sku || "",
    tenBienThe: ct.tenBienThe || "",
    soLuongXuat: Number(ct.soLuongCanXuat ?? 0),
    phieuTrangThai: phieu.trangThai,
    loaiXuat: phieu.loaiXuat,
    soPhieuXuat: phieu.soPhieuXuat,
    tenKho: phieu.kho?.tenKho ?? null,
  };
}

/**
 * Chọn lô hàng của một dòng phiếu xuất (`/goods-issues/:id/pick-lot/:ctId`) · bản "một khối" (21/10/2026).
 * Dòng luôn đọc lại từ GET /phieu-xuat-kho/{id} (tìm `chiTiet` theo ctId), không dùng router state: React Router giữ
 * state qua F5 và lùi / tiến lịch sử nên state có thể đã cũ (trạng thái phiếu, số cần xuất). Một dải tổng "Đã chọn x / y cần xuất" + kiểm tra trực tiếp; chỉ xem thì mặc định chỉ hiện lô đã lấy.
 * Lưu: giữ 4 kiểm tra và payload POST …/pick-lo của bản cũ; lưu xong (và nút ←) cùng một đường về chi tiết phiếu.
 * Đổi phiếu / dòng cùng đường dẫn (lùi / tiến lịch sử) thì dựng lại màn (`key`), không giữ số đang nhập của dòng trước.
 */
export default function PickLot() {
  const { phieuXuatKhoId, chiTietPhieuXuatKhoId } = useParams();
  return (
    <ManChonLo
      key={`${phieuXuatKhoId}-${chiTietPhieuXuatKhoId}`}
      phieuXuatKhoId={phieuXuatKhoId}
      chiTietPhieuXuatKhoId={chiTietPhieuXuatKhoId}
    />
  );
}

// Nhãn loại phiếu xuất ("khac": phiếu yêu cầu chuyển kho)
const NHAN_LOAI_XUAT = Object.freeze({
  ban_hang: "Xuất bán hàng",
  chuyen_kho: "Chuyển kho nội bộ",
  khac: "Yêu cầu chuyển kho",
});

// Backend: chi tiết phiếu / available-lots ném RuntimeException "Không tìm thấy …" (500)
const TUY_CHON_LOI = Object.freeze({ coi500LaKhongThay: true });
const locCauMayChu = (cau) => (/^\s*không tìm thấy/i.test(cau) ? null : cau);

function ManChonLo({ phieuXuatKhoId, chiTietPhieuXuatKhoId }) {
  const navigate = useNavigate();
  // Có trang trước trong ứng dụng (luôn là chi tiết phiếu) thì lùi lại; mở thẳng thì mở chi tiết phiếu
  const veChiTiet = useQuayLai(`/goods-issues/${phieuXuatKhoId}`);
  const laQuanLy = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);

  // { dong, lots, daLuu } khi tải xong. khongThay: "phieu" | "dong"; loi: lỗi tải (axios) hoặc null
  const [duLieu, setDuLieu] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState(null);
  const [khongThay, setKhongThay] = useState(null);
  const [chon, setChon] = useState({});
  const [dangLuu, setDangLuu] = useState(false);
  // Mốc dữ liệu trên màn được tải (cho useTaiLaiKhiQuayLai)
  const [capNhatLuc, setCapNhatLuc] = useState(null);
  const requestIdRef = useRef(0);
  // Người dùng đã sửa số lấy (ô nhập, Đặt lại): tải lại ngầm giữ nguyên số đang nhập
  const daSuaRef = useRef(false);

  // ngam: tải lại ngầm (lưu bị từ chối, quay lại tab) — giữ màn đang xem và số đang nhập, chỉ thay số còn lấy được.
  // baoLoi: tải ngầm sau khi lưu bị từ chối mà lỗi thì báo (số còn lấy được vẫn cũ, lưu lại sẽ bị từ chối tiếp)
  const tai = useCallback(async ({ ngam = false, baoLoi = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (!ngam) {
      setDangTai(true);
      setLoi(null);
      setKhongThay(null);
    }
    try {
      const res = await phieuXuatKhoService.getDetail(phieuXuatKhoId);
      if (requestId !== requestIdRef.current) return;
      const payload = res?.data || res;
      const ct = Array.isArray(payload?.chiTiet)
        ? payload.chiTiet.find((c) => String(c.id) === String(chiTietPhieuXuatKhoId))
        : null;
      if (!payload?.phieu || !ct) {
        setKhongThay(payload?.phieu ? "dong" : "phieu");
        return;
      }
      const dong = dongTuChiTiet(payload.phieu, ct);
      // Lô chọn được (đã sắp nhập trước lấy trước) và lô dòng đã lấy: lỗi một trong hai thì báo lỗi, không hiện
      // nhầm "chưa lấy lô nào" (lưu khi đó sẽ ghi đè lô thật của dòng)
      const [lotsRes, daLay] = await Promise.all([
        phieuXuatKhoService.getAvailableLots(phieuXuatKhoId, dong.bienTheSanPhamId),
        phieuXuatKhoService.getPickedLots(phieuXuatKhoId, chiTietPhieuXuatKhoId),
      ]);
      if (requestId !== requestIdRef.current) return;
      const daLuu = banDoDaLay(daLay);
      setDuLieu({ dong, lots: Array.isArray(lotsRes) ? lotsRes : [], daLuu });
      setCapNhatLuc(new Date());
      if (!ngam || !daSuaRef.current) {
        setChon(daLuu);
        daSuaRef.current = false;
      }
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      // Tải ngầm lỗi: giữ dữ liệu và số đang nhập; chỉ báo khi tải lại sau lần lưu bị từ chối
      if (ngam) {
        if (baoLoi) toast.error("Không tải lại được danh sách lô", { description: "Số còn lấy được có thể đã cũ." });
        return;
      }
      const loai = phanLoaiLoiTai(e, TUY_CHON_LOI);
      setLoi(e);
      // Thuộc kho khác / không có quyền: để khung lỗi chung của chứng từ (KhungLoiChungTu) nói đúng việc
      if (loai.khoKhac || loai.khongQuyen) setKhongThay("phieu");
      else if (loai.khongThay) setKhongThay(loaiKhongThayChonLo(loai.cauMayChu));
    } finally {
      if (requestId === requestIdRef.current) setDangTai(false);
    }
  }, [phieuXuatKhoId, chiTietPhieuXuatKhoId]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mở.
  useEffect(() => {
    queueMicrotask(() => tai());
  }, [tai]);

  // Quay lại tab thì tải lại ngầm số còn lấy được (phiếu khác có thể vừa giữ lô); không tải khi đang lưu
  useTaiLaiKhiQuayLai(() => tai({ ngam: true }), {
    bat: Boolean(duLieu) && !dangTai && !dangLuu,
    lanCuoi: capNhatLuc,
  });

  if (dangTai && !duLieu) {
    return (
      <PageContainer className="flex min-h-full flex-col">
        <KhungDangTai nhan="Đang tải danh sách lô" />
      </PageContainer>
    );
  }
  if (khongThay) {
    return (
      <PageContainer className="flex min-h-full flex-col">
        {khongThay === "dong" ? (
          <KhungKhongThay
            tieuDe="Không tìm thấy dòng phiếu xuất"
            moTa="Dòng này không còn trên phiếu xuất hoặc phiếu đã bị xóa. Mở lại từ chi tiết phiếu xuất."
            nhanNut="Về phiếu xuất kho"
            onNut={veChiTiet}
          />
        ) : (
          <KhungLoiChungTu
            loi={loi}
            tenChungTu="phiếu xuất kho"
            tuyChonLoi={TUY_CHON_LOI}
            locCauMayChu={locCauMayChu}
            moTaKhongThay="Phiếu xuất kho không tồn tại, đã bị xóa hoặc thuộc kho khác với nơi làm việc đang chọn."
            onVeDanhSach={() => navigate("/goods-issues")}
            onThuLai={() => tai()}
          />
        )}
      </PageContainer>
    );
  }
  if (loi || !duLieu) {
    return (
      <PageContainer className="flex min-h-full flex-col">
        <KhungLoiTai tieuDe="Không tải được danh sách lô" moTa={phanLoaiLoiTai(loi, TUY_CHON_LOI).moTaLoi} onThuLai={() => tai()} />
      </PageContainer>
    );
  }

  const { dong, lots, daLuu } = duLieu;
  const can = docSo(dong.soLuongXuat);
  const quyen = quyenChonLo({ loaiXuat: dong.loaiXuat, trangThai: dong.phieuTrangThai, laQuanLy });
  const chiXem = !quyen.duocSua;
  const kiemTra = chiXem ? null : trangThaiChonLo({ chon, lots, can, laBanHang: quyen.laBanHang });
  const tongLuu = tongChon(daLuu);
  const dsLo = sapXepLo(lots, daLuu);
  const ttPhieu = getPhieuXuatKhoStatus(dong.phieuTrangThai);

  const doiSoLuong = (loHangId, chu) => {
    if (chiXem || dangLuu) return;
    if (chu === "") {
      daSuaRef.current = true;
      setChon((cu) => ({ ...cu, [loHangId]: "" }));
      return;
    }
    if (!/^\d+$/.test(chu)) return;
    daSuaRef.current = true;
    setChon((cu) => ({ ...cu, [loHangId]: chu }));
  };

  const datLai = () => {
    const moi = datLaiTheoFifo(lots, can);
    daSuaRef.current = true;
    setChon(moi);
    toast.info("Đã điền lại theo nhập trước lấy trước", {
      description: `${soVN(Object.keys(moi).length)} lô · kiểm tra rồi bấm Lưu lô`,
    });
  };

  const luu = async () => {
    if (chiXem || dangLuu) return;
    const { loi: loiLuu, loHangPicks } = kiemTraLuuLo({ chon, lots, can, laBanHang: quyen.laBanHang });
    if (loiLuu) {
      toast.error(loiLuu);
      return;
    }
    setDangLuu(true);
    try {
      await phieuXuatKhoService.pickLo(phieuXuatKhoId, {
        chiTietPhieuXuatKhoId: Number(chiTietPhieuXuatKhoId),
        loHangPicks,
      });
      toast.success(`Đã lưu lô cho ${dong.sku || dong.tenBienThe}`, { description: `Phiếu ${dong.soPhieuXuat}` });
      veChiTiet();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Chọn lô thất bại"));
      setDangLuu(false);
      // 409 "Lô X chỉ còn N có thể lấy" (phiếu khác vừa giữ lô) hoặc phiếu vừa rời trạng thái cho sửa ở máy khác:
      // tải lại ngầm, giữ số đang nhập
      if (loiLuuCanTaiLai(getApiErrorStatus(e), getApiErrorMessage(e, ""))) tai({ ngam: true, baoLoi: true });
    }
  };

  const quyTac = quyen.laBanHang
    ? "Lô của phiếu bán hàng lấy từ phiếu nhặt. Chỉ quản lý kho sửa khi lấy nhầm lô hoặc lô cũ hết hàng; tổng phải đủ số cần xuất."
    : "Chọn lô trước khi xác nhận vận chuyển; lưu được một phần. Số lấy ở mỗi lô không vượt số còn lấy được.";

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        aria-label={`Chọn lô ${dong.sku}`.trim()}
        dau={
          <DauChungTu
            // Tên biến thể dài: chữ 20px, tối đa 2 dòng
            ma={dong.tenBienThe || dong.sku}
            kepTieuDe={2}
            coTieuDe="md"
            trangThai={{ label: tongLuu >= can && can > 0 ? "Đủ hàng" : "Chưa đủ" }}
            dongPhu={
              <>
                SKU <span className="font-mono text-bo-foreground">{dong.sku || "—"}</span>
              </>
            }
            onQuayLai={veChiTiet}
            nhanQuayLai={`Về phiếu xuất kho ${dong.soPhieuXuat}`}
            nutPhu={
              chiXem
                ? null
                : {
                  ma: "datLai",
                  nhan: "Đặt lại theo nhập trước lấy trước",
                  icon: RotateCcw,
                  onClick: datLai,
                  khoa: dangLuu || lots.length === 0,
                }
            }
            nutChinh={
              chiXem
                ? null
                : {
                  ma: "luu",
                  nhan: "Lưu lô",
                  icon: Check,
                  onClick: luu,
                  khoa: !kiemTra.hopLe,
                  lyDo: kiemTra.hopLe ? undefined : kiemTra.chu,
                  dangChay: dangLuu,
                }
            }
          />
        }
        tienTrinh={
          <DaiTongChonLo
            nhan={chiXem ? "Đã lấy" : "Đã chọn"}
            tong={chiXem ? tongLuu : kiemTra.tong}
            can={can}
            kiemTra={kiemTra}
          />
        }
        thongBao={chiXem ? <DongThongBao tone="neutral">{quyen.lyDoXem}</DongThongBao> : null}
        chinh={
          <BangLoChonLo
            key={chiXem ? "xem" : "sua"}
            lots={dsLo}
            chon={chon}
            daLuu={daLuu}
            chiXem={chiXem}
            dang={dangLuu}
            dauFifo={loDauFifo(lots)}
            onDoi={doiSoLuong}
          />
        }
        cotPhai={
          <CotThuocTinh nhan="Thông tin dòng phiếu xuất">
            <NhomThuocTinh>
              <BangThuocTinh
                rongNhan={120}
                muc={[
                  {
                    nhan: "Phiếu xuất",
                    giaTri: (
                      <Link
                        to={`/goods-issues/${phieuXuatKhoId}`}
                        className="rounded font-semibold tabular-nums text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                      >
                        {dong.soPhieuXuat}
                      </Link>
                    ),
                  },
                  {
                    nhan: "Trạng thái phiếu",
                    giaTri: ttPhieu.label ? <StatusBadge label={ttPhieu.label} quyTrinh="phieuXuat" /> : null,
                  },
                  { nhan: "Loại xuất", giaTri: NHAN_LOAI_XUAT[dong.loaiXuat] ?? null },
                  { nhan: "Kho xuất", giaTri: dong.tenKho },
                ]}
              />
            </NhomThuocTinh>
            <NhomThuocTinh nhan="Quy tắc chọn lô">
              <p className="text-[13px] leading-5 text-slate-700">{quyTac}</p>
            </NhomThuocTinh>
          </CotThuocTinh>
        }
      />
    </PageContainer>
  );
}
