export const CONTENT_STATUS = {
  Draft: 'draft',
  InReview: 'in_review',
  Published: 'published',
  Archived: 'archived',
} as const;

export const SLOT_KIND = {
  Rule: 'rule',
  FixedGroup: 'fixed_group',
  FixedItem: 'fixed_item',
} as const;

export const PUBLISH_CAPABILITY = 'exam_content.publish';
