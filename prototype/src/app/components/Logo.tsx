import { Film } from "lucide-react";
import { LogoIcon } from "./LogoIcon";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <LogoIcon className="w-auto h-12" />
    </div>
  );
}