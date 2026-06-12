import { useEffect, useRef } from "react";
import { useGoogleOneTap } from "@/features/auth/hooks/use-google-one-tap";

type Props = {
  redirectTo: string;
  onError?: (message: string) => void;
};

export function GoogleSignInButton({ redirectTo, onError }: Props) {
  const { renderButton, isAvailable } = useGoogleOneTap({ redirectTo, onError });
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!isAvailable || !containerRef.current || renderedRef.current) return;

    const el = containerRef.current;

    function tryRender() {
      if (window.google) {
        renderedRef.current = true;
        void renderButton(el);
      } else {
        requestAnimationFrame(tryRender);
      }
    }

    tryRender();
  }, [isAvailable, renderButton]);

  if (!isAvailable) return null;

  return (
    <div className="flex w-full justify-center">
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
