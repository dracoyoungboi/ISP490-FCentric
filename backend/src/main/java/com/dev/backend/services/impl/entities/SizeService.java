package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;
import com.dev.backend.entities.Size;
import com.dev.backend.repository.SizeRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
@Service
public class SizeService extends BaseServiceImpl<Size, Integer> {
    @Autowired
    private EntityManager entityManager;

    /** Nhật ký nghiệp vụ (danh mục chung); null khi unit test dựng tay. */
    @Autowired(required = false)
    private NhatKyNghiepVu nhatKy;
    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public SizeService(SizeRepository repository) {
        super(repository);
    }

    @Override
    @Transactional
    public Size create(Size entity) {
        Size daTao = super.create(entity);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.size, daTao.getId(), IHanhDong.them_danh_muc_chung)
                .ma(daTao.getTenSize())
                .moi(anh(daTao)));
        return daTao;
    }

    @Override
    @Transactional
    public Size update(Integer id, Size entity) {
        // Đọc giá trị cũ trước khi lưu (lưu là merge vào bản đang quản lý trong cùng giao dịch)
        Map<String, Object> truoc = repository.findById(id).map(SizeService::anh).orElse(null);
        Size daLuu = super.update(id, entity);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.size, daLuu.getId(), IHanhDong.sua_danh_muc_chung)
                .ma(daLuu.getTenSize())
                .thayDoi(truoc, anh(daLuu)));
        return daLuu;
    }

    @Override
    @Transactional
    public void delete(Integer id) {
        repository.findById(id).ifPresent(cu -> ghiNhatKy(
                NhatKyNghiepVu.dong(ITable.size, cu.getId(), IHanhDong.xoa_danh_muc_chung)
                        .ma(cu.getTenSize())
                        .cu(anh(cu))));
        super.delete(id);
    }

    private void ghiNhatKy(NhatKyNghiepVu.Dong dong) {
        if (nhatKy != null) nhatKy.ghi(dong);
    }

    private static Map<String, Object> anh(Size x) {
        return NhatKyNghiepVu.anh(
                "ma", x.getMaSize(),
                "ten", x.getTenSize(),
                "loaiSize", x.getLoaiSize(),
                "thuTu", x.getThuTuSapXep(),
                "moTa", x.getMoTa());
    }
    /** Toàn bộ kích cỡ theo thứ tự hiển thị chuẩn (thu_tu_sap_xep, cùng thứ tự thì theo id). */
    public List<Size> getAllTheoThuTu() {
        return repository.findAll(Sort.by("thuTuSapXep").and(Sort.by("id")));
    }
}
