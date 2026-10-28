import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, PackagePlus, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { phanTrang, soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP } from "@/components/chung-tu/kieuHopThoai";
import BangHangYeuCauTao from "@/components/order/tao-yeu-cau/BangHangYeuCauTao";
import CotThongTinYeuCau from "@/components/order/tao-yeu-cau/CotThongTinYeuCau";
import HopDanExcel from "@/components/order/tao-yeu-cau/HopDanExcel";
import HopGoiYCanNhap from "@/components/order/tao-yeu-cau/HopGoiYCanNhap";
import LuoiNhapSoLuong from "@/components/order/tao-yeu-cau/LuoiNhapSoLuong";
import OTimThemHang from "@/components/order/tao-yeu-cau/OTimThemHang";
import {
  BO_LOC_BANG,
  boDong,
  canhBao,
  cauCanhBao,
  chenLaiDong,
  datSoLuong,
  demTheoDeXuat,
  docDeXuatDuongDan,
  doiOLuoi,
  doiSoLuongDong,
  dongBang as taoDongBang,
  homNayVN,
  idYeuCauMoi,
  khoaSanPham,
  laGoiY,
  lyDoKhoaGui,
  moTaNgayGiao,
  noiThuTuSanPham,
  roiOSoLuong,
  taoBodyYeuCau,
  taoChiMuc,
  themDong,
  themNhieu,
  theoNhomHang,
  theoSoDeXuat,
} from "@/components/order/tao-yeu-cau/tinhTaoYeuCau";
import { CO_TRANG_NHOM, NGUONG_CONG_CU } from "@/config/bangChungTu";
import useHoiKhiRoiTrang from "@/hooks/useHoiKhiRoiTrang";
import useQuayLai from "@/hooks/useQuayLai";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { khoService } from "@/services/khoService";
import purchaseRequestService from "@/services/purchaseRequestService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";

const TONG_THEO = Object.freeze({ soLuong: "soLuong", khaDung: "khaDung", dangVe: "dangVe", deXuat: "deXuat" });

// Cùng 5 bước với Chi tiết yêu cầu nhập hàng (tinhYeuCau.tinhBuocYeuCau), thêm dòng "ai làm"
const BUOC = [
  { ma: "tao", nhan: "Tạo yêu cầu", ai: "Bạn", trangThai: "dangLam", phu: "Đang lập" },
  { ma: "duyet", nhan: "Quản lý kho duyệt", ai: "Quản lý Kho tổng", trangThai: "chua" },
  { ma: "gui", nhan: "Gửi yêu cầu báo giá", ai: "Nhân viên mua hàng", trangThai: "chua" },
  { ma: "nhan", nhan: "Nhận báo giá", ai: "Nhà cung cấp", trangThai: "chua" },
  { ma: "chot", nhan: "Chốt đơn mua hàng", ai: "Nhân viên mua hàng", trangThai: "chua" },
];

const CACH_XEM = [
  { value: "danhSach", label: "Danh sách" },
  { value: "luoi", label: "Lưới màu × kích cỡ" },
];

/** Câu lỗi tải danh mục: 403 → thiếu quyền (Thử lại vô ích); mất kết nối; còn lại câu của máy chủ, bỏ dấu chấm cuối. */
function moTaLoiTai(e) {
  if (getApiErrorStatus(e) === 403) {
    return { chu: "tài khoản chưa có quyền lập yêu cầu nhập hàng ở kho đang làm việc (quyền “Lập yêu cầu và đơn mua hàng”)", khongQuyen: true };
  }
  if (!e?.response) return { chu: "không nhận được phản hồi từ máy chủ", khongQuyen: false };
  return { chu: getApiErrorMessage(e, "máy chủ báo lỗi").trim().replace(/[.。]+$/, ""), khongQuyen: false };
}

/**
 * Tạo yêu cầu nhập hàng (/purchase-requests/create) · khối chứng từ "một khối" như các màn tạo chứng từ khác (bản 2,
 * chốt 25/10/2026, canvas "Tạo yêu cầu nhập hàng – thiết kế lại").
 *
 * - Danh mục: GET /nghiep-vu/yeu-cau-mua-hang/hang-kho-tong — mọi mã nhập được kèm khả dụng, đang về, số đề xuất (quy tắc
 *   Cần mua ở Tổng quan), cờ còn dư, yêu cầu nhập đang mở. Một danh sách dùng cho ô tìm, Gợi ý cần nhập, Dán từ Excel.
 * - Thêm hàng: tìm / quét từng mã (quét lại cộng 1), "Thêm cả n biến thể", Gợi ý cần nhập (cả loạt theo số đề xuất),
 *   Dán từ Excel. Bảng gom theo sản phẩm (tìm, lọc Cần chú ý, thu gọn, phân trang theo config/bangChungTu.js), chọn nhiều
 *   để đặt số lượng / theo đề xuất / bỏ; hoặc nhập theo lưới màu × kích cỡ.
 * - Mã đang trong yêu cầu khác hay Kho tổng còn dư: chỉ cảnh báo, không chặn gửi.
 * - Gửi duyệt: POST /nghiep-vu/yeu-cau-mua-hang/create (máy chủ kiểm ngày giao, ghi chú, dòng hàng) → mở Chi tiết yêu cầu
 *   vừa tạo. Đang nhập dở mà rời trang thì hỏi trước. Điền sẵn từ Tổng quan: ?khoId=&bienTheId=&soLuong=&ten=
 */
