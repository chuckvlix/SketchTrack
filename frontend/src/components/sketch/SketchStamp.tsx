import React from 'react';

interface SketchStampProps {
  label?: string;
  className?: string;
}

export const SketchStamp: React.FC<SketchStampProps> = ({
  label = '[ENTREGADO]',
  className = '',
}) => {
  return (
    <div className={`animate-stamp inline-block pointer-events-none select-none ${className}`}>
      <div
        className="rubber-stamp px-3 py-1 text-sm font-sketch font-bold tracking-widest"
        style={{
          color: 'var(--st-stamp-pow)',
          borderColor: 'var(--st-stamp-pow)',
        }}
      >
        {label}
      </div>
    </div>
  );
};
