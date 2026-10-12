/**
 * Hook dùng chung cho form Thêm và form Chỉnh sửa sản phẩm (popup):
 * ảnh xem trước, hỏi trước khi bỏ thay đổi, chặn rời trang và chặn thả tệp lệch khung.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cuonToiLoi } from "./kieuForm";
import { kiemTraTepAnh } from "./logicBienThe";

let soAnhDaTao = 0;

/**
 * Tạo URL xem trước cho tệp ảnh và tự thu hồi URL khi không còn ảnh nào dùng
 * (ảnh sản phẩm và ảnh màu có thể dùng chung một URL). Đóng trang thì thu hồi hết.
 * @param {Array<{url: string}>} dsDangDung mọi ảnh đang hiển thị
 */
export function useAnhXemTruoc(dsDangDung) {
    const urlRef = useRef(new Set());

    const taoAnhXemTruoc = useCallback((file) => {
        const url = URL.createObjectURL(file);
        urlRef.current.add(url);
        soAnhDaTao += 1;
        return { id: `moi-${soAnhDaTao}`, file, url };
    }, []);

    useEffect(() => {
        const dangDung = new Set(dsDangDung.map((anh) => anh.url));
        for (const url of urlRef.current) {
            if (!dangDung.has(url)) {
                URL.revokeObjectURL(url);
                urlRef.current.delete(url);
            }
        }
    }, [dsDangDung]);

    useEffect(() => {
        const urls = urlRef.current;
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
        };
    }, []);

    return taoAnhXemTruoc;
}

/** Giữ các tệp ảnh hợp lệ; tệp sai loại hoặc quá 10 MB thì báo (gộp 1 thông báo nếu nhiều tệp). */
export function locTepAnhHopLe(files) {
    const hopLe = [];
    const loi = [];
    for (const tep of files) {
        const thongBao = kiemTraTepAnh(tep);
        if (thongBao) loi.push(thongBao);
        else hopLe.push(tep);
    }
    if (loi.length === 1) toast.error(`${loi[0]}. Vui lòng chọn ảnh khác.`);
    if (loi.length > 1) {
        toast.error(`${loi.length} tệp không hợp lệ (chỉ nhận ảnh, tối đa 10 MB mỗi ảnh). Vui lòng chọn ảnh khác.`);
    }
    return hopLe;
}

/** Đang mở form và có thay đổi: tải lại hoặc đóng tab thì trình duyệt hỏi lại. */
export function useChanRoiTrang(dangMo, coThayDoi) {
    useEffect(() => {
        if (!dangMo || !coThayDoi) return undefined;
        const chanRoiTrang = (e) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", chanRoiTrang);
        return () => window.removeEventListener("beforeunload", chanRoiTrang);
    }, [dangMo, coThayDoi]);
}

/** Đang mở form mà thả tệp lệch khỏi khung ảnh (kể cả lớp nền tối): chặn trình duyệt mở tệp, tránh mất dữ liệu. */
export function useChanThaTepNgoaiKhung(dangMo) {
    useEffect(() => {
        if (!dangMo) return undefined;
        const chanTha = (e) => {
            if (e.defaultPrevented) return; // khung ảnh đã tự xử lý
            e.preventDefault();
            if (e.type === "dragover" && e.dataTransfer) e.dataTransfer.dropEffect = "none";
        };
        window.addEventListener("dragover", chanTha);
        window.addEventListener("drop", chanTha);
        return () => {
            window.removeEventListener("dragover", chanTha);
            window.removeEventListener("drop", chanTha);
        };
    }, [dangMo]);
}

/**
 * Esc, bấm ra ngoài, nút X và nút Hủy đều đi qua handleCancel: đang có thay đổi thì hỏi trước khi bỏ.
 * Trả focus đúng chỗ: nút đã mở form (form mở bằng state, không qua DialogTrigger) khi form đóng,
 * và ô đang nhập khi chọn "Tiếp tục nhập".
 */
export function useHoiTruocKhiBo({ coThayDoi, dangLuu, onClose }) {
    const [hoiBoThayDoi, setHoiBoThayDoi] = useState(false);
    const nutMoFormRef = useRef(null);
    const oTruocKhiHoiRef = useRef(null);
    const dangBoRef = useRef(false);

    const dongForm = () => {
        dangBoRef.current = true;
        setHoiBoThayDoi(false);
        onClose();
    };

    const handleCancel = () => {
        if (dangLuu) return;
        if (coThayDoi) {
            oTruocKhiHoiRef.current = document.activeElement;
            dangBoRef.current = false;
            setHoiBoThayDoi(true);
            return;
        }
        dongForm();
    };

    return {
        hoiBoThayDoi,
        setHoiBoThayDoi,
        dongForm,
        handleCancel,
        nhoNutMoForm: () => {
            nutMoFormRef.current = document.activeElement;
        },
        traFocusNutMoForm: (e) => {
            e.preventDefault();
            if (nutMoFormRef.current?.isConnected) nutMoFormRef.current.focus();
        },
        traFocusSauKhiHoi: (e) => {
            e.preventDefault();
            if (dangBoRef.current) return; // đang đóng form: để form tự trả focus về nút đã mở
            if (oTruocKhiHoiRef.current?.isConnected) oTruocKhiHoiRef.current.focus();
        },
    };
}

/**
 * Lỗi phát hiện trong lúc lưu: khi đó các ô đang bị khóa (disabled) nên chưa đặt con trỏ vào được.
 * Hẹn lại để cuộn và đặt con trỏ ngay sau khi form mở khóa.
 * @returns {(loi: {id: string, oFocus?: string}) => void}
 */
export function useCuonToiLoiSauKhiLuu(dangLuu) {
    const henRef = useRef(null);
    useEffect(() => {
        if (dangLuu || !henRef.current) return;
        const { id, oFocus } = henRef.current;
        henRef.current = null;
        cuonToiLoi(id, oFocus);
    }, [dangLuu]);
    return useCallback((loi) => {
        henRef.current = loi;
    }, []);
}

/**
 * Ctrl/⌘ + S để lưu. Luôn chặn hộp "Lưu trang" của trình duyệt; chỉ lưu khi phím bấm từ chính form
 * (không lưu khi đang ở hộp thoại con, VD: tạo thương hiệu mới).
 */
export function taoXuLyPhimTat({ duocLuu, onLuu }) {
    return (e) => {
        if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s")) return;
        e.preventDefault();
        if (!e.currentTarget.contains(e.target) || !duocLuu) return;
        onLuu(e);
    };
}
