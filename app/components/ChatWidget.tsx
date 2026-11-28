"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AssistantChat from "./AssistantChat";
import Icon from "./Icon";
import { chat, useChat } from "@/lib/chatStore";
import styles from "./ChatWidget.module.css";

/**
 * Floating assistant for every page except the map page (which has the
 * assistant built into its panel). The conversation is shared, so when an
 * answer needs the map the app switches to the map page and carries on there.
 */
export default function ChatWidget() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { mapRequest } = useChat();
  const onMapPage = pathname === "/navigation";
  const seenRequest = useRef(mapRequest);

  useEffect(() => {
    const openChat = (e: Event) => {
      setOpen(true);
      const question = (e as CustomEvent<{ question?: string }>).detail?.question;
      if (question) chat.send(question);
    };
    window.addEventListener("atlas:open-chat", openChat);
    return () => window.removeEventListener("atlas:open-chat", openChat);
  }, []);

  // An answer that moves the map: go to the map page (the panel takes over).
  useEffect(() => {
    if (seenRequest.current === mapRequest) return;
    seenRequest.current = mapRequest;
    if (!onMapPage) {
      router.push("/navigation");
    }
  }, [mapRequest, onMapPage, router]);

  useEffect(() => {
    if (onMapPage) {
      const timer = setTimeout(() => setOpen(false), 0);
      return () => clearTimeout(timer);
    }
  }, [onMapPage]);

  if (onMapPage) return null;

  if (!open) {
    return (
      <button type="button" className={styles.fab} onClick={() => setOpen(true)}>
        <span className={styles.fabIcon} aria-hidden="true">
          <Icon name="sparkle" size={18} />
        </span>
        Ask ATLAS
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <AssistantChat
        onClose={() => setOpen(false)}
        onMapRequest={() => router.push("/navigation")}
        autoFocus
      />
    </div>
  );
}
