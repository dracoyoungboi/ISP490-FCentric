package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.variables.IKiemKe;

import java.util.*;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Chọn kệ gợi ý cho phần chưa có kệ của các lô ở một kho. Thuần tính toán trên ảnh chụp kệ và sổ kệ của kho, không đọc
 * cơ sở dữ liệu; dựng một lần cho cả danh sách và gọi {@link #chon} lần lượt THEO THỨ TỰ HIỂN THỊ: mỗi gợi ý giữ chỗ trên
 * kệ, lô sau thấy kệ đã bớt chỗ, nên "xếp cả nhóm theo gợi ý" không dồn nhiều lô vào một kệ không đủ chỗ.
 * <p>
 * Ứng viên theo bậc: kệ chính của lô (khi thuộc kho này) → kệ đang chứa lô → kệ đang có cùng biến thể (SKU) → kệ đang có
 * cùng sản phẩm khác màu, cỡ. Trong một bậc, kệ đang chứa nhiều hơn đứng trước; kệ đã có ở bậc trên không lặp lại.
 * Kệ chọn được: không bảo trì, không khóa kiểm kê với lô này, còn chỗ — đúng các điều kiện xếp kệ ở {@link SoTonKeService}.
 * Gợi ý là kệ chọn được đầu tiên đủ chỗ cho cả phần cần xếp; không kệ nào đủ thì kệ chọn được đầu tiên (người dùng chia
 * thêm kệ cho phần còn lại).
 */
final class ChonKeGoiY {

    static final String KE_CUA_LO = "KE_CUA_LO",
            DANG_CHUA_LO = "DANG_CHUA_LO",
            CUNG_SKU = "CUNG_SKU",
            CUNG_MAU = "CUNG_MAU";

    static final String CHAN_BAO_TRI = "BAO_TRI",
            CHAN_KIEM_KE = "KIEM_KE",
            CHAN_DAY = "DAY",
            /** Kệ còn chỗ thật nhưng chỗ đó đã gợi ý cho các lô phía trên. */
            CHAN_DA_GOI_Y = "DA_GOI_Y";

    /** Số kệ liên quan trả về mỗi lô (đủ cho thẻ gợi ý ở hộp chọn kệ); kệ khóa kiểm kê với lô luôn được thêm sau đó. */
    static final int TOI_DA_LIEN_QUAN = 6;
    /** Trần cứng của danh sách kệ liên quan (kể cả kệ khóa kiểm kê thêm sau). */
    static final int TRAN_LIEN_QUAN = 30;

    /** Một kệ của kho. {@code sucChua} null hoặc ≤ 0 = không giới hạn. */
    record Ke(Integer id, String ma, String trangThai, Integer sucChua, int dangChua) {
        /** Số còn nhận được theo sổ kệ; null = không giới hạn. */
        Integer conCho() {
            return sucChua == null || sucChua <= 0 ? null : Math.max(0, sucChua - dangChua);
        }
    }

    /** Một dòng sổ kệ có số dương: (kệ, lô, biến thể, sản phẩm) → số. */
    record DongKe(Integer keId, Integer loId, Integer bienTheId, Integer sanPhamId, int soLuong) {
    }

    /** Kệ ứng viên: {@code chan} null = chọn được; {@code conCho} sau phần các gợi ý trước đã giữ (null = không giới hạn). */
    record UngVien(Ke ke, String lyDo, String chan, Integer conCho) {
    }

    /** {@code goiY} null khi không có kệ nào chọn được; {@code lienQuan} luôn chứa {@code goiY} nếu có. */
    record KetQua(UngVien goiY, List<UngVien> lienQuan) {
    }

    private final Map<Integer, Ke> ke;
    private final Map<Integer, List<DongKe>> theoLo;
    private final Map<Integer, List<DongKe>> theoBienThe;
    private final Map<Integer, List<DongKe>> theoSanPham;
    /** (kệ, lô) đang khóa cho kiểm kê. */
    private final BiPredicate<Integer, Integer> khoaKiemKe;
    /** Phần chỗ các gợi ý trước đã giữ trên từng kệ. */
    private final Map<Integer, Integer> daGiu = new HashMap<>();

    ChonKeGoiY(Collection<Ke> ke, Collection<DongKe> dong, BiPredicate<Integer, Integer> khoaKiemKe) {
        this.ke = ke.stream().collect(Collectors.toMap(Ke::id, k -> k, (a, b) -> a));
        this.theoLo = nhom(dong, DongKe::loId);
        this.theoBienThe = nhom(dong, DongKe::bienTheId);
        this.theoSanPham = nhom(dong, DongKe::sanPhamId);
        this.khoaKiemKe = khoaKiemKe == null ? (v, l) -> false : khoaKiemKe;
    }

    private static Map<Integer, List<DongKe>> nhom(Collection<DongKe> dong, Function<DongKe, Integer> khoa) {
        return dong.stream().filter(d -> khoa.apply(d) != null && d.soLuong() > 0)
                .collect(Collectors.groupingBy(khoa));
    }

    /**
     * Gợi ý cho {@code can} sản phẩm cần xếp của lô (phần chưa có kệ trừ phần phiếu nhặt đang giữ) và giữ chỗ trên kệ được
     * gợi ý. {@code keChinhId}: kệ chính của lô (lo_hang.vi_tri_kho_id). {@code loDangKiemKe}: cả lô đang thuộc một đợt
     * kiểm kê (toàn kho / theo danh mục) nên không kệ nào nhận được.
     */
    KetQua chon(Integer loId, Integer bienTheId, Integer sanPhamId, Integer keChinhId, int can, boolean loDangKiemKe) {
        LinkedHashMap<Integer, String> thuTu = new LinkedHashMap<>();
        if (keChinhId != null && ke.containsKey(keChinhId)) thuTu.put(keChinhId, KE_CUA_LO);
        themTheoSoLuong(thuTu, theoLo.get(loId), DANG_CHUA_LO);
        themTheoSoLuong(thuTu, theoBienThe.get(bienTheId), CUNG_SKU);
        themTheoSoLuong(thuTu, theoSanPham.get(sanPhamId), CUNG_MAU);

        List<UngVien> ungVien = new ArrayList<>(thuTu.size());
        thuTu.forEach((keId, lyDo) -> {
            Ke k = ke.get(keId);
            Integer con = conCho(k);
            ungVien.add(new UngVien(k, lyDo, loDangKiemKe ? CHAN_KIEM_KE : chan(k, loId, con), con));
        });
        UngVien goiY = ungVien.stream().filter(u -> u.chan() == null && (u.conCho() == null || u.conCho() >= can)).findFirst()
                .orElseGet(() -> ungVien.stream().filter(u -> u.chan() == null).findFirst().orElse(null));
        if (goiY != null && can > 0) {
            daGiu.merge(goiY.ke().id(), goiY.conCho() == null ? can : Math.min(can, goiY.conCho()), Integer::sum);
        }
        return new KetQua(goiY, lienQuan(ungVien, goiY));
    }

    /** {@link #TOI_DA_LIEN_QUAN} kệ đầu, rồi các kệ khóa kiểm kê với lô (để giao diện không cho chọn), rồi kệ gợi ý. */
    private static List<UngVien> lienQuan(List<UngVien> ungVien, UngVien goiY) {
        List<UngVien> kq = new ArrayList<>(ungVien.subList(0, Math.min(TOI_DA_LIEN_QUAN, ungVien.size())));
        for (UngVien u : ungVien.subList(kq.size(), ungVien.size())) {
            if (kq.size() >= TRAN_LIEN_QUAN) break;
            if (CHAN_KIEM_KE.equals(u.chan())) kq.add(u);
        }
        if (goiY != null && !kq.contains(goiY)) kq.add(goiY);
        return kq;
    }

    /** Thêm các kệ của nhóm dòng vào thứ tự ứng viên: kệ chứa nhiều hơn trước, bằng nhau theo mã kệ. */
    private void themTheoSoLuong(LinkedHashMap<Integer, String> thuTu, List<DongKe> dong, String lyDo) {
        if (dong == null) return;
        Map<Integer, Integer> tong = new HashMap<>();
        for (DongKe d : dong) {
            if (ke.containsKey(d.keId())) tong.merge(d.keId(), d.soLuong(), Integer::sum);
        }
        tong.entrySet().stream()
                .sorted(Comparator.<Map.Entry<Integer, Integer>>comparingInt(Map.Entry::getValue).reversed()
                        .thenComparing(e -> Objects.toString(ke.get(e.getKey()).ma(), ""))
                        .thenComparing(Map.Entry::getKey))
                .forEach(e -> thuTu.putIfAbsent(e.getKey(), lyDo));
    }

    private Integer conCho(Ke k) {
        Integer con = k.conCho();
        return con == null ? null : Math.max(0, con - daGiu.getOrDefault(k.id(), 0));
    }

    /** Vì sao không xếp được vào kệ cho lô này, null = xếp được (cùng điều kiện với SoTonKeService.keCuaKho, kiemTraSucChua). */
    private String chan(Ke k, Integer loId, Integer conCho) {
        String tt = k.trangThai();
        if (IKiemKe.KE_KHOA_KIEM_KE.equals(tt) || khoaKiemKe.test(k.id(), loId)) return CHAN_KIEM_KE;
        if (tt != null && !IKiemKe.KE_HOAT_DONG.equals(tt) && !IKiemKe.KE_DAY_HANG.equals(tt)) return CHAN_BAO_TRI;
        if (conCho == null || conCho > 0) return null;
        Integer thuc = k.conCho();
        return thuc != null && thuc == 0 ? CHAN_DAY : CHAN_DA_GOI_Y;
    }
}
