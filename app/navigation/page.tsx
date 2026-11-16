import { Suspense } from "react";
import NavigationView from "../components/NavigationView";

export default function NavigationPage() {
  return (
    <Suspense fallback={null}>
      <NavigationView />
    </Suspense>
  );
}
