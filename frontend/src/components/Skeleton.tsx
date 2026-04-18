import './Skeleton.css';

export function Skeleton({ width, height, borderRadius = '8px', className = '' }: {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: width ?? '100%', height: height ?? '16px', borderRadius }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card skeleton-card">
      <Skeleton height="20px" width="60%" className="mb-12" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="14px" width={i === lines - 1 ? '40%' : '100%'} className="mb-8" />
      ))}
    </div>
  );
}
