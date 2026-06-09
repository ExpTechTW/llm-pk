import { useState } from "react";

import { cn } from "@/lib/utils";

interface GithubAvatarProps {
  username: string;
  size?: number;
  className?: string;
  /** 是否包成連到 GitHub 的連結(放在另一個連結內時請設 false 以免巢狀 a)。 */
  linked?: boolean;
}

/** GitHub 頭像;載入失敗時退回顯示首字母。 */
export function GithubAvatar({ username, size = 40, className, linked = true }: GithubAvatarProps) {
  const [failed, setFailed] = useState(false);

  const inner = failed ? (
    <span className="text-[10px] font-semibold">{username.slice(0, 1).toUpperCase()}</span>
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
  );

  const classes = cn(
    "ring-border bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 select-none",
    className
  );

  if (!linked) {
    return (
      <span className={classes} style={{ width: size, height: size }}>
        {inner}
      </span>
    );
  }

  return (
    <a
      href={`https://github.com/${username}`}
      target="_blank"
      rel="noreferrer"
      title={`@${username}`}
      className={classes}
      style={{ width: size, height: size }}
    >
      {inner}
    </a>
  );
}
