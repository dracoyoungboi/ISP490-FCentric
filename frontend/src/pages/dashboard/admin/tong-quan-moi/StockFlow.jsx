import { Link } from "react-router-dom";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { duongDanKemThamSo } from "@/utils/thamSoDuongDan";
import { Card, LE, MoreLink, StackBar } from "./ui";
import { MAU2 } from "./mau";
import GiaiThich from "./GiaiThich";
import { formatSo, formatTienNgan, tachTien } from "../tong-quan/tongQuanFormat";
import { t, tDuLieu } from "@/i18n";

const MUC = [
  { key: "het", ten: t("Hết hàng"), tab: "het-hang", mau: MAU2.tinhTrang.hetHang },
  { key: "sap", ten: t("Sắp hết hàng"), tab: "thieu-hang", mau: MAU2.tinhTrang.thieuHang },
  { key: "binhThuong", ten: t("Bình thường"), tab: "binh-thuong", mau: MAU2.tinhTrang.binhThuong },
  { key: "du", ten: t("Dư hàng"), tab: "du-hang", mau: MAU2.tinhTrang.duHang },
];

/* Bảng bốn cột (Theo kho / Sắp hết cần bổ sung): tên | 3 cột số. Thẻ hẹp (≤ 440px) bỏ cột thứ hai để tên đủ chỗ. */
const LUOI = "grid grid-cols-[minmax(0,1fr)_104px_92px_96px] items-center gap-x-3 @max-[520px]:grid-cols-[minmax(0,1fr)_88px_72px_84px] @max-[440px]:grid-cols-[minmax(0,1fr)_72px_80px]";
const AN_HEP = "@max-[440px]:hidden";

/**
 * Tồn kho hiện tại (đặc tả bản 2, mục 6), không đổi theo kỳ: 4 con số (giá trị, có thể bán, đang về, đang chuyển), tình trạng
 * tồn (bấm từng mức mở Báo cáo tồn kho đúng tab), hàng dư, rồi bảng Theo kho (tất cả kho, bấm dòng để lọc theo kho đó) hoặc
 * Sắp hết, cần bổ sung (một kho; bấm dòng mở sẵn phiếu chuyển từ Kho tổng hoặc yêu cầu nhập).
 */
export default function StockFlow({ data, khoId, setKhoId, dsKho, loading, error, onRetry, className }) {
  const tk = data?.tonKho;
  const kho = khoId == null ? "tat-ca" : khoId;
  const tatCa = khoId == null;
  const khoXem = tatCa ? null : dsKho.find((x) => x.id === khoId);
  const khoTongId = dsKho.find((x) => x.laKhoTong)?.id ?? null;

  return (
    <Card
      className={className}
      title={t("Tồn kho")}
      scope={t("Hiện tại")}
      right={<MoreLink to={`/reports/inventory?kho=${kho}`}><span className="@max-[520px]:sr-only">{t("Báo cáo tồn kho")}</span></MoreLink>}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!loading && !error && tk && tk.soMa === 0 && tk.tonThucTe === 0}
      emptyIcon={Boxes}
      emptyText={t("Kho chưa có hàng.")}
    >
      {tk ? (
        <>
          <BonSo tk={tk} tatCa={tatCa} />
          <TinhTrang tk={tk} kho={kho} tatCa={tatCa} khoXem={khoXem} />
          {tatCa ? <TheoKho tk={tk} setKhoId={setKhoId} /> : <CanBoSung tk={tk} khoXem={khoXem} khoTongId={khoTongId} kho={kho} />}
        </>
      ) : null}
    </Card>
  );
}

