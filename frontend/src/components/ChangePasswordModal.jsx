import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { nguoiDungService } from "@/services/nguoiDungService";
import { getApiErrorMessage } from "@/utils/apiError";
import { GOI_Y_MAT_KHAU, kiemTraMatKhauMoi } from "@/utils/matKhau";
import { cn } from "@/lib/utils";


const O_NHAP =
  "h-10 border-bo-input-border bg-white pr-10 text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20";
const NHAN = "mb-1.5 block text-[13px] font-medium leading-[18px] text-slate-700";
const DONG_PHU = "mt-1.5 flex items-start gap-1 text-xs leading-[17px]";
// Màn cảm ứng: nút dạng chữ ("Quên mật khẩu hiện tại?") chạm được 44px nhờ đệm dọc, lề âm bù lại nên khoảng cách giữa các ô không đổi
const NUT_CHU =
  "rounded text-xs font-medium text-bo-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-bo-primary/40 cam-ung:min-h-0! cam-ung:py-[calc((44px-1lh)/2)] cam-ung:-my-[calc((44px-1lh)/2)]";

const TRONG = { hienTai: "", moi: "", xacNhan: "" };

/** Lỗi máy chủ nói về mật khẩu hiện tại / tạm thời thì gắn vào ô đó thay vì báo chung ở cuối hộp. */
const laLoiMatKhauHienTai = (thongDiep) => /hiện tại|tạm thời|cũ|không đúng|sai mật khẩu/i.test(thongDiep || "");

function NutXem({ hien, onClick, disabled, nhan }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={hien ? `Ẩn ${nhan}` : `Hiện ${nhan}`}
      aria-pressed={hien}
      className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-bo-muted outline-none transition-colors hover:text-bo-foreground focus-visible:ring-2 focus-visible:ring-bo-primary/40 disabled:opacity-50"
    >
      {hien ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
    </button>
  );
}

/**
 * Hộp Đổi mật khẩu của người đang đăng nhập (làm lại 31/10/2026 theo NIST SP 800-63B / OWASP):
 * - lỗi báo ngay dưới từng ô (kiểm tra khi rời ô, sửa thì lỗi mất),
 *   bấm Đổi mật khẩu mà còn lỗi thì con trỏ nhảy về ô sai đầu tiên; lỗi "mật khẩu hiện tại không đúng" từ máy chủ
 *   cũng gắn vào ô đó;
 * - chính sách mật khẩu ở utils/matKhau.js (8–64 ký tự, có chữ và số, không phổ biến, không chứa tên đăng nhập / email,
 *   khác mật khẩu hiện tại), gợi ý ngắn hiện sẵn dưới ô Mật khẩu mới; không tự cắt khoảng trắng (chỉ nhắc);
 * - báo Caps Lock đang bật; có lối "Quên mật khẩu hiện tại?" (hỏi lại bằng một dòng chữ, rồi đăng xuất và sang trang
 *   lấy lại mật khẩu);
 * - đang gửi thì không đóng được hộp; ô ẩn tên đăng nhập giúp trình quản lý mật khẩu lưu đúng tài khoản.
 * `forceChange`: bắt đổi mật khẩu tạm (không có Hủy, không đóng bằng Esc / bấm ra ngoài).
 */
