/**
 * Browser page translators (Chrome, Edge, Safari) replace text nodes with their own elements.
 * When React later removes or inserts next to a node the translator has moved, the DOM throws
 * "The node to be removed is not a child of this node" and the whole page goes blank.
 * These guards skip such stale operations instead of throwing (see facebook/react#11538).
 */
export function installTranslationGuard() {
  if (typeof Node !== "function" || !Node.prototype) return;
  const proto = Node.prototype as Node & { __translationGuard?: boolean };
  if (proto.__translationGuard) return;
  proto.__translationGuard = true;

  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };

  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) return node;
    return insertBefore.call(this, node, reference) as T;
  };
}
