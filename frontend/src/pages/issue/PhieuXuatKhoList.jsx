import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, SearchX } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import AttentionBar from "@/components/shared/AttentionBar";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LocKhoangNgay from "@/components/shared/LocKhoangNgay";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { Button } from "@/components/ui/button";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { PHIEU_XUAT_KHO_TABS, getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiDanhSach from "@/hooks/useTaiLaiDanhSach";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import apiClient from "@/services/apiClient";
import { getKhoList, getMineKhoList } from "@/services/khoService";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { formatDate } from "@/utils/formatters";
import { getCurrentUserId } from "@/utils/roles";
import { t } from "@/i18n";

const SEARCH_DEBOUNCE_MS = 350;

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=
const TAB_MAS = PHIEU_XUAT_KHO_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
// Phiếu xuất bán hàng đã đóng gói, chờ xác nhận xuất kho (mã 6)
const TAB_CHO_XUAT = "cho-xuat-kho";
const TONE_TAB = { [TAB_CHO_XUAT]: "warning" };
// Vai trò xử lý phiếu chờ xuất kho (thấy dòng chú ý)
const VAI_TRO_XUAT_KHO = ["quan_ly_kho", "nhan_vien_kho"];

const trangThaiCuaTab = (ma) => PHIEU_XUAT_KHO_TABS.find((tab) => tab.ma === ma)?.trangThai ?? null;

// Loại phiếu trên URL ?loai= (đọc như ?trangThai=): "Việc cần xử lý" ở Tổng quan mở phiếu bán hàng Nháp / Chờ xuất
// (?loai=ban-hang) để số dòng khớp số máy chủ đếm (chỉ phiếu loai_xuat = ban_hang). `loaiXuat` là giá trị gửi API.
const LOAI_PHIEU = [
    { value: "tat-ca", label: t("Tất cả loại phiếu"), loaiXuat: null },
    { value: "ban-hang", label: t("Xuất bán hàng"), loaiXuat: "ban_hang" },
    { value: "chuyen-kho", label: t("Xuất chuyển kho"), loaiXuat: "chuyen_kho" },
];
const LOAI_MAS = LOAI_PHIEU.map((loai) => loai.value);
const LOAI_MAC_DINH = "tat-ca";
const loaiXuatCua = (ma) => LOAI_PHIEU.find((loai) => loai.value === ma)?.loaiXuat ?? null;

function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(" ") ? vaiTro.split(" ") : [vaiTro];
}

// Điều kiện lọc dùng chung cho danh sách, số trên tab và dòng chú ý.
// API chỉ nhận MỘT trạng thái, lọc được một loại xuất (loaiXuat), một kho (kho.id) và khoảng ngày xuất.
function buildFilterPayload({ keyword, khoId, tuNgay, denNgay, trangThai, loaiXuat, page, size }) {
    const filterList = [];
    if (keyword?.trim()) {
        const searchKeyword = keyword.trim();
        ["soPhieuXuat", "donBanHang.soDonHang"].forEach((field) => {
            filterList.push({ fieldName: field, operation: "LIKE", value: searchKeyword, logicType: "OR" });
        });
    }
    if (trangThai != null) {
        filterList.push({ fieldName: "trangThai", operation: "EQUALS", value: trangThai });
    }
    if (loaiXuat) {
        filterList.push({ fieldName: "loaiXuat", operation: "EQUALS", value: loaiXuat });
    }
    if (khoId) {
        filterList.push({ fieldName: "kho.id", operation: "EQUALS", value: Number(khoId) });
    }
    // Ngày xuất (phiếu chưa xuất tính theo ngày tạo): máy chủ lọc, bỏ trống một đầu được
    if (tuNgay) {
        filterList.push({ fieldName: "ngayXuat", operation: "GREATER_THAN_OR_EQUAL", value: tuNgay });
    }
    if (denNgay) {
        filterList.push({ fieldName: "ngayXuat", operation: "LESS_THAN_OR_EQUAL", value: `${denNgay}T23:59:59` });
    }
    return { page, size, filters: filterList, sorts: [{ fieldName: "ngayTao", direction: "DESC" }] };
}

async function demPhieu(dieuKien) {
    const res = await phieuXuatKhoService.filter(buildFilterPayload({ ...dieuKien, page: 0, size: 1 }));
    return res?.totalElements ?? 0;
}

