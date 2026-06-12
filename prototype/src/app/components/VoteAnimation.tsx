import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Film, Sparkles, Star } from "lucide-react";
import confetti from "canvas-confetti";

interface VoteAnimationProps {
  show: boolean;
  onComplete: () => void;
  buttonRef: HTMLButtonElement | null;
}

export function VoteAnimation({ show, onComplete, buttonRef }: VoteAnimationProps) {
  useEffect(() => {
    if (show && buttonRef) {
      const rect = buttonRef.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      // Cinema-themed confetti burst with amber/gold colors - single burst only
      const defaults = {
        startVelocity: 20,
        spread: 60,
        ticks: 50,
        zIndex: 9999,
        colors: ['#F59E0B', '#FBBF24', '#FCD34D'],
      };

      // Single burst with mixed shapes
      confetti({
        ...defaults,
        particleCount: 15,
        origin: { x, y },
        shapes: ['circle', 'square'],
        scalar: 0.6,
      });

      // Small star burst
      confetti({
        ...defaults,
        particleCount: 5,
        origin: { x, y },
        shapes: ['star'],
        scalar: 0.8,
        spread: 40,
      });

      // Auto complete after animation
      const timeout = setTimeout(() => {
        onComplete();
      }, 800);

      return () => clearTimeout(timeout);
    }
  }, [show, buttonRef, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Radial spotlight effect - smaller */}
          <motion.div
            className="absolute"
            style={{
              left: buttonRef?.getBoundingClientRect().left,
              top: buttonRef?.getBoundingClientRect().top,
              width: buttonRef?.getBoundingClientRect().width,
              height: buttonRef?.getBoundingClientRect().height,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 4, opacity: [0, 0.3, 0] }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="w-full h-full rounded-full bg-gradient-radial from-primary/20 via-primary/5 to-transparent blur-xl" />
          </motion.div>

          {/* Floating film icons - fewer and smaller */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-primary/30"
              style={{
                left: buttonRef?.getBoundingClientRect().left,
                top: buttonRef?.getBoundingClientRect().top,
              }}
              initial={{ 
                x: 0, 
                y: 0, 
                opacity: 0,
                scale: 0,
                rotate: 0,
              }}
              animate={{
                x: Math.cos((i * Math.PI * 2) / 4) * 60,
                y: Math.sin((i * Math.PI * 2) / 4) * 60,
                opacity: [0, 0.8, 0],
                scale: [0, 0.8, 0],
                rotate: 180,
              }}
              transition={{
                duration: 0.5,
                delay: i * 0.02,
                ease: "easeOut",
              }}
            >
              {i % 2 === 0 ? (
                <Star className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </motion.div>
          ))}

          {/* Pulsing ring - smaller */}
          <motion.div
            className="absolute border border-primary/40 rounded-full"
            style={{
              left: buttonRef?.getBoundingClientRect().left,
              top: buttonRef?.getBoundingClientRect().top,
              width: buttonRef?.getBoundingClientRect().width,
              height: buttonRef?.getBoundingClientRect().height,
            }}
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: [1, 2, 3], opacity: [0.8, 0.3, 0] }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}