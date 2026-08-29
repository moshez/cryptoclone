/* Send captured screenshots to Claude with a layout-defect rubric and print
 * structured findings. Dev-time tool only — never a CI gate: the pass is
 * nondeterministic, and every real finding must be converted into a
 * deterministic assertion in /e2e (see e2e/vision-findings.md).
 *
 * Requires ANTHROPIC_API_KEY. Run `npm run vision-review` in /tools.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shotsDir = join(here, 'screenshots');
const MODEL = process.env.VISION_REVIEW_MODEL ?? 'claude-opus-5';

const RUBRIC = `You are reviewing a screenshot of a cryptogram puzzle web app
for layout defects. Report ONLY defects you can actually see. Look
specifically for:
- text overflowing or clipping its container
- elements overlapping each other
- content extending past the viewport edge
- truncated or ellipsized text that should be complete
- puzzle cells wrapping mid-word
- the letter keyboard overlapping the puzzle grid
- tap targets that look too small to hit on a phone
- insufficient text/background contrast
- misalignment between cells, rows, or header elements
- awkward spacing at the extremes of content length (crowding or vast gaps)

The screenshot name tells you the viewport and the app state.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'element', 'description'],
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          element: { type: 'string', description: 'the UI element concerned' },
          description: { type: 'string' },
        },
      },
    },
  },
};

async function reviewOne(name) {
  const image = readFileSync(join(shotsDir, name)).toString('base64');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: RUBRIC,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Screenshot: ${name}` },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: image },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${name}: API ${res.status} ${await res.text()}`);
  const body = await res.json();
  if (body.stop_reason === 'refusal') return { findings: [] };
  return JSON.parse(body.content.map((b) => b.text ?? '').join(''));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY is not set. Capture ran; review needs the key.\n' +
        'Screenshots are in tools/screenshots — they can also be reviewed by eye.',
    );
    process.exit(2);
  }
  const shots = readdirSync(shotsDir).filter((f) => f.endsWith('.png')).sort();
  let total = 0;
  for (const shot of shots) {
    const { findings } = await reviewOne(shot);
    for (const f of findings) {
      total += 1;
      console.log(`[${f.severity}] ${shot} :: ${f.element}\n    ${f.description}`);
    }
  }
  console.log(`\n${total} finding(s) across ${shots.length} screenshots.`);
  if (total > 0) {
    console.log(
      'Convert each real finding into a deterministic assertion in /e2e and record it in e2e/vision-findings.md.',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
