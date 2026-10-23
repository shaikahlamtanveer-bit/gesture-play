
"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

type Point = { x: number; y: number; z: number };
type SOSPose = "open" | "closed" | null;
type Facing = "user" | "environment";

const dist = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function angle(a: Point, b: Point, c: Point) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const d = Math.hypot(ba.x, ba.y, ba.z) * Math.hypot(bc.x, bc.y, bc.z);
  if (!d) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (ba.x * bc.x + ba.y * bc.y + ba.z * bc.z) / d))) * 180 / Math.PI;
}

function fingerStates(p: Point[]) {
  return [
    [5, 6, 8],
    [9, 10, 12],
    [13, 14, 16],
    [17, 18, 20],
  ].map(([m, j, t]) =>
    angle(p[m], p[j], p[t]) > 150 &&
    dist(p[t], p[m]) > dist(p[j], p[m]) * 1.05
  );
}

function sosPose(p: Point[]): SOSPose {
  if (p.length < 21) return null;
  const width = dist(p[5], p[17]);
  if (width < 0.001 || dist(p[4], p[9]) >= width * 0.75) return null;
  const count = fingerStates(p).filter(Boolean).length;
  return count === 4 ? "open" : count === 0 ? "closed" : null;
}

function recognize(p: Point[]) {
  if (p.length < 21) return "Other Gesture";

  const wrist = p[0], thumb = p[4], thumbMCP = p[2], indexTip = p[8];
  const width = dist(p[5], p[17]);
  if (width < 0.001) return "Other Gesture";

  const gap = dist(thumb, indexTip);
  if (gap < 0.08) return "OK Sign";

  const [index, middle, ring, pinky] = fingerStates(p);
  const count = [index, middle, ring, pinky].filter(Boolean).length;

  const thumbExtended =
    angle(p[2], p[3], thumb) > 145 &&
    dist(thumb, thumbMCP) > width * 0.45;

  const thumbUp =
    thumb.y < wrist.y - width * 0.15 &&
    thumb.y < thumbMCP.y - width * 0.1;

  if (count === 0 && thumbExtended && thumbUp) return "Thumbs Up";
  if (index && middle && !ring && !pinky) return "Peace Sign";
  if (index && !middle && !ring && !pinky) return "Pointing Up";
  if (count === 4 && thumbExtended && gap > width * 0.35) return "Open Palm";
  if (count === 0) return "Fist";

  return "Other Gesture";
}

const gestures = [
  { name: "Open Palm", meaning: "Hello", emoji: "🖐️", color: "violet" },
  { name: "Fist", meaning: "Stop", emoji: "✊", color: "blue" },
  { name: "Thumbs Up", meaning: "Good Job", emoji: "👍", color: "green" },
  { name: "OK Sign", meaning: "Okay", emoji: "👌", color: "rose" },
  { name: "Peace Sign", meaning: "Peace", emoji: "✌️", color: "sky" },
  { name: "Pointing Up", meaning: "Look / Attention", emoji: "☝️", color: "purple" },
  { name: "SOS DETECTED", meaning: "Help", emoji: "🆘", color: "red" },
];

