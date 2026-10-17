// Bàn phím cho nhóm tab (WAI-ARIA Tabs): mũi tên trái / phải (lên / xuống), Home, End chuyển tab và đưa tiêu điểm
// sang tab mới. Tab đang chọn có tabIndex 0, các tab khác -1 (roving tabindex).

/**
 * @param {KeyboardEvent} e
 * @param {string[]} keys  khóa các tab theo thứ tự hiển thị
 * @param {string} hien    khóa tab đang chọn
 * @param {(k: string) => void} chon
 * @param {string} tienTo  tiền tố id của nút tab (id = tienTo + khóa)
 */
export function phimTab(e, keys, hien, chon, tienTo) {
  const i = keys.indexOf(hien);
  let j = null;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % keys.length;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + keys.length) % keys.length;
  else if (e.key === "Home") j = 0;
  else if (e.key === "End") j = keys.length - 1;
  if (j == null) return;
  e.preventDefault();
  chon(keys[j]);
  document.getElementById(`${tienTo}${keys[j]}`)?.focus();
}
