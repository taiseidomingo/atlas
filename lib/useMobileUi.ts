import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-ui"],
  });
  return () => mo.disconnect();
}

export function useMobileUi(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.ui === "mobile",
    () => false,
  );
}