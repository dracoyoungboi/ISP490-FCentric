import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleAlert, CircleCheck, ChevronDown, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SecretInput from "@/components/shared/SecretInput";
import { TrangThaiCham } from "@/components/channel/HienThiKenh";
import { INPUT_CLASS } from "@/components/channel/SettingsCard";
import { ngayThang } from "@/components/channel/ngay";
import { noiDungSan } from "@/components/channel/noiDungSan";
import { cauLoiUyQuyen, moTrangUyQuyen } from "@/components/channel/uyQuyen";
import {
  coThayDoiKhoaUngDung,
  daKetNoi,
  kiemTraKhoaUngDung,
  taoGiaTriKhoaUngDung,
  taoPayloadKhoaUngDung,
  trangThaiKetNoi,
} from "@/components/channel/ketNoiKenh";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { cn } from "@/lib/utils";

/** Sau khi gọi chuyển sang trang của sàn, giữ khóa nút chừng này rồi nhả (xem `chay`). */
const THOI_GIAN_CHO_CHUYEN_TRANG_MS = 4000;
const NHAN_O = "mb-1.5 block text-sm font-medium text-bo-foreground";
const O_LOI = "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15";
// Ô chỉ xem (đã ủy quyền): vẫn chọn, sao chép được, nền nhạt như ô bị khóa; giữ viền tiêu điểm của INPUT_CLASS
const O_CHI_DOC = "bg-bo-surface-subtle text-bo-muted";

/**
 * Các ô khóa ứng dụng của sàn ủy quyền: App Key, App Secret (ô mật khẩu, không bao giờ điền khóa đã lưu)
 * và Service ID (chỉ TikTok Shop). `chiDoc`: gian hàng đã ủy quyền, khóa chỉ xem — đổi khóa ở Cấu hình
 * (`duongDanCauHinh`). Dùng ở bước 1 Thiết lập và hộp thoại "Cập nhật khóa ứng dụng".
 */
