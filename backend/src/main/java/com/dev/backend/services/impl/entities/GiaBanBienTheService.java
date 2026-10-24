package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.DoiGiaBanRequest;
import com.dev.backend.dto.request.LocGiaBanRequest;
import com.dev.backend.dto.response.customize.KetQuaDoiGiaBanDto;
import com.dev.backend.dto.response.customize.TrangGiaBanDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.GiaBanBienTheRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.utils.GioiHanSoThapPhan;
import com.dev.backend.utils.HienThiBienThe;
import com.dev.backend.utils.PublicAssetUrl;
import com.dev.backend.utils.XemGiaVon;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

/**
 * Giá bán của biến thể (màn "Giá bán & tem mã vạch"): danh sách phân trang theo sản phẩm và đổi giá có lý do.
 * Giá vốn chỉ đọc ở đây (SRS 2.4.1). Mỗi lần giá bán thật sự đổi ghi một dòng lich_su_thay_doi (doi_gia_ban);
 * form Sửa sản phẩm đổi giá cũng đi qua {@link #kiemTraGiaBan} và {@link #ghiLichSuDoiGia}.
 */
@Service
public class GiaBanBienTheService {

    /** Số sản phẩm mỗi trang được chọn (mỗi sản phẩm kéo theo đủ biến thể nên không cho 100). */
    public static final List<Integer> SO_SAN_PHAM_MOI_TRANG = List.of(10, 20, 50);
    static final int SO_SAN_PHAM_MAC_DINH = 20;
    /** Số biến thể tối đa của một lần đổi giá (50 sản phẩm × 100 biến thể của một trang). */
    static final int SO_SKU_TOI_DA_MOI_LAN = 5000;
    static final int LY_DO_TOI_DA = 255;
    /** Giới hạn của cột gia_ban DECIMAL(15,2). */
    static final BigDecimal GIA_BAN_TOI_DA = new BigDecimal("9999999999999.99");

    public static final String TAB_TAT_CA = "tat-ca";
    public static final String TAB_HOAT_DONG = "hoat-dong";
    public static final String TAB_NGUNG_HOAT_DONG = "ngung-hoat-dong";
    private static final Set<String> CAC_TAB = Set.of(TAB_TAT_CA, TAB_HOAT_DONG, TAB_NGUNG_HOAT_DONG);

    public static final String LY_DO_SUA_SAN_PHAM = "Sửa sản phẩm";
    public static final String BO_QUA_NGUNG_HOAT_DONG = "Ngừng hoạt động";
    public static final String BO_QUA_GIA_KHONG_DOI = "Giá bán không đổi";

    @Autowired
    private GiaBanBienTheRepository giaBanRepository;
    @Autowired
    private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Autowired
    private AnhQuanAoRepository anhQuanAoRepository;
    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;
    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    // ==================== Danh sách ====================

    @Transactional(readOnly = true)
    public TrangGiaBanDto loc(LocGiaBanRequest yeuCau) {
        LocGiaBanRequest req = yeuCau != null ? yeuCau : new LocGiaBanRequest();
        int trang = req.getPage() != null && req.getPage() > 0 ? req.getPage() : 0;
        int soDong = req.getSize() != null && SO_SAN_PHAM_MOI_TRANG.contains(req.getSize()) ? req.getSize() : SO_SAN_PHAM_MAC_DINH;
        String tuKhoa = tuKhoaLike(req.getTuKhoa());
        String tab = chuanHoaTab(req.getTrangThai());
        boolean canXuLy = Boolean.TRUE.equals(req.getCanXuLyGia());

        Page<Integer> trangId = giaBanRepository.trangSanPhamId(tuKhoa, canXuLy, tab, PageRequest.of(trang, soDong));
        List<Integer> sanPhamIds = trangId.getContent();
        long tongSku = trangId.getTotalElements() == 0 ? 0 : giaBanRepository.demSku(tuKhoa, canXuLy, tab);

        return TrangGiaBanDto.builder()
                .content(sanPhamIds.isEmpty() ? List.of() : dungNhom(sanPhamIds, tuKhoa, canXuLy, tab))
                .page(trang)
                .size(soDong)
                .tongSanPham(trangId.getTotalElements())
                .tongSku(tongSku)
                .demTheoTab(demTheoTab(tuKhoa, canXuLy))
                .canXuLy(demCanXuLy())
                .build();
    }

