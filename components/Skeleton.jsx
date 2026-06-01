/**
 * Skeleton loaders — shimmer placeholders
 * Hebrew: טעינת שלד
 */

import React from 'react';

export function Skeleton({ width = '100%', height = 16, style, className = 'skeleton' }) {
  return (
    <div
      className={className}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, gap = 8 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = 120 }) {
  return (
    <div
      className="card"
      style={{ padding: 'var(--space-4)' }}
      aria-hidden="true"
    >
      <Skeleton height={20} width="40%" style={{ marginBottom: 12 }} />
      <SkeletonText lines={2} />
      <Skeleton height={height - 80} style={{ marginTop: 12 }} />
    </div>
  );
}

export default Skeleton;