export function CacOKhoaUngDung({ maKenh, values, errors = {}, onChange, ketNoi, disabled = false, chiDoc = false, duongDanCauHinh }) {
  const id = useId();
  const noiDung = noiDungSan(maKenh);
  const coServiceId = Boolean(noiDung?.coServiceId);
  const khoa = disabled || chiDoc;
  const goiYSecret = chiDoc ? (
    <>
      Đã lưu và mã hóa.{" "}
      {duongDanCauHinh ? (
        <Link
          to={duongDanCauHinh}
          className="rounded-sm font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:-my-3 max-sm:inline-block max-sm:py-3"
        >
          Đổi khóa ở trang Cấu hình
        </Link>
      ) : (
        "Đổi khóa ở trang Cấu hình."
      )}
    </>
  ) : ketNoi?.hasAppSecret ? (
    "Đang dùng khóa đã lưu. Để trống nếu không đổi."
  ) : (
    "Chỉ cần nhập lần đầu, hệ thống mã hóa khi lưu."
  );
  return (
    // Khung đủ rộng (thẻ ở trang Thiết lập) thì các ô một hàng; trong hộp thoại hẹp thì xếp dọc
    <div className="@container">
      <div className={cn("grid gap-4", coServiceId ? "@2xl:grid-cols-3" : "@xl:grid-cols-2")}>
        <div>
          <label htmlFor={`${id}-app-key`} className={NHAN_O}>
            App Key
          </label>
          <input
            id={`${id}-app-key`}
            value={values.appKey}
            disabled={disabled}
            readOnly={chiDoc}
            onChange={(event) => onChange("appKey", event.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={Boolean(errors.appKey)}
            aria-describedby={`${id}-app-key-goi-y`}
            className={cn(INPUT_CLASS, "font-mono", chiDoc && O_CHI_DOC, errors.appKey && O_LOI)}
          />
          <p id={`${id}-app-key-goi-y`} className={cn("mt-1 text-xs", errors.appKey ? "text-bo-danger" : "text-bo-muted")}>
            {errors.appKey || noiDung?.goiYAppKey}
          </p>
        </div>
        <SecretInput
          id={`${id}-app-secret`}
          label="App Secret"
          value={values.appSecret}
          onChange={(value) => onChange("appSecret", value)}
          error={errors.appSecret}
          hint={goiYSecret}
          placeholder={chiDoc ? "••••••••" : undefined}
          disabled={khoa}
        />
        {coServiceId ? (
          <div>
            <label htmlFor={`${id}-service-id`} className={NHAN_O}>
              Service ID
            </label>
            <input
              id={`${id}-service-id`}
              value={values.serviceId}
              disabled={disabled}
              readOnly={chiDoc}
              onChange={(event) => onChange("serviceId", event.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={Boolean(errors.serviceId)}
              aria-describedby={`${id}-service-id-goi-y`}
              className={cn(INPUT_CLASS, "font-mono", chiDoc && O_CHI_DOC, errors.serviceId && O_LOI)}
            />
            <p id={`${id}-service-id-goi-y`} className={cn("mt-1 text-xs", errors.serviceId ? "text-bo-danger" : "text-bo-muted")}>
              {errors.serviceId || "Dùng để tạo đường dẫn ủy quyền."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Mục gập "Nhập mã ủy quyền thủ công" của tài khoản thử TikTok Shop (KH mục B.3, J.1). */
function NhapMaThuCong({ maThuCong, onDoiMa, loiMa, khoa, dangChay, onKetNoi }) {
  const idMa = useId();
  return (
    <Collapsible>
      <CollapsibleTrigger className="group inline-flex items-center gap-1 rounded-md text-left text-[13px] font-medium text-bo-primary outline-none hover:text-bo-primary-hover focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:min-h-11">
        Nhập mã ủy quyền thủ công (tài khoản thử của Sandbox)
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-1.5">
        <label htmlFor={idMa} className="block text-sm font-medium text-bo-foreground">
          Mã ủy quyền
        </label>
        <div className="flex flex-wrap items-start gap-2">
          <input
            id={idMa}
            value={maThuCong}
            disabled={khoa}
            onChange={(event) => onDoiMa(event.target.value)}
            placeholder="Dán mã ủy quyền"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={Boolean(loiMa)}
            aria-describedby={`${idMa}-goi-y`}
            className={cn(INPUT_CLASS, "min-w-0 flex-1 basis-64 bg-bo-surface font-mono placeholder:font-sans", loiMa && O_LOI)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={khoa}
            onClick={onKetNoi}
            className="h-10 gap-2 rounded-lg border-bo-border bg-bo-surface px-3.5 text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11"
          >
            {dangChay ? <Loader2 className="size-4 animate-spin" /> : null}
            Kết nối bằng mã
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={khoa}
            onClick={() => onDoiMa("SANDBOX_TTS_TOKEN")}
            className="h-10 text-xs text-bo-primary hover:bg-bo-surface-subtle"
          >
            Điền mã Sandbox mẫu
          </Button>
        </div>
        <p id={`${idMa}-goi-y`} className={cn("text-xs", loiMa ? "text-bo-danger" : "text-bo-muted")}>
          {/* Nguồn mã để ở gợi ý (ô nhập hẹp trên điện thoại cắt mất placeholder dài) */}
          {loiMa || "Lấy ở Partner Center › Sandbox hoặc dùng mã thử nghiệm SANDBOX_TTS_TOKEN để kích hoạt kết nối ngay lập tức."}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Bước 1 Thiết lập của sàn ủy quyền (KH mục B.3): nhập khóa ứng dụng rồi "Ủy quyền với <sàn>" — trang chuyển sang
 * trang đồng ý của sàn, đồng ý xong sàn đưa về /channels/oauth/callback/:maKenh. TikTok Shop có thêm cách nhập tay
 * mã ủy quyền của tài khoản thử (máy chủ tắt thì gửi `choPhepMaThuCong: false`). Đã ủy quyền thì hiện gian hàng,
 * hạn ủy quyền và nút "Ủy quyền lại"; hết hạn thì khối đỏ, nút "Ủy quyền lại" là nút chính.
 * `onKetNoi(dto)`: kết nối xong ngay tại trang (nhập mã tay); `onDangChay(bool)`: báo trang cha khóa hàng nút.
 */
export default function KetNoiUyQuyenForm({ san, ketNoi, quayVeThietLap = false, onKetNoi, onDangChay }) {
  const noiDung = noiDungSan(san.maKenh);
  const coServiceId = Boolean(noiDung?.coServiceId);
  const daUyQuyen = daKetNoi(ketNoi);
  const coMaThuCong = Boolean(san.maThuCong) && ketNoi?.choPhepMaThuCong !== false;
  const [values, setValues] = useState(() => taoGiaTriKhoaUngDung(ketNoi));
  const [errors, setErrors] = useState({});
  const [ketQua, setKetQua] = useState(null);
  const [maThuCong, setMaThuCong] = useState("");
  const [loiMa, setLoiMa] = useState(null);
  const [dangChay, setDangChay] = useState(null); // "uy-quyen" | "ma"
  const dangChayRef = useRef(null);
  const khungRef = useRef(null);
  // Khóa đã lưu ở lần bấm trước: ủy quyền lỗi rồi bấm lại thì không bắt nhập lại App Secret
  const [khoaDaLuu, setKhoaDaLuu] = useState(ketNoi);

  // Ô khóa sai nằm phía trên nút vừa bấm (điện thoại: ngoài màn): đưa tiêu điểm tới ô sai đầu tiên sau khi vẽ lỗi
  const denOLoiDau = () =>
    window.requestAnimationFrame(() => {
      const o = khungRef.current?.querySelector('input[aria-invalid="true"]');
      o?.focus({ preventScroll: true });
      o?.scrollIntoView({ block: "center", behavior: "smooth" });
    });

  const doi = (name, value) => {
    setValues((cu) => ({ ...cu, [name]: value }));
    setErrors((cu) => ({ ...cu, [name]: undefined }));
  };

  /**
   * Chạy một việc, chặn bấm hai lần; `onDangChay` báo cho trang cha để khóa hàng nút. Việc trả true (trang đang chuyển
   * sang sàn) thì giữ khóa thêm một lúc rồi mới nhả: người dùng chọn ở lại, hoặc bấm Back quay về trang được trình duyệt
   * giữ nguyên (bfcache), thì nút không bị kẹt.
   */
  const nhaKhoa = () => {
    dangChayRef.current = null;
    setDangChay(null);
    onDangChay?.(false);
  };
  const chay = async (ten, viec) => {
    if (dangChayRef.current) return;
    dangChayRef.current = ten;
    setDangChay(ten);
    onDangChay?.(true);
    let dangChuyenTrang = false;
    try {
      dangChuyenTrang = Boolean(await viec());
    } finally {
      if (dangChuyenTrang) window.setTimeout(nhaKhoa, THOI_GIAN_CHO_CHUYEN_TRANG_MS);
      else nhaKhoa();
    }
  };

  /**
   * Kiểm khóa ứng dụng trước khi chạy (lúc chạy các ô bị khóa, không đặt tiêu điểm vào được). Sai thì báo tại ô,
   * đưa tiêu điểm tới ô sai đầu tiên, trả false. `canServiceId`: Service ID chỉ cần để tạo đường dẫn ủy quyền,
   * nhập mã tay thì không cần.
   */
  const khoaHopLe = ({ canServiceId = true } = {}) => {
    if (daUyQuyen) return true;
    const loi = kiemTraKhoaUngDung(values, khoaDaLuu, { coServiceId: coServiceId && canServiceId });
    setErrors(loi);
    if (!Object.keys(loi).length) return true;
    denOLoiDau();
    return false;
  };

  /**
   * Lần kết nối đầu: lưu khóa ứng dụng khi có thay đổi (khóa rỗng = giữ khóa cũ), kèm bật công tắc đồng bộ — gian hàng
   * từng tạm dừng rồi ngắt thì kết nối lại vẫn chạy. Gọi sau `khoaHopLe`.
   */
  const luuKhoaNeuCan = async () => {
    if (daUyQuyen) return;
    if (coThayDoiKhoaUngDung(values, khoaDaLuu) || Number(khoaDaLuu?.trangThai ?? 1) !== 1) {
      const dto = await kenhBanHangService.luuKhoaUngDung(san.maKenh, { ...taoPayloadKhoaUngDung(values, { coServiceId }), trangThai: 1 });
      setKhoaDaLuu((cu) => ({
        ...cu,
        ...(dto ?? {}),
        appKey: dto?.appKey ?? values.appKey.trim(),
        serviceId: dto?.serviceId ?? (values.serviceId.trim() || null),
        hasAppSecret: true,
        trangThai: 1,
      }));
      setValues((cu) => ({ ...cu, appSecret: "" }));
    }
  };

  const uyQuyen = () => {
    if (dangChayRef.current || !khoaHopLe()) return;
    chay("uy-quyen", async () => {
      setKetQua(null);
      try {
        await luuKhoaNeuCan();
        // Gian hàng đã kết nối và thiết lập xong: trang quay về báo gia hạn, đưa về Tổng quan; thiết lập còn dở
        // (`quayVeThietLap`) thì đưa lại vào Thiết lập
        await moTrangUyQuyen(san, { uyQuyenLai: daUyQuyen && !quayVeThietLap });
        return true;
      } catch (error) {
        setKetQua({ title: "Chưa mở được trang ủy quyền", message: cauLoiUyQuyen(error, `Không mở được trang ủy quyền của ${san.ten}`) });
        return false;
      }
    });
  };

  const ketNoiBangMa = () => {
    if (dangChayRef.current) return;
    if (!maThuCong.trim()) {
      setLoiMa("Dán mã ủy quyền trước khi kết nối.");
      return;
    }
    if (!khoaHopLe({ canServiceId: false })) return;
    chay("ma", async () => {
      setKetQua(null);
      try {
        await luuKhoaNeuCan();
        const dto = await kenhBanHangService.hoanTatUyQuyen(san.maKenh, { code: maThuCong.trim(), state: null });
        toast.success(`Đã kết nối gian hàng ${dto?.tenGianHang || san.ten}`);
        setMaThuCong("");
        onKetNoi(dto);
      } catch (error) {
        setKetQua({ title: "Chưa kết nối được", message: cauLoiUyQuyen(error, `Không kết nối được ${san.ten} bằng mã này`) });
      }
      return false;
    });
  };

  const khoa = Boolean(dangChay);
  const hanDen = ngayThang(ketNoi?.hanUyQuyen, { coNam: true });
  const hetHan = daUyQuyen && trangThaiKetNoi(ketNoi) === "het_han";
  const oMaThuCong = coMaThuCong ? (
    <NhapMaThuCong
      maThuCong={maThuCong}
      onDoiMa={(ma) => {
        setMaThuCong(ma);
        setLoiMa(null);
      }}
      loiMa={loiMa}
      khoa={khoa}
      dangChay={dangChay === "ma"}
      onKetNoi={ketNoiBangMa}
    />
  ) : null;

  return (
    <div ref={khungRef} className="space-y-4 px-6 pb-6 pt-3">
      <CacOKhoaUngDung
        maKenh={san.maKenh}
        values={values}
        errors={errors}
        onChange={doi}
        ketNoi={khoaDaLuu}
        disabled={khoa}
        chiDoc={daUyQuyen}
        duongDanCauHinh={`${san.duongDan}/settings`}
      />

      {daUyQuyen ? (
        <div className={cn("space-y-3 rounded-lg border px-4 py-3.5", hetHan ? "border-red-200 bg-bo-danger-soft" : "border-green-200 bg-bo-success-soft")}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            {hetHan ? (
              <CircleAlert className="size-5 shrink-0 text-bo-danger" aria-hidden="true" />
            ) : (
              <CircleCheck className="size-5 shrink-0 text-bo-success" aria-hidden="true" />
            )}
            {/* basis: màn hẹp thì nút xuống hàng dưới, chữ không bị ép thành cột hẹp */}
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-sm font-semibold text-bo-heading">{hetHan ? "Ủy quyền đã hết hạn" : "Đã ủy quyền"}</p>
              <p className="text-[13px] text-bo-muted">
                {[
                  ketNoi?.tenGianHang,
                  ketNoi?.shopIdSan ? `${noiDung?.nhanIdSan ?? "Mã gian hàng"} ${ketNoi.shopIdSan}` : null,
                  hetHan ? "bấm Ủy quyền lại để đồng bộ tiếp" : hanDen ? `ủy quyền đến ${hanDen}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button
              type="button"
              variant={hetHan ? "default" : "outline"}
              disabled={khoa}
              onClick={uyQuyen}
              className={cn(
                "h-8 gap-2 rounded-lg px-3 text-[13px] max-sm:h-11",
                hetHan ? "bg-bo-primary text-white hover:bg-bo-primary-hover" : "border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle",
              )}
            >
              {dangChay === "uy-quyen" ? <Loader2 className="size-4 animate-spin" /> : null}
              {dangChay === "uy-quyen" ? `Đang mở trang ${san.ten}…` : "Ủy quyền lại"}
            </Button>
          </div>
          {/* Tài khoản thử hết hạn: dán mã mới ngay tại đây, không phải ngắt kết nối trước */}
          {hetHan ? oMaThuCong : null}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-bo-surface-subtle p-4">
          {/* Cách ủy quyền đã nói ở mô tả thẻ; ở đây chỉ nhắc thứ tự */}
          <p className="text-[13px] text-bo-foreground">Chưa ủy quyền. Nhập khóa ứng dụng ở trên trước khi bấm nút.</p>
          <Button type="button" disabled={khoa} onClick={uyQuyen} className="h-9 gap-2 rounded-lg bg-bo-primary px-4 text-white hover:bg-bo-primary-hover max-sm:h-11">
            {dangChay === "uy-quyen" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {dangChay === "uy-quyen" ? `Đang mở trang ${san.ten}…` : `Ủy quyền với ${san.ten}`}
          </Button>
          {oMaThuCong}
        </div>
      )}

      {ketQua ? (
        <p role="alert">
          <TrangThaiCham label={[ketQua.title, ketQua.message].filter(Boolean).join(". ")} tone="danger" className="whitespace-normal" />
        </p>
      ) : null}

      {noiDung?.hanUyQuyen ? <p className="text-xs text-bo-muted">{noiDung.hanUyQuyen}</p> : null}
    </div>
  );
}