function BonSo({ tk, tatCa }) {
  const gt = tachTien(tk.giaTri);
  const dangGiu = tk.tonThucTe - tk.coTheBan;
  const o = [
    {
      ten: (
        <GiaiThich
          tieuDe={t("Giá trị tồn")}
          moTa={tatCa
            ? t("Số lượng đang tồn nhân giá vốn của từng lô (giá nhập), không phải giá bán. Gồm hàng đang chuyển giữa các kho.")
            : t("Số lượng đang tồn nhân giá vốn của từng lô (giá nhập), không phải giá bán. Hàng đang chuyển đến chưa tính cho tới khi kho nhận xong.")}
          dong={tatCa ? [[t("Tại các kho"), formatTienNgan(tk.giaTri - tk.giaTriDangChuyen)], [t("Đang chuyển"), formatTienNgan(tk.giaTriDangChuyen)], [t("Tổng"), formatTienNgan(tk.giaTri), true]] : null}
          ghiChu={tk.hangLoiChoTra ? t("Không gồm {{so}} cái hàng lỗi chờ trả nhà cung cấp.", { so: formatSo(tk.hangLoiChoTra) }) : null}
        >
          {t("Giá trị tồn")}
        </GiaiThich>
      ),
      so: gt.so,
      donVi: gt.donVi,
      phu: tatCa ? t("gồm hàng đang chuyển") : t("theo giá vốn lô"),
    },
    {
      ten: (
        <GiaiThich
          tieuDe={t("Có thể bán")}
          moTa={t("Số cái bán được ngay. Cùng một cách tính cho Tồn kho và bảng Theo kho; mỗi mã ở mỗi kho không xuống dưới 0.")}
          dong={[
            [t("Tồn thực tế"), t("{{so}} cái", { so: formatSo(tk.tonThucTe) })],
            [t("Giữ cho đơn chưa xuất"), `− ${t("{{so}} cái", { so: formatSo(tk.giuDon) })}`],
            [t("Phiếu chuyển kho chưa xuất"), `− ${t("{{so}} cái", { so: formatSo(tk.giuChuyen) })}`],
            [t("Hàng trả chờ cất lên kệ, đang thanh toán, đang nhặt"), `− ${t("{{so}} cái", { so: formatSo(tk.giuKhac) })}`],
            [t("Có thể bán"), t("{{so}} cái", { so: formatSo(tk.coTheBan) }), true],
          ]}
        >
          {t("Có thể bán")}
        </GiaiThich>
      ),
      so: formatSo(tk.coTheBan),
      donVi: t("cái"),
      phu: dangGiu > 0 ? t("đã trừ {{so}} cái đang giữ", { so: formatSo(dangGiu) }) : t("không có hàng đang giữ"),
    },
    {
      ten: <GiaiThich tieuDe={t("Đang về")} moTa={t("Số cái đã đặt nhà cung cấp trong đơn mua nhưng chưa về kho. Hàng đã về đang chờ kiểm đếm nằm ở Cần xử lý.")}>{t("Đang về")}</GiaiThich>,
      so: formatSo(tk.dangVe),
      donVi: t("cái"),
      phu: t("từ đơn mua"),
    },
    tatCa
      ? {
          ten: <GiaiThich tieuDe={t("Đang chuyển")} moTa={t("Số cái đã xuất khỏi kho gửi trong phiếu chuyển kho, kho nhận chưa nhận xong.")}>{t("Đang chuyển")}</GiaiThich>,
          so: formatSo(tk.dangChuyenDi),
          donVi: t("cái"),
          phu: t("giữa các kho"),
        }
      : {
          ten: <GiaiThich tieuDe={t("Đang chuyển")} moTa={t("Số cái đang trên đường đến kho này và từ kho này đi, trong các phiếu chuyển kho đã xuất mà kho nhận chưa nhận xong.")}>{t("Đang chuyển")}</GiaiThich>,
          so: formatSo(tk.dangChuyenDen),
          donVi: tk.dangChuyenDen || tk.dangChuyenDi ? t("cái đến") : t("cái"),
          phu: tk.dangChuyenDen || tk.dangChuyenDi ? t("{{so}} cái đang chuyển đi", { so: formatSo(tk.dangChuyenDi) }) : t("không có phiếu nào"),
        },
  ];
  return (
    <div className={cn(LE, "grid grid-cols-2 gap-x-4 gap-y-3 border-b border-[#eef1f5] py-3.5 @min-[560px]:grid-cols-4")}>
      {o.map((x, i) => (
        <div key={i} className="min-w-0">
          <span className="text-[13px] text-bo-muted">{x.ten}</span>
          <div className="truncate text-xl font-bold leading-7 tracking-[-0.02em] text-bo-foreground">
            {x.so}
            <span className="ml-1 text-sm font-medium tracking-normal text-bo-muted">{x.donVi}</span>
          </div>
          <div className="truncate text-xs text-bo-muted">{x.phu}</div>
        </div>
      ))}
    </div>
  );
}

