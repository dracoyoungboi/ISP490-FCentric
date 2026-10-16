import { useRef, useState } from "react";
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
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { ChonPhuongAn, CotCaiDat, DongCaiDat, TheCaiDat } from "@/components/channel/KhuonCaiDat";
import { TheDonHang, TheTonKho } from "@/components/channel/CauHinhDongBoCards";
import { ngayIso } from "@/components/channel/ngay";
import {
  coThayDoiKetNoi,
  daKetNoi,
  kiemTraGiaTriKetNoi,
  taoGiaTriKetNoi,
  taoPayloadKetNoi,
} from "@/components/channel/ketNoiShopify";
import {
  QUY_TAC_MAC_DINH,
  cheDoTheoGiaTri,
  kiemTraCauHinh,
  taoGiaTriCauHinh,
  taoPayloadCauHinh,
  tenDiaDiemNhanTon,
} from "@/components/channel/cauHinhDongBo";
import { ketQuaDayLenSan, ketQuaTaiSanPham } from "@/components/channel/ketQuaThaoTac";
import { BUOC_THIET_LAP, SAN_BAN_HANG } from "@/constants/channel";
import { isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";

const SAN = SAN_BAN_HANG.find((s) => s.maKenh === "SHOPIFY");
const TIEU_DE = `Thiết lập gian hàng ${SAN.ten}`;
const soVN = (n) => Number(n || 0).toLocaleString("vi-VN");

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
 * Thiết lập gian hàng Shopify theo 4 bước: (1) Gian hàng → (2) Tồn kho → (3) Đơn hàng → (4) Liên kết sản phẩm.
 * Cùng khuôn một cột và cùng các thẻ với trang Cấu hình. Mỗi bước lưu ngay khi bấm Tiếp theo, nên thoát giữa chừng
 * thì lần sau vào tiếp từ bước còn dở. Bước đang làm nằm trên đường dẫn `?buoc=`.
 */
export default function ChannelSetupWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [xongTrongPhien, setXongTrongPhien] = useState(() => new Set());

  const cfg = useTaiDuLieu(() => kenhBanHangService.getShopifyConfig(), "cau-hinh-shopify");
  const config = cfg.data;
  const ketNoi = daKetNoi(config);
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo(SAN.maKenh), "cau-hinh-dong-bo");
  const tq = useTaiDuLieu(() => kenhBanHangService.getTongQuan(SAN.maKenh), "tong-quan", { enabled: ketNoi });
  const kho = useTaiDuLieu(() => kenhBanHangService.getKhoSan(SAN.maKenh).catch(() => []), "kho-san", { enabled: ketNoi });
  const khoSan = tenDiaDiemNhanTon(kho);

  const daXong = (so) => {
    if (so === 1) return ketNoi;
    if (xongTrongPhien.has(so)) return true;
    if (so === 2) return Boolean(ch.data?.daLuuTonKho);
    if (so === 3) return Boolean(ch.data?.daLuuDonHang);
    return Number(tq.data?.tongSkuSan) > 0;
  };

  // Không có ?buoc= thì vào tiếp bước đầu tiên còn dở (đã kết nối thì từ bước 2)
  const buocTrenDuongDan = Number(searchParams.get("buoc"));
  const buocConDo = [2, 3].find((so) => !daXong(so)) ?? 4;
  const buoc = !ketNoi ? 1 : buocTrenDuongDan >= 1 && buocTrenDuongDan <= 4 ? buocTrenDuongDan : buocConDo;

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

  const dangTaiLanDau = cfg.initialLoading || ch.initialLoading;
  const loiTai = (!config && cfg.error) || (!ch.data && ch.error);

  return (
    <PageContainer>
      <CotCaiDat>
        <ListPageHeader title={TIEU_DE} />
        <MockModeNotice show={isChannelMock} />

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
            <SetupStepper buoc={BUOC_THIET_LAP} hienTai={buoc} daXong={daXong} onChon={denBuoc} className="py-1" />
            {buoc === 1 ? (
              <BuocKetNoi
                key={`ket-noi-${config?.ngayCapNhat ?? "moi"}`}
                config={config}
                onHuy={huyBo}
                onXong={(dto) => {
                  if (dto) cfg.setData(dto);
                  xongBuoc(1);
                }}
              />
            ) : buoc === 2 ? (
              <BuocTonKho
                key="ton-kho"
                cauHinh={ch.data}
                khoSan={khoSan}
                onHuy={huyBo}
                onQuayLai={() => denBuoc(1)}
                onXong={(dto) => {
                  ch.setData(dto);
                  xongBuoc(2);
                }}
              />
            ) : buoc === 3 ? (
              <BuocDonHang
                key="don-hang"
                cauHinh={ch.data}
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
                onTaiLai={tq.reload}
                onHuy={huyBo}
                onQuayLai={() => denBuoc(3)}
                onHoanTat={() => {
                  toast.success(`Đã thiết lập xong gian hàng ${SAN.ten}`);
                  navigate(SAN.duongDan);
                }}
              />
            )}
          </>
        )}
      </CotCaiDat>
    </PageContainer>
  );
}

