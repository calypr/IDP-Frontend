import DOMPurify from 'isomorphic-dompurify';

export const sanitizeProjectPresentationHtml = (html: string): string => {
  const setSafeLinkAttributes = (node: Element) => {
    if (node.tagName === 'a' || node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  };

  DOMPurify.addHook('afterSanitizeAttributes', setSafeLinkAttributes);

  try {
    return DOMPurify.sanitize(html, {
      FORBID_TAGS: ['script'],
    });
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes');
  }
};
