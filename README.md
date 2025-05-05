# Image to STL Converter

A web-based tool that converts 2D images into 3D STL files for 3D printing.

## Features

- Upload PNG or JPEG images (max 2MB)
- In-browser processing using Web Workers
- Real-time 3D preview using Three.js
- Download generated STL files
- No server required - all processing happens in the browser

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open http://localhost:3000 in your browser

## Build

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Technical Details

- Built with Vite, TypeScript, and Three.js
- Uses Web Workers for background processing
- Supports modern browsers with WebGL capabilities

## Limitations (MVP)

- Maximum image size: 2MB
- Supported formats: PNG, JPEG
- Maximum resolution: 1024x1024px (auto-scaled if larger)
- Basic height map conversion (placeholder for MVP)

## License

MIT 