export default function ChangePasswordModal({ open, onOpenChange, onSuccess, forceChange = false, tenDangNhap = "", email = "" }) {
  const navigate = useNavigate();
  const [mk, setMk] = useState(TRONG);
  const [hien, setHien] = useState({ hienTai: false, moi: false, xacNhan: false });
  const [loi, setLoi] = useState(TRONG);
  const [loiChung, setLoiChung] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [oDangGo, setODangGo] = useState("");
  const [hoiQuen, setHoiQuen] = useState(false);
  const refs = { hienTai: useRef(null), moi: useRef(null), xacNhan: useRef(null) };

  // Mở lại hộp thì xóa sạch (pattern "adjust state during render")
  const [moTruoc, setMoTruoc] = useState(open);
  if (open !== moTruoc) {
    setMoTruoc(open);
    if (open) {
      setMk(TRONG);
      setHien({ hienTai: false, moi: false, xacNhan: false });
      setLoi(TRONG);
      setLoiChung("");
      setCapsLock(false);
      setHoiQuen(false);
    }
  }

  const nhanHienTai = forceChange ? "Mật khẩu tạm thời (trong email)" : "Mật khẩu hiện tại";

  const kiemTra = (k, gt = mk) => {
    if (k === "hienTai") return gt.hienTai ? "" : forceChange ? "Nhập mật khẩu tạm thời trong email." : "Nhập mật khẩu hiện tại.";
    if (k === "moi") return kiemTraMatKhauMoi(gt.moi, { tenDangNhap, email, matKhauHienTai: gt.hienTai });
    if (!gt.xacNhan) return "Nhập lại mật khẩu mới.";
    return gt.xacNhan === gt.moi ? "" : "Chưa khớp với mật khẩu mới.";
  };

  const go = (k) => (e) => {
    const gt = { ...mk, [k]: e.target.value };
    setMk(gt);
    setLoiChung("");
    // Đang có lỗi thì kiểm tra lại ngay để lỗi mất khi đã sửa đúng; chưa có lỗi thì đợi rời ô
    setLoi((cu) => {
      const moi = { ...cu };
      if (cu[k]) moi[k] = kiemTra(k, gt);
      if (k === "moi" && cu.xacNhan && gt.xacNhan) moi.xacNhan = kiemTra("xacNhan", gt);
      return moi;
    });
  };

  // Rời ô: chỉ THÊM lỗi khi đã gõ gì đó (ô trống chưa chạm tới thì để yên đến lúc bấm Đổi mật khẩu). Không xóa lỗi
  // khi rời ô — lỗi chỉ mất khi sửa nội dung — để dòng lỗi (vd. "mật khẩu hiện tại không đúng" từ máy chủ) không biến
  // mất đúng lúc người dùng bấm nút bên dưới làm nút nhảy chỗ, bấm trượt.
  const roi = (k) => () => {
    setODangGo("");
    const l = mk[k] ? kiemTra(k) : "";
    if (l) setLoi((cu) => ({ ...cu, [k]: l }));
  };

  const theoDoiCaps = (e) => {
    if (typeof e.getModifierState === "function") setCapsLock(e.getModifierState("CapsLock"));
  };

  const dong = (mo) => {
    if (!mo && (dangGui || forceChange)) return;
    onOpenChange(mo);
  };

  const gui = async (e) => {
    e.preventDefault();
    if (dangGui) return;
    const ketQua = { hienTai: kiemTra("hienTai"), moi: kiemTra("moi"), xacNhan: kiemTra("xacNhan") };
    setLoi(ketQua);
    setLoiChung("");
    const oSai = ["hienTai", "moi", "xacNhan"].find((k) => ketQua[k]);
    if (oSai) {
      refs[oSai].current?.focus();
      return;
    }
    setDangGui(true);
    try {
      // Gửi đúng như người dùng gõ (không cắt khoảng trắng): đăng nhập sau này cũng gửi nguyên văn
      await nguoiDungService.changePassword({ currentPassword: mk.hienTai, newPassword: mk.moi });
      setMk(TRONG);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const thongDiep = getApiErrorMessage(err, "Không đổi được mật khẩu. Vui lòng thử lại.");
      if (err?.response?.status === 400 && laLoiMatKhauHienTai(thongDiep)) {
        setLoi((cu) => ({ ...cu, hienTai: thongDiep.replace(/\.?$/, ".") }));
        refs.hienTai.current?.focus();
        refs.hienTai.current?.select();
      } else {
        setLoiChung(thongDiep);
      }
    } finally {
      setDangGui(false);
    }
  };

  const quenMatKhau = async () => {
    await nguoiDungService.logoutServer();
    nguoiDungService.logout();
    onOpenChange(false);
    navigate("/forgot-password", { replace: true });
  };

  const o = (k, nhan, autoComplete, phu) => {
    const coLoi = Boolean(loi[k]);
    const idPhu = `doi-mk-${k}-phu`;
    return (
      <div>
        <label htmlFor={`doi-mk-${k}`} className={NHAN}>
          {nhan}
        </label>
        <div className="relative">
          <Input
            ref={refs[k]}
            id={`doi-mk-${k}`}
            type={hien[k] ? "text" : "password"}
            autoComplete={autoComplete}
            value={mk[k]}
            onChange={go(k)}
            onBlur={roi(k)}
            onFocus={() => setODangGo(k)}
            onKeyDown={theoDoiCaps}
            onKeyUp={theoDoiCaps}
            // Đang gửi: chỉ đọc (không disabled) để khi máy chủ báo sai vẫn đặt lại được con trỏ vào ô
            readOnly={dangGui}
            aria-busy={dangGui || undefined}
            spellCheck={false}
            aria-invalid={coLoi}
            aria-describedby={idPhu}
            className={cn(O_NHAP, coLoi && "border-bo-danger focus-visible:border-bo-danger focus-visible:ring-bo-danger/20")}
          />
          <NutXem
            hien={hien[k]}
            nhan={nhan.toLowerCase()}
            disabled={dangGui}
            onClick={() => setHien((cu) => ({ ...cu, [k]: !cu[k] }))}
          />
        </div>
        <div id={idPhu} aria-live="polite">
          {coLoi ? (
            <p className={cn(DONG_PHU, "text-bo-danger")}>
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {loi[k]}
            </p>
          ) : (
            phu
          )}
          {capsLock && oDangGo === k ? <p className={cn(DONG_PHU, "font-medium text-orange-800")}>Caps Lock đang bật.</p> : null}
        </div>
      </div>
    );
  };

  const coDauCach = mk.moi && mk.moi !== mk.moi.trim();

  return (
    <Dialog open={open} onOpenChange={dong}>
      <DialogContent
        className="bg-bo-surface text-bo-foreground sm:max-w-md"
        showCloseButton={!forceChange}
        onInteractOutside={(e) => {
          if (forceChange || dangGui) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (forceChange || dangGui) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{forceChange ? "Đổi mật khẩu tạm thời" : "Đổi mật khẩu"}</DialogTitle>
          <DialogDescription className="text-bo-muted">
            {forceChange
              ? "Bạn đang dùng mật khẩu tạm thời. Đặt mật khẩu riêng để tiếp tục dùng FCentric."
              : "Sau khi đổi, các thiết bị khác đang đăng nhập sẽ phải đăng nhập lại."}
          </DialogDescription>
        </DialogHeader>

        <form id="form-doi-mat-khau" onSubmit={gui} noValidate className="flex flex-col gap-4">
          {/* Tên đăng nhập ẩn: trình quản lý mật khẩu biết lưu mật khẩu mới cho tài khoản nào */}
          {tenDangNhap ? (
            <input type="text" name="username" autoComplete="username" value={tenDangNhap} readOnly hidden />
          ) : null}

          <div>
            {o("hienTai", nhanHienTai, "current-password")}
            {hoiQuen ? (
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs leading-[17px] text-slate-600">
                <span>Cần đăng xuất để lấy lại mật khẩu qua email.</span>
                <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
                  <button type="button" onClick={quenMatKhau} aria-label="Đăng xuất để lấy lại mật khẩu" className={NUT_CHU}>
                    Đăng xuất
                  </button>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => setHoiQuen(false)}
                    aria-label="Không lấy lại mật khẩu"
                    className={cn(NUT_CHU, "text-slate-500")}
                  >
                    Hủy
                  </button>
                </span>
              </p>
            ) : (
              <button type="button" onClick={() => setHoiQuen(true)} disabled={dangGui} className={cn(NUT_CHU, "mt-1.5")}>
                {forceChange ? "Không tìm thấy mật khẩu tạm thời?" : "Quên mật khẩu hiện tại?"}
              </button>
            )}
          </div>

          {o(
            "moi",
            "Mật khẩu mới",
            "new-password",
            <>
              {GOI_Y_MAT_KHAU ? <p className={cn(DONG_PHU, "text-bo-muted")}>{GOI_Y_MAT_KHAU}</p> : null}
              {coDauCach ? (
                <p className={cn(DONG_PHU, "text-orange-800")}>Mật khẩu có dấu cách ở đầu hoặc cuối — sẽ được giữ nguyên.</p>
              ) : null}
            </>,
          )}

          {o("xacNhan", "Nhập lại mật khẩu mới", "new-password")}

          {loiChung ? (
            <Alert className="border-bo-danger/30 bg-bo-danger-soft">
              <AlertCircle className="size-4 text-bo-danger" />
              <AlertDescription className="text-bo-danger">{loiChung}</AlertDescription>
            </Alert>
          ) : null}
        </form>

        <DialogFooter className="gap-2">
          {!forceChange ? (
            <Button
              type="button"
              variant="outline"
              disabled={dangGui}
              onClick={() => onOpenChange(false)}
              className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
            >
              Hủy
            </Button>
          ) : null}
          <Button type="submit" form="form-doi-mat-khau" disabled={dangGui} className="bg-bo-primary text-white hover:bg-bo-primary-hover">
            {dangGui ? "Đang đổi mật khẩu..." : "Đổi mật khẩu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
