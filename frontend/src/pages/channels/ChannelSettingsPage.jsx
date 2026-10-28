import { useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { KeyRound, ListRestart, Loader2, MoreHorizontal, RefreshCw, Unplug } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import ConfirmModal from "@/components/ui/confirm-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelLogo from "@/components/channel/ChannelLogo";
import ShopifyConfigDialog from "@/components/channel/ShopifyConfigDialog";
import KhoaUngDungDialog from "@/components/channel/KhoaUngDungDialog";
import TheGianHangUyQuyen from "@/components/channel/TheGianHangUyQuyen";
import DongKhoSan from "@/components/channel/DongKhoSan";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import StatusBadge from "@/components/shared/StatusBadge";
import { TheCaiDat, ThanhLuuTrenCung, VUNG_CHAM_CONG_TAC } from "@/components/channel/KhuonCaiDat";
import { SWITCH_CLASS } from "@/components/channel/SettingsCard";
import { TheDonHang, TheTonKho } from "@/components/channel/CauHinhDongBoCards";
import { daKetNoi, giuTenMienDangHien, hoTroNgatKetNoi, moTaNgatKetNoi, trangThaiKetNoi } from "@/components/channel/ketNoiKenh";
import { khoDaLuuKhongCon, khoSanDangChon, noiDungSan } from "@/components/channel/noiDungSan";
import { xoaLuaChonThietLap } from "@/components/channel/luaChonThietLap";
import { taiLaiKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import { cauLoiUyQuyen, moTrangUyQuyen } from "@/components/channel/uyQuyen";
import useSanHienTai from "@/components/channel/useSanHienTai";
import {
  QUY_TAC_MAC_DINH,
  cheDoTheoGiaTri,
  coThayDoiCauHinh,
  kiemTraCauHinh,
  taoGiaTriCauHinh,
  taoPayloadCauHinh,
  tenDiaDiemNhanTon,
} from "@/components/channel/cauHinhDongBo";
import { CONNECTION_STATUS } from "@/constants/channel";
import { trangThaiLa } from "@/constants/trangThaiChung";
import { GHI_CHU_DU_LIEU_MAU_KENH, isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useHoiKhiRoiTrang from "@/hooks/useHoiKhiRoiTrang";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";

/**
 * Mã lỗi máy chủ trả khi gian hàng không còn gọi được sàn: đọc lại kết nối để trang hiện đúng tình trạng.
 * LAM_MOI_KHOA_LOI: Shopify từ chối khóa làm mới, thẻ chuyển sang "Hết hạn khóa".
 */
const MA_MAT_KET_NOI = new Set(["UY_QUYEN_HET_HAN", "KENH_CHUA_KET_NOI", "LAM_MOI_KHOA_LOI"]);

/**
 * Cấu hình gian hàng của sàn đang mở, bố cục lưới thẻ: thẻ Gian hàng một hàng ngang ở trên,
 * Tồn kho và Đơn hàng cạnh nhau bên dưới.
 * Có thay đổi thì thanh "Có thay đổi chưa lưu" hiện ở trên cùng; lưu một lần cho cả trang.
 * Sàn ủy quyền (Lazada, TikTok Shop): thẻ Gian hàng có hạn ủy quyền, menu ủy quyền lại / khóa ứng dụng / ngắt kết nối,
 * thẻ Tồn kho có kho trên sàn (KH mục B.8). Shopify cũng ngắt kết nối được từ menu ⋯ của thẻ Gian hàng.
 */
export default function ChannelSettingsPage() {
  const SAN = useSanHienTai();
  const TIEU_DE = `Cấu hình ${SAN.ten}`;
  const cfg = useTaiDuLieu(() => kenhBanHangService.getKetNoi(SAN.maKenh), `ket-noi|${SAN.maKenh}`);
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo(SAN.maKenh), `cau-hinh-dong-bo|${SAN.maKenh}`);
  const ketNoi = daKetNoi(cfg.data);
  // Shopify: lỗi đọc địa điểm thì coi như chưa có (như trước); sàn ủy quyền: giữ lỗi để ô chọn kho có Thử lại
  const kho = useTaiDuLieu(
    () => kenhBanHangService.getKhoSan(SAN.maKenh).catch((error) => (SAN.kieuKetNoi === "uy_quyen" ? Promise.reject(error) : [])),
    `kho-san|${SAN.maKenh}`,
    { enabled: ketNoi },
  );
  const khoSan = tenDiaDiemNhanTon(kho);

  if (cfg.initialLoading || ch.initialLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-4">
          <ListPageHeader title={TIEU_DE} />
          <LoadingState label="Đang tải cấu hình" />
        </div>
      </PageContainer>
    );
  }
  if ((!cfg.data && cfg.error) || (!ch.data && ch.error)) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-4">
          <ListPageHeader title={TIEU_DE} />
          <ErrorState
            description="Không tải được cấu hình gian hàng. Vui lòng thử lại."
            onRetry={() => {
              cfg.reload();
              ch.reload();
            }}
          />
        </div>
      </PageContainer>
    );
  }
  // Chưa kết nối: Shopify vào thẳng Thiết lập như trước; sàn ủy quyền về màn giới thiệu 4 bước (KH mục B.5)
  if (!ketNoi) return <Navigate to={SAN.kieuKetNoi === "uy_quyen" ? SAN.duongDan : `${SAN.duongDan}/setup`} replace />;

  return (
    <SettingsForm
      // Thẻ khác vừa kết nối cửa hàng khác: dựng lại form, công tắc và kết quả kiểm tra không còn là của cửa hàng cũ
      key={cfg.data?.shopDomain || SAN.maKenh}
      config={cfg.data}
      cauHinh={ch.data}
      khoSan={khoSan}
      dsKhoSan={kho}
      onConfigSaved={cfg.setData}
      onCauHinhSaved={ch.setData}
      onTaiLaiKetNoi={cfg.reload}
    />
  );
}

