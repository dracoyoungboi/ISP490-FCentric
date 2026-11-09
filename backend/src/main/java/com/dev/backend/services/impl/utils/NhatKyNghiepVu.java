package com.dev.backend.services.impl.utils;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.INguonNhatKy;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.i18n.LoiThamSoException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Nhật ký nghiệp vụ: ghi vào lich_su_thay_doi TRONG giao dịch của thao tác (cùng commit, cùng rollback — thao tác lỗi
 * thì không có dòng sai, ghi nhật ký lỗi thì thao tác không được lưu). Không mở kết nối thứ hai như ghi sau commit.
 * <ul>
 *   <li>Người thực hiện = người đang đăng nhập; không có người (job, đồng bộ sàn) thì để trống và ghi
 *   nguồn — gọi {@link Dong#nguon(String)}.</li>
 *   <li>gia_tri_cu / gia_tri_moi là JSON. Với {@link Dong#thayDoi(Map, Map)} chỉ giữ các trường thật sự đổi; không đổi
 *   gì thì không ghi dòng nào.</li>
 *   <li>Không bao giờ đưa mật khẩu, mã OTP, khóa API vào đây.</li>
 * </ul>
 * Cách dùng:
 * <pre>
 * nhatKy.ghi(NhatKyNghiepVu.dong(ITable.nha_cung_cap, ncc.getId(), IHanhDong.sua_nha_cung_cap)
 *         .ma(ncc.getMaNhaCungCap())
 *         .thayDoi(anhTruoc, anhSau)
 *         .ghiChu(lyDo));
 * </pre>
 */
@Service
@Slf4j
public class NhatKyNghiepVu {

    static final int TOI_DA_GHI_CHU = 1000;
    static final int TOI_DA_MA = 100;
    // Dưới giới hạn 65.535 byte của TEXT, chừa chỗ cho phần thoát ký tự
    static final int TOI_DA_BYTE_GIA_TRI = 60_000;
    // Đoạn đầu giữ lại khi cắt: 4.000 ký tự × tối đa 4 byte vẫn dưới giới hạn
    static final int DOAN_DAU_KHI_CAT = 4_000;

    private final LichSuThayDoiRepository repository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    public NhatKyNghiepVu(LichSuThayDoiRepository repository, EntityManager entityManager, ObjectMapper objectMapper) {
        this.repository = repository;
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
    }

    public static Dong dong(String loaiThamChieu, Integer idThamChieu, String hanhDong) {
        return new Dong(loaiThamChieu, idThamChieu, hanhDong);
    }

    /** Ghi một dòng. Trả về dòng đã lưu, hoặc null khi {@link Dong#thayDoi} không có trường nào đổi. */
    public LichSuThayDoi ghi(Dong d) {
        if (d.boQua) return null;
        Integer nguoiId = d.nguoiId;
        String nguon = d.nguon;
        if (nguoiId == null && nguon == null) {
            NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
            if (auth != null && auth.getId() != null) {
                nguoiId = auth.getId();
            } else {
                nguon = INguonNhatKy.he_thong;
            }
        }
        LichSuThayDoi dong = LichSuThayDoi.builder()
                .loaiThamChieu(d.loai)
                .idThamChieu(d.id)
                .maDoiTuong(cat(d.ma, TOI_DA_MA))
                .kho(d.khoId == null ? null : entityManager.getReference(Kho.class, d.khoId))
                .hanhDong(d.hanhDong)
                .giaTriCu(json(d.cu))
                .giaTriMoi(json(d.moi))
                .nguoiThucHien(nguoiId == null ? null : entityManager.getReference(NguoiDung.class, nguoiId))
                .nguon(nguon)
                .ngayThucHien(Instant.now())
                .ghiChu(cat(d.ghiChu, TOI_DA_GHI_CHU))
                .build();
        return repository.save(dong);
    }

    private String json(Object giaTri) {
        if (giaTri == null) return null;
        String s;
        if (giaTri instanceof String chuoi) {
            s = chuoi;
        } else {
            try {
                s = objectMapper.writeValueAsString(giaTri);
            } catch (JsonProcessingException e) {
                // Không để lỗi chuyển JSON làm hỏng thao tác: ghi dạng chữ
                log.warn("[NHAT-KY] Không chuyển được JSON: {}", e.getMessage());
                s = String.valueOf(giaTri);
            }
        }
        return gonTheoCot(s);
    }

    /**
     * Cột gia_tri_cu / gia_tri_moi là TEXT (tối đa 65.535 byte). Ghi vượt thì lệnh lưu lỗi và thao tác chính rollback
     * theo, nên giá trị quá dài được thay bằng bản tóm tắt JSON hợp lệ (đoạn đầu + độ dài).
     */
    String gonTheoCot(String s) {
        int soByte = s.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        if (soByte <= TOI_DA_BYTE_GIA_TRI) return s;
        Map<String, Object> tomTat = new LinkedHashMap<>();
        tomTat.put("catBot", true);
        tomTat.put("doDaiByte", soByte);
        tomTat.put("doanDau", s.substring(0, Math.min(s.length(), DOAN_DAU_KHI_CAT)));
        try {
            return objectMapper.writeValueAsString(tomTat);
        } catch (JsonProcessingException e) {
            return "{\"catBot\":true,\"doDaiByte\":" + soByte + "}";
        }
    }

    public static String cat(String s, int toiDa) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return t.length() <= toiDa ? t : t.substring(0, toiDa - 1) + "…";
    }

    /**
     * Hai giá trị coi như bằng nhau: số so theo giá trị (1.00 = 1), chuỗi rỗng = null, chuỗi bỏ khoảng trắng hai đầu.
     */
    static boolean bang(Object a, Object b) {
        Object x = chuanHoa(a), y = chuanHoa(b);
        if (x instanceof BigDecimal bx && y instanceof BigDecimal by) return bx.compareTo(by) == 0;
        return Objects.equals(x, y);
    }

    private static Object chuanHoa(Object v) {
        if (v instanceof String s) {
            String t = s.trim();
            return t.isEmpty() ? null : t;
        }
        if (v instanceof BigDecimal b) return b;
        if (v instanceof Number n) {
            try {
                return new BigDecimal(n.toString());
            } catch (NumberFormatException e) {
                return n;
            }
        }
        return v;
    }

    /** Một dòng nhật ký đang dựng. */
    public static final class Dong {
        final String loai;
        final Integer id;
        final String hanhDong;
        String ma;
        Integer khoId;
        Object cu;
        Object moi;
        String ghiChu;
        String nguon;
        Integer nguoiId;
        boolean boQua;

        Dong(String loai, Integer id, String hanhDong) {
            this.loai = loai;
            this.id = id;
            this.hanhDong = hanhDong;
        }

        /** Mã dễ đọc: số đơn, mã NCC, mã kho… */
        public Dong ma(String ma) {
            this.ma = ma;
            return this;
        }

        public Dong kho(Integer khoId) {
            this.khoId = khoId;
            return this;
        }

        /** Ghi nguyên giá trị cũ (vd. ảnh chụp bản ghi trước khi xóa). */
        public Dong cu(Object cu) {
            this.cu = cu;
            return this;
        }

        public Dong moi(Object moi) {
            this.moi = moi;
            return this;
        }

        /**
         * So hai ảnh chụp cùng khóa, chỉ giữ các trường đổi (khóa chỉ có ở một bên cũng tính là đổi). Không trường nào
         * đổi thì dòng bị bỏ, {@link NhatKyNghiepVu#ghi} không lưu gì.
         */
        public Dong thayDoi(Map<String, ?> truoc, Map<String, ?> sau) {
            Map<String, Object> c = new LinkedHashMap<>();
            Map<String, Object> m = new LinkedHashMap<>();
            Map<String, ?> a = truoc == null ? Map.of() : truoc;
            Map<String, ?> b = sau == null ? Map.of() : sau;
            for (String k : b.keySet()) {
                if (!bang(a.get(k), b.get(k))) {
                    c.put(k, a.get(k));
                    m.put(k, b.get(k));
                }
            }
            for (String k : a.keySet()) {
                if (!b.containsKey(k) && a.get(k) != null) {
                    c.put(k, a.get(k));
                    m.put(k, null);
                }
            }
            this.cu = c;
            this.moi = m;
            this.boQua = m.isEmpty() && c.isEmpty();
            return this;
        }

        /** Lý do / ghi chú (lý do hủy, lý do từ chối…). */
        public Dong ghiChu(String ghiChu) {
            this.ghiChu = ghiChu;
            return this;
        }

        /** Việc không do người đăng nhập làm: he_thong, tên sàn (INguonNhatKy). Người thực hiện để trống. */
        public Dong nguon(String nguon) {
            this.nguon = nguon;
            return this;
        }

        /** Chỉ định người thực hiện khi không có người trong SecurityContextHolder (vd. thao tác chạy trên luồng khác). */
        public Dong nguoi(Integer nguoiId) {
            this.nguoiId = nguoiId;
            return this;
        }

        /** Có trường nào đổi không (sau {@link #thayDoi}); dùng để quyết định gửi thông báo. */
        public boolean coThayDoi() {
            return !boQua;
        }

        @SuppressWarnings("unchecked")
        public Map<String, Object> giaTriMoi() {
            return moi instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        }
    }

    /** Ảnh chụp có thứ tự, chấp nhận giá trị null (Map.of không nhận null). */
    public static Map<String, Object> anh(Object... capKhoaGiaTri) {
        if (capKhoaGiaTri.length % 2 != 0) throw new LoiThamSoException(ThongDiep.of("heThong.capKhoaGiaTriKhongDu"));
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < capKhoaGiaTri.length; i += 2) m.put((String) capKhoaGiaTri[i], capKhoaGiaTri[i + 1]);
        return m;
    }
}
