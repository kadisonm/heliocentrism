'use client';

import { useEffect, useRef } from 'react';
import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789';
const FONT_SIZE = 16;
const FRAME_MS = 60;
// Frames simulated up-front for a still (paused / reduced-motion), so it shows full trails rather than an empty screen.
const STILL_FRAMES = 60;

// Falling columns of characters in the accent colour, drawn on a canvas.
export default function MatrixBackground(props: BackgroundViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { paused } = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let drops: number[] = [];
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const columns = Math.ceil(canvas.clientWidth / FONT_SIZE);
      drops = Array.from({ length: columns }, () => Math.floor((Math.random() * canvas.clientHeight) / FONT_SIZE));
    };

    // Colours come from the theme, read live so a palette/mode switch carries over without a remount.
    const draw = () => {
      const styles = getComputedStyle(canvas);
      context.globalAlpha = 0.12;
      context.fillStyle = styles.getPropertyValue('--color-black').trim();
      context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      context.globalAlpha = 1;
      context.fillStyle = styles.getPropertyValue('--color-accent').trim();
      context.font = `${FONT_SIZE}px monospace`;
      drops.forEach((row, column) => {
        context.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], column * FONT_SIZE, row * FONT_SIZE);
        drops[column] = row * FONT_SIZE > canvas.clientHeight && Math.random() > 0.975 ? 0 : row + 1;
      });
    };

    resize();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (paused || reducedMotion) {
      for (let i = 0; i < STILL_FRAMES; i++) draw();
      return;
    }

    const intervalId = setInterval(draw, FRAME_MS);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      clearInterval(intervalId);
      observer.disconnect();
    };
  }, [paused]);

  return (
    <BackgroundFrame name="matrix" {...props}>
      <canvas ref={canvasRef} className="matrix-background__canvas" />
    </BackgroundFrame>
  );
}
