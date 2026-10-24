import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, CircleCheckBig, Download, Eraser } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP } from "@/components/chung-tu/kieuHopThoai";
import {
  CAU_HET_THOI_HAN,
  MO_TA_HET_THOI_HAN,
  chayCoThoiHan,
  khiGocKetThuc,
  khoaKhiChoGoc,
  laLoiHetThoiHan,
} from "@/components/chung-tu/thoiHanThaoTac";
import BangKiemKe from "@/components/kiem-ke/BangKiemKe";
import ThuocTinhKiemKe from "@/components/kiem-ke/ThuocTinhKiemKe";
import {
  demBanTamNguoiKhac,
  docBanTam,
  docDemMu,
  ghiBanTam,
  ghiDemMu,
  khoaBanTam,
  khoiPhucSoDem,
  layKhoLuu,
  thuLuu,
  xoaBanTam,
} from "@/components/kiem-ke/banTamKiemKe";
import {
  buocKiemKe,
  csvSoDem,
  demKiemKe,
  dongKiemKe,
  gioDem,
  gioMuonNhatTheoLo,
  laDotDaDong,
  laDotXong,
  lechGioMayChu,
  locMacDinh,
  loXenGiua,
  luaChonLoc,
  lyDoKhoaHoanThanh,
  soDemBiBo,
  thongBaoKiemKe,
  tinhDong,
  tomTatHoanThanh,
} from "@/components/kiem-ke/tinhKiemKe";
import { CO_TRANG_DONG } from "@/config/bangChungTu";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { getLichSuGiaoDichKhoKemGio } from "@/services/lichSuGiaoDichKhoService";
import { completeStockTake, getStockTake, getStockTakeDetails } from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { laKhoGiaoDich } from "@/utils/kho";
import { getKhoLamViecId, khoTrongToken, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, getCurrentUserId, hasAnyRole } from "@/utils/roles";

const LOAI_KIEM_KE = {
  toan_bo: "Kiểm kê toàn bộ kho",
  theo_danh_muc: "Kiểm kê theo danh mục",
  theo_khu_vuc: "Kiểm kê theo khu vực",
  dot_xuat: "Kiểm kê đột xuất",
};

// Câu máy chủ khi đợt đã được hoàn thành ở nơi khác (PhieuKiemKeService.complete)
const MAU_DA_HOAN_THANH = /đã hoàn thành/i;
const RONG = Object.freeze({});

/** Kho của đợt trong danh sách kho được phân (token), nếu là kho giao dịch (đang hoạt động, không phải kho trung chuyển). */
function khoDuocPhan(khoId) {
  if (khoId == null) return null;
  const kho = khoTrongToken().find((k) => Number(k?.id) === Number(khoId)) ?? null;
  return kho && laKhoGiaoDich(kho) ? kho : null;
}

/** Câu lỗi khi tải lịch sử giao dịch kho (hết thời hạn chờ → câu riêng, không lộ mã lỗi). */
const cauLoiLichSu = (error) => (laLoiHetThoiHan(error) ? "máy chủ chưa trả lời" : getApiErrorMessage(error, "lỗi kết nối"));

