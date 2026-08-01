# Analytics methodology

Ruwt calculates the current overview from accepted normalized events.

- Estimated cost is the sum of adapter-provided micro-dollar estimates.
- First-pass test rate is passed `test.completed` events divided by observed
  completed test events.
- Data coverage is the percentage of events that identify an actor, repository,
  and agent vendor.
- A merged pull request is an observed `pull_request.merged` event.

The first rules detect high-cost failures, missing tests after changes,
sensitive file classifications, missing actors, outdated adapters, rework,
long abandoned sessions, and material agent test-rate differences. Results show
correlation. They do not prove a person or agent caused an outcome.
