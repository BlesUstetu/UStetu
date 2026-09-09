import Header from "@/components/Header";

export default function HomePage() {
  return (
    <main className="app-shell">
      <Header />

      <section className="foundation-stage">
        <div className="planet" aria-hidden="true" />
        <div className="foundation-copy">
          <span className="eyebrow">USTETU WEB3 MARKETPLACE</span>
          <h1>Own What’s Next.</h1>
          <p>
            The Next.js Web3 foundation is ready for the marketplace layer.
            Base Sepolia, wallet connection, dark/light mode, and multilingual
            controls are now wired into the application shell.
          </p>
        </div>
      </section>
    </main>
  );
}
