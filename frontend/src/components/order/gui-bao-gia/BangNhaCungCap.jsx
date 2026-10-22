import { useId } from "react";
import { MailWarning, UserCheck, UserX } from "lucide-react";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import KhongKetQua from "@/components/chung-tu/KhongKetQua";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import PhanTrangBang from "@/components/chung-tu/PhanTrangBang";
import ThanhCongCuBang from "@/components/chung-tu/ThanhCongCuBang";
import { phanTrang, soVN } from "@/components/chung-tu/bangChungTu";
import {
  AN_DIEN_THOAI,
  BANG,
  CHI_DIEN_THOAI,
  DONG,
  DONG_SANG,
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { CO_TRANG_DONG, NGUONG_CONG_CU } from "@/config/bangChungTu";
import { cn } from "@/lib/utils";
import { cauKhopNgoaiLoc, chuChonTatCa, chuVietTat, locNhaCungCap } from "./tinhGuiBaoGia";

// Nền ô tròn chữ viết tắt (chữ trắng): sắc đậm để đủ tương phản
const MAU_O_TRON = ["bg-bo-primary-strong", "bg-violet-700", "bg-emerald-700", "bg-orange-700", "bg-cyan-700", "bg-slate-600"];

/** Trạng thái gửi của một nhà cung cấp: Hoạt động · Chưa có email (+ Cập nhật email) · Ngừng hoạt động. */
function TrangThaiNcc({ d, suaDuoc, onSuaEmail }) {
  if (!d.hoatDong) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-bo-muted">
        <UserX className="size-4" aria-hidden="true" />
        Ngừng hoạt động
      </span>
    );
  }
  if (!d.email) {
    return (
      <span className="grid justify-items-start gap-0.5">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-amber-700">
          <MailWarning className="size-4" aria-hidden="true" />
          Chưa có email
        </span>
        {suaDuoc ? (
          <NutChu
            className="text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onSuaEmail(d.ncc);
            }}
          >
            Cập nhật email
          </NutChu>
        ) : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-bo-success">
      <UserCheck className="size-4" aria-hidden="true" />
      Hoạt động
    </span>
  );
}

/**
 * Bảng "Nhà cung cấp" của màn Gửi yêu cầu báo giá: ô tìm (tên, mã, email, người liên hệ), lọc "Gửi được (n)" (mặc định)
 * / "Tất cả (n)", "Chọn tất cả n nhà cung cấp gửi được" / "Bỏ chọn tất cả", mỗi dòng một ô chọn (bấm cả dòng cũng chọn),
 * phân trang khi quá NGUONG_CONG_CU nhà cung cấp. Nhà cung cấp ngừng hoạt động / chưa có email: không chọn được; chưa có
 * email thì có "Cập nhật email" (khi `suaDuoc`).
 * - `dong`: tinhGuiBaoGia.dongNhaCungCap. `chon`: Set id đã chọn; `onDoiChon(Set)`.
 * - `loi`: câu lỗi tải danh sách LẦN ĐẦU (chưa có dữ liệu → chỉ hiện dòng lỗi + "Thử lại"; lỗi khi tải lại thì màn giữ
 *   bảng và báo ở dòng thông báo); `dangTai`: đang tải lần đầu.
 * - Màn giữ trạng thái tìm / lọc / trang (đổi khi thêm nhà cung cấp mới).
 */
