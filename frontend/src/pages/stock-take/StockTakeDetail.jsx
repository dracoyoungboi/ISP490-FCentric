import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, Ban, Grid2x2, PackagePlus, PencilLine, Play, RotateCcw, Send } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { Button } from "@/components/ui/button";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP } from "@/components/chung-tu/kieuHopThoai";
import { lamViecTaiKho, moDuocTaiKho } from "@/components/chuyen-kho/lamViecTaiKho";
import BanDoTienDoKe from "@/components/kiem-ke/BanDoTienDoKe";
import BangDemKiemKe from "@/components/kiem-ke/BangDemKiemKe";
import CotKiemKe from "@/components/kiem-ke/CotKiemKe";
import { HopAnhKiemKe, HopLyDo, HopPhatSinh } from "@/components/kiem-ke/HopKiemKe";
import HopRaLaiKiemKe from "@/components/kiem-ke/HopRaLaiKiemKe";
import ThanhQuetKiemKe from "@/components/kiem-ke/ThanhQuetKiemKe";
import TomTatKiemKe from "@/components/kiem-ke/TomTatKiemKe";
import XemTruocPhamVi from "@/components/kiem-ke/XemTruocPhamVi";
import useLuuSoDem from "@/components/kiem-ke/useLuuSoDem";
import {
  TT_DONG,
  TT_DOT,
  buocKiemKe,
  gopNhap,
  keCuaDong,
  keTiepChuaXong,
  laLech,
  locDongKiemKe,
  luaChonLoc,
  moTaKhoa,
  nhanPhamVi,
  nhanTrangThaiDot,
  phanTichQuet,
  sapXepDong,
  thongKeDong,
  thuHepTheoUngVien,
  tienCoDau,
  tienDoTheoKe,
  timDichQuet,
  vanDeTuLoi,
} from "@/components/kiem-ke/kiemKe";
import { CO_TRANG_DONG } from "@/config/bangChungTu";
import { useIsMobile } from "@/hooks/use-mobile";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import {
  batDau,
  demLai,
  huyDot,
  layDong,
  layDot,
  layNhatKy,
  layPhieuDieuChinh,
  laySoDo,
  pheDuyet,
  taoKhoaLenh,
  trinhDuyet,
  xemTruocPhamVi,
} from "@/services/stockTakeService";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatters";
import { getKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, getCurrentUserId, hasAnyRole } from "@/utils/roles";

const SO_DEM_TOI_DA = 1_000_000;
// Ứng viên của lần quét khớp nhiều dòng chỉ dùng để thu hẹp trong ngần này (ms)
const UNG_VIEN_SONG_MS = 60_000;
// loc null: lọc mặc định theo trạng thái đợt (chờ duyệt, người thẩm định → "Lệch"; còn lại → "Tất cả")
const BO_LOC_DAU = Object.freeze({ tuKhoa: "", loc: null, viTriId: null });

/**
 * Đếm mù nhớ theo tài khoản trên máy này (Đ9: tùy chọn của người đếm, máy chủ không lưu). Chưa chọn lần nào thì BẬT: người
 * đếm không nhìn số trên sổ khi đếm; đếm xong mới mở các dòng lệch ở hộp "Rà lại trước khi trình".
 */
const khoaMu = (nguoiDungId) => `fcentric:kiem-ke:dem-mu:${nguoiDungId ?? "?"}`;
function docMu(nguoiDungId) {
  try {
    return window.localStorage.getItem(khoaMu(nguoiDungId)) !== "0";
  } catch {
    return true;
  }
}
function ghiMu(nguoiDungId, bat) {
  try {
    window.localStorage.setItem(khoaMu(nguoiDungId), bat ? "1" : "0");
  } catch {
    // trình duyệt chặn lưu: chỉ nhớ trong phiên
  }
}

/** Thân yêu cầu xem trước của một đợt nháp (cùng phạm vi đã lưu). */
const phamViCuaDot = (dot) => ({
  tenDotKiemKe: dot.ten,
  khoId: dot.kho?.id,
  loaiKiemKe: dot.loaiKiemKe,
  khuVucIds: (dot.khuVuc ?? []).map((k) => k.id),
  viTriIds: (dot.viTri ?? []).map((v) => v.id),
  danhMucId: dot.danhMuc?.id ?? null,
});

/**
 * Chi tiết đợt kiểm kê khoanh vùng (/stock-take/:id) — đặc tả BA 03/11/2026, giao diện theo bộ khung chứng từ của hệ thống.
 *
 * - Nháp: xem trước phạm vi; quản lý kho của kho Bắt đầu (khóa phạm vi + chốt số trên sổ kệ), Sửa, Hủy.
 * - Đang kiểm kê: thanh quét dính đầu (mã kệ → đếm theo kệ; tem lô / SKU → +1; "12*LO100" → +12), bảng theo kệ, số đếm tự
 *   lưu từng dòng lên máy chủ (nhiều người đếm cùng lúc được), dòng lệch bắt buộc giải trình, ảnh bằng chứng, lô phát sinh;
 *   Trình duyệt khi đã đếm hết.
 * - Chờ duyệt: quản lý có quyền điều chỉnh tồn chọn dòng để yêu cầu đếm lại, hoặc Phê duyệt (tạo phiếu điều chỉnh, cập
 *   nhật tồn, mở khóa).
 * - Quyền từng nút do máy chủ tính (`dot.quyen`, theo kho đang làm việc): người được phân kho của đợt tự chuyển nơi làm
 *   việc sang kho đó khi mở đợt đang mở.
 * - Lệnh đổi trạng thái gửi phiên bản đợt đang xem + khóa lệnh (bấm lặp không làm hai lần).
 */
export default function StockTakeDetail() {
  const { id } = useParams();
  return <ManKiemKe key={id} dotId={Number(id)} />;
}

