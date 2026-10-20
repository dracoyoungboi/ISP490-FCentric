package com.dev.backend.constant.variables;

public interface IHanhDong {

    //Quyền hạn
    String
            cap_quyen = "cap_quyen",
            thu_hoi_quyen = "thu_hoi_quyen",
            cap_nhat_quyen = "cap_nhat_quyen",
            them_kho = "them_kho",
            xoa_kho = "xoa_kho",
            nang_cap_chuc_vu = "nang_cap_chuc_vu",
            // Một lần lưu ở ngăn kéo Phân quyền (vai trò + kho + tập quyền), giá trị cũ/mới là ảnh chụp JSON
            cap_nhat_phan_quyen = "cap_nhat_phan_quyen",
            cap_nhat_mau_quyen = "cap_nhat_mau_quyen";
    //Sản phẩm
    String
            cap_nhat_san_pham = "cap_nhat_san_pham",
            them_moi_san_pham = "them_moi_san_pham",
            xoa_san_pham = "xoa_san_pham",
            tao_pick_list = "tao_pick_list",
            phan_cong_nhat_hang = "phan_cong_nhat_hang",
            quet_barcode = "quet_barcode",
            hoan_tat_nhat_hang = "hoan_tat_nhat_hang",
            phan_bo_lo_nhat_hang = "phan_bo_lo_nhat_hang",
            sua_lo_phieu_xuat = "sua_lo_phieu_xuat",
            tao_lai_phieu_xuat = "tao_lai_phieu_xuat",
            quet_dong_goi = "quet_dong_goi",
            hoan_tat_dong_goi = "hoan_tat_dong_goi";
    //Yêu cầu nhập hàng (ghi vào lich_su_thay_doi, ghi_chu = lý do từ chối)
    String
            duyet_yeu_cau_mua_hang = "duyet_yeu_cau_mua_hang",
            tu_choi_yeu_cau_mua_hang = "tu_choi_yeu_cau_mua_hang",
            nhap_kho = "nhap_kho",
            xuat_kho = "xuat_kho",
            cap_nhat_kenh_ban = "cap_nhat_kenh_ban",
            dong_bo_san_pham = "dong_bo_san_pham",
            dong_bo_ton_kho = "dong_bo_ton_kho",
            cap_nhat_cau_hinh = "cap_nhat_cau_hinh";
    //Mẫu in: mỗi lần lưu một phiên bản (lich_su_thay_doi.loai_tham_chieu = cau_hinh_mau_in,
    //id_tham_chieu = id dòng cau_hinh_mau_in; gia_tri_cu / gia_tri_moi = ảnh chụp JSON cấu hình)
    String
            cap_nhat_mau_in = "cap_nhat_mau_in";
}
