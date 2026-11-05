package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;
import com.dev.backend.entities.MauSac;
import com.dev.backend.repository.MauSacRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
@Service
public class MauSacService extends BaseServiceImpl<MauSac, Integer> {
    @Autowired
    private EntityManager entityManager;

    /** Nhật ký nghiệp vụ (danh mục chung); null khi unit test dựng tay. */
    @Autowired(required = false)
    private NhatKyNghiepVu nhatKy;
    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public MauSacService(MauSacRepository repository) {
        super(repository);
    }

    @Override
    @Transactional
    public MauSac create(MauSac entity) {
        MauSac daTao = super.create(entity);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.mau_sac, daTao.getId(), IHanhDong.them_danh_muc_chung)
                .ma(daTao.getTenMau())
                .moi(anh(daTao)));
        return daTao;
    }

    @Override
    @Transactional
    public MauSac update(Integer id, MauSac entity) {
        // Đọc giá trị cũ trước khi lưu (lưu là merge vào bản đang quản lý trong cùng giao dịch)
        Map<String, Object> truoc = repository.findById(id).map(MauSacService::anh).orElse(null);
        MauSac daLuu = super.update(id, entity);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.mau_sac, daLuu.getId(), IHanhDong.sua_danh_muc_chung)
                .ma(daLuu.getTenMau())
                .thayDoi(truoc, anh(daLuu)));
        return daLuu;
    }

    @Override
    @Transactional
    public void delete(Integer id) {
        repository.findById(id).ifPresent(cu -> ghiNhatKy(
                NhatKyNghiepVu.dong(ITable.mau_sac, cu.getId(), IHanhDong.xoa_danh_muc_chung)
                        .ma(cu.getTenMau())
                        .cu(anh(cu))));
        super.delete(id);
    }

    private void ghiNhatKy(NhatKyNghiepVu.Dong dong) {
        if (nhatKy != null) nhatKy.ghi(dong);
    }

    private static Map<String, Object> anh(MauSac x) {
        return NhatKyNghiepVu.anh(
                "ma", x.getMaMau(),
                "ten", x.getTenMau(),
                "maMauHex", x.getMaMauHex());
    }
}
