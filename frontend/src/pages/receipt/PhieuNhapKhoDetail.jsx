import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import ChiTietNhapChuyenKho from "@/components/nhap-kho/phieu-nhap-chuyen-kho/ChiTietNhapChuyenKho";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { getApiErrorMessage } from "@/utils/apiError";
import ChiTietNhapTuDonMua from "./ChiTietNhapTuDonMua";

/**
 * Chi tiết phiếu nhập kho (/goods-receipts/:id): tải phiếu một lần rồi chọn màn theo loại —
 * phiếu nhập từ đơn mua (có `soDonMua`) → ChiTietNhapTuDonMua; phiếu chuyển kho, hoàn trả do hủy chuyển kho và
 * khách trả hàng → ChiTietNhapChuyenKho (bản một khối 21/10/2026).
 */
export default function PhieuNhapKhoDetail() {
    const { id } = useParams();
    // Đổi phiếu (cùng route) thì dựng lại màn: không mang từ khóa, lọc, trang của bảng phiếu trước (useBangChungTu)
    return <ManPhieuNhapKho key={id} id={id} />;
}

function ManPhieuNhapKho({ id }) {
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    // Bắt đầu ở trạng thái đang tải: lần render đầu chưa gọi API
    const [loading, setLoading] = useState(true);
    // Lỗi của lần tải gần nhất (axios); null khi không lỗi hoặc khi tải xong mà máy chủ trả rỗng (= không tìm thấy)
    const [loi, setLoi] = useState(null);

    // Chỉ nhận kết quả của lần tải mới nhất: lần tải ngầm về chậm không đè dữ liệu tải sau một thao tác
    const requestIdRef = useRef(0);
    // silent: tải lại sau một thao tác (khóa lô, xác nhận…) — giữ màn đang hiện, lỗi chỉ báo toast.
    // quiet: tải lại ngầm khi quay lại tab — như silent nhưng lỗi chỉ ghi log (người dùng không bấm gì).
    const fetchDetail = useCallback(async ({ silent = false, quiet = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) {
            setLoading(true);
            setLoi(null);
        }
        try {
            const res = await phieuNhapKhoService.getDetail(id);
            if (requestId !== requestIdRef.current) return;
            const detail = res?.data || res;
            if (silent && !detail) return;
            setData(detail || null);
        } catch (e) {
            if (requestId !== requestIdRef.current) return;
            console.error(e);
            if (silent) {
                if (!quiet) toast.error(getApiErrorMessage(e, "Không tải lại được phiếu nhập"));
                return;
            }
            setData(null);
            // Máy chủ trả 400 "Không tìm thấy phiếu nhập id: …" khi mã không tồn tại: KhungLoiChungTu tự phân loại
            setLoi(e);
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [id]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); chi tiết vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => fetchDetail());
    }, [fetchDetail]);

    // Quay lại tab thì tải lại ngầm (kiểm đếm, QC, xác nhận do nhân viên kho khác làm). Hộp thoại đang mở (role dialog)
    // thì hook tự bỏ qua, nên không tải chen lúc đang thao tác.
    useTaiLaiKhiQuayLai(() => fetchDetail({ silent: true, quiet: true }), { bat: Boolean(data) && !loading });

    if (loading) {
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungDangTai nhan="Đang tải phiếu nhập kho" coTienTrinh={false} />
            </PageContainer>
        );
    }

    if (!data) {
        return (
            <PageContainer className="flex min-h-full flex-col">
                <KhungLoiChungTu
                    loi={loi}
                    tenChungTu="phiếu nhập kho"
                    onVeDanhSach={() => navigate("/goods-receipts")}
                    onThuLai={() => fetchDetail()}
                />
            </PageContainer>
        );
    }

    // Phiếu nhập từ đơn mua: màn mới "Thanh 3 bước + bảng hàng" (FO-096/099/100)
    if (data.soDonMua) {
        return <ChiTietNhapTuDonMua data={data} onReload={() => fetchDetail({ silent: true })} />;
    }

    return (
        <PageContainer className="flex min-h-full flex-col">
            <ChiTietNhapChuyenKho data={data} onReload={() => fetchDetail({ silent: true })} />
        </PageContainer>
    );
}
