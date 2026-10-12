import { Controller } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BrandSelector from "@/components/brand/BrandSelector";
import { cn } from "@/lib/utils";
import {
    CONTROL_CLASS,
    DO_DAI_TEN_TOI_DA,
    NUT_LIEN_KET_LOI_CLASS,
    SELECT_CONTENT_CLASS,
    SELECT_ITEM_CLASS,
    SELECT_TRIGGER_CLASS,
    chanKyTuKhongPhaiSoNguyen,
    cuonToiLoi,
} from "./kieuForm";

/**
 * Các ô thông tin cơ bản dùng chung cho form Thêm và form Chỉnh sửa sản phẩm (react-hook-form).
 */

const NhanBatBuoc = () => <span className="text-bo-danger">*</span>;

function LoiTruong({ loi }) {
    return loi ? <p className="text-xs text-bo-danger">{loi.message}</p> : null;
}

export function TruongTenSanPham({ control, loi, disabled }) {
    return (
        <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tenSanPham">
                Tên sản phẩm <NhanBatBuoc />
            </Label>
            <Controller
                name="tenSanPham"
                control={control}
                render={({ field }) => (
                    <div className="relative">
                        <Input
                            {...field}
                            id="tenSanPham"
                            placeholder="VD: Áo khoác gió unisex"
                            maxLength={DO_DAI_TEN_TOI_DA}
                            autoComplete="off"
                            disabled={disabled}
                            aria-invalid={loi ? true : undefined}
                            className={cn(CONTROL_CLASS, "pr-16")}
                        />
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-bo-muted"
                        >
                            {field.value?.length ?? 0}/{DO_DAI_TEN_TOI_DA}
                        </span>
                    </div>
                )}
            />
            <LoiTruong loi={loi} />
        </div>
    );
}

export function TruongDanhMuc({ control, loi, disabled, danhMucs, dangTai }) {
    return (
        <div className="space-y-2">
            <Label htmlFor="danhMucId">
                Danh mục <NhanBatBuoc />
            </Label>
            <Controller
                name="danhMucId"
                control={control}
                render={({ field }) => (
                    <Select
                        value={field.value === "" || field.value == null ? "" : String(field.value)}
                        // Radix gọi onValueChange("") khi giá trị đang chọn chưa có trong danh sách (danh sách tải sau): bỏ qua.
                        onValueChange={(value) => {
                            if (value !== "") field.onChange(Number(value));
                        }}
                        disabled={disabled}
                    >
                        <SelectTrigger id="danhMucId" aria-invalid={loi ? true : undefined} className={SELECT_TRIGGER_CLASS}>
                            <SelectValue placeholder="Chọn danh mục" />
                        </SelectTrigger>
                        <SelectContent position="popper" side="bottom" align="start" className={`${SELECT_CONTENT_CLASS} max-h-[300px]`}>
                            {danhMucs.length === 0 ? (
                                <div className="p-2 text-center text-sm text-bo-muted">
                                    {dangTai ? "Đang tải danh mục…" : "Không có danh mục nào đang hoạt động"}
                                </div>
                            ) : (
                                danhMucs.map((danhMuc) => (
                                    <SelectItem
                                        key={danhMuc.id}
                                        value={danhMuc.id.toString()}
                                        className={cn(SELECT_ITEM_CLASS, danhMuc.level === 0 && "font-semibold text-bo-foreground")}
                                    >
                                        {danhMuc.displayTitle}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                )}
            />
            <LoiTruong loi={loi} />
        </div>
    );
}

export function TruongThuongHieu({ control, disabled, thuongHieuHienTai = null }) {
    return (
        <div className="space-y-2">
            <Label htmlFor="thuongHieuId">Thương hiệu</Label>
            <Controller
                name="thuongHieuId"
                control={control}
                render={({ field }) => (
                    <BrandSelector
                        id="thuongHieuId"
                        value={field.value ?? null}
                        onChange={(id) => field.onChange(id)}
                        disabled={disabled}
                        fallbackBrand={thuongHieuHienTai}
                    />
                )}
            />
        </div>
    );
}

export function TruongMucTon({ control, loi, disabled }) {
    return (
        <div className="space-y-2">
            <Label htmlFor="mucTonToiThieu">Mức tồn tối thiểu</Label>
            <Controller
                name="mucTonToiThieu"
                control={control}
                render={({ field }) => (
                    <Input
                        {...field}
                        id="mucTonToiThieu"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        placeholder="0"
                        disabled={disabled}
                        aria-invalid={loi ? true : undefined}
                        onKeyDown={chanKyTuKhongPhaiSoNguyen}
                        className={CONTROL_CLASS}
                    />
                )}
            />
            <LoiTruong loi={loi} />
        </div>
    );
}

export function TruongMoTa({ control, disabled }) {
    return (
        <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="moTa">Mô tả</Label>
            <Controller
                name="moTa"
                control={control}
                render={({ field }) => (
                    <Textarea
                        {...field}
                        id="moTa"
                        placeholder="Chất liệu, form dáng, hướng dẫn giặt..."
                        rows={3}
                        disabled={disabled}
                        className={CONTROL_CLASS}
                    />
                )}
            />
        </div>
    );
}

/**
 * Khung tổng hợp lỗi ở đầu form. Bấm vào một lỗi để cuộn tới đúng chỗ cần sửa.
 * @param {number} soLoiCoBan số ô thông tin cơ bản đang lỗi (gộp thành 1 mục)
 * @param {{id: string, oFocus?: string, thongBao: string}[]} danhSachLoi các lỗi còn lại
 */
export function TomTatLoi({ soLoiCoBan, danhSachLoi }) {
    if (soLoiCoBan === 0 && danhSachLoi.length === 0) return null;
    return (
        <div role="alert" className="flex gap-2 rounded-lg border border-bo-danger/30 bg-bo-danger-soft p-3 text-sm text-bo-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bo-danger" aria-hidden="true" />
            <div className="space-y-1">
                <p className="font-semibold">Cần sửa {danhSachLoi.length + (soLoiCoBan > 0 ? 1 : 0)} mục trước khi lưu</p>
                <ul className="list-disc space-y-0.5 pl-4">
                    {soLoiCoBan > 0 && (
                        <li>
                            <button type="button" className={NUT_LIEN_KET_LOI_CLASS} onClick={() => cuonToiLoi("khu-thong-tin")}>
                                Thông tin cơ bản còn {soLoiCoBan} ô chưa hợp lệ.
                            </button>
                        </li>
                    )}
                    {danhSachLoi.map((loi) => (
                        <li key={`${loi.id}-${loi.thongBao}`}>
                            <button type="button" className={NUT_LIEN_KET_LOI_CLASS} onClick={() => cuonToiLoi(loi.id, loi.oFocus)}>
                                {loi.thongBao}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
