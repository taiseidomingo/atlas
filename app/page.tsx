import HomeSearch from "./components/HomeSearch";
import FeatureCards from "./components/FeatureCards";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>Find your way around CvSU Imus</h1>
        <p>
          ATLAS is your smart campus guide: indoor and outdoor directions, floor
          plans, and an assistant that knows where your professors are.
        </p>
        <HomeSearch />
      </section>
      <FeatureCards />
    </>
  );
}
