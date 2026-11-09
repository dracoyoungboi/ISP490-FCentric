/*
 * Logic thuần của popup Chi tiết kho (PA2 "Một khối", chốt 18/10/2026).
 * Không import alias "@/..." để chạy được bằng `node --test`.
 */
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../../utils/formatters.js";
import { mucDay, toneMucDay } from "../../constants/nhapKho.js";
// Kho giao dịch (đang hoạt động, không phải kho ảo): Báo cáo tồn kho và Vị trí kệ chỉ mở được loại kho này.
import { laKhoAo, laKhoGiaoDich } from "../../utils/kho.js";
import { t } from "../../i18n/t.js";

const so = (n) => formatNumber(Number(n) || 0);

/** Mức đầy hiển thị: "78% · Sắp đầy", "100% · Đầy", "55% đã dùng". */
export function nhanMucDay(phanTram, tone) {
  if (tone === "bad") return t("{{phanTram}}% · Đầy", { phanTram });
  if (tone === "warn") return t("{{phanTram}}% · Sắp đầy", { phanTram });
  return t("{{phanTram}}% đã dùng", { phanTram });
}

const soSanhMa = (a, b) => String(a ?? "").localeCompare(String(b ?? ""), "vi", { numeric: true });

/**
 * Gộp vị trí kệ theo khu. Sức chứa và đang chứa chỉ tính vị trí đang dùng được (bỏ vị trí bảo trì),
 * để % đầy không bị kéo thấp bởi kệ đang sửa. Khu chưa có vị trí nào: 0%, không có thanh mức.
 * @returns {{ khu: Array, tong: { soKhu, soViTri, soBaoTri, sucChua, dangChua, phanTram, tone, coKe } }}
 */
export function gopKhuVuc(khuVucs = [], viTris = []) {
  const theoKhu = new Map();
  for (const v of viTris ?? []) {
    const id = v?.khuVucId;
    if (!theoKhu.has(id)) theoKhu.set(id, []);
    theoKhu.get(id).push(v);
  }

  const tinh = (ds) => {
    const dung = ds.filter((v) => v?.trangThai !== "BAO_TRI");
    const sucChua = dung.reduce((tg, v) => tg + (Number(v.sucChua) || 0), 0);
    const dangChua = dung.reduce((tg, v) => tg + (Number(v.dangChua) || 0), 0);
    const muc = mucDay(dangChua, sucChua);
    return {
      soViTri: ds.length,
      soBaoTri: ds.length - dung.length,
      sucChua,
      dangChua,
      // Làm tròn xuống để số khớp màu: 99,6% hiện "99% · Sắp đầy" (chưa đầy), 69,8% hiện "69%" (chưa tới ngưỡng 70%)
      phanTram: Math.floor(muc * 100),
      tone: sucChua > 0 ? toneMucDay(muc) : "",
    };
  };

  const khu = [...(khuVucs ?? [])]
    .sort((a, b) => soSanhMa(a?.maKhuVuc, b?.maKhuVuc))
    .map((k) => {
      const tg = tinh(theoKhu.get(k.id) ?? []);
      return {
        id: k.id,
        ma: k.maKhuVuc || "—",
        ten: k.tenKhuVuc || k.maKhuVuc || "—",
        loai: k.loaiKhu || "",
        ...tg,
        coThanh: tg.sucChua > 0,
        nhanMuc: tg.sucChua > 0 ? nhanMucDay(tg.phanTram, tg.tone) : t("Chưa có vị trí"),
      };
    });

  const tong = tinh(viTris ?? []);
  return {
    khu,
    tong: { ...tong, soKhu: khu.length, coKe: khu.length > 0 && tong.soViTri > 0 },
  };
}

/** "4 khu · 96 vị trí · 2 bảo trì" */
export function tomTatKe(tong) {
  if (!tong || tong.soKhu === 0) return "";
  const phan = [
    t("{{soKhu}} khu", { count: Number(tong.soKhu) || 0, soKhu: so(tong.soKhu) }),
    t("{{soViTri}} vị trí", { count: Number(tong.soViTri) || 0, soViTri: so(tong.soViTri) }),
  ];
  if (tong.soBaoTri > 0) phan.push(t("{{soBaoTri}} bảo trì", { soBaoTri: so(tong.soBaoTri) }));
  return phan.join(" · ");
}

/**
 * Bốn ô số (kho ảo: ba ô). Mỗi ô: { khoa, nhan, giaTri, phu: [{ chu, tone }], thanh?, den?, nhanDen? }.
 * `den` là nơi mở khi bấm: { loai: "duong-dan", to } hoặc { loai: "vi-tri-ke" } (phải đổi kho làm việc trước).
 * Kho ngừng hoạt động không có `den` ở các ô tồn kho: Báo cáo tồn kho không chọn được kho đó.
 *
 * @param kho   dòng kho (KhoDto)
 * @param tomTat dữ liệu GET /kho/{id}/tom-tat, null khi chưa có
 * @param ke    kết quả gopKhuVuc(...).tong, null khi chưa có / lỗi
 */