    private List<TrangGiaBanDto.NhomGiaBan> dungNhom(List<Integer> sanPhamIds, String tuKhoa, boolean canXuLy, String tab) {
        List<BienTheSanPham> dsBienThe = giaBanRepository.bienTheKhopLoc(sanPhamIds, tuKhoa, canXuLy, tab);
        List<Integer> bienTheIds = dsBienThe.stream().map(BienTheSanPham::getId).toList();
        Map<Integer, BigDecimal> ton = tonKho(bienTheIds);
        Map<Integer, Instant> lanDoi = lanDoiGiaGanNhat(bienTheIds);
        Map<Integer, Integer> tongPhanLoai = new HashMap<>();
        for (Object[] dong : giaBanRepository.demPhanLoai(sanPhamIds)) {
            tongPhanLoai.put(((Number) dong[0]).intValue(), ((Number) dong[1]).intValue());
        }
        Set<Integer> khopTen = tuKhoa == null ? new HashSet<>(sanPhamIds) : new HashSet<>(giaBanRepository.sanPhamKhopTen(sanPhamIds, tuKhoa));
        Map<Integer, String> anhSanPham = anhDaiDien(sanPhamIds);
        boolean xemGiaVon = XemGiaVon.nguoiDangNhapDuocXem();

        // Truy vấn đã xếp thứ tự phân loại; gom theo sản phẩm vẫn giữ thứ tự đó
        Map<Integer, List<BienTheSanPham>> theoSanPham = new HashMap<>();
        for (BienTheSanPham bt : dsBienThe) {
            theoSanPham.computeIfAbsent(bt.getSanPham().getId(), k -> new ArrayList<>()).add(bt);
        }
        List<TrangGiaBanDto.NhomGiaBan> nhom = new ArrayList<>(sanPhamIds.size());
        for (Integer sanPhamId : sanPhamIds) {
            List<BienTheSanPham> ds = theoSanPham.get(sanPhamId);
            // Biến thể vừa đổi trạng thái / giá giữa hai truy vấn: bỏ qua thay vì trả nhóm rỗng
            if (ds == null || ds.isEmpty()) continue;
            String anh = anhSanPham.get(sanPhamId);
            if (anh == null) {
                anh = ds.stream().map(HienThiBienThe::anh).filter(Objects::nonNull).findFirst().orElse(null);
            }
            nhom.add(TrangGiaBanDto.NhomGiaBan.builder()
                    .sanPhamId(sanPhamId)
                    .tenSanPham(ds.get(0).getSanPham().getTenSanPham())
                    .maSanPham(ds.get(0).getSanPham().getMaSanPham())
                    .anh(anh)
                    .tongPhanLoai(Math.max(ds.size(), tongPhanLoai.getOrDefault(sanPhamId, 0)))
                    .khopTen(khopTen.contains(sanPhamId))
                    .bienThe(ds.stream().map(bt -> TrangGiaBanDto.BienTheGiaBan.builder()
                            .id(bt.getId())
                            .maSku(bt.getMaSku())
                            .maVachSku(bt.getMaVachSku())
                            .mauSac(TrangGiaBanDto.MauSac.builder()
                                    .ten(HienThiBienThe.tenMau(bt))
                                    .maHex(HienThiBienThe.maMauHex(bt))
                                    .build())
                            .kichCo(HienThiBienThe.kichCo(bt))
                            .trangThai(bt.getTrangThai())
                            .giaVon(xemGiaVon ? bt.getGiaVon() : null)
                            .giaBan(bt.getGiaBan())
                            .tonKho(ton.getOrDefault(bt.getId(), BigDecimal.ZERO))
                            .ngayDoiGiaGanNhat(lanDoi.get(bt.getId()))
                            .build()).toList())
                    .build());
        }
        return nhom;
    }

    private TrangGiaBanDto.DemTheoTab demTheoTab(String tuKhoa, boolean canXuLy) {
        Object[] dong = dongDau(giaBanRepository.demTheoTab(tuKhoa, canXuLy));
        long tatCa = so(dong, 0);
        long hoatDong = so(dong, 1);
        return TrangGiaBanDto.DemTheoTab.builder()
                .tatCa(tatCa)
                .hoatDong(hoatDong)
                .ngungHoatDong(Math.max(0, tatCa - hoatDong))
                .build();
    }

    private TrangGiaBanDto.CanXuLyGia demCanXuLy() {
        Object[] dong = dongDau(giaBanRepository.demCanXuLy());
        return TrangGiaBanDto.CanXuLyGia.builder().chuaCoGia(so(dong, 0)).duoiGiaVon(so(dong, 1)).build();
    }

