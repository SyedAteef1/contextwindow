/**
 * The HTML wrapper every outbound email gets.
 *
 * Mail clients are not browsers. Gmail strips `<style>` blocks in some views,
 * Outlook renders through Word, and neither can be relied on for flexbox, grid,
 * custom properties, or web fonts. So everything here is inline styles on
 * tables, which is the only layout that renders the same in all of them, and
 * the palette is the app's own values written out literally because there is no
 * stylesheet to read tokens from.
 *
 * Dark mode is deliberately left alone: forcing a dark palette breaks clients
 * that invert it themselves, and a light email on a dark background is the more
 * forgiving failure.
 */
const INK = "#18181b";
const MUTED = "#52525b";
const FAINT = "#a1a1aa";
const RULE = "#e4e4e7";
const SUNKEN = "#fafafa";
const ACCENT = "#c2410c";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type EmailBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "rule" };

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `**bold**` and `[label](url)` survive; everything else is escaped. */
function inline(text: string): string {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight:600;color:${INK};">$1</strong>`)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      `<a href="$2" style="color:${ACCENT};text-decoration:underline;">$1</a>`,
    );
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "heading":
      return `<tr><td style="padding:24px 0 8px;font:600 11px/1.4 ${FONT};letter-spacing:0.08em;text-transform:uppercase;color:${FAINT};">${escape(
        block.text,
      )}</td></tr>`;

    case "paragraph":
      return `<tr><td style="padding:0 0 12px;font:400 15px/1.6 ${FONT};color:${MUTED};">${inline(
        block.text,
      )}</td></tr>`;

    case "bullets":
      // Bullets are table rows rather than <ul>, because Outlook adds its own
      // indentation to lists and it does not match anything around it.
      return `<tr><td style="padding:0 0 12px;">${block.items
        .map(
          (item) =>
            `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>` +
            `<td width="16" valign="top" style="padding:0 0 6px;font:400 15px/1.6 ${FONT};color:${FAINT};">&bull;</td>` +
            `<td valign="top" style="padding:0 0 6px;font:400 15px/1.6 ${FONT};color:${MUTED};">${inline(
              item,
            )}</td></tr></table>`,
        )
        .join("")}</td></tr>`;

    case "quote":
      return (
        `<tr><td style="padding:4px 0 16px;">` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${SUNKEN};border-left:2px solid ${RULE};">` +
        `<tr><td style="padding:12px 16px;font:400 14px/1.6 ${FONT};color:${MUTED};font-style:italic;">${inline(
          block.text,
        )}` +
        (block.attribution
          ? `<div style="margin-top:6px;font-style:normal;font-size:12px;color:${FAINT};">${escape(
              block.attribution,
            )}</div>`
          : "") +
        `</td></tr></table></td></tr>`
      );

    case "rule":
      return `<tr><td style="padding:8px 0 20px;"><div style="height:1px;background:${RULE};line-height:1px;font-size:0;">&nbsp;</div></td></tr>`;
  }
}

export type EmailAction = { label: string; url: string };

/**
 * Wrap blocks in the full document.
 *
 * `preheader` is the grey line a client shows next to the subject in the inbox
 * list. Left unset it gets filled with whatever the first visible text is,
 * which is usually the eyebrow — so it is worth setting deliberately.
 */
export function renderEmail(input: {
  title: string;
  eyebrow?: string;
  preheader?: string;
  blocks: EmailBlock[];
  action?: EmailAction;
  footer?: string;
}): string {
  const blocks = input.blocks.map(renderBlock).join("");

  const action = input.action
    ? `<tr><td style="padding:12px 0 8px;">` +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td style="background:${INK};border-radius:4px;">` +
      `<a href="${escape(input.action.url)}" style="display:inline-block;padding:11px 20px;font:600 14px/1 ${FONT};color:#ffffff;text-decoration:none;">${escape(
        input.action.label,
      )}</a></td></tr></table></td></tr>`
    : "";

  const footer = input.footer
    ? `<tr><td style="padding:28px 0 0;border-top:1px solid ${RULE};font:400 12px/1.6 ${FONT};color:${FAINT};">${inline(
        input.footer,
      )}</td></tr>`
    : "";

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${SUNKEN};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(
    input.preheader ?? "",
  )}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${SUNKEN};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid ${RULE};border-radius:4px;">
<tr><td style="padding:28px 32px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${
  input.eyebrow
    ? `<tr><td style="padding:0 0 6px;font:600 11px/1.4 ${FONT};letter-spacing:0.08em;text-transform:uppercase;color:${ACCENT};">${escape(
        input.eyebrow,
      )}</td></tr>`
    : ""
}
<tr><td style="padding:0 0 18px;font:600 22px/1.3 ${FONT};color:${INK};letter-spacing:-0.01em;">${escape(
    input.title,
  )}</td></tr>
${blocks}
${action}
${footer}
</table>
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
<tr><td align="center" style="padding:16px 8px 0;font:400 11px/1.5 ${FONT};color:${FAINT};">
Context Window
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/**
 * Turn the markdown the agents already write into blocks.
 *
 * The agents produce markdown because that is what reads well in the app, and
 * rewriting them to emit blocks would mean two formats to keep in step. This
 * parses the subset they actually use: headings, bullets, and paragraphs.
 */
export function markdownToBlocks(markdown: string): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length) blocks.push({ type: "bullets", items: bullets });
    bullets = [];
  };
  const flush = () => {
    flushParagraph();
    flushBullets();
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ type: "heading", text: heading[1].replace(/\*\*/g, "").trim() });
      continue;
    }

    // A lone bold line is how the agents write a section label.
    const boldOnly = line.match(/^\*\*(.+?)\*\*:?$/);
    if (boldOnly) {
      flush();
      blocks.push({ type: "heading", text: boldOnly[1].trim() });
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1].trim());
      continue;
    }

    flushBullets();
    paragraph.push(line);
  }

  flush();
  return blocks;
}
