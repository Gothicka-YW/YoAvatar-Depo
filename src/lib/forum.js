// forum.js - build forum-friendly link or BBCode snippet for an avatar
// Option: could adapt to forum formatting preferences later.

export function makeForumLink(imageUrl){
  // Simple BBCode image embed + link fallback
  return `[img]${imageUrl}[/img]`;
}