// Phiếu xuất chuyển kho: số phiếu chuyển (phieu_chuyen_kho) mà phiếu xuất này thuộc về; phiếu bán hàng: số đơn bán.
// Dùng chung cho dòng bảng và thẻ điện thoại.
function thamChieuGoc(item) {
    const isChuyenKho = item.loaiXuat === "chuyen_kho" || item.loaiXuat === "CHUYEN_KHO";
    const maThamChieu = isChuyenKho
        ? (item.soPhieuChuyenKhoGoc || (item.phieuChuyenKhoGocId ? `PCK ID: ${item.phieuChuyenKhoGocId}` : "-"))
        : (item.donBanHang?.soDonHang || "-");
    return { isChuyenKho, maThamChieu };
}

export default function PhieuXuatKhoList() {
    const navigate = useNavigate();
    const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
    const tabTrangThai = trangThaiCuaTab(tab);
    const [loai, setLoai] = useTabTrenUrl(LOAI_MAS, LOAI_MAC_DINH, { ten: "loai" });
    const loaiXuat = loaiXuatCua(loai);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [total, setTotal] = useState(0);
    const requestIdRef = useRef(0);

    // Vai trò (null = đang tải) và kho phụ trách: dòng chú ý + ghi chú phạm vi (R3)
    const [roles, setRoles] = useState(null);
    const [khoPhuTrach, setKhoPhuTrach] = useState(null);

    const [filters, setFilters] = useState({
        keyword: "",
        khoId: "",
        tuNgay: "",
        denNgay: "",
        page: 0,
        size: SO_DONG_MAC_DINH,
    });
    // Ô chữ đổi ngay khi gõ; filters chỉ đổi khi ngừng gõ (mỗi lần đổi gọi danh sách + đếm từng tab)
    const [keywordInput, setKeywordInput] = useState("");
    // Kho trong ô lọc "Kho xuất": quản trị viên thấy mọi kho, người khác thấy kho được phân công
    const [dsKhoLoc, setDsKhoLoc] = useState([]);

    useEffect(() => {
        const keyword = keywordInput.trim();
        const timer = setTimeout(() => {
            setFilters((p) => (p.keyword === keyword ? p : { ...p, keyword, page: 0 }));
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [keywordInput]);

    // ── Vai trò + kho phụ trách ──
    const loadPhamVi = useCallback(async () => {
        try {
            const userId = getCurrentUserId();
            if (userId == null) {
                setRoles([]);
                return;
            }
            const res = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${userId}`);
            const dsVaiTro = parseRoles(res.data?.data?.vaiTro);
            setRoles(dsVaiTro);
            // Không phải quản trị viên: backend chỉ trả phiếu của kho được phân công (cùng nguồn với /kho/mine)
            if (dsVaiTro.includes("quan_tri_vien")) {
                setDsKhoLoc(await getKhoList());
            } else {
                const dsMine = await getMineKhoList();
                setKhoPhuTrach(dsMine);
                setDsKhoLoc(dsMine);
            }
        } catch (error) {
            console.error("Lỗi khi tải thông tin phân quyền:", error);
            setRoles((prev) => prev ?? []);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); request vẫn chạy ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => loadPhamVi());
    }, [loadPhamVi]);

    // ── Danh sách ──
    // silent: tải lại ngầm (nút ⟳ / quay lại tab) — giữ bảng đang xem; lỗi thì ném ra cho chân bảng báo
    const fetchData = useCallback(async ({ silent = false } = {}) => {
        // Đổi tab / bộ lọc liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            const res = await phieuXuatKhoService.filter(buildFilterPayload({ ...filters, trangThai: tabTrangThai, loaiXuat }));
            if (requestId !== requestIdRef.current) return;
            // Trang đang xem vượt số trang thật (vd. dòng cuối vừa được xử lý ở nơi khác) → lùi về trang cuối còn dữ liệu
            const trangCuoi = trangCuoiNeuVuot({ trang: filters.page, kichThuoc: filters.size, soDong: res?.content?.length ?? 0, tong: res?.totalElements });
            if (trangCuoi != null) {
                setFilters((p) => ({ ...p, page: trangCuoi }));
                return;
            }
            setData(res?.content || []);
            setTotal(res?.totalElements || 0);
            setLoadError(false);
        } catch (e) {
            if (requestId !== requestIdRef.current) return;
            console.error("Fetch list error:", e);
            if (silent) throw e;
            // Không giữ dòng + tổng số của lần tải trước (R9). Giữ lỗi để ô lỗi phân biệt 403 (không có quyền)
            setData([]);
            setTotal(0);
            setLoadError(e);
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [filters, tabTrangThai, loaiXuat]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch lại ngay mỗi khi bộ lọc / tab đổi.
    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    // ── Số trên tab: cùng từ khóa + tên kho + loại phiếu đang lọc, chỉ thay trạng thái (R1) ──
    const tabCounts = useDemTheoTrangThai(
        TAB_MAS,
        (ma) => demPhieu({ keyword: filters.keyword, khoId: filters.khoId, tuNgay: filters.tuNgay, denNgay: filters.denNgay, trangThai: trangThaiCuaTab(ma), loaiXuat }),
        `${filters.keyword}|${filters.khoId}|${filters.tuNgay}|${filters.denNgay}|${loaiXuat ?? ""}`
    );

    // ── Dòng chú ý: phiếu đã đóng gói, chờ xuất kho trong phạm vi danh sách, bỏ qua các bộ lọc khác (R4).
    //    Chỉ phiếu bán hàng có trạng thái này (phiếu chuyển kho xuất thẳng từ Nháp), khớp tab Chờ xuất. ──
    const coQuyenXuatKho = roles?.some((role) => VAI_TRO_XUAT_KHO.includes(role)) ?? false;
    const choXuat = useDemTheoTrangThai(
        [TAB_CHO_XUAT],
        () => demPhieu({ keyword: "", trangThai: trangThaiCuaTab(TAB_CHO_XUAT) }),
        TAB_CHO_XUAT,
        { enabled: coQuyenXuatKho }
    );

    const changeTab = (value) => {
        setTab(value);
        setFilters((p) => (p.page === 0 ? p : { ...p, page: 0 }));
    };

    // Bộ lọc ngoài tab trạng thái ("Xóa lọc" chỉ xóa các bộ lọc này, giữ tab đang chọn)
    const hasActiveFilters = Boolean(keywordInput.trim() || filters.khoId || filters.tuNgay || filters.denNgay || loaiXuat);

    const xoaLocTaiCho = () => {
        setKeywordInput("");
        setFilters((p) => ({ ...p, keyword: "", khoId: "", tuNgay: "", denNgay: "", page: 0 }));
    };

    // Loại phiếu nằm trên URL: bỏ cùng một lần ghi URL với tab (hai lần ghi liền nhau thì lần sau đè lần trước)
    const clearFilters = () => {
        xoaLocTaiCho();
        if (loaiXuat) setTab(tab, { loai: null });
    };

    const changeLoai = (value) => {
        setLoai(value);
        setFilters((p) => (p.page === 0 ? p : { ...p, page: 0 }));
    };

    // Nút của dòng chú ý: mở tab Chờ xuất, bỏ các bộ lọc khác để số dòng khớp số trên dòng chú ý
    const showPending = () => {
        xoaLocTaiCho();
        setTab(TAB_CHO_XUAT, { loai: null });
    };

    const handleRetry = () => {
        fetchData();
        tabCounts.reload();
        choXuat.reload();
    };

    // Nút ⟳ ở chân bảng + tự tải lại khi quay lại tab: trạng thái phiếu do kho cập nhật
    const capNhat = useTaiLaiDanhSach({
        duLieu: data,
        taiNgam: () => {
            tabCounts.reload();
            choXuat.reload();
            return fetchData({ silent: true });
        },
        bat: !loading,
    });

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs.
    const statusTabs = PHIEU_XUAT_KHO_TABS.map((muc) => ({
        value: muc.ma,
        label: t(muc.label),
        tone: TONE_TAB[muc.ma],
        count: loadError ? null : tabCounts.counts[muc.ma],
    }));

    // Phạm vi cho người chỉ xem kho của mình (R3): nhãn "Nơi làm việc" chung (ListPageHeader)
    const noiLamViec = !roles || roles.includes("quan_tri_vien") ? null : khoPhuTrach;

    const pendingCount = coQuyenXuatKho && tab !== TAB_CHO_XUAT ? choXuat.counts[TAB_CHO_XUAT] : null;
    const emptyTabLabel = t(PHIEU_XUAT_KHO_TABS.find((muc) => muc.ma === tab)?.label);

    return (
        <PageContainer fill className="space-y-4">
            {/* Không tạo phiếu xuất tay: phiếu xuất bán sinh khi nhặt xong, phiếu xuất chuyển kho (PX-CK) sinh khi duyệt phiếu chuyển */}
            <ListPageHeader noiLamViec={noiLamViec} />

            <AttentionBar
                count={pendingCount}
                actionLabel={t("Xem phiếu chờ xuất kho")}
                onAction={showPending}
            >
                <strong className="font-semibold">{t("{{so}} phiếu", { count: pendingCount, so: pendingCount?.toLocaleString("vi-VN") })}</strong> {t("đã đóng gói, đang chờ xuất kho.")}
            </AttentionBar>

            {/* ══ BẢNG: tab trạng thái + tìm kiếm + bộ lọc cùng một hàng ══ */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label={t("Lọc phiếu xuất kho theo trạng thái")}
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={clearFilters}
                    >
                        <SearchInput
                            label={t("Tìm theo số phiếu hoặc mã tham chiếu")}
                            placeholder={t("Số phiếu, số đơn bán")}
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onClear={() => {
                                setKeywordInput("");
                                setFilters((p) => (p.keyword === "" ? p : { ...p, keyword: "", page: 0 }));
                            }}
                            className="sm:w-[300px]"
                        />

                        <FilterSelect
                            label={t("Loại phiếu xuất")}
                            value={loai}
                            options={LOAI_PHIEU}
                            onChange={changeLoai}
                            onClear={() => changeLoai(LOAI_MAC_DINH)}
                            clearLabel={t("Bỏ lọc loại phiếu")}
                            className="sm:w-[180px]"
                        />

                        {/* Kho xuất: ô chọn (không gõ tên); chỉ phụ trách một kho thì không cần lọc */}
                        {dsKhoLoc.length > 1 ? (
                            <FilterSelect
                                label={t("Kho xuất")}
                                value={filters.khoId}
                                options={[{ value: "", label: t("Tất cả kho") }, ...dsKhoLoc.map((k) => ({ value: String(k.id), label: k.tenKho }))]}
                                onChange={(v) => setFilters((p) => ({ ...p, khoId: v, page: 0 }))}
                                onClear={() => setFilters((p) => ({ ...p, khoId: "", page: 0 }))}
                                clearLabel={t("Bỏ lọc kho xuất")}
                                className="sm:w-[190px]"
                            />
                        ) : null}

                        <LocKhoangNgay
                            nhan={t("Ngày xuất")}
                            tuNgay={filters.tuNgay}
                            denNgay={filters.denNgay}
                            onDoi={({ tuNgay, denNgay }) => setFilters((p) => ({ ...p, tuNgay, denNgay, page: 0 }))}
                        />
                    </ListToolbar>
                }
                footer={
                    !loading && !loadError ? (
                        <TablePagination
                            page={filters.page}
                            size={filters.size}
                            total={total}
                            onPageChange={(page) => setFilters((p) => ({ ...p, page }))}
                            onSizeChange={(size) => setFilters((p) => ({ ...p, size, page: 0 }))}
                            capNhat={capNhat}
                        />
                    ) : null
                }
            >
                {loading ? (
                    <LoadingState rows={6} label={t("Đang tải danh sách phiếu xuất kho")} />
                ) : loadError ? (
                    <ErrorState
                        description={t("Không thể tải danh sách phiếu xuất kho. Vui lòng thử lại.")}
                        error={loadError}
                        onRetry={handleRetry}
                    />
                ) : data.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title={t("Không tìm thấy phiếu xuất kho phù hợp")}
                            description={t("Thử đổi từ khóa, loại phiếu, kho hoặc ngày xuất.")}
                            action={
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    {t("Xóa lọc")}
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={ClipboardList}
                            title={t("Không có phiếu xuất kho nào ở trạng thái \"{{emptyTabLabel}}\"", { emptyTabLabel })}
                            description={t("Chọn tab Tất cả để xem mọi phiếu xuất kho.")}
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => changeTab(TAB_MAC_DINH)}
                                    className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    {t("Xem tất cả")}
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ClipboardList}
                            title={t("Chưa có phiếu xuất kho")}
                            description={t("Phiếu xuất bán hàng và phiếu xuất chuyển kho sẽ hiện ở đây khi được tạo.")}
                        />
                    )
                ) : (
                    <>
                    {/* Điện thoại: mỗi phiếu một thẻ, chạm thẻ mở phiếu — số phiếu + trạng thái, đơn bán / phiếu chuyển gốc,
                        kho xuất + ngày xuất (chưa xuất thì ngày tạo) */}
                    <ul className="divide-y divide-bo-border md:hidden">
                        {data.map((item) => {
                            const { isChuyenKho, maThamChieu } = thamChieuGoc(item);
                            const status = getPhieuXuatKhoStatus(item.trangThai);
                            return (
                                <li key={item.id}>
                                    <Link to={`/goods-issues/${item.id}`} className="flex flex-col gap-1 px-4 py-3 active:bg-bo-surface-subtle">
                                        <span className="flex items-center justify-between gap-3">
                                            <span className="min-w-0 truncate text-[15px] font-semibold text-bo-primary">{item.soPhieuXuat}</span>
                                            {status ? <StatusBadge quyTrinh="phieuXuat" label={status.label} /> : null}
                                        </span>
                                        <span className="flex min-w-0 items-baseline gap-1.5 text-sm">
                                            <span className="shrink-0 text-bo-muted">{isChuyenKho ? t("Phiếu chuyển") : t("Đơn bán", { context: "loai" })}</span>
                                            <span className="min-w-0 truncate font-medium text-slate-700">{maThamChieu}</span>
                                        </span>
                                        <span className="flex items-baseline justify-between gap-3 text-[13px] text-bo-muted">
                                            <span className="min-w-0 truncate">{item.kho?.tenKho || "-"}</span>
                                            <span className="shrink-0 tabular-nums">
                                                {item.ngayXuat ? t("Xuất {{ngayXuat}}", { ngayXuat: formatDate(item.ngayXuat) }) : t("Tạo {{ngayTao}}", { ngayTao: formatDate(item.ngayTao) })}
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                    {/* Máy tính bảng dọc (cảm ứng): bỏ cột STT và Ngày tạo (ngày tạo xuống dưới số phiếu) để bảng vừa khung, không vuốt ngang */}
                    <table className="w-full min-w-[980px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">
                                    {t("STT")}
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    {t("Số phiếu xuất")}
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    {t("Tham chiếu gốc")}
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    {t("Kho xuất")}
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted cam-ung:max-lg:hidden">
                                    {t("Ngày tạo")}
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    {t("Ngày xuất")}
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    {t("Trạng thái")}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {data.map((item, index) => {
                                // XÁC ĐỊNH MÃ THAM CHIẾU ĐỂ HIỂN THỊ
                                const { maThamChieu } = thamChieuGoc(item);

                                const status = getPhieuXuatKhoStatus(item.trangThai);

                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => navigate(`/goods-issues/${item.id}`)}
                                        className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                    >
                                        <td className="px-3 py-3 text-center text-xs text-bo-muted cam-ung:max-lg:hidden">
                                            {filters.page * filters.size + index + 1}
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-bo-primary">
                                            {item.soPhieuXuat}
                                            <div className="mt-0.5 hidden text-xs font-normal text-bo-muted cam-ung:max-lg:block">{t("Tạo {{ngayTao}}", { ngayTao: formatDate(item.ngayTao) })}</div>
                                        </td>
                                        {/* Mã tham chiếu là chữ thường: không bấm được nên không tô màu liên kết */}
                                        <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                                            {maThamChieu}
                                        </td>
                                        <td className="px-3 py-3 text-sm text-bo-foreground">
                                            {item.kho?.tenKho || "-"}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted cam-ung:max-lg:hidden">
                                            {formatDate(item.ngayTao)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted">
                                            {item.ngayXuat ? formatDate(item.ngayXuat) : t("Chưa xuất kho")}
                                        </td>
                                        <td className="px-3 py-3">
                                            {status ? (
                                                <StatusBadge quyTrinh="phieuXuat" label={status.label} />
                                            ) : (
                                                <span className="text-xs text-bo-muted">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </>
                )}
            </TableShell>
        </PageContainer>
    );
}
