export const DEFAULT_PROJECT_PRESENTATION_HTML = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
  href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
  rel="stylesheet"
/>

<section class="study-hero-placeholder">
  <div class="study-hero-bg">
    <div class="dna-strand" aria-hidden="true">
      <span></span><span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span><span></span>
    </div>
  </div>

  <div class="study-hero-content">
    <div class="placeholder-label">
      Placeholder study overview
    </div>

    <h1>
      Multi-omic characterization of disease-associated cellular states
    </h1>

    <p class="study-summary">
      This space is intended for a concise, human-readable study description:
      cohort context, biological question, assay design, sample composition,
      and the key reason this dataset matters.
    </p>

    <div class="study-metrics">
      <div>
        <strong>128</strong>
        <span>samples</span>
      </div>
      <div>
        <strong>4</strong>
        <span>assays</span>
      </div>
      <div>
        <strong>12.4M</strong>
        <span>variants</span>
      </div>
      <div>
        <strong>38k</strong>
        <span>cells</span>
      </div>
    </div>

    <div class="placeholder-note">
      Replace this block with a real abstract, study rationale, graphical summary,
      cohort map, or interactive overview.
    </div>
  </div>
</section>

<style>
  .study-hero-placeholder {
    position: relative;
    overflow: hidden;
    border-radius: 32px;
    padding: 56px;
    min-height: 100%;
    box-sizing: border-box;
    background:
      radial-gradient(circle at 15% 20%, rgba(56, 189, 248, 0.28), transparent 32%),
      radial-gradient(circle at 85% 10%, rgba(168, 85, 247, 0.24), transparent 30%),
      linear-gradient(135deg, #07111f 0%, #0f172a 48%, #111827 100%);
    color: #f8fafc;
    font-family:
      "Inter",
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }

  .study-hero-placeholder::before {
    content: "";
    position: absolute;
    inset: 0;
    border: 1px dashed rgba(226, 232, 240, 0.18);
    border-radius: 32px;
    pointer-events: none;
  }

  .study-hero-bg {
    position: absolute;
    inset: 0;
    opacity: 0.78;
    pointer-events: none;
  }

  .study-hero-bg::before {
    content: "";
    position: absolute;
    inset: -40%;
    background-image:
      linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
    background-size: 38px 38px;
    transform: rotate(-8deg);
  }

  .dna-strand {
    position: absolute;
    right: 8%;
    top: 50%;
    width: 170px;
    height: 280px;
    transform: translateY(-50%) rotate(18deg);
  }

  .dna-strand span {
    position: absolute;
    left: 50%;
    width: 120px;
    height: 2px;
    transform: translateX(-50%);
    background: linear-gradient(90deg, #38bdf8, #a78bfa);
    border-radius: 999px;
    opacity: 0.72;
  }

  .dna-strand span::before,
  .dna-strand span::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    transform: translateY(-50%);
    background: #e0f2fe;
    box-shadow: 0 0 18px rgba(56, 189, 248, 0.9);
  }

  .dna-strand span::before {
    left: -4px;
  }

  .dna-strand span::after {
    right: -4px;
    background: #ede9fe;
    box-shadow: 0 0 18px rgba(167, 139, 250, 0.9);
  }

  .dna-strand span:nth-child(1) {
    top: 8%;
    transform: translateX(-50%) rotate(28deg);
  }

  .dna-strand span:nth-child(2) {
    top: 17%;
    transform: translateX(-50%) rotate(-18deg);
  }

  .dna-strand span:nth-child(3) {
    top: 26%;
    transform: translateX(-50%) rotate(22deg);
  }

  .dna-strand span:nth-child(4) {
    top: 35%;
    transform: translateX(-50%) rotate(-26deg);
  }

  .dna-strand span:nth-child(5) {
    top: 44%;
    transform: translateX(-50%) rotate(20deg);
  }

  .dna-strand span:nth-child(6) {
    top: 53%;
    transform: translateX(-50%) rotate(-20deg);
  }

  .dna-strand span:nth-child(7) {
    top: 62%;
    transform: translateX(-50%) rotate(25deg);
  }

  .dna-strand span:nth-child(8) {
    top: 71%;
    transform: translateX(-50%) rotate(-24deg);
  }

  .dna-strand span:nth-child(9) {
    top: 80%;
    transform: translateX(-50%) rotate(19deg);
  }

  .dna-strand span:nth-child(10) {
    top: 89%;
    transform: translateX(-50%) rotate(-28deg);
  }

  .study-hero-content {
    position: relative;
    z-index: 1;
    max-width: 760px;
  }

  .placeholder-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 22px;
    padding: 8px 12px;
    border: 1px solid rgba(125, 211, 252, 0.36);
    border-radius: 999px;
    background: rgba(8, 47, 73, 0.58);
    color: #bae6fd;
    font-family:
      "IBM Plex Mono",
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Monaco,
      Consolas,
      monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .placeholder-label::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #38bdf8;
    box-shadow: 0 0 16px rgba(56, 189, 248, 0.9);
  }

  .study-hero-content h1 {
    margin: 0;
    max-width: 700px;
    font-family:
      "Inter",
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    font-size: clamp(38px, 5.4vw, 68px);
    font-weight: 800;
    line-height: 0.94;
    letter-spacing: -0.065em;
    text-wrap: balance;
  }

  .study-summary {
    margin: 24px 0 0;
    max-width: 650px;
    color: #cbd5e1;
    font-size: 18px;
    font-weight: 400;
    line-height: 1.72;
    letter-spacing: -0.01em;
  }

  .study-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 34px;
    max-width: 620px;
  }

  .study-metrics div {
    padding: 16px;
    border: 1px solid rgba(226, 232, 240, 0.14);
    border-radius: 18px;
    background: rgba(15, 23, 42, 0.62);
    backdrop-filter: blur(14px);
  }

  .study-metrics strong {
    display: block;
    font-family:
      "IBM Plex Mono",
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Monaco,
      Consolas,
      monospace;
    font-size: 25px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.04em;
    color: #f8fafc;
    font-variant-numeric: tabular-nums;
  }

  .study-metrics span {
    display: block;
    margin-top: 8px;
    color: #94a3b8;
    font-family:
      "IBM Plex Mono",
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Monaco,
      Consolas,
      monospace;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .placeholder-note {
    margin-top: 26px;
    max-width: 620px;
    padding: 14px 16px;
    border-left: 3px solid #38bdf8;
    border-radius: 12px;
    background: rgba(14, 165, 233, 0.1);
    color: #dbeafe;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.6;
    letter-spacing: -0.005em;
  }

  @media (max-width: 760px) {
    .study-hero-placeholder {
      padding: 34px 24px;
    }

    .dna-strand {
      opacity: 0.28;
      right: -20px;
    }

    .study-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
`;
