import { useCallback, useEffect, useRef, useState } from "react";
import { docSo } from "@/components/chung-tu/bangChungTu";
import { luuSoDem } from "@/services/stockTakeService";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";
import { getCurrentUserId } from "@/utils/roles";
import { t } from "@/i18n";

// Gõ số xong chờ ngần này rồi mới tự lưu (gõ liền "1", "12", "120" chỉ gửi một lần); Enter / rời ô thì lưu ngay
const CHO_LUU_SO_MS = 700;
const CHO_LUU_LY_DO_MS = 1200;
// Dấu "Đã lưu" ở dòng vừa lưu hiện trong ngần này
const VUA_LUU_MS = 4000;
// luuHet: số vòng gửi lại tối đa (người dùng gõ chen vào lúc đang gửi)
const SO_VONG_LUU_HET = 3;

// Khôi phục số đang gõ dở (hết phiên, tải lại trang): gửi lại sau ngần này
const CHO_GUI_KHOI_PHUC_MS = 300;

/**
 * Khóa lưu tạm số đang gõ dở của một người ở một đợt. Lưu ở sessionStorage (riêng từng thẻ, còn khi tải lại trang hay
 * phải đăng nhập lại trong cùng thẻ): hai thẻ cùng đợt không đè nháp của nhau, đóng thẻ thì nháp tự mất.
 */
const khoaNhapTam = (dotId, nguoiDungId) => `fcentric:kiem-ke:nhap:${nguoiDungId}:${dotId}`;

