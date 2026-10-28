import { useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronDown, FileText, History, Inbox, PackageCheck, SearchX, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import HoatDongNcc from "@/components/supplier/chi-tiet/HoatDongNcc";
import {
  BangBaoGiaNcc,
  BangDonMuaNcc,
  BangPhieuNhapNcc,
  BangSanPhamGiaNcc,
  DangMoNcc,
} from "@/components/supplier/chi-tiet/BangGiaoDichNcc";
import {
  LUA_CHON_THOI_GIAN,
  SO_DONG_HIEN_LOC,
  SO_HOAT_DONG_MOI_LAN,
  catTrang,
  locBaoGia,
  locDonMua,
  locHoatDong,
  locLichSuGia,
  locPhieuNhap,
  luaChonGiaoHang,
  luaChonTuDuLieu,
} from "@/components/supplier/chi-tiet/tinhNhaCungCap";
import { getBaoGiaNccStatus } from "@/constants/donMuaHang";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { getGoodsReceiptStatus } from "@/constants/goodsReceipt";
import { formatNumber } from "@/utils/formatters";

const TRONG = {
  "don-mua": {
    icon: Inbox,
    title: "Chưa có đơn mua hàng",
    description: "Khi duyệt báo giá của nhà cung cấp này, đơn mua hàng sẽ hiện ở đây kèm tiến độ nhận hàng.",
  },
  "bao-gia": {
    icon: FileText,
    title: "Chưa có báo giá nào",
    description: "Chọn nhà cung cấp này khi gửi yêu cầu báo giá từ một yêu cầu nhập hàng.",
  },
  "phieu-nhap": {
    icon: PackageCheck,
    title: "Chưa nhập kho lần nào",
    description: "Phiếu nhập kho của các đơn mua từ nhà cung cấp này sẽ hiện ở đây.",
  },
  "san-pham": {
    icon: Tags,
    title: "Chưa có giá nhập",
    description: "Giá theo từng biến thể sẽ có sau đơn mua đầu tiên, để so khi duyệt báo giá mới.",
  },
  "hoat-dong": {
    icon: History,
    title: "Chưa có hoạt động",
    description: "Việc gửi yêu cầu báo giá và nhập kho với nhà cung cấp này sẽ hiện ở đây.",
  },
};

const KHONG_KHOP = {
  "don-mua": "Không có đơn phù hợp",
  "bao-gia": "Không có báo giá phù hợp",
  "phieu-nhap": "Không có phiếu nhập phù hợp",
  "san-pham": "Không có sản phẩm phù hợp",
  "hoat-dong": "Không có hoạt động phù hợp",
};

/** Đơn vị đếm ở dòng "Hiển thị x – y trong tổng số N …". */
const DON_VI = {
  "dang-mo": "việc",
  "don-mua": "đơn",
  "bao-gia": "báo giá",
  "phieu-nhap": "phiếu",
  "san-pham": "sản phẩm",
  "hoat-dong": "hoạt động",
};

/** Ghi chú ngắn ở chân bảng (nhường chỗ cho câu phạm vi dữ liệu theo vai trò khi có). */
const GHI_CHU_TAB = {
  "dang-mo": "Việc gấp xếp lên trước",
  "bao-gia": "Báo giá đã chốt nằm ở tab Đơn mua hàng",
  "phieu-nhap": "Không tính phiếu đã hủy",
  "san-pham": "Giá lấy từ các đơn mua đã chốt",
  "hoat-dong": "Mới nhất ở trên",
};

// Tên trạng thái lấy từ bảng báo giá nhà cung cấp, cùng tên với thẻ trên bảng (BangGiaoDichNcc → TrangThaiBaoGia)
const TRANG_THAI_BAO_GIA = [
  { value: "1", label: `${getBaoGiaNccStatus(1).label} · chờ nhà cung cấp` },
  { value: "2", label: `${getBaoGiaNccStatus(2).label} · chờ duyệt` },
  { value: "4", label: getBaoGiaNccStatus(4).label },
];

const BIEN_DONG_GIA = [
  { value: "tang", label: "Tăng giá" },
  { value: "giam", label: "Giảm giá" },
  { value: "khongDoi", label: "Không đổi" },
  { value: "lanDau", label: "Lần đầu mua" },
];

const LOAI_HOAT_DONG = [
  { value: "guiYeuCau", label: "Gửi yêu cầu báo giá" },
  { value: "nhapKho", label: "Nhập kho" },
];

const MAC_DINH = { trang: 0, soDong: SO_DONG_MAC_DINH, oTim: "", loc: {}, soHien: SO_HOAT_DONG_MOI_LAN };

/**
 * Ô tìm và các bộ lọc của từng tab. Mỗi bộ lọc: `{ khoa, nhan, tatCa, luaChon }`;
 * `luaChon` không có "Tất cả" (thêm khi vẽ). Bộ lọc chỉ còn dưới 2 lựa chọn thì ẩn (trừ khi đang chọn).
 */
function boLocCuaTab(tab, d) {
  switch (tab) {
    case "don-mua":
      return {
        tim: "Tìm theo mã đơn",
        chon: [
          { khoa: "giao", nhan: "Giao hàng", tatCa: "Mọi tình trạng giao", luaChon: luaChonGiaoHang(d.giaoTheoDon) },
          {
            khoa: "kho",
            nhan: "Kho nhận",
            tatCa: "Mọi kho nhận",
            luaChon: luaChonTuDuLieu(d.chot, (x) => x?.khoNhap?.id, (x) => x?.khoNhap?.tenKho || `Kho #${x?.khoNhap?.id}`),
          },
          { khoa: "thoiGian", nhan: "Thời gian đặt", tatCa: LUA_CHON_THOI_GIAN[0].label, luaChon: LUA_CHON_THOI_GIAN.slice(1) },
        ],
      };
    case "bao-gia":
      return {
        tim: "Tìm theo mã báo giá",
        chon: [
          {
            khoa: "trangThai",
            nhan: "Trạng thái",
            tatCa: "Mọi trạng thái",
            luaChon: TRANG_THAI_BAO_GIA.filter((o) => d.baoGia.some((x) => String(Number(x?.trangThai)) === o.value)),
          },
          { khoa: "thoiGian", nhan: "Thời gian gửi", tatCa: LUA_CHON_THOI_GIAN[0].label, luaChon: LUA_CHON_THOI_GIAN.slice(1) },
        ],
      };
    case "phieu-nhap":
      return {
        tim: "Tìm theo mã phiếu, mã đơn",
        chon: [
          { khoa: "kho", nhan: "Kho", tatCa: "Mọi kho", luaChon: luaChonTuDuLieu(d.phieus, (x) => x?.tenKho) },
          {
            khoa: "trangThai",
            nhan: "Trạng thái",
            tatCa: "Mọi trạng thái",
            luaChon: luaChonTuDuLieu(d.phieus, (x) => x?.trangThai, (x) => getGoodsReceiptStatus(x?.trangThai).label),
          },
        ],
      };
    case "san-pham":
      return {
        tim: "Tìm theo tên, SKU",
        chon: [
          {
            khoa: "bienDong",
            nhan: "Biến động giá",
            tatCa: "Mọi biến động giá",
            luaChon: BIEN_DONG_GIA.filter((o) => d.lichSuGia.some((r) => r?.soVoiTruoc?.loai === o.value)),
          },
        ],
      };
    case "hoat-dong":
      return {
        tim: null,
        chon: [
          {
            khoa: "loai",
            nhan: "Loại hoạt động",
            tatCa: "Mọi hoạt động",
            luaChon: LOAI_HOAT_DONG.filter((o) => d.suKien.some((s) => s?.loai === o.value)),
          },
          { khoa: "thoiGian", nhan: "Thời gian", tatCa: LUA_CHON_THOI_GIAN[0].label, luaChon: LUA_CHON_THOI_GIAN.slice(1) },
        ],
      };
    default:
      return { tim: null, chon: [] };
  }
}

/** Danh sách của tab sau khi lọc. */
function locTheoTab(tab, d, tuKhoa, loc) {
  switch (tab) {
    case "dang-mo":
      return d.viec;
    case "don-mua":
      return locDonMua(d.chot, d.giaoTheoDon, { tuKhoa, ...loc });
    case "bao-gia":
      return locBaoGia(d.baoGia, { tuKhoa, ...loc });
    case "phieu-nhap":
      return locPhieuNhap(d.phieus, { tuKhoa, ...loc });
    case "san-pham":
      return locLichSuGia(d.lichSuGia, { tuKhoa, ...loc });
    default:
      return locHoatDong(d.suKien, loc);
  }
}

/** Số dòng của tab khi chưa lọc (quyết định có hiện ô tìm, bộ lọc hay không). */
function soDongGoc(tab, d) {
  return (
    {
      "dang-mo": d.viec,
      "don-mua": d.chot,
      "bao-gia": d.baoGia,
      "phieu-nhap": d.phieus,
      "san-pham": d.lichSuGia,
      "hoat-dong": d.suKien,
    }[tab]?.length ?? 0
  );
}

/**
 * Cột trái của thân khối: các tab giao dịch với nhà cung cấp, cùng kiểu Chi tiết khách hàng.
 * Hàng tab và bộ lọc dùng chung ListToolbar / StatusTabs / SearchInput / FilterSelect; chân bảng là TablePagination
 * (tab Hoạt động dùng nút "Xem thêm" vì là dòng thời gian). Lọc và phân trang làm ở máy khách: trang đã tải sẵn
 * đơn và phiếu nhập để tính số liệu đầu khối. Mỗi tab giữ riêng trang, số dòng, ô tìm, bộ lọc khi chuyển qua lại.
 * Màn rộng (index.css → .ncc-*): thân bảng tự cuộn, tiêu đề cột dính, chân bảng luôn ở đáy khối.
 *
 * - `tabs`: [{ ma, nhan, so, gap }] — `gap` tô đỏ số trên tab (có việc quá hạn).
 * - `d`: dữ liệu đã tính sẵn ở trang (việc đang mở, đơn chốt, báo giá, phiếu nhập, lịch sử giá, sự kiện).
 * - `loiDon`: lỗi tải đơn mua (chặn cả vùng, có Thử lại); `loiPhieu`: lỗi tải phiếu nhập (chỉ báo một dòng).
 * - `ghiChu`: câu phạm vi dữ liệu theo vai trò (kho phụ trách, chỉ tính N đơn gần nhất), hiện ở chân bảng.
 * Trang cha truyền `key` theo nhà cung cấp để đổi nhà cung cấp thì bộ lọc, trang về mặc định.
 */
export default function GiaoDichNcc({ tabs, tab, onDoiTab, dangTai, loiDon, onThuLaiDon, loiPhieu, onThuLaiPhieu, ghiChu, d }) {
  const [theoTab, setTheoTab] = useState({});
  const vungBang = useRef(null);

  const st = { ...MAC_DINH, ...theoTab[tab] };
  const sua = (thayDoi) =>
    setTheoTab((cu) => ({ ...cu, [tab]: { ...MAC_DINH, ...cu[tab], ...thayDoi } }));
  // Đổi điều kiện lọc thì về trang đầu và thu tab Hoạt động về 20 dòng đầu
  const doiDieuKien = (thayDoi) => sua({ ...thayDoi, trang: 0, soHien: SO_HOAT_DONG_MOI_LAN });

  const tuKhoa = st.oTim.trim();
  const dangLoc = Boolean(tuKhoa) || Object.values(st.loc).some(Boolean);
  const xoaLoc = () => doiDieuKien({ oTim: "", loc: {} });

  const laHoatDong = tab === "hoat-dong";
  const ds = locTheoTab(tab, d, tuKhoa, st.loc);
  const tong = ds.length;
  const trangHien = laHoatDong
    ? { dong: ds.slice(0, st.soHien), trang: 0 }
    : catTrang(ds, st.trang, st.soDong);
  const dong = trangHien.dong;

  // Đổi tab, trang, số dòng hoặc điều kiện lọc thì vùng bảng cuộn về đầu (bấm "Xem thêm" thì giữ chỗ đang đọc)
  const khoaCuon = `${tab}|${trangHien.trang}|${st.soDong}|${tuKhoa}|${JSON.stringify(st.loc)}`;
  useEffect(() => {
    if (vungBang.current) vungBang.current.scrollTop = 0;
  }, [khoaCuon]);

  // ── Ô tìm và bộ lọc: chỉ khi tab có từ 10 dòng, hoặc đang lọc ──
  const boLoc = boLocCuaTab(tab, d);
  const hienLoc = !loiDon && !dangTai && (soDongGoc(tab, d) >= SO_DONG_HIEN_LOC || dangLoc);
  const cacBoLoc = boLoc.chon.filter((c) => c.luaChon.length >= 2 || st.loc[c.khoa]);

  // ── Nội dung ──
  let noiDung;
  if (loiDon) {
    noiDung = (
      <ErrorState
        className="ncc-trong min-h-56"
        title="Không tải được giao dịch với nhà cung cấp"
        description={loiDon}
        onRetry={onThuLaiDon}
      />
    );
  } else if (dangTai) {
    noiDung = <LoadingState className="ncc-trong min-h-56" label="Đang tải giao dịch với nhà cung cấp" />;
  } else if (tong === 0) {
    if (dangLoc) {
      noiDung = (
        <EmptyState
          className="ncc-trong min-h-56"
          icon={SearchX}
          title={KHONG_KHOP[tab] ?? "Không có kết quả phù hợp"}
          description="Thử bỏ bớt điều kiện lọc."
          action={
            <Button type="button" variant="outline" onClick={xoaLoc} className="border-bo-border bg-bo-surface shadow-none">
              Xóa lọc
            </Button>
          }
        />
      );
    } else {
      const trong = TRONG[tab] ?? TRONG["hoat-dong"];
      noiDung = (
        <EmptyState className="ncc-trong min-h-56" icon={trong.icon} title={trong.title} description={trong.description} />
      );
    }
  } else if (tab === "dang-mo") noiDung = <DangMoNcc viec={dong} nutCuaDon={d.nutCuaDon} />;
  else if (tab === "don-mua") noiDung = <BangDonMuaNcc chot={dong} giaoTheoDon={d.giaoTheoDon} />;
  else if (tab === "bao-gia") noiDung = <BangBaoGiaNcc baoGia={dong} />;
  else if (tab === "phieu-nhap") noiDung = <BangPhieuNhapNcc phieus={dong} />;
  else if (tab === "san-pham") noiDung = <BangSanPhamGiaNcc dong={dong} />;
  else {
    const conLai = tong - dong.length;
    noiDung = (
      <>
        <HoatDongNcc suKien={dong} />
        {conLai > 0 ? (
          <div className="flex justify-center px-4 pb-5 pt-1 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => sua({ soHien: st.soHien + SO_HOAT_DONG_MOI_LAN })}
              className="gap-1.5 border-bo-border bg-bo-surface text-bo-foreground shadow-none hover:bg-bo-surface-subtle max-sm:h-11 max-sm:w-full"
            >
              <ChevronDown className="size-4" aria-hidden="true" />
              Xem thêm {formatNumber(Math.min(SO_HOAT_DONG_MOI_LAN, conLai))} hoạt động
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  const ghiChuChan = ghiChu || GHI_CHU_TAB[tab] || "";
  const hienChan = !loiDon && !dangTai && (tong > 0 || ghiChu);
  const ghiChuTong = dangLoc ? `lọc từ ${formatNumber(soDongGoc(tab, d))}` : undefined;

  return (
    <section aria-label="Giao dịch với nhà cung cấp" className="ncc-giao-dich flex min-w-0 flex-col">
      <ListToolbar
        tabs={
          <StatusTabs
            label="Loại giao dịch"
            tabs={tabs.map((t) => ({
              value: t.ma,
              label: t.nhan,
              count: t.so > 0 ? t.so : undefined,
              tone: t.gap ? "danger" : undefined,
            }))}
            value={tab}
            onChange={onDoiTab}
          />
        }
        hasFilter={hienLoc && dangLoc}
        onClear={xoaLoc}
      >
        {hienLoc ? (
          <>
            {boLoc.tim ? (
              <SearchInput
                label={boLoc.tim}
                placeholder={boLoc.tim}
                value={st.oTim}
                onChange={(e) => doiDieuKien({ oTim: e.target.value })}
                onClear={() => doiDieuKien({ oTim: "" })}
                className="sm:w-60"
              />
            ) : null}
            {cacBoLoc.map((c, i) => (
              <FilterSelect
                key={c.khoa}
                label={c.nhan}
                value={st.loc[c.khoa] ?? ""}
                options={[{ value: "", label: c.tatCa }, ...c.luaChon]}
                onChange={(v) => doiDieuKien({ loc: { ...st.loc, [c.khoa]: v } })}
                onClear={() => doiDieuKien({ loc: { ...st.loc, [c.khoa]: "" } })}
                clearLabel={`Bỏ lọc ${c.nhan.toLocaleLowerCase("vi-VN")}`}
                align={i === cacBoLoc.length - 1 ? "end" : "start"}
              />
            ))}
          </>
        ) : null}
      </ListToolbar>

      {loiPhieu && !loiDon ? (
        <div
          role="alert"
          className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2 text-sm text-bo-danger sm:mx-6"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            Không tải được phiếu nhập kho{loiPhieu === true ? "" : `: ${loiPhieu}`}. Giao đúng hạn tạm chưa tính.
          </span>
          <button type="button" onClick={onThuLaiPhieu} className="font-medium underline underline-offset-2 hover:no-underline">
            Thử lại
          </button>
        </div>
      ) : null}

      <div
        ref={vungBang}
        id="vung-tab-ncc"
        role="tabpanel"
        aria-label={tabs.find((t) => t.ma === tab)?.nhan}
        className="ncc-bang min-w-0 flex-1 overflow-x-auto"
      >
        {noiDung}
      </div>

      {hienChan ? (
        <div className="mt-auto border-t border-bo-border px-4 py-3 sm:px-6">
          {tong === 0 ? (
            <p className="text-xs text-bo-muted">{ghiChu}</p>
          ) : laHoatDong ? (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              {ghiChuChan ? <span className="text-xs text-bo-muted">{ghiChuChan}</span> : <span />}
              <p className="text-xs text-bo-muted tabular-nums">
                Hiển thị <span className="font-semibold text-bo-foreground">1</span>
                {" – "}
                <span className="font-semibold text-bo-foreground">{formatNumber(dong.length)}</span>
                {" trong tổng số "}
                <span className="font-semibold text-bo-primary">{formatNumber(tong)}</span> hoạt động
                {ghiChuTong ? <> · {ghiChuTong}</> : null}
              </p>
            </div>
          ) : (
            <TablePagination
              page={trangHien.trang}
              size={st.soDong}
              total={tong}
              totalLabel={DON_VI[tab]}
              totalNote={ghiChuTong}
              onPageChange={(p) => sua({ trang: p })}
              onSizeChange={(n) => sua({ soDong: n, trang: 0 })}
              extra={ghiChuChan ? <span className="text-xs text-bo-muted">{ghiChuChan}</span> : null}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
