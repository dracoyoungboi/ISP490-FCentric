import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { KeyRound, ListRestart, Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
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
import LazadaConfigDialog from "@/components/channel/LazadaConfigDialog";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import StatusBadge from "@/components/shared/StatusBadge";
import { TheCaiDat, ThanhLuuTrenCung } from "@/components/channel/KhuonCaiDat";
import { SWITCH_CLASS } from "@/components/channel/SettingsCard";
import { TheDonHang, TheTonKho } from "@/components/channel/CauHinhDongBoCards";
import { daKetNoi, trangThaiKetNoi } from "@/components/channel/ketNoiShopify";
import { daKetNoiLazada, trangThaiKetNoiLazada } from "@/components/channel/ketNoiLazada";
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
import { trangThaiLa } from "@/constants/trangThaiChung";
import { isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { getApiErrorMessage } from "@/utils/apiError";

/**
 * Cấu hình gian hàng (Shopify / Lazada), bố cục lưới thẻ: thẻ Gian hàng một hàng ngang ở trên,
 * Tồn kho và Đơn hàng cạnh nhau bên dưới.
 * Có thay đổi thì thanh "Có thay đổi chưa lưu" hiện ở trên cùng; lưu một lần cho cả trang.
 */
export default function ChannelSettingsPage() {
  const location = useLocation();
  const isLazada = location.pathname.includes("/channels/lazada");
  const SAN = SAN_BAN_HANG.find((s) => s.maKenh === (isLazada ? "LAZADA" : "SHOPIFY")) ?? SAN_BAN_HANG[0];
  const TIEU_DE = `Cấu hình ${SAN.ten}`;

  const cfg = useTaiDuLieu(
    () => (isLazada ? kenhBanHangService.getLazadaConfig() : kenhBanHangService.getShopifyConfig()),
    isLazada ? "cau-hinh-lazada" : "cau-hinh-shopify",
  );
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo(SAN.maKenh), `cau-hinh-dong-bo-${SAN.maKenh}`);
  const ketNoi = isLazada ? daKetNoiLazada(cfg.data) : daKetNoi(cfg.data);
  const kho = useTaiDuLieu(() => kenhBanHangService.getKhoSan(SAN.maKenh).catch(() => []), `kho-san-${SAN.maKenh}`, { enabled: ketNoi });
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
      san={SAN}
      isLazada={isLazada}
      tieuDe={TIEU_DE}
      config={cfg.data}
      cauHinh={ch.data}
      khoSan={khoSan}
      onConfigSaved={cfg.setData}
      onCauHinhSaved={ch.setData}
    />
  );
}

function SettingsForm({ san, isLazada, tieuDe, config, cauHinh, khoSan, onConfigSaved, onCauHinhSaved }) {
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
          const dto = await kenhBanHangService.luuCauHinhDongBo(san.maKenh, taoPayloadCauHinh(values));
          onCauHinhSaved(dto);
          const moi = taoGiaTriCauHinh(dto);
          setValues(moi);
          setCheDo(cheDoTheoGiaTri(moi));
        }
        if (doiGianHang) {
          if (isLazada) {
            onConfigSaved(
              await kenhBanHangService.updateLazadaConfig({ appKey: config.appKey, trangThai: dongBoGianHang ? 1 : 0 }),
            );
          } else {
            onConfigSaved(
              await kenhBanHangService.updateShopifyConfig({ shopDomain: config.shopDomain, trangThai: dongBoGianHang ? 1 : 0 }),
            );
          }
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
        if (isLazada) {
          const res = await kenhBanHangService.testLazadaConnection({ appKey: config.appKey, accessToken: null });
          setKetQuaKetNoi(
            res?.connected
              ? { ok: true, text: ["Kết nối tốt", res.shopName].filter(Boolean).join(" · ") }
              : { ok: false, text: res?.message || "Kết nối thất bại" },
          );
        } else {
          const res = await kenhBanHangService.testShopifyConnection({ shopDomain: config.shopDomain, accessToken: null });
          setKetQuaKetNoi(
            res?.connected
              ? { ok: true, text: ["Kết nối tốt", res.shopName].filter(Boolean).join(" · ") }
              : { ok: false, text: res?.message || "Kết nối thất bại" },
          );
        }
      } catch (error) {
        setKetQuaKetNoi({ ok: false, text: getApiErrorMessage(error, "Không kiểm tra được kết nối") });
      }
    });

  const capLaiKhoa = () =>
    chay("cap-lai-khoa", async () => {
      try {
        const dto = isLazada
          ? await kenhBanHangService.refreshLazadaToken()
          : await kenhBanHangService.refreshShopifyToken();
        if (dto && typeof dto === "object") onConfigSaved(dto);
        toast.success("Đã cấp lại khóa truy cập");
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không cấp lại được khóa truy cập"));
      }
    });

  const khoa = Boolean(dangChay);

  const rawTrangThai = isLazada ? trangThaiKetNoiLazada(config) : trangThaiKetNoi(config);
  const tinhTrang = CONNECTION_STATUS[rawTrangThai] ?? trangThaiLa(rawTrangThai);
  const nutMenu = "cursor-pointer gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

  const tenHienThiGianHang = isLazada
    ? (config?.shopName || config?.sellerId ? `${config?.shopName || "Lazada Store"} (${config?.sellerId || ""})` : "Gian hàng Lazada")
    : (config?.shopDomain || "Chưa kết nối");

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <ListPageHeader title={tieuDe} />
        <MockModeNotice show={isChannelMock} />

        <TheCaiDat aria-label="Gian hàng">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-5">
            <div className="flex min-w-0 items-center gap-4">
              <ChannelLogo maKenh={san.maKenh} size={40} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-5 text-bo-heading">Gian hàng {san.ten}</p>
                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] leading-5 text-bo-muted">
                  <span className="truncate">{tenHienThiGianHang}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {isLazada ? (config?.accessTokenMasked ? `Token ${config.accessTokenMasked}` : "Chưa có token") : `Khóa ${config?.accessTokenMasked || "đã lưu"}`}
                  </span>
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
                      {dangChay === "cap-lai-khoa" ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                    <DropdownMenuItem onClick={() => setMoDoiKhoa(true)} className={nutMenu}>
                      <KeyRound className="size-4 text-bo-muted" />
                      Cập nhật thông tin kết nối
                    </DropdownMenuItem>
                    {config?.hasRefreshToken ? (
                      <DropdownMenuItem onClick={capLaiKhoa} className={nutMenu}>
                        <RefreshCw className="size-4 text-bo-muted" />
                        Cấp lại khóa
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem asChild className={nutMenu}>
                      <Link to={`${san.duongDan}/setup?buoc=1`}>
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
            moTa={`Số FCentric gửi lên ${san.ten}.`}
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
            moTa={`Đơn ${san.ten} thành đơn bán hàng để kho xử lý.`}
            values={values}
            onChange={doi}
            cauHinh={cauHinh}
            duongDanDoiChuKy="/settings/sync"
            disabled={khoa}
          />
        </div>
      </div>

      <ThanhLuuTrenCung hien={coThayDoi} dangLuu={dangChay === "luu"} khoa={khoa} onHuy={huyThayDoi} onLuu={luu} />

      {moDoiKhoa && isLazada ? (
        <LazadaConfigDialog
          open
          onOpenChange={setMoDoiKhoa}
          config={config}
          onSaved={(dto) => {
            onConfigSaved(dto);
            setMoDoiKhoa(false);
            setKetQuaKetNoi(null);
            toast.success("Đã cập nhật thông tin kết nối Lazada");
          }}
        />
      ) : moDoiKhoa ? (
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
