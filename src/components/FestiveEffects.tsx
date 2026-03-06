"use client"

import React, { useEffect, useState } from 'react';
import { FestivalTheme } from '@/app/lib/constants';

interface FestiveEffectsProps {
  theme: FestivalTheme;
}

export const FestiveEffects: React.FC<FestiveEffectsProps> = ({ theme }) => {
  const [elements, setElements] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    const newElements: React.ReactNode[] = [];
    
    if (theme === 'Diwali') {
      for (let i = 0; i < 40; i++) {
        newElements.push(
          <div key={`diwali-${i}`} className="diwali-light" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
          }} />
        );
      }
    } else if (theme === 'Christmas') {
      const snowIcons = ['❄', '❅', '❆'];
      for (let i = 0; i < 60; i++) {
        newElements.push(
          <div key={`snow-${i}`} className="snowflake" style={{
            left: `${Math.random() * 100}%`,
            fontSize: `${Math.random() * 15 + 10}px`,
            animationDuration: `${Math.random() * 5 + 5}s`,
            animationDelay: `${Math.random() * 10}s`,
          }}>
            {snowIcons[Math.floor(Math.random() * snowIcons.length)]}
          </div>
        );
      }
    } else if (theme === 'Holi') {
      const colors = ['#f44336', '#e91e63', '#9c27b0', '#2196f3', '#4caf50', '#ffeb3b'];
      for (let i = 0; i < 30; i++) {
        newElements.push(
          <div key={`holi-${i}`} className="color-splash" style={{
            background: colors[Math.floor(Math.random() * colors.length)],
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 4}s`,
          }} />
        );
      }
    } else if (theme === 'Eid') {
      for (let i = 0; i < 15; i++) {
        newElements.push(
          <div key={`eid-${i}`} className="absolute text-yellow-400 opacity-20 animate-pulse" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            fontSize: '24px',
          }}>🌙</div>
        );
      }
    }

    setElements(newElements);
  }, [theme]);

  if (theme === 'Normal') return null;
  return <div className="festival-overlay">{elements}</div>;
};