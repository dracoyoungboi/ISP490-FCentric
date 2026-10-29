import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Square, Trash2, Upload } from "lucide-react";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { toast } from "@/lib/thongBaoNhanh";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { CAU_HET_THOI_HAN, chayCoThoiHan, laLoiHetThoiHan } from "@/components/chung-tu/thoiHanThaoTac";
import { AnhThuNho, HopXemBangChung } from "@/components/outbound/dong-goi/XemBangChung";
import { SO_ANH_TOI_DA, taiLanLuot } from "@/components/chuyen-kho/anhBienBan";
import { gioNgayNgan } from "@/components/chuyen-kho/hienThiChuyenKho";
import { lamViecTaiKho } from "@/components/chuyen-kho/lamViecTaiKho";
import useAnhChon from "@/components/chuyen-kho/useAnhChon";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import ChonAnhBienBan from "./ChonAnhBienBan";

const NUT_DUNG = "inline-flex h-8 items-center gap-1.5 rounded-md border border-bo-border bg-bo-surface px-2.5 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30";
const tenAnh = (a, i) => a.moTa || `Ảnh ${i + 1}`;
/** Ảnh biên bản theo dạng bằng chứng đóng gói để dùng lại khung xem của màn Đóng gói. */
const bangChungCua = (a) => ({ urlPublic: a.url, tenNguoiTao: a.nguoiChup, ngayTao: a.ngayChup });

/**
 * Ảnh chụp của biên bản giao nhận ở chi tiết phiếu chuyển (khối Biên bản giao nhận): ảnh thu nhỏ, bấm xem lớn; nút
 * "Thêm ảnh" khi máy chủ cho (quyen.themAnhBienBan, chưa đủ SO_ANH_TOI_DA ảnh): chọn ảnh → hộp xem trước, mô tả → tải
 * lần lượt (nút "Dừng tải" khi mạng chậm, ảnh chưa tải giữ trong hộp); nút xóa trên ảnh người xem xóa được
 * (anh.duocXoa). Thêm / xóa xong gọi `onDaDoi` để màn tải lại chi tiết.
 */
