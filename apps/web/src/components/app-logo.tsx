import { ListChecksIcon } from "lucide-react";

export function AppLogo() {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ListChecksIcon className="size-5" />
      </span>
      Task Manager
    </div>
  );
}
