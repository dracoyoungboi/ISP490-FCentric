import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPosOwner,
  newCheckoutRequestId,
  posOwnerStorageKey,
  releasePosOwner,
  setPosOwner,
} from '@/services/posService';

// Không có navigator.locks (trang HTTP mở bằng IP nội bộ không phải secure context): hỏi qua
// BroadcastChannel xem đã có tab nào giữ POS chưa, chờ trả lời trong khoảng này.
const PROBE_WAIT_MS = 350;
// "Dùng ở tab này": chờ tab cũ xác nhận đã ngừng ghi nháp rồi mới nạp hóa đơn (tối đa).
const HANDOVER_WAIT_MS = 1000;
// StrictMode/điều hướng nhanh: khóa của lần mount trước có thể chưa kịp nhả.
const ACQUIRE_RETRY_MS = 150;
const ACQUIRE_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });

/**
 * Một phiên giữ quyền "tab POS duy nhất" của một tài khoản trên trình duyệt này.
 * Trạng thái: checking -> owner | blocked; owner -> lost khi tab khác bấm "Dùng ở tab này".
 * Quyền GHI nháp được phân xử bằng posOwner trong localStorage (đồng bộ giữa các tab);
 * navigator.locks / BroadcastChannel chỉ để biết tab giữ quyền còn sống và báo mất quyền.
 */
function createTabLockSession({ userKey, tabId, onStatus }) {
  const lockName = `fcentric-pos:${userKey}`;
  const ownerKey = posOwnerStorageKey(userKey);
  const locks = typeof navigator !== 'undefined' && navigator.locks?.request ? navigator.locks : null;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(lockName) : null;

  let disposed = false;
  let state = 'checking';
  let releaseHeld = null; // nhả navigator.locks đang giữ
  let handoverAck = null; // đang chờ tab cũ báo 'released'
  let heardOwner = false;

  const set = (next) => {
    if (disposed || state === next) return;
    state = next;
    onStatus(next);
  };
  const post = (type) => {
    try { channel?.postMessage({ type, from: tabId }); } catch { /* kênh đã đóng */ }
  };
  const release = () => {
    if (releaseHeld) {
      releaseHeld();
      releaseHeld = null;
    }
  };

  const becomeOwner = () => {
    setPosOwner(userKey, tabId);
    set('owner');
  };

  const lose = () => {
    if (state !== 'owner') return;
    release();
    set('lost');
    post('released'); // báo tab mới: tab này đã ngừng ghi nháp
  };

  // Giữ khóa tới khi tự nhả (dispose/lose); bị tab khác steal -> promise reject AbortError.
  const requestLock = (options, onGranted, onUnavailable) => locks.request(lockName, options, (lock) => {
    if (disposed || !lock) {
      onUnavailable?.();
      return null;
    }
    onGranted();
    return new Promise((resolve) => { releaseHeld = resolve; });
  }).catch(() => {
    releaseHeld = null;
    lose();
  });

  const acquireWithLocks = async () => {
    for (let attempt = 1; attempt <= ACQUIRE_ATTEMPTS && !disposed; attempt += 1) {
      let unavailable = false;
      await new Promise((resolve) => {
        requestLock({ ifAvailable: true }, () => { becomeOwner(); resolve(); }, () => { unavailable = true; resolve(); });
      });
      if (!unavailable || disposed) return;
      // Chính tab này vừa giữ (StrictMode chạy effect hai lần) -> lấy lại ngay.
      if (getPosOwner(userKey) === tabId) {
        requestLock({ steal: true }, becomeOwner);
        return;
      }
      if (attempt < ACQUIRE_ATTEMPTS) await sleep(ACQUIRE_RETRY_MS);
    }
    set('blocked');
  };

  const acquireWithChannel = () => {
    if (!channel) {
      // Không có cả hai API: không phối hợp được, vẫn cho bán (ghi nháp vẫn được posOwner phân xử).
      becomeOwner();
      return undefined;
    }
    heardOwner = false;
    post('probe');
    const timer = window.setTimeout(() => {
      if (disposed) return;
      if (heardOwner) {
        set('blocked');
      } else {
        becomeOwner();
        post('claimed');
      }
    }, PROBE_WAIT_MS);
    return () => window.clearTimeout(timer);
  };

  let cancelProbe;

  const onMessage = (event) => {
    const message = event.data;
    if (disposed || !message || message.from === tabId) return;
    if (message.type === 'probe' && state === 'owner') post('here');
    else if (message.type === 'here') heardOwner = true;
    else if (message.type === 'claimed' && getPosOwner(userKey) !== tabId) lose();
    else if (message.type === 'released') handoverAck?.();
  };

  const onStorage = (event) => {
    if (event.key === ownerKey && event.newValue !== tabId) lose();
  };

  return {
    start() {
      channel?.addEventListener('message', onMessage);
      window.addEventListener('storage', onStorage);
      if (locks) acquireWithLocks();
      else cancelProbe = acquireWithChannel();
    },

    /** "Dùng ở tab này": giành quyền, chờ tab cũ ngừng ghi nháp rồi mới cho nạp hóa đơn. */
    async takeOver() {
      if (disposed || state === 'owner' || state === 'checking') return;
      set('checking');
      const acknowledged = new Promise((resolve) => { handoverAck = resolve; });
      // Ghi quyền trước tiên: từ lúc này mọi lần ghi nháp của tab cũ đều bị từ chối.
      setPosOwner(userKey, tabId);
      post('claimed');
      if (locks) requestLock({ steal: true }, () => {});
      await Promise.race([acknowledged, sleep(HANDOVER_WAIT_MS)]);
      handoverAck = null;
      if (disposed) return;
      if (getPosOwner(userKey) === tabId) set('owner');
      else set('lost');
    },

    dispose() {
      disposed = true;
      cancelProbe?.();
      channel?.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
      release();
      if (state === 'owner') releasePosOwner(userKey, tabId);
      try { channel?.close(); } catch { /* đã đóng */ }
    },
  };
}

/**
 * Mỗi tài khoản chỉ mở màn POS ở MỘT tab trên trình duyệt này (tránh hai tab ghi đè bản nháp
 * của nhau và bán cùng một giỏ hai lần). Hai tài khoản khác nhau dùng khóa khác nhau.
 * Trả về { status: 'checking' | 'owner' | 'blocked' | 'lost', tabId, takeOver }.
 */
export default function usePosTabLock(userKey) {
  const [tabId] = useState(() => newCheckoutRequestId());
  const [status, setStatus] = useState('checking');
  const sessionRef = useRef(null);

  useEffect(() => {
    const session = createTabLockSession({ userKey, tabId, onStatus: setStatus });
    sessionRef.current = session;
    session.start();
    return () => {
      session.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [userKey, tabId]);

  const takeOver = useCallback(() => {
    sessionRef.current?.takeOver();
  }, []);

  return { status, tabId, takeOver };
}
