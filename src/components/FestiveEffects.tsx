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
      for (let i = 0; i < 60; i++) {
        const style = {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${Math.random() * 3 + 2}s`,
          transform: `scale(${Math.random() * 0.5 + 0.5})`,
        };
        newElements.push(<div key={`diwali-${i}`} className="diwali-light" style={style} />);
      }
    } else if (theme === 'Christmas') {
      const snowIcons = ['❄', '❅', '❆', '•'];
      for (let i = 0; i < 80; i++) {
        const style = {
          left: `${Math.random() * 100}%`,
          fontSize: `${Math.random() * 15 + 10}px`,
          animationDuration: `${Math.random() * 5 + 5}s`,
          animationDelay: `${Math.random() * 10}s`,
          opacity: Math.random() * 0.8 + 0.2,
          filter: `blur(${Math.random() * 1}px)`,
        };
        newElements.push(
          <div key={`snow-${i}`} className="snowflake" style={style}>
            {snowIcons[Math.floor(Math.random() * snowIcons.length)]}
          </div>
        );
      }
    } else if (theme === 'Holi') {
      const colors = ['#f44336', '#e91e63', '#9c27b0', '#2196f3', '#4caf50', '#ffeb3b', '#ff5722'];
      for (let i = 0; i < 40; i++) {
        const style = {
          background: colors[Math.floor(Math.random() * colors.length)],
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 4}s`,
          animationDuration: `${Math.random() * 2 + 2}s`,
          width: `${Math.random() * 60 + 40}px`,
          height: `${Math.random() * 60 + 40}px`,
        };
        newElements.push(<div key={`holi-${i}`} className="color-splash" style={style} />);
      }
    }

    setElements(newElements);
  }, [theme]);

  if (theme === 'Normal') return null;

  return <div className="festival-overlay">{elements}</div>;
};