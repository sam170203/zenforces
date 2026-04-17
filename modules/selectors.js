// Single source of truth for all DOM selectors.
// Each feature lists candidate selectors in priority order.
// When Codeforces updates their DOM, only this file changes.

ZF.SELECTORS = {

  // Rating numbers: profile pages, ranklist, submission pages
  ratings: [
    '.user-rank',
    '.rating',
    '[class*="rated-user"]',
    '.personal-sidebar .rating-badge',
  ],

  // Rank label text (Newbie, Pupil, Expert, etc.)
  rankLabels: [
    '.user-rank',
    '.title',
    '.roundbox .title',
  ],

  // Username elements that carry rank color via class
  usernames: [
    'a.rated-user',
    '.rating-link',
    '.contestant-name a',
  ],

  // Verdict elements on submission pages and status tables
  verdicts: [
    '.verdict-accepted',
    '.verdict-rejected',
    '.submissionVerdictWrapper',
    'td.status-verdict-cell',
  ],

  // Elements hidden by cleanUI
  clutter: [
    '.lang-chooser',
    '#footer',
  ],

  // Elements hidden by focusMode
  focusTargets: [
    '#standings',
    '.standings-table',
    '.contest-state-phase',
  ],

  // Selectors for latest verdict polling (submissionFeedback)
  latestVerdict: [
    '#recentActions .verdict-accepted',
    '#recentActions .verdict-rejected',
    '#status-filter-form tr:nth-child(2) td.status-verdict-cell',
    'tr.first-accepted td.status-verdict-cell',
  ],
};
