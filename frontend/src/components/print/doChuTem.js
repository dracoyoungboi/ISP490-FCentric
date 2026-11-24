import { useEffect, useState } from "react";

/**
 * Đo bề rộng chữ trên tem (mm) bằng canvas, cùng phông với TemSanPham (Inter, cỡ quang học 14).
 * Đo ở 14px để Inter tự chọn opsz 14 như chữ trên tem, rồi quy ra mm theo cỡ chữ. Nhân 1,03 chừa chỗ cho làm tròn
 * khi in: chữ đo vừa khít thì trên giấy vẫn không chạm dấu "…".
 */
export const PHONG_TEM = "Inter, Arial, sans-serif";
const CO_DO_PX = 14;
const DU_PHONG = 1.03;
// Inter tải theo bộ ký tự (Latin, tiếng Việt…): kiểm và tải cả bộ có dấu
const MAU_CHU = "Aa Ấấ Ổổ Đđ";

let ctx;
const boNho = new Map();

function phongDaTai() {
    if (typeof document === "undefined" || !document.fonts?.check) return true;
    return document.fonts.check(`700 ${CO_DO_PX}px Inter`, MAU_CHU) && document.fonts.check(`400 ${CO_DO_PX}px Inter`, MAU_CHU);
}

export function doRongChuTemMm(chu, coMm, dam) {
    const khoa = `${dam ? 7 : 4}|${phongDaTai() ? 1 : 0}|${chu}`;
    let rong = boNho.get(khoa);
    if (rong == null) {
        ctx ??= typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
        if (ctx) {
            ctx.font = `${dam ? 700 : 400} ${CO_DO_PX}px ${PHONG_TEM}`;
            rong = ctx.measureText(chu).width / CO_DO_PX;
        } else {
            // Không có canvas: ước theo số ký tự (chữ Inter trung bình ~0,62 cỡ chữ)
            rong = chu.length * (dam ? 0.66 : 0.58);
        }
        if (boNho.size > 5000) boNho.clear();
        boNho.set(khoa, rong);
    }
    return rong * coMm * DU_PHONG;
}

/** Vẽ lại khi phông Inter tải xong, để số đo chữ không dựa trên phông thay thế. */
export function usePhongTemDaTai() {
    const [daTai, setDaTai] = useState(phongDaTai);
    useEffect(() => {
        if (daTai || typeof document === "undefined" || !document.fonts?.load) return undefined;
        let conMo = true;
        Promise.all([document.fonts.load(`700 ${CO_DO_PX}px Inter`, MAU_CHU), document.fonts.load(`400 ${CO_DO_PX}px Inter`, MAU_CHU)])
            .catch(() => {})
            .finally(() => {
                if (conMo) setDaTai(true);
            });
        return () => {
            conMo = false;
        };
    }, [daTai]);
    return daTai;
}
