import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackageCheck } from "lucide-react";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { lamViecTaiKho } from "@/components/chuyen-kho/lamViecTaiKho";
import HopXepKe from "@/components/kiem-ke/HopXepKe";
import { taiLaiSoHangChuaCoKe } from "@/components/kiem-ke/soHangChuaCoKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { layHangChuaCoKe, xepKeNhieu } from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { LY_DO_KE, cauKhongGoiY, coTheXep, gomTheoLo, locHangChuaCoKe, soXepDuoc, tomTatKetQua, xepNgayDuoc } from "./hangChuaCoKe";

/** Kệ dạng thẻ nhỏ (cùng kiểu thẻ kệ ở màn Hàng chưa có kệ). */
function TheKe({ ma }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md bg-bo-primary-soft px-2 font-mono text-[12.5px] font-semibold text-bo-primary-strong">
      {ma}
    </span>
  );
}

/**
 * Một lô của chứng từ. `xepGoiY`: lô sẽ được xếp vào kệ gợi ý khi bấm nút chính của hộp; `loi`: câu máy chủ từ chối ở lần
 * xếp vừa rồi.
 */
function DongLo({ h, xepGoiY, loi, khoa, onDeSau, onXepGoiY, onChonKe }) {
  const g = h.keGoiY;
  const xepDuoc = coTheXep(h);
  const ngay = xepNgayDuoc(h);
  let cau;
  if (!xepDuoc) cau = cauKhongGoiY(h);
  else if (ngay && xepGoiY) cau = LY_DO_KE[g.lyDo] ?? "Kệ gợi ý";
  else if (ngay) cau = "Để sau: hàng ở lại phần chưa có kệ";
  else if (g?.id) cau = `Kệ gợi ý ${g.ma} chỉ còn chỗ ${soVN(g.conCho)}: chọn kệ, chia nhiều kệ được`;
  else cau = cauKhongGoiY(h);
  const giu = Math.max(0, Number(h.dangGiuNhat) || 0);

  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-start sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <AnhBienThe src={h.sanPham?.anh} />
        <div className="grid min-w-0 gap-0.5">
          <span className="truncate text-sm font-medium text-bo-foreground">{h.sanPham?.tenSanPham ?? "Sản phẩm"}</span>
          <span className="text-xs text-bo-muted">
            <MauKichCo dong={h.sanPham} className="align-bottom" /> · <span className="font-mono">{h.sanPham?.maSku}</span>
          </span>
          <span className="text-xs text-bo-muted">
            Lô <span className="font-mono">{h.maLo}</span> ·{" "}
            <b className="font-semibold tabular-nums text-bo-foreground">{soVN(soXepDuoc(h))}</b> sản phẩm
            {giu > 0 ? ` (${soVN(giu)} đang chờ nhặt ở đây)` : ""}
          </span>
        </div>
      </div>
      <div className="grid min-w-0 gap-1 sm:justify-items-end sm:text-right">
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {xepDuoc && ngay && xepGoiY ? <TheKe ma={g.ma} /> : <span className="text-[13px] text-bo-muted">{!xepDuoc ? "Chưa xếp được" : ngay ? "Để sau" : "Cần chọn kệ"}</span>}
        </div>
        <span className={cn("text-xs", xepDuoc ? "text-bo-muted" : "text-bo-warning")}>{cau}</span>
        {loi ? (
          <span role="alert" className="text-xs font-medium text-bo-danger">
            {loi}
          </span>
        ) : null}
        {xepDuoc ? (
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:justify-end">
            {ngay && xepGoiY ? (
              <NutChu onClick={onDeSau} disabled={khoa}>
                Để sau
              </NutChu>
            ) : ngay ? (
              <NutChu onClick={onXepGoiY} disabled={khoa}>
                Xếp vào {g.ma}
              </NutChu>
            ) : null}
            <NutChu onClick={onChonKe} disabled={khoa}>
              {ngay ? "Kệ khác" : "Chọn kệ"}
            </NutChu>
          </span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Hộp "Xếp kệ hàng vừa nhận": hàng của một chứng từ (phiếu chuyển kho ở kho nhận, hoặc hàng về lại kho xuất khi phiếu bị
 * hủy lúc đang đi đường) còn chưa có kệ ở `kho` (`{ id, ten }`), lọc theo `phieuChuyenId` / `phieuNhapId` (phần của
 * chứng từ, xem locHangChuaCoKe). Lô có kệ gợi ý đủ chỗ được chọn sẵn; nút chính xếp các lô đó một lượt
 * (POST /xep-ke-nhieu, mỗi phần một giao dịch: phần bị từ chối hiện lý do ngay trên dòng). "Kệ khác" / "Chọn kệ" mở hộp
 * Xếp kệ một lô (chia tối đa 4 kệ) và xếp lô đó ngay. "Để sau" đóng hộp, hàng ở lại phần chưa có kệ (dòng nhắc trên
 * chứng từ, tab Chờ xếp kệ).
 *
 * `onDong()`: hộp đóng (nơi gọi đếm lại dòng nhắc). `tuMo`: hộp tự mở ngay sau khi nhận hàng — tải xong mà không lô nào
 * xếp được lúc này (đang kiểm kê, phiếu nhặt giữ hết, người khác vừa xếp) thì tự đóng, không bày hộp không làm gì được.
 * Nơi gọi đổi `key` mỗi lần mở để hộp dựng lại từ đầu.
 */
export default function HopXepKeChungTu({ mo, kho, phieuChuyenId = null, phieuNhapId = null, tieuDe, soChungTu, tuMo = false, onDong }) {
  const navigate = useNavigate();
  const khoId = kho?.id ?? null;
  const tenKho = kho?.ten ?? kho?.tenKho ?? null;
  const [lanTai, setLanTai] = useState(0);
  const tai = useCallback(() => layHangChuaCoKe(khoId), [khoId]);
  const q = useTaiDuLieu(tai, `xep-ke-chung-tu-${khoId}-${phieuChuyenId}-${phieuNhapId}-${lanTai}`, { enabled: mo && khoId != null });
  const duLieu = q.dungKhoa ? q.data : undefined;
  const ds = useMemo(() => locHangChuaCoKe(duLieu ?? [], { phieuChuyen: phieuChuyenId, phieuNhap: phieuNhapId }), [duLieu, phieuChuyenId, phieuNhapId]);
  // Lô người dùng bấm "Để sau" (mặc định mọi lô có kệ gợi ý đủ chỗ đều được xếp)
  const [deSau, setDeSau] = useState(() => new Set());
  const [loiLo, setLoiLo] = useState(() => new Map());
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState(null);
  // Hộp xếp một lô: `phien` đổi mỗi lần mở; hộp chứng từ ẩn trong lúc đó (không chồng hai hộp)
  const [motLo, setMotLo] = useState({ phien: 0, lo: null });
  const [dangChayMotLo, setDangChayMotLo] = useState(false);
  const [loiMotLo, setLoiMotLo] = useState(null);
  const [lanTaiKe, setLanTaiKe] = useState(0);

  const xepGoiY = ds.filter((h) => xepNgayDuoc(h) && !deSau.has(h.loHangId));
  const soSanPham = xepGoiY.reduce((s, h) => s + soXepDuoc(h), 0);
  const dangTai = q.loading && !q.dungKhoa;
  const loiTai = !q.loading && q.error && !q.dungKhoa ? q.error : null;
  const daTai = q.dungKhoa && !q.loading;
  const conLai = ds.reduce((s, h) => s + (Number(h.chuaCoKe) || 0), 0);
  const coLoXepDuoc = ds.some(coTheXep);
  const lyDoKhoa = dangTai
    ? "Đang tải hàng chưa có kệ"
    : loiTai
      ? "Chưa tải được hàng chưa có kệ"
      : !xepGoiY.length
        ? !ds.length
          ? "Hàng của phiếu đã có kệ hết"
          : !coLoXepDuoc
            ? "Các lô chưa xếp được lúc này"
            : "Chưa chọn lô nào để xếp: bấm Xếp vào… hoặc Chọn kệ ở từng lô"
        : null;

  // Tự mở sau khi nhận mà lần tải đầu không còn gì xếp được: đóng luôn (dòng nhắc trên phiếu vẫn còn nếu có hàng)
  const khongCoViec = tuMo && lanTai === 0 && mo && q.dungKhoa && !q.loading && !q.error && !ds.some(coTheXep);
  useEffect(() => {
    if (khongCoViec) queueMicrotask(() => onDong?.());
  }, [khongCoViec, onDong]);

  const doiDeSau = (id, bat) =>
    setDeSau((cu) => {
      const moi = new Set(cu);
      if (bat) moi.add(id);
      else moi.delete(id);
      return moi;
    });

  /** Gửi các phần xếp kệ ở kho của chứng từ (đổi kho làm việc về kho đó trước, như mọi thao tác ghi theo kho). */
  const ghi = async (phan) => {
    lamViecTaiKho(kho);
    return tomTatKetQua(await xepKeNhieu(khoId, phan));
  };

  const maLoTheoId = (id) => ds.find((h) => h.loHangId === id)?.maLo ?? (duLieu ?? []).find((h) => h.loHangId === id)?.maLo ?? "";

  /** Sau một lượt xếp: báo kết quả, tải lại danh sách và số đếm trên menu; trả số lô còn chưa xếp được. */
  const baoKetQua = (kq) => {
    if (kq.daXep.length) {
      toast.success(kq.soLoDaXep === 1 ? `Đã xếp lô ${maLoTheoId(kq.daXep[0].loHangId)} lên kệ` : `Đã xếp ${soVN(kq.soLoDaXep)} lô lên kệ`, {
        description: `${soVN(kq.soSanPham)} sản phẩm ở ${tenKho ?? "kho"}. Xếp kệ chỉ ghi sổ kệ, tồn kho không đổi.`,
      });
    }
    taiLaiSoHangChuaCoKe();
  };

  const xepCacLoGoiY = async () => {
    if (!xepGoiY.length || dangChay) return;
    setLoi(null);
    setDangChay(true);
    try {
      const kq = await ghi(xepGoiY.map((h) => ({ loHangId: h.loHangId, viTriKhoId: h.keGoiY.id, soLuong: soXepDuoc(h) })));
      baoKetQua(kq);
      const loLoi = gomTheoLo(kq.loi);
      if (!loLoi.length) {
        const conDeSau = ds.filter((h) => !xepGoiY.includes(h)).length;
        if (conDeSau) {
          toast.info(`${soVN(conDeSau)} lô để sau`, { description: "Hàng ở lại phần chưa có kệ; xếp tiếp ở dòng nhắc trên phiếu hoặc màn Hàng chưa có kệ." });
        }
        onDong?.();
        return;
      }
      // Có phần bị từ chối (kệ vừa đầy, vừa khóa kiểm kê, số vừa đổi): giữ hộp, ghi lý do lên từng lô, tải lại gợi ý
      setLoiLo(new Map(loLoi.map((l) => [l.loHangId, l.loi.join(" ")])));
      setLoi(
        loLoi.length === 1
          ? `Lô ${maLoTheoId(loLoi[0].loHangId)} chưa xếp được. Gợi ý kệ đã được tính lại.`
          : `${soVN(loLoi.length)} lô chưa xếp được. Gợi ý kệ đã được tính lại.`,
      );
      setLanTai((n) => n + 1);
    } catch (error) {
      setLoi(getApiErrorMessage(error, "Chưa xếp được lên kệ. Thử lại sau giây lát."));
    } finally {
      setDangChay(false);
    }
  };

  const moMotLo = (h) => {
    setLoiMotLo(null);
    setMotLo((cu) => ({ phien: cu.phien + 1, lo: h }));
  };
  const dongMotLo = () => setMotLo((cu) => ({ ...cu, lo: null }));
  // Lô trong hộp một lô lấy theo dữ liệu mới nhất (sau lần bị từ chối danh sách tải lại)
  const loDangChon = motLo.lo ? (ds.find((h) => h.loHangId === motLo.lo.loHangId) ?? motLo.lo) : null;

  const xepMotLo = async (phan) => {
    setLoiMotLo(null);
    setDangChayMotLo(true);
    try {
      const kq = await ghi(phan);
      if (!kq.daXep.length) {
        setLoiMotLo(gomTheoLo(kq.loi).flatMap((l) => l.loi).join(" ") || "Chưa xếp được lên kệ");
        setLanTaiKe((n) => n + 1);
        setLanTai((n) => n + 1);
        return;
      }
      baoKetQua(kq);
      // Chia nhiều kệ mà một phần bị từ chối (kệ vừa đầy, vừa khóa kiểm kê): báo phần đó, ghi lên dòng lô
      const loiConLai = gomTheoLo(kq.loi).flatMap((l) => l.loi).join(" ");
      if (loiConLai) {
        toast.error(`Một phần lô ${maLoTheoId(phan[0]?.loHangId)} chưa xếp được`, { description: loiConLai });
      }
      setLoiLo((cu) => {
        const moi = new Map(cu);
        if (loiConLai) moi.set(phan[0]?.loHangId, loiConLai);
        else moi.delete(phan[0]?.loHangId);
        return moi;
      });
      dongMotLo();
      setLanTai((n) => n + 1);
    } catch (error) {
      setLoiMotLo(getApiErrorMessage(error, "Chưa xếp được lên kệ. Thử lại sau giây lát."));
    } finally {
      setDangChayMotLo(false);
    }
  };

  const moManChung = () => {
    const loc = phieuChuyenId != null ? `phieuChuyen=${phieuChuyenId}` : `phieuNhap=${phieuNhapId}`;
    onDong?.();
    navigate(`/warehouse/unshelved?khoId=${khoId}&${loc}`);
  };

  // Đã tải mà không còn lô nào (vừa xếp hết bằng hộp một lô, hoặc người khác đã xếp): báo đã xong, nút đóng thành "Đóng"
  const xongHet = daTai && !ds.length && !loiTai;

  return (
    <>
      <HopXacNhanChungTu
        mo={mo && !loDangChon}
        onDoiMo={(m) => !m && onDong?.()}
        ratRong
        tieuDe={tieuDe}
        moTa={`${tenKho ?? "Kho"}${soChungTu ? ` · ${soChungTu}` : ""} · ${
          daTai ? `${soVN(conLai)} sản phẩm, ${soVN(ds.length)} lô chưa có kệ` : "đang tải"
        }.${ds.some(xepNgayDuoc) ? " Kệ gợi ý đã chọn sẵn cho từng lô, đổi được." : ""} Xếp kệ chỉ ghi sổ kệ, tồn kho không đổi.`}
        nhanXacNhan={xepGoiY.length ? `Xếp ${soVN(xepGoiY.length)} lô lên kệ` : "Xếp lên kệ"}
        nhanQuayLai={xongHet ? "Đóng" : "Để sau"}
        iconXacNhan={PackageCheck}
        dangChay={dangChay}
        khoaXacNhan={Boolean(lyDoKhoa)}
        lyDoKhoa={lyDoKhoa ?? undefined}
        loi={loi}
        tieuDiemONhap={false}
        onXacNhan={xepCacLoGoiY}
      >
        {dangTai ? (
          <p className="py-8 text-center text-[13px] text-bo-muted">Đang tải hàng chưa có kệ…</p>
        ) : loiTai ? (
          <p role="alert" className="py-8 text-center text-[13px] text-bo-danger">
            Không tải được hàng chưa có kệ: {getApiErrorMessage(loiTai, "lỗi kết nối")}. <NutChu onClick={q.reload}>Thử lại</NutChu>
          </p>
        ) : xongHet ? (
          <p className="py-8 text-center text-[13px] text-bo-muted">Hàng của phiếu đã có kệ hết ở {tenKho ?? "kho này"}.</p>
        ) : (
          <div className="grid gap-1">
            <ul className="divide-y divide-bo-border">
              {ds.map((h) => (
                <DongLo
                  key={h.loHangId}
                  h={h}
                  xepGoiY={!deSau.has(h.loHangId)}
                  loi={loiLo.get(h.loHangId)}
                  khoa={dangChay}
                  onDeSau={() => doiDeSau(h.loHangId, true)}
                  onXepGoiY={() => doiDeSau(h.loHangId, false)}
                  onChonKe={() => moMotLo(h)}
                />
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bo-border pb-1 pt-2.5 text-xs text-bo-muted">
              <span className="tabular-nums">
                {xepGoiY.length
                  ? `Bấm nút xếp: ${soVN(soSanPham)} sản phẩm của ${soVN(xepGoiY.length)} lô lên kệ gợi ý${xepGoiY.length < ds.length ? `; ${soVN(ds.length - xepGoiY.length)} lô để sau` : ""}.`
                  : "Chưa có lô nào được chọn để xếp."}
              </span>
              <NutChu onClick={moManChung} disabled={dangChay}>
                Mở màn Hàng chưa có kệ
              </NutChu>
            </div>
          </div>
        )}
      </HopXacNhanChungTu>
      {loDangChon ? (
        <HopXepKe
          key={motLo.phien}
          mo
          dsLo={[loDangChon]}
          khoId={khoId}
          dangChay={dangChayMotLo}
          loi={loiMotLo}
          lanTaiKe={lanTaiKe}
          onDoiMo={(m) => !m && !dangChayMotLo && dongMotLo()}
          onSua={() => setLoiMotLo(null)}
          onXep={xepMotLo}
        />
      ) : null}
    </>
  );
}
