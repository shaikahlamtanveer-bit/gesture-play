# Gesture Play — Sign Language to Text

Gesture Play is a webcam-based hand gesture recognition demo built with Next.js, TypeScript, Tailwind CSS, and MediaPipe.

The application detects predefined hand gestures and displays the recognized gesture on the screen.

## Features

- Live webcam preview
- Hand tracking using MediaPipe Hand Landmarker
- Six predefined gestures:
  - Open Palm
  - Fist
  - Thumbs Up
  - Peace Sign
  - Pointing Up
  - OK Sign
- Additional SOS gesture-sequence detection
- Live gesture display

## Technology Stack

- Next.js
- TypeScript
- Tailwind CSS
- MediaPipe Tasks Vision
- Browser Camera API

## Getting Started

### Requirements

- Node.js and npm
- A modern browser with webcam support

### Installation

Clone the repository:

```bash
git clone https://github.com/shaikahlamtanveer-bit/gesture-play.git
cd gesture-play
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser and allow camera access when prompted.

## How It Works

The browser camera captures video from the user's webcam. MediaPipe Hand Landmarker identifies 21 landmarks on the detected hand. The application uses landmark positions and hand-pose rules to recognize predefined gestures.

## Limitations

- This is a limited gesture-recognition demo, not a complete sign-language translation system.
- Recognition accuracy can vary with lighting, camera position, and hand orientation.
- SOS detection displays a message in the application; it does not contact emergency services.

## Team Project

Developed as part of the Edzul 5-Day Development Challenge.

## License

No open-source license has been selected yet.
