import { useId } from "react";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { BANG, DONG, DONG_TIEU_DE, KHUNG_CUON, O, O_CUOI, O_DAU, O_TIEU_DE } from "@/components/chung-tu/kieuBang";
import { TT_CHUYEN } from "@/constants/phieuChuyenKho";
import { tongCot } from "@/components/chuyen-kho/hienThiChuyenKho";
import { cn } from "@/lib/utils";

const NHAN_O = "text-bo-tt-chu-y-chu font-semibold";

/**
 * Mục "Hàng chuyển" của chi tiết phiếu (B.1), một dòng mỗi biến thể: Gửi; khi đang nhặt (Đã duyệt) thêm Đã nhặt; khi
 * hàng đã rời kho thêm Nhận · Hỏng · Còn trên đường (phần đang ở kho trung chuyển). Số do máy chủ tính (PhieuChuyenKhoDto.DongHang).
 */
export default function BangHangPhieuChuyen({ ct }) {
    const idBang = useId();
    const tt = ct.trangThai;
    const hang = ct.hang ?? [];
    const coNhat = tt === TT_CHUYEN.DA_DUYET;
    const coNhan = [TT_CHUYEN.DANG_VAN_CHUYEN, TT_CHUYEN.CHO_XU_LY_LECH, TT_CHUYEN.HOAN_TAT].includes(tt)
        || (tt === TT_CHUYEN.DA_HUY && ct.huyKhiDangChuyen);
    const daNhan = [TT_CHUYEN.CHO_XU_LY_LECH, TT_CHUYEN.HOAN_TAT].includes(tt);
    const toDam = tt === TT_CHUYEN.CHO_XU_LY_LECH;
    const tong = tongCot(hang, "soLuongChuyen");

    return (
        <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
                <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">Hàng chuyển</h2>
                <span className="text-[13px] leading-5 text-bo-muted">
                    {soVN(hang.length)} biến thể · {soVN(tong)} sản phẩm
                </span>
            </div>
            <div className={KHUNG_CUON}>
                <table className={cn(BANG, coNhan ? "min-w-[640px]" : "min-w-[440px]")}>
                    <thead>
                        <tr className={DONG_TIEU_DE}>
                            <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>Sản phẩm</th>
                            {coNhat ? <th scope="col" className={cn(O_TIEU_DE, "w-24 text-right")}>Đã nhặt</th> : null}
                            <th scope="col" className={cn(O_TIEU_DE, "w-24 text-right", !coNhan && O_CUOI)}>Gửi</th>
                            {coNhan ? (
                                <>
                                    <th scope="col" className={cn(O_TIEU_DE, "w-24 text-right")}>Nhận</th>
                                    <th scope="col" className={cn(O_TIEU_DE, "w-24 text-right")}>Hỏng</th>
                                    <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-32 text-right")}>Còn trên đường</th>
                                </>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {hang.map((d) => {
                            const du = Number(d.daNhat) >= Number(d.soLuongChuyen);
                            return (
                                <tr key={d.bienTheId} className={DONG}>
                                    <td className={cn(O, O_DAU)}>
                                        <div className="flex min-w-0 items-center gap-3">
                                            <AnhBienThe src={d.anh} bienThe={d} co="sm" />
                                            <div className="min-w-0">
                                                <div className="truncate font-medium text-bo-foreground" title={d.tenSanPham}>{d.tenSanPham}</div>
                                                <div className="flex flex-wrap items-center gap-x-2 text-xs text-bo-muted">
                                                    <MauKichCo dong={d} />
                                                    <span className="font-mono">{d.sku}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    {coNhat ? (
                                        <td className={cn(O, "text-right", du && "font-semibold text-bo-success")}>{soVN(d.daNhat)}</td>
                                    ) : null}
                                    <td className={cn(O, "text-right", !coNhan && O_CUOI)}>{soVN(d.soLuongChuyen)}</td>
                                    {coNhan ? (
                                        <>
                                            <td className={cn(O, "text-right")}>{daNhan ? soVN(d.daNhan) : "—"}</td>
                                            <td className={cn(O, "text-right", toDam && Number(d.hong) > 0 && NHAN_O)}>{daNhan ? soVN(d.hong) : "—"}</td>
                                            <td className={cn(O, O_CUOI, "text-right", toDam && Number(d.conTrenDuong) > 0 && NHAN_O)}>{soVN(d.conTrenDuong)}</td>
                                        </>
                                    ) : null}
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-bo-border font-semibold tabular-nums text-bo-foreground">
                            <td className={cn(O, O_DAU)}>Tổng</td>
                            {coNhat ? <td className={cn(O, "text-right")}>{soVN(tongCot(hang, "daNhat"))}</td> : null}
                            <td className={cn(O, "text-right", !coNhan && O_CUOI)}>{soVN(tong)}</td>
                            {coNhan ? (
                                <>
                                    <td className={cn(O, "text-right")}>{daNhan ? soVN(tongCot(hang, "daNhan")) : "—"}</td>
                                    <td className={cn(O, "text-right")}>{daNhan ? soVN(tongCot(hang, "hong")) : "—"}</td>
                                    <td className={cn(O, O_CUOI, "text-right")}>{soVN(tongCot(hang, "conTrenDuong"))}</td>
                                </>
                            ) : null}
                        </tr>
                    </tfoot>
                </table>
            </div>
            {[TT_CHUYEN.CHO_DUYET, TT_CHUYEN.DA_DUYET].includes(tt) ? (
                <p className="px-4 pb-4 pt-2 text-xs leading-4 text-bo-muted sm:px-6">* Việc chọn lô hàng cụ thể được thực hiện khi nhặt hàng tại kho xuất.</p>
            ) : null}
        </section>
    );
}
