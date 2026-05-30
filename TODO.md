# TODO

## Performance audit

- [ ] **Link the loading-page checkers to the actual measured load time.**
  The lazy-loading (`loading="lazy"`) and font-preload checks in
  `backend/audit.py::audit_performance` are currently static/heuristic — they
  flag missing hints regardless of how the page actually performs. Tie them to
  the real `load_time` already measured in `fetch_page`:
  - Only escalate (or weight harder) the lazy-load / font-preload findings when
    `load_time` is actually slow, so a fast page isn't penalised for hints it
    doesn't need.
  - Conversely, surface them more strongly when load time is poor and these are
    plausible causes (LCP / render-blocking impact).