function TinhTrang({ tk, kho, tatCa, khoXem }) {
  const dem = { het: tk.het, sap: tk.sap, binhThuong: tk.binhThuong, du: tk.du };
  const soMaChu = tatCa ? t("{{soMa}} mã × {{soKho}} kho", { soMa: formatSo(tk.soMa), soKho: tk.soKho, count: Number(tk.soMa) }) : t("{{soMa}} mã tại kho này", { soMa: formatSo(tk.soMa), count: Number(tk.soMa) });
  return (
    <div className={cn(LE, "border-b border-[#eef1f5] py-3.5")}>
      <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
        <GiaiThich
          tieuDe={t("Tình trạng tồn")}
          moTa={t("Mỗi mã hàng ở mỗi kho tính một dòng. Tồn tối thiểu lấy theo thứ tự: mức đặt riêng cho mã ở kho đó, mức đặt cho sản phẩm, rồi mức mặc định ({{nguong}} cái). Dư hàng khi số có thể bán vượt 1,5 lần tồn tối thiểu, như Báo cáo tồn kho.", { nguong: formatSo(tk.nguongMacDinh) })}
          dong={[
            [t("Hết hàng: có thể bán = 0"), formatSo(tk.het)],
            [t("Sắp hết: còn ≤ tồn tối thiểu"), formatSo(tk.sap)],
            [t("Bình thường"), formatSo(tk.binhThuong)],
            [t("Dư hàng: vượt 1,5 lần tồn tối thiểu"), formatSo(tk.du)],
          ]}
          ghiChu={t("Bấm từng mức để mở Báo cáo tồn kho đúng tab.")}
          className="font-medium text-bo-foreground"
        >
          {t("Tình trạng tồn")}
        </GiaiThich>
        <span className="truncate text-xs text-bo-muted" title={khoXem?.tenKho}>{soMaChu}</span>
      </div>
      <StackBar
        segments={MUC.map((m) => ({ key: m.key, value: dem[m.key], color: m.mau }))}
        label={MUC.map((m) => `${m.ten} ${dem[m.key]}`).join(", ")}
      />
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {MUC.map((m) => (
          <li key={m.key}>
            <Link
              to={`/reports/inventory?kho=${kho}&tinhTrang=${m.tab}`}
              className="inline-flex items-center gap-1.5 rounded text-[13px] text-bo-muted hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
            >
              <i className="inline-block size-2.5 rounded-[3px]" style={{ background: m.mau }} aria-hidden="true" />
              {m.ten}
              <b className="font-semibold tabular-nums text-bo-foreground">{formatSo(dem[m.key])}</b>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] text-bo-muted">
        {t("Hàng dư giữ")} <b className="font-semibold text-bo-foreground">{formatTienNgan(tk.giaTriDu)}</b>
        {tk.duChamBan ? t(" · {{so}} mã {{soNgay}} ngày chưa bán được.", { so: formatSo(tk.duChamBan), soNgay: tk.soNgayChamBan }) : "."}
      </p>
    </div>
  );
}

function TheoKho({ tk, setKhoId }) {
  const ds = tk.theoKho ?? [];
  return (
    <div className="pb-1.5 pt-1">
      <div className={cn(LUOI, LE, "py-2 text-xs font-medium text-bo-muted")}>
        <span>{t("Theo kho")}</span>
        <span className="text-right">{t("Giá trị tồn")}</span>
        <span className={cn("text-right", AN_HEP)}>{t("Có thể bán")}</span>
        <span className="text-right">{t("Hết / sắp hết")}</span>
      </div>
      {ds.map((x) => (
        <button
          key={x.khoId}
          type="button"
          onClick={() => setKhoId(x.khoId)}
          title={t("Xem riêng {{kho}}", { kho: x.tenKho })}
          className={cn(LUOI, LE, "w-full cursor-pointer border-t border-[#eef1f5] py-2 text-left text-sm hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30")}
        >
          <span className="truncate text-bo-foreground">{x.tenKho}</span>
          <span className="text-right tabular-nums">{formatTienNgan(x.giaTri)}</span>
          <span className={cn("text-right tabular-nums", AN_HEP)}>{formatSo(x.coTheBan)}</span>
          <span className="text-right tabular-nums">
            {x.het ? <b className="font-semibold text-[#b42318]">{formatSo(x.het)}</b> : 0} / {formatSo(x.sap)}
          </span>
        </button>
      ))}
      <div className={cn(LUOI, LE, "border-t border-[#eef1f5] py-2 text-sm")}>
        <span className="truncate text-bo-muted">{t("Đang chuyển giữa các kho")}</span>
        <span className="text-right tabular-nums">{formatTienNgan(tk.giaTriDangChuyen)}</span>
        <span className={cn("text-right text-bo-muted", AN_HEP)}>—</span>
        <span className="text-right text-bo-muted">—</span>
      </div>
    </div>
  );
}

/** Đường dẫn mở sẵn form theo đề xuất: chuyển từ Kho tổng khi Kho tổng còn đủ, không thì yêu cầu nhập. */
function duongDanDeXuat(d, khoId, khoTongId) {
  if (d.deXuat === "chuyen_kho" && khoTongId != null) {
    return duongDanKemThamSo("/transfer-tickets/create", { khoXuatId: khoTongId, khoNhapId: khoId, bienTheId: d.bienTheId, soLuong: d.soLuongDeXuat });
  }
  return duongDanKemThamSo("/purchase-requests/create", { khoId, bienTheId: d.bienTheId, soLuong: d.soLuongDeXuat, ten: d.tenSanPham });
}

function CanBoSung({ tk, khoXem, khoTongId, kho }) {
  const bs = tk.canBoSung;
  const dong = bs?.dong ?? [];
  const laKhoTong = Boolean(khoXem?.laKhoTong);
  return (
    <div className="pb-1.5 pt-1">
      <div className={cn(LUOI, LE, "py-2 text-xs font-medium text-bo-muted")}>
        <span>{t("Sắp hết, cần bổ sung")}</span>
        <span className={cn("text-right", AN_HEP)}>{t("Có thể bán")}</span>
        <span className="text-right">
          <GiaiThich align="end" tieuDe={t("Tồn tối thiểu")} moTa={t("Số cái ít nhất nên có sẵn ở kho này. Còn bằng hoặc ít hơn mức này là Sắp hết. Lấy theo thứ tự: mức đặt riêng cho mã ở kho này, mức đặt cho sản phẩm, rồi mức mặc định ({{nguong}} cái).", { nguong: formatSo(tk.nguongMacDinh) })}>
            {t("Tồn tối thiểu")}
          </GiaiThich>
        </span>
        <span className="text-right">
          {laKhoTong ? (
            <GiaiThich align="end" tieuDe={t("Đang về")} moTa={t("Số cái của mã này trong đơn mua chưa về Kho tổng. 0 nghĩa là chưa đặt, cần tạo đơn mua.")}>{t("Đang về")}</GiaiThich>
          ) : (
            <GiaiThich align="end" tieuDe={t("Kho tổng còn")} moTa={t("Số cái có thể bán của mã này ở Kho tổng, tức số có thể chuyển sang cửa hàng ngay. Kho tổng cũng hết thì cần đặt nhà cung cấp.")}>{t("Kho tổng còn")}</GiaiThich>
          )}
        </span>
      </div>
      {dong.length === 0 ? (
        <p className={cn(LE, "border-t border-[#eef1f5] py-3 text-[13px] text-bo-muted")}>{t("Không có mã nào hết hoặc sắp hết.")}</p>
      ) : (
        dong.map((d) => {
          const bienThe = [d.tenMau, d.tenKichCo].filter(Boolean).join(" / ");
          return (
            <Link
              key={d.bienTheId}
              to={duongDanDeXuat(d, khoXem?.id, khoTongId)}
              title={d.deXuat === "chuyen_kho" ? t("Tạo phiếu chuyển {{so}} cái từ Kho tổng", { so: formatSo(d.soLuongDeXuat) }) : t("Tạo yêu cầu nhập {{so}} cái", { so: formatSo(d.soLuongDeXuat) })}
              className={cn(LUOI, LE, "border-t border-[#eef1f5] py-2 text-sm hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30")}
            >
              <span className="min-w-0">
                <span className="block truncate text-bo-foreground">{tDuLieu(d.tenSanPham)}</span>
                {bienThe ? <span className="block truncate text-xs text-bo-muted">{tDuLieu(bienThe)}</span> : null}
              </span>
              <span className={cn("text-right tabular-nums", AN_HEP)}>{d.coTheBan ? formatSo(d.coTheBan) : <b className="font-semibold text-[#b42318]">0</b>}</span>
              <span className="text-right tabular-nums">{formatSo(d.nguong)}</span>
              <span className="text-right tabular-nums">
                {laKhoTong ? (d.dangVe ? formatSo(d.dangVe) : <span className="text-bo-muted">0</span>) : formatSo(d.khoTongCon ?? 0)}
              </span>
            </Link>
          );
        })
      )}
      {bs && bs.tong > dong.length ? (
        <Link to={`/reports/inventory?kho=${kho}&tinhTrang=het-hang`} className={cn(LE, "block border-t border-[#eef1f5] py-2 text-[13px] font-medium text-bo-primary hover:text-bo-primary-hover")}>
          {t("và {{so}} mã khác", { so: formatSo(bs.tong - dong.length) })}
        </Link>
      ) : null}
    </div>
  );
}
