import React, { useEffect, useRef, useState } from 'react';
import { cn } from './utils';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  decimals?: number;
  duration?: number;
  locale?: string;
  formatter?: (value: number) => string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedNumber({
  value,
  className,
  decimals = 0,
  duration = 420,
  locale = 'ko-KR',
  formatter,
  prefix = '',
  suffix = '',
}: AnimatedNumberProps) {
  const [animatedValue, setAnimatedValue] = useState(value);
  const previousValueRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(value)) {
      setAnimatedValue(value);
      previousValueRef.current = value;
      return;
    }

    const start = performance.now();
    const from = previousValueRef.current;
    const to = value;

    if (!Number.isFinite(from) || duration <= 0) {
      setAnimatedValue(to);
      previousValueRef.current = to;
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (to - from) * eased;
      setAnimatedValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        previousValueRef.current = to;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [duration, value]);

  const formatted = formatter
    ? formatter(animatedValue)
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(animatedValue);

  return <span className={cn('tabular-nums', className)}>{`${prefix}${formatted}${suffix}`}</span>;
}
