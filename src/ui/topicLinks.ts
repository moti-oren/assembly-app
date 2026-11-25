import { hasNumbers, type NumberLink } from '@/core/numberLink';

/** A link into a topic that has nothing to show says why. */
type TopicLink = object | { unavailable: string };

/** Why a topic has nothing to show for a link, or null when it has. */
export function unavailableIn(link: TopicLink): string | null {
  return 'unavailable' in link ? link.unavailable : null;
}

/**
 * What the way into the number topic opens, where it is not the operation beside it: after a
 * load that extends, the ALU worked out the address, and the numbers are the value made wider.
 */
export function numbersLinkWhat(link: NumberLink): string | null {
  if (!hasNumbers(link) || link.request.kind !== 'extend') return null;
  return `${link.request.from} bits made ${link.request.to}`;
}
