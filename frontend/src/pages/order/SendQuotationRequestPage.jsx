import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Send } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP } from "@/components/chung-tu/kieuHopThoai";
import BangNhaCungCap from "@/components/order/gui-bao-gia/BangNhaCungCap";
import ThuocTinhGuiBaoGia from "@/components/order/gui-bao-gia/ThuocTinhGuiBaoGia";
import {
  chanGuiBaoGia,
  dongNhaCungCap,
  maYeuCau,
  phanLoaiLoiGui,
  tongSoLuongDat,
} from "@/components/order/gui-bao-gia/tinhGuiBaoGia";
import { VAI_TRO_XEM_DON_MUA, locCauMayChuMuaHang } from "@/components/order/chi-tiet-yeu-cau/tinhYeuCau";
import EmptyState from "@/components/shared/EmptyState";
import SupplierFormDialog from "@/components/supplier/SupplierFormDialog";
import { coTheGuiYeuCauBaoGia } from "@/components/supplier/quyTacNhaCungCap";
import { Button } from "@/components/ui/button";
import { CHO_GUI_LAI_MS, CO_TRANG_DONG } from "@/config/bangChungTu";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import purchaseRequestService from "@/services/purchaseRequestService";
import { getAllSupplier } from "@/services/supplierService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { companyProfileService } from "@/services/companyProfileService";
import { SETTINGS_PAGES, canEditSettingsPage } from "@/components/settings/settings.config";
import {
  CAU_BAO_NGUOI_CO_QUYEN,
  CAU_LY_DO_KHUNG_CHAN,
  LIEN_KET_NHAP_THONG_TIN,
  TIEU_DE_KHUNG_CHAN,
  cauDaGui,
  doanNhanThieu,
  loiGuiTheoMayChuMoi,
  oThieuHienTai,
  xuLyLoiGui,
} from "./chanGuiYeuCauBaoGia";

const taiNhaCungCap = () => getAllSupplier();

/**
 * Gửi yêu cầu báo giá (/purchase-requests/:id/send-quotation) · bản "một khối" 21/10/2026 (artboard GuiYeuCauBaoGia của
 * canvas "Màn bán hàng & kho cấp 2–3"): bảng nhà cung cấp (lọc Gửi được, tìm, chọn tất cả), cột phải Gửi đến / Yêu cầu
 * nhập hàng / Sản phẩm, hộp xác nhận gửi.
 * - Chỉ gửi được khi yêu cầu Đã duyệt và có sản phẩm; trạng thái khác → màn chặn có câu riêng (Đã gửi: "Mở so sánh báo
 *   giá"; Đã chuyển thành đơn mua: "Mở đơn mua hàng").
 * - Q12, Q14 chưa chốt nên giữ như màn cũ: gửi xong về danh sách yêu cầu nhập hàng; route không chặn theo vai trò (máy
 *   chủ cho QTV, QLK, NVMH, NVK gửi). Thêm nhà cung cấp / Cập nhật email: QTV + NVMH (như màn cũ).
 * - Thông tin cửa hàng thiếu tên đăng ký kinh doanh / địa chỉ đăng ký: khóa nút Gửi và hiện dòng chặn (demo-email
 *   TT-ChanGuiBaoGia); máy chủ vẫn chặn bằng 409 THIEU_THONG_TIN_CUA_HANG. 409 YEU_CAU_DA_GUI → tải lại, hiện màn chặn.
 * - Lỗi khi gửi: xem tinhGuiBaoGia.phanLoaiLoiGui (400 chưa gửi cho ai; 500 lỗi máy chủ, đã hoàn tác và chưa email nào
 *   đi vì email gửi sau khi lưu — câu ở chanGuiYeuCauBaoGia.loiGuiTheoMayChuMoi; yêu cầu đã đổi trạng thái → tải lại,
 *   hiện màn chặn; không rõ kết quả → khóa nút Gửi CHO_GUI_LAI_MS rồi mới tải lại).
 */
