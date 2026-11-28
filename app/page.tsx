import HomeSearch from "./components/HomeSearch";
import FeatureCards from "./components/FeatureCards";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>Find your way around CvSU Imus</h1>
        <p>Search a room, office or professor — ATLAS shows it on the map and walks you there.</p>
        <HomeSearch />
      </section>
      <FeatureCards />
    </>
  );
}