/** Tải một tệp văn bản về máy (tệp CSV số đếm). */
function taiTep(ten, noiDung) {
  const url = URL.createObjectURL(new Blob([noiDung], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = ten;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Chi tiết đợt kiểm kê (/stock-take/:id) · bản "một khối" 21/10/2026 (artboard KiemKe của canvas "Màn bán hàng & kho
 * cấp 2–3"), đã chốt Q16: bỏ "coi là khớp" (lô chưa đếm không gửi, tồn giữ nguyên) · cảnh báo giao dịch xen giữa (lô có
 * nhập / xuất / bán tại quầy sau lúc đếm → "Đếm lại", không gửi) · "Đóng đợt, không đổi tồn" (gửi danh sách rỗng).
 *
 * - Quyền theo kho: kho của đợt nằm trong kho được phân → tự chuyển nơi làm việc sang kho đó; không → máy chủ chặn xem
 *   (403, khung lỗi), "chỉ xem" chỉ còn khi phân quyền trong phiên đã cũ; quản trị viên không bị chặn. Hoàn thành luôn gửi `khoId` = kho của đợt; máy chủ ghi tồn vào kho của đợt, chặn khi kho đang chọn
 *   khác kho của đợt (403) hoặc `khoId` lệch kho của đợt (400).
 * - Số đếm dở lưu trên máy theo tài khoản (banTamKiemKe.js), tự lưu mỗi lần nhập, khôi phục khi mở lại; tab khác đổi thì
 *   nạp theo (sự kiện storage).
 * - Đếm mù nhớ theo tài khoản; "Xem tất cả lô lệch" trong hộp Hoàn thành chỉ tắt trong phiên này.
 * - Đóng đợt: quản trị viên, quản lý kho.
 */
export default function StockTakeDetail() {
  const { id } = useParams();
  return <ManKiemKe key={id} dotId={id} />;
}

function ManKiemKe({ dotId }) {
  const navigate = useNavigate();
  const veDanhSach = useCallback(() => navigate("/stock-take"), [navigate]);
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const laQlk = hasAnyRole([ROLES.QUAN_LY_KHO]);
  const laNvk = !laQtv && !laQlk && hasAnyRole([ROLES.NHAN_VIEN_KHO]);
  const [nguoiDungId] = useState(getCurrentUserId);
  const [khoLuu] = useState(layKhoLuu);
  const [luuDuoc] = useState(() => thuLuu(khoLuu));

  // ── Đợt + chi tiết (tự chuyển nơi làm việc sang kho của đợt đang kiểm kê nếu được phân) ──────────────
  // Chỉ chuyển ở lần tải đầu: các lần tải lại (quay lại tab) không đổi ngược nơi làm việc người dùng vừa tự chọn
  const daXetChuyenRef = useRef(false);
  const taiDot = useCallback(async () => {
    const [dot, chiTiet] = await Promise.all([getStockTake(dotId), getStockTakeDetails(dotId)]);
    let doiKho = null;
    if (dot && !daXetChuyenRef.current) {
      daXetChuyenRef.current = true;
      const kho = !laQtv && !laDotXong(dot) ? khoDuocPhan(dot.kho?.id) : null;
      if (kho && getKhoLamViecId() !== Number(kho.id)) {
        setKhoLamViecId(kho.id);
        doiKho = dot.kho?.tenKho || kho.tenKho || "kho của đợt";
      }
    }
    return { dot, chiTiet, doiKho };
  }, [dotId, laQtv]);
  const q = useTaiDuLieu(taiDot, `kiem-ke-${dotId}`, { enabled: Boolean(dotId) });
  const dot = q.data?.dot ?? null;
  const daXong = laDotXong(dot);
  const dong = useMemo(() => dongKiemKe(q.data?.chiTiet), [q.data]);
  const khoId = dot?.kho?.id ?? null;
  const duocPhan = laQtv || Boolean(khoDuocPhan(khoId));
  // Vừa hoàn thành / đóng đợt trên máy chủ mà chưa tải lại được kết quả: không cho đếm tiếp
  const [daGuiXong, setDaGuiXong] = useState(false);
  const suaDuoc = Boolean(dot) && !daXong && duocPhan && !daGuiXong;
  const chiXem = Boolean(dot) && !daXong && !duocPhan;
  const dongDuoc = suaDuoc && (laQtv || laQlk);

  // ── Số đếm trên máy: khởi tạo một lần từ bản tạm khi đợt đã tải (đặt state lúc vẽ, có điều kiện) ────────
  const [soDem, setSoDem] = useState(null);
  const [khoiPhuc, setKhoiPhuc] = useState(null);
  const [luu, setLuu] = useState({ luc: null, loi: !luuDuoc });
  if (soDem === null && dot && suaDuoc && q.data?.chiTiet) {
    const { banTam } = docBanTam(khoLuu, dot.id, nguoiDungId);
    const kp = khoiPhucSoDem(banTam, dot, dong);
    setSoDem(kp.soDem);
    setKhoiPhuc(kp.soDong ? { soDong: kp.soDong, luc: kp.capNhat } : null);
    setLuu({ luc: kp.capNhat, loi: !luuDuoc });
  }
  const soDemHienTai = soDem ?? RONG;

  // Tab khác (cùng tài khoản) đổi bản tạm: nạp theo
  const dotRef = useRef(dot);
  const dongRef = useRef(dong);
  const taiLaiDotRef = useRef(q.reload);
  useEffect(() => {
    dotRef.current = dot;
    dongRef.current = dong;
    taiLaiDotRef.current = q.reload;
  });
  useEffect(() => {
    if (!suaDuoc || nguoiDungId == null) return undefined;
    const khoa = khoaBanTam(dotId, nguoiDungId);
    const nghe = (suKien) => {
      if (suKien.key !== khoa) return;
      let banTam = null;
      try {
        banTam = suKien.newValue ? JSON.parse(suKien.newValue) : null;
      } catch {
        banTam = null;
      }
      setSoDem(khoiPhucSoDem(banTam, dotRef.current, dongRef.current).soDem);
      setKhoiPhuc(null);
      // Tab khác xóa bản tạm (vừa hoàn thành, đóng đợt hoặc xóa số đếm): tải lại đợt để biết đợt còn mở không
      if (!suKien.newValue) taiLaiDotRef.current?.();
    };
    window.addEventListener("storage", nghe);
    return () => window.removeEventListener("storage", nghe);
  }, [suaDuoc, dotId, nguoiDungId]);

  // ── Lịch sử giao dịch kho (Q16b): tải khi mở đợt đang kiểm kê, khi quay lại tab, khi mở hộp Hoàn thành và ngay trước khi
  //    gửi. Có thời hạn (chayCoThoiHan): API trả hết lịch sử, mạng treo thì báo "chưa kiểm tra được" thay vì kẹt hộp ──────
  const taiLichSu = useCallback(
    () =>
      chayCoThoiHan(async () => {
        const truoc = Date.now();
        const { ds, gioMayChu } = await getLichSuGiaoDichKhoKemGio();
        return { ds, lech: lechGioMayChu(gioMayChu, (truoc + Date.now()) / 2) };
      }),
    [],
  );
  const qLs = useTaiDuLieu(taiLichSu, `lich-su-kiem-ke-${dotId}`, { enabled: suaDuoc });
  const muonNhat = useMemo(() => gioMuonNhatTheoLo(qLs.data?.ds, { khoId, dotId: dot?.id }), [qLs.data, khoId, dot?.id]);

  // ── Đếm mù (nhớ theo tài khoản; tắt trong phiên khi bấm "Xem tất cả lô lệch") ─────────────────────────────
  const [muLuu, setMuLuu] = useState(() => docDemMu(khoLuu, nguoiDungId));
  const [muPhien, setMuPhien] = useState(false);
  const mu = suaDuoc && muLuu && !muPhien;

  // ── Dòng đã tính ─────────────────────────────────────────────────────────────────────────────────────
  const rowsKhongXen = useMemo(() => tinhDong(dong, { soDem: soDemHienTai, daXong }), [dong, soDemHienTai, daXong]);
  const xen = useMemo(
    () => (suaDuoc ? loXenGiua(null, { rows: rowsKhongXen, muonNhat }) : new Set()),
    [suaDuoc, rowsKhongXen, muonNhat],
  );
  const rows = useMemo(
    () => (xen.size ? rowsKhongXen.map((d) => (xen.has(d.id) ? { ...d, xen: true } : d)) : rowsKhongXen),
    [rowsKhongXen, xen],
  );
  const dem = useMemo(() => demKiemKe(rows), [rows]);
  const daDong = laDotDaDong(daXong, dem);
  const tt = useMemo(() => tomTatHoanThanh(rows), [rows]);

  // Đợt đã xong (ở nơi khác) mà máy còn bản tạm: lô đã đếm trên máy nhưng lần hoàn thành không gửi
  const [lanXoaBanTam, setLanXoaBanTam] = useState(0);
  const soDemTamXong = useMemo(() => {
    if (!daXong || !dot || nguoiDungId == null) return null;
    const { banTam } = docBanTam(khoLuu, dot.id, nguoiDungId);
    return banTam ? khoiPhucSoDem(banTam, dot, dong).soDem : null;
    // lanXoaBanTam: đọc lại sau khi xóa bản tạm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daXong, dot, dong, khoLuu, nguoiDungId, lanXoaBanTam]);
  const boMat = useMemo(() => (soDemTamXong ? soDemBiBo(rows, soDemTamXong) : []), [rows, soDemTamXong]);
  useEffect(() => {
    // Mọi số trên máy đã có trong lần hoàn thành: bỏ bản tạm, không cần báo
    if (soDemTamXong && !boMat.length && dot) xoaBanTam(khoLuu, dot.id, nguoiDungId);
  }, [soDemTamXong, boMat, dot, khoLuu, nguoiDungId]);

  const nguoiKhac = useMemo(
    () => (suaDuoc && dot ? demBanTamNguoiKhac(khoLuu, dot.id, nguoiDungId) : 0),
    [suaDuoc, dot, khoLuu, nguoiDungId],
  );

  // ── Bảng: từ khóa, lọc, dòng giữ lại, trang ───────────────────────────────────────────────────────────
  const [tuKhoa, setTuKhoa] = useState("");
  const [loc, setLoc] = useState(null);
  const [giuLai, setGiuLai] = useState(() => new Set());
  const [trang, setTrang] = useState(0);
  const [coTrang, setCoTrang] = useState(CO_TRANG_DONG[0]);
  const luaChon = luaChonLoc({ daXong, mu, dem, giuXen: loc === "xen" });
  const locHienTai = luaChon.some((x) => x.value === loc) ? loc : locMacDinh({ daXong, dem });
  const datLoc = (ma) => {
    setLoc(ma);
    setTuKhoa("");
    setTrang(0);
    setGiuLai(new Set());
  };
  const oTimRef = useRef(null);

  // ── Thao tác ─────────────────────────────────────────────────────────────────────────────────────────
  const luuSoDem = (moi) => {
    const ok = ghiBanTam(khoLuu, { dot, nguoiDungId, soDem: moi, dong });
    setLuu({ luc: Date.now(), loi: !ok });
  };
  const doiSo = (id, so) => {
    const d = dong.find((x) => String(x.id) === String(id));
    const moi = { ...soDemHienTai };
    if (so == null) delete moi[id];
    else {
      const bayGio = Date.now();
      moi[id] = { so, luc: gioDem({ bayGio, lech: qLs.data?.lech, maLo: d?.maLo, sku: d?.sku, muonNhat }), lucHien: bayGio };
    }
    setSoDem(moi);
    setKhoiPhuc(null);
    setGiuLai((cu) => (cu.has(id) ? cu : new Set(cu).add(id)));
    luuSoDem(moi);
  };
  const doiMu = (bat) => {
    setMuLuu(bat);
    setMuPhien(false);
    ghiDemMu(khoLuu, nguoiDungId, bat);
    datLoc(null);
  };
  // Nút trong dòng thông báo tự mất sau khi bấm (Tắt đếm mù, Tải CSV…): đưa tiêu điểm về ô quét để quét tiếp
  const veOTim = () => setTimeout(() => oTimRef.current?.focus(), 0);

  const [hop, setHop] = useState(null); // "xong" | "dong" | "xoa" | null
  const [dangChay, setDangChay] = useState(false);
  const [loiHop, setLoiHop] = useState(null);
  const [boQuaKiemTra, setBoQuaKiemTra] = useState(false);
  const [choGoc, setChoGoc] = useState(false);
  const huyChoGocRef = useRef(null);
  const daGoRef = useRef(false);
  useEffect(() => {
    daGoRef.current = false;
    return () => {
      daGoRef.current = true;
      huyChoGocRef.current?.();
    };
  }, []);

  // Quay lại tab: tải lại đợt, và lịch sử giao dịch khi đang đếm (cảnh báo xen giữa đến sớm, không đợi tới lúc hoàn thành)
  useTaiLaiKhiQuayLai(
    () => {
      q.reload();
      if (suaDuoc) qLs.reload();
    },
    { bat: Boolean(dot) && !q.loading && !dangChay && !hop, lanCuoi: q.capNhatLuc },
  );

  const moHop = (ma) => {
    setLoiHop(null);
    setBoQuaKiemTra(false);
    setHop(ma);
    if (ma === "xong") qLs.reload();
  };
  const dongHop = (mo) => {
    if (mo || dangChay) return;
    setHop(null);
    setLoiHop(null);
  };

  const ma = dot?.maDotKiemKe || `#${dotId}`;
  const tenKho = dot?.kho?.tenKho || "kho của đợt";
  const tenCsv = (hauTo) => `kiem-ke-${ma}-${hauTo}.csv`;

  const xongThaoTac = ({ tieuDe, moTa }) => {
    xoaBanTam(khoLuu, dot.id, nguoiDungId);
    setDaGuiXong(true);
    setSoDem({});
    setKhoiPhuc(null);
    setHop(null);
    setMuPhien(true);
    setLoc(null);
    setTuKhoa("");
    setTrang(0);
    setGiuLai(new Set());
    toast.success(tieuDe, { description: moTa });
    q.reload();
  };

  const loiThaoTac = (error, cauMacDinh) => {
    if (daGoRef.current) return;
    if (laLoiHetThoiHan(error)) {
      setHop(null);
      toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
      huyChoGocRef.current?.();
      setChoGoc(true);
      huyChoGocRef.current = khiGocKetThuc(error, () => {
        huyChoGocRef.current = null;
        setChoGoc(false);
        q.reload();
      });
      return;
    }
    const cau = getApiErrorMessage(error, cauMacDinh);
    if (MAU_DA_HOAN_THANH.test(cau)) {
      // Đã hoàn thành ở nơi khác: đóng hộp, tải lại (bản tạm giữ lại để báo lô đã đếm không được gửi)
      setHop(null);
      toast.error(cau);
      q.reload();
      return;
    }
    setLoiHop(cau);
  };

  const hoanThanh = async () => {
    if (!dot || khoId == null) return;
    setLoiHop(null);
    setDangChay(true);
    try {
      let rowsGui = rows;
      if (!boQuaKiemTra) {
        // Kiểm tra giao dịch xen giữa lần cuối, ngay trước khi gửi
        let moi = null;
        try {
          moi = await taiLichSu();
        } catch (error) {
          if (daGoRef.current) return;
          setBoQuaKiemTra(true);
          setLoiHop(
            `Chưa kiểm tra được giao dịch sau lúc đếm: ${cauLoiLichSu(error)}. Lô có nhập, xuất sau lúc đếm sẽ bị ghi đè bằng số đếm. Bấm “Vẫn hoàn thành” để gửi, hoặc Quay lại rồi thử sau.`,
          );
          return;
        }
        if (daGoRef.current) return;
        qLs.setData(() => moi);
        const mn = gioMuonNhatTheoLo(moi.ds, { khoId, dotId: dot.id });
        const xenMoi = loXenGiua(null, { rows: rowsKhongXen, muonNhat: mn });
        const them = [...xenMoi].filter((id) => !xen.has(id)).length;
        if (them) {
          setLoiHop(
            `Vừa có thêm ${soVN(them)} lô có nhập hoặc xuất sau lúc đếm nên đã bỏ khỏi danh sách gửi. Xem lại rồi bấm “Hoàn thành và cập nhật tồn”.`,
          );
          return;
        }
        rowsGui = rowsKhongXen.map((d) => (xenMoi.has(d.id) ? { ...d, xen: true } : d));
      }
      const gui = tomTatHoanThanh(rowsGui);
      if (!gui.soGui) {
        setLoiHop("Không còn lô nào để gửi: mọi lô đã đếm đều có nhập hoặc xuất sau lúc đếm.");
        return;
      }
      await chayCoThoiHan(() => completeStockTake(dot.id, khoId, gui.duLieu));
      if (daGoRef.current) return;
      xongThaoTac({ tieuDe: `Đã hoàn thành kiểm kê ${ma}`, moTa: `Tồn kho ${tenKho} đã cập nhật theo số thực tế` });
    } catch (error) {
      loiThaoTac(error, "Không hoàn thành được đợt kiểm kê");
    } finally {
      if (!daGoRef.current) setDangChay(false);
    }
  };

  const dongDot = async () => {
    if (!dot || khoId == null) return;
    setLoiHop(null);
    setDangChay(true);
    try {
      await chayCoThoiHan(() => completeStockTake(dot.id, khoId, []));
      if (daGoRef.current) return;
      xongThaoTac({ tieuDe: `Đã đóng đợt ${ma}`, moTa: "Tồn kho không đổi" });
    } catch (error) {
      loiThaoTac(error, "Không đóng được đợt kiểm kê");
    } finally {
      if (!daGoRef.current) setDangChay(false);
    }
  };

  const xoaSoDem = () => {
    xoaBanTam(khoLuu, dot.id, nguoiDungId);
    setSoDem({});
    setKhoiPhuc(null);
    setLuu({ luc: null, loi: !luuDuoc });
    setHop(null);
    datLoc("chua");
    toast.success("Đã xóa số đã đếm trên máy này", { description: "Bắt đầu đếm lại" });
  };

  const dsDaDem = rows.filter((d) => d.so != null && d.loai !== "khongDem");
  const taiCsvHienTai = () => taiTep(tenCsv("so-dem"), csvSoDem(dsDaDem, { maDot: ma }));
  const taiCsvMat = () => {
    taiTep(tenCsv("chua-ghi"), csvSoDem(boMat, { maDot: ma }));
    xoaBanTam(khoLuu, dot.id, nguoiDungId);
    setLanXoaBanTam((n) => n + 1);
    toast.success("Đã tải tệp số đếm", { description: "Bản tạm trên máy này đã xóa" });
    veOTim();
  };

  // ── Đang tải / lỗi ─────────────────────────────────────────────────────────────────────────────────
  if (!dot) {
    if (q.loading || (!q.error && q.data === undefined)) {
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
          // PhieuKiemKeService ném RuntimeException "Không tìm thấy đợt kiểm kê ID: …" → 500
          tuyChonLoi={{ coi500LaKhongThay: true }}
        />
      </PageContainer>
    );
  }

  // ── Đầu khối ─────────────────────────────────────────────────────────────────────────────────────────
  const lyDo = suaDuoc ? lyDoKhoaHoanThanh(tt, { dongDuoc }) : "";
  const idLyDo = `kiem-ke-${dotId}-ly-do`;
  const nutChinh = suaDuoc
    ? khoaKhiChoGoc(
      {
        ma: "xong",
        nhan: "Hoàn thành kiểm kê",
        icon: CircleCheckBig,
        khoa: Boolean(lyDo) || dangChay,
        lyDo: lyDo ? `Chưa hoàn thành được: ${lyDo}` : undefined,
        onClick: () => moHop("xong"),
      },
      choGoc,
    )
    : null;
  const menu = [
    dongDuoc
      ? { ma: "dong", nhan: "Đóng đợt, không đổi tồn", moTa: "Bỏ đợt dở, mọi lô ghi là Không đếm", icon: Archive, khoa: choGoc, onSelect: () => moHop("dong") }
      : null,
    suaDuoc && dsDaDem.length
      ? { ma: "csv", nhan: "Tải số đếm (CSV)", moTa: "Lưu ra tệp các số đếm trên máy này", icon: Download, onSelect: taiCsvHienTai }
      : null,
    suaDuoc && dsDaDem.length
      ? {
        ma: "xoa",
        nhan: "Xóa số đã đếm trên máy này",
        moTa: "Đếm lại từ đầu, máy chủ không đổi",
        icon: Eraser,
        nguyHiem: true,
        onSelect: () => moHop("xoa"),
      }
      : null,
  ].filter(Boolean);

  const hanhDong = {
    xemXen: <NutChu onClick={() => datLoc("xen")}>Xem các lô cần đếm lại</NutChu>,
    thuLaiXen: <NutChu onClick={qLs.reload}>Thử lại</NutChu>,
    xoaBanTam: <NutChu onClick={() => moHop("xoa")}>Xóa và đếm lại</NutChu>,
    tatMu: (
      <NutChu
        onClick={() => {
          doiMu(false);
          veOTim();
        }}
      >
        Tắt đếm mù
      </NutChu>
    ),
    taiCsvMat: <NutChu onClick={taiCsvMat}>Tải số đếm (CSV) rồi xóa bản tạm</NutChu>,
  };
  const thongBao = [
    ...thongBaoKiemKe({
      dot,
      daXong,
      daDong,
      chiXem,
      doiKho: q.data?.doiKho,
      dem,
      mu,
      loiXen: suaDuoc && qLs.error && !qLs.loading ? cauLoiLichSu(qLs.error) : null,
      khoiPhuc,
      nguoiKhac,
      soMat: boMat.length,
      daGuiXong: daGuiXong && !daXong,
    }).map((n) => (
      <DongThongBao key={n.ma} tone={n.tone} actions={n.hanhDong ? hanhDong[n.hanhDong] : null}>
        {n.chu}
      </DongThongBao>
    )),
    q.loiTaiLai ? (
      <DongThongBao key="loi-tai-lai" tone="bad" actions={<NutChu onClick={q.reload}>Thử lại</NutChu>}>
        Không tải lại được đợt kiểm kê: {getApiErrorMessage(q.error, "lỗi kết nối")}. Thông tin đang hiện có thể đã cũ.
      </DongThongBao>
    ) : null,
  ].filter(Boolean);

  // ── Hộp Hoàn thành ───────────────────────────────────────────────────────────────────────────────────
  const anLech = mu && laNvk;
  const dangKiemTra = qLs.loading;
  const loiKiemTra = qLs.error && !qLs.loading ? cauLoiLichSu(qLs.error) : null;

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        dau={
          <DauChungTu
            ma={ma}
            trangThai={{ label: daXong ? "Hoàn thành" : "Đang kiểm kê", quyTrinh: "kiemKe" }}
            dongPhu={[
              LOAI_KIEM_KE[dot.loaiKiemKe] || "Kiểm kê",
              <b key="lo" className="font-semibold text-bo-foreground">{soVN(dem.tong)} lô</b>,
              <b key="bt" className="font-semibold text-bo-foreground">{soVN(dem.soBienThe)} biến thể</b>,
            ]}
            onQuayLai={veDanhSach}
            nhanQuayLai="Về danh sách kiểm kê"
            saoChepMa={{ giaTri: dot.maDotKiemKe, nhan: "Sao chép mã đợt" }}
            menu={menu}
            nutChinh={nutChinh}
          />
        }
        tienTrinh={<TienTrinhChungTu buoc={buocKiemKe({ dot, dem, daXong, daDong, chiXem })} nhan="Tiến trình kiểm kê" />}
        thongBao={thongBao.length ? thongBao : null}
        chinh={
          <BangKiemKe
            rows={rows}
            luaChon={luaChon}
            loc={locHienTai}
            onDoiLoc={datLoc}
            tuKhoa={tuKhoa}
            onDoiTuKhoa={setTuKhoa}
            giuLai={giuLai}
            trang={trang}
            coTrang={coTrang}
            onDoiTrang={setTrang}
            onDoiCoTrang={(n) => {
              setCoTrang(n);
              setTrang(0);
            }}
            suaDuoc={suaDuoc && !choGoc}
            mu={mu}
            chiXem={chiXem}
            onDoiSo={doiSo}
            oTimRef={oTimRef}
            nutMu={suaDuoc ? { bat: mu, onDoi: doiMu } : null}
            lyDoKhoa={lyDo}
            idLyDo={idLyDo}
          />
        }
        cotPhai={<ThuocTinhKiemKe dot={dot} dem={dem} daXong={daXong} mu={mu} suaDuoc={suaDuoc} luu={luu} />}
      />

      <HopXacNhanChungTu
        mo={hop === "xong"}
        onDoiMo={dongHop}
        tieuDe={`Hoàn thành kiểm kê ${ma}?`}
        moTa={`Tồn kho của ${soVN(tt.soGui)} lô ở ${tenKho} được ghi đè bằng số thực tế; lô lệch được ghi lịch sử điều chỉnh. Không hoàn tác được.`}
        nhanXacNhan={boQuaKiemTra ? "Vẫn hoàn thành" : "Hoàn thành và cập nhật tồn"}
        iconXacNhan={CircleCheckBig}
        rong
        dangChay={dangChay}
        khoaXacNhan={dangKiemTra || !tt.soGui}
        lyDoKhoa={dangKiemTra ? "Đang kiểm tra giao dịch sau lúc đếm…" : !tt.soGui ? "Không còn lô nào để gửi" : undefined}
        tieuDiemQuayLai
        traTieuDiemVe={oTimRef}
        loi={loiHop}
        onXacNhan={hoanThanh}
      >
        {anLech ? (
          <div className={GHI_CHU_HOP}>
            <b className="tabular-nums">{soVN(tt.daDem)}/{soVN(tt.tong)}</b> lô đã đếm. Đang đếm mù nên nhân viên kho không thấy
            chênh lệch trước khi hoàn thành; kết quả hiện sau khi hoàn thành.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              { ma: "da", so: `${soVN(tt.daDem)}/${soVN(tt.tong)}`, nhan: "lô đã đếm" },
              { ma: "thua", so: `+${soVN(tt.spThua)}`, nhan: `thừa · ${soVN(tt.thua)} lô`, mau: "text-bo-primary-strong" },
              { ma: "thieu", so: `−${soVN(tt.spThieu)}`, nhan: `thiếu · ${soVN(tt.thieu)} lô`, mau: "text-bo-danger" },
            ].map((x) => (
              <div key={x.ma} className="rounded-md border border-bo-border bg-white px-2.5 py-2">
                <span className={cn("block text-lg font-semibold leading-6 tabular-nums text-bo-foreground", x.mau)}>{x.so}</span>
                <span className="block text-xs leading-4 text-bo-muted">{x.nhan}</span>
              </div>
            ))}
          </div>
        )}
        {tt.xen ? (
          <DongThongBao
            tone="warn"
            actions={
              <NutChu
                disabled={dangChay}
                onClick={() => {
                  setHop(null);
                  datLoc("xen");
                }}
              >
                Đếm lại các lô này
              </NutChu>
            }
          >
            {soVN(tt.xen)} lô có nhập hoặc xuất (kể cả bán tại quầy) sau lúc đếm nên không được gửi, tồn giữ nguyên.
          </DongThongBao>
        ) : null}
        {loiKiemTra && !boQuaKiemTra ? (
          <DongThongBao tone="warn">
            Chưa kiểm tra được giao dịch sau lúc đếm: {loiKiemTra}. Lô có nhập, xuất sau lúc đếm sẽ bị ghi đè bằng số đếm.
          </DongThongBao>
        ) : null}
        {mu && !anLech ? (
          <div className={GHI_CHU_HOP}>
            Bạn đang đếm mù nên đây là lúc đầu tiên thấy chênh lệch. Lô lệch nhiều nên cho đếm lại trước khi hoàn thành.
          </div>
        ) : null}
        {!anLech && tt.soLech ? (
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium leading-5 text-bo-foreground">Lệch nhiều nhất</span>
            <ul className={cn(GHI_CHU_HOP, "m-0 grid list-none gap-1.5")}>
              {tt.top.map((d) => (
                <li key={d.id} className="flex min-w-0 justify-between gap-3">
                  <span className="min-w-0 truncate" title={`${d.tenSanPham} · lô ${d.maLo}`}>
                    {d.tenSanPham} · lô {d.maLo}: {soVN(d.heThong)} → {soVN(d.so)}
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", d.loai === "thua" ? "text-bo-primary-strong" : "text-bo-danger")}>
                    {d.loai === "thua" ? `Thừa ${soVN(d.lech)}` : `Thiếu ${soVN(-d.lech)}`}
                  </span>
                </li>
              ))}
            </ul>
            <NutChu
              className="justify-self-start"
              disabled={dangChay}
              onClick={() => {
                setHop(null);
                setMuPhien(true);
                datLoc("lech");
              }}
            >
              Xem tất cả {soVN(tt.soLech)} lô lệch
            </NutChu>
          </div>
        ) : null}
        {tt.chua ? (
          <div className={GHI_CHU_HOP}>
            <b className="tabular-nums">{soVN(tt.chua)}</b> lô chưa đếm: không gửi, tồn giữ nguyên, ghi là Không đếm.
          </div>
        ) : null}
      </HopXacNhanChungTu>

      <HopXacNhanChungTu
        mo={hop === "dong"}
        onDoiMo={dongHop}
        tieuDe={`Đóng đợt ${ma}, không đổi tồn?`}
        moTa={`Đợt chuyển sang Hoàn thành, mọi lô ghi là Không đếm và tồn kho ở ${tenKho} giữ nguyên.`}
        nhanXacNhan="Đóng đợt"
        iconXacNhan={Archive}
        kieu="nguyHiem"
        dangChay={dangChay}
        traTieuDiemVe={oTimRef}
        loi={loiHop}
        onXacNhan={dongDot}
      >
        {dsDaDem.length ? (
          <div className={GHI_CHU_HOP}>
            Bạn có <b className="tabular-nums">{soVN(dsDaDem.length)}</b> số đếm trên máy này; đóng đợt thì các số này không được gửi.{" "}
            <NutChu onClick={taiCsvHienTai}>Tải số đếm (CSV)</NutChu>
          </div>
        ) : null}
      </HopXacNhanChungTu>

      <HopXacNhanChungTu
        mo={hop === "xoa"}
        onDoiMo={dongHop}
        tieuDe={`Xóa ${soVN(dsDaDem.length)} số đã đếm trên máy này?`}
        moTa="Các ô Thực tế trở về trống để đếm lại. Máy chủ và tồn kho không thay đổi."
        nhanXacNhan="Xóa số đã đếm"
        iconXacNhan={Eraser}
        kieu="nguyHiem"
        // Nút mở hộp ("Xóa và đếm lại" trong dòng thông báo) mất sau khi xóa: tiêu điểm về ô quét
        traTieuDiemVe={oTimRef}
        onXacNhan={xoaSoDem}
      />
    </PageContainer>
  );
}
