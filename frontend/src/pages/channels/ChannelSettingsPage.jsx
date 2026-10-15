import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { KeyRound, ListRestart, Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelLogo from "@/components/channel/ChannelLogo";
import ShopifyConfigDialog from "@/components/channel/ShopifyConfigDialog";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { TheCaiDat, ThanhLuuTrenCung } from "@/components/channel/KhuonCaiDat";
import { SWITCH_CLASS } from "@/components/channel/SettingsCard";
import { TheDonHang, TheTonKho } from "@/components/channel/CauHinhDongBoCards";
import { daKetNoi, trangThaiKetNoi } from "@/components/channel/ketNoiShopify";
import {
  QUY_TAC_MAC_DINH,
  cheDoTheoGiaTri,
  coThayDoiCauHinh,
  kiemTraCauHinh,
  taoGiaTriCauHinh,
  taoPayloadCauHinh,
  tenDiaDiemNhanTon,
} from "@/components/channel/cauHinhDongBo";
import { CONNECTION_STATUS, SAN_BAN_HANG } from "@/constants/channel";
import { isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { getApiErrorMessage } from "@/utils/apiError";

const SAN = SAN_BAN_HANG.find((s) => s.maKenh === "SHOPIFY");
const TIEU_DE = `Cấu hình ${SAN.ten}`;

/**
 * Cấu hình gian hàng Shopify, bố cục lưới thẻ: thẻ Gian hàng một hàng ngang ở trên,
 * Tồn kho và Đơn hàng cạnh nhau bên dưới.
 * Có thay đổi thì thanh "Có thay đổi chưa lưu" hiện ở trên cùng; lưu một lần cho cả trang.
 */
export default function ChannelSettingsPage() {
  const cfg = useTaiDuLieu(() => kenhBanHangService.getShopifyConfig(), "cau-hinh-shopify");
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo(SAN.maKenh), "cau-hinh-dong-bo");
  const ketNoi = daKetNoi(cfg.data);
  const kho = useTaiDuLieu(() => kenhBanHangService.getKhoSan(SAN.maKenh).catch(() => []), "kho-san", { enabled: ketNoi });
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
  if (!ketNoi) return <Navigate to={`${SAN.duongDan}/setup`} replace />;

  return (
    <SettingsForm
      config={cfg.data}
      cauHinh={ch.data}
      khoSan={khoSan}
      onConfigSaved={cfg.setData}
      onCauHinhSaved={ch.setData}
    />
  );
}

function SettingsForm({ config, cauHinh, khoSan, onConfigSaved, onCauHinhSaved }) {
  const [values, setValues] = useState(() => taoGiaTriCauHinh(cauHinh));
  const [cheDo, setCheDo] = useState(() => cheDoTheoGiaTri(taoGiaTriCauHinh(cauHinh)));
  const [errors, setErrors] = useState({});
  const [dongBoGianHang, setDongBoGianHang] = useState(() => Number(config?.trangThai) === 1);
  const [ketQuaKetNoi, setKetQuaKetNoi] = useState(null);
  const [moDoiKhoa, setMoDoiKhoa] = useState(false);
  const [dangChay, setDangChay] = useState(null);
  const dangChayRef = useRef(null);

  const doiGianHang = dongBoGianHang !== (Number(config?.trangThai) === 1);
  const doiCauHinh = coThayDoiCauHinh(values, cauHinh);
  const coThayDoi = doiGianHang || doiCauHinh;

  // Nhắc khi đóng tab / tải lại trang lúc còn thay đổi chưa lưu
  useEffect(() => {
    if (!coThayDoi) return undefined;
    const chan = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", chan);
    return () => window.removeEventListener("beforeunload", chan);
  }, [coThayDoi]);

  const chay = async (ten, viec) => {
    if (dangChayRef.current) return;
    dangChayRef.current = ten;
    setDangChay(ten);
    try {
      await viec();
    } finally {
      dangChayRef.current = null;
      setDangChay(null);
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
          const dto = await kenhBanHangService.luuCauHinhDongBo(SAN.maKenh, taoPayloadCauHinh(values));
          onCauHinhSaved(dto);
          const moi = taoGiaTriCauHinh(dto);
          setValues(moi);
          setCheDo(cheDoTheoGiaTri(moi));
        }
        if (doiGianHang) {
          onConfigSaved(
            await kenhBanHangService.updateShopifyConfig({ shopDomain: config.shopDomain, trangThai: dongBoGianHang ? 1 : 0 }),
          );
        }
        toast.success("Đã lưu cấu hình");
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không lưu được cấu hình"));
      }
    });

  const kiemTraKetNoi = () =>
    chay("kiem-tra", async () => {
      setKetQuaKetNoi(null);
      try {
        const res = await kenhBanHangService.testShopifyConnection({ shopDomain: config.shopDomain, accessToken: null });
        setKetQuaKetNoi(
          res?.connected
            ? { ok: true, text: ["Kết nối tốt", res.shopName].filter(Boolean).join(" · ") }
            : { ok: false, text: res?.message || "Kết nối thất bại" },
        );
      } catch (error) {
        setKetQuaKetNoi({ ok: false, text: getApiErrorMessage(error, "Không kiểm tra được kết nối") });
      }
    });

  const lamMoiToken = () =>
    chay("lam-moi", async () => {
      try {
        const dto = await kenhBanHangService.refreshShopifyToken();
        if (dto && typeof dto === "object") onConfigSaved(dto);
        toast.success("Đã làm mới khóa truy cập");
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không làm mới được khóa truy cập"));
      }
    });

  const khoa = Boolean(dangChay);

  const tinhTrang = CONNECTION_STATUS[trangThaiKetNoi(config)] ?? CONNECTION_STATUS.dang_hoat_dong;
  const nutMenu = "cursor-pointer gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

  // Bố cục B (lưới thẻ): cùng khung với Sản phẩm, Đơn hàng; thẻ Gian hàng một hàng ngang;
  // Tồn kho và Đơn hàng cạnh nhau, cao bằng nhau (dưới 1280 px xếp chồng)
  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <ListPageHeader title={TIEU_DE} />
        <MockModeNotice show={isChannelMock} />

        <TheCaiDat aria-label="Gian hàng">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-5">
            <div className="flex min-w-0 items-center gap-4">
              <ChannelLogo maKenh={SAN.maKenh} size={40} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-5 text-bo-heading">Gian hàng {SAN.ten}</p>
                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] leading-5 text-bo-muted">
                  <span className="truncate">{config.shopDomain}</span>
                  <span aria-hidden="true">·</span>
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
            <TrangThaiCham label={tinhTrang.label} tone={tinhTrang.tone} />

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
                  className={SWITCH_CLASS}
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
                  className="h-8 gap-2 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle"
                >
                  {dangChay === "kiem-tra" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Kiểm tra kết nối
                </Button>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={khoa}
                      aria-label="Thao tác khác với gian hàng"
                      className="size-8 rounded-lg p-0 text-bo-muted hover:bg-slate-100 hover:text-bo-foreground"
                    >
                      {dangChay === "lam-moi" ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 backoffice-user-menu z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                    <DropdownMenuItem onClick={() => setMoDoiKhoa(true)} className={nutMenu}>
                      <KeyRound className="size-4 text-bo-muted" />
                      Cập nhật khóa truy cập
                    </DropdownMenuItem>
                    {config.hasRefreshToken ? (
                      <DropdownMenuItem onClick={lamMoiToken} className={nutMenu}>
                        <RefreshCw className="size-4 text-bo-muted" />
                        Làm mới khóa
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem asChild className={nutMenu}>
                      <Link to={`${SAN.duongDan}/setup?buoc=1`}>
                        <ListRestart className="size-4 text-bo-muted" />
                        Chạy lại trình thiết lập
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </TheCaiDat>

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
          />
          <TheDonHang
            moTa={`Đơn ${SAN.ten} thành đơn bán hàng để kho xử lý.`}
            values={values}
            onChange={doi}
            cauHinh={cauHinh}
            duongDanDoiChuKy="/settings/inventory"
            disabled={khoa}
          />
        </div>
      </div>

      <ThanhLuuTrenCung hien={coThayDoi} dangLuu={dangChay === "luu"} khoa={khoa} onHuy={huyThayDoi} onLuu={luu} />

      {moDoiKhoa ? (
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
        />
      ) : null}
    </PageContainer>
  );
}
