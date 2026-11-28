"use client";

import { useRouter } from "next/navigation";
import Icon, { type IconName } from "./Icon";

const FEATURES: { icon: IconName; title: string; text: string; action: "map" | "chat" | "floors" }[] = [
  {
    icon: "map",
    title: "Campus map",
    text: "Walking routes between any two places.",
    action: "map",
  },
  {
    icon: "layers",
    title: "Floor plans",
    text: "Every building, floor by floor.",
    action: "floors",
  },
  {
    icon: "sparkle",
    title: "Ask ATLAS",
    text: "Find rooms and professors by asking.",
    action: "chat",
  },
];

export default function FeatureCards() {
  const router = useRouter();
  return (
    <nav className="quickLinks" aria-label="Get started">
      {FEATURES.map((f) => (
        <button
          key={f.title}
          type="button"
          className="quickLink"
          onClick={() => {
            if (f.action === "chat") window.dispatchEvent(new Event("atlas:open-chat"));
            else router.push(f.action === "floors" ? "/navigation?view=new" : "/navigation");
          }}
        >
          <span className="quickIcon" aria-hidden="true">
            <Icon name={f.icon} size={20} />
          </span>
          <span className="quickText">
            <strong>{f.title}</strong>
            <span>{f.text}</span>
          </span>
          <Icon name="arrowRight" size={18} className="quickGo" />
        </button>
      ))}
    </nav>
  );
}
