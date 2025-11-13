import React, { ReactNode, useEffect, useRef } from 'react';

// Define props interface
interface EqualHeightCardsProps {
  children: ReactNode;
  cardSelector?: string; // Optional custom selector
}

// calculate the max height and set globally
const EqualHeightCards = ({
  children,
  cardSelector = '.mantine-Card-root',
}: EqualHeightCardsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const equalizeCardHeights = (): void => {
      if (!containerRef.current) return;

      const cards =
        containerRef.current.querySelectorAll<HTMLElement>(cardSelector);
      if (cards.length === 0) return;

      // Reset heights to auto
      cards.forEach((card) => {
        card.style.height = 'auto';
      });

      // Find max height
      const heights: number[] = Array.from(cards).map(
        (card) => card.getBoundingClientRect().height,
      );
      const maxHeight = Math.max(...heights);

      // Apply max height to all cards
      cards.forEach((card) => {
        card.style.height = `${maxHeight}px`;
      });
    };

    // Run on mount and when window resizes
    equalizeCardHeights();

    const handleResize = (): void => {
      window.requestAnimationFrame(equalizeCardHeights);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [children, cardSelector]); // Re-run when children or selector changes

  return (
    <div ref={containerRef} className="flex flex-wrap gap-4">
      {children}
    </div>
  );
};

export default EqualHeightCards;
