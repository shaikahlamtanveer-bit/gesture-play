
"use client";

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

type Point = { x: number; y: number; z: number };
type SOSPose = "open" | "closed" | null;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function angle(a: Point, b: Point, c: Point): number {
  const ba = {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
  const bc = {
    x: c.x - b.x,
    y: c.y - b.y,
    z: c.z - b.z,
  };

  const denominator =
    Math.hypot(ba.x, ba.y, ba.z) *
    Math.hypot(bc.x, bc.y, bc.z);

  if (denominator === 0) return 0;

  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const cosine = Math.max(-1, Math.min(1, dot / denominator));

  return (Math.acos(cosine) * 180) / Math.PI;
}

function getFingerStates(points: Point[]): boolean[] {
  const fingerData = [
    { mcp: 5, pip: 6, tip: 8 },
    { mcp: 9, pip: 10, tip: 12 },
    { mcp: 13, pip: 14, tip: 16 },
    { mcp: 17, pip: 18, tip: 20 },
  ];

  return fingerData.map(({ mcp, pip, tip }) => {
    const jointAngle = angle(points[mcp], points[pip], points[tip]);
    const tipDistance = distance(points[tip], points[mcp]);
    const pipDistance = distance(points[pip], points[mcp]);

    return jointAngle > 150 && tipDistance > pipDistance * 1.05;
  });
}

// Separate SOS pose detection so normal fist recognition stays unchanged.
function recognizeSOSPose(points: Point[]): SOSPose {
  if (points.length < 21) return null;

  const palmWidth = distance(points[5], points[17]);
  if (palmWidth < 0.001) return null;

  const thumbTip = points[4];

  // Thumb should be tucked toward the middle of the palm.
  const thumbTucked =
    distance(thumbTip, points[9]) < palmWidth * 0.75;

  if (!thumbTucked) return null;

  const extended = getFingerStates(points);
  const count = extended.filter(Boolean).length;

  if (count === 4) return "open";
  if (count === 0) return "closed";

  return null;
}

function recognizeGesture(points: Point[]): string {
  if (points.length < 21) return "Other Gesture";

  const wrist = points[0];
  const thumbTip = points[4];
  const thumbIP = points[3];
  const thumbMCP = points[2];
  const indexTip = points[8];
  const indexPIP = points[6];
  const indexMCP = points[5];

  const palmWidth = distance(points[5], points[17]);
  if (palmWidth < 0.001) return "Other Gesture";

  const extended = getFingerStates(points);
  const [index, middle, ring, pinky] = extended;
  const count = extended.filter(Boolean).length;

  const thumbStraight =
    angle(thumbMCP, thumbIP, thumbTip) > 145;

  const thumbExtended =
    thumbStraight &&
    distance(thumbTip, thumbMCP) > palmWidth * 0.45;

  const thumbIndexGap = distance(thumbTip, indexTip);

  // OK SIGN
  const indexBent =
    angle(indexMCP, indexPIP, indexTip) < 160 ||
    distance(indexTip, indexMCP) < palmWidth * 0.85;

  if (
    thumbIndexGap < 0.06 &&
    middle &&
    ring &&
    pinky &&
    indexBent
  ) {
    return "OK Sign";
  }

  // THUMBS UP
  const thumbPointsUp =
    thumbTip.y < wrist.y - palmWidth * 0.15 &&
    thumbTip.y < thumbMCP.y - palmWidth * 0.1;

  if (count === 0 && thumbExtended && thumbPointsUp) {
    return "Thumbs Up";
  }

  // PEACE SIGN
  if (index && middle && !ring && !pinky) {
    return "Peace Sign";
  }

  // POINTING UP
  if (index && !middle && !ring && !pinky) {
    return "Pointing Up";
  }

  // OPEN PALM
  if (
    count === 4 &&
    thumbExtended &&
    thumbIndexGap > palmWidth * 0.35
  ) {
    return "Open Palm";
  }

  // FIST
  if (count === 0 && !(thumbExtended && thumbPointsUp)) {
    return "Fist";
  }

  return "Other Gesture";
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState("Loading MediaPipe...");
  const [handDetected, setHandDetected] = useState(false);
  const [gesture, setGesture] = useState("None");

  const historyRef = useRef<string[]>([]);
  const noHandFramesRef = useRef(0);

  // SOS sequence tracking
  const previousSOSPoseRef = useRef<SOSPose>(null);
  const sosCyclesRef = useRef(0);
  const lastSOSCycleTimeRef = useRef(0);
  const sosTriggeredRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;
    let animationId = 0;
    let active = true;

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

        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          landmarker.close();
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus("Show your hand to the camera");

        function detect() {
          if (
            !active ||
            !videoRef.current ||
            !canvasRef.current ||
            !landmarker
          ) {
            return;
          }

          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext("2d");

          if (video.readyState >= 2 && context) {
            if (
              canvas.width !== video.videoWidth ||
              canvas.height !== video.videoHeight
            ) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }

            context.clearRect(0, 0, canvas.width, canvas.height);

            const result = landmarker.detectForVideo(
              video,
              performance.now()
            );

            const hands = result.landmarks;
            setHandDetected(hands.length > 0);

            if (hands.length > 0) {
              noHandFramesRef.current = 0;

              const points = hands[0];
              const now = performance.now();
              const sosPose = recognizeSOSPose(points);

              // Count a cycle only when an open SOS pose is followed
              // by a closed SOS pose. Require two cycles within 4 seconds.
              if (!sosTriggeredRef.current) {
                if (sosPose === "open") {
                  previousSOSPoseRef.current = "open";
                } else if (
                  sosPose === "closed" &&
                  previousSOSPoseRef.current === "open"
                ) {
                  if (now - lastSOSCycleTimeRef.current <= 4000) {
                    sosCyclesRef.current += 1;
                  } else {
                    sosCyclesRef.current = 1;
                  }

                  lastSOSCycleTimeRef.current = now;
                  previousSOSPoseRef.current = "closed";

                  if (sosCyclesRef.current >= 2) {
                    sosTriggeredRef.current = true;
                    historyRef.current = [];
                    setGesture("SOS DETECTED");
                  }
                }
              }

              if (sosTriggeredRef.current) {
                setGesture("SOS DETECTED");
              } else {
                const current = recognizeGesture(points);
                const history = historyRef.current;

                history.push(current);
                if (history.length > 7) history.shift();

                const counts = new Map<string, number>();

                for (const item of history) {
                  counts.set(item, (counts.get(item) ?? 0) + 1);
                }

                let bestGesture = current;
                let bestCount = 0;

                for (const [name, count] of counts) {
                  if (count > bestCount) {
                    bestGesture = name;
                    bestCount = count;
                  }
                }

                if (bestCount >= 4) {
                  setGesture(bestGesture);
                }
              }
            } else {
              noHandFramesRef.current += 1;
              historyRef.current = [];

              if (noHandFramesRef.current >= 5) {
                setGesture("None");

                // Reset SOS after the hand is removed.
                previousSOSPoseRef.current = null;
                sosCyclesRef.current = 0;
                lastSOSCycleTimeRef.current = 0;
                sosTriggeredRef.current = false;
              }
            }

            // Draw landmarks and hand connections.
            for (const points of hands) {
              context.fillStyle = "#22c55e";
              context.strokeStyle = "#38bdf8";
              context.lineWidth = 3;

              for (const point of points) {
                context.beginPath();
                context.arc(
                  point.x * canvas.width,
                  point.y * canvas.height,
                  5,
                  0,
                  2 * Math.PI
                );
                context.fill();
              }

              for (const connection of HandLandmarker.HAND_CONNECTIONS) {
                const startPoint = points[connection.start];
                const endPoint = points[connection.end];

                context.beginPath();
                context.moveTo(
                  startPoint.x * canvas.width,
                  startPoint.y * canvas.height
                );
                context.lineTo(
                  endPoint.x * canvas.width,
                  endPoint.y * canvas.height
                );
                context.stroke();
              }
            }
          }

          animationId = requestAnimationFrame(detect);
        }

        animationId = requestAnimationFrame(detect);
      } catch (error) {
        console.error(error);
        setStatus(
          "Could not start hand detection. Check camera permission and console."
        );
      }
    }

    start();

    return () => {
      active = false;
      cancelAnimationFrame(animationId);
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="mb-2 text-3xl font-bold">Gesture Play</h1>

      <p className="mb-8 text-slate-300">
        Hand Recognition using MediaPipe
      </p>

      <div className="mx-auto max-w-2xl">
        <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="block w-full -scale-x-100"
          />

          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
          />
        </div>

        <div className="mt-5 space-y-3 rounded-lg bg-slate-900 p-5">
          <p>Status: {status}</p>
          <p>Hand detected: {handDetected ? "Yes" : "No"}</p>

          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-sm text-slate-400">Detected Gesture</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                gesture === "SOS DETECTED" ? "text-red-400" : ""
              }`}
              role="status"
              aria-live="polite"
            >
              {gesture}
            </p>
          </div>

          <p className="text-sm text-slate-400">
            MediaPipe tracks 21 landmarks per detected hand.
          </p>
        </div>
      </div>
    </main>
  );
}
