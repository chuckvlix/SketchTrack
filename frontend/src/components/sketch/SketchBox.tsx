import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';

interface SketchBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  seed?: number;
  strokeColor?: string;
  fillColor?: string;
  className?: string;
  isActive?: boolean;
}

export const SketchBox: React.FC<SketchBoxProps> = ({
  children,
  seed = 42,
  strokeColor = '#1E242B',
  fillColor,
  className = '',
  isActive = false,
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.offsetWidth;
    const height = containerRef.current.offsetHeight;
    if (width === 0 || height === 0) return;

    svgRef.current.setAttribute('width', `${width}`);
    svgRef.current.setAttribute('height', `${height}`);

    const rc = rough.svg(svgRef.current);
    // Clear previous rough elements
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }

    const node = rc.rectangle(2, 2, width - 4, height - 4, {
      seed,
      roughness: 1.1,
      bowing: 0.7,
      stroke: strokeColor,
      strokeWidth: 1.75,
      fill: fillColor,
      fillStyle: fillColor ? 'solid' : undefined,
    });

    svgRef.current.appendChild(node);
  }, [seed, strokeColor, fillColor, isActive]);

  return (
    <div
      ref={containerRef}
      className={`relative ${isActive ? 'stationery-card-active' : ''} ${className}`}
      {...props}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
};