    /** Tổng tồn mọi kho của các biến thể; biến thể không có dòng tồn nào hiểu là 0. */
    public Map<Integer, BigDecimal> tonKho(Collection<Integer> bienTheIds) {
        if (bienTheIds == null || bienTheIds.isEmpty()) return Map.of();
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        for (Object[] dong : giaBanRepository.tonKho(bienTheIds)) {
            if (dong == null || dong[0] == null || dong[1] == null) continue;
            BigDecimal soLuong = dong[1] instanceof BigDecimal bd ? bd : new BigDecimal(dong[1].toString());
            ketQua.put(((Number) dong[0]).intValue(), soLuong);
        }
        return ketQua;
    }

    private Map<Integer, Instant> lanDoiGiaGanNhat(Collection<Integer> bienTheIds) {
        if (bienTheIds.isEmpty()) return Map.of();
        Map<Integer, Instant> ketQua = new HashMap<>();
        for (Object[] dong : giaBanRepository.lanDoiGiaGanNhat(bienTheIds)) {
            if (dong == null || dong[0] == null || !(dong[1] instanceof Instant luc)) continue;
            ketQua.put(((Number) dong[0]).intValue(), luc);
        }
        return ketQua;
    }

    /** Ảnh chính của từng sản phẩm (truy vấn đã xếp ảnh chính lên trước, giữ ảnh gặp đầu tiên). */
    private Map<Integer, String> anhDaiDien(Collection<Integer> sanPhamIds) {
        Map<Integer, String> ketQua = new HashMap<>();
        for (AnhQuanAo anh : anhQuanAoRepository.findActiveByQuanAoIds(sanPhamIds)) {
            if (anh.getQuanAo() == null || anh.getTepTin() == null || anh.getTepTin().getDuongDan() == null) continue;
            ketQua.putIfAbsent(anh.getQuanAo().getId(), PublicAssetUrl.toHttps(anh.getTepTin().getDuongDan()));
        }
        return ketQua;
    }

