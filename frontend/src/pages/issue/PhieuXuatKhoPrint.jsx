import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toGoodsIssuePrintModel } from "@/components/print/adapters/goodsIssuePrintAdapter";
import { phieuXuatKhoService } from '@/services/phieuXuatKhoService';

/**
 * Trang in thật của phiếu xuất kho — dữ liệu API thật
 * (`GET /api/v1/phieu-xuat-kho/{id}` + lô đã pick / tên lô)
 * + mẫu đang hoạt động của goods_issue.
 * Thay thế trang in kiểu gold/ivory cũ bằng hệ thống in FCentric chung.
 *
 * PHÂN BIỆT rõ request lô thất bại (pickedLotFailures / availableLotFailures —
 * chặn in, hiện nút "Thử lại") với "thành công nhưng không có lô" (in bình
 * thường, lô hiển thị "—").
 */
export default function PhieuXuatKhoPrint() {
    return (
        <PrintRoutePage
            documentType="goods_issue"
            fetcher={async (id) => {
                const detail = await phieuXuatKhoService.getDetail(id);
                if (!detail) return null;
                const { phieu, chiTiet = [] } = detail;

                // Lô đã pick của từng dòng + bảng tên lô (loHangId -> maLo)
                const pickedLotsByDetailId = {};
                const lotNameByLotId = {};
                const pickedLotFailures = [];
                const availableLotFailures = [];

                await Promise.all(
                    chiTiet.map(async (item) => {
                        try {
                            const picks = await phieuXuatKhoService.getPickedLots(id, item.id);
                            pickedLotsByDetailId[item.id] = Array.isArray(picks) ? picks : [];
                        } catch {
                            // LỖI request — khác với "không có lô đã pick"
                            pickedLotsByDetailId[item.id] = [];
                            pickedLotFailures.push(item.id);
                        }
                        if (!item.bienTheSanPhamId) return;
                        try {
                            const lots = await phieuXuatKhoService.getAvailableLots(
                                id,
                                item.bienTheSanPhamId
                            );
                            (lots || []).forEach((lot) => {
                                if (lot.loHangId && lot.maLo) {
                                    lotNameByLotId[lot.loHangId] = lot.maLo;
                                }
                            });
                        } catch {
                            // LỖI request — tên lô có thể hiển thị sai (#id)
                            availableLotFailures.push(item.bienTheSanPhamId);
                        }
                    })
                );

                const hasPicks = Object.values(pickedLotsByDetailId).some(
                    (picks) => picks.length > 0
                );

                return {
                    phieu,
                    chiTiet,
                    pickedLotsByDetailId,
                    lotNameByLotId,
                    pickedLotFailures,
                    availableLotFailures,
                    hasPicks,
                };
            }}
            getDataError={(payload) => {
                if (!payload) return null;
                if (payload.pickedLotFailures?.length) {
                    return {
                        title: "Không thể tải dữ liệu lô đã xuất",
                        description:
                            "Không thể tải lô đã pick của một số dòng hàng. Bản in có thể thiếu dữ liệu — vui lòng thử lại.",
                    };
                }
                if (payload.availableLotFailures?.length && payload.hasPicks) {
                    return {
                        title: "Không thể tải tên lô",
                        description:
                            "Không thể tải tên lô từ kho. Bản in có thể hiển thị sai tên lô — vui lòng thử lại.",
                    };
                }
                return null;
            }}
            adapter={toGoodsIssuePrintModel}
            backPath="/goods-issues/:id"
            loadingLabel="Đang tải dữ liệu phiếu xuất kho"
            titleFallback="In phiếu xuất kho"
            notFoundTitle="Không tìm thấy phiếu xuất kho"
            notFoundDescription="Phiếu có thể đã bị xoá hoặc bạn không có quyền truy cập."
        />
    );
}