export function taoOSo(kho, tomTat, ke) {
  const tg = tomTat ?? {};
  const giaoDich = laKhoGiaoDich(kho);
  const baoCao = (tinhTrang) =>
    giaoDich
      ? { loai: "duong-dan", to: `/reports/inventory?kho=${kho.id}${tinhTrang ? `&tinhTrang=${tinhTrang}` : ""}` }
      : null;

  const giaTri = Number(tg.giaTriTon) || 0;
  const rutGon = formatCurrencyCompact(giaTri);
  const day = formatCurrency(giaTri);
  const oGiaTri = (nhan, phuTheoGiaVon) => ({
    khoa: "gia-tri",
    nhan,
    giaTri: rutGon,
    // Rút gọn ("139,6 triệu ₫") thì ghi đủ số ở dòng dưới; số nhỏ đã đủ thì ghi cách tính
    phu: [{ chu: rutGon === day ? phuTheoGiaVon : day }],
    goiY: t("Tính theo giá vốn của từng lô"),
  });

  // Kho ảo: số là hàng đang chuyển của cả hệ thống. Không gắn liên kết sang danh sách phiếu chuyển kho,
  // vì danh sách đó chỉ lọc theo kho làm việc nên số dòng sẽ không khớp.
  if (laKhoAo(kho)) {
    return [
      { khoa: "ton", nhan: t("Đang chuyển"), giaTri: so(tg.soLuongTon), phu: [{ chu: t("sản phẩm trên đường giữa các kho") }] },
      oGiaTri(t("Giá trị đang chuyển"), t("theo giá vốn")),
      { khoa: "ma-hang", nhan: t("Mã hàng"), giaTri: so(tg.soMaHang), phu: [{ chu: Number(tg.soMaHang) > 0 ? t("đang chuyển") : t("Không có hàng đang chuyển") }] },
    ];
  }

  const soMa = Number(tg.soMaHang) || 0;
  const het = Number(tg.soMaHetHang) || 0;
  const sapHet = Number(tg.soMaSapHet) || 0;
  const phuMa = [];
  if (soMa === 0) phuMa.push({ chu: t("Chưa có hàng") });
  if (het > 0) phuMa.push({ chu: t("{{het}} hết hàng", { het: so(het) }), tone: "bad" });
  if (het > 0 && sapHet > 0) phuMa.push({ chu: " · " });
  if (sapHet > 0) phuMa.push({ chu: t("{{sapHet}} sắp hết", { sapHet: so(sapHet) }), tone: "warn" });
  if (soMa > 0 && het === 0 && sapHet === 0) phuMa.push({ chu: t("Không mã nào sắp hết") });

  const ton = Number(tg.soLuongTon) || 0;
  const oSo = [
    {
      khoa: "ton",
      nhan: t("Tồn kho"),
      giaTri: so(ton),
      phu: [{ chu: ton > 0 ? t("Khả dụng {{soLuongKhaDung}}", { soLuongKhaDung: so(tg.soLuongKhaDung) }) : t("Chưa có hàng") }],
      den: baoCao(null),
      nhanDen: t("Báo cáo tồn kho của kho này"),
    },
    { ...oGiaTri(t("Giá trị tồn"), t("theo giá vốn")), den: baoCao(null), nhanDen: t("Báo cáo tồn kho của kho này") },
    {
      khoa: "ma-hang",
      nhan: t("Mã hàng"),
      giaTri: so(soMa),
      phu: phuMa,
      den: baoCao(het > 0 ? "het-hang" : sapHet > 0 ? "thieu-hang" : null),
      nhanDen: het > 0 ? t("Báo cáo tồn kho, mã hết hàng") : sapHet > 0 ? t("Báo cáo tồn kho, mã sắp hết hàng") : t("Báo cáo tồn kho của kho này"),
    },
  ];

  const coKe = Boolean(ke?.coKe);
  oSo.push({
    khoa: "suc-chua",
    nhan: t("Sức chứa kệ"),
    giaTri: coKe && ke.sucChua > 0 ? `${ke.phanTram}%` : "—",
    thanh: coKe && ke.sucChua > 0 ? { phanTram: ke.phanTram, tone: ke.tone } : null,
    phu: [{ chu: coKe ? tomTatKe(ke) : ke ? t("Chưa có vị trí kệ") : "" }],
    den: giaoDich ? { loai: "vi-tri-ke" } : null,
    nhanDen: t("Vị trí kệ của kho này"),
  });
  return oSo;
}

/** Dòng "Người được phân quyền". */
export function nhanPhanQuyen(soNguoi) {
  const n = Number(soNguoi) || 0;
  return n > 0 ? t("{{n}} người, ngoài quản lý kho", { count: n, n: so(n) }) : t("Chưa phân quyền thêm ai");
}

/** Câu hệ quả trong hộp Ngừng hoạt động. */
export function cauNgungHoatDong(kho) {
  const cau = [];
  const ton = Number(kho?.soLuongTon) || 0;
  if (ton > 0) {
    cau.push({ loai: "ton", soLuong: so(ton), soNguyen: ton });
  }
  if (kho?.loaiKho === "kho_tong") cau.push({ loai: "kho-tong" });
  cau.push({ loai: "giu-nguyen" });
  return cau;
}
