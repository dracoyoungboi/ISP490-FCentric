import { useEffect, useState } from "react";
import { CircleAlert, Info, Layers, PackageOpen, RotateCw } from "lucide-react";

import StatusBadge from "@/components/shared/StatusBadge";
import LoadingState from "@/components/shared/LoadingState";
import { thongKeHeThongService } from "@/services/thongKeHeThongService";
import { formatCurrency, formatDate, formatNumber } from "@/utils/formatters";
import { t, tDuLieu } from "@/i18n";
import { VAI_TRO_XEM_GIA_VON } from "@/constants/vaiTroTheoNghiepVu";
import { hasAnyRole } from "@/utils/roles";

const TH = "h-8 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

/**
 * Các lô đang tồn của một mã ở một kho — phần sổ xuống khi bấm một dòng của Báo cáo tồn kho.
 *
 * - Tải khi mở (GET /thong-ke-he-thong/ton-kho-tong-quan/lo). Kết quả nhớ ở trang (`nho`, `onNho`) theo lần tải bảng
 *   `lanTai`: đóng rồi mở lại không gọi máy chủ; bảng tải lại (⟳, quay lại tab) thì dòng đang mở tải lại lô của nó,
 *   trong lúc chờ vẫn giữ danh sách cũ.
 * - Mã có On Hand ≤ 0 không có lô nào còn tồn: hiện ngay trạng thái rỗng, không gọi máy chủ.
 * - Cộng tồn các lô = On Hand, cộng giá trị = Giá trị tồn của dòng. Free to Use tính cho cả mã (cộng đang về, trừ
 *   đơn đang giữ) nên không chia theo lô — ghi một dòng giải thích dưới bảng.
 */
