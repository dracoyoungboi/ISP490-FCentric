import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LE } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import TrangVaiTro from "@/pages/dashboard/vai-tro/TrangVaiTro";
import { BieuDoNhapXuat, BoCuc, DaySo, FOCUS, HangCoNut, HangDoiViec, LuoiNghiepVu, Nut, TonKhoKho } from "@/pages/dashboard/vai-tro/khung";
import { THU_TU } from "@/pages/dashboard/vai-tro/lop";
import { dongViecQuanLyKho, hanhDongBoSung, moTaBoSung, oNghiepVu, tenBienThe, theSoQuanLyKho } from "@/pages/dashboard/vai-tro/soLieuVaiTro";

/**
 * Tổng quan của QUẢN LÝ KHO, theo kho làm việc (ô "Kho làm việc" đầu trang). Dữ liệu: GET /api/v1/tong-quan/cua-toi.
 * Hàng 1: 4 ô số (kho bán hàng: doanh thu thay cho nhập kho). Cột chính: công việc trong kho theo nghiệp vụ ·
 * nhập – xuất theo ngày. Cột phải: việc chờ bạn quyết · tồn kho và mã cần bổ sung. Điện thoại: việc chờ bạn lên ngay
 * sau ô số.
 */
export default function DashboardWarehouseManager() {
  return (
    <TrangVaiTro vaiTro="quan_ly_kho" theoKho>
      {({ data, loading, loi, reload }) => {
        const q = data?.quanLyKho;
        const kho = data?.kho;
        return (
          <>
            <DaySo loading={loading} error={loi("chiSo")} onRetry={reload} the={q && kho ? theSoQuanLyKho(q, kho, data.cauHinh, data.thoiDiem) : []} />
            <BoCuc
              chinh={[
                <LuoiNghiepVu
                  key="nv"
                  className={THU_TU[2]}
                  tieuDe="Công việc trong kho"
                  scope="đang chờ xử lý"
                  the={q?.nghiepVu && kho ? oNghiepVu(q.nghiepVu, kho, data.cauHinh) : []}
                  loading={loading}
                  error={loi("nghiepVu")}
                  onRetry={reload}
                />,
                <BieuDoNhapXuat
                  key="nx"
                  className={THU_TU[4]}
                  du={q?.nhapXuat}
                  thoiDiem={data?.thoiDiem}
                  loading={loading}
                  error={loi("nhapXuat")}
                  onRetry={reload}
                />,
              ]}
              phai={[
                <HangDoiViec
                  key="viec"
                  className={THU_TU[1]}
                  tieuDe="Cần bạn xử lý"
                  viec={kho ? dongViecQuanLyKho(q?.viec, kho, data.thoiDiem) : []}
                  loading={loading}
                  error={loi("viec")}
                  onRetry={reload}
                />,
                <TonKhoKho
                  key="ton"
                  className={THU_TU[3]}
                  khoId={kho?.id}
                  ton={q?.tonKho}
                  boSung={q?.boSung}
                  loading={loading}
                  error={loi("tonKho") && loi("boSung")}
                  loiTon={loi("tonKho")}
                  onRetry={reload}
                >
                  {kho ? <CanBoSung boSung={q?.boSung} kho={kho} loi={loi("boSung")} onRetry={reload} /> : null}
                </TonKhoKho>,
              ]}
            />
          </>
        );
      }}
    </TrangVaiTro>
  );
}

/** Mã hết / sắp hết của kho, tệ nhất trước; mỗi dòng một hành động (xem hanhDongBoSung). */
function CanBoSung({ boSung, kho, loi, onRetry }) {
  if (loi) {
    return (
      <p className={cn(LE, "flex items-center justify-between gap-3 py-3 text-[13px] text-bo-muted")}>
        Chưa tải được danh sách cần bổ sung.
        <button type="button" onClick={onRetry} className={cn(FOCUS, "cursor-pointer rounded font-medium text-bo-primary")}>
          Thử lại
        </button>
      </p>
    );
  }
  if (!boSung) return null;
  if (!boSung.dong.length) {
    return <p className={cn(LE, "py-3 text-[13px] text-bo-muted")}>Không có mã nào cần bổ sung.</p>;
  }
  return (
    <>
      <p className={cn(LE, "flex items-baseline gap-2 pb-0.5 pt-3 text-[13px] font-medium text-bo-foreground")}>
        Cần bổ sung
        {boSung.tongSo > boSung.dong.length ? (
          <span className="font-normal text-bo-muted">
            {boSung.dong.length}/{boSung.tongSo} mã, thiếu nhiều nhất trước
          </span>
        ) : null}
      </p>
      <ul>
        {boSung.dong.map((d) => {
          const hd = hanhDongBoSung(d, kho);
          const bien = tenBienThe(d.tenMau, d.tenKichCo);
          return (
            <HangCoNut
              key={d.bienTheId}
              ten={
                <>
                  {d.tenSanPham}
                  {bien ? <span className="text-bo-muted"> · {bien}</span> : null}
                </>
              }
              phu={moTaBoSung(d, kho)}
              nut={
                hd.kieu === "nut" ? (
                  <Nut to={hd.to}>{hd.chu}</Nut>
                ) : hd.kieu === "lienKet" ? (
                  <Link to={hd.to} className={cn(FOCUS, "whitespace-nowrap rounded text-[13px] leading-8 text-bo-muted hover:text-bo-foreground hover:underline")}>
                    {hd.chu}
                  </Link>
                ) : (
                  <span className="whitespace-nowrap text-[13px] leading-8 text-bo-muted">{hd.chu}</span>
                )
              }
            />
          );
        })}
      </ul>
    </>
  );
}
