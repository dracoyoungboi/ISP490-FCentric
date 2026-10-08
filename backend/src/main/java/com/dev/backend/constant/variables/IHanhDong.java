package com.dev.backend.constant.variables;

public interface IHanhDong {

    //Quyền hạn
    String
            cap_quyen = "cap_quyen",
            thu_hoi_quyen = "thu_hoi_quyen",
            cap_nhat_quyen = "cap_nhat_quyen",
            them_kho = "them_kho",
            xoa_kho = "xoa_kho",
            nang_cap_chuc_vu = "nang_cap_chuc_vu";
    //Sản phẩm
    String
            cap_nhat_san_pham = "cap_nhat_san_pham",
            them_moi_san_pham = "them_moi_san_pham",
            xoa_san_pham = "xoa_san_pham",
            tao_pick_list = "tao_pick_list",
            phan_cong_nhat_hang = "phan_cong_nhat_hang",
            quet_barcode = "quet_barcode",
            hoan_tat_nhat_hang = "hoan_tat_nhat_hang";
    //Yêu cầu nhập hàng (ghi vào lich_su_thay_doi, ghi_chu = lý do từ chối)
    String
            duyet_yeu_cau_mua_hang = "duyet_yeu_cau_mua_hang",
            tu_choi_yeu_cau_mua_hang = "tu_choi_yeu_cau_mua_hang";
}
