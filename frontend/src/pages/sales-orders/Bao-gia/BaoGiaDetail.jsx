import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CircleCheckBig, Printer, XCircle } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import {
  CAU_HET_THOI_HAN,
  MO_TA_HET_THOI_HAN,
  chayCoThoiHan,
  khiGocKetThuc,
  khoaKhiChoGoc,
  laLoiHetThoiHan,
} from "@/components/chung-tu/thoiHanThaoTac";
import BangHangBan from "@/components/ban-hang/BangHangBan";
import TongTienBan from "@/components/ban-hang/TongTienBan";
import { dongHangBan } from "@/components/ban-hang/chi-tiet-don-ban/tinhDonBan";
import ThuocTinhBaoGiaBan from "@/components/ban-hang/chi-tiet-bao-gia/ThuocTinhBaoGiaBan";
import {
  LY_DO_TU_CHOI_GOI_Y,
  TT_BAO_GIA,
  buocBaoGia,
  locDonLienQuan,
  maDonTuBaoGia,
  thongBaoBaoGia,
} from "@/components/ban-hang/chi-tiet-bao-gia/tinhBaoGiaBan";
import { LY_DO_KHACH_TU_CHOI_TOI_DA as LY_DO_TOI_DA, SO_DON_TU_BAO_GIA_TOI_DA } from "@/config/bangChungTu";
import { getBaoGiaStatus } from "@/constants/baoGia";
import useQuayLai from "@/hooks/useQuayLai";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { donBanHangService } from "@/services/donBanHangService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";

const TEN_CHUNG_TU = "báo giá";
const TONG_THEO = Object.freeze({ soLuong: "soLuong", thanhTien: "thanhTien" });
const LOI_DA_DOI_NOI_KHAC = [400, 403, 409];
// Máy chủ ném RuntimeException "Không tìm thấy …" (HTTP 500) khi mã không có
const TUY_CHON_LOI = Object.freeze({ coi500LaKhongThay: true });
// Kết quả khi bỏ lệnh từ chối (đã hết thời hạn hoặc đã rời màn trước khi gửi)
const BO_QUA = "boQua";

/**
 * Chi tiết báo giá bán · bản "một khối" (21/10/2026, artboard BaoGiaBan của canvas "Màn bán hàng & kho cấp 2–3"):
 * đầu khối, tiến trình Lập báo giá → Khách phản hồi → Chốt thành đơn, bảng hàng gom theo sản phẩm + tổng tiền,
 * cột phải (khách, giao hàng, người lập, đơn bán sinh từ báo giá). Quản trị viên / nhân viên bán hàng: "Chốt thành đơn"
 * (mở trang tạo đơn như màn cũ — hộp thoại chốt chờ chốt Q7) và "Khách từ chối" (⋯); quản lý kho, nhân viên kho chỉ xem.
 */
export default function BaoGiaDetail() {
  const { id } = useParams();
  return <ChiTietBaoGiaBan key={id} id={id} />;
}

