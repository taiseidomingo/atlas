"use client";

import { useRouter } from "next/navigation";

export default function FeatureCards() {
  const router = useRouter();
  return (
    <div className="grid3">
      <button
        type="button"
        className="card feature"
        onClick={() => router.push("/navigation")}
      >
        <span className="emoji">🧭</span>
        <h3>Campus Navigation</h3>
        <p>
          Pick a start and destination and get the shortest walking route with
          distance.
        </p>
      </button>
      <button
        type="button"
        className="card feature"
        onClick={() => window.dispatchEvent(new Event("atlas:open-chat"))}
      >
        <span className="emoji">🤖</span>
        <h3>ATLAS Assistant</h3>
        <p>Ask where a professor is right now, or how to reach a room.</p>
      </button>
      <button
        type="button"
        className="card feature"
        onClick={() => router.push("/navigation?view=new")}
      >
        <span className="emoji">🏢</span>
        <h3>Indoor Floor Plans</h3>
        <p>Explore the New and Old Buildings floor by floor.</p>
      </button>
    </div>
  );
}
