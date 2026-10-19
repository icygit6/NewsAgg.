"""Fail-closed admission policy, run again immediately before publication."""
from core import config, quality

def rejection(record):
    reason = quality.date_rejection(quality.parse_date(record.get('published_at')), config.MAX_AGE_DAYS)
    if reason:
        return reason
    if record.get('extraction_version') != quality.VERSION:
        return 'unverified_extraction'
    text = record.get('content') or ''
    blocks = record.get('content_blocks')
    if len(text) < config.MIN_TEXT_LEN or not isinstance(blocks, list) or not blocks:
        return 'incomplete_body'
    rendered = []
    for block in blocks:
        if not isinstance(block, dict) or block.get('type') not in ('heading', 'paragraph', 'quote', 'caption', 'list'):
            return 'invalid_body_blocks'
        if block['type'] == 'list':
            items = block.get('items')
            if not isinstance(items, list) or not items or any(not isinstance(s, str) or not s.strip() for s in items):
                return 'invalid_body_blocks'
            rendered.append('\n'.join(items))
        else:
            value = block.get('text')
            if not isinstance(value, str) or not value.strip():
                return 'invalid_body_blocks'
            rendered.append(value)
    if '\n\n'.join(rendered) != text:
        return 'body_blocks_mismatch'
    if record.get('content_hash') != quality.content_hash(text):
        return 'content_hash_mismatch'
    topic = record.get('topic')
    if topic not in config.CATEGORY_LABELS or record.get('ai_top_label') != topic:
        return 'unverified_category'
    meta = record.get('quality_metadata') or {}
    if not meta.get('category_model'):
        return 'missing_category_model'
    evidence = meta.get('summary_evidence') or []
    summary = record.get('ai_summary')
    if not summary or not evidence or any(not isinstance(s, str) or s not in text for s in evidence) or summary != '\n'.join(evidence):
        return 'unverified_summary'
    if meta.get('image_status') not in ('verified', 'unavailable'):
        return 'unfinished_image_check'
    if meta['image_status'] == 'verified' and (not record.get('images') or not record.get('url_to_image')):
        return 'incomplete_image'
    # A story without a publisher photo is not published at all (mostly Yahoo
    # text pieces); it counts as a failed candidate and the quota moves on.
    if meta['image_status'] == 'unavailable':
        return 'no_image'
    if meta['image_status'] == 'verified' and not any(image.get('url') == record['url_to_image'] for image in record['images']):
        return 'image_primary_mismatch'
    return None
