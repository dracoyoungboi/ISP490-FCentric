package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.kiemke.KiemKeDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.ThongBaoKiemKeService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.SauCommit;
import com.dev.backend.utils.SoChungTu;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * UC-STK-06 Phê duyệt, cân bằng tồn và mở khóa; {@link #moKhoa} dùng chung với Hủy. Cả lần duyệt chạy trong một giao
 * dịch giữ mutex kho (khóa ghi): lỗi ở bất kỳ bước nào thì đợt, dòng, phiếu điều chỉnh, tồn, sổ cái, outbox và khóa đều
 * về như lúc Chờ duyệt (AC-15). Thứ tự khóa: mutex kho → đợt → dòng đợt → kệ → sổ kệ → tồn lô.
 */
@Slf4j
@Service
public class KiemKeDuyetService {

    @PersistenceContext
    private EntityManager em;

    private final DotKiemKeRepository dotRepo;
    private final ChiTietKiemKeRepository dongRepo;
    private final DotKiemKeViTriRepository dotViTriRepo;
    private final DotKiemKeKhoaLoRepository khoaLoRepo;
    private final LichSuKiemKeRepository nhatKyRepo;
    private final TonKhoViTriRepository tonKeRepo;
    private final TonKhoTheoLoRepository tonLoRepo;
    private final PhieuDieuChinhKhoRepository phieuRepo;
    private final ChiTietPhieuDieuChinhRepository dongPhieuRepo;
    private final LichSuGiaoDichKhoRepository soCaiRepo;
    private final KiemKeOutboxRepository outboxRepo;
    private final KhoaKiemKeGuard guard;
    private final SoTonKeService soTonKe;
    private final KiemKeLenhService lenh;
    private final KiemKeQuyen quyen;
    private final KiemKeSanSang sanSang;
    private final ThongBaoKiemKeService thongBao;
    private final DieuHanhHeThongService cauHinh;
    private final ObjectMapper objectMapper;
    private final KiemKeOutboxWorker worker;

    public KiemKeDuyetService(DotKiemKeRepository dotRepo, ChiTietKiemKeRepository dongRepo,
                              DotKiemKeViTriRepository dotViTriRepo, DotKiemKeKhoaLoRepository khoaLoRepo,
                              LichSuKiemKeRepository nhatKyRepo, TonKhoViTriRepository tonKeRepo,
                              TonKhoTheoLoRepository tonLoRepo, PhieuDieuChinhKhoRepository phieuRepo,
                              ChiTietPhieuDieuChinhRepository dongPhieuRepo, LichSuGiaoDichKhoRepository soCaiRepo,
                              KiemKeOutboxRepository outboxRepo, KhoaKiemKeGuard guard, SoTonKeService soTonKe,
                              KiemKeLenhService lenh, KiemKeQuyen quyen, KiemKeSanSang sanSang,
                              ThongBaoKiemKeService thongBao, DieuHanhHeThongService cauHinh, ObjectMapper objectMapper,
                              @Lazy KiemKeOutboxWorker worker) {
        this.dotRepo = dotRepo;
        this.dongRepo = dongRepo;
        this.dotViTriRepo = dotViTriRepo;
        this.khoaLoRepo = khoaLoRepo;
        this.nhatKyRepo = nhatKyRepo;
        this.tonKeRepo = tonKeRepo;
        this.tonLoRepo = tonLoRepo;
        this.phieuRepo = phieuRepo;
        this.dongPhieuRepo = dongPhieuRepo;
        this.soCaiRepo = soCaiRepo;
        this.outboxRepo = outboxRepo;
        this.guard = guard;
        this.soTonKe = soTonKe;
        this.lenh = lenh;
        this.quyen = quyen;
        this.sanSang = sanSang;
        this.thongBao = thongBao;
        this.cauHinh = cauHinh;
        this.objectMapper = objectMapper;
        this.worker = worker;
    }

    private static long khoaCap(Integer viTriId, Integer loId) {
        return KhoaKiemKeGuard.khoa(viTriId, loId);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public KiemKeDto.KetQuaLenh pheDuyet(Integer id, Long phienBan, String khoaLenh) {
        sanSang.batBuoc();
        String khoa = lenh.chuanHoa(khoaLenh);
        NguoiDung nguoi = quyen.nguoiHienTai();
        DotKiemKe xem = dotRepo.findById(id)
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE, "Không tìm thấy đợt kiểm kê"));
        guard.giuKhoGhi(xem.getKho().getId());
        DotKiemKe dot = dotRepo.khoaTheoId(id).orElseThrow();
        em.refresh(dot, LockModeType.PESSIMISTIC_WRITE);
        KhoDangChon.kiemTra(dot.getKho(), KiemKeService.ten(dot));
        if (!quyen.duocDuyet(quyen.nguoiXem(), dot)) {
            throw new LoiCoMaException(HttpStatus.FORBIDDEN, MaLoi.STK_INVALID_STATE,
                    "Chỉ quản lý kho có quyền điều chỉnh tồn kho mới phê duyệt kiểm kê");
        }
        Integer khoId = dot.getKho().getId();
        String hash = lenh.bam(IKiemKe.LENH_PHE_DUYET, Map.of("id", id, "phienBan", phienBan == null ? -1 : phienBan));
        Optional<KiemKeDto.KetQuaLenh> cu = lenh.daXuLy(khoId, khoa, IKiemKe.LENH_PHE_DUYET, hash);
        if (cu.isPresent()) return cu.get();
        if (dot.getTrangThai() != IKiemKe.CHO_DUYET) {
            throw KiemKeService.saiTrangThai(dot.getTrangThai() == IKiemKe.DANG_KIEM_KE
                    ? "Phải Hoàn thành và trình duyệt trước khi phê duyệt" : "Chỉ phê duyệt được đợt đang chờ duyệt", dot);
        }
        KiemKeService.kiemTraPhienBan(dot, phienBan);

        List<ChiTietKiemKe> dong = dongRepo.khoaTheoDot(id);
        for (ChiTietKiemKe d : dong) {
            byte tt = d.getTrangThai() == null ? IKiemKe.DONG_CHUA_KIEM : d.getTrangThai();
            if (d.getSoLuongThucTe() == null || (tt != IKiemKe.DONG_DA_KIEM && tt != IKiemKe.DONG_DA_XAC_NHAN)) {
                throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_COUNT_INCOMPLETE,
                        "Kết quả chưa đủ điều kiện duyệt: còn dòng chưa có số đếm hợp lệ");
            }
        }
        KiemKeService.kiemTraDuSoDem(dong);

        // Khóa còn hiệu lực và thuộc đợt
        List<DotKiemKeViTri> keCuaDot = dotViTriRepo.theoDot(id).stream().filter(v -> v.getTrangThaiKhoa() == 1).toList();
        Set<Long> capCuaDot = khoaLoRepo.findByDotKiemKeIdAndTrangThaiKhoa(id, 1).stream()
                .map(k -> khoaCap(k.getViTriKhoId(), k.getLoHangId())).collect(Collectors.toSet());
        boolean toanKe = IKiemKe.laKhoaToanKe(dot.getLoaiKiemKe().name());
        Set<Integer> keKhoaToan = keCuaDot.stream().filter(v -> IKiemKe.TOAN_KE.equals(v.getCheDoKhoa()))
                .map(v -> v.getViTriKho().getId()).collect(Collectors.toSet());
        for (ChiTietKiemKe d : dong) {
            Integer ke = d.getViTriKe() == null ? null : d.getViTriKe().getId();
            boolean conKhoa = ke != null && (toanKe ? keKhoaToan.contains(ke) : capCuaDot.contains(khoaCap(ke, d.getLoHang().getId())));
            if (!conKhoa) {
                throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_INVALID_STATE,
                        "Khóa kiểm kê của dòng " + d.getViTriKho() + " / " + d.getLoHang().getMaLo()
                                + " không còn thuộc đợt. Không phê duyệt được, hãy báo quản trị viên");
            }
        }

        // Khóa kệ của đợt, rồi sổ kệ của các dòng, rồi tồn lô (id tăng dần)
        List<Integer> keIds = keCuaDot.stream().map(v -> v.getViTriKho().getId()).sorted().toList();
        if (!keIds.isEmpty()) {
            em.createQuery("SELECT v FROM ViTriKho v WHERE v.id IN :ids ORDER BY v.id", ViTriKho.class)
                    .setParameter("ids", keIds).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        }
        Set<Integer> loIds = dong.stream().map(d -> d.getLoHang().getId()).collect(Collectors.toCollection(TreeSet::new));
        Map<Long, TonKhoViTri> tonKe = new HashMap<>();
        if (!loIds.isEmpty()) {
            List<Integer> tonKeIds = em.createQuery("SELECT t.id FROM TonKhoViTri t WHERE t.loHang.id IN :lo "
                            + "AND t.viTriKho.kho.id = :kho ORDER BY t.id", Integer.class)
                    .setParameter("lo", loIds).setParameter("kho", khoId).getResultList();
            if (!tonKeIds.isEmpty()) {
                for (TonKhoViTri t : tonKeRepo.khoaTheoIds(tonKeIds)) {
                    em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
                    tonKe.put(khoaCap(t.getViTriKho().getId(), t.getLoHang().getId()), t);
                }
            }
        }
        Map<Integer, TonKhoTheoLo> tonLo = new HashMap<>();
        if (!loIds.isEmpty()) {
            List<Integer> tonLoIds = tonLoRepo.findIdsByKhoAndLots(khoId, loIds);
            if (!tonLoIds.isEmpty()) {
                for (TonKhoTheoLo t : tonLoRepo.lockLotsForUpdateByIds(tonLoIds)) {
                    em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
                    tonLo.put(t.getLoHang().getId(), t);
                }
            }
        }

        // Tồn ở kệ hiện tại phải bằng số chốt (AC-20)
        List<String> doi = new ArrayList<>();
        for (ChiTietKiemKe d : dong) {
            TonKhoViTri t = tonKe.get(khoaCap(d.getViTriKe().getId(), d.getLoHang().getId()));
            int hienTai = t == null || t.getSoLuong() == null ? 0 : t.getSoLuong();
            int chot = SoTonKeService.soNguyen(d.getSoLuongHeThong());
            if (hienTai != chot) doi.add(d.getViTriKho() + " / " + d.getLoHang().getMaLo() + ": chốt " + chot + ", hiện " + hienTai);
        }
        if (!doi.isEmpty()) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_STOCK_CHANGED,
                    "Tồn ở kệ đã đổi so với số chốt lúc bắt đầu: " + KiemKePhamViService.gon(doi)
                            + ". Dừng duyệt để kiểm tra biến động; đợt vẫn chờ duyệt và giữ khóa.",
                    Map.of("vanDe", doi));
        }

        // Tồn lô sau điều chỉnh ≥ 0 và ≥ phần đang giữ cho đơn (AC-19)
        Map<Integer, BigDecimal> tongQ = new HashMap<>();
        for (ChiTietKiemKe d : dong) {
            if (KiemKeTinhToan.lech(d)) tongQ.merge(d.getLoHang().getId(), d.getChenhLechSoLuong(), BigDecimal::add);
        }
        List<String> thieuGiu = new ArrayList<>();
        Map<Integer, String> maLo = dong.stream().collect(Collectors.toMap(d -> d.getLoHang().getId(), d -> d.getLoHang().getMaLo(), (a, b) -> a));
        for (Map.Entry<Integer, BigDecimal> e : tongQ.entrySet()) {
            TonKhoTheoLo t = tonLo.get(e.getKey());
            BigDecimal ton = t == null || t.getSoLuongTon() == null ? BigDecimal.ZERO : t.getSoLuongTon();
            BigDecimal giu = t == null || t.getSoLuongDaDat() == null ? BigDecimal.ZERO : t.getSoLuongDaDat();
            BigDecimal moi = ton.add(e.getValue());
            if (moi.signum() < 0 || moi.compareTo(giu) < 0) {
                thieuGiu.add("lô " + maLo.get(e.getKey()) + ": tồn sau duyệt " + KiemKePhamViService.so(moi)
                        + ", đang giữ cho đơn " + KiemKePhamViService.so(giu));
            }
        }
        if (!thieuGiu.isEmpty()) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_RESERVED_EXCEEDS_STOCK,
                    "Tồn sau điều chỉnh thấp hơn phần đang giữ cho đơn: " + KiemKePhamViService.gon(thieuGiu)
                            + ". Xử lý đơn đang giữ hàng trước rồi duyệt lại; đợt vẫn giữ khóa.",
                    Map.of("vanDe", thieuGiu));
        }

        Instant bayGio = Instant.now();
        List<ChiTietKiemKe> lech = dong.stream().filter(KiemKeTinhToan::lech)
                .sorted(Comparator.comparing((ChiTietKiemKe d) -> d.getLoHang().getId())
                        .thenComparing(d -> d.getViTriKho() == null ? "" : d.getViTriKho()).thenComparing(ChiTietKiemKe::getId))
                .toList();
        PhieuDieuChinhKho phieu = lech.isEmpty() ? null : ghiDieuChinh(dot, lech, tonLo, nguoi, bayGio);

        for (ChiTietKiemKe d : dong) {
            d.setTrangThai(IKiemKe.DONG_DA_XAC_NHAN);
            d.setPhienBan((d.getPhienBan() == null ? 0 : d.getPhienBan()) + 1);
            d.setNgayCapNhat(bayGio);
            dongRepo.save(d);
        }
        dot.setTrangThai(IKiemKe.DA_DUYET);
        dot.setNguoiDuyet(nguoi);
        dot.setNgayDuyet(bayGio);
        dot.setNgayKetThuc(bayGio);
        dot.setPhienBan((dot.getPhienBan() == null ? 0 : dot.getPhienBan()) + 1);
        dot.setNgayCapNhat(bayGio);
        dotRepo.save(dot);
        moKhoa(dot, nguoi);
        boolean coOutbox = phieu != null && ghiOutbox(dot, phieu, lech, bayGio);

        boolean tuDuyet = dot.getNguoiChuTri() != null && dot.getNguoiChuTri().getId().equals(nguoi.getId());
        String noiDung = (phieu == null ? "Đã duyệt; khớp toàn bộ, không tạo phiếu điều chỉnh"
                : "Đã duyệt; tạo phiếu " + phieu.getSoPhieu() + " (" + lech.size() + " dòng lệch)")
                + "; giải phóng khóa của đợt" + (tuDuyet ? ". Người chủ trì tự duyệt đợt của mình" : "");
        LichSuKiemKe l = new LichSuKiemKe();
        l.setDotKiemKe(dot);
        l.setHanhDong(IKiemKe.HD_PHE_DUYET);
        l.setNoiDung(noiDung);
        l.setNguoiThucHien(nguoi);
        l.setNgayThucHien(bayGio);
        nhatKyRepo.save(l);
        thongBao.daDuyet(dot, phieu == null ? null : phieu.getSoPhieu(), nguoi);
        KiemKeDto.KetQuaLenh kq = KiemKeService.ketQua(dot, phieu);
        lenh.ghi(khoId, khoa, IKiemKe.LENH_PHE_DUYET, hash, kq);
        if (coOutbox) {
            Integer dotId = dot.getId();
            SauCommit.chay("Đẩy tồn sau duyệt kiểm kê " + dot.getMaDotKiemKe(), () -> worker.guiCuaDot(dotId));
        }
        return kq;
    }

    /** Phiếu điều chỉnh nguồn kiểm kê, cập nhật sổ kệ + tồn lô và sổ cái nối tiếp theo từng lô (BR-STK-09). */
    private PhieuDieuChinhKho ghiDieuChinh(DotKiemKe dot, List<ChiTietKiemKe> lech, Map<Integer, TonKhoTheoLo> tonLo,
                                           NguoiDung nguoi, Instant bayGio) {
        boolean coTang = lech.stream().anyMatch(d -> d.getChenhLechSoLuong().signum() > 0);
        boolean coGiam = lech.stream().anyMatch(d -> d.getChenhLechSoLuong().signum() < 0);
        String tienTo = IChuyenKho.TIEN_TO_DIEU_CHINH + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "-";
        PhieuDieuChinhKho phieu = new PhieuDieuChinhKho();
        phieu.setSoPhieu(SoChungTu.tiepTheoBaChuSo(tienTo, phieuRepo.soDuoiLonNhat(tienTo)));
        phieu.setNguon("kiem_ke");
        phieu.setDotKiemKe(dot);
        phieu.setKho(dot.getKho());
        phieu.setLoaiDieuChinh(coTang && coGiam ? "ca_hai" : coTang ? "tang" : "giam");
        phieu.setNgayDieuChinh(bayGio);
        phieu.setTrangThai(2); // Đã áp dụng: duyệt kiểm kê chính là duyệt phiếu
        phieu.setLyDo("Kiểm kê " + dot.getMaDotKiemKe() + ": " + (dot.getLyDo() == null ? dot.getTenDotKiemKe() : dot.getLyDo()));
        phieu.setNguoiLap(nguoi);
        phieu.setNguoiDuyet(nguoi);
        phieu.setNgayDuyet(bayGio);
        phieu.setGhiChu("Điều chỉnh theo đợt kiểm kê " + dot.getMaDotKiemKe() + " (" + dot.getTenDotKiemKe() + ")");
        phieu.setTongGiaTriTang(BigDecimal.ZERO);
        phieu.setTongGiaTriGiam(BigDecimal.ZERO);
        phieu.setGiaTriChenhLechThuan(BigDecimal.ZERO);
        phieu = phieuRepo.save(phieu);

        BigDecimal tang = BigDecimal.ZERO;
        BigDecimal giam = BigDecimal.ZERO;
        for (ChiTietKiemKe d : lech) {
            LoHang lo = d.getLoHang();
            BigDecimal q = d.getChenhLechSoLuong();
            BigDecimal c = d.getGiaVonHeThong() == null ? BigDecimal.ZERO : d.getGiaVonHeThong();
            TonKhoTheoLo ton = tonLo.get(lo.getId());
            if (ton == null) {
                // Lô phát sinh chưa từng có tồn ở kho này
                ton = TonKhoTheoLo.builder().loHang(lo).kho(dot.getKho()).soLuongTon(BigDecimal.ZERO)
                        .soLuongDaDat(BigDecimal.ZERO).build();
                tonLo.put(lo.getId(), ton);
            }
            BigDecimal truoc = ton.getSoLuongTon() == null ? BigDecimal.ZERO : ton.getSoLuongTon();
            BigDecimal sau = truoc.add(q);
            ton.setSoLuongTon(sau);
            ton.setLanCapNhatCuoi(bayGio);
            if (q.signum() > 0 && ton.getNgayNhapGanNhat() == null) ton.setNgayNhapGanNhat(bayGio);
            if (q.signum() < 0) ton.setNgayXuatGanNhat(bayGio);
            tonLoRepo.save(ton);
            soTonKe.datSo(d.getViTriKe(), lo, d.getBienTheSanPham(), SoTonKeService.soNguyen(d.getSoLuongThucTe()));

            BigDecimal thanhTien = q.abs().multiply(c);
            ChiTietPhieuDieuChinh dp = new ChiTietPhieuDieuChinh();
            dp.setPhieuDieuChinhKho(phieu);
            dp.setChiTietKiemKe(d);
            dp.setBienTheSanPham(d.getBienTheSanPham());
            dp.setLoHang(lo);
            dp.setSoLuongDieuChinh(q);
            dp.setGiaVon(c);
            dp.setThanhTien(thanhTien);
            dp.setLoaiDieuChinh(q.signum() > 0 ? "tang" : "giam");
            dp.setGhiChu(d.getLyDoChenhLech());
            dongPhieuRepo.save(dp);
            if (q.signum() > 0) tang = tang.add(thanhTien);
            else giam = giam.add(thanhTien);

            soCaiRepo.save(LichSuGiaoDichKho.builder()
                    .ngayGiaoDich(bayGio)
                    .loaiGiaoDich("dieu_chinh")
                    .loaiThamChieu(ITable.phieu_dieu_chinh_kho)
                    .idThamChieu(phieu.getId())
                    .bienTheSanPham(d.getBienTheSanPham())
                    .loHang(lo)
                    .kho(dot.getKho())
                    .soLuong(q)
                    .soLuongTruoc(truoc)
                    .soLuongSau(sau)
                    .giaVon(c)
                    .nguoiDung(nguoi)
                    .ghiChu("Kiểm kê " + dot.getMaDotKiemKe() + ", kệ " + d.getViTriKho() + " (" + phieu.getSoPhieu() + ")")
                    .build());
        }
        phieu.setTongGiaTriTang(tang);
        phieu.setTongGiaTriGiam(giam);
        phieu.setGiaTriChenhLechThuan(tang.subtract(giam));
        return phieuRepo.save(phieu);
    }

    /**
     * Mở đúng các khóa do đợt sở hữu (không UPDATE hàng loạt cả kho). Cờ đệm dang_kiem_ke tính lại theo khóa mịn còn lại
     * của đợt khác; kệ khóa toàn kệ tính lại HOAT_DONG / DAY_HANG theo sức chứa, kệ bảo trì giữ nguyên (BA 4.3).
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void moKhoa(DotKiemKe dot, NguoiDung nguoi) {
        Instant bayGio = Instant.now();
        Integer nguoiId = nguoi == null ? null : nguoi.getId();
        List<DotKiemKeKhoaLo> cap = khoaLoRepo.findByDotKiemKeIdAndTrangThaiKhoa(dot.getId(), 1);
        for (DotKiemKeKhoaLo k : cap) {
            k.setTrangThaiKhoa(0);
            k.setThoiDiemMoKhoa(bayGio);
            k.setNguoiMoKhoaId(nguoiId);
            khoaLoRepo.save(k);
        }
        em.flush();
        for (DotKiemKeKhoaLo k : cap) {
            em.createNativeQuery("""
                    UPDATE ton_kho_vi_tri t
                       SET t.dang_kiem_ke = CASE WHEN EXISTS (SELECT 1 FROM dot_kiem_ke_khoa_lo x
                             WHERE x.vi_tri_kho_id = t.vi_tri_kho_id AND x.lo_hang_id = t.lo_hang_id AND x.trang_thai_khoa = 1)
                           THEN 1 ELSE 0 END
                     WHERE t.vi_tri_kho_id = :ke AND t.lo_hang_id = :lo
                    """).setParameter("ke", k.getViTriKhoId()).setParameter("lo", k.getLoHangId()).executeUpdate();
        }
        List<DotKiemKeViTri> ke = dotViTriRepo.theoDot(dot.getId()).stream().filter(v -> v.getTrangThaiKhoa() == 1)
                .sorted(Comparator.comparing(v -> v.getViTriKho().getId())).toList();
        if (!ke.isEmpty()) {
            em.createQuery("SELECT v FROM ViTriKho v WHERE v.id IN :ids ORDER BY v.id", ViTriKho.class)
                    .setParameter("ids", ke.stream().map(v -> v.getViTriKho().getId()).toList())
                    .setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        }
        for (DotKiemKeViTri v : ke) {
            v.setTrangThaiKhoa(0);
            v.setThoiDiemMoKhoa(bayGio);
            v.setNguoiMoKhoaId(nguoiId);
            dotViTriRepo.save(v);
            ViTriKho k = v.getViTriKho();
            em.refresh(k, LockModeType.PESSIMISTIC_WRITE);
            if (IKiemKe.TOAN_KE.equals(v.getCheDoKhoa()) && IKiemKe.KE_KHOA_KIEM_KE.equals(k.getTrangThai())) {
                if (IKiemKe.KE_BAO_TRI.equals(v.getTrangThaiTruocKhoa())) {
                    k.setTrangThai(IKiemKe.KE_BAO_TRI);
                } else {
                    em.flush();
                    Integer dangChua = tonKeRepo.sumDangChuaByViTriId(k.getId());
                    int sucChua = k.getSucChuaToiDa() == null ? 0 : k.getSucChuaToiDa();
                    k.setTrangThai(sucChua > 0 && dangChua != null && dangChua >= sucChua ? IKiemKe.KE_DAY_HANG : IKiemKe.KE_HOAT_DONG);
                }
            }
        }
    }

    /** Sự kiện đẩy tồn cho từng biến thể có tồn đổi (BR-STK-14); dưới ngưỡng tồn thấp thì gửi ngay sau commit. */
    private boolean ghiOutbox(DotKiemKe dot, PhieuDieuChinhKho phieu, List<ChiTietKiemKe> lech, Instant bayGio) {
        Map<Integer, BigDecimal> delta = new LinkedHashMap<>();
        for (ChiTietKiemKe d : lech) delta.merge(d.getBienTheSanPham().getId(), d.getChenhLechSoLuong(), BigDecimal::add);
        if (delta.isEmpty()) return false;
        int nguong = Math.max(0, cauHinh.getCauHinhInt("REALTIME_SYNC_THRESHOLD", 3));
        int chuKy = Math.max(1, cauHinh.getCauHinhInt("OMNI_SYNC_INTERVAL_MINS", 10));
        Map<Integer, BigDecimal> khaDung = new HashMap<>();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("SELECT l.bien_the_san_pham_id, SUM(t.so_luong_kha_dung) FROM ton_kho_theo_lo t "
                        + "JOIN lo_hang l ON l.id = t.lo_hang_id WHERE t.kho_id = :kho AND l.bien_the_san_pham_id IN (:bt) "
                        + "GROUP BY l.bien_the_san_pham_id")
                .setParameter("kho", dot.getKho().getId()).setParameter("bt", delta.keySet()).getResultList();
        rows.forEach(r -> khaDung.put(((Number) r[0]).intValue(), r[1] == null ? BigDecimal.ZERO : (BigDecimal) r[1]));
        boolean coUuTien = false;
        for (Map.Entry<Integer, BigDecimal> e : delta.entrySet()) {
            boolean uuTien = khaDung.getOrDefault(e.getKey(), BigDecimal.ZERO).compareTo(BigDecimal.valueOf(nguong)) < 0;
            coUuTien |= uuTien;
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("maDotKiemKe", dot.getMaDotKiemKe());
            payload.put("soPhieu", phieu.getSoPhieu());
            payload.put("khoId", dot.getKho().getId());
            payload.put("bienTheSanPhamId", e.getKey());
            payload.put("delta", e.getValue());
            payload.put("phienBan", dot.getPhienBan());
            String json;
            try {
                json = objectMapper.writeValueAsString(payload);
            } catch (Exception ex) {
                json = "{}";
            }
            outboxRepo.save(KiemKeOutbox.builder()
                    .dotKiemKeId(dot.getId())
                    .khoId(dot.getKho().getId())
                    .bienTheSanPhamId(e.getKey())
                    .payload(json)
                    .uuTien(uuTien ? 1 : 0)
                    .trangThai(IKiemKe.OUTBOX_CHO_GUI)
                    .soLanThu(0)
                    .thuLaiLuc(uuTien ? bayGio : bayGio.plusSeconds(60L * chuKy))
                    .ngayTao(bayGio)
                    .build());
        }
        return coUuTien;
    }
}
