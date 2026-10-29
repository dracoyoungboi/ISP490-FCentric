import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/thongBaoNhanh";
import { SO_ANH_TOI_DA, cauAnhKhongDoc, cauBoQua, locAnhChon, thuNhoAnh } from "./anhBienBan.js";

/**
 * Ảnh đang chọn (chưa tải lên) cho biên bản giao nhận. Mỗi ảnh: { khoa, file (JPEG đã thu nhỏ), url (xem trước), ten,
 * moTa }. `them(tep, daCo)`: lọc ảnh, nhận đủ chỗ còn lại (`daCo` = số ảnh biên bản đã có trên máy chủ), thu nhỏ từng
 * ảnh, trả các ảnh vừa thêm; `bo(khoa)`, `boNhieu(khoas)`, `doiMoTa(khoa, moTa)`, `xoaHet()`. URL xem trước tự thu hồi
 * khi bỏ ảnh hoặc rời màn. `xoaHet()` lúc ảnh còn đang xử lý (đóng hộp) thì ảnh xử lý xong sau đó bị bỏ, không quay
 * lại danh sách.
 */
export default function useAnhChon() {
    const [ds, setDs] = useState([]);
    const [dangXuLy, setDangXuLy] = useState(false);
    const urlRef = useRef(new Set());
    const demRef = useRef(0);
    const daGoRef = useRef(false);
    // Phiên chọn ảnh: tăng mỗi lần xoaHet; them() thấy phiên đổi thì bỏ ảnh vừa xử lý
    const phienRef = useRef(0);
    // Số lần them() đang chạy (chọn thêm ảnh khi lần trước chưa xong): hết mới tắt dangXuLy
    const soDangXuLyRef = useRef(0);

    useEffect(() => {
        const urls = urlRef.current;
        daGoRef.current = false;
        return () => {
            daGoRef.current = true;
            urls.forEach((u) => URL.revokeObjectURL(u));
            urls.clear();
        };
    }, []);

    const thuHoi = useCallback((dsBo) => {
        dsBo.forEach((a) => {
            URL.revokeObjectURL(a.url);
            urlRef.current.delete(a.url);
        });
    }, []);

    const them = useCallback(async (tep, daCo = 0) => {
        const { nhan, ...boQua } = locAnhChon(tep, daCo + ds.length, SO_ANH_TOI_DA);
        const cau = cauBoQua(boQua);
        if (cau) toast.warning(cau);
        if (!nhan.length) return [];
        const phien = phienRef.current;
        const daBo = () => daGoRef.current || phien !== phienRef.current;
        soDangXuLyRef.current += 1;
        setDangXuLy(true);
        const moi = [];
        const khongDoc = [];
        try {
            for (const f of nhan) {
                if (daBo()) break;
                try {
                    const file = await thuNhoAnh(f);
                    const url = URL.createObjectURL(file);
                    urlRef.current.add(url);
                    demRef.current += 1;
                    moi.push({ khoa: `anh-${demRef.current}`, file, url, ten: f.name, moTa: "" });
                } catch {
                    khongDoc.push(f);
                }
            }
        } finally {
            soDangXuLyRef.current -= 1;
            if (!daGoRef.current && soDangXuLyRef.current === 0) setDangXuLy(false);
        }
        // Rời màn, hoặc hộp đã đóng (xoaHet) trong lúc xử lý: bỏ ảnh vừa xử lý, không thêm vào danh sách đã xóa
        if (daBo()) {
            thuHoi(moi);
            return [];
        }
        const loiDoc = cauAnhKhongDoc(khongDoc);
        if (loiDoc) toast.error(loiDoc.tieuDe, { description: loiDoc.moTa });
        if (moi.length) setDs((cu) => [...cu, ...moi]);
        return moi;
    }, [ds.length, thuHoi]);

    const boNhieu = useCallback((khoas) => {
        const bo = new Set(khoas);
        thuHoi(ds.filter((a) => bo.has(a.khoa)));
        setDs((cu) => cu.filter((a) => !bo.has(a.khoa)));
    }, [ds, thuHoi]);

    const bo = useCallback((khoa) => boNhieu([khoa]), [boNhieu]);

    const doiMoTa = useCallback((khoa, moTa) => {
        setDs((cu) => cu.map((a) => (a.khoa === khoa ? { ...a, moTa } : a)));
    }, []);

    const xoaHet = useCallback(() => {
        phienRef.current += 1;
        thuHoi(ds);
        setDs([]);
    }, [ds, thuHoi]);

    return { ds, dangXuLy, them, bo, boNhieu, doiMoTa, xoaHet };
}