function ChiTietBaoGiaBan({ id }) {
  const navigate = useNavigate();
  const quayLai = useQuayLai("/sales-quotations");
  const laBan = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_BAN_HANG]);

  // ── Báo giá ──────────────────────────────────────────────────────────────
  const taiBaoGia = useCallback(async () => {
    const res = await donBanHangService.getDetail(id);
    return res?.data ?? null;
  }, [id]);
  const q = useTaiDuLieu(taiBaoGia, `bao-gia-ban-${id}`, { enabled: Boolean(id) });
  const ct = q.data?.donBanHang && String(q.data.donBanHang.id) === String(id) ? q.data : null;
  const don = ct?.donBanHang ?? null;
  const laDonBan = Boolean(don) && don.loaiChungTu !== "bao_gia";

  // Mở mã của đơn bán ở màn báo giá: chuyển sang chi tiết đơn bán
  useEffect(() => {
    if (laDonBan) navigate(`/sales-orders/${id}`, { replace: true });
  }, [laDonBan, id, navigate]);

  // ── Đơn sinh từ báo giá: /filter (mã đúng SO… hoặc SO…-n) rồi lọc lại đúng mẫu ^SO…(-n)?$ ở giao diện; chỉ bán hàng tra.
  //    Không dùng LIKE "SO…" trơn: khớp cả SO…0, SO…1x và đơn tại quầy cùng ngày, có thể đẩy đơn thật ra khỏi trang kết quả ──
  const maSO = don && !laDonBan ? maDonTuBaoGia(don.soDonHang) : null;
  const khachId = don?.khachHang?.id ?? null;
  const taiDonLienQuan = useCallback(async () => {
    const page = await donBanHangService.filter({
      page: 0,
      size: SO_DON_TU_BAO_GIA_TOI_DA,
      filters: [
        { fieldName: "loaiChungTu", operation: "EQUALS", value: "don_ban_hang" },
        // Hai điều kiện OR được máy chủ gom thành một nhóm rồi AND với các điều kiện còn lại (BaseServiceImpl)
        { fieldName: "soDonHang", operation: "EQUALS", value: maSO, logicType: "OR" },
        { fieldName: "soDonHang", operation: "LIKE", value: `${maSO}-`, logicType: "OR" },
        ...(khachId != null ? [{ fieldName: "khachHang.id", operation: "EQUALS", value: khachId }] : []),
      ],
      sorts: [{ fieldName: "id", direction: "DESC" }],
    });
    return page?.content ?? [];
  }, [maSO, khachId]);
  const qDon = useTaiDuLieu(taiDonLienQuan, `don-tu-bao-gia-${maSO}-${don?.trangThai}`, { enabled: Boolean(maSO && laBan) });

  const [hop, setHop] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [dangChay, setDangChay] = useState(false);
  const [loiHop, setLoiHop] = useState(null);
  const [choGoc, setChoGoc] = useState(false);
  const huyChoGocRef = useRef(null);
  const daGoRef = useRef(false);
  useEffect(() => {
    daGoRef.current = false;
    return () => {
      daGoRef.current = true;
      huyChoGocRef.current?.();
    };
  }, []);

  useTaiLaiKhiQuayLai(() => {
    q.reload();
    if (maSO && laBan) qDon.reload();
  }, { bat: Boolean(ct) && !q.loading && !dangChay && !hop, lanCuoi: q.capNhatLuc });

  const dong = useMemo(() => dongHangBan(ct?.chiTiet), [ct]);
  const bang = useBangChungTu(dong, { tongTheo: TONG_THEO });

  if (!ct || laDonBan) {
    if (laDonBan || q.loading || (!q.error && q.data === undefined)) {
      return (
        <PageContainer className="flex min-h-full flex-col">
          <KhungDangTai nhan="Đang tải báo giá" />
        </PageContainer>
      );
    }
    return (
      <PageContainer className="flex min-h-full flex-col">
        <KhungLoiChungTu
          loi={q.error}
          tenChungTu={TEN_CHUNG_TU}
          tuyChonLoi={TUY_CHON_LOI}
          onVeDanhSach={() => navigate("/sales-quotations")}
          onThuLai={q.reload}
        />
      </PageContainer>
    );
  }

  const tt = Number(don.trangThai);
  const so = don.soDonHang || `#${don.id}`;
  const choPhanHoi = tt === TT_BAO_GIA.CHO_PHAN_HOI;
  const donLienQuan = laBan && qDon.data !== undefined && !qDon.error
    ? locDonLienQuan(qDon.data, { soBaoGia: don.soDonHang, khachHangId: khachId })
    : null;

  // ── Khách từ chối ───────────────────────────────────────────────────────
  const moTuChoi = () => {
    setLyDo("");
    setLoiHop(null);
    setHop(true);
  };
  const doiMoHop = (mo) => {
    if (!mo) setHop(false);
  };
  const khoaToiKhiGocXong = (loi) => {
    huyChoGocRef.current?.();
    setChoGoc(true);
    huyChoGocRef.current = khiGocKetThuc(loi, () => {
      huyChoGocRef.current = null;
      setChoGoc(false);
      q.reload();
    });
  };

  const ghiNhanTuChoi = async () => {
    const lyDoGui = lyDo.trim();
    if (!lyDoGui) return;
    const luot = { hetHan: false };
    setLoiHop(null);
    setDangChay(true);
    try {
      // reject-quote không kiểm trạng thái: tải lại báo giá ngay trước khi gửi, dừng nếu không còn Chờ phản hồi.
      // Hết thời hạn ngay ở bước tải lại thì KHÔNG gửi lệnh từ chối nữa (lệnh đến muộn có thể ghi đè báo giá vừa chốt)
      const daDoi = await chayCoThoiHan(async () => {
        const moi = (await donBanHangService.getDetail(id))?.data?.donBanHang;
        const ttMoi = Number(moi?.trangThai);
        if (ttMoi !== TT_BAO_GIA.CHO_PHAN_HOI) return ttMoi;
        if (luot.hetHan || daGoRef.current) return BO_QUA;
        await donBanHangService.rejectQuote(id, { reason: lyDoGui });
        return null;
      });
      if (daDoi === BO_QUA) return;
      setHop(false);
      if (daDoi != null) {
        toast.error("Không ghi nhận được từ chối", {
          description: daDoi === TT_BAO_GIA.DA_CHOT
            ? "Báo giá vừa được chốt thành đơn ở nơi khác. Đã tải lại."
            : "Báo giá vừa đổi trạng thái ở nơi khác. Đã tải lại.",
        });
      } else {
        toast.success("Đã ghi nhận khách từ chối", { description: so });
      }
      q.reload();
    } catch (error) {
      if (laLoiHetThoiHan(error)) {
        luot.hetHan = true;
        if (daGoRef.current) return;
        setHop(false);
        toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
        q.reload();
        khoaToiKhiGocXong(error);
        return;
      }
      const cau = getApiErrorMessage(error, "Không ghi nhận được từ chối");
      if (LOI_DA_DOI_NOI_KHAC.includes(getApiErrorStatus(error))) {
        setHop(false);
        toast.error(cau);
      } else {
        setLoiHop(cau);
      }
      q.reload();
    } finally {
      setDangChay(false);
    }
  };

  const nutChinh = khoaKhiChoGoc(
    choPhanHoi && laBan
      ? {
        ma: "chot",
        nhan: "Chốt thành đơn",
        icon: CircleCheckBig,
        // Như màn cũ: sang trang tạo đơn từ báo giá (hộp thoại chốt ngay tại màn chờ chốt Q7)
        onClick: () => navigate(`/sales-orders/create?quoteId=${id}`),
      }
      : null,
    choGoc,
  );
  const menu = choPhanHoi && laBan
    ? [{
      ma: "tuChoi",
      nhan: "Khách từ chối",
      moTa: "Ghi lý do, báo giá không chốt được nữa",
      icon: XCircle,
      nguyHiem: true,
      khoa: choGoc,
      onSelect: moTuChoi,
    }]
    : [];

  const thongBao = [
    ...thongBaoBaoGia(don, donLienQuan ?? []).map((n) => (
      <DongThongBao key={n.ma} tone={n.tone}>
        <span className="whitespace-pre-wrap">{n.chu}</span>
      </DongThongBao>
    )),
    // Tải lại (sau thao tác, khi quay lại tab) lỗi: màn đang hiện dữ liệu cũ
    q.loiTaiLai ? (
      <DongThongBao key="loi-tai-lai" tone="bad" actions={<NutChu onClick={q.reload}>Thử lại</NutChu>}>
        Không tải lại được báo giá: {getApiErrorMessage(q.error, "lỗi kết nối")}. Thông tin đang hiện có thể đã cũ.
      </DongThongBao>
    ) : null,
  ].filter(Boolean);
  const buoc = buocBaoGia(don);

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        dau={
          <DauChungTu
            ma={so}
            trangThai={{ label: getBaoGiaStatus(don.trangThai).label, quyTrinh: "baoGiaBan" }}
            dongPhu={[
              "Báo giá bán hàng",
              bang.rong ? "chưa có sản phẩm" : <b key="bt" className="font-semibold text-bo-foreground">{soVN(bang.tong.soDong)} biến thể</b>,
              bang.rong ? null : <b key="sl" className="font-semibold text-bo-foreground">tổng số lượng {soVN(bang.tong.soLuong)}</b>,
            ]}
            onQuayLai={quayLai}
            nhanQuayLai="Về danh sách báo giá"
            nutPhu={{ ma: "in", nhan: "In báo giá", icon: Printer, onClick: () => navigate(`/sales-quotations/${id}/print`) }}
            saoChepMa={{ giaTri: don.soDonHang, nhan: "Sao chép mã báo giá" }}
            menu={menu}
            nutChinh={nutChinh}
          />
        }
        tienTrinh={buoc.length ? <TienTrinhChungTu buoc={buoc} nhan="Tiến trình báo giá" /> : null}
        thongBao={thongBao.length ? thongBao : null}
        chinh={
          <BangHangBan bang={bang} tenChungTu={TEN_CHUNG_TU} nhanTim="Tìm trong báo giá">
            <TongTienBan
              trai="Giá theo báo giá: khi chốt, đơn bán hàng giữ nguyên đơn giá từng dòng; chỉ phí vận chuyển, địa chỉ và ghi chú sửa được."
              muc={[
                { ma: "hang", nhan: "Tiền hàng", giaTri: formatCurrency(don.tienHang) },
                { ma: "phi", nhan: "Phí vận chuyển", giaTri: formatCurrency(don.phiVanChuyen) },
                { ma: "tong", nhan: "Tổng cộng", giaTri: formatCurrency(don.tongCong), tong: true },
              ]}
            />
          </BangHangBan>
        }
        cotPhai={
          <ThuocTinhBaoGiaBan
            don={don}
            laBan={laBan}
            donLienQuan={donLienQuan}
            loiDonLienQuan={laBan && maSO && qDon.error && !qDon.loading ? getApiErrorMessage(qDon.error, "lỗi kết nối") : null}
            onThuLaiDonLienQuan={qDon.reload}
          />
        }
      />

      <HopXacNhanChungTu
        mo={hop}
        onDoiMo={doiMoHop}
        tieuDe={`Khách từ chối báo giá ${so}?`}
        moTa="Báo giá chuyển sang Bị từ chối và không chốt thành đơn được nữa."
        nhanXacNhan="Ghi nhận từ chối"
        kieu="nguyHiem"
        dangChay={dangChay}
        khoaXacNhan={!lyDo.trim()}
        lyDoKhoa="Nhập lý do khách từ chối"
        loi={loiHop}
        onXacNhan={ghiNhanTuChoi}
      >
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lý do thường gặp">
          {LY_DO_TU_CHOI_GOI_Y.map((chu) => (
            <button
              key={chu}
              type="button"
              aria-pressed={lyDo === chu}
              disabled={dangChay}
              onClick={() => {
                setLyDo(chu);
                setLoiHop(null);
              }}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:opacity-50",
                lyDo === chu
                  ? "border-bo-primary bg-bo-primary-soft text-bo-primary"
                  : "border-bo-border bg-bo-surface text-slate-700 hover:bg-bo-surface-subtle",
              )}
            >
              {chu}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="ly-do-khach-tu-choi" className={NHAN_O}>
            Lý do <span className="text-bo-danger">*</span>
          </label>
          <textarea
            id="ly-do-khach-tu-choi"
            value={lyDo}
            onChange={(suKien) => {
              setLyDo(suKien.target.value.slice(0, LY_DO_TOI_DA));
              setLoiHop(null);
            }}
            placeholder="Ví dụ: Khách chọn nhà cung cấp khác giá thấp hơn 8%"
            rows={3}
            maxLength={LY_DO_TOI_DA}
            aria-describedby="ly-do-khach-tu-choi-goi-y"
            aria-required="true"
            disabled={dangChay}
            className={O_NHAP_NHIEU_DONG}
          />
          <p id="ly-do-khach-tu-choi-goi-y" className={GOI_Y_O}>
            <span>Hiện ở chi tiết báo giá và tab Báo giá của khách hàng</span>
            <span>{lyDo.length}/{LY_DO_TOI_DA}</span>
          </p>
        </div>
      </HopXacNhanChungTu>
    </PageContainer>
  );
}
