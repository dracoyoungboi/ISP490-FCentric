import { useId, useRef } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { NHAN_O, O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import { MO_TA_TOI_DA, SO_ANH_TOI_DA } from "@/components/chuyen-kho/anhBienBan";
import { cn } from "@/lib/utils";

/**
 * Ô "Ảnh chụp" của biên bản giao nhận (mockup B.4): nút máy ảnh mở chọn ảnh (điện thoại mở được máy ảnh), ảnh xem trước
 * bỏ được, mỗi ảnh một ô mô tả ngắn không bắt buộc, tối đa SO_ANH_TOI_DA ảnh tính cả ảnh biên bản đã có (`daCo`).
 * `daCo` tăng sau khi đã chọn (máy chủ vừa có thêm ảnh) mà vượt giới hạn: báo số ảnh phải bỏ bớt (nơi gọi khóa nút tải).
 * `anh`: kết quả useAnhChon. `khoa`: đang gửi, khóa mọi thao tác.
 */
export default function ChonAnhBienBan({ anh, daCo = 0, khoa = false, nhan = "Ảnh chụp", nhanNut = "Thêm ảnh (không bắt buộc)" }) {
    const oTepRef = useRef(null);
    const idNhan = useId();
    const tong = daCo + anh.ds.length;
    const day = tong >= SO_ANH_TOI_DA;
    const vuot = Math.max(0, tong - SO_ANH_TOI_DA);

    const chonTep = (e) => {
        const tep = Array.from(e.target.files ?? []);
        // Xóa giá trị để chọn lại đúng ảnh vừa bỏ vẫn nhận
        e.target.value = "";
        if (tep.length) anh.them(tep, daCo);
    };

    return (
        <div role="group" aria-labelledby={idNhan} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
                <span id={idNhan} className={NHAN_O}>{nhan}</span>
                <span className={cn("text-xs tabular-nums", vuot ? "font-medium text-bo-danger" : "text-bo-muted")}>{tong}/{SO_ANH_TOI_DA} ảnh</span>
            </div>
            {anh.ds.length ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {anh.ds.map((a, i) => (
                        <li key={a.khoa} className="grid min-w-0 gap-1.5 rounded-lg border border-bo-border p-1.5">
                            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-bo-canvas">
                                <img src={a.url} alt={`Ảnh ${daCo + i + 1}`} className="size-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => anh.bo(a.khoa)}
                                    disabled={khoa}
                                    aria-label={`Bỏ ảnh ${daCo + i + 1}`}
                                    title="Bỏ ảnh"
                                    // Nút hiện 28 px nhưng vùng bấm 40 px (lớp ::after nới ra mỗi bên 6 px, phần tràn ngoài ảnh bị cắt)
                                    className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white after:absolute after:-inset-1.5 hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            </div>
                            <input
                                value={a.moTa}
                                maxLength={MO_TA_TOI_DA}
                                onChange={(e) => anh.doiMoTa(a.khoa, e.target.value)}
                                disabled={khoa}
                                aria-label={`Mô tả ảnh ${daCo + i + 1} (không bắt buộc)`}
                                placeholder="Mô tả ngắn"
                                className={cn(O_NHAP, "h-8 px-2 text-[13px]")}
                            />
                        </li>
                    ))}
                </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <button
                    type="button"
                    onClick={() => oTepRef.current?.click()}
                    disabled={khoa || day || anh.dangXuLy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {anh.dangXuLy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
                    {anh.dangXuLy ? "Đang xử lý ảnh…" : nhanNut}
                </button>
                {vuot ? (
                    <span className="text-xs text-bo-danger">
                        Biên bản đã có {daCo} ảnh, tối đa {SO_ANH_TOI_DA}: bỏ bớt {vuot} ảnh rồi mới tải lên được.
                    </span>
                ) : day ? (
                    <span className="text-xs text-bo-muted">Đã đủ {SO_ANH_TOI_DA} ảnh.</span>
                ) : null}
                <input
                    ref={oTepRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={chonTep}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                />
            </div>
        </div>
    );
}
