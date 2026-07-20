'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  variant?: 'light' | 'dark' | 'auto';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BrandLogo({
  variant = 'auto',
  size = 'md',
  className,
}: BrandLogoProps) {
  const sizeMap = {
    sm: { width: 80, height: 32 },
    md: { width: 120, height: 48 },
    lg: { width: 180, height: 72 },
  };

  const { width, height } = sizeMap[size];

  return (
    <span className={cn('inline-flex items-center', className)}>
      <Image
        src="/freitas-logo.png"
        alt="Freitas Logo"
        width={width}
        height={height}
        style={{ objectFit: 'contain' }}
        priority
      />
    </span>
  );
}
