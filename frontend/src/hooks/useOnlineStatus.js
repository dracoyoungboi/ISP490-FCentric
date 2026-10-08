import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Trạng thái mạng của trình duyệt (navigator.onLine + sự kiện online/offline).
 *
 * Lưu ý: `false` là đáng tin (máy chắc chắn mất mạng), còn `true` chỉ có nghĩa là máy còn
 * nối wifi/LAN — chưa chắc tới được server. Vì vậy chỉ dùng giá trị này để CHẶN thao tác khi
 * offline; lỗi khi đang "online" vẫn phải xử lý theo phản hồi thật của API.
 */
const subscribe = (callback) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};
const getSnapshot = () => (typeof navigator === 'undefined' ? true : navigator.onLine);
const getServerSnapshot = () => true;

export default function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Gọi `callback` mỗi lần trình duyệt có mạng trở lại (offline -> online). */
export function useOnReconnect(callback) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  useEffect(() => {
    const onOnline = () => callbackRef.current?.();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
}

/** Lỗi do không tới được server (mất mạng/không phản hồi), không phải lỗi nghiệp vụ. */
export const isNetworkError = (error) =>
  (typeof navigator !== 'undefined' && !navigator.onLine)
  || error?.code === 'ERR_NETWORK'
  || (Boolean(error?.request) && !error?.response && error?.code !== 'ERR_CANCELED');
