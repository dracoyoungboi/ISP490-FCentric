import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, ChevronDown, FileText } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";

import apiClient from "@/services/apiClient";
import purchaseOrderService from "@/services/purchaseOrderService";
import { cachXuLyLoiXetBaoGia, taoBodyXetBaoGia } from "@/components/order/chi-tiet-bao-gia/tinhBaoGia";

import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import CotThuocTinh, { ChungTuLienQuan, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import BangHangTaoPhieu from "@/components/chung-tu/BangHangTaoPhieu";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { soVN, tuBienThe } from "@/components/chung-tu/bangChungTu";
import { NHAN_O, O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import { formatCurrency } from "@/utils/formatters";
import { t } from "@/i18n";

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Ô chọn gốc của trình duyệt nhưng bỏ mũi tên mặc định (Windows vẽ thành ô vuông), thay bằng ChevronDown
const O_CHON = cn(O_NHAP, "cursor-pointer appearance-none pr-9");
const TONG_BANG = Object.freeze({ soLuong: "soLuong", thanhTien: "thanhTien" });
const so = (x) => Number(x) || 0;

/**
 * Tạo đơn mua hàng (/purchase-orders/create?id=): chọn một báo giá đã nhận (đơn mua trạng thái 2) để chốt giá với nhà
 * cung cấp. Khối chứng từ "một khối" như các màn tạo / chi tiết khác.
 * Nghiệp vụ giữ như cũ: PUT duyệt đơn sang 3 kèm ngayBaoGiaDaXem (taoBodyXetBaoGia); 409 / 404 (báo giá vừa đổi, đã có
 * kết quả, không còn) thì đóng hộp, bỏ chọn và tải lại danh sách (cachXuLyLoiXetBaoGia). Nút giữ tên "Chấp nhận & Tạo Đơn".
 */
export default function PurchaseOrderCreateManual() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // --- States ---
    const [quotationList, setQuotationList] = useState([]);
    const [selectedQuotation, setSelectedQuotation] = useState(null);

    const [loading, setLoading] = useState(true);
    const [loiTai, setLoiTai] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [loiXacNhan, setLoiXacNhan] = useState(null);

    const [form, setForm] = useState({
        quotationId: "",
        ghiChu: "",
    });

    const loadQuotationDetails = useCallback(async (id) => {
        setActionLoading(true);
        try {
            const res = await apiClient.get(`/api/v1/don-mua-hang/get-by-id/${id}`);
            const data = res.data?.data || res.data;

            setSelectedQuotation(data);
            setForm(prev => ({
                ...prev,
                quotationId: data.id,
            }));
        } catch {
            toast.error(t("Không thể tải chi tiết báo giá"));
            setSelectedQuotation(null);
            setForm(prev => ({ ...prev, quotationId: "" }));
        } finally {
            setActionLoading(false);
        }
    }, []);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        setLoiTai(false);
        try {
            // Lấy trực tiếp danh sách Đơn mua hàng (Báo giá) có trạng thái = 2 (Đã nhận báo giá)
            const res = await apiClient.post('/api/v1/don-mua-hang/filter', {
                filters: [{ fieldName: "trangThai", operation: "EQUALS", value: 2, logicType: "AND" }],
                sorts: [{ fieldName: "ngayCapNhat", direction: "DESC" }],
                page: 0, size: 1000
            });

            setQuotationList(res.data?.data?.content || res.data?.content || []);

            // Auto-fill nếu URL có truyền sẵn ID
            const initialId = searchParams.get("id");
            if (initialId) {
                await loadQuotationDetails(initialId);
            }
        } catch {
            toast.error(t("Không thể tải danh sách báo giá"));
            setLoiTai(true);
        } finally {
            setLoading(false);
        }
    }, [loadQuotationDetails, searchParams]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    useEffect(() => {
        queueMicrotask(() => fetchInitialData());
    }, [fetchInitialData]);

    // ── Bảng hàng: dòng chứng từ (gom theo sản phẩm, màu / cỡ / ảnh) ──
    const dongBang = useMemo(() => (selectedQuotation?.chiTietDonMuaHangs || []).map((ct, i) => ({
        ...tuBienThe(ct.bienTheSanPham),
        id: ct.id ?? `dong-${i}`,
        soLuong: so(ct.soLuongDat),
        donGia: so(ct.donGia),
        thanhTien: ct.thanhTien != null ? so(ct.thanhTien) : so(ct.soLuongDat) * so(ct.donGia),
    })), [selectedQuotation]);
    const bangHang = useBangChungTu(dongBang, { tongTheo: TONG_BANG });

    const handleSelectQuotation = (id) => {
        bangHang.xoaTuKhoa();
        if (!id) {
            setSelectedQuotation(null);
            setForm(prev => ({ ...prev, quotationId: "" }));
            return;
        }
        loadQuotationDetails(id);
    };

    const handleCreate = () => {
        if (!form.quotationId) return toast.error(t("Vui lòng chọn một báo giá từ danh sách"));
        setLoiXacNhan(null);
        setShowConfirmDialog(true);
    };

    const confirmCreate = async () => {
        setSubmitting(true);
        setLoiXacNhan(null);
        try {
            // Máy chủ chỉ chấp nhận khi ngayBaoGiaDaXem trùng báo giá hiện có (nhà cung cấp có thể vừa gửi lại)
            await purchaseOrderService.duyetDon(
                form.quotationId,
                3,
                taoBodyXetBaoGia({ ngayBaoGiaDaXem: selectedQuotation?.ngayBaoGia }),
            );

            toast.success(t("Đã chấp nhận báo giá và tạo đơn mua hàng."));
            setShowConfirmDialog(false);
            setTimeout(() => navigate(`/purchase-orders/${form.quotationId}`), 1000);
        } catch (err) {
            const cau = err.response?.data?.message || t("Không thể tạo đơn mua hàng. Vui lòng thử lại.");
            // 409 / 404: báo giá vừa đổi, đã có kết quả hoặc không còn — bỏ chọn và tải lại danh sách báo giá đang chờ,
            // lần bấm sau dùng dữ liệu mới nhất (như màn Chi tiết báo giá)
            if (cachXuLyLoiXetBaoGia(err.response?.status) === "dongVaTaiLai") {
                toast.error(cau);
                setShowConfirmDialog(false);
                setSelectedQuotation(null);
                setForm(prev => ({ ...prev, quotationId: "" }));
                fetchInitialData();
            } else {
                // Lỗi khác: báo ngay trong hộp để người dùng thử lại
                setLoiXacNhan(cau);
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <LoadingState rows={4} label={t("Đang tải dữ liệu khởi tạo")} />
            </PageContainer>
        );
    }

    const ncc = selectedQuotation?.nhaCungCap;
    const yeuCau = selectedQuotation?.yeuCauMuaHang;
    const lyDoKhoa = actionLoading
        ? t("Đang tải báo giá")
        : !form.quotationId || !selectedQuotation
            ? t("Chọn báo giá")
            : dongBang.length === 0
                ? t("Báo giá chưa có sản phẩm")
                : "";

    const dongPhu = selectedQuotation
        ? [
            t("Chốt báo giá đã nhận với nhà cung cấp"),
            `${t("{{soSanPham}} sản phẩm", { count: bangHang.tong.soSanPham, soSanPham: soVN(bangHang.tong.soSanPham) })} · ${t("{{soBienThe}} biến thể", { count: bangHang.tong.soDong, soBienThe: soVN(bangHang.tong.soDong) })}`,
            t("Tổng số lượng {{soLuong}}", { soLuong: soVN(bangHang.tong.soLuong) }),
        ]
        : t("Chọn một báo giá đã nhận để chốt giá và tạo đơn mua hàng");

    const thongBao = loiTai ? [
        <DongThongBao key="loi-tai" tone="bad" actions={<NutChu onClick={fetchInitialData}>{t("Thử lại")}</NutChu>}>
            {t("Không tải được danh sách báo giá đã nhận.")}
        </DongThongBao>,
    ] : null;

    const chonBaoGia = (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-bo-border px-4 py-4 sm:px-6">
            <label className="relative grid w-full min-w-0 gap-1.5 sm:w-[480px]">
                <span className={NHAN_O}>
                    {t("Báo giá đã nhận")} <span className="text-bo-danger">*</span>
                </span>
                <select
                    className={O_CHON}
                    value={form.quotationId}
                    onChange={(e) => handleSelectQuotation(e.target.value)}
                    disabled={actionLoading}
                >
                    <option value="">{quotationList.length ? t("Chọn báo giá cần chốt") : loiTai ? t("Chưa tải được danh sách báo giá") : t("Không có báo giá nào đang chờ chốt")}</option>
                    {quotationList.map(q => (
                        <option key={q.id} value={q.id}>
                            {q.soDonMua} · {q.nhaCungCap?.tenNhaCungCap || t("Chưa rõ nhà cung cấp")}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute bottom-2.5 right-3 size-4 text-bo-muted" aria-hidden="true" />
            </label>
        </div>
    );

    const bang = !selectedQuotation ? (
        <EmptyState
            icon={FileText}
            title={actionLoading ? t("Đang tải báo giá…") : t("Chưa chọn báo giá")}
            description={t("Chỉ hiện báo giá nhà cung cấp đã gửi và đang chờ chốt.")}
            className="min-h-[280px] flex-1"
        />
    ) : (
        <BangHangTaoPhieu
            bang={bangHang}
            nhan={t("Hàng trong báo giá")}
            tenChungTu={t("Báo giá")}
            rongToiThieu="@2xl/khoi:min-w-[620px]"
            cot={[
                {
                    ma: "sl", nhan: t("SL duyệt"), lop: "w-24 text-right",
                    nhom: (n) => soVN(n.tong.soLuong), dong: (d) => soVN(d.soLuong),
                },
                {
                    ma: "gia", nhan: t("Đơn giá"), lop: "w-36 text-right whitespace-nowrap", anHep: true,
                    nhom: () => null, dong: (d) => formatCurrency(d.donGia),
                    phuHep: (d) => t("Đơn giá {{donGia}}", { donGia: formatCurrency(d.donGia) }),
                },
                {
                    ma: "tien", nhan: t("Thành tiền"), lop: "w-40 text-right whitespace-nowrap",
                    nhom: (n) => formatCurrency(n.tong.thanhTien), dong: (d) => formatCurrency(d.thanhTien),
                },
            ]}
        />
    );

    const cotPhai = selectedQuotation ? (
        <CotThuocTinh nhan={t("Thông tin báo giá")}>
            <NhomThuocTinh nhan={t("Nhà cung cấp")}>
                <div className="text-sm font-semibold text-bo-foreground">{ncc?.tenNhaCungCap || "—"}</div>
                {ncc?.maNhaCungCap ? <div className="mt-0.5 font-mono text-xs text-bo-muted">{ncc.maNhaCungCap}</div> : null}
            </NhomThuocTinh>
            <NhomThuocTinh nhan={t("Tổng tiền báo giá")}>
                <div className="text-xl font-semibold tabular-nums tracking-tight text-bo-foreground">
                    {formatCurrency(selectedQuotation.tongTien)}
                </div>
            </NhomThuocTinh>
            <ChungTuLienQuan
                ds={yeuCau ? [{
                    khoa: "yeu-cau",
                    loai: t("Yêu cầu mua hàng gốc"),
                    ma: yeuCau.soYeuCauMuaHang || `#${yeuCau.id}`,
                    to: yeuCau.id ? `/purchase-requests/${yeuCau.id}` : undefined,
                }] : []}
            />
        </CotThuocTinh>
    ) : null;

    return (
        <PageContainer className="flex min-h-full flex-col">
            <KhungChungTu
                dau={
                    <DauChungTu
                        ma={t("Tạo đơn mua hàng")}
                        dongPhu={dongPhu}
                        onQuayLai={() => navigate("/purchase-orders")}
                        nhanQuayLai={t("Quay lại danh sách")}
                        nutChinh={{
                            ma: "tao",
                            nhan: t("Chấp nhận & Tạo Đơn"),
                            icon: CheckCircle,
                            onClick: handleCreate,
                            khoa: Boolean(lyDoKhoa) || submitting,
                            lyDo: lyDoKhoa || undefined,
                            hienLyDo: true,
                            dangChay: actionLoading || submitting,
                        }}
                    />
                }
                tienTrinh={chonBaoGia}
                thongBao={thongBao}
                chinh={bang}
                cotPhai={cotPhai}
            />

            <HopXacNhanChungTu
                mo={showConfirmDialog}
                onDoiMo={(mo) => { if (!mo) { setShowConfirmDialog(false); setLoiXacNhan(null); } }}
                tieuDe={t("Xác nhận tạo đơn hàng")}
                moTa={selectedQuotation
                    ? t("Chốt báo giá {{soDonMua}} của {{tenNcc}}, tổng {{tongTien}}. Đơn mua hàng được tạo theo đúng giá và số lượng trong báo giá.", { soDonMua: selectedQuotation.soDonMua, tenNcc: ncc?.tenNhaCungCap || t("nhà cung cấp"), tongTien: formatCurrency(selectedQuotation.tongTien) })
                    : ""}
                nhanXacNhan={t("Xác nhận")}
                iconXacNhan={CheckCircle}
                dangChay={submitting}
                loi={loiXacNhan}
                onXacNhan={confirmCreate}
            />
        </PageContainer>
    );
}