function ManKiemKe({ dotId }) {
  const navigate = useNavigate();
  const veDanhSach = useCallback(() => navigate("/stock-take"), [navigate]);
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const [nguoiDungId] = useState(getCurrentUserId);

  // ── Tải đợt + dòng + nhật ký (+ phiếu điều chỉnh khi đã duyệt) ───────────────────────────────────────
  // Lần tải đầu: đợt còn mở mà người xem được phân kho của đợt → chuyển nơi làm việc sang kho đó rồi đọc lại đợt
  // (quyền từng nút máy chủ tính theo kho đang làm việc)
  const daXetKhoRef = useRef(false);
  const tai = useCallback(async () => {
    let [dot, dong, nhatKy] = await Promise.all([layDot(dotId), layDong(dotId), layNhatKy(dotId).catch(() => null)]);
    let doiKho = null;
    if (dot && !daXetKhoRef.current) {
      daXetKhoRef.current = true;
      const mo = [TT_DOT.NHAP, TT_DOT.DANG_KIEM_KE, TT_DOT.CHO_DUYET].includes(Number(dot.trangThai));
      if (mo && !laQtv && dot.kho?.id && getKhoLamViecId() !== dot.kho.id && moDuocTaiKho(dot.kho)) {
        lamViecTaiKho(dot.kho);
        doiKho = dot.kho.ten || "kho của đợt";
        dot = await layDot(dotId);
      }
    }
    const phieu = Number(dot?.trangThai) === TT_DOT.DA_DUYET ? await layPhieuDieuChinh(dotId).catch(() => null) : null;
    return { dot, dong, nhatKy, phieu, doiKho };
  }, [dotId, laQtv]);
  const dotHopLe = Number.isInteger(dotId) && dotId > 0;
  const q = useTaiDuLieu(tai, `kiem-ke-${dotId}`, { enabled: dotHopLe });
  const dot = q.data?.dot ?? null;
  const dongMayChu = useMemo(() => q.data?.dong ?? [], [q.data]);
  const tt = Number(dot?.trangThai);
  const quyen = dot?.quyen ?? {};
  const suaDuoc = tt === TT_DOT.DANG_KIEM_KE && Boolean(quyen.dem);
  const chonDuoc = tt === TT_DOT.CHO_DUYET && Boolean(quyen.demLai);

  const capNhatDong = useCallback(
    (moi) => q.setData((cu) => (cu ? { ...cu, dong: cu.dong.map((x) => (x.id === moi.id ? moi : x)) } : cu)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.setData],
  );
  // Tải lại các dòng, trộn theo từng dòng: dòng vừa lưu xong trong lúc chờ (phiên bản lớn hơn) không bị bản cũ đè
  const taiLaiDong = useCallback(async () => {
    try {
      const moi = await layDong(dotId);
      q.setData((cu) => {
        if (!cu) return cu;
        const theoId = new Map(cu.dong.map((x) => [x.id, x]));
        return {
          ...cu,
          dong: moi.map((m) => {
            const c = theoId.get(m.id);
            return c && Number(c.phienBan) > Number(m.phienBan) ? c : m;
          }),
        };
      });
    } catch (error) {
      toast.error("Không tải lại được các dòng", { description: getApiErrorMessage(error, "lỗi kết nối") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dotId, q.setData]);

  const luu = useLuuSoDem({
    dotId,
    dong: dongMayChu,
    capNhatDong,
    onLoiDong: (_id, ma, cau) => {
      if (ma === "STK_INVALID_STATE") {
        // Đợt đã trình duyệt / dòng đã xác nhận ở nơi khác: tải lại cả đợt
        toast.error(cau, { description: "Đã tải lại đợt để bạn xem trạng thái mới nhất." });
        q.reload();
        return;
      }
      toast.error("Dòng vừa được lưu từ máy khác", { description: "Bảng đã hiện số mới nhất trên máy chủ. Nhập lại nếu cần." });
      taiLaiDong();
    },
  });

  // ── Đếm mù (chỉ khi đang đếm) ────────────────────────────────────────────────────────────────────────
  const [muLuu, setMuLuu] = useState(() => docMu(nguoiDungId));
  const mu = suaDuoc && muLuu;
  const doiMu = (bat) => {
    setMuLuu(bat);
    ghiMu(nguoiDungId, bat);
  };

  // ── Dòng, lọc, trang ────────────────────────────────────────────────────────────────────────────────
  // Phần đang gõ chỉ gộp khi còn sửa được (đợt đã trình duyệt thì bảng hiện đúng số máy chủ)
  const rows = useMemo(
    () => sapXepDong(suaDuoc ? gopNhap(dongMayChu, luu.nhap) : dongMayChu),
    [dongMayChu, luu.nhap, suaDuoc],
  );
  const tk = useMemo(() => thongKeDong(rows), [rows]);
  // Kệ của đợt (kể cả kệ trống, chưa có dòng) + kệ của các dòng (kệ có lô phát sinh)
  const keDot = useMemo(() => (dot?.viTri ?? []).map((v) => ({ id: v.id, ma: v.ma })), [dot?.viTri]);
  const dsKe = useMemo(() => {
    const m = new Map(keDot.map((k) => [k.id, k]));
    keCuaDong(rows).forEach((k) => m.set(k.id, k));
    return [...m.values()].sort((a, b) => String(a.ma).localeCompare(String(b.ma), "vi", { numeric: true }));
  }, [rows, keDot]);
  const [boLoc, setBoLoc] = useState(BO_LOC_DAU);
  const [giuLai, setGiuLai] = useState(() => new Set());
  const [trang, setTrang] = useState(0);
  const [coTrang, setCoTrang] = useState(CO_TRANG_DONG[0]);
  const datBoLoc = (phan) => {
    setBoLoc((cu) => ({ ...cu, ...phan }));
    setTrang(0);
    if ("loc" in phan || "viTriId" in phan) setGiuLai(new Set());
  };
  // Người thẩm định mở đợt chờ duyệt: việc là xem dòng lệch, nên lọc sẵn "Lệch" (vẫn bấm Tất cả được)
  const locMacDinh =
    ((tt === TT_DOT.CHO_DUYET && (quyen.pheDuyet || quyen.demLai)) || tt === TT_DOT.DA_DUYET) && rows.some(laLech) ? "lech" : "tatCa";
  const locChon = boLoc.loc ?? locMacDinh;
  const luaChon = useMemo(
    () =>
      luaChonLoc(rows, {
        muc: mu ? ["tatCa", "chua", "demLai", "phatSinh"] : ["tatCa", "chua", "lech", "thieuLyDo", "demLai", "phatSinh"],
        giu: locChon,
      }),
    [rows, mu, locChon],
  );
  const locHienTai = luaChon.some((x) => x.value === locChon) ? locChon : "tatCa";
  const dsHien = useMemo(
    () => locDongKiemKe(rows, { ...boLoc, loc: locHienTai, giuLai }),
    [rows, boLoc, locHienTai, giuLai],
  );
  const giu = (id) => setGiuLai((cu) => (cu.has(id) ? cu : new Set(cu).add(id)));

  // Lần quét trước khớp nhiều dòng: nhớ các dòng đó (và số lượng đã gõ) để lần quét sau thu hẹp còn một dòng. Người dùng tự
  // nhập số, tự đổi lọc hoặc quá UNG_VIEN_SONG_MS thì bỏ: quét mã kệ lúc đó chỉ là chuyển kệ, không tự cộng vào dòng cũ
  const ungVienRef = useRef(null);
  const datBoLocTay = (phan) => {
    ungVienRef.current = null;
    datBoLoc(phan);
  };

  // Ghi kiểm theo kho làm việc (header kho_id): tab khác lỡ đổi nơi làm việc thì chuyển về kho của đợt trước khi lưu
  const doiSo = (id, so, tuyChon) => {
    ungVienRef.current = null;
    lamViecTaiKho(dot?.kho);
    giu(id);
    luu.doiSo(id, so, tuyChon);
  };
  const doiLyDo = (id, chu) => {
    ungVienRef.current = null;
    lamViecTaiKho(dot?.kho);
    giu(id);
    luu.doiLyDo(id, chu);
  };

  // ── Quét ────────────────────────────────────────────────────────────────────────────────────────────
  const oQuetRef = useRef(null);
  const [quet, setQuet] = useState("");
  const [phanHoi, setPhanHoi] = useState(null);
  const [dongSang, setDongSang] = useState(null);
  const [lanQuet, setLanQuet] = useState(0);
  // Đếm mọi lần quét (kể cả không trúng dòng): khung phản hồi hiện lại mỗi lần
  const [lanPhanHoi, setLanPhanHoi] = useState(0);
  useEffect(() => {
    if (dongSang == null) return;
    document.querySelector(`[data-dong-kiem-ke="${dongSang}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [dongSang, lanQuet]);

  const keLoc = boLoc.viTriId == null ? null : dsKe.find((k) => k.id === boLoc.viTriId) ?? null;
  // Tiến độ từng kệ trên mọi dòng (bản đồ kệ, đầu nhóm kệ trong bảng); kệ đang lọc đếm xong → gợi ý kệ kế còn dòng chưa đếm
  const tienDo = useMemo(() => tienDoTheoKe(rows), [rows]);
  const keTiep = boLoc.viTriId == null ? null : keTiepChuaXong(dsKe, boLoc.viTriId, tienDo);
  const isMobile = useIsMobile();

  const [hop, setHop] = useState(null);
  const [phatSinhTu, setPhatSinhTu] = useState("");
  const moPhatSinh = (tu = "") => {
    setPhatSinhTu(tu);
    setHop("phatSinh");
  };

  const xuLyQuet = (chu) => {
    const p = phanTichQuet(chu);
    setQuet("");
    if (!p) return;
    setLanPhanHoi((n) => n + 1);
    if (p.soLuong == null) {
      setPhanHoi({ kieu: "loi", chu: "Số trước dấu * phải lớn hơn 0, ví dụ 12*mã." });
      return;
    }
    const truoc = ungVienRef.current && Date.now() - ungVienRef.current.luc < UNG_VIEN_SONG_MS ? ungVienRef.current : null;
    ungVienRef.current = null;
    // Lần trước mã khớp nhiều dòng: lần quét này (mã kệ, tem lô, SKU) thu hẹp về đúng dòng, giữ số lượng đã gõ lần trước
    const thuHep = thuHepTheoUngVien(timDichQuet(rows, p.ma, boLoc.viTriId, keDot), {
      truoc,
      dong: rows,
      soLuong: p.soLuong,
      coSo: p.coSo,
    });
    const dich = thuHep.dich;
    const soLuong = thuHep.soLuong;
    if (thuHep.ungVien) {
      // Mã kệ: kệ này còn nhiều dòng khớp mã lần trước — lọc kệ, chờ quét tem để chọn đúng dòng
      ungVienRef.current = { ...thuHep.ungVien, luc: Date.now() };
      datBoLoc({ viTriId: dich.viTriId, loc: "tatCa" });
      setPhanHoi({
        kieu: "canhBao",
        chu: `Kệ ${dich.maKe} có ${soVN(dich.conUngVien)} dòng khớp mã quét lần trước. Tiếp theo ${dich.theo === "lo" ? "quét mã vạch sản phẩm" : "quét mã lô"} trên tem để chọn đúng dòng${soLuong > 1 ? ` (sẽ cộng ${soVN(soLuong)})` : ""}, hoặc nhập số ở dòng đó.`,
      });
      return;
    }
    if (dich.kieu === "ke") {
      const dsCuaKe = rows.filter((d) => d.viTri?.id === dich.viTriId);
      const chua = dsCuaKe.filter((d) => d.soLuongThucTe == null).length;
      datBoLoc({ viTriId: dich.viTriId, tuKhoa: "", loc: "tatCa" });
      setPhanHoi(
        dsCuaKe.length
          ? {
            kieu: "thongTin",
            chu: `Đang đếm kệ ${dich.maKe}: ${soVN(dsCuaKe.length)} dòng${chua ? `, ${soVN(chua)} chưa đếm` : ", đã đếm hết"}. Quét tem từng sản phẩm để cộng.`,
          }
          : {
            kieu: "thongTin",
            chu: `Kệ ${dich.maKe} trống trên sổ. Thấy hàng trên kệ thì thêm lô phát sinh.`,
            nhanNut: quyen.dem ? "Thêm lô phát sinh" : undefined,
            onNut: quyen.dem ? () => moPhatSinh("") : undefined,
          },
      );
      return;
    }
    if (dich.kieu === "daXacNhan") {
      setPhanHoi({ kieu: "loi", chu: `Các dòng khớp “${p.ma}” đã được quản lý xác nhận, không cộng thêm được.` });
      return;
    }
    if (dich.kieu === "dong") {
      const d = dich.dong;
      if (d.trangThai === TT_DONG.DA_XAC_NHAN) {
        setPhanHoi({ kieu: "loi", chu: `Lô ${d.loHang?.ma} ở kệ ${d.viTri?.ma} đã được quản lý xác nhận, không cộng thêm được.` });
        return;
      }
      const cu = d.soLuongThucTe == null ? 0 : docSo(d.soLuongThucTe);
      const moi = Math.min(cu + soLuong, SO_DEM_TOI_DA);
      doiSo(d.id, moi, { ngay: true });
      // Từ khóa do lần quét "nhiều dòng" đặt: bỏ để các dòng quét sau không bị ẩn. Chọn đúng dòng bằng mã kệ: lọc theo kệ đó
      const boLocMoi = {
        ...boLoc,
        ...(truoc && boLoc.tuKhoa ? { tuKhoa: "" } : null),
        ...(dich.quaKe ? { viTriId: dich.quaKe.viTriId } : null),
      };
      // Chỉ gửi khóa thật sự đổi: đổi kệ thì bỏ các dòng đang giữ hiện (datBoLoc), chỉ bỏ từ khóa thì giữ
      const doiKe = boLocMoi.viTriId !== boLoc.viTriId;
      const phanDoi = {
        ...(boLocMoi.tuKhoa !== boLoc.tuKhoa ? { tuKhoa: boLocMoi.tuKhoa } : null),
        ...(doiKe ? { viTriId: boLocMoi.viTriId } : null),
      };
      if (Object.keys(phanDoi).length) {
        datBoLoc(phanDoi);
        giu(d.id);
      }
      // Đưa dòng vừa quét vào trang đang xem (tính theo bộ lọc và các dòng giữ hiện sau khi đổi)
      const giuSau = doiKe ? new Set([d.id]) : new Set(giuLai).add(d.id);
      const ds = locDongKiemKe(rows, { ...boLocMoi, loc: locHienTai, giuLai: giuSau });
      const viTri = ds.findIndex((x) => x.id === d.id);
      if (viTri >= 0 && ds.length > coTrang) setTrang(Math.floor(viTri / coTrang));
      setDongSang(d.id);
      setLanQuet((n) => n + 1);
      setPhanHoi({ kieu: "ok", chu: `+${soVN(soLuong)} lô ${d.loHang?.ma} · kệ ${d.viTri?.ma} → ${soVN(moi)} sản phẩm` });
      return;
    }
    if (dich.kieu === "nhieu") {
      const soKe = new Set(dich.ds.map((d) => d.viTri?.id)).size;
      ungVienRef.current = { ids: new Set(dich.ds.map((d) => d.id)), soLuong, theo: dich.theo, luc: Date.now() };
      datBoLoc({ tuKhoa: p.ma });
      const tiep = soKe > 1 ? "quét mã kệ" : dich.theo === "lo" ? "quét mã vạch sản phẩm trên tem" : "quét mã lô trên tem";
      setPhanHoi({
        kieu: "canhBao",
        chu: `Mã ${p.ma} khớp ${soVN(dich.ds.length)} dòng${soKe > 1 ? ` ở ${soVN(soKe)} kệ` : " cùng kệ"}. Tiếp theo ${tiep} để chọn đúng dòng${soLuong > 1 ? ` (sẽ cộng ${soVN(soLuong)})` : ""}, hoặc nhập số ở dòng đó.`,
      });
      return;
    }
    setPhanHoi({
      kieu: "canhBao",
      chu: `Không thấy “${p.ma}” trong đợt${keLoc ? ` ở kệ ${keLoc.ma}` : ""}. Hàng nằm ở kệ nhưng sổ không ghi?`,
      nhanNut: quyen.dem ? "Thêm lô phát sinh" : undefined,
      onNut: quyen.dem ? () => moPhatSinh(p.ma) : undefined,
    });
  };

  // ── Chọn dòng đếm lại ──────────────────────────────────────────────────────────────────────────────
  const [chon, setChon] = useState(() => new Set());
  const doiChon = (ids, bat) =>
    setChon((cu) => {
      const moi = new Set(cu);
      ids.forEach((id) => (bat ? moi.add(id) : moi.delete(id)));
      return moi;
    });
  const chonLech = () => setChon(new Set(rows.filter((d) => laLech(d)).map((d) => d.id)));

  // ── Hộp thoại và lệnh ──────────────────────────────────────────────────────────────────────────────
  const [dangChay, setDangChay] = useState(false);
  const [loiHop, setLoiHop] = useState(null);
  const [vanDeHop, setVanDeHop] = useState([]);
  const khoaLenhRef = useRef(null);
  const [anhDongId, setAnhDongId] = useState(null);
  const moHop = (ma) => {
    khoaLenhRef.current = taoKhoaLenh();
    setLoiHop(null);
    setVanDeHop([]);
    setHop(ma);
  };
  const dongHop = (mo) => {
    if (mo || dangChay) return;
    setHop(null);
    setLoiHop(null);
    setVanDeHop([]);
  };

  // Xem trước phạm vi: đợt nháp (khung giữa) và hộp Bắt đầu
  const coXemTruoc = tt === TT_DOT.NHAP && Boolean(dot);
  const taiXemTruoc = useCallback(() => xemTruocPhamVi(phamViCuaDot(dot), dot.id), [dot]);
  const qXem = useTaiDuLieu(taiXemTruoc, `kiem-ke-xem-${dotId}-${dot?.phienBan}`, { enabled: coXemTruoc });

  // Kệ chọn được ở hộp lô phát sinh: đợt khóa toàn kệ → kệ của đợt; theo danh mục → mọi kệ đang dùng của kho
  const theoDanhMuc = dot?.loaiKiemKe === "theo_danh_muc";
  const khoIdDot = dot?.kho?.id ?? null;
  const taiKeKho = useCallback(() => laySoDo(khoIdDot), [khoIdDot]);
  const qSoDo = useTaiDuLieu(taiKeKho, `kiem-ke-ke-${khoIdDot}`, { enabled: hop === "phatSinh" && theoDanhMuc && khoIdDot != null });
  const keChonPhatSinh = useMemo(() => {
    if (!dot) return [];
    if (!theoDanhMuc) return (dot.viTri ?? []).map((v) => ({ id: v.id, ma: v.ma }));
    return (qSoDo.data?.khuVuc ?? [])
      .flatMap((kv) => kv.ke ?? [])
      .filter((k) => k.trangThai !== "BAO_TRI")
      .map((k) => ({ id: k.id, ma: k.ma }))
      .sort((a, b) => String(a.ma).localeCompare(String(b.ma), "vi", { numeric: true }));
  }, [dot, theoDanhMuc, qSoDo.data]);

  const xongLenh = (tieuDe, moTa) => {
    setHop(null);
    setChon(new Set());
    setGiuLai(new Set());
    setBoLoc(BO_LOC_DAU);
    setTrang(0);
    toast.success(tieuDe, moTa ? { description: moTa } : undefined);
    q.reload();
  };
  const loiLenh = (error, cauMacDinh) => {
    if (error?.cauRieng) {
      setLoiHop(error.cauRieng);
      return;
    }
    const ma = getApiErrorCode(error);
    setVanDeHop(vanDeTuLoi(error));
    if (ma === "STK_VERSION_CONFLICT" || ma === "STK_INVALID_STATE") {
      // Đợt vừa đổi ở nơi khác: đóng hộp, tải lại
      setHop(null);
      toast.error(getApiErrorMessage(error, cauMacDinh), { description: "Đã tải lại đợt để bạn xem trạng thái mới nhất." });
      q.reload();
      return;
    }
    setLoiHop(getApiErrorMessage(error, cauMacDinh));
  };
  const chay = async (lenh, { tieuDe, moTa, loi }) => {
    setLoiHop(null);
    setVanDeHop([]);
    setDangChay(true);
    try {
      lamViecTaiKho(dot.kho);
      await lenh(khoaLenhRef.current);
      xongLenh(tieuDe, moTa);
    } catch (error) {
      loiLenh(error, loi);
    } finally {
      setDangChay(false);
    }
  };

  const lenhBatDau = () =>
    chay((khoa) => batDau(dot.id, dot.phienBan, khoa), {
      tieuDe: `Đã bắt đầu kiểm kê ${dot.ma}`,
      moTa: "Phạm vi đã khóa, số trên sổ kệ đã chốt. Bắt đầu đếm.",
      loi: "Chưa bắt đầu được đợt kiểm kê",
    });
  const lenhTrinh = () =>
    chay(
      async (khoa) => {
        // Chờ mọi số đang gõ / đang gửi lưu xong thật; còn dòng chưa lưu được thì không trình duyệt (máy chủ sẽ chốt số cũ)
        const chuaLuu = await luu.luuHet();
        if (chuaLuu.length) {
          throw { cauRieng: `${soVN(chuaLuu.length)} dòng chưa lưu được lên máy chủ. Kiểm tra kết nối rồi bấm Trình duyệt lần nữa; dòng lỗi ghi “Chưa lưu được”.` };
        }
        await trinhDuyet(dot.id, dot.phienBan, khoa);
      },
      { tieuDe: `Đã trình duyệt ${dot.ma}`, moTa: "Quản lý kho sẽ thẩm định chênh lệch. Kệ vẫn giữ khóa.", loi: "Chưa trình duyệt được" },
    );
  const lenhDuyet = () =>
    chay((khoa) => pheDuyet(dot.id, dot.phienBan, khoa), {
      tieuDe: `Đã duyệt ${dot.ma}`,
      moTa: "Tồn kho và sổ kệ đã cập nhật theo số đếm, kệ đã mở khóa.",
      loi: "Chưa phê duyệt được",
    });
  // Hộp có ô lý do (Đếm lại, Hủy): đợt vừa đổi ở nơi khác thì đóng hộp và tải lại như các lệnh khác; lỗi còn lại hiện trong hộp
  const lenhCoLyDo = async (lenh, { tieuDe, moTa }) => {
    lamViecTaiKho(dot.kho);
    try {
      await lenh();
    } catch (error) {
      const ma = getApiErrorCode(error);
      if (ma === "STK_VERSION_CONFLICT" || ma === "STK_INVALID_STATE") {
        loiLenh(error, "Đợt vừa thay đổi");
        return;
      }
      throw error;
    }
    xongLenh(tieuDe, moTa);
  };
  const lenhDemLai = (lyDo) =>
    lenhCoLyDo(() => demLai(dot.id, { dongIds: [...chon], lyDo, phienBan: dot.phienBan }, khoaLenhRef.current), {
      tieuDe: `Đã yêu cầu đếm lại ${soVN(chon.size)} dòng`,
      moTa: "Đợt quay về Đang kiểm kê để nhân viên đếm lại các dòng này.",
    });
  const lenhHuy = (lyDo) =>
    lenhCoLyDo(() => huyDot(dot.id, { lyDo, phienBan: dot.phienBan }, khoaLenhRef.current), {
      tieuDe: `Đã hủy ${dot.ma}`,
      moTa: "Tồn kho không đổi, kệ đã mở khóa.",
    });

  const conChoLuu = suaDuoc && (luu.conCho || luu.dangGui);
  useTaiLaiKhiQuayLai(() => q.reload(), {
    bat: Boolean(dot) && !q.loading && !hop && !conChoLuu,
    lanCuoi: q.capNhatLuc,
  });
  // Còn số chưa lưu mà đóng thẻ / tải lại trang: hỏi trước (chuyển màn trong ứng dụng thì hook tự gửi nốt)
  useEffect(() => {
    if (!conChoLuu) return undefined;
    const chan = (suKien) => {
      suKien.preventDefault();
      suKien.returnValue = "";
    };
    window.addEventListener("beforeunload", chan);
    return () => window.removeEventListener("beforeunload", chan);
  }, [conChoLuu]);

  // Lần tải đầu đã chuyển nơi làm việc sang kho của đợt: báo một lần bằng thông báo nhanh (không chiếm một dòng đầu màn)
  const doiKho = q.data?.doiKho ?? null;
  const daBaoDoiKhoRef = useRef(false);
  useEffect(() => {
    if (!doiKho || daBaoDoiKhoRef.current) return;
    daBaoDoiKhoRef.current = true;
    toast.info(`Đã chuyển nơi làm việc sang ${doiKho}`, { description: "Để thao tác được trên đợt kiểm kê này." });
  }, [doiKho]);

  // ── Đang tải / lỗi ─────────────────────────────────────────────────────────────────────────────────
  if (!dot) {
    if (q.loading || (dotHopLe && !q.error && q.data === undefined)) {
      return (
        <PageContainer className="flex min-h-full flex-col">
          <KhungDangTai nhan="Đang tải đợt kiểm kê" />
        </PageContainer>
      );
    }
    return (
      <PageContainer className="flex min-h-full flex-col">
        <KhungLoiChungTu
          loi={q.error}
          tenChungTu="đợt kiểm kê"
          onVeDanhSach={veDanhSach}
          nhanVeDanhSach="Về danh sách kiểm kê"
          onThuLai={q.reload}
        />
      </PageContainer>
    );
  }

  // ── Đầu khối ─────────────────────────────────────────────────────────────────────────────────────────
  const khoa = moTaKhoa(dot);
  // Chỉ chặn khi còn dòng chưa đếm. Dòng lệch chưa giải trình: bấm Trình duyệt mở hộp "Rà lại trước khi trình" (nhãn nút
  // không đổi theo lệch / khớp, nên đếm mù không đoán được số trên sổ qua nút)
  const lyDoTrinh = tk.chua ? `Còn ${soVN(tk.chua)} dòng chưa đếm` : null;
  const dsLoiLuu = suaDuoc ? Object.values(luu.trangThai).filter((x) => x?.loi) : [];
  const soLoiLuu = dsLoiLuu.length;
  const nutChinh =
    tt === TT_DOT.NHAP && quyen.batDau
      ? { nhan: "Bắt đầu kiểm kê", icon: Play, onClick: () => moHop("batDau"), khoa: dangChay }
      : tt === TT_DOT.DANG_KIEM_KE && quyen.trinhDuyet
        ? {
          nhan: "Trình duyệt",
          icon: Send,
          khoa: Boolean(lyDoTrinh) || dangChay || tk.tong === 0,
          lyDo: tk.tong === 0 ? "Đợt chưa có dòng nào" : lyDoTrinh ?? undefined,
          hienLyDo: true,
          onClick: () => moHop(tk.thieuLyDo ? "raLai" : "trinh"),
        }
        : tt === TT_DOT.CHO_DUYET && quyen.pheDuyet
          ? { nhan: "Phê duyệt", icon: BadgeCheck, onClick: () => moHop("duyet"), khoa: dangChay || chon.size > 0, lyDo: chon.size ? "Đang chọn dòng để đếm lại" : undefined, hienLyDo: true }
          : null;
  // Điện thoại đang đếm theo kệ: kệ đang xem đếm xong thì nút sang kệ kế nằm trên thanh đáy, trong tầm ngón cái
  const tdKeLoc = keLoc ? tienDo.get(keLoc.id) ?? { tong: 0, daDem: 0 } : null;
  const nutKeTiep =
    isMobile && suaDuoc && keTiep && tdKeLoc && tdKeLoc.daDem === tdKeLoc.tong
      ? { nhan: `Kệ ${keTiep.ma}`, icon: ArrowRight, kieu: "vien", onClick: () => datBoLocTay({ viTriId: keTiep.id, tuKhoa: "" }) }
      : null;
  const nutPhu =
    tt === TT_DOT.DANG_KIEM_KE && quyen.dem
      ? { nhan: "Thêm lô phát sinh", icon: PackagePlus, onClick: () => moPhatSinh(""), khoa: dangChay }
      : tt === TT_DOT.CHO_DUYET && quyen.demLai && !chonDuoc
        ? {
          nhan: chon.size ? `Yêu cầu đếm lại (${soVN(chon.size)})` : "Yêu cầu đếm lại",
          icon: RotateCcw,
          khoa: !chon.size || dangChay,
          lyDo: !chon.size ? "Chọn dòng cần đếm lại trong bảng" : undefined,
          onClick: () => moHop("demLai"),
        }
        : null;
  const menu = [
    quyen.suaNhap ? { nhan: "Sửa đợt nháp", icon: PencilLine, onSelect: () => navigate(`/stock-take/${dot.id}/edit`) } : null,
    dot.kho?.id ? { nhan: "Xem sơ đồ khóa của kho", icon: Grid2x2, onSelect: () => navigate(`/stock-take/lock-map?khoId=${dot.kho.id}`) } : null,
    quyen.huy ? { nhan: "Hủy đợt", moTa: "Mở khóa phạm vi, tồn kho không đổi", icon: Ban, nguyHiem: true, onSelect: () => moHop("huy") } : null,
  ].filter(Boolean);

  // ── Thông báo ────────────────────────────────────────────────────────────────────────────────────────
  const canKiemLai = rows.filter((d) => d.trangThai === TT_DONG.CAN_KIEM_LAI).length;
  const moChiXem = [TT_DOT.NHAP, TT_DOT.DANG_KIEM_KE, TT_DOT.CHO_DUYET].includes(tt) && !laQtv && !moDuocTaiKho(dot.kho);
  const thongBao = [
    moChiXem ? (
      <DongThongBao key="chi-xem" tone="neutral">
        Bạn không được phân {dot.kho?.ten || "kho của đợt"} nên chỉ xem được đợt này.
      </DongThongBao>
    ) : null,
    tt === TT_DOT.NHAP ? (
      <DongThongBao key="nhap" tone="info">
        {quyen.batDau ? (
          <>
            Đợt nháp chưa khóa kệ nào. Bấm <b className="font-semibold">Bắt đầu kiểm kê</b> để khóa phạm vi và chốt số trên sổ kệ;
            lúc đó các dòng kiểm kê mới được tạo.
          </>
        ) : (
          <>Đợt nháp chưa khóa kệ nào. Quản lý kho của {dot.kho?.ten || "kho"} bắt đầu đợt khi sẵn sàng.</>
        )}
      </DongThongBao>
    ) : null,
    tt === TT_DOT.DANG_KIEM_KE ? (
      <DongThongBao
        key="khoa"
        tone="warn"
        actions={
          <>
            {canKiemLai ? (
              <NutChu onClick={() => datBoLocTay({ loc: "demLai", viTriId: null, tuKhoa: "" })}>Xem các dòng đếm lại</NutChu>
            ) : null}
            <NutChu onClick={() => navigate(`/stock-take/lock-map?khoId=${dot.kho?.id}`)}>Xem sơ đồ khóa</NutChu>
          </>
        }
      >
        {khoa.kieu === "min" ? (
          <>
            Đang giữ hàng thuộc danh mục trên {soVN(dot.soKeKhoa)} kệ: hàng này tạm dừng xuất, chuyển kho và bán tại quầy. Hàng
            khác trên cùng kệ vẫn vận hành.
          </>
        ) : (
          <>
            Đang khóa {soVN(dot.soKeKhoa)} kệ: nhập, xuất, chuyển kho, nhặt hàng và bán tại quầy ở các kệ này tạm dừng tới khi
            duyệt hoặc hủy.
          </>
        )}
        {canKiemLai ? (
          <span className="mt-1 block font-medium">
            Quản lý yêu cầu đếm lại {soVN(canKiemLai)} dòng. Đếm lại rồi trình duyệt lần nữa.
          </span>
        ) : null}
      </DongThongBao>
    ) : null,
    // Ghi chú của người lập cho người đếm (vd. "hàng lỗi để riêng thùng đỏ"): đặt ở đầu màn lúc đang đếm, không chỉ ở cột phải
    suaDuoc && String(dot.ghiChu ?? "").trim() ? (
      <DongThongBao key="ghi-chu" tone="neutral">
        <b className="font-semibold">Ghi chú cho người đếm:</b> <span className="whitespace-pre-line">{dot.ghiChu}</span>
      </DongThongBao>
    ) : null,
    tt === TT_DOT.CHO_DUYET ? (
      quyen.pheDuyet || quyen.demLai ? (
        <DongThongBao
          key="cho-duyet"
          tone="info"
          actions={tk.lech && quyen.demLai ? <NutChu onClick={chonLech}>Chọn {soVN(tk.lech)} dòng lệch</NutChu> : null}
        >
          Kiểm đếm xong{dot.ngayHoanThanh ? ` lúc ${formatDateTime(dot.ngayHoanThanh)}` : ""}, chờ bạn thẩm định:{" "}
          {tk.lech ? `${soVN(tk.lech)} dòng lệch, giá trị ròng ${tienCoDau(tk.giaTri)}.` : "mọi dòng khớp sổ."} Chọn dòng cần
          đếm lại, hoặc Phê duyệt để điều chỉnh tồn.
        </DongThongBao>
      ) : (
        <DongThongBao key="cho-duyet" tone="info">
          Đã trình duyệt{dot.ngayHoanThanh ? ` lúc ${formatDateTime(dot.ngayHoanThanh)}` : ""}, chờ quản lý kho thẩm định. Số
          đếm chỉ xem; kệ vẫn giữ khóa.
        </DongThongBao>
      )
    ) : null,
    tt === TT_DOT.DA_DUYET ? (
      <DongThongBao key="da-duyet" tone="ok">
        Đã duyệt{dot.ngayDuyet ? ` lúc ${formatDateTime(dot.ngayDuyet)}` : ""}
        {dot.nguoiDuyet?.hoTen ? ` bởi ${dot.nguoiDuyet.hoTen}` : ""}
        {dot.phieuDieuChinh?.ma ? ` · phiếu điều chỉnh ${dot.phieuDieuChinh.ma}` : ""}. Tồn kho và sổ kệ đã cập nhật, kệ đã mở
        khóa.
      </DongThongBao>
    ) : null,
    tt === TT_DOT.DA_HUY ? (
      <DongThongBao key="da-huy" tone="neutral">
        Đã hủy{dot.ngayHuy ? ` lúc ${formatDateTime(dot.ngayHuy)}` : ""}
        {dot.nguoiHuy?.hoTen ? ` bởi ${dot.nguoiHuy.hoTen}` : ""}
        {dot.lyDoHuy ? `: ${dot.lyDoHuy}` : ""}. Tồn kho không đổi, kệ đã mở khóa.
      </DongThongBao>
    ) : null,
    soLoiLuu ? (
      <DongThongBao key="loi-luu" tone="bad">
        {soVN(soLoiLuu)} dòng chưa lưu được lên máy chủ ({dsLoiLuu[0]?.loi}). Bấm “Lưu lại” ở từng dòng; số đang gõ vẫn giữ trên
        màn.
      </DongThongBao>
    ) : null,
    q.loiTaiLai ? (
      <DongThongBao key="loi-tai-lai" tone="bad" actions={<NutChu onClick={q.reload}>Thử lại</NutChu>}>
        Không tải lại được đợt kiểm kê: {getApiErrorMessage(q.error, "lỗi kết nối")}. Thông tin đang hiện có thể đã cũ.
      </DongThongBao>
    ) : null,
  ].filter(Boolean);

  const anhDong = anhDongId == null ? null : rows.find((d) => d.id === anhDongId) ?? null;
  const dsChonDemLai = rows.filter((d) => chon.has(d.id));

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        dau={
          <DauChungTu
            ma={dot.ma || `#${dot.id}`}
            trangThai={{ label: nhanTrangThaiDot(tt), quyTrinh: "kiemKe" }}
            dongPhu={[dot.ten, nhanPhamVi(dot.loaiKiemKe), dot.kho?.ten]}
            onQuayLai={veDanhSach}
            nhanQuayLai="Về danh sách kiểm kê"
            saoChepMa={{ giaTri: dot.ma, nhan: "Sao chép mã đợt" }}
            menu={menu}
            nutPhu={nutPhu}
            nutChinh={nutKeTiep ? [nutKeTiep, nutChinh].filter(Boolean) : nutChinh}
          />
        }
        tienTrinh={<TienTrinhChungTu buoc={buocKiemKe({ ...dot, thongKe: { ...dot.thongKe, tongDong: tk.tong, daDem: tk.daDem } })} nhan="Tiến trình kiểm kê" />}
        thongBao={thongBao.length ? thongBao : null}
        dinh={
          chonDuoc ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] leading-5">
              <span className="min-w-0 flex-1">
                {chon.size ? (
                  <>
                    <b className="font-semibold tabular-nums">{soVN(chon.size)}</b> dòng đã chọn để đếm lại. Các dòng còn lại được
                    xác nhận theo số đếm.
                  </>
                ) : (
                  <span className="text-bo-muted">Chọn dòng cần đếm lại trong bảng, hoặc Phê duyệt để điều chỉnh tồn.</span>
                )}
              </span>
              {chon.size ? <NutChu onClick={() => setChon(new Set())}>Bỏ chọn</NutChu> : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => moHop("demLai")}
                disabled={dangChay || !chon.size}
                className="h-9 gap-1.5 border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {chon.size ? `Yêu cầu đếm lại ${soVN(chon.size)} dòng` : "Yêu cầu đếm lại"}
              </Button>
            </div>
          ) : suaDuoc ? (
            <ThanhQuetKiemKe
              oQuetRef={oQuetRef}
              giaTri={quet}
              onDoi={setQuet}
              onQuet={xuLyQuet}
              phanHoi={phanHoi}
              lanQuet={lanPhanHoi}
              keDangDem={keLoc}
              onBoKe={() => datBoLocTay({ viTriId: null })}
            />
          ) : null
        }
        chinh={
          tt === TT_DOT.NHAP ? (
            <section className="grid max-w-2xl gap-4 px-4 py-5 sm:px-6" aria-labelledby="kk-xem-truoc">
              <h2 id="kk-xem-truoc" className="text-base font-semibold leading-6 text-bo-foreground">
                Xem trước phạm vi
              </h2>
              <XemTruocPhamVi
                kq={qXem.data}
                dang={qXem.loading}
                loi={qXem.error && !qXem.loading ? getApiErrorMessage(qXem.error, "lỗi kết nối") : null}
                onThuLai={qXem.reload}
                cheDo={theoDanhMuc ? "theo_lo" : "toan_ke"}
                nutCuaVanDe={(v) =>
                  /hàng chưa có kệ/i.test(v.noiDung) ? <NutChu onClick={() => navigate(`/stock-take/unshelved?khoId=${dot.kho?.id}&tuDot=${dot.id}`)}>Xếp kệ</NutChu> : null
                }
              />
            </section>
          ) : (
            <>
              <TomTatKiemKe tk={tk} mu={mu} coRong={tt === TT_DOT.CHO_DUYET || tt === TT_DOT.DA_DUYET} />
              {tt === TT_DOT.DANG_KIEM_KE ? (
                <BanDoTienDoKe
                  dsKe={dsKe}
                  tienDo={tienDo}
                  keDangXem={boLoc.viTriId}
                  onChonKe={(id) => datBoLocTay({ viTriId: id, tuKhoa: "" })}
                  tongDong={tk.tong}
                  daDem={tk.daDem}
                />
              ) : null}
              <BangDemKiemKe
                dong={dsHien}
                tong={rows.length}
                suaDuoc={suaDuoc}
                mu={mu}
                nutMu={suaDuoc ? { bat: muLuu, onDoi: doiMu } : null}
                chonDuoc={chonDuoc}
                chon={chon}
                onDoiChon={doiChon}
                luaChon={luaChon}
                boLoc={{ ...boLoc, loc: locHienTai }}
                onDoiBoLoc={datBoLocTay}
                dsKe={dsKe}
                trang={trang}
                coTrang={coTrang}
                onDoiTrang={setTrang}
                onDoiCoTrang={(n) => {
                  setCoTrang(n);
                  setTrang(0);
                }}
                dongSang={dongSang}
                trangThaiLuu={luu.trangThai}
                onDoiSo={doiSo}
                onDoiLyDo={doiLyDo}
                onRoiO={luu.luuNgay}
                onMoAnh={(d) => {
                  setAnhDongId(d.id);
                  setHop("anh");
                }}
                onQuetNham={(chu) => {
                  setQuet(String(chu ?? "").trimStart());
                  oQuetRef.current?.focus();
                }}
                oQuetRef={oQuetRef}
                tienDo={tienDo}
                keTiep={keTiep}
                onThemPhatSinh={suaDuoc && quyen.dem ? () => moPhatSinh("") : undefined}
              />
            </>
          )
        }
        cotPhai={<CotKiemKe dot={dot} nhatKy={q.data?.nhatKy} phieu={q.data?.phieu} />}
      />

      {/* Bắt đầu */}
      <HopXacNhanChungTu
        mo={hop === "batDau"}
        onDoiMo={dongHop}
        tieuDe={`Bắt đầu kiểm kê ${dot.ma}?`}
        moTa="Hệ thống khóa phạm vi và chốt số trên sổ kệ của từng lô ngay lúc này. Từ đó tới khi duyệt hoặc hủy, hàng trong phạm vi tạm dừng nhập, xuất và bán."
        nhanXacNhan="Bắt đầu kiểm kê"
        iconXacNhan={Play}
        rong
        dangChay={dangChay}
        khoaXacNhan={qXem.loading || (qXem.data && !qXem.data.coTheBatDau)}
        lyDoKhoa={qXem.loading ? "Đang tính phạm vi…" : qXem.data && !qXem.data.coTheBatDau ? "Gỡ các vướng mắc trước" : undefined}
        loi={loiHop}
        onXacNhan={lenhBatDau}
      >
        <XemTruocPhamVi
          kq={vanDeHop.length ? { ...(qXem.data ?? {}), vanDe: vanDeHop, coTheBatDau: false } : qXem.data}
          dang={qXem.loading}
          cheDo={theoDanhMuc ? "theo_lo" : "toan_ke"}
        />
      </HopXacNhanChungTu>

      {/* Rà lại trước khi trình: đã đếm hết, còn dòng lệch chưa giải trình */}
      <HopRaLaiKiemKe
        mo={hop === "raLai" && suaDuoc}
        onDoiMo={dongHop}
        dong={rows}
        onDoiLyDo={doiLyDo}
        onRoiLyDo={luu.luuNgay}
        trangThaiLuu={luu.trangThai}
        onTrinh={lenhTrinh}
        dangChay={dangChay}
        loi={hop === "raLai" ? loiHop : null}
        traTieuDiemVe={oQuetRef}
      />

      {/* Trình duyệt */}
      <HopXacNhanChungTu
        mo={hop === "trinh" && suaDuoc}
        onDoiMo={dongHop}
        tieuDe={`Trình duyệt ${dot.ma}?`}
        moTa="Số đếm khóa lại để quản lý kho thẩm định. Kệ vẫn giữ khóa tới khi duyệt."
        nhanXacNhan="Trình duyệt"
        iconXacNhan={Send}
        tieuDiemQuayLai
        traTieuDiemVe={oQuetRef}
        dangChay={dangChay}
        loi={loiHop}
        onXacNhan={lenhTrinh}
      >
        <TomTatHop tk={tk} mu={mu} />
      </HopXacNhanChungTu>

      {/* Phê duyệt */}
      <HopXacNhanChungTu
        mo={hop === "duyet"}
        onDoiMo={dongHop}
        tieuDe={`Phê duyệt ${dot.ma}?`}
        moTa="Tạo phiếu điều chỉnh, cập nhật tồn lô và sổ kệ theo số đếm, mở khóa phạm vi, đồng bộ tồn lên kênh bán. Không hoàn tác được."
        nhanXacNhan="Phê duyệt và điều chỉnh tồn"
        iconXacNhan={BadgeCheck}
        rong
        dangChay={dangChay}
        loi={loiHop}
        onXacNhan={lenhDuyet}
      >
        <TomTatHop tk={tk} />
        {vanDeHop.length ? (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {vanDeHop.map((v, i) => (
              <li key={i} className="rounded-md border border-bo-danger/25 bg-bo-danger-soft px-2.5 py-2 text-[13px] leading-5 text-bo-danger-strong">
                {v.noiDung}
              </li>
            ))}
          </ul>
        ) : null}
      </HopXacNhanChungTu>

      {/* Đếm lại */}
      <HopLyDo
        mo={hop === "demLai"}
        onDoiMo={dongHop}
        tieuDe={`Yêu cầu đếm lại ${soVN(chon.size)} dòng?`}
        moTa="Đợt quay về Đang kiểm kê; các dòng khác được chốt, chỉ dòng đã chọn phải đếm lại. Số lần trước vẫn lưu trong lịch sử."
        nhanO="Lý do đếm lại"
        goiY="Ví dụ: Chênh lệch lớn, đếm lại cả kệ và chụp ảnh tem"
        nhanXacNhan="Yêu cầu đếm lại"
        iconXacNhan={RotateCcw}
        onXacNhan={lenhDemLai}
      >
        <ul className={`${GHI_CHU_HOP} m-0 grid max-h-40 list-none gap-1 overflow-y-auto`}>
          {dsChonDemLai.map((d) => (
            <li key={d.id} className="flex min-w-0 justify-between gap-3">
              <span className="min-w-0 truncate">
                Kệ {d.viTri?.ma} · {d.sanPham?.tenSanPham} · lô {d.loHang?.ma}
              </span>
              <span className="shrink-0 tabular-nums">
                {soVN(d.soLuongHeThong)} → {d.soLuongThucTe == null ? "—" : soVN(d.soLuongThucTe)}
              </span>
            </li>
          ))}
        </ul>
      </HopLyDo>

      {/* Hủy */}
      <HopLyDo
        mo={hop === "huy"}
        onDoiMo={dongHop}
        tieuDe={`Hủy đợt ${dot.ma}?`}
        moTa={
          tt === TT_DOT.NHAP
            ? "Đợt nháp chưa khóa gì; hủy thì đợt chuyển sang Đã hủy."
            : "Mở khóa toàn bộ phạm vi, tồn kho giữ nguyên, số đã đếm vẫn lưu để tra cứu. Không hoàn tác được."
        }
        nhanO="Lý do hủy"
        goiY="Ví dụ: Lập nhầm phạm vi, sẽ tạo đợt khác"
        nhanXacNhan="Hủy đợt"
        iconXacNhan={Ban}
        kieu="nguyHiem"
        onXacNhan={lenhHuy}
      />

      <HopPhatSinh
        mo={hop === "phatSinh"}
        onDoiMo={(m) => !m && setHop(null)}
        dot={dot}
        dsKe={keChonPhatSinh}
        keDau={boLoc.viTriId ?? ""}
        tuKhoaDau={phatSinhTu}
        traTieuDiemVe={oQuetRef}
        onXong={() => q.reload()}
      />

      <HopAnhKiemKe
        mo={hop === "anh" && Boolean(anhDong)}
        onDoiMo={(m) => {
          if (!m) {
            setHop(null);
            setAnhDongId(null);
          }
        }}
        dot={dot}
        dong={anhDong}
        suaDuoc={suaDuoc}
        traTieuDiemVe={oQuetRef}
        onDaDoi={taiLaiDong}
      />
    </PageContainer>
  );
}

/** Tóm tắt trong hộp Trình duyệt / Phê duyệt: số dòng đã đếm, thiếu, thừa (kèm giá trị), giá trị ròng. */
function TomTatHop({ tk, mu = false }) {
  if (mu) {
    return (
      <div className={GHI_CHU_HOP}>
        <b className="tabular-nums">
          {soVN(tk.daDem)}/{soVN(tk.tong)}
        </b>{" "}
        dòng đã đếm. Đang đếm mù nên chênh lệch hiện cho quản lý khi thẩm định.
      </div>
    );
  }
  const o = [
    { ma: "dem", so: `${soVN(tk.daDem)}/${soVN(tk.tong)}`, nhan: `dòng đã đếm · ${soVN(tk.lech)} lệch` },
    { ma: "thieu", so: tk.thieu ? `−${soVN(tk.thieu)}` : "0", nhan: `thiếu · ${tienCoDau(-tk.giaTriThieu)}`, mau: "text-bo-danger" },
    { ma: "thua", so: tk.thua ? `+${soVN(tk.thua)}` : "0", nhan: `thừa · ${tienCoDau(tk.giaTriThua)}`, mau: "text-bo-primary-strong" },
  ];
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-3 gap-2">
        {o.map((x) => (
          <div key={x.ma} className="min-w-0 rounded-md border border-bo-border bg-bo-surface px-2.5 py-2">
            <span className={`block text-lg font-semibold leading-6 tabular-nums text-bo-foreground ${x.mau ?? ""}`}>{x.so}</span>
            <span className="block truncate text-xs leading-4 text-bo-muted">{x.nhan}</span>
          </div>
        ))}
      </div>
      <p className="flex justify-between gap-3 rounded-md bg-bo-surface-subtle px-2.5 py-2 text-[13px] leading-5">
        <span className="text-slate-700">Giá trị chênh lệch ròng (theo giá vốn chốt)</span>
        <b className="font-semibold tabular-nums text-bo-heading">{tienCoDau(tk.giaTri)}</b>
      </p>
    </div>
  );
}