export default function CreatePurchaseRequestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quayLai = useQuayLai("/purchase-requests");
  const oTimRef = useRef(null);
  const henSangRef = useRef(0);
  const dangGuiRef = useRef(false);
  const daDienSanRef = useRef(false);
  // Mỗi lần bỏ hàng loạt một thông báo Hoàn tác riêng; lần bỏ mới đóng thông báo cũ (chỉ hoàn tác được lần gần nhất)
  const hoanTacRef = useRef({ lan: 0, id: null });
  const dongRef = useRef([]);

  const [khoId, setKhoId] = useState(null);
  const [dong, setDong] = useState([]);
  const [ghimLuoi, setGhimLuoi] = useState([]); // sản phẩm giữ lại trên lưới dù chưa có số lượng nào
  const [thuTuSp, setThuTuSp] = useState([]); // thứ tự sản phẩm theo lần thêm đầu tiên (noiThuTuSanPham)
  const [cheDo, setCheDo] = useState("danhSach");
  const [trangLuoi, setTrangLuoi] = useState(0);
  const [coTrangLuoi, setCoTrangLuoi] = useState(CO_TRANG_NHOM[0]);
  const [chon, setChon] = useState(() => new Set());
  const [ngayGiao, setNgayGiao] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [hop, setHop] = useState(""); // "" | "goiY" | "dan" | "gui"
  const [hoiRoi, setHoiRoi] = useState(null);
  const [dangGui, setDangGui] = useState(false);
  const [loiGui, setLoiGui] = useState(null);
  const [daGui, setDaGui] = useState(false);
  const [dongSang, setDongSang] = useState(null);
  const [lanSang, setLanSang] = useState(0); // quét lại cùng mã trong lúc còn tô sáng vẫn đưa bảng tới dòng đó
  const [dienSan, setDienSan] = useState(null); // { soMa, coSoLuong, khongThay, ten, khoDeXuat, khoDeXuatTen }

  useEffect(() => {
    const henSang = henSangRef;
    const hoanTac = hoanTacRef;
    return () => {
      clearTimeout(henSang.current);
      // Rời trang thì Hoàn tác không còn tác dụng: đóng luôn thông báo
      if (hoanTac.current.id) toast.dismiss(hoanTac.current.id);
    };
  }, []);
  // Dòng mới nhất cho nút Hoàn tác (bấm sau nhiều lần render): biết mã nào thật sự được chèn lại
  useEffect(() => { dongRef.current = dong; }, [dong]);

  // ── Danh mục hàng Kho tổng ──
  const taiHang = useCallback(async () => {
    const res = await purchaseRequestService.hangKhoTong(khoId);
    return res?.data?.data ?? null;
  }, [khoId]);
  const q = useTaiDuLieu(taiHang, `hang-kho-tong-${khoId ?? "mac-dinh"}`);
  const duLieu = q.data ?? null;
  const dsHang = useMemo(() => duLieu?.bienThe ?? [], [duLieu]);
  const chiMuc = useMemo(() => taoChiMuc(dsHang), [dsHang]);
  const kho = duLieu?.kho ?? null;
  // Dữ liệu đang giữ là của kho khác kho vừa chọn (đổi Kho tổng mà chưa tải xong hoặc tải lỗi): khả dụng, đề xuất đang
  // là số của kho cũ → khóa gửi và các thao tác lấy số đề xuất; lỗi thì báo kèm Thử lại. So theo kho trong dữ liệu (không
  // theo khóa tải) nên quay về đúng kho đang hiện thì không khóa oan.
  const duLieuCu = Boolean(duLieu) && khoId != null && String(duLieu.kho?.id) !== String(khoId);
  // Kể cả khoảnh khắc trước khi lượt tải mới bắt đầu (loading chưa bật): chưa có lỗi thì coi như đang tải
  const dangTaiKho = duLieuCu && !q.error;
  const loiTai = q.error && (!duLieu || duLieuCu) ? moTaLoiTai(q.error) : null;

  // ── Điền sẵn từ đường dẫn (một lần, khi danh mục tải xong) ──
  useEffect(() => {
    if (!duLieu || daDienSanRef.current) return;
    daDienSanRef.current = true;
    const deXuat = docDeXuatDuongDan(searchParams, chiMuc, duLieu.dsKhoTong);
    if (!deXuat) return;
    queueMicrotask(() => {
      if (deXuat.dong) setDong((cu) => themNhieu(cu, [deXuat.dong], "giu").dong);
      // Đề xuất cho một Kho tổng khác Kho tổng mặc định: chọn đúng kho đó (danh mục tải lại theo kho)
      if (deXuat.khoTong && deXuat.khoTong !== String(duLieu.kho?.id)) setKhoId(Number(deXuat.khoTong));
      setDienSan({
        soMa: deXuat.dong ? 1 : 0, coSoLuong: deXuat.coSoLuong, khongThay: deXuat.khongThay,
        ten: deXuat.ten || (deXuat.dong ? chiMuc.theoId.get(String(deXuat.dong.bienTheId))?.tenSanPham : null) || null,
        khoDeXuat: deXuat.khoDeXuat, khoDeXuatTen: null,
      });
    });
    // Kho bán hàng trong đề xuất: lấy tên để giải thích (không lấy được thì ghi chung "kho bán hàng")
    if (deXuat.khoDeXuat) {
      khoService.getById(deXuat.khoDeXuat)
        .then((res) => {
          const ten = res?.data?.data?.tenKho || res?.data?.tenKho;
          if (ten) setDienSan((cu) => (cu ? { ...cu, khoDeXuatTen: ten } : cu));
        })
        .catch(() => {});
    }
  }, [duLieu, chiMuc, searchParams]);

  // ── Bảng hàng ──
  // Thứ tự sản phẩm theo lần thêm đầu tiên, chỉ nối thêm: bỏ dòng đầu của một sản phẩm (hay xóa ô trên lưới) thì
  // sản phẩm đó không nhảy chỗ; sản phẩm mới chưa kịp ghi thì dongBang cũng xếp cuối nên không bị nháy thứ tự
  useEffect(() => {
    if (noiThuTuSanPham(thuTuSp, dong.map((d) => d.bienTheId), chiMuc) === thuTuSp) return;
    queueMicrotask(() => setThuTuSp((cu) => noiThuTuSanPham(cu, dong.map((d) => d.bienTheId), chiMuc)));
  }, [dong, chiMuc, thuTuSp]);
  const dongB = useMemo(() => taoDongBang(dong, chiMuc, thuTuSp), [dong, chiMuc, thuTuSp]);
  const bang = useBangChungTu(dongB, { boLoc: BO_LOC_BANG, tongTheo: TONG_THEO });
  const { denDong } = bang;

  // Vừa thêm / quét một mã: đưa bảng tới trang và nhóm có mã đó
  useEffect(() => {
    if (dongSang == null || cheDo !== "danhSach") return;
    queueMicrotask(() => denDong(dongSang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dongSang, lanSang]);

  const toSang = (bienTheId) => {
    setDongSang(bienTheId);
    setLanSang((n) => n + 1);
    clearTimeout(henSangRef.current);
    henSangRef.current = setTimeout(() => setDongSang(null), 1200);
  };

  // Lưới: sản phẩm có hàng hoặc được giữ lại dù chưa có số lượng, cùng thứ tự với bảng
  const spLuoi = useMemo(() => {
    const coHang = new Set();
    const theoBang = [];
    dongB.forEach((d) => {
      const bt = chiMuc.theoId.get(String(d.id));
      if (!bt) return;
      coHang.add(khoaSanPham(bt));
      theoBang.push(khoaSanPham(bt));
    });
    return [...new Set([...thuTuSp, ...theoBang, ...ghimLuoi])]
      .filter((k) => (coHang.has(k) || ghimLuoi.includes(k)) && chiMuc.theoSanPham.has(k));
  }, [dongB, ghimLuoi, thuTuSp, chiMuc]);
  const catLuoi = phanTrang(spLuoi, trangLuoi, spLuoi.length > NGUONG_CONG_CU ? coTrangLuoi : Infinity);
  const sanPhamLuoi = catLuoi.muc.map((k) => ({ khoa: k, bienThe: chiMuc.theoSanPham.get(k) ?? [] }));
  // Đưa lưới tới trang có sản phẩm vừa thêm: vị trí theo thứ tự sản phẩm SAU khi thêm (sản phẩm đã từng có thì về
  // chỗ cũ, không phải cuối)
  const denTrangLuoi = (bienTheId) => {
    const bt = chiMuc.theoId.get(String(bienTheId));
    if (!bt) return;
    const khoa = khoaSanPham(bt);
    const thuTuMoi = noiThuTuSanPham(thuTuSp, [bienTheId], chiMuc);
    const sauKhiThem = [...new Set([...thuTuMoi, ...spLuoi])].filter((k) => k === khoa || spLuoi.includes(k));
    const viTri = sauKhiThem.indexOf(khoa);
    if (viTri >= 0 && sauKhiThem.length > NGUONG_CONG_CU) setTrangLuoi(Math.floor(viTri / coTrangLuoi));
  };

  // ── Thêm, sửa, bỏ ──
  const themMot = (bt) => {
    setDong((cu) => themDong(cu, bt.bienTheId, 1));
    toSang(bt.bienTheId);
    if (cheDo === "luoi") denTrangLuoi(bt.bienTheId);
  };

  const themCaSanPham = (khoa) => {
    const caSp = chiMuc.theoSanPham.get(khoa) ?? [];
    const co = new Set(dong.map((d) => String(d.bienTheId)));
    const ds = caSp.filter((bt) => !co.has(String(bt.bienTheId)));
    if (!ds.length) {
      if (caSp[0]) toast.info(`Đã có đủ ${soVN(caSp.length)} biến thể của ${caSp[0].tenSanPham} trong yêu cầu`);
      return;
    }
    // Mã sắp hết lấy theo số đề xuất, mã còn hàng để 1 cho người lập sửa (số đề xuất đang là của kho cũ thì để 1 cả)
    const theoDeXuat = (bt) => !duLieuCu && bt.soLuongDeXuat > 0;
    setDong((cu) => themNhieu(cu, ds.map((bt) => ({ bienTheId: bt.bienTheId, soLuong: theoDeXuat(bt) ? bt.soLuongDeXuat : 1 })), "giu").dong);
    toSang(ds[0].bienTheId);
    if (cheDo === "luoi") denTrangLuoi(ds[0].bienTheId);
    toast.success(`Đã thêm ${soVN(ds.length)} biến thể của ${ds[0].tenSanPham}`, {
      description: duLieuCu ? "Mỗi mã 1 (đang tải số liệu của kho vừa chọn)." : "Mã sắp hết lấy theo số đề xuất, còn lại mỗi mã 1.",
      ...(cheDo === "luoi" ? {} : { action: { label: "Nhập theo lưới", onClick: () => doiCheDo("luoi") } }),
    });
  };

  const themGoiY = (ids) => {
    const ds = ids.map((id) => chiMuc.theoId.get(String(id))).filter(Boolean);
    const kq = themNhieu(dong, ds.map((bt) => ({ bienTheId: bt.bienTheId, soLuong: bt.soLuongDeXuat })), "giu");
    setDong(kq.dong);
    setHop("");
    if (cheDo !== "danhSach") doiCheDo("danhSach");
    if (ds[0]) toSang(ds[0].bienTheId);
    toast.success(`Đã thêm ${soVN(kq.moi)} mã theo số đề xuất`, {
      description: `Tổng ${soVN(ds.reduce((s, bt) => s + Number(bt.soLuongDeXuat || 0), 0))}. Sửa từng dòng, hoặc chọn nhiều dòng để đặt số lượng một lần.`,
    });
  };

  const themDan = (dsDan, cach, soLoi) => {
    const kq = themNhieu(dong, dsDan, cach);
    setDong(kq.dong);
    setHop("");
    if (dsDan[0]) toSang(dsDan[0].bienTheId);
    const chu = [
      kq.moi ? `${soVN(kq.moi)} mã mới` : "",
      kq.capNhat ? `${cach === "thay" ? "thay số lượng" : "cộng thêm"} ${soVN(kq.capNhat)} mã đã có` : "",
    ].filter(Boolean).join(", ");
    const cau = `Đã thêm từ danh sách dán: ${chu || "không có mã mới"}`;
    if (soLoi) toast.warning(cau, { description: `Bỏ qua ${soVN(soLoi)} dòng lỗi.` });
    else toast.success(cau);
  };

  /**
   * Bỏ các mã `ids`. `hoanTac`: hiện thông báo có nút Hoàn tác (bỏ hàng loạt). Hoàn tác chỉ chèn lại đúng các dòng vừa bỏ
   * (chenLaiDong) — số đã sửa và mã thêm sau lần bỏ vẫn giữ; lần bỏ mới đóng thông báo cũ, mỗi lần một id riêng nên
   * hai lần bỏ không bị gộp thành một thông báo.
   */
  const boNhieu = (ids, { hoanTac = true } = {}) => {
    if (!ids.length) return;
    const xoa = new Set(ids.map(String));
    const daBo = dong.filter((d) => xoa.has(String(d.bienTheId)));
    if (!daBo.length) return;
    const daChonTruoc = daBo.map((d) => String(d.bienTheId)).filter((id) => chon.has(id));
    const conLai = boDong(dong, ids);
    // Còn ít dòng thì ô tìm trong bảng ẩn đi: bỏ từ khóa để không giấu dòng mà không có cách bỏ lọc
    if (conLai.length <= NGUONG_CONG_CU) { bang.xoaTuKhoa(); bang.xoaLoc(); }
    setDong(conLai);
    setChon((s) => { const moi = new Set(s); xoa.forEach((id) => moi.delete(id)); return moi; });
    // Nút vừa bấm (thùng rác, Bỏ khỏi yêu cầu…) biến mất cùng dòng: đưa tiêu điểm về ô tìm, không cuộn trang
    setTimeout(() => {
      const el = document.activeElement;
      if (!el || el === document.body || !el.isConnected) oTimRef.current?.focus({ preventScroll: true });
    }, 0);
    if (!hoanTac) return;
    if (hoanTacRef.current.id) toast.dismiss(hoanTacRef.current.id);
    const lan = hoanTacRef.current.lan + 1;
    const id = `hoan-tac-bo-${lan}`;
    hoanTacRef.current = { lan, id };
    toast.success(`Đã bỏ ${soVN(daBo.length)} biến thể khỏi yêu cầu`, {
      id,
      action: {
        label: "Hoàn tác",
        onClick: () => {
          const coSan = new Set(dongRef.current.map((d) => String(d.bienTheId)));
          const chenLai = new Set(daBo.map((d) => String(d.bienTheId)).filter((id) => !coSan.has(id)));
          setDong((cu) => chenLaiDong(cu, daBo));
          // Mã người dùng đã tự thêm lại sau lần bỏ thì giữ nguyên, không tích chọn theo
          setChon((s) => new Set([...s, ...daChonTruoc.filter((id) => chenLai.has(id))]));
        },
      },
    });
  };

  const doiChon = (ids, co) => setChon((s) => {
    const moi = new Set(s);
    ids.forEach((id) => (co ? moi.add(String(id)) : moi.delete(String(id))));
    return moi;
  });

  const datSoLuongChon = (ids, sl) => {
    setDong((cu) => datSoLuong(cu, ids, sl));
    toast.success(`Đã đặt số lượng ${soVN(sl)} cho ${soVN(ids.length)} dòng`);
  };

  const theoDeXuatChon = (ids) => {
    const kq = theoSoDeXuat(dong, ids, chiMuc.theoId);
    setDong(kq.dong);
    toast.success(`Đã đưa ${soVN(kq.dat)} dòng về số đề xuất`, {
      description: kq.khong ? `Giữ nguyên ${soVN(kq.khong)} dòng chưa có số đề xuất (Kho tổng chưa dưới ngưỡng).` : undefined,
    });
  };

  const doiOLuoiCua = (bienTheId, chu) => {
    const moi = doiOLuoi(dong, bienTheId, chu);
    if (moi === dong) return;
    // Xóa hết số của một sản phẩm trên lưới: vẫn giữ sản phẩm đó trên lưới để gõ lại
    const bt = chiMuc.theoId.get(String(bienTheId));
    if (bt) setGhimLuoi((cu) => (cu.includes(khoaSanPham(bt)) ? cu : [...cu, khoaSanPham(bt)]));
    setDong(moi);
  };

  const boSanPhamLuoi = (khoa) => {
    const ids = (chiMuc.theoSanPham.get(khoa) ?? []).map((bt) => bt.bienTheId)
      .filter((id) => dong.some((d) => String(d.bienTheId) === String(id)));
    setGhimLuoi((cu) => cu.filter((k) => k !== khoa));
    boNhieu(ids);
  };

  function doiCheDo(moi) {
    setCheDo(moi);
    setChon(new Set());
    if (moi === "danhSach") setGhimLuoi([]);
    else setTrangLuoi(0);
  }

  const doiKho = (id) => {
    setKhoId(id ? Number(id) : null);
    setChon(new Set());
  };

  // ── Tính toán hiển thị ──
  const homNay = homNayVN();
  const cb = useMemo(() => canhBao(dong, chiMuc), [dong, chiMuc]);
  const lyDo = daGui
    ? ""
    : loiTai
      ? "Chưa tải được danh sách hàng"
      : lyDoKhoaGui({ dangTai: q.initialLoading || dangTaiKho, coKho: Boolean(kho), dong, chiMuc, ngayGiao, homNay });
  const soGoiYMoi = useMemo(() => {
    const co = new Set(dong.map((d) => String(d.bienTheId)));
    return dsHang.filter((bt) => laGoiY(bt) && !bt.yeuCauMo && !co.has(String(bt.bienTheId))).length;
  }, [dsHang, dong]);
  // Dòng không còn trong danh mục (mã vừa ngừng kinh doanh): chỉ bỏ được, không gửi được
  const maNgung = useMemo(
    () => dong.filter((d) => !chiMuc.theoId.has(String(d.bienTheId))).map((d) => d.bienTheId),
    [dong, chiMuc],
  );
  const tomTat = {
    soSp: bang.tong.soSanPham,
    soDong: bang.tong.soDong,
    tongSl: bang.tong.soLuong,
    theoDeXuat: demTheoDeXuat(dong, chiMuc),
    soChuY: cb.soChuY,
    theoNhom: theoNhomHang(dong, chiMuc),
  };
  const khoa = dangGui || daGui;

  // ── Rời trang ──
  const coThayDoi = !daGui && (dong.length > 0 || ghiChu.trim() !== "" || ngayGiao !== "");
  useHoiKhiRoiTrang(coThayDoi && !dangGui, (tiepTuc) => setHoiRoi(() => tiepTuc));
  const veDanhSach = () => {
    // Đang nhập dở: hỏi rồi mở danh sách (không lùi lịch sử, vì lùi sẽ bị bộ chặn nút Back hỏi thêm lần nữa)
    if (coThayDoi) setHoiRoi(() => () => navigate("/purchase-requests"));
    else quayLai();
  };

  // ── Gửi duyệt ──
  const moGui = () => {
    if (lyDo || dangGui) return;
    setLoiGui(null);
    setHop("gui");
  };

  async function gui() {
    if (dangGuiRef.current || lyDo) return; // chặn bấm đúp (state chỉ cập nhật ở lần render sau)
    dangGuiRef.current = true;
    setDangGui(true);
    setLoiGui(null);
    try {
      const res = await purchaseRequestService.create(taoBodyYeuCau({ khoNhapId: kho.id, ngayGiao, ghiChu }, dong));
      const id = idYeuCauMoi(res?.data);
      setDaGui(true);
      setHop("");
      toast.success("Đã gửi yêu cầu nhập hàng chờ duyệt", { description: res?.data?.data?.soYeuCauMuaHang || undefined });
      // Thay mục lịch sử: Quay lại ở chi tiết về danh sách, không về biểu mẫu đã gửi
      navigate(id != null ? `/purchase-requests/${id}` : "/purchase-requests", { replace: true });
    } catch (e) {
      setLoiGui(e?.response
        ? getApiErrorMessage(e, "Máy chủ không xử lý được yêu cầu, vui lòng thử lại")
        : "Không nhận được phản hồi từ máy chủ. Kiểm tra kết nối rồi thử lại.");
    } finally {
      dangGuiRef.current = false;
      setDangGui(false);
    }
  }

  // ── Dòng thông báo ──
  const thongBao = [
    loiTai ? (
      <DongThongBao key="loi-tai" tone="bad" actions={loiTai.khongQuyen ? undefined : <NutChu onClick={q.reload}>Thử lại</NutChu>}>
        Không tải được danh sách hàng: {loiTai.chu}.
      </DongThongBao>
    ) : null,
    duLieu && !kho ? (
      <DongThongBao key="khong-kho" tone="bad">
        Chưa có Kho tổng đang hoạt động để nhận hàng từ nhà cung cấp. Vào Quản lý kho để đặt một kho làm Kho tổng.
      </DongThongBao>
    ) : null,
    dienSan?.soMa ? (
      <DongThongBao key="dien-san" tone="info">
        Đã điền sẵn <b className="font-semibold">1 mã</b>{dienSan.ten ? <> của <b className="font-semibold">{dienSan.ten}</b></> : null}
        {dienSan.coSoLuong
          ? <> theo đề xuất <b className="font-semibold">Cần bổ sung</b> ở Tổng quan, kèm số lượng đề xuất.</>
          : ", số lượng tạm để 1."}{" "}
        Kiểm tra lại, chọn ngày giao dự kiến rồi gửi duyệt.
        {soGoiYMoi ? <> Còn {soVN(soGoiYMoi)} mã sắp hết khác ở <NutChu onClick={() => setHop("goiY")}>Gợi ý cần nhập</NutChu>.</> : null}
      </DongThongBao>
    ) : null,
    dienSan?.khongThay ? (
      <DongThongBao key="khong-thay" tone="warn">
        Không tìm thấy {dienSan.ten ? <b className="font-semibold">{dienSan.ten}</b> : "sản phẩm trong đề xuất"} trong danh sách
        hàng nhập được (có thể đã ngừng kinh doanh). Tìm và thêm sản phẩm ở ô phía dưới.
      </DongThongBao>
    ) : null,
    maNgung.length && !daGui ? (
      <DongThongBao
        key="ma-ngung"
        tone="bad"
        actions={<NutChu onClick={() => boNhieu(maNgung)}>Bỏ {soVN(maNgung.length)} mã</NutChu>}
      >
        {soVN(maNgung.length)} mã không còn trong danh sách hàng nhập được (vừa ngừng kinh doanh). Bỏ các mã này rồi mới gửi
        duyệt được.
      </DongThongBao>
    ) : null,
    cb.soChuY && !daGui ? (
      <DongThongBao
        key="canh-bao"
        tone="warn"
        actions={(
          <>
            {bang.coCongCu ? (
              <NutChu onClick={() => { doiCheDo("danhSach"); bang.datLoc("chuY"); }}>Xem {soVN(cb.soChuY)} mã</NutChu>
            ) : null}
            {cb.trung.length ? <NutChu onClick={() => boNhieu(cb.trung)}>Bỏ {soVN(cb.trung.length)} mã trùng</NutChu> : null}
          </>
        )}
      >
        {cauCanhBao(cb)}
      </DongThongBao>
    ) : null,
  ].filter(Boolean);

  // ── Thân ──
  const nutXem = (
    <NutPhanDoan nhan="Cách nhập số lượng" value={cheDo} luaChon={CACH_XEM} onChange={doiCheDo} />
  );
  // Lưới vẫn hiện (kèm nút đổi cách xem) khi còn dòng mà mọi dòng đều là mã vừa ngừng, để người dùng quay về Danh sách
  const coBang = dong.length > 0 || (cheDo === "luoi" && spLuoi.length > 0);

  const chinh = (
    <>
      <div className="flex flex-wrap items-start gap-2 px-4 pb-3 pt-4 sm:px-6">
        <OTimThemHang
          dsHang={dsHang}
          chiMuc={chiMuc}
          dong={dong}
          khoa={khoa || !kho}
          onThem={themMot}
          onThemCa={themCaSanPham}
          oRef={oTimRef}
          chuTrong={q.initialLoading ? "Đang tải danh sách hàng…" : loiTai ? "Chưa tải được danh sách hàng." : undefined}
          className="basis-80"
        />
        <Button
          type="button"
          variant="outline"
          disabled={khoa || !kho || duLieuCu}
          onClick={() => setHop("goiY")}
          className="gap-1.5 border-bo-border bg-bo-surface text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
        >
          <Sparkles className="size-4 text-bo-primary" aria-hidden="true" />
          Gợi ý cần nhập
          {soGoiYMoi ? (
            <span className="min-w-5 rounded-full bg-bo-primary px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">
              {soVN(soGoiYMoi)}
            </span>
          ) : null}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={khoa || !kho}
          onClick={() => setHop("dan")}
          className="gap-1.5 border-bo-border bg-bo-surface text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
        >
          <ClipboardList className="size-4" aria-hidden="true" />
          Dán từ Excel
        </Button>
      </div>

      {!coBang ? (
        <EmptyState
          icon={PackagePlus}
          title="Chưa có sản phẩm nào"
          description={soGoiYMoi
            ? `${kho?.tenKho || "Kho tổng"} đang có ${soVN(soGoiYMoi)} mã hết hoặc sắp hết. Lấy cả loạt theo số đề xuất, dán danh sách từ Excel, hoặc tìm / quét từng mã ở ô phía trên.`
            : "Tìm hoặc quét từng mã ở ô phía trên (quét lại cùng mã cộng thêm 1), hoặc dán danh sách SKU – số lượng từ Excel."}
          action={soGoiYMoi && !khoa && !duLieuCu ? (
            <Button type="button" onClick={() => setHop("goiY")} className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover">
              <Sparkles className="size-4" aria-hidden="true" />
              Xem {soVN(soGoiYMoi)} mã cần nhập
            </Button>
          ) : null}
          className="min-h-[300px] flex-1"
        />
      ) : cheDo === "danhSach" ? (
        <BangHangYeuCauTao
          bang={bang}
          dongTatCa={dongB}
          chon={chon}
          onDoiChon={doiChon}
          onDoiSoLuong={(id, chu) => setDong((cu) => doiSoLuongDong(cu, id, chu))}
          onRoiSoLuong={(id) => setDong((cu) => roiOSoLuong(cu, id))}
          onBo={(id) => boNhieu([id], { hoanTac: false })}
          onDatSoLuong={datSoLuongChon}
          onTheoDeXuat={theoDeXuatChon}
          soLieuCu={duLieuCu}
          onBoNhieu={boNhieu}
          dongSang={dongSang}
          khoa={khoa}
          nutXem={nutXem}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 sm:px-6">
            {nutXem}
            <span className="text-xs leading-4 text-bo-muted">Nhập nhanh cả dải màu, cỡ của từng sản phẩm</span>
          </div>
          <LuoiNhapSoLuong
            sanPham={sanPhamLuoi}
            dong={dong}
            onDoiO={doiOLuoiCua}
            onBoSanPham={boSanPhamLuoi}
            khoa={khoa}
            phanTrang={catLuoi.soTrang > 1 || spLuoi.length > NGUONG_CONG_CU ? {
              page: catLuoi.trang,
              size: coTrangLuoi,
              total: catLuoi.tong,
              onPageChange: setTrangLuoi,
              onSizeChange: (n) => { setCoTrangLuoi(n); setTrangLuoi(0); },
              sizeOptions: CO_TRANG_NHOM,
              sizeLabel: "sản phẩm",
              totalLabel: "sản phẩm",
            } : null}
          />
        </>
      )}
    </>
  );

  const moTaNgay = moTaNgayGiao(ngayGiao, homNay);

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        className="overflow-visible"
        dau={
          <DauChungTu
            ma="Tạo yêu cầu nhập hàng"
            // Dính khi cuộn từ 768px (điện thoại: đầu khối cao gần nửa màn, dính sẽ che bảng)
            className="rounded-t-lg bg-white shadow-[0_1px_0_var(--color-bo-border)] md:sticky md:top-0 md:z-20"
            dongPhu={dong.length
              ? [
                <b key="sp" className="font-semibold text-bo-foreground">
                  {soVN(bang.tong.soSanPham)} sản phẩm · {soVN(bang.tong.soDong)} biến thể
                </b>,
                <span key="sl">tổng số lượng <b className="font-semibold text-bo-foreground">{soVN(bang.tong.soLuong)}</b></span>,
              ]
              : "Chọn hàng cần nhập về Kho tổng và ngày giao dự kiến, rồi gửi quản lý kho duyệt"}
            onQuayLai={veDanhSach}
            nhanQuayLai="Quay lại danh sách yêu cầu nhập hàng"
            menu={[{
              ma: "bo-het",
              nhan: "Bỏ tất cả hàng trong yêu cầu",
              moTa: dong.length ? `Bỏ ${soVN(dong.length)} biến thể, hoàn tác được ngay sau đó` : "Chưa có hàng nào",
              icon: Trash2,
              nguyHiem: true,
              khoa: !dong.length || khoa,
              onSelect: () => { setGhimLuoi([]); boNhieu(dong.map((d) => d.bienTheId)); },
            }]}
            nutChinh={{
              ma: "gui",
              nhan: "Gửi duyệt",
              icon: Send,
              onClick: moGui,
              khoa: Boolean(lyDo) || khoa,
              lyDo: lyDo || undefined,
              hienLyDo: true,
              dangChay: dangGui,
            }}
          />
        }
        tienTrinh={<TienTrinhChungTu buoc={BUOC} nhan="Các bước của yêu cầu nhập hàng" className="border-t-0" />}
        thongBao={thongBao.length ? thongBao : null}
        chinh={chinh}
        cotPhai={(
          <CotThongTinYeuCau
            kho={kho}
            khoChon={khoId}
            dangTaiKho={dangTaiKho}
            dsKhoTong={duLieu?.dsKhoTong ?? []}
            onDoiKho={doiKho}
            khoDeXuatTen={dienSan?.khoDeXuat ? (dienSan.khoDeXuatTen || "kho bán hàng đã chọn") : null}
            ngayGiao={ngayGiao}
            onDoiNgay={setNgayGiao}
            ghiChu={ghiChu}
            onDoiGhiChu={setGhiChu}
            khoa={khoa}
            tomTat={tomTat}
            homNay={homNay}
          />
        )}
      />

      <HopGoiYCanNhap
        mo={hop === "goiY"}
        onDoiMo={(mo) => { if (!mo) setHop(""); }}
        dsHang={dsHang}
        dong={dong}
        tenKho={kho?.tenKho}
        nguong={duLieu?.nguongMacDinh}
        onThem={themGoiY}
        traTieuDiemVe={oTimRef}
      />
      <HopDanExcel
        mo={hop === "dan"}
        onDoiMo={(mo) => { if (!mo) setHop(""); }}
        chiMuc={chiMuc}
        dong={dong}
        onThem={themDan}
        traTieuDiemVe={oTimRef}
      />
      <HopXacNhanChungTu
        mo={hop === "gui"}
        onDoiMo={(mo) => { if (!mo && !dangGui) { setHop(""); setLoiGui(null); } }}
        tieuDe="Gửi yêu cầu nhập hàng"
        moTa={`${soVN(bang.tong.soSanPham)} sản phẩm, ${soVN(bang.tong.soDong)} biến thể, tổng số lượng ${soVN(bang.tong.soLuong)} nhập về ${kho?.tenKho || "Kho tổng"}, giao dự kiến ${moTaNgay.trai}.`}
        nhanXacNhan="Gửi duyệt"
        iconXacNhan={Send}
        dangChay={dangGui}
        khoaXacNhan={Boolean(lyDo)}
        lyDoKhoa={lyDo || undefined}
        loi={loiGui}
        // Máy quét gửi Enter sau mỗi mã: tiêu điểm đầu ở "Quay lại" để một lần quét không bấm nhầm Gửi duyệt; đóng hộp
        // thì về ô tìm để quét tiếp
        tieuDiemQuayLai
        traTieuDiemVe={oTimRef}
        onXacNhan={gui}
      >
        <div className={GHI_CHU_HOP}>
          Yêu cầu chuyển sang <b className="font-semibold">Chờ duyệt</b>. Quản lý Kho tổng duyệt xong thì nhân viên mua hàng
          mới gửi được yêu cầu báo giá cho nhà cung cấp.
        </div>
        {cb.soChuY ? (
          <div className="rounded-lg border border-orange-200 bg-bo-warning-soft px-3 py-2.5 text-[13px] leading-5 text-orange-900">
            Lưu ý: {cauCanhBao(cb)}
          </div>
        ) : null}
      </HopXacNhanChungTu>
      <HopXacNhanChungTu
        mo={Boolean(hoiRoi)}
        onDoiMo={(mo) => { if (!mo) setHoiRoi(null); }}
        tieuDe="Rời trang tạo yêu cầu?"
        moTa={dong.length
          ? `${soVN(dong.length)} biến thể đã chọn, ngày giao và ghi chú đang nhập chưa được gửi sẽ mất.`
          : "Ngày giao và ghi chú đang nhập chưa được gửi sẽ mất."}
        nhanXacNhan="Rời trang"
        kieu="nguyHiem"
        onXacNhan={() => {
          const tiepTuc = hoiRoi;
          setHoiRoi(null);
          tiepTuc?.();
        }}
      />
    </PageContainer>
  );
}
