// client/src/lib/shareCard.js
//
// Draws a square "result card" to an offscreen canvas and returns a PNG blob.
// It's a FROZEN image — the percentage is baked in, so it reads the same for
// everyone regardless of who's signed in (unlike a link to the live page, where
// the score recomputes per viewer). Self-contained: no dependencies, no server.
const W = 1080, H = 1080;
const PAPER = "#F4ECE0";
const INK = "#1A1A1A";
const INK_SOFT = "#6B6357";
const RULE = "#D8CDBB";
const VERM = "#C4321A";

// Greedy word-wrap; returns the y of the last line drawn.
function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = String(text).split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
  return yy;
}

export async function buildMatchCardBlob({ pct, name, office, party, issueCount }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Best-effort: load the brand fonts so the card matches the app. Fallbacks used if unavailable.
  try {
    await Promise.all([
      document.fonts.load('700 300px Fraunces'),
      document.fonts.load('600 88px Fraunces'),
      document.fonts.load('500 32px "Instrument Sans"'),
    ]);
  } catch { /* fall back to the serif/sans stacks below */ }
  const DISPLAY = '"Fraunces", Georgia, "Times New Roman", serif';
  const UI = '"Instrument Sans", system-ui, sans-serif';

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Masthead
  ctx.fillStyle = VERM;
  ctx.font = `600 30px ${UI}`;
  ctx.fillText("OF THE PEOPLE", 80, 112);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(80, 138); ctx.lineTo(W - 80, 138); ctx.stroke();

  // Big percentage
  const strong = pct >= 70, weak = pct < 40;
  ctx.fillStyle = strong ? VERM : weak ? INK_SOFT : INK;
  ctx.font = `700 300px ${DISPLAY}`;
  ctx.fillText(`${pct}%`, 72, 470);

  ctx.fillStyle = INK_SOFT;
  ctx.font = `400 44px ${DISPLAY}`;
  ctx.fillText("match with", 84, 540);

  // Candidate name (wraps)
  ctx.fillStyle = INK;
  ctx.font = `600 88px ${DISPLAY}`;
  const afterName = wrapText(ctx, name, 80, 648, W - 160, 98);

  // Office · party
  ctx.fillStyle = INK_SOFT;
  ctx.font = `500 34px ${UI}`;
  ctx.fillText([office, party].filter(Boolean).join("   ·   "), 82, afterName + 62);

  if (issueCount > 0) {
    ctx.fillStyle = INK_SOFT;
    ctx.font = `400 30px ${UI}`;
    ctx.fillText(`Based on ${issueCount} issue${issueCount === 1 ? "" : "s"} answered`, 82, afterName + 110);
  }

  // Footer
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, H - 156); ctx.lineTo(W - 80, H - 156); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `600 40px ${DISPLAY}`;
  ctx.fillText("How do you line up?", 80, H - 96);
  ctx.fillStyle = VERM;
  ctx.font = `500 34px ${UI}`;
  ctx.fillText("ofthepeople.vote", 80, H - 50);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
