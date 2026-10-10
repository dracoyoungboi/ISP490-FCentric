import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hàng đợi gửi mã quét tuần tự: lần sau chỉ gửi khi lần trước xong, không bỏ mã nào
 * kể cả khi Barcode to PC / súng quét bắn nhiều mã liên tiếp.
 * `process(item)` tự bắt lỗi của mình; hàng đợi chỉ lo thứ tự.
 */
export default function useScanQueue(process) {
  const queueRef = useRef([]);
  const runningRef = useRef(false);
  const processRef = useRef(process);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    processRef.current = process;
  }, [process]);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const item = queueRef.current.shift();
        setPending(queueRef.current.length + 1);
        try {
          await processRef.current(item);
        } catch {
          // process tự hiển thị lỗi; tiếp tục mã kế tiếp
        }
      }
    } finally {
      runningRef.current = false;
      setPending(0);
    }
  }, []);

  const enqueue = useCallback(
    (item) => {
      queueRef.current.push(item);
      setPending(queueRef.current.length + (runningRef.current ? 1 : 0));
      run();
    },
    [run],
  );

  const clear = useCallback(() => {
    queueRef.current = [];
  }, []);

  return { enqueue, pending, clear };
}
