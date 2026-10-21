import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, UserCheck, Users } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/shared/SearchInput";
import {
  CHAN_HOP,
  DAU_HOP,
  GHI_CHU_HOP,
  HOP,
  MO_TA_HOP,
  NUT_CHINH,
  NUT_QUAY_LAI,
  THAN_HOP,
  TIEU_DE_HOP,
} from "@/components/chung-tu/kieuHopThoai";
import { cauMayChuPhieuNhat } from "@/components/outbound/phieu-nhat/tinhPhieuNhat";
import { nhatHangService } from "@/services/nhatHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { getCurrentUserId, hasAnyRole, ROLES } from "@/utils/roles";
import { normalizeText } from "@/mocks/mockHelpers";
import { cn } from "@/lib/utils";

/**
 * Phân công người nhặt cho phiếu nhặt hàng (màn chi tiết và danh sách phiếu nhặt). Kiểu hộp chung của các màn chứng từ
 * (chung-tu/kieuHopThoai: không nút ×, đóng bằng "Quay lại").
 * - Quản trị viên / quản lý kho: chọn người trong danh sách nhân viên kho.
 * - Mọi vai trò kho: "Nhận việc" (tự phân công cho mình) — bắt buộc phân công trước khi nhặt, kể cả quản lý.
 * - Nhân viên kho chỉ nhận phiếu chưa có người nhặt (backend từ chối phiếu đã giao cho người khác).
 */
export default function AssignPickerDialog({ open, onOpenChange, pickList, onAssigned }) {
  const canAssignOthers = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
  const isAdmin = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const currentUserId = getCurrentUserId();
  const daLaCuaToi = pickList?.nguoiNhatId != null && Number(pickList.nguoiNhatId) === Number(currentUserId);
  const daGiaoNguoiKhac = pickList?.nguoiNhatId != null && !daLaCuaToi;

  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  // Thao tác đang chạy: "nhanViec" (Nhận việc cho tôi) | "phanCong" (Phân công) | null — vòng quay hiện đúng nút đã bấm
  const [dangChay, setDangChay] = useState(null);
  const saving = dangChay != null;
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open || !canAssignOthers) return undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoadingStaff(true);
      setStaffError("");
      setSelectedId(pickList?.nguoiNhatId ?? null);
    });
    nhatHangService
      .getNguoiNhat({ isAdmin })
      .then((list) => {
        if (!cancelled) setStaff(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setStaffError("Chưa lấy được danh sách nhân viên kho. Bạn vẫn có thể nhận việc cho mình.");
      })
      .finally(() => {
        if (!cancelled) setLoadingStaff(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, canAssignOthers, isAdmin, pickList?.nguoiNhatId]);

  const filteredStaff = useMemo(() => {
    const key = normalizeText(keyword);
    return staff.filter((person) => !key || normalizeText(`${person.hoTen} ${person.tenDangNhap ?? ""}`).includes(key));
  }, [staff, keyword]);

  const assign = async (nguoiNhatId, thaoTac) => {
    if (!pickList || !nguoiNhatId || savingRef.current) return;
    savingRef.current = true;
    setDangChay(thaoTac);
    try {
      const dto = await nhatHangService.phanCong(pickList.id, { nguoiNhatId });
      toast.success(`Đã phân công ${pickList.maPickList} cho ${dto?.tenNguoiNhat || "nhân viên"}`);
      onAssigned?.(dto);
      onOpenChange(false);
    } catch (error) {
      toast.error(cauMayChuPhieuNhat(getApiErrorMessage(error, "Không thể phân công người nhặt")));
    } finally {
      savingRef.current = false;
      setDangChay(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent showCloseButton={false} className={HOP}>
        <DialogHeader className={DAU_HOP}>
          <DialogTitle className={TIEU_DE_HOP}>Phân công người nhặt</DialogTitle>
          <DialogDescription className={MO_TA_HOP}>
            {pickList ? `Phiếu nhặt hàng ${pickList.maPickList}` : ""}
            {pickList?.tenNguoiNhat ? ` · đang giao cho ${pickList.tenNguoiNhat}` : " · chưa có người nhặt"}
          </DialogDescription>
        </DialogHeader>

        <div className={THAN_HOP}>
          {canAssignOthers ? (
            <div className="space-y-3">
              <SearchInput
                className="sm:max-w-none"
                placeholder="Tìm theo tên hoặc tài khoản"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onClear={() => setKeyword("")}
              />
              <div className="max-h-64 overflow-y-auto rounded-lg border border-bo-border">
                {loadingStaff ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-bo-muted">
                    <Loader2 className="size-4 animate-spin" /> Đang tải nhân viên kho
                  </div>
                ) : staffError ? (
                  <p className="px-3 py-6 text-center text-sm text-bo-muted">{staffError}</p>
                ) : filteredStaff.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-bo-muted">Không có nhân viên phù hợp.</p>
                ) : (
                  <ul className="divide-y divide-bo-border">
                    {filteredStaff.map((person) => {
                      const active = selectedId === person.id;
                      return (
                        <li key={person.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(person.id)}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors",
                              active ? "bg-bo-primary-soft" : "hover:bg-bo-surface-subtle",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-bo-foreground">{person.hoTen}</span>
                              <span className="block truncate text-xs text-bo-muted">
                                {person.tenDangNhap || "—"} · {person.vaiTro === ROLES.QUAN_LY_KHO ? "Quản lý kho" : "Nhân viên kho"}
                              </span>
                            </span>
                            {active ? <Check className="size-4 shrink-0 text-bo-primary" /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className={cn("flex items-start gap-3", GHI_CHU_HOP)}>
              <Users className="mt-0.5 size-4 shrink-0 text-bo-muted" />
              <p>Bạn có thể nhận phiếu nhặt hàng này để bắt đầu nhặt hàng. Quản lý kho có thể phân công lại sau.</p>
            </div>
          )}
        </div>

        <div className={CHAN_HOP}>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className={NUT_QUAY_LAI}
          >
            Quay lại
          </Button>
          {/* Nhân viên kho chỉ có việc này: nút chính; quản lý còn nút Phân công nên đây là nút viền */}
          <Button
            type="button"
            variant={canAssignOthers ? "outline" : "default"}
            disabled={saving || !currentUserId || daLaCuaToi || (!canAssignOthers && daGiaoNguoiKhac)}
            onClick={() => assign(currentUserId, "nhanViec")}
            className={canAssignOthers ? cn("gap-1.5", NUT_QUAY_LAI) : NUT_CHINH}
          >
            {dangChay === "nhanViec" ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
            Nhận việc cho tôi
          </Button>
          {canAssignOthers ? (
            <Button
              type="button"
              disabled={saving || !selectedId || selectedId === pickList?.nguoiNhatId}
              onClick={() => assign(selectedId, "phanCong")}
              className={NUT_CHINH}
            >
              {dangChay === "phanCong" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Phân công
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
