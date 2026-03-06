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
        const style = {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 2}s`,
        };
        newElements.push(<div key={`diwali-${i}`} className="diwali-light" style={style} />);
      }
    } else if (theme === 'Christmas') {
      for (let i = 0; i < 60; i++) {
        const style = {
          left: `${Math.random() * 100}%`,
          fontSize: `${Math.random() * 10 + 10}px`,
          animationDuration: `${Math.random() * 3 + 4}s`,
          animationDelay: `${Math.random() * 5}s`,
          opacity: Math.random() * 0.7 + 0.3,
        };
        newElements.push(
          <div key={`snow-${i}`} className="snowflake" style={style}>
            ❄
          </div>
        );
      }
    } else if (theme === 'Holi') {
      const colors = ['#f44336', '#e91e63', '#9c27b0', '#2196f3', '#4caf50', '#ffeb3b'];
      for (let i = 0; i < 25; i++) {
        const style = {
          background: colors[Math.floor(Math.random() * colors.length)],
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 2}s`,
        };
        newElements.push(<div key={`holi-${i}`} className="color-splash" style={style} />);
      }
    }

    setElements(newElements);
  }, [theme]);

  if (theme === 'Normal') return null;

  return <div className="festival-overlay">{elements}</div>;
};
