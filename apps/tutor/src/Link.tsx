/**
 * Anchor that performs SPA navigation via {@link navigate} from `router.ts`.
 *
 * The `to` prop is a `RouteId`, so call sites cannot link to an unknown
 * page by accident.
 */

import type { MouseEvent, ReactNode } from "react";
import { navigate, routePath, type RouteId } from "./router.ts";

export interface LinkProps {
  to: RouteId;
  children: ReactNode;
  className?: string;
  "data-cy"?: string;
}

export function Link({ to, children, className, ...rest }: LinkProps) {
  const href = routePath(to);
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