    /** Từ khóa cho LIKE … ESCAPE '!': bỏ khoảng trắng hai đầu, trống thì null, thoát ! % _ để gõ chữ nào khớp chữ đó. */
    static String tuKhoaLike(String tuKhoa) {
        if (tuKhoa == null || tuKhoa.isBlank()) return null;
        return tuKhoa.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    static String chuanHoaTab(String tab) {
        if (tab == null || tab.isBlank()) return TAB_TAT_CA;
        String gon = tab.trim();
        if (!CAC_TAB.contains(gon)) {
            throw new CommonException("Trạng thái lọc không hợp lệ: " + gon);
        }
        return gon;
    }

    private static Object[] dongDau(List<Object[]> ds) {
        return ds == null || ds.isEmpty() || ds.get(0) == null ? new Object[0] : ds.get(0);
    }

    private static long so(Object[] dong, int viTri) {
        return dong.length > viTri && dong[viTri] instanceof Number n ? n.longValue() : 0L;
    }

    // ==================== Đổi giá ====================

    /**
     * Đổi giá bán nhiều biến thể trong một giao dịch: kiểm hết trước khi ghi; biến thể ngừng hoạt động hoặc giá không đổi
     * được bỏ qua (trả về kèm lý do); mỗi biến thể đổi giá ghi một dòng lịch sử. Không bao giờ ghi giá vốn.
     */
    @Transactional(rollbackFor = Exception.class)
    public KetQuaDoiGiaBanDto doiGia(DoiGiaBanRequest yeuCau) {
        if (yeuCau == null || yeuCau.getItems() == null || yeuCau.getItems().isEmpty()) {
            throw new CommonException("Chọn ít nhất một SKU để đổi giá bán");
        }
        if (yeuCau.getItems().size() > SO_SKU_TOI_DA_MOI_LAN) {
            throw new CommonException("Mỗi lần đổi giá tối đa " + SO_SKU_TOI_DA_MOI_LAN + " SKU");
        }
        String lyDo = kiemTraLyDo(yeuCau.getLyDo());
        Map<Integer, BigDecimal> giaMoiTheoId = new LinkedHashMap<>();
        for (DoiGiaBanRequest.Dong dong : yeuCau.getItems()) {
            if (dong == null || dong.getBienTheId() == null) {
                throw new CommonException("Thiếu SKU cần đổi giá bán");
            }
            BigDecimal gia = kiemTraGiaBan(dong.getGiaBan());
            if (giaMoiTheoId.putIfAbsent(dong.getBienTheId(), gia) != null) {
                throw new CommonException("SKU id " + dong.getBienTheId() + " bị gửi trùng trong cùng một lần đổi giá");
            }
        }

        Map<Integer, BienTheSanPham> theoId = new HashMap<>();
        for (BienTheSanPham bt : giaBanRepository.khoaTheoIds(giaMoiTheoId.keySet())) {
            theoId.put(bt.getId(), bt);
        }
        List<Integer> thieu = giaMoiTheoId.keySet().stream().filter(id -> !theoId.containsKey(id)).toList();
        if (!thieu.isEmpty()) {
            throw new CommonException("Không tìm thấy SKU id: " + thieu.stream().map(String::valueOf).reduce((a, b) -> a + ", " + b).orElse(""));
        }

        NguoiDung nguoiThucHien = nguoiDangThucHien();
        Instant bayGio = Instant.now();
        List<BienTheSanPham> daDoi = new ArrayList<>();
        List<KetQuaDoiGiaBanDto.BoQua> boQua = new ArrayList<>();
        for (Map.Entry<Integer, BigDecimal> muc : giaMoiTheoId.entrySet()) {
            BienTheSanPham bt = theoId.get(muc.getKey());
            if (!Integer.valueOf(1).equals(bt.getTrangThai())) {
                boQua.add(KetQuaDoiGiaBanDto.BoQua.builder().id(bt.getId()).lyDo(BO_QUA_NGUNG_HOAT_DONG).build());
                continue;
            }
            BigDecimal giaCu = bt.getGiaBan();
            if (!laGiaDoi(giaCu, muc.getValue())) {
                boQua.add(KetQuaDoiGiaBanDto.BoQua.builder().id(bt.getId()).lyDo(BO_QUA_GIA_KHONG_DOI).build());
                continue;
            }
            bt.setGiaBan(muc.getValue());
            bienTheSanPhamRepository.save(bt);
            ghiLichSuDoiGia(bt.getId(), giaCu, muc.getValue(), lyDo, nguoiThucHien, bayGio);
            daDoi.add(bt);
        }

        capNhatGiaBanMacDinh(daDoi);

        Map<Integer, BigDecimal> ton = tonKho(daDoi.stream().map(BienTheSanPham::getId).toList());
        return KetQuaDoiGiaBanDto.builder()
                .daDoi(daDoi.stream().map(bt -> KetQuaDoiGiaBanDto.DaDoi.builder()
                        .id(bt.getId())
                        .giaBanMoi(bt.getGiaBan())
                        .tonKho(ton.getOrDefault(bt.getId(), BigDecimal.ZERO))
                        .build()).toList())
                .boQua(boQua)
                .build();
    }

    /**
     * Giá bán mặc định của sản phẩm (tìm kiếm chung, giá dự phòng khi đẩy sàn) = trung bình giá bán các biến thể còn
     * hàng, cùng cách tính với SanPhamQuanAoService.recalculatePriceAndStatus; tính lại ngay sau khi đổi giá để khỏi
     * dùng giá cũ tới lần nhập / xuất kho sau. Sản phẩm không còn biến thể nào có hàng thì giữ nguyên. Chỉ ghi đúng cột
     * này (GiaBanBienTheRepository.capNhatGiaBanMacDinh).
     */
    void capNhatGiaBanMacDinh(List<BienTheSanPham> daDoi) {
        Map<Integer, SanPhamQuanAo> sanPhams = new LinkedHashMap<>();
        for (BienTheSanPham bt : daDoi) {
            if (bt.getSanPham() != null) sanPhams.putIfAbsent(bt.getSanPham().getId(), bt.getSanPham());
        }
        for (SanPhamQuanAo sp : sanPhams.values()) {
            List<BienTheSanPham> dsBienThe = sp.getBienTheSanPhams();
            if (dsBienThe == null || dsBienThe.isEmpty()) continue;
            Map<Integer, BigDecimal> ton = tonKho(dsBienThe.stream().map(BienTheSanPham::getId).toList());
            BigDecimal tong = BigDecimal.ZERO;
            int soCoHang = 0;
            for (BienTheSanPham b : dsBienThe) {
                if (b.getGiaBan() != null && ton.getOrDefault(b.getId(), BigDecimal.ZERO).signum() > 0) {
                    tong = tong.add(b.getGiaBan());
                    soCoHang++;
                }
            }
            if (soCoHang == 0) continue;
            BigDecimal gia = tong.divide(BigDecimal.valueOf(soCoHang), 0, RoundingMode.CEILING);
            if (sp.getGiaBanMacDinh() == null || sp.getGiaBanMacDinh().compareTo(gia) != 0) {
                giaBanRepository.capNhatGiaBanMacDinh(sp.getId(), gia);
            }
        }
    }

    /**
     * Chỉ quản trị viên được đổi giá bán (PATCH /sku/gia-ban đã khóa ở controller; form Sửa sản phẩm mở cho cả quản lý
     * kho nên kiểm thêm ở đây). Gọi nội bộ (không qua HTTP) thì được.
     */
    public static boolean duocDoiGiaBan() {
        NguoiDungAuthInfo nguoiDung = SecurityContextHolder.getUser();
        return nguoiDung == null || (nguoiDung.getVaiTro() != null && nguoiDung.getVaiTro().contains(IRoleType.quan_tri_vien));
    }

    /**
     * Giá bán gửi lên: bắt buộc, không vượt giới hạn số thập phân, làm tròn 2 chữ số lẻ như cột gia_ban, phải lớn hơn 0.
     * Trả giá đã làm tròn để lưu.
     */
    public static BigDecimal kiemTraGiaBan(BigDecimal gia) {
        if (gia == null) {
            throw new CommonException("Nhập giá bán");
        }
        GioiHanSoThapPhan.kiemTra(gia, "Giá bán");
        BigDecimal lamTron = gia.setScale(2, RoundingMode.HALF_UP);
        if (lamTron.signum() <= 0) {
            throw new CommonException("Giá bán phải lớn hơn 0");
        }
        if (lamTron.compareTo(GIA_BAN_TOI_DA) > 0) {
            throw new CommonException("Giá bán vượt giới hạn cho phép");
        }
        return lamTron;
    }

    /** Giá mới khác giá đang lưu (so theo giá trị: 2000000 và 2000000.00 là một). */
    public static boolean laGiaDoi(BigDecimal giaCu, BigDecimal giaMoi) {
        return giaCu == null ? giaMoi != null : giaMoi != null && giaCu.compareTo(giaMoi) != 0;
    }

    static String kiemTraLyDo(String lyDo) {
        String gon = lyDo == null ? "" : lyDo.trim();
        if (gon.isEmpty()) {
            throw new CommonException("Chọn lý do đổi giá bán");
        }
        if (gon.length() > LY_DO_TOI_DA) {
            throw new CommonException("Lý do đổi giá tối đa " + LY_DO_TOI_DA + " ký tự");
        }
        return gon;
    }

    /** Một dòng lịch sử đổi giá bán, ghi trong giao dịch của thao tác đổi giá (lỗi thì cả lần đổi giá hoàn tác). */
    public void ghiLichSuDoiGia(Integer bienTheId, BigDecimal giaCu, BigDecimal giaMoi, String lyDo,
                                NguoiDung nguoiThucHien, Instant luc) {
        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.bien_the_san_pham)
                .idThamChieu(bienTheId)
                .hanhDong(IHanhDong.doi_gia_ban)
                .giaTriCu(jsonGiaBan(giaCu))
                .giaTriMoi(jsonGiaBan(giaMoi))
                .nguoiThucHien(nguoiThucHien)
                .ngayThucHien(luc)
                .ghiChu(lyDo)
                .build());
    }

    /** {"giaBan":2000000} — số viết gọn, không số mũ, không đuôi .00. */
    static String jsonGiaBan(BigDecimal gia) {
        return "{\"giaBan\":" + (gia == null ? "null" : gia.stripTrailingZeros().toPlainString()) + "}";
    }

    /** Người đang gọi API (cột nguoi_thuc_hien_id bắt buộc). */
    public NguoiDung nguoiDangThucHien() {
        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        if (auth == null || auth.getId() == null) {
            throw new CommonException(HttpStatus.UNAUTHORIZED, "Không xác định được người đổi giá. Đăng nhập lại rồi thử lại.");
        }
        return nguoiDungRepository.findById(auth.getId()).orElseThrow(
                () -> new CommonException(HttpStatus.UNAUTHORIZED, "Không xác định được người đổi giá. Đăng nhập lại rồi thử lại."));
    }
}
