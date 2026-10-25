import Hero from "../modules/landing/hero"
import FeaturesSection from "../modules/landing/features-section"
import DesktopSection from "../modules/landing/desktop-section"
import ArtifactsSection from "../modules/landing/artifacts-section"
import MemorySection from "../modules/landing/memory-section"
import SchedulesSection from "../modules/landing/schedules-section"
import CtaSection from "../modules/landing/cta-section"
import Footer from "../modules/landing/footer"

export default function Home() {
  return (
    <main className="flex flex-col">
      <Hero />
      <FeaturesSection />
      <DesktopSection />
      <ArtifactsSection />
      <MemorySection />
      <SchedulesSection />
      <CtaSection />
      <Footer />
    </main>
  )
}