export default function AnhBienBanGiaoNhan({ ct, onDaDoi }) {
    const bb = ct.bienBan;
    const ds = bb?.anh ?? [];
    const duocThem = Boolean(ct.quyen?.themAnhBienBan);
    const chon = useAnhChon();
    const oTepRef = useRef(null);
    const daGoRef = useRef(false);
    // Hủy lần tải ảnh đang chạy (nút Dừng tải)
    const dungTaiRef = useRef(null);
    const [moThem, setMoThem] = useState(false);
    const [xem, setXem] = useState(null);
    const [hoiXoa, setHoiXoa] = useState(null); // { anh, ten }
    const [dangChay, setDangChay] = useState(false);
    const [tienDo, setTienDo] = useState(null);
    const [loi, setLoi] = useState(null);

    useEffect(() => {
        daGoRef.current = false;
        return () => {
            daGoRef.current = true;
        };
    }, []);

    if (!bb) return null;

    // Máy chủ vừa có thêm ảnh (người khác thêm, lần tải trước dừng giữa chừng): ảnh đang chọn có thể vượt giới hạn
    const vuot = Math.max(0, ds.length + chon.ds.length - SO_ANH_TOI_DA);

    const chonTep = async (e) => {
        const tep = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (!tep.length) return;
        const moi = await chon.them(tep, ds.length);
        if (moi.length && !daGoRef.current) {
            setLoi(null);
            setMoThem(true);
        }
    };

    const dongThem = () => {
        chon.xoaHet();
        setMoThem(false);
        setLoi(null);
    };

    async function taiLen() {
        lamViecTaiKho(ct.khoNhap);
        setDangChay(true);
        setLoi(null);
        setTienDo({ xong: 0, tong: chon.ds.length });
        const dieuKhien = new AbortController();
        dungTaiRef.current = dieuKhien;
        const { daTai, loi: dsLoi, daDung } = await taiLanLuot(
            chon.ds,
            (a) => phieuChuyenKhoService.themAnhBienBan(ct.id, a.file, a.moTa, { signal: dieuKhien.signal }),
            (xong, tong) => !daGoRef.current && setTienDo({ xong, tong }),
            dieuKhien.signal,
        );
        dungTaiRef.current = null;
        if (daGoRef.current) return;
        setDangChay(false);
        setTienDo(null);
        // Dừng giữa chừng: ảnh đang gửi có thể đã tới máy chủ, tải lại để hiện đúng ảnh đã có
        if (daTai.length || daDung) onDaDoi?.();
        if (!dsLoi.length) {
            toast.success(`Đã thêm ${daTai.length} ảnh vào biên bản ${bb.soBienBan}`);
            dongThem();
            return;
        }
        // Giữ ảnh chưa tải được trong hộp để thử lại, kèm câu của máy chủ (vd. đã đủ ảnh, biên bản vừa được xử lý)
        chon.boNhieu(daTai.map((a) => a.khoa));
        const daThem = daTai.length ? `Đã thêm ${daTai.length} ảnh. ` : "";
        if (daDung) {
            setLoi(`${daThem}Đã dừng tải, ${dsLoi.length} ảnh chưa tải được vẫn ở trong hộp để thử lại.`);
            return;
        }
        const cau = getApiErrorMessage(dsLoi[0].loi, "Không tải được ảnh lên");
        setLoi(`${daThem}${dsLoi.length} ảnh chưa tải được: ${cau}`);
    }

    async function xoaAnh() {
        lamViecTaiKho(ct.khoNhap);
        setDangChay(true);
        setLoi(null);
        try {
            await chayCoThoiHan(() => phieuChuyenKhoService.xoaAnhBienBan(ct.id, hoiXoa.anh.id));
            if (daGoRef.current) return;
            toast.success("Đã xóa ảnh khỏi biên bản");
            setHoiXoa(null);
            onDaDoi?.();
        } catch (e) {
            if (daGoRef.current) return;
            if (laLoiHetThoiHan(e)) {
                setHoiXoa(null);
                toast.error(CAU_HET_THOI_HAN, { description: "Ảnh có thể đã được xóa. Màn tự tải lại để hiện đúng ảnh còn lại." });
                onDaDoi?.();
                return;
            }
            setLoi(getApiErrorMessage(e, "Không xóa được ảnh"));
            // Biên bản vừa được xử lý hoặc ảnh đã bị xóa ở nơi khác: tải lại để màn hiện đúng
            const trangThai = getApiErrorStatus(e);
            if (trangThai === 409 || trangThai === 404) onDaDoi?.();
        } finally {
            if (!daGoRef.current) setDangChay(false);
        }
    }

    return (
        <div className="mt-3 grid gap-2">
            <div className="flex items-center justify-between gap-2 text-[13px] leading-5">
                <span className="text-bo-muted">Ảnh chụp</span>
                {ds.length ? <span className="text-xs tabular-nums text-bo-muted">{ds.length}/{SO_ANH_TOI_DA}</span> : null}
            </div>
            {ds.length ? (
                <ul className="grid grid-cols-3 gap-1.5">
                    {ds.map((a, i) => (
                        <li key={a.id} className="relative">
                            <button
                                type="button"
                                onClick={() => setXem({ ten: tenAnh(a, i), laVideo: false, bangChung: bangChungCua(a), tenTep: [bb.soBienBan, `anh-${i + 1}`] })}
                                title={[tenAnh(a, i), a.nguoiChup, a.ngayChup ? gioNgayNgan(a.ngayChup) : null].filter(Boolean).join(" · ")}
                                aria-label={`Xem ${tenAnh(a, i)}`}
                                className="block aspect-square w-full overflow-hidden rounded-md border border-bo-border bg-bo-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                            >
                                <AnhThuNho bc={bangChungCua(a)} laVideo={false} ten={tenAnh(a, i)} />
                            </button>
                            {a.duocXoa ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLoi(null);
                                        setHoiXoa({ anh: a, ten: tenAnh(a, i) });
                                    }}
                                    aria-label={`Xóa ${tenAnh(a, i)}`}
                                    title="Xóa ảnh"
                                    // Nút hiện 24 px nhưng vùng bấm 36 px (lớp ::after nới ra mỗi bên 6 px)
                                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white after:absolute after:-inset-1.5 hover:bg-bo-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                >
                                    <Trash2 className="size-3.5" aria-hidden="true" />
                                </button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="m-0 text-[13px] leading-5 text-bo-muted">{duocThem ? "Chưa có ảnh." : "Không có ảnh."}</p>
            )}
            {duocThem && ds.length < SO_ANH_TOI_DA ? (
                <div>
                    <button
                        type="button"
                        onClick={() => oTepRef.current?.click()}
                        disabled={chon.dangXuLy}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-bo-border bg-bo-surface px-2.5 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {chon.dangXuLy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
                        {chon.dangXuLy ? "Đang xử lý ảnh…" : "Thêm ảnh"}
                    </button>
                    <input ref={oTepRef} type="file" accept="image/*" multiple onChange={chonTep} tabIndex={-1} aria-hidden="true" className="sr-only" />
                </div>
            ) : null}

            <HopXemBangChung o={xem} onDong={() => setXem(null)} />

            {moThem ? (
                <HopXacNhanChungTu
                    mo
                    onDoiMo={(m) => !m && dongThem()}
                    tieuDe="Thêm ảnh vào biên bản"
                    moTa={`Ảnh lưu kèm biên bản ${bb.soBienBan}; ai xem được phiếu chuyển đều xem được ảnh.`}
                    nhanXacNhan={chon.ds.length ? `Tải ${chon.ds.length} ảnh lên` : "Tải ảnh lên"}
                    iconXacNhan={Upload}
                    rong
                    // Đang xử lý ảnh vừa chọn cũng khóa đóng hộp (Quay lại, Esc), để ảnh xử lý xong không rơi vào hộp đã đóng
                    dangChay={dangChay || chon.dangXuLy}
                    khoaXacNhan={!chon.ds.length || vuot > 0}
                    lyDoKhoa={vuot > 0 ? `Quá ${SO_ANH_TOI_DA} ảnh, bỏ bớt ${vuot} ảnh` : "Chọn ít nhất một ảnh"}
                    loi={loi}
                    onXacNhan={taiLen}
                >
                    <ChonAnhBienBan anh={chon} daCo={ds.length} khoa={dangChay} nhanNut="Chọn thêm ảnh" />
                    {/* Vùng đọc tiến độ luôn có sẵn (chỉ thay chữ) để trình đọc màn hình đọc được ngay lần đầu */}
                    <div className={tienDo ? "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5" : "sr-only"}>
                        <p aria-live="polite" className="m-0 text-[13px] tabular-nums text-bo-muted">
                            {tienDo ? `Đang tải ảnh ${tienDo.xong}/${tienDo.tong}…` : ""}
                        </p>
                        {tienDo ? (
                            <button type="button" onClick={() => dungTaiRef.current?.abort()} className={NUT_DUNG}>
                                <Square className="size-3.5" aria-hidden="true" />
                                Dừng tải
                            </button>
                        ) : null}
                    </div>
                </HopXacNhanChungTu>
            ) : null}

            {hoiXoa ? (
                <HopXacNhanChungTu
                    mo
                    onDoiMo={(m) => {
                        if (!m) {
                            setHoiXoa(null);
                            setLoi(null);
                        }
                    }}
                    tieuDe="Xóa ảnh khỏi biên bản"
                    moTa={`Xóa "${hoiXoa.ten}" khỏi biên bản ${bb.soBienBan}. Ảnh đã xóa không khôi phục được.`}
                    nhanXacNhan="Xóa ảnh"
                    iconXacNhan={Trash2}
                    kieu="nguyHiem"
                    dangChay={dangChay}
                    loi={loi}
                    onXacNhan={xoaAnh}
                >
                    <div className="mx-auto size-32 overflow-hidden rounded-md border border-bo-border bg-bo-canvas">
                        <AnhThuNho bc={bangChungCua(hoiXoa.anh)} laVideo={false} ten={hoiXoa.ten} />
                    </div>
                </HopXacNhanChungTu>
            ) : null}
        </div>
    );
}
