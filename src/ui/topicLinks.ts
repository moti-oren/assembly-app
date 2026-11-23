/** A link into a topic that has nothing to show says why. */
type TopicLink = object | { unavailable: string };

/** Why a topic has nothing to show for a link, or null when it has. */
export function unavailableIn(link: TopicLink): string | null {
  return 'unavailable' in link ? link.unavailable : null;
}
