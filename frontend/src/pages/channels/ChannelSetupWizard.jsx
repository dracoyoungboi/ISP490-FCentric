import { useId, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import SetupStepper from "@/components/channel/SetupStepper";
import KetNoiShopifyForm from "@/components/channel/KetNoiShopifyForm";
import KetNoiUyQuyenForm from "@/components/channel/KetNoiUyQuyenForm";
import DongKhoSan from "@/components/channel/DongKhoSan";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { ChonPhuongAn, CotCaiDat, DongCaiDat, TheCaiDat } from "@/components/channel/KhuonCaiDat";
import { TheDonHang, TheTonKho } from "@/components/channel/CauHinhDongBoCards";
import { ngayIso } from "@/components/channel/ngay";
import { khoDaLuuKhongCon, khoSanDangChon, noiDungSan } from "@/components/channel/noiDungSan";
import { taiLaiKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import {
  coLuaChonTuDong,
  docLuaChonThietLap,
  ghiLuaChonThietLap,
  viecKhiHoanTat,
  xoaLuaChonThietLap,
} from "@/components/channel/luaChonThietLap";
import useDongBoNgay from "@/components/channel/useDongBoNgay";
import useSanHienTai from "@/components/channel/useSanHienTai";
import {
  coThayDoiKetNoi,
  daKetNoi,
  kiemTraGiaTriKetNoi,
  taoGiaTriKetNoi,
  taoPayloadKetNoi,
  trangThaiKetNoi,
} from "@/components/channel/ketNoiKenh";
import {
  QUY_TAC_MAC_DINH,
  cheDoTheoGiaTri,
  kiemTraCauHinh,
  taoGiaTriCauHinh,
  taoPayloadCauHinh,
  tenDiaDiemNhanTon,
} from "@/components/channel/cauHinhDongBo";
import { ketQuaDayLenSan, ketQuaTaiSanPham } from "@/components/channel/ketQuaThaoTac";
import { BUOC_THIET_LAP } from "@/constants/channel";
import { GHI_CHU_DU_LIEU_MAU_KENH, isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

/** Mã lỗi máy chủ trả khi gian hàng không còn gọi được sàn: đọc lại kết nối để trang hiện đúng tình trạng. */
const MA_MAT_KET_NOI = new Set(["UY_QUYEN_HET_HAN", "KENH_CHUA_KET_NOI", "LAM_MOI_KHOA_LOI"]);
/**
 * Trong số đó, mã làm trình thiết lập về bước 1 (chưa kết nối, hết hạn ủy quyền). Shopify bị từ chối khóa làm mới thì
 * vẫn ở bước đang làm (thẻ "Hết hạn khóa"), kết quả hiện tại chỗ như lỗi thường.
 */
const MA_VE_BUOC_1 = new Set(["UY_QUYEN_HET_HAN", "KENH_CHUA_KET_NOI"]);

/** Chặn bấm hai lần khi một thao tác đang chạy. */
function useDangChay() {
  const [dangChay, setDangChay] = useState(null);
  const ref = useRef(null);
  const chay = async (ten, viec) => {
    if (ref.current) return undefined;
    ref.current = ten;
    setDangChay(ten);
    try {
      return await viec();
    } finally {
      ref.current = null;
      setDangChay(null);
    }
  };
  return [dangChay, chay];
}

/**
 * Thiết lập gian hàng theo 4 bước: (1) Gian hàng → (2) Tồn kho → (3) Đơn hàng → (4) Liên kết sản phẩm.
 * Cùng khuôn một cột và cùng các thẻ với trang Cấu hình. Mỗi bước lưu ngay khi bấm Tiếp theo, nên thoát giữa chừng
 * thì lần sau vào tiếp từ bước còn dở. Bước đang làm nằm trên đường dẫn `?buoc=`.
 * Shopify: bước 1 dán khóa truy cập. Lazada, TikTok Shop: bước 1 ủy quyền trên trang của sàn; hết hạn ủy quyền thì
 * chỉ ở bước 1 tới khi ủy quyền lại; lần đầu thì tự động đồng bộ và lấy đơn cũ chờ tới Hoàn tất (KH mục B.3).
 */
export default function ChannelSetupWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [xongTrongPhien, setXongTrongPhien] = useState(() => new Set());
  const SAN = useSanHienTai();
  const TIEU_DE = `Thiết lập gian hàng ${SAN.ten}`;
  const uyQuyen = SAN.kieuKetNoi === "uy_quyen";

  const cfg = useTaiDuLieu(() => kenhBanHangService.getKetNoi(SAN.maKenh), `ket-noi|${SAN.maKenh}`);
  const config = cfg.data;
  const ketNoi = daKetNoi(config);
  const hetHanUyQuyen = uyQuyen && trangThaiKetNoi(config) === "het_han";
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo(SAN.maKenh), `cau-hinh-dong-bo|${SAN.maKenh}`);
  const tq = useTaiDuLieu(() => kenhBanHangService.getTongQuan(SAN.maKenh), `tong-quan|${SAN.maKenh}`, { enabled: ketNoi });
  // Shopify: lỗi đọc địa điểm thì coi như chưa có (như trước); sàn ủy quyền: giữ lỗi để ô chọn kho có Thử lại
  const kho = useTaiDuLieu(
    () => kenhBanHangService.getKhoSan(SAN.maKenh).catch((error) => (uyQuyen ? Promise.reject(error) : [])),
    `kho-san|${SAN.maKenh}`,
    { enabled: ketNoi },
  );
  const khoSan = tenDiaDiemNhanTon(kho);
  // Lần đầu (chưa lưu cấu hình đồng bộ nào) hoặc đang dở lần đầu của gian hàng này: công tắc tự động chờ Hoàn tất
  const luaChon = uyQuyen ? docLuaChonThietLap(SAN.maKenh, config) : {};
  const choHoanTat = uyQuyen && Boolean(ch.data) && (!ch.data.daLuu || coLuaChonTuDong(luaChon));
  const [dangHoanTat, chayHoanTat] = useDangChay();

  const daXong = (so) => {
    if (so === 1) return ketNoi && !hetHanUyQuyen;
    if (xongTrongPhien.has(so)) return true;
    if (so === 2) return Boolean(ch.data?.daLuuTonKho);
    if (so === 3) return Boolean(ch.data?.daLuuDonHang);
    return Number(tq.data?.tongSkuSan) > 0;
  };

  // Không có ?buoc= thì vào tiếp bước đầu tiên còn dở (đã kết nối thì từ bước 2).
  // Chưa kết nối hoặc hết hạn ủy quyền: chỉ có bước 1 (bước sau cần gọi được sàn).
  const chiBuoc1 = !ketNoi || hetHanUyQuyen;
  const buocTrenDuongDan = Number(searchParams.get("buoc"));
  const buocConDo = [2, 3].find((so) => !daXong(so)) ?? 4;
  const buoc = chiBuoc1 ? 1 : buocTrenDuongDan >= 1 && buocTrenDuongDan <= 4 ? buocTrenDuongDan : buocConDo;

  const denBuoc = (so) => {
    setSearchParams((cu) => {
      const moi = new URLSearchParams(cu);
      moi.set("buoc", String(so));
      return moi;
    });
    document.getElementById("backoffice-main-content")?.scrollTo({ top: 0 });
  };

  const xongBuoc = (so) => {
    setXongTrongPhien((cu) => new Set(cu).add(so));
    if (so < 4) denBuoc(so + 1);
  };

  const huyBo = () => navigate(ketNoi ? SAN.duongDan : "/channels");

  // Máy chủ báo hết hạn / mất kết nối giữa chừng: đọc lại kết nối (chưa kết nối, hết hạn ủy quyền thì trang tự về bước 1)
  const khiLoi = (error) => {
    if (!MA_MAT_KET_NOI.has(getApiErrorCode(error))) return;
    cfg.reload();
    taiLaiKenhDaKetNoi();
  };

  // Việc Hoàn tất sẽ làm: chỉ bật công tắc máy chủ còn đang tắt (đổi ở Cấu hình rồi thì lựa chọn đã bị xóa)
  const viecHoanTat = viecKhiHoanTat(luaChon, ch.data);

  const hoanTat = () =>
    chayHoanTat("hoan-tat", async () => {
      if (uyQuyen) {
        // Đọc lại lúc bấm: tab khác có thể vừa đổi
        const { batTuDong, soNgayDonCu } = viecKhiHoanTat(docLuaChonThietLap(SAN.maKenh, config), ch.data);
        if (Object.keys(batTuDong).length) {
          try {
            ch.setData(await kenhBanHangService.luuCauHinhDongBo(SAN.maKenh, batTuDong));
          } catch (error) {
            khiLoi(error);
            toast.error(getApiErrorMessage(error, "Chưa bật được tự động đồng bộ, vui lòng thử lại"));
            return;
          }
        }
        xoaLuaChonThietLap(SAN.maKenh);
        // Mất kết nối giữa chừng: trang tự về bước 1 (khiLoi), không báo xong
        if (soNgayDonCu && !(await layDonCu(SAN, soNgayDonCu, khiLoi))) return;
      }
      toast.success(`Đã thiết lập xong gian hàng ${SAN.ten}`);
      navigate(SAN.duongDan);
    });

  // Thiết lập chưa xong thì ủy quyền lại ở bước 1 quay về Thiết lập (không báo "gia hạn" rồi đưa về Tổng quan)
  const thietLapXong = !choHoanTat && [2, 3, 4].every((so) => daXong(so));

  const dangTaiLanDau = cfg.initialLoading || ch.initialLoading;
  const loiTai = (!config && cfg.error) || (!ch.data && ch.error);

  return (
    <PageContainer>
      <CotCaiDat>
        <ListPageHeader title={TIEU_DE} />
        <MockModeNotice show={isChannelMock} note={GHI_CHU_DU_LIEU_MAU_KENH} />

        {dangTaiLanDau ? (
          <LoadingState label="Đang tải thông tin gian hàng" />
        ) : loiTai ? (
          <ErrorState
            description="Không tải được thông tin gian hàng. Vui lòng thử lại."
            onRetry={() => {
              cfg.reload();
              ch.reload();
            }}
          />
        ) : (
          <>
            <SetupStepper
              buoc={BUOC_THIET_LAP}
              hienTai={buoc}
              daXong={daXong}
              onChon={chiBuoc1 ? undefined : denBuoc}
              className="py-1"
            />
            {buoc === 1 && uyQuyen ? (
              <BuocUyQuyen
                key={`uy-quyen-${config?.ngayCapNhat ?? "moi"}`}
                ketNoi={config}
                hetHan={hetHanUyQuyen}
                quayVeThietLap={!thietLapXong}
                onHuy={huyBo}
                onKetNoi={(dto) => {
                  if (dto) cfg.setData(dto);
                  taiLaiKenhDaKetNoi();
                  xongBuoc(1);
                }}
                onTiep={() => xongBuoc(1)}
              />
            ) : buoc === 1 ? (
              <BuocKetNoi
                key={`ket-noi-${config?.ngayCapNhat ?? "moi"}-${config?.shopDomain ?? ""}-${config?.trangThaiKetNoi ?? ""}`}
                config={config}
                onHuy={huyBo}
                onXong={(dto) => {
                  if (dto) cfg.setData(dto);
                  // Lần đầu kết nối: menu bên trái hiện mục Shopify ngay
                  taiLaiKenhDaKetNoi();
                  xongBuoc(1);
                }}
                onDoiKetNoi={() => {
                  cfg.reload();
                  taiLaiKenhDaKetNoi();
                  // Ở lại bước 1 để thấy cửa hàng đang kết nối (không có ?buoc= thì trang tự sang bước còn dở)
                  denBuoc(1);
                }}
              />
            ) : buoc === 2 ? (
              <BuocTonKho
                key="ton-kho"
                cauHinh={ch.data}
                choHoanTat={choHoanTat}
                khoSan={khoSan}
                ketNoi={config}
                dsKhoSan={kho}
                onLoi={khiLoi}
                onHuy={huyBo}
                onQuayLai={() => denBuoc(1)}
                onXong={(dto, khoMoi) => {
                  ch.setData(dto);
                  // Gộp kho vừa lưu vào kết nối đang có (PUT cai-dat không trả KetNoiKenhDto)
                  if (khoMoi) cfg.setData((cu) => ({ ...cu, ...khoMoi }));
                  xongBuoc(2);
                }}
              />
            ) : buoc === 3 ? (
              <BuocDonHang
                key="don-hang"
                cauHinh={ch.data}
                ketNoi={config}
                choHoanTat={choHoanTat}
                onLoi={khiLoi}
                onHuy={huyBo}
                onQuayLai={() => denBuoc(2)}
                onXong={(dto) => {
                  ch.setData(dto);
                  xongBuoc(3);
                }}
              />
            ) : (
              <BuocLienKet
                tongQuan={tq.data}
                dangTaiTongQuan={tq.loading}
                ketNoi={ketNoi}
                onTaiLai={tq.reload}
                onLoi={khiLoi}
                onHuy={huyBo}
                onQuayLai={() => denBuoc(3)}
                onHoanTat={hoanTat}
                dangHoanTat={Boolean(dangHoanTat)}
                ghiChuHoanTat={
                  !uyQuyen
                    ? null
                    : viecHoanTat.viec.length
                      ? `Hoàn tất sẽ ${viecHoanTat.viec.join(", ")}.`
                      : ch.data && !ch.data.tuDongDayTon && !ch.data.tuDongLayDon
                        ? "Tự động đồng bộ đang tắt, bật ở Cấu hình khi sẵn sàng."
                        : null
                }
              />
            )}
          </>
        )}
      </CotCaiDat>
    </PageContainer>
  );
}

/**
 * Lấy đơn cũ một lần (Thiết lập bước 3 của Shopify, Hoàn tất của sàn ủy quyền). Lỗi không chặn đi tiếp, trừ khi gian
 * hàng không còn gọi được (MA_MAT_KET_NOI): trả false để nơi gọi dừng, không báo "đã thiết lập xong".
 */
async function layDonCu(SAN, soNgay, onLoi) {
  try {
    const res = await kenhBanHangService.layDon(SAN.maKenh, {
      tu: new Date(`${ngayIso(soNgay - 1)}T00:00:00`).toISOString(),
      den: new Date().toISOString(),
    });
    toast.success(`Đã lấy ${formatNumber(res?.soDonMoi)} đơn mới từ ${SAN.ten}`);
  } catch (error) {
    onLoi?.(error);
    toast.error(getApiErrorMessage(error, "Chưa lấy được đơn cũ, có thể lấy lại ở trang Đơn hàng"));
    if (MA_MAT_KET_NOI.has(getApiErrorCode(error))) return false;
  }
  return true;
}

/**
 * Hàng nút dưới thẻ: Hủy bỏ bên trái; Quay lại và nút chính bên phải.
 * `khoa`: đang có thao tác chạy (khóa mọi nút); `dangLuu`: nút chính đang lưu (hiện vòng quay);
 * `khoaTiep`: lý do chưa cho sang bước sau (vd. chưa ủy quyền), khóa nút chính và hiện thành chữ cạnh nút;
 * `ghiChu`: lời nhắc không chặn. Điện thoại: chữ nằm trên hàng nút, nút cao 44 px.
 */
function HangNut({ onHuy, onQuayLai, onTiep, nhanTiep = "Tiếp theo", khoa = false, dangLuu = false, ghiChu, khoaTiep = null }) {
  const idLoiNhac = useId();
  const loiNhac = khoaTiep || ghiChu;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        disabled={khoa}
        onClick={onHuy}
        className="h-9 rounded-lg px-3 text-bo-foreground hover:bg-slate-100 max-sm:h-11"
      >
        Hủy bỏ
      </Button>
      {loiNhac ? (
        <p
          id={idLoiNhac}
          className={cn(
            "text-[13px] max-sm:order-first max-sm:basis-full sm:min-w-0 sm:flex-1 sm:text-right",
            khoaTiep ? "text-bo-foreground" : "text-bo-muted",
          )}
        >
          {loiNhac}
        </p>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        {onQuayLai ? (
          <Button
            type="button"
            variant="outline"
            disabled={khoa}
            onClick={onQuayLai}
            className="h-9 rounded-lg border-bo-border bg-white px-4 text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11"
          >
            Quay lại
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={khoa || Boolean(khoaTiep)}
          onClick={onTiep}
          aria-describedby={loiNhac ? idLoiNhac : undefined}
          className="h-9 gap-2 rounded-lg bg-bo-primary px-4 text-white hover:bg-bo-primary-hover max-sm:h-11"
        >
          {dangLuu ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          {dangLuu ? "Đang lưu…" : nhanTiep}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────── Bước 1: Gian hàng ───────────────────────────

/**
 * Sàn ủy quyền: "Tiếp theo" chỉ bật khi đã ủy quyền và còn hạn; nhập mã tay thành công thì sang bước 2 ngay
 * (`onKetNoi`).
 */
function BuocUyQuyen({ ketNoi, hetHan, quayVeThietLap, onHuy, onKetNoi, onTiep }) {
  const SAN = useSanHienTai();
  const daUyQuyen = daKetNoi(ketNoi);
  // Form đang lưu khóa / mở trang ủy quyền: khóa cả hàng nút (bấm Hủy bỏ lúc này thì trang vẫn chuyển sang sàn)
  const [formDangChay, setFormDangChay] = useState(false);
  const khoaTiep = !daUyQuyen
    ? "Ủy quyền gian hàng trước khi sang bước Tồn kho."
    : hetHan
      ? "Ủy quyền lại trước khi sang bước Tồn kho."
      : null;
  return (
    <>
      <TheCaiDat title="Ủy quyền gian hàng" description={noiDungSan(SAN.maKenh)?.moTaUyQuyen}>
        <KetNoiUyQuyenForm
          san={SAN}
          ketNoi={ketNoi}
          quayVeThietLap={quayVeThietLap}
          onKetNoi={onKetNoi}
          onDangChay={setFormDangChay}
        />
      </TheCaiDat>
      <HangNut onHuy={onHuy} onTiep={onTiep} khoa={formDangChay} khoaTiep={khoaTiep} />
    </>
  );
}

/** Mã lỗi khi lưu khóa cho thấy tình trạng kết nối vừa đổi ở nơi khác (tab khác kết nối cửa hàng khác / vừa ngắt). */
const MA_DOI_KET_NOI = new Set(["GIAN_HANG_KHAC", "KENH_CHUA_KET_NOI"]);

/** `onDoiKetNoi()`: máy chủ báo tình trạng kết nối vừa đổi ở nơi khác, trang đọc lại kết nối. */
function BuocKetNoi({ config, onHuy, onXong, onDoiKetNoi }) {
  const [values, setValues] = useState(() => taoGiaTriKetNoi(config));
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [dangChay, chay] = useDangChay();
  const daCo = daKetNoi(config);

  const doi = (name, value) => {
    setValues((cu) => ({ ...cu, [name]: value }));
    setErrors((cu) => ({ ...cu, [name]: undefined }));
  };

  const tiepTheo = () =>
    chay("luu", async () => {
      if (daCo && !coThayDoiKetNoi(values, config)) {
        onXong(null);
        return;
      }
      const loi = kiemTraGiaTriKetNoi(values, config);
      setErrors(loi);
      if (Object.keys(loi).length) return;
      setResult(null);
      const payload = taoPayloadKetNoi(values, config);
      try {
        // Kiểm tra khóa với Shopify trước, tránh lưu khóa sai
        const kiemTra = await kenhBanHangService.testShopifyConnection({
          shopDomain: payload.shopDomain,
          accessToken: payload.accessToken,
        });
        if (!kiemTra?.connected) {
          setResult({ ok: false, title: "Chưa kết nối được", message: kiemTra?.message || "Shopify không chấp nhận khóa này." });
          return;
        }
        const dto = await kenhBanHangService.updateShopifyConfig(payload);
        toast.success(`Đã kết nối ${kiemTra.shopName || payload.shopDomain}`);
        onXong(dto);
      } catch (error) {
        setValues((cu) => ({ ...cu, accessToken: "", apiSecret: "", refreshToken: "" }));
        const cau = getApiErrorMessage(error, "Không lưu được kết nối Shopify");
        // Đọc lại để ô tên miền khóa / mở đúng tình trạng mới; thẻ dựng lại theo kết nối mới nên báo bằng toast (một chỗ)
        if (MA_DOI_KET_NOI.has(getApiErrorCode(error))) {
          toast.error(cau);
          onDoiKetNoi?.();
        } else {
          setResult({ ok: false, title: "Chưa lưu được kết nối", message: cau });
        }
      }
    });

  return (
    <>
      <TheCaiDat
        title="Kết nối gian hàng"
        description="Dùng khóa của ứng dụng đã cài trong cửa hàng, có quyền đọc sản phẩm, đơn hàng và đọc, ghi tồn kho."
      >
        <div className="px-6 pb-6 pt-3">
          <KetNoiShopifyForm
            values={values}
            errors={errors}
            onChange={doi}
            config={config}
            disabled={Boolean(dangChay)}
            result={result}
            onResult={setResult}
          />
        </div>
      </TheCaiDat>
      <HangNut onHuy={onHuy} onTiep={tiepTheo} khoa={Boolean(dangChay)} dangLuu={Boolean(dangChay)} />
    </>
  );
}

// ─────────────────────────── Bước 2: Tồn kho ───────────────────────────

/**
 * Sàn ủy quyền thêm dòng kho trên sàn (`dsKhoSan`: kết quả getKhoSan); đổi kho thì lưu bằng PUT /{maKenh}/cai-dat.
 * `choHoanTat`: công tắc "Tự động cập nhật tồn" lưu tạm là tắt, bật ở Hoàn tất.
 */
function BuocTonKho({ cauHinh, choHoanTat, khoSan, ketNoi, dsKhoSan, onLoi, onHuy, onQuayLai, onXong }) {
  const SAN = useSanHienTai();
  const noiDung = noiDungSan(SAN.maKenh);
  const [values, setValues] = useState(() => {
    const goc = taoGiaTriCauHinh(cauHinh);
    const daChon = choHoanTat ? docLuaChonThietLap(SAN.maKenh, ketNoi).tuDongDayTon : undefined;
    if (typeof daChon === "boolean") return { ...goc, tuDongDayTon: daChon };
    // Lần đầu chưa lưu: máy chủ ghi tắt lúc ủy quyền chỉ là giá trị tạm (KH mục C.1) → công tắc vẫn gợi ý bật
    return choHoanTat && !cauHinh?.daLuuTonKho ? { ...goc, tuDongDayTon: true } : goc;
  });
  const [cheDo, setCheDo] = useState(() => cheDoTheoGiaTri(taoGiaTriCauHinh(cauHinh)));
  const [errors, setErrors] = useState({});
  const [maKhoSan, setMaKhoSan] = useState(null);
  const [dangChay, chay] = useDangChay();
  const khoDangLuu = khoSanDangChon(ketNoi?.maKhoSan, dsKhoSan?.data);
  const khoMat = khoDaLuuKhongCon(ketNoi?.maKhoSan, dsKhoSan?.data);
  // Kho sẽ lưu (chỉ sàn chọn được kho, tức TikTok Shop): kho người dùng chọn, hoặc kho đang hiện (mặc định của sàn)
  // khi gian hàng chưa lưu kho nào hay kho đã lưu không còn trên sàn — Thiết lập là nơi xác nhận kho nhận tồn.
  // Shopify và Lazada (một kho) không lưu.
  const chonDuocKho = Boolean(noiDung) && !noiDung.khoSan.chiDoc;
  const khoSeLuu = chonDuocKho ? (maKhoSan ?? (ketNoi?.maKhoSan && !khoMat ? null : khoDangLuu || null)) : null;
  // Không đọc được danh sách kho mà gian hàng đã lưu kho thì vẫn cho đi tiếp với kho đó
  const khoaTiep = !chonDuocKho
    ? null
    : dsKhoSan?.initialLoading
      ? `Đang đọc kho từ ${SAN.ten}…`
      : !(maKhoSan || khoDangLuu || ketNoi?.maKhoSan)
        ? `Cần một kho bán hàng trên ${SAN.ten} để nhận số tồn.`
        : null;

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

  const tiepTheo = () =>
    chay("luu", async () => {
      const loi = kiemTraCauHinh(values);
      setErrors(loi);
      if (Object.keys(loi).length) {
        setCheDo("tuy");
        return;
      }
      const payload = taoPayloadCauHinh(values, "ton-kho");
      // Lần đầu: nhớ lựa chọn, lưu tạm là tắt (máy chủ chưa đẩy tồn khi sản phẩm chưa ghép)
      if (choHoanTat && ghiLuaChonThietLap(SAN.maKenh, ketNoi, { tuDongDayTon: payload.tuDongDayTon })) {
        payload.tuDongDayTon = false;
      }
      try {
        const dto = await kenhBanHangService.luuCauHinhDongBo(SAN.maKenh, payload);
        // Kho trên sàn (TikTok Shop chọn được) lưu riêng, chỉ khi khác kho đã lưu
        let khoMoi = null;
        if (khoSeLuu && khoSeLuu !== ketNoi?.maKhoSan) {
          const kho = dsKhoSan?.data?.find((k) => k.maKhoSan === khoSeLuu);
          khoMoi = { maKhoSan: khoSeLuu, tenKhoSan: kho?.tenKhoSan ?? null };
          await kenhBanHangService.luuCaiDatKenh(SAN.maKenh, khoMoi);
        }
        onXong(dto, khoMoi);
      } catch (error) {
        onLoi?.(error);
        toast.error(getApiErrorMessage(error, "Không lưu được cấu hình tồn kho"));
      }
    });

  const moTa = choHoanTat
    ? `Số FCentric gửi lên ${SAN.ten}. Tự động cập nhật bắt đầu khi bấm Hoàn tất ở bước cuối.`
    : `Số FCentric gửi lên ${SAN.ten}. Sửa lại được ở Cấu hình.`;

  return (
    <>
      <TheTonKho
        moTa={moTa}
        values={values}
        errors={errors}
        onChange={doi}
        cheDo={cheDo}
        onDoiCheDo={doiCheDo}
        cauHinh={cauHinh}
        khoSan={khoSan}
        disabled={Boolean(dangChay)}
        tenSan={SAN.ten}
        dongKho={
          noiDung ? (
            <DongKhoSan
              maKenh={SAN.maKenh}
              tenSan={SAN.ten}
              khoSan={dsKhoSan}
              value={maKhoSan ?? khoDangLuu}
              maKhoDaLuu={ketNoi?.maKhoSan}
              onChange={setMaKhoSan}
              disabled={Boolean(dangChay)}
            />
          ) : undefined
        }
        ghiChu={noiDung?.ghiChuTon}
      />
      <HangNut
        onHuy={onHuy}
        onQuayLai={onQuayLai}
        onTiep={tiepTheo}
        khoa={Boolean(dangChay)}
        dangLuu={Boolean(dangChay)}
        khoaTiep={khoaTiep}
      />
    </>
  );
}

// ─────────────────────────── Bước 3: Đơn hàng ───────────────────────────

const LAY_DON_CU = [
  { value: "0", label: "Không lấy" },
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
];

/**
 * Shopify lấy đơn cũ ngay khi bấm Tiếp theo (như trước). Sàn ủy quyền lấy ở Hoàn tất, sau khi đã ghép sản phẩm,
 * để đơn về nhận ra SKU; lần đầu thì công tắc "Tự động lấy đơn" cũng chờ Hoàn tất (`choHoanTat`).
 */
function BuocDonHang({ cauHinh, ketNoi, choHoanTat, onLoi, onHuy, onQuayLai, onXong }) {
  const SAN = useSanHienTai();
  const noiDung = noiDungSan(SAN.maKenh);
  const layOHoanTat = Boolean(noiDung);
  const [values, setValues] = useState(() => {
    const goc = taoGiaTriCauHinh(cauHinh);
    const daChon = choHoanTat ? docLuaChonThietLap(SAN.maKenh, ketNoi).tuDongLayDon : undefined;
    if (typeof daChon === "boolean") return { ...goc, tuDongLayDon: daChon };
    // Như bước 2: giá trị tắt tạm lúc ủy quyền lần đầu không phải lựa chọn của người dùng
    return choHoanTat && !cauHinh?.daLuuDonHang ? { ...goc, tuDongLayDon: true } : goc;
  });
  const [layDonCuChon, setLayDonCuChon] = useState(() => {
    const daChon = layOHoanTat ? String(docLuaChonThietLap(SAN.maKenh, ketNoi).layDonCu ?? "0") : "0";
    return LAY_DON_CU.some((o) => o.value === daChon) ? daChon : "0";
  });
  const [dangChay, chay] = useDangChay();

  const tiepTheo = () =>
    chay("luu", async () => {
      const payload = taoPayloadCauHinh(values, "don-hang");
      if (choHoanTat && ghiLuaChonThietLap(SAN.maKenh, ketNoi, { tuDongLayDon: payload.tuDongLayDon })) {
        payload.tuDongLayDon = false;
      }
      let dto;
      try {
        dto = await kenhBanHangService.luuCauHinhDongBo(SAN.maKenh, payload);
      } catch (error) {
        onLoi?.(error);
        toast.error(getApiErrorMessage(error, "Không lưu được cấu hình đơn hàng"));
        return;
      }
      const soNgay = Number(layDonCuChon);
      // Sàn ủy quyền: hẹn tới Hoàn tất; trình duyệt chặn lưu thì lấy luôn như Shopify
      const daHen = layOHoanTat && ghiLuaChonThietLap(SAN.maKenh, ketNoi, { layDonCu: soNgay });
      if (!daHen && soNgay > 0) await layDonCu(SAN, soNgay, onLoi);
      onXong(dto);
    });

  return (
    <>
      <TheDonHang
        moTa={
          choHoanTat
            ? `Đơn ${SAN.ten} thành đơn bán hàng để kho xử lý. Tự động lấy đơn bắt đầu khi bấm Hoàn tất ở bước cuối.`
            : `Đơn ${SAN.ten} thành đơn bán hàng để kho xử lý.`
        }
        values={values}
        onChange={(name, value) => setValues((cu) => ({ ...cu, [name]: value }))}
        cauHinh={cauHinh}
        disabled={Boolean(dangChay)}
        tenSan={SAN.ten}
        tienToDon={SAN.tienToDon}
        nhanCongTac={noiDung ? `Tự động lấy đơn từ ${SAN.ten}` : undefined}
        khachMacDinh={noiDung?.khachMacDinh}
        ghiChu={noiDung?.ghiChuDon}
      >
        <DongCaiDat
          title="Lấy thêm đơn cũ"
          description={
            layOHoanTat
              ? "Lấy một lần khi bấm Hoàn tất, sau khi đã liên kết sản phẩm."
              : "Lấy một lần khi bấm Tiếp theo, tối đa 50 đơn."
          }
          control={
            <ChonPhuongAn
              label="Lấy thêm đơn cũ"
              value={layDonCuChon}
              options={LAY_DON_CU}
              onChange={setLayDonCuChon}
              disabled={Boolean(dangChay)}
            />
          }
        />
      </TheDonHang>
      <HangNut onHuy={onHuy} onQuayLai={onQuayLai} onTiep={tiepTheo} khoa={Boolean(dangChay)} dangLuu={Boolean(dangChay)} />
    </>
  );
}

// ─────────────────────────── Bước 4: Liên kết sản phẩm ───────────────────────────

function KetQua({ result }) {
  if (!result) return null;
  return (
    <p role="status" className="mt-2">
      <TrangThaiCham
        label={[result.title, result.message].filter(Boolean).join(". ")}
        tone={result.ok ? "success" : "danger"}
        className="whitespace-normal"
      />
    </p>
  );
}

function SoTomTat({ nhan, giaTri, loi = false }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-bo-muted">{nhan}</p>
      <p className={cn("text-xl font-semibold tabular-nums text-bo-heading", loi && "text-bo-danger")}>{giaTri}</p>
    </div>
  );
}

/**
 * Sàn ủy quyền không có "Đưa sản phẩm FCentric lên" (KH mục C.1).
 * Khi đợt Đồng bộ ngay đang chạy thì chưa cho tải / đưa lên (hai việc cùng ghi bảng liên kết).
 */
function BuocLienKet({
  tongQuan,
  dangTaiTongQuan,
  ketNoi,
  onTaiLai,
  onLoi,
  onHuy,
  onQuayLai,
  onHoanTat,
  dangHoanTat,
  ghiChuHoanTat = null,
}) {
  const SAN = useSanHienTai();
  const coDuaLen = SAN.kieuKetNoi === "khoa";
  const [ketQuaTai, setKetQuaTai] = useState(null);
  const [ketQuaDay, setKetQuaDay] = useState(null);
  const [hoiDay, setHoiDay] = useState(false);
  const [dangChay, chay] = useDangChay();
  const dongBo = useDongBoNgay(SAN.maKenh, { enabled: ketNoi, onXong: onTaiLai });
  const tong = Number(tongQuan?.tongSkuSan ?? 0);
  const chuaCo = dangTaiTongQuan && !tongQuan;
  const khoaThaoTac = Boolean(dangChay) || dangHoanTat || dongBo.dangChay;

  // Mất kết nối: trình thiết lập đọc lại kết nối rồi về bước 1, thẻ này mất theo nên báo bằng toast (một chỗ).
  // Trả true khi đã báo, nơi gọi khỏi ghi kết quả vào thẻ
  const baoMatKetNoi = (error, cau) => {
    onLoi(error);
    if (!MA_VE_BUOC_1.has(getApiErrorCode(error))) return false;
    toast.error(cau);
    return true;
  };

  const taiVaGhep = () =>
    chay("tai", async () => {
      setKetQuaTai(null);
      try {
        const res = await kenhBanHangService.taiSanPham(SAN.maKenh);
        const kq = ketQuaTaiSanPham(res, SAN.ten);
        setKetQuaTai({ ok: true, title: kq.title });
        onTaiLai();
      } catch (error) {
        const cau = getApiErrorMessage(error, `Không tải được sản phẩm từ ${SAN.ten}`);
        if (!baoMatKetNoi(error, cau)) setKetQuaTai({ ok: false, title: "Chưa tải được sản phẩm", message: cau });
      }
    });

  const dayLenSan = () =>
    chay("day", async () => {
      setKetQuaDay(null);
      try {
        const res = await kenhBanHangService.dayVaLienKetSanPham(SAN.maKenh);
        setHoiDay(false);
        setKetQuaDay(ketQuaDayLenSan(res, SAN.ten));
        onTaiLai();
      } catch (error) {
        setHoiDay(false);
        const cau = getApiErrorMessage(error, "Không đưa được sản phẩm lên Shopify");
        if (!baoMatKetNoi(error, cau)) setKetQuaDay({ ok: false, title: "Chưa đưa được sản phẩm lên", message: cau });
      }
    });

  const nutPhu =
    "h-8 gap-2 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11";
  const loiNhacDongBo = dongBo.dangChay ? "Đang chạy Đồng bộ ngay, chờ xong rồi làm tiếp." : null;

  return (
    <>
      <TheCaiDat title="Liên kết sản phẩm" description="Ghép theo SKU, nên SKU hai bên cần giống nhau. Làm lại được ở trang Sản phẩm.">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-3 px-6 pb-5 pt-2">
          <SoTomTat nhan="Đã ghép" giaTri={chuaCo ? "…" : `${formatNumber(tong)} SKU`} />
          <SoTomTat nhan="Đang đồng bộ" giaTri={chuaCo ? "…" : formatNumber(tongQuan?.daLienKet)} />
          <SoTomTat nhan="Lỗi" giaTri={chuaCo ? "…" : formatNumber(tongQuan?.loiDongBo)} loi={Number(tongQuan?.loiDongBo) > 0} />
          <SoTomTat nhan="Ngừng đồng bộ" giaTri={chuaCo ? "…" : formatNumber(tongQuan?.chuaLienKet)} />
          <Link
            to={`${SAN.duongDan}/products`}
            className="ml-auto inline-flex items-center rounded text-sm font-medium text-bo-primary hover:text-bo-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:min-h-11"
          >
            Xem danh sách
          </Link>
        </div>
        <DongCaiDat
          title={`Ghép với sản phẩm đang có trên ${SAN.ten}`}
          description={loiNhacDongBo ?? `Không thay đổi gì trên ${SAN.ten}.`}
          control={
            <Button type="button" variant="outline" disabled={khoaThaoTac} onClick={taiVaGhep} className={nutPhu}>
              {dangChay === "tai" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {`Tải sản phẩm từ ${SAN.ten}`}
            </Button>
          }
        >
          {ketQuaTai ? <KetQua result={ketQuaTai} /> : null}
        </DongCaiDat>
        {coDuaLen ? (
          <DongCaiDat
            title={`Đưa sản phẩm FCentric lên ${SAN.ten}`}
            description={loiNhacDongBo ?? "Tạo sản phẩm còn thiếu, kèm ảnh và số tồn."}
            control={
              <Button type="button" variant="outline" disabled={khoaThaoTac} onClick={() => setHoiDay(true)} className={nutPhu}>
                Đưa lên…
              </Button>
            }
          >
            {ketQuaDay ? <KetQua result={ketQuaDay} /> : null}
          </DongCaiDat>
        ) : null}
      </TheCaiDat>

      <HangNut
        onHuy={onHuy}
        onQuayLai={onQuayLai}
        onTiep={onHoanTat}
        nhanTiep="Hoàn tất"
        khoa={Boolean(dangChay) || dangHoanTat}
        dangLuu={dangHoanTat}
        // Cho biết trước Hoàn tất sẽ bật gì / lấy đơn nào (sàn ủy quyền), kèm nhắc khi chưa ghép SKU nào
        ghiChu={
          [!chuaCo && tong === 0 ? "Chưa ghép SKU nào: tồn kho và đơn hàng chưa đồng bộ được." : null, ghiChuHoanTat]
            .filter(Boolean)
            .join(" ") || null
        }
      />

      <ConfirmModal
        isOpen={hoiDay}
        onClose={() => setHoiDay(false)}
        onConfirm={dayLenSan}
        isLoading={dangChay === "day"}
        variant="info"
        title={`Đưa sản phẩm lên ${SAN.ten}?`}
        description={`Các sản phẩm đang bán ở FCentric mà ${SAN.ten} chưa có sẽ được tạo mới trên gian hàng thật, kèm ảnh và số tồn. Thao tác có thể mất vài phút nếu nhiều sản phẩm.`}
        confirmText="Đưa lên"
        cancelText="Hủy bỏ"
      />
    </>
  );
}