function SettingsForm({ config, cauHinh, khoSan, dsKhoSan, onConfigSaved, onCauHinhSaved, onTaiLaiKetNoi }) {
  const SAN = useSanHienTai();
  const TIEU_DE = `Cấu hình ${SAN.ten}`;
  const navigate = useNavigate();
  const uyQuyen = SAN.kieuKetNoi === "uy_quyen";
  const noiDung = noiDungSan(SAN.maKenh);
  const [values, setValues] = useState(() => taoGiaTriCauHinh(cauHinh));
  const [cheDo, setCheDo] = useState(() => cheDoTheoGiaTri(taoGiaTriCauHinh(cauHinh)));
  const [errors, setErrors] = useState({});
  const [dongBoGianHang, setDongBoGianHang] = useState(() => Number(config?.trangThai) === 1);
  const [maKhoSan, setMaKhoSan] = useState(null);
  const [ketQuaKetNoi, setKetQuaKetNoi] = useState(null);
  const [moDoiKhoa, setMoDoiKhoa] = useState(false);
  const [hoiNgat, setHoiNgat] = useState(false);
  // Rời trang khi còn thay đổi chưa lưu: hàm đi tiếp chờ người dùng xác nhận
  const [hoiRoi, setHoiRoi] = useState(null);
  const [dangChay, setDangChay] = useState(null);
  const dangChayRef = useRef(null);
  // Mục menu Shopify mở hộp xác nhận: chạy sau khi menu đóng hẳn (như TheGianHangUyQuyen). Tự đặt tiêu điểm về nút ⋯
  // trước khi mở hộp, để hộp không nhận "tiêu điểm ra ngoài" rồi tự đóng và đóng hộp thì tiêu điểm quay lại nút này
  const viecSauMenuRef = useRef(null);
  const nutMenuRef = useRef(null);

  // Kho trên sàn (sàn ủy quyền): ô chọn hiện kho đã lưu, chưa lưu thì kho mặc định của sàn. Kho đã lưu không còn trên
  // sàn thì ô chọn hiện kho mặc định và coi là thay đổi cần lưu (Radix Select không báo khi chọn lại đúng kho đang hiện)
  const khoDangLuu = khoSanDangChon(config?.maKhoSan, dsKhoSan?.data);
  const khoMat = uyQuyen && khoDaLuuKhongCon(config?.maKhoSan, dsKhoSan?.data);
  const khoChon = maKhoSan ?? (khoMat ? khoDangLuu : null);
  const doiKho = uyQuyen && Boolean(khoChon) && khoChon !== (config?.maKhoSan ?? khoDangLuu);
  const doiGianHang = dongBoGianHang !== (Number(config?.trangThai) === 1);
  const doiCauHinh = coThayDoiCauHinh(values, cauHinh);
  const coThayDoi = doiGianHang || doiCauHinh || doiKho;

  // Còn thay đổi chưa lưu: đóng tab / tải lại trang hỏi bằng hộp của trình duyệt; bấm menu trái, link trong trang,
  // Back / Forward thì hỏi bằng ConfirmModal bên dưới
  useHoiKhiRoiTrang(coThayDoi, (tiepTuc) => setHoiRoi(() => tiepTuc));

  // Máy chủ báo hết hạn / mất kết nối: đọc lại để thẻ Gian hàng và menu trái hiện đúng tình trạng
  const khiMatKetNoi = (error) => {
    if (!MA_MAT_KET_NOI.has(getApiErrorCode(error))) return;
    onTaiLaiKetNoi();
    taiLaiKenhDaKetNoi();
  };

  const chay = async (ten, viec) => {
    if (dangChayRef.current) return;
    dangChayRef.current = ten;
    setDangChay(ten);
    let giuKhoa = false;
    try {
      // Việc trả true: trang đang chuyển sang sàn (ủy quyền lại), giữ khóa thêm một lúc rồi nhả — người dùng chọn
      // ở lại (đang có thay đổi chưa lưu) hoặc bấm Back về trang trình duyệt giữ nguyên thì trang không bị kẹt khóa
      giuKhoa = Boolean(await viec());
    } finally {
      if (giuKhoa) {
        window.setTimeout(() => {
          dangChayRef.current = null;
          setDangChay(null);
        }, 4000);
      } else {
        dangChayRef.current = null;
        setDangChay(null);
      }
    }
  };

  const doi = (name, value) => {
    setValues((cu) => ({ ...cu, [name]: value }));
    setErrors((cu) => ({ ...cu, [name]: undefined }));
  };

  // "Bằng số khả dụng" = 100%, không giữ lại, không ngưỡng; chọn lại "Tùy chỉnh" thì sửa từ các số đó
  const doiCheDo = (moi) => {
    setCheDo(moi);
    if (moi === "bang") {
      setValues((cu) => ({ ...cu, ...QUY_TAC_MAC_DINH }));
      setErrors({});
    }
  };

  const huyThayDoi = () => {
    const goc = taoGiaTriCauHinh(cauHinh);
    setValues(goc);
    setCheDo(cheDoTheoGiaTri(goc));
    setErrors({});
    setDongBoGianHang(Number(config?.trangThai) === 1);
    setMaKhoSan(null);
  };

  const luu = () =>
    chay("luu", async () => {
      const loi = kiemTraCauHinh(values);
      setErrors(loi);
      if (Object.keys(loi).length) {
        setCheDo("tuy");
        toast.error("Kiểm tra lại các ô đang báo lỗi.");
        return;
      }
      try {
        if (doiCauHinh) {
          const goc = taoGiaTriCauHinh(cauHinh);
          const doiTuDong = values.tuDongDayTon !== goc.tuDongDayTon || values.tuDongLayDon !== goc.tuDongLayDon;
          const dto = await kenhBanHangService.luuCauHinhDongBo(SAN.maKenh, taoPayloadCauHinh(values));
          // Người dùng tự đặt công tắc tự động ở đây: bỏ lựa chọn còn chờ "Hoàn tất" của Thiết lập (nếu có)
          if (doiTuDong) xoaLuaChonThietLap(SAN.maKenh);
          onCauHinhSaved(dto);
          const moi = taoGiaTriCauHinh(dto);
          setValues(moi);
          setCheDo(cheDoTheoGiaTri(moi));
        }
        if (doiKho) {
          const kho = dsKhoSan?.data?.find((k) => k.maKhoSan === khoChon);
          const khoMoi = { maKhoSan: khoChon, tenKhoSan: kho?.tenKhoSan ?? null };
          await kenhBanHangService.luuCaiDatKenh(SAN.maKenh, khoMoi);
          // PUT cai-dat không trả KetNoiKenhDto: gộp kho vừa lưu vào kết nối đang có
          onConfigSaved((cu) => ({ ...cu, ...khoMoi }));
          setMaKhoSan(null);
        }
        if (doiGianHang) {
          const dto = uyQuyen
            ? await kenhBanHangService.luuKhoaUngDung(SAN.maKenh, { trangThai: dongBoGianHang ? 1 : 0 })
            : await kenhBanHangService.updateShopifyConfig({ shopDomain: config.shopDomain, trangThai: dongBoGianHang ? 1 : 0 });
          // Máy chủ không trả kết nối: đọc lại thay vì xóa thông tin đang hiện
          if (dto && typeof dto === "object") onConfigSaved(dto);
          else onTaiLaiKetNoi();
        }
        toast.success("Đã lưu cấu hình");
      } catch (error) {
        // Chỉ gạt công tắc mà máy chủ báo đang nối cửa hàng khác: thẻ khác vừa đổi cửa hàng, câu "muốn đổi cửa hàng…"
        // của máy chủ không đúng việc người dùng đang làm
        const doiNoiKhac = getApiErrorCode(error) === "GIAN_HANG_KHAC";
        toast.error(
          doiNoiKhac
            ? `Gian hàng ${SAN.ten} vừa được đổi ở nơi khác. Trang đã tải lại, kiểm tra rồi lưu lại.`
            : getApiErrorMessage(error, "Không lưu được cấu hình"),
        );
        // Lưu dở (vd. cấu hình xong, kho lỗi): đọc lại kết nối để công tắc và kho hiện đúng giá trị trên máy chủ
        if (doiKho || doiGianHang) onTaiLaiKetNoi();
        if (doiNoiKhac) taiLaiKenhDaKetNoi();
        khiMatKetNoi(error);
      }
    });

  /**
   * Kiểm tra không qua có thể do ủy quyền vừa hết hạn hoặc kênh vừa bị ngắt ở thẻ khác: đọc lại kết nối để thẻ và thanh
   * nhắc hiện đúng. Đã ngắt thì trang chuyển đi, câu kết quả mất theo, nên báo bằng toast và đọc lại menu bên trái.
   */
  const docLaiSauKiemTra = async () => {
    const moi = await kenhBanHangService.getKetNoi(SAN.maKenh).catch(() => null);
    if (!moi) return;
    if (!daKetNoi(moi)) {
      toast.error(`${SAN.ten} chưa kết nối. Kết nối lại ở trình thiết lập rồi thử lại.`);
      taiLaiKenhDaKetNoi();
    }
    onConfigSaved(moi);
  };

  const kiemTraKetNoi = () =>
    chay("kiem-tra", async () => {
      setKetQuaKetNoi(null);
      try {
        if (uyQuyen) {
          const res = await kenhBanHangService.kiemTraKetNoi(SAN.maKenh);
          // Không ghi hạn của khóa truy cập: hệ thống tự làm mới, người dùng chỉ cần biết hạn ủy quyền (đã có ở dòng trên)
          setKetQuaKetNoi(res?.connected ? { ok: true, text: "Kết nối tốt" } : { ok: false, text: res?.message || "Kết nối thất bại" });
          if (!res?.connected) await docLaiSauKiemTra();
          return;
        }
        const res = await kenhBanHangService.testShopifyConnection({ shopDomain: config.shopDomain, accessToken: null });
        setKetQuaKetNoi(
          res?.connected
            ? { ok: true, text: ["Kết nối tốt", res.shopName].filter(Boolean).join(" · ") }
            : { ok: false, text: res?.message || "Kết nối thất bại" },
        );
        if (!res?.connected) await docLaiSauKiemTra();
      } catch (error) {
        setKetQuaKetNoi({ ok: false, text: getApiErrorMessage(error, "Không kiểm tra được kết nối") });
        khiMatKetNoi(error);
      }
    });

  const capLaiKhoa = () =>
    chay("cap-lai-khoa", async () => {
      try {
        const dto = await kenhBanHangService.refreshShopifyToken();
        if (dto && typeof dto === "object") onConfigSaved(dto);
        toast.success("Đã cấp lại khóa truy cập");
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không cấp lại được khóa truy cập"));
        // Tab khác vừa ngắt kết nối: đọc lại để trang về Thiết lập
        khiMatKetNoi(error);
      }
    });

  /**
   * Ủy quyền lại: mở trang đồng ý của sàn, giữ nguyên cấu hình (trang quay về báo gia hạn rồi về Tổng quan).
   * Còn thay đổi chưa lưu thì không mở: cả trang chuyển sang sàn, thay đổi sẽ mất.
   */
  const uyQuyenLai = () => {
    if (coThayDoi) {
      toast.error("Lưu hoặc hủy thay đổi trước khi ủy quyền lại.");
      return;
    }
    chay("uy-quyen", async () => {
      try {
        await moTrangUyQuyen(SAN, { uyQuyenLai: true });
        return true;
      } catch (error) {
        toast.error(cauLoiUyQuyen(error, `Không mở được trang ủy quyền của ${SAN.ten}`));
        return false;
      }
    });
  };

  const ngatKetNoi = () =>
    chay("ngat", async () => {
      try {
        await kenhBanHangService.ngatKetNoi(SAN.maKenh);
        xoaLuaChonThietLap(SAN.maKenh);
        setHoiNgat(false);
        taiLaiKenhDaKetNoi();
        toast.success(`Đã ngắt kết nối ${SAN.ten}`);
        // Gian hàng đã về "Chưa kết nối": Tổng quan hiện màn giới thiệu để kết nối lại
        navigate(SAN.duongDan, { replace: true });
      } catch (error) {
        toast.error(getApiErrorMessage(error, `Không ngắt được kết nối ${SAN.ten}`));
      }
    });

  const khoa = Boolean(dangChay);

  const tinhTrang = CONNECTION_STATUS[trangThaiKetNoi(config)] ?? trangThaiLa(trangThaiKetNoi(config));
  const nutMenu = "cursor-pointer gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

  // Bố cục B (lưới thẻ): cùng khung với Sản phẩm, Đơn hàng; thẻ Gian hàng một hàng ngang;
  // Tồn kho và Đơn hàng cạnh nhau, cao bằng nhau (dưới 1280 px xếp chồng)
  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <ListPageHeader title={TIEU_DE} />
        <MockModeNotice show={isChannelMock} note={GHI_CHU_DU_LIEU_MAU_KENH} />

        {uyQuyen ? (
          <TheGianHangUyQuyen
            san={SAN}
            ketNoi={config}
            dongBoGianHang={dongBoGianHang}
            onDoiDongBo={setDongBoGianHang}
            khoa={khoa}
            dangChay={dangChay}
            ketQuaKetNoi={ketQuaKetNoi}
            onKiemTra={kiemTraKetNoi}
            onUyQuyenLai={uyQuyenLai}
            onCapNhatKhoa={() => setMoDoiKhoa(true)}
            onNgatKetNoi={() => setHoiNgat(true)}
          />
        ) : (
          <TheCaiDat aria-label="Gian hàng">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-5">
              <div className="flex min-w-0 items-center gap-4">
                <ChannelLogo maKenh={SAN.maKenh} size={40} />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-5 text-bo-heading">Gian hàng {SAN.ten}</p>
                  {/* Điện thoại: mỗi ý một dòng, không có dấu "·" treo cuối dòng (như thẻ của sàn ủy quyền) */}
                  <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] leading-5 text-bo-muted max-sm:flex-col max-sm:items-start">
                    <span className="truncate">{config.shopDomain}</span>
                    <span aria-hidden="true" className="max-sm:hidden">
                      ·
                    </span>
                    <span className="tabular-nums">Khóa {config.accessTokenMasked || "đã lưu"}</span>
                  </p>
                  {ketQuaKetNoi ? (
                    <p role="status" className="mt-1">
                      <TrangThaiCham label={ketQuaKetNoi.text} tone={ketQuaKetNoi.ok ? "success" : "danger"} />
                    </p>
                  ) : null}
                </div>
              </div>
              <span aria-hidden="true" className="hidden h-10 w-px bg-[#eef1f5] md:block" />
              <StatusBadge label={tinhTrang.label} />

              {/* Cụm bên phải: hẹp ngang thì cả cụm xuống hàng dưới, vẫn nằm bên phải */}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-3">
                <div className="flex items-center gap-3" title="Tắt để tạm dừng mọi việc tự động">
                  <label htmlFor="dong-bo-gian-hang" className="cursor-pointer text-sm font-medium text-bo-heading">
                    Đồng bộ với gian hàng này
                  </label>
                  <Switch
                    id="dong-bo-gian-hang"
                    checked={dongBoGianHang}
                    onCheckedChange={setDongBoGianHang}
                    disabled={khoa}
                    aria-describedby="dong-bo-gian-hang-mo-ta"
                    className={cn(SWITCH_CLASS, VUNG_CHAM_CONG_TAC)}
                  />
                  <span id="dong-bo-gian-hang-mo-ta" className="sr-only">
                    Tắt để tạm dừng mọi việc tự động.
                  </span>
                </div>
                <span aria-hidden="true" className="hidden h-10 w-px bg-[#eef1f5] md:block" />

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={khoa}
                    onClick={kiemTraKetNoi}
                    className="h-8 gap-2 rounded-lg border-bo-border bg-bo-surface px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11"
                  >
                    {dangChay === "kiem-tra" ? <Loader2 className="size-4 animate-spin" /> : null}
                    Kiểm tra kết nối
                  </Button>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        ref={nutMenuRef}
                        type="button"
                        variant="ghost"
                        disabled={khoa}
                        aria-label="Thao tác khác với gian hàng"
                        className="size-8 rounded-lg p-0 text-bo-muted hover:bg-slate-100 hover:text-bo-foreground max-sm:size-11"
                      >
                        {dangChay === "cap-lai-khoa" || dangChay === "ngat" ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-60 z-50 rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
                      onCloseAutoFocus={(event) => {
                        const viec = viecSauMenuRef.current;
                        if (!viec) return;
                        viecSauMenuRef.current = null;
                        event.preventDefault();
                        nutMenuRef.current?.focus();
                        viec();
                      }}
                    >
                      <DropdownMenuItem onClick={() => setMoDoiKhoa(true)} className={nutMenu}>
                        <KeyRound className="size-4 text-bo-muted" />
                        Cập nhật khóa truy cập
                      </DropdownMenuItem>
                      {config.hasRefreshToken ? (
                        <DropdownMenuItem onClick={capLaiKhoa} className={nutMenu}>
                          <RefreshCw className="size-4 text-bo-muted" />
                          Cấp lại khóa
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem asChild className={nutMenu}>
                        <Link to={`${SAN.duongDan}/setup?buoc=1`}>
                          <ListRestart className="size-4 text-bo-muted" />
                          Chạy lại trình thiết lập
                        </Link>
                      </DropdownMenuItem>
                      {/* Máy chủ cũ chưa có DELETE ket-noi: không hiện mục bấm vào chỉ để báo lỗi */}
                      {hoTroNgatKetNoi(config) ? (
                        <>
                          <DropdownMenuSeparator className="bg-bo-border" />
                          <DropdownMenuItem
                            onSelect={() => {
                              viecSauMenuRef.current = () => setHoiNgat(true);
                            }}
                            className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-sm text-bo-danger focus:bg-bo-danger-soft focus:text-bo-danger-strong"
                          >
                            <Unplug className="size-4" />
                            Ngắt kết nối
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </TheCaiDat>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <TheTonKho
            moTa={`Số FCentric gửi lên ${SAN.ten}.`}
            values={values}
            errors={errors}
            onChange={doi}
            cheDo={cheDo}
            onDoiCheDo={doiCheDo}
            cauHinh={cauHinh}
            khoSan={khoSan}
            disabled={khoa}
            tenSan={SAN.ten}
            dongKho={
              uyQuyen ? (
                <DongKhoSan
                  maKenh={SAN.maKenh}
                  tenSan={SAN.ten}
                  khoSan={dsKhoSan}
                  value={maKhoSan ?? khoDangLuu}
                  maKhoDaLuu={config?.maKhoSan}
                  onChange={setMaKhoSan}
                  disabled={khoa}
                />
              ) : undefined
            }
            ghiChu={noiDung?.ghiChuTon}
          />
          <TheDonHang
            moTa={`Đơn ${SAN.ten} thành đơn bán hàng để kho xử lý.`}
            values={values}
            onChange={doi}
            cauHinh={cauHinh}
            duongDanDoiChuKy="/settings/sync"
            disabled={khoa}
            tenSan={SAN.ten}
            tienToDon={SAN.tienToDon}
            nhanCongTac={uyQuyen ? `Tự động lấy đơn từ ${SAN.ten}` : undefined}
            khachMacDinh={noiDung?.khachMacDinh}
            ghiChu={noiDung?.ghiChuDon}
          />
        </div>
      </div>

      <ThanhLuuTrenCung hien={coThayDoi} dangLuu={dangChay === "luu"} khoa={khoa} onHuy={huyThayDoi} onLuu={luu} />

      {moDoiKhoa && !uyQuyen ? (
        <ShopifyConfigDialog
          open
          onOpenChange={setMoDoiKhoa}
          config={config}
          onSaved={(dto) => {
            onConfigSaved(dto);
            setMoDoiKhoa(false);
            setKetQuaKetNoi(null);
            toast.success("Đã cập nhật khóa truy cập");
          }}
          // Tab khác vừa ngắt / kết nối cửa hàng khác: đóng hộp, báo bằng toast (trang có thể chuyển sang Thiết lập)
          // rồi đọc lại kết nối và menu bên trái
          onDoiKetNoi={(error, payload) => {
            setMoDoiKhoa(false);
            // GIAN_HANG_KHAC mà tên miền gửi đi vẫn là tên miền đang hiện (người dùng không đổi cửa hàng): câu của máy
            // chủ ("muốn đổi cửa hàng thì ngắt kết nối…") không đúng việc đang làm, báo như khi lưu cấu hình. Người
            // dùng tự gõ tên miền khác thì câu của máy chủ là đúng
            toast.error(
              getApiErrorCode(error) === "GIAN_HANG_KHAC" && giuTenMienDangHien(payload, config)
                ? `Gian hàng ${SAN.ten} vừa được đổi ở nơi khác. Trang đã tải lại, kiểm tra rồi cập nhật khóa lại.`
                : getApiErrorMessage(error, "Không lưu được khóa truy cập"),
            );
            onTaiLaiKetNoi();
            taiLaiKenhDaKetNoi();
          }}
        />
      ) : null}

      {moDoiKhoa && uyQuyen ? (
        <KhoaUngDungDialog
          open
          onOpenChange={setMoDoiKhoa}
          san={SAN}
          ketNoi={config}
          onSaved={(dto) => {
            // Đổi App Key thì ủy quyền cũ không còn dùng được (máy chủ chuyển sang hết hạn): nhắc ủy quyền lại ngay
            const doiAppKey = Boolean(dto?.appKey) && dto.appKey !== config?.appKey;
            if (dto && typeof dto === "object") onConfigSaved(dto);
            else onTaiLaiKetNoi();
            setMoDoiKhoa(false);
            setKetQuaKetNoi(null);
            taiLaiKenhDaKetNoi();
            toast.success(
              "Đã cập nhật khóa ứng dụng",
              doiAppKey
                ? { description: `Đổi App Key thì cần ủy quyền lại với ${SAN.ten}.`, action: { label: "Ủy quyền lại", onClick: uyQuyenLai } }
                : undefined,
            );
          }}
        />
      ) : null}

      <ConfirmModal
        isOpen={Boolean(hoiRoi)}
        onClose={() => setHoiRoi(null)}
        onConfirm={() => {
          const tiepTuc = hoiRoi;
          setHoiRoi(null);
          tiepTuc?.();
        }}
        variant="warning"
        title="Rời trang khi chưa lưu?"
        description="Các thay đổi cấu hình chưa lưu sẽ mất."
        confirmText="Rời trang"
        cancelText="Ở lại"
      />

      <ConfirmModal
        isOpen={hoiNgat}
        onClose={() => dangChay !== "ngat" && setHoiNgat(false)}
        onConfirm={ngatKetNoi}
        isLoading={dangChay === "ngat"}
        variant="danger"
        title={`Ngắt kết nối ${SAN.ten}?`}
        description={moTaNgatKetNoi(SAN, config)}
        confirmText="Ngắt kết nối"
        cancelText="Hủy bỏ"
      />
    </PageContainer>
  );
}