/** Hàng nút dưới thẻ: Hủy bỏ bên trái; Quay lại và nút chính bên phải. */
/** `khoa`: đang có thao tác chạy (khóa mọi nút); `dangLuu`: nút chính đang lưu (hiện vòng quay). */
function HangNut({ onHuy, onQuayLai, onTiep, nhanTiep = "Tiếp theo", khoa = false, dangLuu = false, ghiChu }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        disabled={khoa}
        onClick={onHuy}
        className="h-9 rounded-lg px-3 text-bo-foreground hover:bg-slate-100"
      >
        Hủy bỏ
      </Button>
      {ghiChu ? <p className="min-w-0 flex-1 text-right text-[13px] text-bo-muted">{ghiChu}</p> : null}
      <div className={cn("flex items-center gap-2", !ghiChu && "ml-auto")}>
        {onQuayLai ? (
          <Button
            type="button"
            variant="outline"
            disabled={khoa}
            onClick={onQuayLai}
            className="h-9 rounded-lg border-bo-border bg-white px-4 text-bo-foreground hover:bg-bo-surface-subtle"
          >
            Quay lại
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={khoa}
          onClick={onTiep}
          className="h-9 gap-2 rounded-lg bg-bo-primary px-4 text-white hover:bg-bo-primary-hover"
        >
          {dangLuu ? <Loader2 className="size-4 animate-spin" /> : null}
          {dangLuu ? "Đang lưu…" : nhanTiep}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────── Bước 1: Gian hàng ───────────────────────────

function BuocKetNoi({ config, onHuy, onXong }) {
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
        setResult({ ok: false, title: "Chưa lưu được kết nối", message: getApiErrorMessage(error, "Không lưu được kết nối Shopify") });
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

function BuocTonKho({ cauHinh, khoSan, onHuy, onQuayLai, onXong }) {
  const [values, setValues] = useState(() => taoGiaTriCauHinh(cauHinh));
  const [cheDo, setCheDo] = useState(() => cheDoTheoGiaTri(taoGiaTriCauHinh(cauHinh)));
  const [errors, setErrors] = useState({});
  const [dangChay, chay] = useDangChay();

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
      try {
        const dto = await kenhBanHangService.luuCauHinhDongBo(SAN.maKenh, taoPayloadCauHinh(values, "ton-kho"));
        onXong(dto);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không lưu được cấu hình tồn kho"));
      }
    });

  return (
    <>
      <TheTonKho
        moTa={`Số FCentric gửi lên ${SAN.ten}. Sửa lại được ở Cấu hình.`}
        values={values}
        errors={errors}
        onChange={doi}
        cheDo={cheDo}
        onDoiCheDo={doiCheDo}
        cauHinh={cauHinh}
        khoSan={khoSan}
        disabled={Boolean(dangChay)}
      />
      <HangNut onHuy={onHuy} onQuayLai={onQuayLai} onTiep={tiepTheo} khoa={Boolean(dangChay)} dangLuu={Boolean(dangChay)} />
    </>
  );
}

// ─────────────────────────── Bước 3: Đơn hàng ───────────────────────────

const LAY_DON_CU = [
  { value: "0", label: "Không lấy" },
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
];

function BuocDonHang({ cauHinh, onHuy, onQuayLai, onXong }) {
  const [values, setValues] = useState(() => taoGiaTriCauHinh(cauHinh));
  const [layDonCu, setLayDonCu] = useState("0");
  const [dangChay, chay] = useDangChay();

  const tiepTheo = () =>
    chay("luu", async () => {
      let dto;
      try {
        dto = await kenhBanHangService.luuCauHinhDongBo(SAN.maKenh, taoPayloadCauHinh(values, "don-hang"));
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không lưu được cấu hình đơn hàng"));
        return;
      }
      const soNgay = Number(layDonCu);
      if (soNgay > 0) {
        try {
          const res = await kenhBanHangService.layDon(SAN.maKenh, {
            tu: new Date(`${ngayIso(soNgay - 1)}T00:00:00`).toISOString(),
            den: new Date().toISOString(),
          });
          toast.success(`Đã lấy ${soVN(res?.soDonMoi)} đơn mới từ ${SAN.ten}`);
        } catch (error) {
          // Cấu hình đã lưu; báo lỗi lấy đơn nhưng vẫn cho đi tiếp
          toast.error(getApiErrorMessage(error, "Chưa lấy được đơn cũ, có thể lấy lại ở trang Đơn hàng"));
        }
      }
      onXong(dto);
    });

  return (
    <>
      <TheDonHang
        moTa={`Đơn ${SAN.ten} thành đơn bán hàng để kho xử lý.`}
        values={values}
        onChange={(name, value) => setValues((cu) => ({ ...cu, [name]: value }))}
        cauHinh={cauHinh}
        disabled={Boolean(dangChay)}
      >
        <DongCaiDat
          title="Lấy thêm đơn cũ"
          description="Lấy một lần khi bấm Tiếp theo, tối đa 50 đơn."
          control={
            <ChonPhuongAn label="Lấy thêm đơn cũ" value={layDonCu} options={LAY_DON_CU} onChange={setLayDonCu} disabled={Boolean(dangChay)} />
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

function BuocLienKet({ tongQuan, dangTaiTongQuan, onTaiLai, onHuy, onQuayLai, onHoanTat }) {
  const [ketQuaTai, setKetQuaTai] = useState(null);
  const [ketQuaDay, setKetQuaDay] = useState(null);
  const [hoiDay, setHoiDay] = useState(false);
  const [dangChay, chay] = useDangChay();
  const tong = Number(tongQuan?.tongSkuSan ?? 0);
  const chuaCo = dangTaiTongQuan && !tongQuan;

  const taiVaGhep = () =>
    chay("tai", async () => {
      setKetQuaTai(null);
      try {
        const res = await kenhBanHangService.taiSanPham(SAN.maKenh);
        const kq = ketQuaTaiSanPham(res, SAN.ten);
        setKetQuaTai({ ok: true, title: kq.title });
        onTaiLai();
      } catch (error) {
        setKetQuaTai({ ok: false, title: "Chưa tải được sản phẩm", message: getApiErrorMessage(error, "Không tải được sản phẩm từ Shopify") });
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
        setKetQuaDay({ ok: false, title: "Chưa đưa được sản phẩm lên", message: getApiErrorMessage(error, "Không đưa được sản phẩm lên Shopify") });
      }
    });

  const nutPhu = "h-8 gap-2 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle";

  return (
    <>
      <TheCaiDat title="Liên kết sản phẩm" description="Ghép theo SKU, nên SKU hai bên cần giống nhau. Làm lại được ở trang Sản phẩm.">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-3 px-6 pb-5 pt-2">
          <SoTomTat nhan="Đã ghép" giaTri={chuaCo ? "…" : `${soVN(tong)} SKU`} />
          <SoTomTat nhan="Đang đồng bộ" giaTri={chuaCo ? "…" : soVN(tongQuan?.daLienKet)} />
          <SoTomTat nhan="Lỗi" giaTri={chuaCo ? "…" : soVN(tongQuan?.loiDongBo)} loi={Number(tongQuan?.loiDongBo) > 0} />
          <Link
            to={`${SAN.duongDan}/products`}
            className="ml-auto text-sm font-medium text-bo-primary hover:text-bo-primary-hover hover:underline"
          >
            Xem danh sách
          </Link>
        </div>
        <DongCaiDat
          title={`Ghép với sản phẩm đang có trên ${SAN.ten}`}
          description={`Không thay đổi gì trên ${SAN.ten}.`}
          control={
            <Button type="button" variant="outline" disabled={Boolean(dangChay)} onClick={taiVaGhep} className={nutPhu}>
              {dangChay === "tai" ? <Loader2 className="size-4 animate-spin" /> : null}
              Tải từ {SAN.ten}
            </Button>
          }
        >
          {ketQuaTai ? <KetQua result={ketQuaTai} /> : null}
        </DongCaiDat>
        <DongCaiDat
          title={`Đưa sản phẩm FCentric lên ${SAN.ten}`}
          description="Tạo sản phẩm còn thiếu, kèm ảnh và số tồn."
          control={
            <Button type="button" variant="outline" disabled={Boolean(dangChay)} onClick={() => setHoiDay(true)} className={nutPhu}>
              Đưa lên…
            </Button>
          }
        >
          {ketQuaDay ? <KetQua result={ketQuaDay} /> : null}
        </DongCaiDat>
      </TheCaiDat>

      <HangNut
        onHuy={onHuy}
        onQuayLai={onQuayLai}
        onTiep={onHoanTat}
        nhanTiep="Hoàn tất"
        khoa={Boolean(dangChay)}
        ghiChu={!chuaCo && tong === 0 ? "Chưa ghép SKU nào: tồn kho và đơn hàng chưa đồng bộ được." : null}
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
