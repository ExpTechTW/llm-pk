import { useState } from "react";

import { cn } from "@/lib/utils";

interface GithubAvatarProps {
  username: string;
  size?: number;
  className?: string;
}

/** GitHub 頭像;載入失敗時退回顯示首字母。 */
export function GithubAvatar({ username, size = 40, className }: GithubAvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = { width: size, height: size };

  return (
    <a
      href={`https://github.com/${username}`}
      target="_blank"
      rel="noreferrer"
      title={`@${username}`}
      className={cn(
        "ring-border bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 select-none",
        className
      )}
      style={dimension}
    >
      {failed ? (
        <span className="text-xs font-semibold">{username.slice(0, 1).toUpperCase()}</span>
      ) : (
        <img
          src={`https://github.com/${username}.png?size=${size * 2}`}
          alt={`@${username}`}
          loading="lazy"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
    </a>
  );
}