// Trả lời lỗi có thân JSON của máy chủ (không phải trang lỗi HTML của proxy khi hết giờ chờ)
const laLoiJson = (error) => Boolean(error?.response?.data) && typeof error.response.data === "object";
export default function SendQuotationRequestPage() {
  const { id } = useParams();
  return <ManGuiBaoGia key={id} id={id} />;
}

function ManGuiBaoGia({ id }) {
  const navigate = useNavigate();
  const veYeuCau = useCallback(() => navigate(`/purchase-requests/${id}`), [navigate, id]);
  const suaNcc = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG]);
  const suaThongTinCuaHang = canEditSettingsPage(
    SETTINGS_PAGES.find((page) => page.key === "store"),
    window.localStorage.getItem("role"),
  );
  const xemDonMua = hasAnyRole(VAI_TRO_XEM_DON_MUA);

  // ── Dữ liệu: yêu cầu và nhà cung cấp tải riêng, lỗi bên nào báo bên đó ─────────────────────────────
  const taiYeuCau = useCallback(async () => (await purchaseRequestService.getById(id)).data?.data ?? null, [id]);
  const qYc = useTaiDuLieu(taiYeuCau, `gui-bao-gia-${id}`, { enabled: Boolean(id) });
  const qNcc = useTaiDuLieu(taiNhaCungCap, "nha-cung-cap-gui-bao-gia");
  const yc = qYc.data ?? null;
  const chan = chanGuiBaoGia(yc, { xemDonMua });
  const dong = useMemo(() => dongNhaCungCap(qNcc.data), [qNcc.data]);
  const coDanhSach = qNcc.data !== undefined;

  // ── Thông tin cửa hàng: email gửi nhà cung cấp phải có tên đăng ký kinh doanh và địa chỉ đăng ký ──────
  // null khi chưa tải hoặc tải lỗi (lỗi mạng thì không chặn ở giao diện; máy chủ vẫn chặn)
  const [hoSo, setHoSo] = useState(null);
  const [dangTaiHoSo, setDangTaiHoSo] = useState(true);
  // Ô thiếu máy chủ vừa trả kèm 409 THIEU_THONG_TIN_CUA_HANG
  const [thieuTuMayChu, setThieuTuMayChu] = useState(null);
  // Đọc lại máy chủ (không dùng bộ nhớ đệm): quản trị viên có thể vừa nhập ở máy khác
  const taiHoSo = useCallback(async () => {
    try {
      setHoSo(await companyProfileService.get({ force: true }));
      setThieuTuMayChu(null);
    } catch {
      setHoSo(null);
    } finally {
      setDangTaiHoSo(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => taiHoSo());
  }, [taiHoSo]);
  const thieu = oThieuHienTai({ hoSo, thieuTuMayChu });

  // ── Chọn: chỉ giữ nhà cung cấp còn gửi được (danh sách tải lại sau lỗi → tự bỏ nhà cung cấp hết gửi được) ──
  const [chon, setChon] = useState(() => new Set());
  const theoId = useMemo(() => new Map(dong.map((d) => [d.id, d])), [dong]);
  const daChon = [...chon].map((ma) => theoId.get(ma)).filter((d) => d?.guiDuoc);
  const chonHopLe = new Set(daChon.map((d) => d.id));
  // Danh sách mới về: bỏ hẳn id không còn gửi được khỏi lựa chọn (không tự chọn lại khi nhà cung cấp hoạt động lại)
  const [dongDaDon, setDongDaDon] = useState(dong);
  if (dongDaDon !== dong) {
    setDongDaDon(dong);
    if (coDanhSach && chonHopLe.size !== chon.size) setChon(chonHopLe);
  }

  const [tuKhoa, setTuKhoa] = useState("");
  const [loc, setLoc] = useState("duoc");
  const [trang, setTrang] = useState(0);
  const [coTrang, setCoTrang] = useState(CO_TRANG_DONG[0]);

  // ── Thêm / sửa nhà cung cấp ──────────────────────────────────────────────────────────────────────
  // { mo, supplier: null | ncc, oDauTien }; đóng thì giữ supplier để hộp không đổi chữ lúc đang mờ dần
  const [hopNcc, setHopNcc] = useState({ mo: false, supplier: null, oDauTien: null });
  const moHopNcc = (supplier, oDauTien = null) => setHopNcc({ mo: true, supplier, oDauTien });
  const daLuuNcc = (luu, { laSua }) => {
    if (!luu?.id) {
      qNcc.reload();
      return;
    }
    qNcc.setData((cu) => {
      const ds = Array.isArray(cu) ? cu : [];
      return laSua ? ds.map((n) => (n.id === luu.id ? { ...n, ...luu } : n)) : [luu, ...ds.filter((n) => n.id !== luu.id)];
    });
    const ten = luu.tenNhaCungCap || "nhà cung cấp";
    const guiDuoc = coTheGuiYeuCauBaoGia(luu);
    if (guiDuoc) setChon((cu) => new Set(cu).add(luu.id));
    if (!laSua) {
      // Thêm mới: dòng mới nằm đầu danh sách → bỏ từ khóa, về trang đầu để thấy ngay
      setTuKhoa("");
      setTrang(0);
    } else {
      // Sửa email: giữ từ khóa và trang; nút "Cập nhật email" đã mất nên đưa tiêu điểm về ô chọn của dòng đó (sau khi
      // hộp đóng hẳn — lúc còn mở, hộp giữ tiêu điểm bên trong)
      setTimeout(() => document.querySelector(`input[data-ncc-id="${luu.id}"]`)?.focus(), 350);
    }
    if (guiDuoc) {
      toast.success(laSua ? `Đã cập nhật email của ${ten} và chọn vào danh sách gửi` : `Đã thêm nhà cung cấp "${ten}" và chọn vào danh sách gửi`);
    } else {
      toast.success(laSua ? `Đã lưu nhà cung cấp ${ten}` : `Đã thêm nhà cung cấp "${ten}"`);
    }
  };

  // ── Gửi ──────────────────────────────────────────────────────────────────────────────────────────
  const [hop, setHop] = useState(false);
  const [dangGui, setDangGui] = useState(false);
  const [loiGui, setLoiGui] = useState(null);
  // Lần gửi không rõ kết quả: khóa nút Gửi tới lúc tự tải lại yêu cầu (máy chủ có thể vẫn đang gửi email)
  const [choGuiLai, setChoGuiLai] = useState(false);
  const henChoRef = useRef(null);
  const daGoRef = useRef(false);
  useEffect(() => {
    daGoRef.current = false;
    return () => {
      daGoRef.current = true;
      clearTimeout(henChoRef.current);
    };
  }, []);

  useTaiLaiKhiQuayLai(
    () => {
      qYc.reload();
      qNcc.reload();
      taiHoSo();
    },
    { bat: Boolean(yc) && !qYc.loading && !dangGui && !hop && !hopNcc.mo && !choGuiLai, lanCuoi: qYc.capNhatLuc },
  );

  const ma = maYeuCau(yc, id);
  const soBienThe = Array.isArray(yc?.chiTietYeuCauMuaHangs) ? yc.chiTietYeuCauMuaHangs.length : 0;

  const gui = async () => {
    if (!yc || !daChon.length) return;
    const soNcc = daChon.length;
    setDangGui(true);
    try {
      // Không gửi ghiChu: máy chủ bỏ qua trường này
      await purchaseRequestService.sendQuotationRequest({ yeuCauMuaHangId: Number(yc.id ?? id), nhaCungCapIds: daChon.map((d) => d.id) });
      // Thông báo nhanh là chung toàn ứng dụng: vẫn báo kết quả dù người dùng đã rời màn trong lúc gửi.
      // Email gửi sau khi lưu đơn nên không khẳng định email đã đi (HOP-DONG 6.11).
      toast.success(cauDaGui(soVN(soNcc)), { description: `Theo dõi báo giá ở ${ma}` });
      if (daGoRef.current) return;
      setHop(false);
      // Q12 chưa chốt: về danh sách yêu cầu nhập hàng như màn cũ
      navigate("/purchase-requests");
    } catch (error) {
      // Lỗi có mã của máy chủ mới (LoiCoMaException) xét trước
      const coMa = xuLyLoiGui(error);
      if (coMa.loai === "thieu" || coMa.loai === "daGui") {
        if (daGoRef.current) {
          toast.error(`Gửi yêu cầu báo giá ${ma} chưa xong`, { description: coMa.message ?? CAU_LY_DO_KHUNG_CHAN });
          return;
        }
        setHop(false);
        if (coMa.loai === "thieu") {
          // Dòng chặn hiện ngay (câu trong dòng đã nói lý do, không báo trùng)
          if (coMa.thieu) setThieuTuMayChu(coMa.thieu);
          else taiHoSo();
        } else {
          // Yêu cầu đã được gửi (bấm 2 lần hoặc người khác vừa gửi): tải lại, màn chặn "Đã gửi" hiện ra
          toast.info(coMa.message);
          qYc.reload();
        }
        return;
      }
      // 500 JSON: máy chủ mới gửi email sau khi lưu nên chưa email nào đi (thay câu "lỗi email giữa chừng" của máy chủ cũ)
      const loi = loiGuiTheoMayChuMoi(
        phanLoaiLoiGui(getApiErrorStatus(error), getApiErrorMessage(error, ""), { laJson: laLoiJson(error) }),
      );
      if (daGoRef.current) {
        if (loi.chu) toast.error(`Gửi yêu cầu báo giá ${ma} chưa xong`, { description: loi.chu });
        return;
      }
      setHop(false);
      if (loi.loai === "doiTrangThai") {
        toast.info("Yêu cầu đã đổi trạng thái ở nơi khác", { description: "Đã tải lại yêu cầu" });
        qYc.reload();
        return;
      }
      setLoiGui(loi.chu);
      if (loi.loai === "chuaRo") {
        clearTimeout(henChoRef.current);
        setChoGuiLai(true);
        henChoRef.current = setTimeout(() => {
          setChoGuiLai(false);
          qYc.reload();
        }, CHO_GUI_LAI_MS);
        return;
      }
      if (loi.loai === "ncc" || loi.loai === "khac") qNcc.reload();
      if (loi.loai !== "ncc" && loi.loai !== "quyen") qYc.reload();
    } finally {
      if (!daGoRef.current) setDangGui(false);
    }
  };

  // ── Đang tải / lỗi / màn chặn ────────────────────────────────────────────────────────────────────
  if (!yc) {
    if (qYc.loading || (!qYc.error && qYc.data === undefined)) {
      return (
        <PageContainer className="flex min-h-full flex-col">
          <KhungDangTai nhan="Đang tải yêu cầu nhập hàng" coTienTrinh={false} />
        </PageContainer>
      );
    }
    return (
      <PageContainer className="flex min-h-full flex-col">
        <KhungLoiChungTu
          loi={qYc.error}
          tenChungTu="yêu cầu nhập hàng"
          onVeDanhSach={() => navigate("/purchase-requests")}
          onThuLai={qYc.reload}
          locCauMayChu={locCauMayChuMuaHang}
        />
      </PageContainer>
    );
  }

  if (chan) {
    return (
      <PageContainer className="flex min-h-full flex-col">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
          <EmptyState
            icon={Send}
            className="flex-1"
            title={chan.tieuDe}
            description={chan.moTa}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                {chan.nut.map((n) => (
                  <Button
                    key={n.ma}
                    type="button"
                    onClick={() => navigate(n.to)}
                    className="bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                  >
                    {n.nhan}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={veYeuCau}
                  className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                >
                  Về yêu cầu nhập hàng {ma}
                </Button>
              </div>
            }
          />
        </div>
      </PageContainer>
    );
  }

  const lyDoKhoa = choGuiLai
    ? "Đang chờ máy chủ xử lý xong lần gửi trước"
    : thieu.length
      ? "Thông tin cửa hàng còn thiếu"
      : dangTaiHoSo
        ? "Đang kiểm tra thông tin cửa hàng"
        : !daChon.length
      ? "Chọn ít nhất một nhà cung cấp"
      : "";
  const thongBao = [
    <DongThongBao key="mot-lan" tone="info">
      Mỗi nhà cung cấp nhận một email có đường dẫn vào cổng báo giá. <b className="font-semibold">Chỉ gửi một lần:</b> sau khi gửi,
      yêu cầu chuyển sang Đã gửi yêu cầu báo giá và không thêm nhà cung cấp được nữa.
    </DongThongBao>,
    thieu.length ? (
      <DongThongBao
        key="thieu-thong-tin-cua-hang"
        tone="warn"
        actions={
          suaThongTinCuaHang ? (
            <Link to="/settings/store" className="font-semibold text-bo-primary-hover no-underline hover:text-[#0b4ea6]">
              {LIEN_KET_NHAP_THONG_TIN}
            </Link>
          ) : null
        }
      >
        <b className="font-semibold">{TIEU_DE_KHUNG_CHAN}.</b> Thông tin cửa hàng còn thiếu{" "}
        {doanNhanThieu(thieu).map((doan, i) => (i % 2 === 0 ? <b key={i} className="font-semibold">{doan}</b> : <span key={i}>{doan}</span>))}
        . {CAU_LY_DO_KHUNG_CHAN}
        {suaThongTinCuaHang ? null : <> {CAU_BAO_NGUOI_CO_QUYEN}</>}
      </DongThongBao>
    ) : null,
    loiGui ? (
      <DongThongBao key="loi-gui" tone="bad" actions={<NutChu onClick={() => setLoiGui(null)}>Đã hiểu</NutChu>}>
        {loiGui}
      </DongThongBao>
    ) : null,
    qYc.loiTaiLai ? (
      <DongThongBao key="loi-tai-lai" tone="bad" actions={<NutChu onClick={qYc.reload}>Thử lại</NutChu>}>
        Không tải lại được yêu cầu: {getApiErrorMessage(qYc.error, "lỗi kết nối")}. Thông tin đang hiện có thể đã cũ.
      </DongThongBao>
    ) : null,
    // Danh sách nhà cung cấp đã có mà tải lại lỗi: giữ bảng đang xem, báo ở đây
    qNcc.loiTaiLai ? (
      <DongThongBao key="loi-tai-lai-ncc" tone="bad" actions={<NutChu onClick={qNcc.reload}>Thử lại</NutChu>}>
        Không tải lại được danh sách nhà cung cấp: {getApiErrorMessage(qNcc.error, "lỗi kết nối")}. Danh sách đang hiện có thể đã cũ.
      </DongThongBao>
    ) : null,
  ].filter(Boolean);

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        dau={
          <DauChungTu
            ma="Gửi yêu cầu báo giá"
            dongPhu={[
              <span key="yc">
                Cho yêu cầu nhập hàng{" "}
                <Link to={`/purchase-requests/${id}`} className="font-medium tabular-nums text-bo-primary hover:underline">
                  {ma}
                </Link>
              </span>,
              <b key="bt" className="font-semibold text-bo-foreground">{soVN(soBienThe)} biến thể</b>,
              <b key="sl" className="font-semibold text-bo-foreground">tổng số lượng {soVN(tongSoLuongDat(yc))}</b>,
            ]}
            onQuayLai={veYeuCau}
            nhanQuayLai="Về yêu cầu nhập hàng"
            nutPhu={
              suaNcc
                ? {
                  ma: "them",
                  nhan: "Thêm nhà cung cấp",
                  icon: Plus,
                  // Chờ danh sách tải xong: lần tải đầu về sau sẽ đè mất nhà cung cấp vừa thêm
                  khoa: !coDanhSach,
                  lyDo: !coDanhSach ? "Đang tải danh sách nhà cung cấp" : undefined,
                  onClick: () => moHopNcc(null),
                }
                : null
            }
            nutChinh={{
              ma: "gui",
              nhan: daChon.length ? `Gửi yêu cầu (${soVN(daChon.length)})` : "Gửi yêu cầu",
              icon: Send,
              khoa: Boolean(lyDoKhoa) || dangGui,
              lyDo: lyDoKhoa || undefined,
              hienLyDo: true,
              onClick: () => {
                setLoiGui(null);
                setHop(true);
              },
            }}
          />
        }
        thongBao={thongBao}
        chinh={
          <BangNhaCungCap
            dong={dong}
            chon={chonHopLe}
            onDoiChon={setChon}
            tuKhoa={tuKhoa}
            onDoiTuKhoa={setTuKhoa}
            loc={loc}
            onDoiLoc={setLoc}
            trang={trang}
            coTrang={coTrang}
            onDoiTrang={setTrang}
            onDoiCoTrang={(n) => {
              setCoTrang(n);
              setTrang(0);
            }}
            suaDuoc={suaNcc}
            onSuaEmail={(ncc) => moHopNcc(ncc, "email")}
            onThem={suaNcc && coDanhSach ? () => moHopNcc(null) : undefined}
            loi={qNcc.error && !qNcc.loading && !coDanhSach ? getApiErrorMessage(qNcc.error, "lỗi kết nối") : null}
            dangTai={qNcc.loading && qNcc.data === undefined}
            onThuLai={qNcc.reload}
          />
        }
        cotPhai={
          <ThuocTinhGuiBaoGia
            yc={yc}
            id={id}
            daChon={daChon}
            onBo={(ma) =>
              setChon((cu) => {
                const moi = new Set(cu);
                moi.delete(ma);
                return moi;
              })
            }
          />
        }
      />

      <HopXacNhanChungTu
        mo={hop}
        onDoiMo={(mo) => !mo && setHop(false)}
        tieuDe={`Gửi yêu cầu báo giá đến ${soVN(daChon.length)} nhà cung cấp?`}
        moTa={`Mỗi nhà cung cấp nhận một yêu cầu báo giá cho ${soVN(soBienThe)} biến thể của ${ma}. Sau khi gửi không thêm hay bỏ nhà cung cấp được nữa.`}
        nhanXacNhan="Gửi yêu cầu"
        iconXacNhan={Send}
        rong
        dangChay={dangGui}
        // Danh sách vừa tải lại bỏ hết nhà cung cấp đã chọn trong lúc hộp đang mở
        khoaXacNhan={!daChon.length || choGuiLai || thieu.length > 0}
        lyDoKhoa={
          !daChon.length
            ? "Không còn nhà cung cấp nào được chọn"
            : choGuiLai
              ? "Đang chờ máy chủ xử lý xong lần gửi trước"
              : thieu.length
                ? "Thông tin cửa hàng còn thiếu"
                : undefined
        }
        onXacNhan={gui}
      >
        <ul className={`${GHI_CHU_HOP} m-0 grid max-h-56 list-none gap-1 overflow-y-auto`}>
          {daChon.map((d) => (
            <li key={d.id} className="flex min-w-0 justify-between gap-3">
              <span className="min-w-0 truncate font-semibold text-bo-foreground">{d.ten}</span>
              <span className="min-w-0 truncate text-bo-muted">{d.email}</span>
            </li>
          ))}
        </ul>
      </HopXacNhanChungTu>

      {suaNcc ? (
        <SupplierFormDialog
          open={hopNcc.mo}
          onOpenChange={(mo) => !mo && setHopNcc((cu) => ({ ...cu, mo: false }))}
          supplier={hopNcc.supplier}
          oDauTien={hopNcc.oDauTien}
          onSaved={daLuuNcc}
        />
      ) : null}
    </PageContainer>
  );
}
