package com.dev.backend.utils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Các phép chia lô thuần (không đụng DB) dùng cho nhặt hàng theo lô. Mọi danh sách lô truyền vào đã sắp
 * theo thứ tự FIFO (lô nhập kho sớm nhất đứng đầu).
 */
public final class PhanBoLoFifo {

    private PhanBoLoFifo() {
    }

    /** Một lô kèm số lượng (còn lại của lô, hoặc số lượng phân bổ từ lô). */
    public record Lo(Integer loHangId, BigDecimal soLuong) {
    }

    public static BigDecimal tong(List<Lo> danhSach) {
        BigDecimal tong = BigDecimal.ZERO;
        for (Lo lo : danhSach) {
            tong = tong.add(lo.soLuong());
        }
        return tong;
    }

    /**
     * Lấy lần lượt từ các lô (theo thứ tự FIFO) cho tới đủ {@code can}. Không đủ thì lấy hết những gì có —
     * bên gọi so tổng với số cần để báo thiếu.
     */
    public static List<Lo> layFifo(List<Lo> conLaiTheoFifo, BigDecimal can) {
        List<Lo> ketQua = new ArrayList<>();
        BigDecimal conThieu = can;
        for (Lo lo : conLaiTheoFifo) {
            if (conThieu.signum() <= 0) break;
            if (lo.soLuong().signum() <= 0) continue;
            BigDecimal lay = lo.soLuong().min(conThieu);
            ketQua.add(new Lo(lo.loHangId(), lay));
            conThieu = conThieu.subtract(lay);
        }
        return ketQua;
    }

    /**
     * Giảm phân bổ xuống còn {@code moi}, cắt từ lô MỚI NHẤT (cuối danh sách FIFO) trước. Lô bị cắt hết thì bỏ
     * khỏi kết quả; thứ tự còn lại giữ nguyên.
     */
    public static List<Lo> catTuLoMoiNhat(List<Lo> phanBoTheoFifo, BigDecimal moi) {
        BigDecimal canCat = tong(phanBoTheoFifo).subtract(moi.max(BigDecimal.ZERO));
        List<Lo> ketQua = new ArrayList<>(phanBoTheoFifo);
        for (int i = ketQua.size() - 1; i >= 0 && canCat.signum() > 0; i--) {
            Lo lo = ketQua.get(i);
            BigDecimal cat = lo.soLuong().min(canCat);
            canCat = canCat.subtract(cat);
            BigDecimal conLai = lo.soLuong().subtract(cat);
            if (conLai.signum() > 0) {
                ketQua.set(i, new Lo(lo.loHangId(), conLai));
            } else {
                ketQua.remove(i);
            }
        }
        return ketQua;
    }

    /**
     * Chia phân bổ của một dòng nhặt cho các đơn theo thứ tự cho trước (đơn đặt sớm đứng đầu): đơn đầu nhận lô
     * cũ trước, một đơn nhận được nhiều lô. Phần phân bổ thừa (đơn đã hủy / đã xuất) bị bỏ qua. Bên gọi bảo đảm
     * tổng phân bổ ≥ tổng số đơn cần; đơn nào không đủ thì nhận phần còn lại.
     */
    public static <K> Map<K, List<Lo>> chiaChoDon(List<Lo> phanBoTheoFifo, Map<K, BigDecimal> canTheoDon) {
        Map<K, List<Lo>> ketQua = new LinkedHashMap<>();
        int viTri = 0;
        BigDecimal conTrongLo = phanBoTheoFifo.isEmpty() ? BigDecimal.ZERO : phanBoTheoFifo.get(0).soLuong();
        for (Map.Entry<K, BigDecimal> don : canTheoDon.entrySet()) {
            List<Lo> cuaDon = new ArrayList<>();
            BigDecimal conThieu = don.getValue();
            while (conThieu.signum() > 0 && viTri < phanBoTheoFifo.size()) {
                if (conTrongLo.signum() <= 0) {
                    viTri++;
                    if (viTri >= phanBoTheoFifo.size()) break;
                    conTrongLo = phanBoTheoFifo.get(viTri).soLuong();
                    continue;
                }
                BigDecimal lay = conTrongLo.min(conThieu);
                Integer loHangId = phanBoTheoFifo.get(viTri).loHangId();
                if (!cuaDon.isEmpty() && cuaDon.get(cuaDon.size() - 1).loHangId().equals(loHangId)) {
                    Lo cuoi = cuaDon.remove(cuaDon.size() - 1);
                    cuaDon.add(new Lo(loHangId, cuoi.soLuong().add(lay)));
                } else {
                    cuaDon.add(new Lo(loHangId, lay));
                }
                conTrongLo = conTrongLo.subtract(lay);
                conThieu = conThieu.subtract(lay);
            }
            ketQua.put(don.getKey(), cuaDon);
        }
        return ketQua;
    }
}