export default function BangLoTonKho({ item, so, trungChuyen = false, dienThoai = false, nho, onNho, lanTai }) {
    const { khoId, bienTheId } = item;
    const khoa = `${khoId}-${bienTheId}`;
    const [lanThu, setLanThu] = useState(0);
    const [loi, setLoi] = useState(null);

    const hetHang = so.onHand <= 0;
    const moiNhat = nho?.lanTai === lanTai;

    useEffect(() => {
        if (hetHang || moiNhat) return undefined;
        let huy = false;
        thongKeHeThongService.getLoTheoMa({ khoId, bienTheId })
            .then((res) => { if (!huy) onNho(khoa, { lanTai, ds: res.data?.data ?? [] }); })
            .catch((err) => { if (!huy) setLoi({ lanTai, lanThu, err }); });
        return () => { huy = true; };
    }, [khoId, bienTheId, khoa, hetHang, moiNhat, lanTai, lanThu, onNho]);

    const ds = hetHang ? [] : nho?.ds;
    const coLoi = !hetHang && !moiNhat && loi && loi.lanTai === lanTai && loi.lanThu === lanThu;
    const tenKho = tDuLieu(item.tenKho);

    let than;
    if (coLoi && !ds) {
        const cau = loi.err?.response?.data?.message;
        than = (
            <div className="flex flex-wrap items-center gap-3 px-4 py-4 text-sm" role="alert">
                <CircleAlert className="size-[18px] shrink-0 text-bo-danger" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-bo-foreground">
                    {cau || t("Không tải được danh sách lô. Kiểm tra kết nối rồi thử lại.")}
                </p>
                {loi.err?.response?.status === 403 ? null : (
                    <button
                        type="button"
                        onClick={() => setLanThu((n) => n + 1)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-bo-input-border bg-bo-surface px-3 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle"
                    >
                        <RotateCw className="size-3.5" aria-hidden="true" />
                        {t("Thử lại")}
                    </button>
                )}
            </div>
        );
    } else if (!ds) {
        than = <LoadingState className="min-h-[112px]" label={t("Đang tải các lô")} />;
    } else if (ds.length === 0) {
        than = (
            <div className="flex items-center gap-3 px-4 py-4 text-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400" aria-hidden="true">
                    <PackageOpen className="size-[18px]" />
                </span>
                <p className="font-medium text-bo-foreground">{t("Không có lô hàng tồn kho tại kho này")}</p>
            </div>
        );
    } else {
        than = dienThoai ? (
            <DanhSachLoDienThoai ds={ds} so={so} trungChuyen={trungChuyen} />
        ) : (
            // Máy tính bảng cảm ứng dưới 1024px: bảng chính đã bỏ bớt cột để khỏi vuốt ngang, phần lô cũng dùng dạng
            // danh sách như điện thoại
            <>
                <div className="cam-ung:max-lg:hidden"><BangLo ds={ds} so={so} trungChuyen={trungChuyen} /></div>
                <div className="hidden cam-ung:max-lg:block"><DanhSachLoDienThoai ds={ds} so={so} trungChuyen={trungChuyen} /></div>
            </>
        );
    }

    const dauBang = (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-bo-border px-3 py-2 text-[13px] text-bo-foreground">
            <Layers className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
                {ds && ds.length > 0
                    ? t("{{count}} lô đang tồn tại {{kho}}", { count: ds.length, kho: tenKho })
                    : t("Các lô đang tồn tại {{kho}}", { kho: tenKho })}
            </span>
            {ds && ds.length > 1 ? <span className="text-bo-muted">· {t("lô vào kho trước ở trên")}</span> : null}
        </div>
    );

    return (
        <div
            id={`lo-${khoa}`}
            role="region"
            aria-label={t("Các lô của {{sku}}", { sku: item.maSku })}
            aria-busy={!ds && !coLoi}
            className={dienThoai
                ? "mt-2 overflow-hidden rounded-lg border border-bo-border bg-bo-surface"
                // Đứng yên khi cuộn ngang bảng, rộng đúng phần đang thấy: 100cqw là bề rộng khung bảng (lớp @container)
                : "sticky left-10 w-[calc(100cqw-3.25rem)] overflow-hidden rounded-md border border-bo-border bg-bo-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] cam-ung:max-lg:left-2 cam-ung:max-lg:w-[calc(100cqw-1.5rem)]"}
        >
            {dauBang}
            {than}
        </div>
    );
}

/** Ô kệ: "A-02-03 × 14"; phần chưa xếp kệ ghi "Chưa có kệ × 6"; lô ở Kho Trung Chuyển đang đi đường, không có kệ. */
function OKe({ lo, trungChuyen }) {
    if (trungChuyen) return <span className="text-bo-muted">{t("Đang vận chuyển")}</span>;
    const chuaCoKe = Number(lo.soChuaCoKe ?? 0);
    return (
        <div className="flex flex-wrap gap-1">
            {(lo.ke ?? []).map((k) => (
                <span key={k.viTriKhoId} className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    <span className="font-mono font-semibold text-slate-700">{k.maViTri}</span>
                    <span className="text-bo-muted">× {formatNumber(k.soLuong)}</span>
                </span>
            ))}
            {chuaCoKe > 0 ? (
                <span
                    className="inline-flex items-center whitespace-nowrap rounded bg-bo-warning-soft px-1.5 py-0.5 text-xs font-medium text-bo-warning"
                    title={t("Đã vào kho nhưng chưa xếp lên kệ")}
                >
                    {t("Chưa có kệ × {{so}}", { so: formatNumber(chuaCoKe) })}
                </span>
            ) : null}
        </div>
    );
}

/** Tình trạng của lô: Đang kiểm kê (lô có phần thuộc đợt kiểm kê đang mở) hoặc Hoạt động. */
function TinhTrangLo({ lo }) {
    if (Number(lo.soLuongDangKiemKe ?? 0) > 0) {
        return (
            <span title={t("Đợt {{ma}}: phần này tạm không bán, xuất hay chuyển được tới khi đợt kết thúc.", { ma: lo.maDotKiemKe ?? "—" })}>
                {/* i18n-giu-nguyen: nhãn StatusBadge (badge tự dịch lúc vẽ, tra màu theo tên Việt) */}
                <StatusBadge label="Đang kiểm kê" />
            </span>
        );
    }
    // i18n-giu-nguyen: nhãn StatusBadge (badge tự dịch lúc vẽ, tra màu theo tên Việt)
    return <StatusBadge label="Hoạt động" />;
}

/** Dòng phụ dưới số tồn: phần đang giữ cho phiếu xuất / quầy, phần đang kiểm kê khi chỉ một phần lô bị kiểm. */
function GhiChuTon({ lo }) {
    const giu = Number(lo.soLuongDangGiu ?? 0);
    const kiem = Number(lo.soLuongDangKiemKe ?? 0);
    const ton = Number(lo.soLuongTon ?? 0);
    return (
        <>
            {giu > 0 ? (
                <span className="block whitespace-nowrap text-[11px] font-medium text-amber-700" title={t("Đã gắn cho phiếu xuất hoặc đơn tại quầy, chưa xuất xong")}>
                    {t("Đang giữ {{so}}", { so: formatNumber(giu) })}
                </span>
            ) : null}
            {kiem > 0 && kiem < ton ? (
                <span className="block whitespace-nowrap text-[11px] font-medium text-amber-700">
                    {t("Đang kiểm kê {{so}}", { so: formatNumber(kiem) })}
                </span>
            ) : null}
        </>
    );
}

function tongCua(ds) {
    return ds.reduce(
        (s, lo) => {
            const ton = Number(lo.soLuongTon ?? 0);
            return { ton: s.ton + ton, giaTri: s.giaTri + ton * Number(lo.giaVon ?? 0) };
        },
        { ton: 0, giaTri: 0 },
    );
}

function GhiChuFreeToUse({ so }) {
    return t("Free to Use {{free}} = tồn {{ton}} + đang về {{ve}} − đang xuất {{xuat}}. Số này tính cho cả mã nên không chia theo lô.", {
        free: formatNumber(so.freeToUse),
        ton: formatNumber(so.onHand),
        ve: formatNumber(so.incoming),
        xuat: formatNumber(so.outgoing),
    });
}

function BangLo({ ds, so, trungChuyen }) {
    const tong = tongCua(ds);
    // Giá vốn lô là số nội bộ: nhân viên bán hàng không thấy (máy chủ cũng không gửi, SRS 2.4.1)
    const xemGiaVon = hasAnyRole(VAI_TRO_XEM_GIA_VON);
    return (
        <>
            <div className="overflow-x-auto">
                {/* Hai dòng mỗi ô (như bảng chính) để vừa khung trên máy tính xách tay 1280px không phải cuộn ngang */}
                <table className="w-full min-w-[760px] text-[13px]">
                    <thead>
                        <tr className="border-b border-bo-border">
                            <th className={`${TH} text-left`}>{t("Mã lô / Nhà cung cấp")}</th>
                            <th className={`${TH} text-left`}>{t("Kệ")}</th>
                            <th className={`${TH} text-left`}>{t("Ngày nhập / SX")}</th>
                            <th className={`${TH} text-right`}>{t("Tồn")}</th>
                            {xemGiaVon ? (
                                <>
                                    <th className={`${TH} text-right`}>{t("Giá vốn")}</th>
                                    <th className={`${TH} text-right`}>{t("Giá trị tồn")}</th>
                                </>
                            ) : null}
                            <th className={`${TH} text-left`}>{t("Tình trạng")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {ds.map((lo) => {
                            const ton = Number(lo.soLuongTon ?? 0);
                            return (
                                <tr key={lo.loHangId}>
                                    <td className="px-3 py-2">
                                        <span className="block whitespace-nowrap font-mono text-xs font-semibold text-slate-700">{lo.maLo}</span>
                                        {lo.tenNhaCungCap ? (
                                            <span className="mt-0.5 block max-w-[200px] truncate text-xs text-bo-muted" title={lo.tenNhaCungCap}>
                                                {tDuLieu(lo.tenNhaCungCap)}
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="min-w-[136px] px-3 py-2"><OKe lo={lo} trungChuyen={trungChuyen} /></td>
                                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                                        <span className="block text-slate-700">{formatDate(lo.ngayNhap)}</span>
                                        {lo.ngaySanXuat ? (
                                            <span className="mt-0.5 block text-xs text-bo-muted">{t("SX {{ngay}}", { ngay: formatDate(lo.ngaySanXuat) })}</span>
                                        ) : null}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                                        <span className="font-semibold text-bo-foreground">{formatNumber(ton)}</span>
                                        <GhiChuTon lo={lo} />
                                    </td>
                                    {xemGiaVon ? (
                                        <>
                                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">{formatCurrency(lo.giaVon ?? 0)}</td>
                                            <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-bold tabular-nums text-bo-foreground">
                                                {formatCurrency(ton * Number(lo.giaVon ?? 0))}
                                            </td>
                                        </>
                                    ) : null}
                                    <td className="px-3 py-2"><TinhTrangLo lo={lo} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-bo-border bg-bo-surface-subtle font-semibold text-bo-foreground">
                            <td className="px-3 py-2" colSpan={3}>{t("Cộng {{count}} lô", { count: ds.length })}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatNumber(tong.ton)}</td>
                            {xemGiaVon ? (
                                <>
                                    <td />
                                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-bold tabular-nums">{formatCurrency(tong.giaTri)}</td>
                                </>
                            ) : null}
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p className="flex items-start gap-1.5 border-t border-bo-border px-3 py-2 text-xs leading-5 text-bo-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <GhiChuFreeToUse so={so} />
            </p>
        </>
    );
}

function DanhSachLoDienThoai({ ds, so, trungChuyen }) {
    const tong = tongCua(ds);
    const xemGiaVon = hasAnyRole(VAI_TRO_XEM_GIA_VON);
    return (
        <>
            <ul className="divide-y divide-bo-border">
                {ds.map((lo) => {
                    const ton = Number(lo.soLuongTon ?? 0);
                    const phu = [
                        t("Nhập {{ngay}}", { ngay: formatDate(lo.ngayNhap) }),
                        lo.ngaySanXuat ? t("SX {{ngay}}", { ngay: formatDate(lo.ngaySanXuat) }) : null,
                        lo.tenNhaCungCap ? tDuLieu(lo.tenNhaCungCap) : null,
                    ].filter(Boolean).join(" · ");
                    return (
                        <li key={lo.loHangId} className="px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <span className="break-all font-mono text-xs font-semibold text-slate-700">{lo.maLo}</span>
                                <TinhTrangLo lo={lo} />
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-[13px] text-bo-muted">{phu}</p>
                            <div className="mt-1.5 text-[13px]"><OKe lo={lo} trungChuyen={trungChuyen} /></div>
                            <div className="mt-1.5 flex items-start justify-between gap-2 text-[13px]">
                                <span className="text-bo-muted">
                                    {t("Tồn")} <b className="font-semibold tabular-nums text-bo-foreground">{formatNumber(ton)}</b>
                                    <GhiChuTon lo={lo} />
                                </span>
                                {xemGiaVon ? (
                                    <span className="whitespace-nowrap font-semibold tabular-nums text-bo-foreground">
                                        {formatCurrency(ton * Number(lo.giaVon ?? 0))}
                                    </span>
                                ) : null}
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="flex items-baseline justify-between gap-2 border-t border-bo-border bg-bo-surface-subtle px-3 py-2 text-[13px] font-semibold tabular-nums text-bo-foreground">
                <span>{t("Cộng {{count}} lô", { count: ds.length })} · {formatNumber(tong.ton)}</span>
                {xemGiaVon ? <span className="whitespace-nowrap">{formatCurrency(tong.giaTri)}</span> : null}
            </div>
            <p className="border-t border-bo-border px-3 py-2 text-xs leading-5 text-bo-muted">
                <GhiChuFreeToUse so={so} />
            </p>
        </>
    );
}