const features = [
  ["✦", "Real-time Detection", "bg-violet-100 text-indigo-700"],
  ["♟", "AI Powered", "bg-sky-100 text-blue-700"],
  ["◉", "Accessible", "bg-emerald-100 text-emerald-700"],
  ["◷", "Easy to Use", "bg-orange-100 text-orange-700"],
];

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<string[]>([]);
  const noHandFrames = useRef(0);
  const previousSOS = useRef<SOSPose>(null);
  const sosCycles = useRef(0);
  const lastSOS = useRef(0);
  const sosTriggered = useRef(false);
  const cameraOnRef = useRef(true);
  const facingRef = useRef<Facing>("user");
  const restartRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState("Loading MediaPipe...");
  const [handDetected, setHandDetected] = useState(false);
  const [gesture, setGesture] = useState("None");
  const [cameraOn, setCameraOn] = useState(true);
  const [facing, setFacing] = useState<Facing>("user");
  const [copied, setCopied] = useState(false);
  const current = gestures.find(g => g.name === gesture);

  useEffect(() => {
    let active = true;
    let frame = 0;
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;
    let currentFacing = facingRef.current;

    async function start() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        if (!active) {
          landmarker.close();
          return;
        }

        async function openCamera() {
          stream?.getTracks().forEach(t => t.stop());
          if (!cameraOnRef.current) return;

          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacing },
            audio: false,
          });

          if (!active) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }

          setStatus("Camera ready — show your hand");
        }

        await openCamera();

        restartRef.current = () => {
          currentFacing = facingRef.current;
          void openCamera().catch(error => {
            console.error(error);
            setStatus("Camera unavailable. Check permissions.");
          });
        };

        function detect() {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!active || !video || !canvas || !landmarker) return;

          const ctx = canvas.getContext("2d");

          if (video.readyState >= 2 && ctx && cameraOnRef.current) {
            if (
              canvas.width !== video.videoWidth ||
              canvas.height !== video.videoHeight
            ) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const hands = landmarker.detectForVideo(
              video,
              performance.now()
            ).landmarks;

            setHandDetected(hands.length > 0);

            if (hands.length) {
              noHandFrames.current = 0;
              const points = hands[0];
              const now = performance.now();
              const pose = sosPose(points);

              if (!sosTriggered.current) {
                if (pose === "open") {
                  previousSOS.current = "open";
                } else if (
                  pose === "closed" &&
                  previousSOS.current === "open"
                ) {
                  sosCycles.current =
                    now - lastSOS.current <= 4000
                      ? sosCycles.current + 1
                      : 1;

                  lastSOS.current = now;
                  previousSOS.current = "closed";

                  if (sosCycles.current >= 2) {
                    sosTriggered.current = true;
                    history.current = [];
                    setGesture("SOS DETECTED");
                  }
                }
              }

              if (sosTriggered.current) {
                setGesture("SOS DETECTED");
              } else {
                const items = history.current;
                items.push(recognize(points));
                if (items.length > 7) items.shift();

                const counts = new Map<string, number>();
                items.forEach(item =>
                  counts.set(item, (counts.get(item) ?? 0) + 1)
                );

                const best = [...counts.entries()].sort(
                  (a, b) => b[1] - a[1]
                )[0];

                if (best && best[1] >= 4) setGesture(best[0]);
              }

              ctx.strokeStyle = "#55e99a";
              ctx.fillStyle = "#a7ffc8";
              ctx.lineWidth = 2;

              for (const link of HandLandmarker.HAND_CONNECTIONS) {
                const a = points[link.start];
                const b = points[link.end];
                ctx.beginPath();
                ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
                ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
                ctx.stroke();
              }

              points.forEach(point => {
                ctx.beginPath();
                ctx.arc(
                  point.x * canvas.width,
                  point.y * canvas.height,
                  3.5,
                  0,
                  2 * Math.PI
                );
                ctx.fill();
              });
            } else {
              noHandFrames.current++;
              history.current = [];

              if (noHandFrames.current >= 5) {
                setGesture("None");
                previousSOS.current = null;
                sosCycles.current = 0;
                lastSOS.current = 0;
                sosTriggered.current = false;
              }
            }
          }

          frame = requestAnimationFrame(detect);
        }

        frame = requestAnimationFrame(detect);
      } catch (error) {
        console.error(error);
        setStatus("Could not start detection. Check camera permission.");
      }
    }

    void start();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(t => t.stop());
      landmarker?.close();
      restartRef.current = null;
    };
  }, []);

  // Text-to-speech: speaks the meaning of the detected gesture.
  function speak() {
    if (gesture === "None" || typeof window === "undefined") return;

    if (!("speechSynthesis" in window)) {
      setStatus("Text-to-speech is not supported by this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      gesture === "SOS DETECTED" ? "Help" : current?.meaning ?? gesture
    );
    utterance.lang = "en-IN";
    window.speechSynthesis.speak(utterance);
  }

  async function copy() {
    if (gesture === "None") return;

    try {
      await navigator.clipboard.writeText(
        gesture === "SOS DETECTED" ? "Help" : current?.meaning ?? gesture
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setStatus("Clipboard access unavailable in this browser.");
    }
  }

  return (
    <main className="min-h-screen bg-[#eef2ff] text-[#172447]">
      <header className="bg-gradient-to-r from-[#111b30] to-[#202a43] text-white shadow-lg">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-10">
          <a href="#home" className="flex items-center gap-3">
            <span className="text-4xl text-fuchsia-300">✋</span>
            <span>
              <span className="block text-2xl font-extrabold tracking-tight">
                <span className="text-violet-400">Gesture</span> Play
              </span>
              <span className="text-sm text-slate-300">
                Sign Language · To · Text
              </span>
            </span>
          </a>

          <nav className="flex flex-wrap items-center gap-5 text-sm font-medium text-slate-200">
            <a className="hover:text-white" href="#home">Home</a>
            <a className="hover:text-white" href="#about">About</a>
            <a className="hover:text-white" href="#how">How It Works</a>
            <a className="hover:text-white" href="#team">Team</a>
            <a className="rounded-full bg-gradient-to-r from-blue-500 to-violet-600 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105" href="#detector">
              Try Now
            </a>
          </nav>
        </div>
      </header>

      <section id="home" className="mx-auto max-w-[1440px] px-5 pb-8 pt-8 text-center md:px-10">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-violet-600">
          Communication without barriers
        </p>
        <h1 className="text-4xl font-black tracking-tight text-[#172447] md:text-5xl">
          Turn Gestures{" "}
          <span className="bg-gradient-to-r from-indigo-700 via-blue-600 to-violet-500 bg-clip-text text-transparent">
            Into Words
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-base text-slate-600 md:text-xl">
          Use your webcam to show hand gestures and get the corresponding text in real time.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {features.map(([icon, label, style]) => (
            <span key={label} className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold ${style}`}>
              <span>{icon}</span>{label}
            </span>
          ))}
        </div>
      </section>

      <section id="detector" className="mx-auto grid max-w-[1440px] grid-cols-1 items-start gap-5 px-5 pb-8 md:px-10 lg:grid-cols-[0.92fr_1.75fr_0.92fr]">
        <aside className="rounded-2xl border border-white bg-white/85 p-4 shadow-[0_12px_40px_rgba(68,86,160,0.09)]">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold">
            <span className="text-violet-500">✋</span> Supported Gestures
          </h2>
          <div className="space-y-2">
            {gestures.map(g => (
              <div key={g.name} className={`flex items-center gap-3 rounded-xl border p-3 transition ${gesture === g.name ? "border-violet-300 bg-violet-50 shadow-sm" : "border-slate-100 bg-slate-50/80"}`}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-100 to-sky-100 text-3xl">
                  {g.emoji}
                </span>
                <span>
                  <span className="block text-sm font-bold">{g.name}</span>
                  <span className="text-xs text-slate-500">{g.meaning}</span>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-2xl border border-white bg-white/90 p-3 shadow-[0_12px_40px_rgba(68,86,160,0.10)]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#080c14]">
            <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
            <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />

            {!cameraOn && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950 text-center text-white">
                <div>
                  <span className="text-5xl">📷</span>
                  <p className="mt-3 font-semibold">Camera paused</p>
                  <p className="text-sm text-slate-400">Start the camera to detect gestures</p>
                </div>
              </div>
            )}

            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-sm text-white backdrop-blur">
              <span className={`h-2.5 w-2.5 rounded-full ${cameraOn && handDetected ? "bg-green-400" : cameraOn ? "animate-pulse bg-amber-400" : "bg-red-400"}`} />
              {cameraOn ? handDetected ? "Hand detected" : "Camera active" : "Camera off"}
            </div>
            <div className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-2 text-xs text-white">AI LIVE</div>
          </div>

          <div className="grid gap-3 p-2 pt-4 sm:grid-cols-2">
            <button
              onClick={() => {
                const next = !cameraOnRef.current;
                cameraOnRef.current = next;
                setCameraOn(next);

                if (next) {
                  restartRef.current?.();
                } else {
                  if (videoRef.current?.srcObject) {
                    (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                  }
                  setStatus("Camera paused");
                  setHandDetected(false);
                }
              }}
              className={`rounded-xl px-4 py-3.5 font-bold text-white shadow-md transition hover:-translate-y-0.5 ${cameraOn ? "bg-gradient-to-r from-rose-500 to-red-500" : "bg-gradient-to-r from-emerald-500 to-green-600"}`}
            >
              {cameraOn ? "■ Stop Camera" : "▶ Start Camera"}
            </button>

            <button
              onClick={() => {
                const next = facing === "user" ? "environment" : "user";
                setFacing(next);
                facingRef.current = next;
                restartRef.current?.();
              }}
              disabled={!cameraOn}
              className="rounded-xl bg-slate-100 px-4 py-3.5 font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
            >
              ⟳ Switch Camera
            </button>
          </div>
          <p className="px-3 pb-2 text-xs text-slate-500">{status}</p>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white bg-white/90 p-4 shadow-[0_12px_40px_rgba(68,86,160,0.09)]">
            <h2 className="mb-4 flex items-center gap-2 font-extrabold">
              <span className="text-violet-500">✦</span> Detected Gesture
            </h2>

            <div className={`rounded-xl border p-4 ${gesture === "SOS DETECTED" ? "border-red-200 bg-red-50" : "border-emerald-100 bg-gradient-to-r from-emerald-50 to-green-50"}`}>
              <div className="flex items-center gap-4">
                <span className="text-5xl">{current?.emoji ?? "👋"}</span>
                <div>
                  <p className="text-xl font-extrabold">{gesture === "None" ? "Waiting..." : gesture}</p>
                  <p className="text-sm text-slate-500">
                    {gesture === "None" ? "Show a supported gesture" : gesture === "SOS DETECTED" ? "Help signal detected" : current?.meaning}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={copy} disabled={gesture === "None"} className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-40">
                {copied ? "✓ Copied!" : "▢ Copy Text"}
              </button>
              <button onClick={speak} disabled={gesture === "None"} className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-bold text-slate-700 disabled:opacity-40">
                🔊 Speak
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white bg-white/90 p-4 shadow-[0_12px_40px_rgba(68,86,160,0.09)]">
            <div className="flex items-center justify-between text-sm font-extrabold">
              <span>▥ Detection Status</span>
              <span className={handDetected ? "text-emerald-600" : "text-slate-500"}>{handDetected ? "Active" : "Waiting"}</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full transition-all ${handDetected ? "w-[92%] bg-gradient-to-r from-indigo-500 to-blue-500" : "w-[8%] bg-slate-400"}`} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Live hand visibility indicator — not a calibrated confidence score.</p>
          </section>

          <section className="rounded-2xl border border-white bg-white/90 p-4 shadow-[0_12px_40px_rgba(68,86,160,0.09)]">
            <h2 className="mb-3 font-extrabold"><span className="mr-2 text-violet-500">♧</span>Tips</h2>
            <ul className="space-y-2 text-sm text-slate-600">
              {["Keep your hand clearly visible", "Use good lighting", "Keep some distance from the camera", "Hold the gesture for 1–2 seconds", "Try a different angle if needed"].map(t => <li key={t}>• {t}</li>)}
            </ul>
          </section>
        </aside>
      </section>

      <section id="about" className="mx-auto mb-10 grid max-w-[1440px] gap-5 px-5 md:grid-cols-2 md:px-10">
        <div className="rounded-2xl border border-white bg-white/80 p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-extrabold">📘 About Gesture Play</h2>
          <p className="text-sm leading-6 text-slate-600">
            Gesture Play is an AI-powered hand gesture recognition demo designed to make everyday communication more accessible by turning supported gestures into text in real time.
          </p>
        </div>
        <div id="how" className="rounded-2xl border border-white bg-white/80 p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-extrabold">✨ How It Works</h2>
          <p className="text-sm leading-6 text-slate-600">
            Allow camera access, show a supported gesture, and Gesture Play uses MediaPipe hand landmarks to recognize it. Use Copy Text or Speak to share the detected meaning.
          </p>
        </div>
      </section>

      <footer id="team" className="border-t border-indigo-100 bg-white/60 px-5 py-5 text-center text-sm text-slate-500">
        Gesture Play · Built for more accessible communication
      </footer>
    </main>
  );
}
