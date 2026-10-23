"use client";

import Link from "next/link";

export default function WelcomePage() {
  const features = [
    {
      icon: "📷",
      title: "Live Detection",
      description: "See supported gestures detected through your camera.",
    },
    {
      icon: "🤟",
      title: "Gesture Recognition",
      description: "Explore six hand gestures with clear meanings.",
    },
    {
      icon: "🆘",
      title: "SOS Sequence",
      description: "Try the supported SOS gesture sequence.",
    },
  ];

  const gestures = [
    { icon: "🖐️", name: "Open Palm", meaning: "Hello", color: "bg-violet-50" },
    { icon: "✌️", name: "Peace Sign", meaning: "Peace", color: "bg-blue-50" },
    { icon: "👍", name: "Thumbs Up", meaning: "Good job", color: "bg-green-50" },
    { icon: "🆘", name: "SOS Gesture", meaning: "Help signal", color: "bg-rose-50" },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f7ff] text-slate-900">
      <nav className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-5 md:px-16">
        <Link href="/camera" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-xl text-white">
            ✋
          </div>
          <span className="text-xl font-bold tracking-tight">
            Gesture<span className="text-indigo-600">Play</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#about" className="hover:text-indigo-600">About</a>
          <a href="#features" className="hover:text-indigo-600">Features</a>
          <a href="#how" className="hover:text-indigo-600">How It Works</a>
        </div>

        <Link
          href="/camera"
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
        >
          Get Started →
        </Link>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:px-16 md:py-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-medium text-indigo-700">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Your hands. A whole new experience.
          </div>

          <h1 className="text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
            Turn Your
            <span className="block text-indigo-600">Gestures</span>
            Into Words.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
            Explore the power of hand gestures with real-time camera
            detection. Interact, discover, and communicate in a whole
            new way with Gesture Play.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/camera"
              className="rounded-xl bg-indigo-600 px-7 py-4 font-semibold text-white shadow-xl shadow-indigo-200 transition hover:-translate-y-1 hover:bg-indigo-700"
            >
              Enter Gesture Play →
            </Link>
            <a
              href="#about"
              className="rounded-xl border border-slate-200 bg-white px-7 py-4 font-semibold text-slate-700 transition hover:border-indigo-300"
            >
              Discover More
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-5 text-sm text-slate-500">
            <span>✓ No sign-up required</span>
            <span>✓ Works with your camera</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-8 rounded-full bg-indigo-300/30 blur-3xl" />
          <div className="relative rounded-3xl border border-white bg-white p-5 shadow-2xl shadow-indigo-200/50 md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">WELCOME TO</p>
                <h2 className="mt-1 text-2xl font-bold">Gesture Studio</h2>
              </div>
              <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                ● Interactive
              </span>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-4">
              {gestures.map((gesture) => (
                <div
                  key={gesture.name}
                  className={`${gesture.color} rounded-2xl p-6 text-center`}
                >
                  <div className="text-5xl">{gesture.icon}</div>
                  <p className="mt-4 font-semibold">{gesture.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {gesture.meaning}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-sm text-slate-400">READY TO EXPLORE?</p>
              <p className="mt-1 text-lg font-semibold">
                Your gestures tell a story.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="about"
        className="border-t border-slate-200 bg-white px-6 py-16 text-center"
      >
        <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">
          Meet Gesture Play
        </p>
        <h2 className="mt-3 text-3xl font-bold">
          Technology at your fingertips.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
          Gesture Play uses your camera to recognize supported hand
          gestures and display their meanings in real time.
        </p>
      </section>

      <section
        id="features"
        className="grid gap-5 px-6 py-12 md:grid-cols-3 md:px-16"
      >
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <div className="text-3xl">{feature.icon}</div>
            <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
            <p className="mt-2 leading-6 text-slate-600">
              {feature.description}
            </p>
          </div>
        ))}
      </section>

      <section id="how" className="px-6 py-12 text-center">
        <h2 className="text-3xl font-bold">Ready to give it a try?</h2>
        <p className="mt-3 text-slate-600">
          Open the app and start exploring your gestures.
        </p>
        <Link
          href="/camera"
          className="mt-6 inline-block rounded-xl bg-indigo-600 px-8 py-4 font-semibold text-white transition hover:bg-indigo-700"
        >
          Get Started →
        </Link>
      </section>

      <footer className="mt-8 border-t border-slate-200 bg-white px-6 py-6 text-center text-sm text-slate-500">
        © 2026 Gesture Play · Made to make interactions more intuitive.
      </footer>
    </main>
  );
}n