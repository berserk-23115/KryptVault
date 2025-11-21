import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const features = [
  {
    title: "Encrypted Vaults",
    body: "End-to-end encrypted file storage with zero-knowledge design.",
  },
  {
    title: "Password-Protected Links",
    body: "Unlock files only for trusted people you explicitly authorize.",
  },
  {
    title: "Auto-Expiring Links",
    body: "Set precise expiry windows so access naturally shuts down.",
  },
  {
    title: "Download Control",
    body: "Limit download counts to exactly what you decide.",
  },
  {
    title: "Access Tracking",
    body: "See who accessed what and revoke links instantly.",
  },
  {
    title: "Kill Switch",
    body: "One-click shutdown for all shared links in a vault.",
  },
  {
    title: "Cloud-Based Privacy",
    body: "Designed for individuals and teams that treat privacy as a feature.",
  },
  {
    title: "VPN-Assisted Process",
    body: "Harden file transfers even on untrusted networks.",
  },
];

function AnimatedFolder() {
  return (
    <div className="group relative mx-auto h-24 w-28 md:h-28 md:w-32">
      {/* Glow */}
      <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-purple-500/30 via-fuchsia-500/20 to-cyan-400/30 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

      {/* Folder body */}
      <div className="relative h-full w-full rounded-3xl bg-gradient-to-br from-[#1c1429] to-[#281a3a] border border-white/10 shadow-lg shadow-purple-900/60 overflow-hidden">
        {/* Back panel */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 via-fuchsia-500/10 to-sky-400/15" />

        {/* Lid */}
        <div className="folder-lid absolute left-2 right-4 top-2 h-6 rounded-t-2xl bg-gradient-to-r from-purple-400 to-fuchsia-400 origin-[10%_100%] group-hover:folder-lid-open" />

        {/* Front panel */}
        <div className="absolute inset-x-2 bottom-2 top-5 rounded-2xl bg-gradient-to-br from-[#120b1d] via-[#190f28] to-[#241434] border border-white/10">
          {/* Icon / badge */}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-purple-500/30 border border-purple-300/40 flex items-center justify-center text-xs font-semibold">
              KV
            </div>
            <div className="h-2 w-16 rounded-full bg-purple-300/50" />
          </div>

          {/* Mini stats */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-purple-100/80">
            <div className="space-y-1">
              <div className="flex gap-1.5">
                <span className="inline-flex h-1.5 w-6 rounded-full bg-emerald-400/80" />
                <span className="inline-flex h-1.5 w-5 rounded-full bg-purple-300/70" />
              </div>
              <span className="text-[9px] uppercase tracking-wide text-purple-200/70">
                Vault Sync
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex h-1.5 w-6 rounded-full bg-sky-400/80" />
              <span className="inline-flex h-1.5 w-4 rounded-full bg-fuchsia-400/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeComponent() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050311] text-white">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-[-10%] h-80 w-80 rounded-full bg-purple-700/30 blur-3xl" />
        <div className="absolute top-40 right-[-10%] h-96 w-96 rounded-full bg-fuchsia-600/30 blur-3xl" />
        <div className="absolute bottom-[-20%] left-1/4 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12)_0,_transparent_55%)]" />
      </div>

      <div className="relative z-10">
        <div className="container mx-auto max-w-6xl px-4 py-10 md:py-16">
          {/* Top bar */}
          <header className="mb-12 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-500/20 border border-purple-300/40 shadow-md shadow-purple-500/40">
                <span className="text-sm font-semibold tracking-tight text-purple-100">
                  KV
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium tracking-tight">
                  Krypt Vault
                </span>
                <span className="text-xs text-purple-100/60">
                  Secure storage & sharing for Linux & macOS
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs md:text-sm">
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-medium text-emerald-200 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Encrypted by design
              </span>
              <Link
                to="/login"
                className="hidden md:inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition"
              >
                Open app
              </Link>
            </div>
          </header>

          {/* Hero */}
          <main className="grid gap-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-center">
            {/* Left side: copy + CTAs */}
            <section className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-100/80 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-300 animate-ping" />
                <span>Secure file vault for humans, not checklists.</span>
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-tight">
                  File storage that
                  <span className="block bg-gradient-to-r from-purple-200 via-fuchsia-200 to-sky-200 bg-clip-text text-transparent">
                    assumes the network is hostile.
                  </span>
                </h1>
                <p className="max-w-xl text-sm md:text-base text-purple-100/70">
                  Krypt Vault is a redefined secure storage and file sharing
                  layer with granular control baked into every step: vaults,
                  links, downloads, and revocation — all observable and
                  reversible.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 px-6 py-2.5 text-sm font-medium shadow-lg shadow-purple-500/40 hover:from-purple-400 hover:to-fuchsia-400 transition"
                >
                  Open Krypt Vault
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition"
                >
                  View capabilities
                </a>
                <div className="flex items-center gap-2 text-[11px] text-purple-100/80">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Linux & macOS · Desktop-first</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-4 text-[11px] text-purple-100/60">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-[9px]">
                    E2E
                  </span>
                  <span>End-to-end encrypted vaults</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-[9px]">
                    CTRL
                  </span>
                  <span>Per-link expiry & download control</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-[9px]">
                    LOG
                  </span>
                  <span>Access logs & instant kill switch</span>
                </div>
              </div>
            </section>

            {/* Right side: black hole + folder */}
            <section className="space-y-6">
              {/* Black hole container */}
              <div className="relative mx-auto h-72 w-72 md:h-80 md:w-80">
                {/* Outer halo */}
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(168,85,247,0.05)_0,_transparent_60%)]" />

                {/* Rotating accretion disk */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="blackhole-orbit relative h-56 w-56 rounded-full bg-[conic-gradient(from_140deg,_rgba(244,114,182,0.2),_rgba(56,189,248,0.15),_rgba(168,85,247,0.4),_rgba(244,114,182,0.2))] opacity-80 blur-[1px]" />
                </div>

                {/* Inner ring */}
                <div className="absolute inset-8 flex items-center justify-center">
                  <div className="h-40 w-40 rounded-full border border-purple-200/35 shadow-[0_0_40px_rgba(168,85,247,0.55)]" />
                </div>

                {/* Event horizon */}
                <div className="absolute inset-16 flex items-center justify-center">
                  <div className="blackhole-core h-28 w-28 rounded-full bg-gradient-to-b from-black via-[#050014] to-black shadow-[0_0_45px_rgba(0,0,0,1)]" />
                </div>

                {/* Subtle lensing streaks */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="blackhole-streak absolute left-0 right-0 top-1/2 h-10 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-purple-300/50 to-transparent blur-md opacity-50" />
                  <div className="blackhole-streak-delayed absolute left-1/4 right-1/4 top-1/2 h-8 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-fuchsia-300/40 to-transparent blur-md opacity-40" />
                </div>

                {/* Laser-like beam under the black hole */}
                <div className="absolute -bottom-7 left-1/2 h-1.5 w-[130%] -translate-x-1/2 overflow-hidden rounded-full bg-purple-500/20">
                  <div className="laser-flow h-full w-full" />
                </div>

                {/* Glassy box under black hole */}
                <div className="absolute -bottom-32 left-1/2 w-[110%] -translate-x-1/2 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="font-medium text-purple-50">
                          Live vault protections
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-100/80">
                        Password links · Expiry timers · Download caps · Kill
                        switch
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[10px] text-purple-100/70">
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5">
                        Zero-knowledge surface
                      </span>
                      <span className="rounded-full bg-sky-500/20 px-2 py-0.5">
                        VPN-assisted flows
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Folder animation under the whole blackhole block */}
              <AnimatedFolder />
            </section>
          </main>

          {/* Features / capabilities */}
          <section id="features" className="mt-16 md:mt-20 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-semibold tracking-tight">
                  What Krypt Vault controls for you.
                </h2>
                <p className="max-w-xl text-xs md:text-sm text-purple-100/70">
                  Tight, opinionated primitives around storage, sharing, and
                  revocation — so “just sending a file” doesn&apos;t become a
                  long-term risk.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-purple-100/70">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  Desktop-native · Linux & macOS
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  Designed for teams & individuals
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-[#0b0616] via-[#12091f] to-[#1a102b] p-4 text-xs md:text-sm shadow-[0_14px_40px_rgba(10,10,25,0.9)]"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute -top-20 right-0 h-40 w-40 rounded-full bg-purple-500/30 blur-3xl" />
                  </div>

                  <div className="relative space-y-2">
                    <div className="inline-flex items-center gap-1 rounded-full border border-purple-300/30 bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-100/90">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-300" />
                      Control surface
                    </div>
                    <h3 className="text-sm font-medium text-purple-50">
                      {feature.title}
                    </h3>
                    <p className="text-[11px] text-purple-100/75">
                      {feature.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-10 md:mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5 text-[11px] text-purple-100/60">
            <span>© {new Date().getFullYear()} Krypt Vault.</span>
            <div className="flex flex-wrap gap-3">
              <span>Security-first file storage & sharing.</span>
              <span className="hidden md:inline-block">
                Coming soon to production channels.
              </span>
            </div>
          </footer>
        </div>
      </div>

      {/* Custom animations */}
      <style>
        {`
          @keyframes blackholeOrbit {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.04); }
            100% { transform: rotate(360deg) scale(1); }
          }
          .blackhole-orbit {
            animation: blackholeOrbit 16s linear infinite;
          }

          @keyframes blackholeCore {
            0%, 100% { box-shadow: 0 0 40px rgba(15,23,42,0.9), 0 0 80px rgba(59,130,246,0.25); }
            50% { box-shadow: 0 0 55px rgba(15,23,42,1), 0 0 120px rgba(168,85,247,0.45); }
          }
          .blackhole-core {
            animation: blackholeCore 5s ease-in-out infinite;
          }

          @keyframes blackholeStreak {
            0% { transform: translateX(-10%) translateY(-50%); opacity: 0.3; }
            50% { transform: translateX(10%) translateY(-50%); opacity: 0.6; }
            100% { transform: translateX(-10%) translateY(-50%); opacity: 0.3; }
          }
          .blackhole-streak {
            animation: blackholeStreak 7s ease-in-out infinite;
          }
          .blackhole-streak-delayed {
            animation: blackholeStreak 9s ease-in-out infinite;
            animation-delay: 1.5s;
          }

          @keyframes laserFlow {
            0% { transform: translateX(-50%); background-position: 0% 50%; }
            100% { transform: translateX(0); background-position: 200% 50%; }
          }
          .laser-flow {
            background-image: linear-gradient(
              90deg,
              rgba(59,130,246,0) 0%,
              rgba(59,130,246,0.7) 20%,
              rgba(236,72,153,0.8) 50%,
              rgba(129,140,248,0.8) 80%,
              rgba(59,130,246,0) 100%
            );
            background-size: 200% 100%;
            animation: laserFlow 3.5s linear infinite;
          }

          @keyframes folderLidOpen {
            0% { transform: rotateX(0deg); }
            50% { transform: rotateX(-22deg); }
            100% { transform: rotateX(0deg); }
          }
          .folder-lid {
            transform-origin: 12% 100%;
          }
          .folder-lid-open {
            animation: folderLidOpen 2.8s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
}