export default function BangNhaCungCap({
  dong,
  chon,
  onDoiChon,
  tuKhoa,
  onDoiTuKhoa,
  loc,
  onDoiLoc,
  trang,
  coTrang,
  onDoiTrang,
  onDoiCoTrang,
  suaDuoc = false,
  onSuaEmail,
  onThem,
  loi,
  dangTai = false,
  onThuLai,
}) {
  const idBang = useId();
  const soGuiDuoc = dong.filter((d) => d.guiDuoc).length;
  const ketQua = locNhaCungCap(dong, { loc, tuKhoa });
  const dangTim = Boolean(String(tuKhoa ?? "").trim());
  const coPhanTrang = dong.length > NGUONG_CONG_CU && ketQua.length > 0;
  const cat = phanTrang(ketQua, trang, coPhanTrang ? coTrang : Infinity);
  const chuaChon = ketQua.filter((d) => d.guiDuoc && !chon.has(d.id));
  const ngoaiLoc = cauKhopNgoaiLoc(dong, { loc, tuKhoa });

  const doi = (d) => {
    if (!d.guiDuoc) return;
    const moi = new Set(chon);
    if (moi.has(d.id)) moi.delete(d.id);
    else moi.add(d.id);
    onDoiChon(moi);
  };
  const doiTuKhoa = (chu) => {
    onDoiTuKhoa(chu);
    onDoiTrang(0);
  };

  return (
    <section aria-labelledby={`${idBang}-tieu-de`} className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-5 sm:px-6">
        <h2 id={`${idBang}-tieu-de`} className="text-base font-semibold leading-6 text-bo-foreground">Nhà cung cấp</h2>
        {!loi && !dangTai ? (
          <p className="m-0 text-[13px] leading-5 text-bo-muted tabular-nums">
            {soVN(dong.length)} nhà cung cấp · {soVN(soGuiDuoc)} gửi được
          </p>
        ) : null}
      </div>

      {loi ? (
        <div className="px-4 pb-5 sm:px-6">
          <DongThongBao tone="bad" actions={<NutChu onClick={onThuLai}>Thử lại</NutChu>}>
            Không tải được danh sách nhà cung cấp: {loi}. Thông tin yêu cầu nhập hàng vẫn dùng được.
          </DongThongBao>
        </div>
      ) : dangTai ? (
        <p role="status" className="px-4 pb-6 text-sm text-bo-muted sm:px-6">Đang tải danh sách nhà cung cấp…</p>
      ) : (
        <>
          <ThanhCongCuBang
            tuKhoa={tuKhoa}
            onDoiTuKhoa={doiTuKhoa}
            onXoaTuKhoa={() => doiTuKhoa("")}
            goiYTim="Tìm theo tên, mã, email hoặc người liên hệ"
            nhanTim="Tìm nhà cung cấp"
            ketQua={dangTim ? (ketQua.length ? `Tìm thấy ${soVN(ketQua.length)} nhà cung cấp` : "Không có kết quả") : ""}
            khongKetQua={dangTim && !ketQua.length}
            boLoc={
              <NutPhanDoan
                nhan="Lọc nhà cung cấp"
                value={loc}
                onChange={(ma) => {
                  onDoiLoc(ma);
                  onDoiTrang(0);
                }}
                luaChon={[
                  { value: "duoc", label: "Gửi được", count: soGuiDuoc },
                  { value: "tatCa", label: "Tất cả", count: dong.length },
                ]}
              />
            }
          />
          {chuaChon.length || chon.size ? (
            <div className="-mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 sm:px-6">
              {chuaChon.length ? (
                <NutChu onClick={() => onDoiChon(new Set([...chon, ...chuaChon.map((d) => d.id)]))}>
                  {chuChonTatCa(chuaChon.length, dangTim)}
                </NutChu>
              ) : null}
              {chon.size ? (
                <NutChu className="text-bo-muted" onClick={() => onDoiChon(new Set())}>
                  Bỏ chọn tất cả
                </NutChu>
              ) : null}
            </div>
          ) : null}

          {cat.muc.length ? (
            <div className={KHUNG_CUON}>
              <table className={cn(BANG, "@2xl/khoi:min-w-[620px]")}>
                <thead>
                  <tr className={DONG_TIEU_DE}>
                    <th scope="col" className={cn(O_TIEU_DE, O_DAU, "w-12")}>
                      <span className="sr-only">Chọn</span>
                    </th>
                    <th scope="col" className={O_TIEU_DE}>Nhà cung cấp</th>
                    <th scope="col" className={cn(O_TIEU_DE, "w-[240px]", AN_DIEN_THOAI)}>Liên hệ</th>
                    <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-[150px]", AN_DIEN_THOAI)}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.muc.map((d) => {
                    const daChon = chon.has(d.id);
                    return (
                      <tr
                        key={d.id}
                        onClick={() => doi(d)}
                        className={cn(
                          DONG,
                          // Dòng không chọn được: chữ mờ, không đổi nền khi rê chuột
                          d.guiDuoc ? "cursor-pointer" : "text-slate-500 hover:bg-transparent",
                          daChon && DONG_SANG,
                        )}
                      >
                        <td className={cn(O, O_DAU)}>
                          <input
                            type="checkbox"
                            data-ncc-id={d.id}
                            checked={daChon}
                            disabled={!d.guiDuoc}
                            onChange={() => doi(d)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Chọn ${d.ten}`}
                            className="size-4 cursor-pointer accent-bo-primary disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className={cn(O, "@max-2xl/khoi:pr-4")}>
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden="true"
                              className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white",
                                d.guiDuoc ? MAU_O_TRON[Number(d.id) % MAU_O_TRON.length] : "bg-slate-300",
                              )}
                            >
                              {chuVietTat(d.ten)}
                            </span>
                            {/* Tên dài xuống dòng (tối đa 2 dòng rồi "…"), không đẩy giãn cột */}
                            <span className="block min-w-0">
                              <span
                                className={cn("line-clamp-2 break-words font-medium leading-5", d.guiDuoc ? "text-bo-foreground" : "text-bo-muted")}
                                title={d.ten}
                              >
                                {d.ten}
                              </span>
                              <span className="block break-all font-mono text-xs text-bo-muted">{d.ma || "—"}</span>
                              <span className={cn("mt-1 block", CHI_DIEN_THOAI)}>
                                <span className="block break-all text-xs text-bo-muted">{d.email || d.nguoiLienHe || ""}</span>
                                <TrangThaiNcc d={d} suaDuoc={suaDuoc} onSuaEmail={onSuaEmail} />
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className={cn(O, "text-[13px] leading-[18px]", d.guiDuoc ? "text-slate-700" : "text-bo-muted", AN_DIEN_THOAI)}>
                          <span className="block break-words">{d.nguoiLienHe || "—"}</span>
                          <span className="block break-all text-xs text-bo-muted">{d.email || "Chưa có email"}</span>
                        </td>
                        <td className={cn(O, O_CUOI, AN_DIEN_THOAI)}>
                          <TrangThaiNcc d={d} suaDuoc={suaDuoc} onSuaEmail={onSuaEmail} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!dong.length ? (
            <KhongKetQua
              chu="Chưa có nhà cung cấp nào."
              nhanNut={onThem ? "Thêm nhà cung cấp" : undefined}
              onNut={onThem}
            />
          ) : ngoaiLoc ? (
            // Tìm ở "Gửi được" không ra nhưng ở "Tất cả" có (chưa có email → "Cập nhật email" ở đó)
            <KhongKetQua
              chu={ngoaiLoc}
              nhanNut="Xem tất cả"
              onNut={() => {
                onDoiLoc("tatCa");
                onDoiTrang(0);
              }}
            />
          ) : dangTim && !ketQua.length ? (
            <div className="border-t border-slate-100 px-4 py-8 text-center text-sm leading-6 text-bo-muted sm:px-6" role="status">
              Không có nhà cung cấp nào khớp “{String(tuKhoa).trim()}”.{" "}
              <NutChu className="text-sm" onClick={() => doiTuKhoa("")}>Xóa tìm kiếm</NutChu>
              {onThem ? (
                <>
                  {" · "}
                  <NutChu className="text-sm" onClick={onThem}>Thêm nhà cung cấp mới</NutChu>
                </>
              ) : null}
            </div>
          ) : !ketQua.length ? (
            <KhongKetQua
              chu="Chưa có nhà cung cấp nào gửi được (đang hoạt động và có email)."
              nhanNut="Xem tất cả"
              onNut={() => onDoiLoc("tatCa")}
            />
          ) : null}
          {coPhanTrang ? (
            <PhanTrangBang
              page={cat.trang}
              size={coTrang}
              total={ketQua.length}
              onPageChange={onDoiTrang}
              onSizeChange={onDoiCoTrang}
              sizeOptions={CO_TRANG_DONG}
              sizeLabel="dòng"
              totalLabel="nhà cung cấp"
            />
          ) : null}
        </>
      )}
    </section>
  );
}
