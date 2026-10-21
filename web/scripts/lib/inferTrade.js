/**
 * Best-effort trade guess from a vendor's name. Many OneDrive vendor folder
 * names are abbreviated or cryptic (e.g. "Q", "Presco", "SMG") and have no
 * reliable keyword to go on — those are left null rather than guessed at.
 */
const TRADE_KEYWORDS = [
  [/electric/i, "Electrical"],
  [/plumb/i, "Plumbing"],
  [/piping/i, "Plumbing"],
  [/hvac|cooling|heating/i, "HVAC"],
  [/fire.*sprinkler|sprinkler/i, "Fire Protection"],
  [/demo(lition)?/i, "Demolition"],
  [/asbestos/i, "Abatement"],
  [/fenc/i, "Fencing"],
  [/elevator/i, "Elevator"],
  [/paint/i, "Painting"],
  [/steel|iron/i, "Structural Steel"],
  [/scaffold/i, "Scaffolding"],
  [/draft/i, "Drafting"],
  [/window/i, "Windows"],
  [/tile/i, "Tile"],
  [/saf[e]?ty/i, "Safety"],
  [/clean/i, "Cleaning"],
  [/expedit/i, "Expediting"],
  [/survey/i, "Surveying"],
  [/architect/i, "Architecture"],
  [/chute/i, "Debris Removal"],
  [/inspect/i, "Inspection"],
  [/stairs/i, "Stairs"],
  [/engineer/i, "Engineering"],
  [/roof/i, "Roofing"],
  [/drywall/i, "Drywall"],
  [/concrete/i, "Concrete"],
  [/framing/i, "Framing"],
  [/flooring/i, "Flooring"],
  [/landscap/i, "Landscaping"],
  [/security|camera/i, "Security"],
  [/construction corp|general contract/i, "General Contracting"],
];

function inferTrade(vendorName) {
  for (const [pattern, trade] of TRADE_KEYWORDS) {
    if (pattern.test(vendorName)) return trade;
  }
  return null;
}

module.exports = { inferTrade };