function docNhapTam(dotId) {
  const nguoiDungId = getCurrentUserId();
  if (nguoiDungId == null) return {};
  try {
    const s = sessionStorage.getItem(khoaNhapTam(dotId, nguoiDungId));
    const v = s ? JSON.parse(s) : null;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function ghiNhapTam(dotId, nhap) {
  // Phiên vừa hết (đã xóa người dùng): không ghi vào khóa không rõ chủ; nháp đã ghi trước đó vẫn còn
  const nguoiDungId = getCurrentUserId();
  if (nguoiDungId == null) return;
  try {
    if (Object.keys(nhap).length) sessionStorage.setItem(khoaNhapTam(dotId, nguoiDungId), JSON.stringify(nhap));
    else sessionStorage.removeItem(khoaNhapTam(dotId, nguoiDungId));
  } catch {
    // Bộ nhớ trình duyệt bị chặn / đầy: chỉ mất phần khôi phục, lưu lên máy chủ vẫn chạy
  }
}

const soCua = (d) => (d.soLuongThucTe == null ? null : docSo(d.soLuongThucTe));
const lyDoCua = (d) => String(d.lyDoChenhLech ?? "").trim();

/**
 * Lưu số đếm từng dòng lên máy chủ (PUT /kiem-ke/{id}/dong/{dongId}): mỗi dòng gửi lần lượt, lần sau dùng phiên bản dòng
 * máy chủ vừa trả (không tự đè số của máy khác). Phần đã gõ mà chưa lưu nằm ở `nhap[id] = { so?, lyDo? }`; gõ về đúng số
 * và lý do đang lưu thì bỏ phần đó, không gửi.
 *
 * - `capNhatDong(dongMoi)`: thay dòng trong bảng bằng dòng máy chủ trả về.
 * - `onLoiDong(id, ma)`: máy chủ từ chối vì dòng / đợt vừa đổi ở nơi khác (STK_VERSION_CONFLICT, STK_INVALID_STATE) —
 *   phần đang gõ của dòng đã bị bỏ, màn tải lại để hiện số mới nhất.
 * - `trangThai[id]`: `{ dang, loi, vuaLuu }` — đang gửi, câu lỗi của lần gửi gần nhất, vừa lưu xong (tự tắt sau 4 giây).
 * - `luuHet()`: gửi hết và chờ xong thật (kể cả lần gửi đang dở); trả danh sách id còn chưa lưu được.
 * - Rời màn khi còn số chưa gửi: gửi nốt ngay (không chờ hẹn giờ).
 * - Số đang gõ dở còn được lưu tạm trong thẻ (theo người, theo đợt, kèm phiên bản dòng lúc gõ): hết phiên đăng
 *   nhập hay tải lại trang giữa lúc đếm thì mở lại màn sẽ khôi phục và gửi lại — chỉ khi dòng chưa bị máy khác lưu đè
 *   (phiên bản còn nguyên), không ghi đè số mới hơn. `khoiPhuc`: chỉ khôi phục khi đợt còn đếm được (Đang kiểm kê).
 * - `khoId`: kho của đợt, gửi kèm từng lần lưu (đổi kho làm việc ở thẻ khác không làm lưu số thất bại).
 */
export default function useLuuSoDem({ dotId, dong, capNhatDong, onLoiDong, khoId, khoiPhuc = true }) {
  const [nhap, setNhap] = useState({});
  const [trangThai, setTrangThai] = useState({});
  const nhapRef = useRef({});
  const dongRef = useRef(dong);
  const henRef = useRef({});
  // id → Promise của lần gửi đang chạy
  const dangGuiRef = useRef({});
  const guiLaiRef = useRef({});
  const loiRef = useRef({});
  const goRef = useRef(false);
  const capNhatRef = useRef(capNhatDong);
  const loiDongRef = useRef(onLoiDong);
  const khoIdRef = useRef(khoId);
  // phiên bản dòng lúc bắt đầu gõ (để khôi phục an toàn)
  const phienBanGoRef = useRef({});
  useEffect(() => {
    dongRef.current = dong;
    capNhatRef.current = capNhatDong;
    loiDongRef.current = onLoiDong;
    khoIdRef.current = khoId;
  });

  const datNhap = (moi) => {
    nhapRef.current = moi;
    const tam = {};
    Object.entries(moi).forEach(([id, cho]) => {
      if (!(id in phienBanGoRef.current)) phienBanGoRef.current[id] = dongRef.current.find((x) => String(x.id) === id)?.phienBan ?? null;
      tam[id] = { ...cho, phienBan: phienBanGoRef.current[id] };
    });
    Object.keys(phienBanGoRef.current).forEach((id) => {
      if (!(id in moi)) delete phienBanGoRef.current[id];
    });
    ghiNhapTam(dotId, tam);
    if (!goRef.current) setNhap(moi);
  };
  const boNhapCua = (id) => {
    if (!(id in nhapRef.current)) return;
    const { [id]: _bo, ...con } = nhapRef.current;
    datNhap(con);
  };
  const datTrangThai = (id, tt) => {
    if (tt.loi) loiRef.current[id] = tt.loi;
    else delete loiRef.current[id];
    if (!goRef.current) setTrangThai((cu) => ({ ...cu, [id]: tt }));
  };

  const gui = useCallback(async (id) => {
    clearTimeout(henRef.current[id]);
    delete henRef.current[id];
    if (dangGuiRef.current[id]) {
      guiLaiRef.current[id] = true;
      return dangGuiRef.current[id];
    }
    const cho = nhapRef.current[id];
    const d = dongRef.current.find((x) => x.id === id);
    if (!cho || !d) return undefined;
    const so = "so" in cho ? cho.so : soCua(d);
    const lyDo = String(("lyDo" in cho ? cho.lyDo : d.lyDoChenhLech) ?? "").trim();
    if (so === soCua(d) && lyDo === lyDoCua(d)) {
      // Gõ lại đúng số đang lưu: không cần gửi
      boNhapCua(id);
      datTrangThai(id, { dang: false, loi: null });
      return undefined;
    }
    datTrangThai(id, { dang: true, loi: null });
    const lan = (async () => {
      try {
        const moi = await luuSoDem(dotId, id, {
          soLuongThucTe: so,
          lyDoChenhLech: lyDo || null,
          bienPhapXuLy: d.bienPhapXuLy ?? null,
          phienBan: d.phienBan,
        }, khoIdRef.current);
        dongRef.current = dongRef.current.map((x) => (x.id === id ? moi : x));
        // Bỏ phần đã gửi nếu từ lúc gửi chưa gõ thêm; gõ thêm rồi thì nháp còn lại theo phiên bản mới của dòng
        if (nhapRef.current[id] === cho) boNhapCua(id);
        else if (id in nhapRef.current) {
          phienBanGoRef.current[id] = moi?.phienBan ?? null;
          datNhap({ ...nhapRef.current });
        }
        capNhatRef.current?.(moi);
        datTrangThai(id, { dang: false, loi: null, vuaLuu: true });
        setTimeout(() => {
          if (!goRef.current) setTrangThai((cu) => (cu[id]?.vuaLuu ? { ...cu, [id]: { ...cu[id], vuaLuu: false } } : cu));
        }, VUA_LUU_MS);
      } catch (error) {
        const ma = getApiErrorCode(error);
        if (ma === "STK_VERSION_CONFLICT" || ma === "STK_INVALID_STATE") {
          // Số trên máy chủ mới hơn (máy khác vừa lưu / đợt đã đổi trạng thái): bỏ phần đang gõ, màn tải lại
          clearTimeout(henRef.current[id]);
          delete henRef.current[id];
          guiLaiRef.current[id] = false;
          boNhapCua(id);
          datTrangThai(id, { dang: false, loi: null });
          loiDongRef.current?.(id, ma, getApiErrorMessage(error, t("Dòng vừa đổi ở nơi khác")));
        } else {
          datTrangThai(id, { dang: false, loi: getApiErrorMessage(error, t("Chưa lưu được số đếm")) });
        }
      } finally {
        delete dangGuiRef.current[id];
      }
      if (guiLaiRef.current[id]) {
        guiLaiRef.current[id] = false;
        if (nhapRef.current[id]) await gui(id);
      }
    })();
    dangGuiRef.current[id] = lan;
    return lan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dotId]);

  const hen = (id, ms) => {
    clearTimeout(henRef.current[id]);
    henRef.current[id] = setTimeout(() => gui(id), ms);
  };

  /** Đổi số đếm (null = xóa, chưa đếm). `ngay`: gửi luôn (Enter, quét mã). */
  const doiSo = (id, so, { ngay = false } = {}) => {
    datNhap({ ...nhapRef.current, [id]: { ...nhapRef.current[id], so } });
    if (ngay) gui(id);
    else hen(id, CHO_LUU_SO_MS);
  };

  const doiLyDo = (id, chu) => {
    datNhap({ ...nhapRef.current, [id]: { ...nhapRef.current[id], lyDo: chu } });
    hen(id, CHO_LUU_LY_DO_MS);
  };

  /** Lưu ngay phần đang chờ của dòng (rời ô). */
  const luuNgay = (id) => {
    if (nhapRef.current[id] && henRef.current[id] !== undefined) gui(id);
  };

  /** Gửi hết phần đang chờ và chờ xong (trước khi trình duyệt). Trả id các dòng còn chưa lưu được (lỗi / còn đang gõ). */
  const luuHet = async () => {
    for (let vong = 0; vong < SO_VONG_LUU_HET; vong += 1) {
      const ids = new Set([...Object.keys(nhapRef.current), ...Object.keys(dangGuiRef.current)].map(Number));
      if (!ids.size) break;
      await Promise.all([...ids].map((id) => dangGuiRef.current[id] ?? gui(id)));
      if (Object.keys(nhapRef.current).every((id) => loiRef.current[id])) break;
    }
    return [...new Set([...Object.keys(nhapRef.current), ...Object.keys(dangGuiRef.current)].map(Number))];
  };

  // Khôi phục số gõ dở của lần trước (một lần, khi bảng đã có dòng): dòng còn đúng phiên bản lúc gõ thì đưa lại vào ô và
  // gửi; dòng đã đổi ở nơi khác (hay không còn) thì bỏ — không đè số mới hơn
  const daKhoiPhucRef = useRef(false);
  useEffect(() => {
    if (!khoiPhuc || daKhoiPhucRef.current || !Array.isArray(dong) || dong.length === 0) return;
    daKhoiPhucRef.current = true;
    const tam = docNhapTam(dotId);
    const lai = {};
    Object.entries(tam).forEach(([id, cho]) => {
      const d = dong.find((x) => String(x.id) === id);
      if (!d || cho == null || cho.phienBan !== d.phienBan) return;
      const { phienBan: _pb, ...phan } = cho;
      const so = "so" in phan ? phan.so : soCua(d);
      const lyDo = String(("lyDo" in phan ? phan.lyDo : d.lyDoChenhLech) ?? "").trim();
      if (so === soCua(d) && lyDo === lyDoCua(d)) return;
      lai[id] = phan;
      phienBanGoRef.current[id] = d.phienBan;
    });
    datNhap({ ...lai, ...nhapRef.current });
    Object.keys(lai).forEach((id) => hen(Number(id), CHO_GUI_KHOI_PHUC_MS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dong, dotId, khoiPhuc]);

  useEffect(() => {
    goRef.current = false;
    const hens = henRef.current;
    return () => {
      goRef.current = true;
      // Rời màn: gửi nốt các dòng đang hẹn giờ
      Object.keys(hens).forEach((id) => gui(Number(id)));
    };
  }, [gui]);

  const dangGui = Object.values(trangThai).some((tt) => tt?.dang);
  const conCho = Object.keys(nhap).length > 0;
  return { nhap, trangThai, doiSo, doiLyDo, luuNgay, luuHet, dangGui, conCho };
}
