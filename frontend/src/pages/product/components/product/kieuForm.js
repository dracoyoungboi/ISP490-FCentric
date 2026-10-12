/**
 * Hằng số giao diện và tiện ích dùng chung cho form Thêm và form Chỉnh sửa sản phẩm.
 */

export const DO_DAI_TEN_TOI_DA = 200; // cột ten_san_pham là varchar(200)
export const THOI_GIAN_DONG_HOP_THOAI = 200; // ms, khớp duration-200 của DialogContent

// Viền khi focus và khi ô bị lỗi theo màu chung của hệ thống. Select/Button dựng sẵn mặc định lấy màu chữ
// làm vòng focus (vòng đậm màu tối) và không đổi viền khi lỗi, nên phải đặt rõ ở đây.
export const VIEN_FOCUS = "focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15";
export const VIEN_LOI =
    "aria-invalid:border-bo-danger aria-invalid:focus-visible:border-bo-danger aria-invalid:focus-visible:ring-bo-danger/15";
export const CONTROL_CLASS = `border-bo-border bg-white text-bo-foreground placeholder:text-bo-muted ${VIEN_FOCUS} ${VIEN_LOI}`;
export const SELECT_TRIGGER_CLASS = `h-9 w-full border-bo-border text-bo-foreground ${VIEN_FOCUS} ${VIEN_LOI}`;
export const NUT_VIEN_CLASS = `border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle ${VIEN_FOCUS}`;
export const NUT_LIEN_KET_LOI_CLASS =
    "rounded-sm text-left underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary";
export const SELECT_CONTENT_CLASS = "z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
export const SELECT_ITEM_CLASS = "rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
export const LOP_FORM = "space-y-5 [&_[data-slot=select-trigger]]:bg-white [&_[data-slot=textarea]]:bg-white";

// Ô số nguyên: chặn các ký tự trình duyệt vẫn cho gõ vào input type=number.
const KY_TU_KHONG_HOP_LE_SO_NGUYEN = new Set(["e", "E", "+", "-", ".", ","]);
export const chanKyTuKhongPhaiSoNguyen = (e) => {
    if (KY_TU_KHONG_HOP_LE_SO_NGUYEN.has(e.key)) e.preventDefault();
};

// Chỗ đặt con trỏ khi bấm vào một lỗi trong khung tổng hợp
export const O_CHON_MAU = "[data-o-chon-mau]";
export const O_NUT_KICH_CO = "button[aria-pressed]";
export const O_ANH_MAU = "[data-o-anh-mau]";
export const O_THIEU_GIA = "[data-thieu-gia]";
const O_CO_THE_FOCUS =
    "input:not([type=hidden]):not([type=file]):not(:disabled), textarea:not(:disabled), button:not(:disabled)";

/** Cuộn tới khu vực có lỗi rồi đặt con trỏ vào ô cần sửa: ô được chỉ định, ô đang báo lỗi, hoặc ô đầu tiên. */
export function cuonToiLoi(id, oFocus) {
    const khu = document.getElementById(id);
    if (!khu) return;
    khu.scrollIntoView({ behavior: "smooth", block: "center" });
    const o =
        (oFocus && khu.querySelector(oFocus)) ||
        khu.querySelector('[aria-invalid="true"]') ||
        khu.querySelector(O_CO_THE_FOCUS);
    o?.focus({ preventScroll: true });
}

/** Dữ liệu trong ResponseData của backend (một số API trả thẳng mảng). */
export const layDuLieu = (response) => response?.data?.data ?? response?.data ?? [];

/** Gộp danh sách đang hoạt động với các mục đang được dùng (có thể đã ngừng hoạt động), không trùng id. */
export function gopTheoId(dsChinh, dsBoSung) {
    const ketQua = [...dsChinh];
    const daCo = new Set(dsChinh.map((x) => x.id));
    for (const x of dsBoSung) {
        if (!x || daCo.has(x.id)) continue;
        daCo.add(x.id);
        ketQua.push(x);
    }
    return ketQua;
}
