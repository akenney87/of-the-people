// File: src/pages/About.jsx
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="max-w-spread mx-auto animate-rise-in">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow text-vermillion">About</p>
        <h1
          className="font-display text-[2.5rem] md:text-h1 leading-[0.95] mt-3 text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
        >
          A small paper of public service.
        </h1>
        <p className="font-body text-lede text-ink-soft mt-4 max-w-3xl">
          What we&apos;re building, why now, and who it&apos;s for.
        </p>
      </header>

      <article className="mt-12 max-w-column font-body text-body text-ink leading-relaxed space-y-6">
        <p className="text-lede italic">
          You probably know who the President is. Maybe the Governor. Maybe
          even your mayor. But do you actually know how your member of
          Congress voted last month? How your county sheriff feels about
          ICE 287(g)? Whether your state senator wants to keep the
          six-week abortion ban?
        </p>

        <p>
          <span className="font-display text-h4 float-left mr-2 mt-1 leading-none"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 700' }}>
            O
          </span>
          f the People is a beta civic-tech app that does the legwork. You
          answer ten questions during signup, then refine your positions on
          the issue feed. We score, in real time, how well every elected
          official — from the U.S. Senate to the Gainesville City Council
          — actually represents you, with passion-weighted alignment math
          that gives more weight to the questions you care most about.
        </p>

        <h2 className="font-display text-h3 text-ink pt-4 leading-tight"
          style={{ fontVariationSettings: '"opsz" 96, "wght" 600' }}>
          The model.
        </h2>
        <p>
          Each rep&apos;s positions come from one of two places: an
          AI-inferred prediction with a confidence score and a supporting
          quote (clearly labeled with an AI badge), or — better — a
          claimed-and-verified answer from the official themselves. We call
          that a blue check. It&apos;s the headline feature of the next
          phase.
        </p>

        <h2 className="font-display text-h3 text-ink pt-4 leading-tight"
          style={{ fontVariationSettings: '"opsz" 96, "wght" 600' }}>
          Privacy and money.
        </h2>
        <p>
          Of the People is being incorporated as a 501(c)(3) non-profit.
          We do not sell data and do not run ads. Your street address is
          geocoded once at signup and discarded — only the resulting
          district IDs and ZIP code are stored.
        </p>

        <h2 className="font-display text-h3 text-ink pt-4 leading-tight"
          style={{ fontVariationSettings: '"opsz" 96, "wght" 600' }}>
          Where we are now.
        </h2>
        <p>
          Closed beta, Gainesville and Hall County, Georgia. Built by
          Alexander Kenney. If you have questions, opinions, or want to
          help, you know where to find me.
        </p>

        <div className="border-t border-rule pt-6 mt-12">
          <Link to="/dashboard" className="eyebrow text-vermillion hover:text-vermillion-deep">
            ← To the issue feed
          </Link>
        </div>
      </article>
    </div>
  );
}
