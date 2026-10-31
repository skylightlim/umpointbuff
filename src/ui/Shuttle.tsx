import React from 'react';
import Svg, { G, Line, Path, Rect } from 'react-native-svg';
import { useColors } from '../theme';

export type ShuttleState = 'armed' | 'booked' | 'empty' | 'test' | 'lost';

/** The skirt's top and bottom edge at x, for the thread rings and vanes. */
const edgeTop = (x: number) => 8 - (6 * (x - 15)) / 31;
const edgeBottom = (x: number) => 20 + (6 * (x - 15)) / 31;

/**
 * A feather shuttle lying in its tube, cork to the left. Cork gold means armed, natural cork
 * means it's yours; an empty chamber shows only its outline.
 */
export function Shuttle({ state, width = 46, onDark = true }: { state: ShuttleState; width?: number; onDark?: boolean }) {
  const c = useColors();
  const height = (width * 28) / 48;
  const empty = state === 'empty';
  const lost = state === 'lost';
  const cork = state === 'armed' ? c.gold : state === 'test' ? c.tint : lost ? c.ink3 : c.cork;
  const band = state === 'armed' ? '#B97E06' : state === 'test' ? c.tint : lost ? c.ink3 : '#8E5E2E';
  const feather = onDark ? c.feather : '#FFFFFF';
  const vane = onDark ? 'rgba(13,29,67,0.28)' : 'rgba(13,23,48,0.22)';
  const outline = onDark ? 'rgba(245,246,242,0.38)' : c.fillStrong;

  // Feather tips: a row of small scallops down the open end.
  const tips = 'M46,2 ' + Array.from({ length: 6 }, () => 'a2.2,2 0 0 1 0,4').join(' ');
  const vanes = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const t = i / 6;
    return { y1: 8 + t * 12, y2: 2 + t * 24 };
  });

  if (empty) {
    return (
      <Svg width={width} height={height} viewBox="0 0 48 28" accessible={false}>
        <Path
          d="M15.5,8 L11,6 A8,8 0 0 0 11,22 L15.5,20 L46,26 L46,2 Z"
          stroke={outline}
          strokeWidth={1.4}
          strokeLinejoin="round"
          fill="none"
          strokeDasharray="3 2.6"
        />
      </Svg>
    );
  }

  return (
    <Svg width={width} height={height} viewBox="0 0 48 28" accessible={false} opacity={lost ? 0.55 : 1}>
      <G>
        <Path d={`M15,8 L46,2 ${tips.slice(6)} L15,20 Z`} fill={feather} />
        {vanes.map((v, i) => (
          <Line key={i} x1={15} y1={v.y1} x2={46} y2={v.y2} stroke={vane} strokeWidth={0.7} />
        ))}
        {[25, 34].map((x) => (
          <Line key={x} x1={x} y1={edgeTop(x)} x2={x} y2={edgeBottom(x)} stroke={vane} strokeWidth={1.1} />
        ))}
        <Path d="M11,6 A8,8 0 0 0 11,22 Z" fill={cork} />
        <Rect x={11} y={6} width={4.5} height={16} fill={band} />
      </G>
    </Svg>
  );
}
