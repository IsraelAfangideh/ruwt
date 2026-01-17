Enterprise: Admin dashboard for transparency into customer interactions

**Date**: January 17, 2026  
**Status**: Proposed  
**Extends**: [Clone WhatsApp](./01_17_26_12_00_01_clone_whatsapp_with_agent_mediated_messaging.md)  
**Author**: Israel Peter Thompson Afangideh

We want an enterprise layer that gives owners transparency and oversight of customer interactions, especially when agents/runners are mediating messages.

### The Problem
If a company uses Ruwt for customer communications, they need visibility:
- what’s being sent
- by who
- to who
- with what mediation/policy
- and where issues are occurring

Without this, we can’t sell to serious organizations.

### The Solution
An **admin dashboard** for organizations that use Ruwt.

### Core Capabilities (v1)
- **Org + seats**
  - Invite/remove members
  - Roles: Owner, Admin, Agent, Viewer
- **Phone number / account mapping**
  - Org-owned numbers and user accounts
- **Conversation overview**
  - Recent conversations
  - Search by contact, agent, phone number, tags
- **Message audit trail**
  - Original input (where allowed)
  - Mediated output (what was sent)
  - Runner used + tone vector at send time
  - Language policy at send time
- **Basic analytics**
  - Volume over time
  - Median response time
  - % mediated vs raw

### Policy (v1.1)
Org owners can set:
- **Default tone vector** for customer-facing conversations
- **Minimum professionalism** (e.g. professionalism ≥ 7)
- **Approval requirement**
  - Require user approval before sending mediated messages (default ON)
  - Allow auto-send (later / gated)

### Discounts (connects to roadmap)
The dashboard should show:
- total customer interactions sent through Ruwt
- how many qualify for discounts (exact discount math is a separate policy decision)

### Data + Privacy
We need to be careful:
- Some orgs will require full logs; some will require minimal retention.
- The dashboard must support configurable retention and redaction policies.

### Rollout Phases
- **Phase 1**: read-only dashboard: org, seats, conversations list, mediated outputs.
- **Phase 2**: analytics + search + exports.
- **Phase 3**: policies + compliance features.

### Success
- Owners can answer: “What is happening with our customer communications?” in 2 minutes.
- Enterprise pilots can onboard without custom engineering.

### Open Questions
- How do we handle E2EE vs auditability? (we may need enterprise “not E2EE” mode)
- Do we allow per-team policies (Sales vs Support) or org-wide only at first?

