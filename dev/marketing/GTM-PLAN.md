# Ruwt.dev Go-To-Market Playbook

*Internal document. Last updated: 2026-02-22.*

---

## 1. Executive Summary

Ruwt.dev is an AI-efficiency assessment platform that shows hiring teams how candidates actually use AI to solve real engineering problems. Instead of testing whether someone can memorize algorithms, we measure model selection, prompt efficiency, cost awareness, and debugging skill — the things that matter when your entire team is using Copilot, Cursor, and Claude every day. We're selling a $200/month subscription to engineering managers who are tired of HackerRank scores that tell them nothing about how a candidate will perform with AI tools. The product is ready. The hiring assessment flow is built — session replays, AI profiles, behavioral insights, 60+ challenges. Now we need paying customers.

---

## 2. Pricing Rationale

**$200/month flat rate. Unlimited assessments. Cancel anytime.**

**Why flat rate, not per-assessment:**
- Per-assessment pricing punishes teams for hiring more. That's backwards — we want customers who use the product heavily, because heavy usage means they see the value and stay.
- Flat rate is dead simple to explain. No calculator, no "how many assessments will we run this quarter" conversations. One number.
- It also means the sales conversation is about whether the product is worth $200/month, not about negotiating per-unit costs. Simpler close.

**Why $200/month specifically:**
- Low enough that an engineering manager can expense it without VP approval at most companies.
- High enough to filter out tire-kickers and signal that this is a real tool, not a toy.
- At 50 customers, that's $10K MRR. That's the milestone that matters for the first year.

**Annual option: $1,800/year (saves $600):**
- 25% discount for annual commitment. Straightforward.
- Improves cash flow and reduces churn. But we don't push it hard — monthly is the default offer. Annual is for customers who ask "can I save money by paying upfront?"

**Enterprise: Custom pricing, contact us:**
- For companies with 500+ engineers or specific compliance/integration needs.
- We don't have a pricing page for enterprise. They reach out, we scope it, we quote.

**Why no free tier for B2B:**
- Free tiers attract people who will never pay. We don't have the bandwidth to support free users right now.
- The 30-day money-back guarantee serves the same function as a free trial — it removes risk — without attracting freeloaders.
- If someone won't spend $200 to evaluate a hiring tool, they're not a real buyer.

**Why money-back guarantee instead of free trial:**
- A money-back guarantee signals confidence. "Pay us, use it for a month, and if it's not worth it, we'll refund you. No questions."
- It also means every user is a paying user from day one. That changes how they treat the product — they actually use it, because they paid for it.

**Individual developers still get free practice with 50K credits.**
- This isn't charity — it's pipeline. Developers who practice on Ruwt and like it will tell their managers. "Hey, we should use this for hiring."

---

## 3. Target Customer Profile

**Who we're selling to:**

The primary buyer is an engineering manager (or VP of Engineering, or Head of Talent) at a company with 100-500 engineers. They're hiring 3+ developers per quarter. Their team already uses AI tools — Copilot, Cursor, ChatGPT, Claude — and they've noticed that some engineers are dramatically more productive with AI than others. They want to hire for that skill, but they don't have a way to measure it.

**What they care about:**
- Reducing time-to-hire. Their current process (HackerRank + take-homes + 5-round interviews) takes 4-6 weeks per candidate.
- Hiring developers who can actually ship with AI, not just pass algorithm puzzles.
- Seeing how candidates think, not just whether they got the right answer. Session replays and AI usage profiles matter to them.
- Not embarrassing their company with a bad candidate experience. Developers hate HackerRank. A platform that developers actually find interesting is a selling point.

**What frustrates them about current tools:**
- HackerRank/Codility tests for skills that don't predict on-the-job performance.
- Take-home assignments take forever to review and candidates resent them.
- Live coding interviews are inconsistent and depend heavily on the interviewer.
- None of these tools measure AI fluency, which is now the most important variable in developer productivity.

**Where to find them:**
- LinkedIn. Engineering managers post about hiring pain constantly. Search for posts about "hiring process," "technical assessment," "AI tools for developers."
- Hacker News. Threads about hiring, AI productivity, developer tools.
- Engineering leadership Slack communities (Rands Leadership Slack, Engineering Managers Slack, CTO Craft).
- Dev tool conferences and meetups (but only after we have case studies — don't sponsor anything yet).
- Twitter/X engineering and AI communities.

**Company signals that indicate fit:**
- Job postings that mention AI tools, Copilot, or prompt engineering.
- Companies that have recently posted about improving their hiring process.
- Companies that are growing engineering teams (check LinkedIn headcount trends).
- Companies that use other modern dev tools (Vercel, Linear, Notion, Figma) — they tend to be early adopters.

---

## 4. Outreach Playbook

### Cold Email Template

**Subject line options (pick one per batch, A/B test):**
1. How [Company] evaluates AI fluency in hiring
2. Your next hire's AI skills — how would you know?
3. Quick question about [Company]'s technical assessments

**Day 0 — Initial Email:**

Subject: [chosen subject line]

Hi [Name],

I noticed [Company] is hiring [X engineers / for Y role]. Quick question — how are you evaluating candidates' ability to use AI tools effectively?

We built ruwt.dev to solve exactly this. It's an assessment platform where candidates solve real engineering challenges while we track how they use AI — model selection, prompt efficiency, cost, debugging. You get session replays and behavioral insights, not just a pass/fail score.

$200/month, unlimited assessments, cancel anytime. 30-day money-back guarantee if it's not useful.

Interested?

[Your name]

---

**Day 3 — Follow-up:**

Subject: Re: [original subject]

Hi [Name],

Following up on my note from Monday. Here's what makes this different from HackerRank or take-homes:

- You see how candidates actually use AI, not just whether they got the right answer
- Session replays show their thinking process — prompt strategy, debugging, model choices
- 60+ challenges that test real engineering skills, not algorithm trivia
- Candidates don't hate it (some actually enjoy it)

Happy to show you a 10-minute demo if you're curious. Or just sign up at ruwt.dev — it takes 5 minutes to set up your first assessment.

[Your name]

---

**Day 7 — Final:**

Subject: Re: [original subject]

Hi [Name],

Last note from me. If evaluating AI skills in hiring isn't on your radar right now, no worries — I'll stop emailing.

If it is, ruwt.dev is $200/month flat, unlimited assessments, and you can cancel anytime. We also have a 30-day money-back guarantee, so there's no risk to trying it.

Either way, I appreciate your time.

[Your name]

---

### Objection Handling

**"$200/month is too expensive."**
- "What are you spending per HackerRank assessment right now? Most companies pay $25-50 per candidate. If you're assessing 10+ candidates a month, you're already spending more than $200 — and you're not getting AI fluency data. We're cheaper and you get more signal."
- If they genuinely can't afford $200/month, they're not our customer right now. Don't discount. Move on.

**"We already use HackerRank / Codility."**
- "Those tools are great for algorithm testing. They don't tell you anything about how a candidate uses AI. Does your team use Copilot or Cursor? Then you're hiring for a skill you're not testing for. Ruwt fills that gap — you can use both."
- Position as complementary, not a replacement (even though it is). Don't trash their current tool.

**"Our engineers don't really use AI yet."**
- "That's actually the perfect time to start measuring it. The teams that figure out AI fluency first will out-ship everyone else. Ruwt can help you identify which of your current engineers are most effective with AI, and hire people who match that bar."
- If they push back hard, they're probably 6-12 months away from being a customer. Add them to a nurture list, don't force it.

**"We do take-home assignments."**
- "How long does it take your team to review each one? And how do candidates feel about them? Take-homes test for the right things — real work, not trivia — but they're slow and candidates drop out. Ruwt gives you the same signal (how someone actually works) in a structured, timed environment with automatic scoring and session replays. No review burden on your team."

**"Can we get a free trial?"**
- "We don't do free trials, but we do have a 30-day money-back guarantee. Sign up, run your assessments, and if it's not worth $200/month, we'll refund you completely. Same risk as a free trial, but you get the full product from day one."
- Do not offer free access. Not a pilot, not a POC, not "just one assessment for free." The money-back guarantee handles the risk objection.

---

## 5. Referral Loop

**Timing:** After a customer runs their first assessment and has seen the session replay / AI profile for at least one candidate.

**The ask (email or call):**

"Now that you've seen how the assessments work — do you know 2-3 other engineering managers who are hiring and might find this useful? For every referral that becomes a paying customer, you get a free month of Ruwt."

**Mechanics:**
- Customer gives you names + emails (or warm intros).
- You send a personalized email mentioning the referrer: "Hi [Name], [Referrer] at [Company] suggested I reach out. They've been using Ruwt to evaluate AI fluency in their hiring process and thought you might find it useful too."
- When the referral converts, apply a $200 credit to the referrer's next invoice.
- No limit on referral credits. If someone refers 5 customers, they get 5 free months. That's $1,000 in credits that generated $12,000+ in ARR. Worth it.

**Rules:**
- Only ask after they've actually used the product. Don't ask at signup.
- Don't make it weird. One ask, one follow-up if they said "let me think about it." If they don't refer anyone, drop it.
- Track referrals manually in a spreadsheet until we have volume that justifies building it into the product.

---

## 6. 10-Month Timeline

### Month 1-2: Foundation

**Goals:** Ship subscription billing, send first 50 outreach emails, land 3-5 paying customers.

**Tasks:**
- Implement Stripe subscription billing ($200/month and $1,800/year options)
- Build the team/org management flow (multiple team members under one subscription)
- Write and send 50 cold emails (10 per week for 5 weeks)
- Track open rates, reply rates, and conversion in a spreadsheet
- Iterate on email copy based on responses
- Do demo calls with anyone who replies positively
- Close 3-5 customers. If you can't close 3 in 8 weeks, the messaging or targeting is wrong — reassess.

**Revenue target:** $600-$1,000 MRR

### Month 3-4: Early Traction

**Goals:** Reach 10-15 paying customers, gather feedback, build first case studies.

**Tasks:**
- Continue outreach: 15-20 emails per week, incorporating what worked from month 1-2
- Onboarding calls with every new customer (learn what they care about, what's confusing)
- Fix the top 3 product friction points customers mention
- Ask first 3 customers for a testimonial or short case study
- Publish 1 case study on the website (even if it's anonymized: "A 200-person fintech company reduced time-to-hire by...")
- Start posting on LinkedIn 2-3x per week (more on this in Content Strategy)

**Revenue target:** $2,000-$3,000 MRR

### Month 5-6: Growth Mechanics

**Goals:** Activate referral program, establish content rhythm, reach 25 customers.

**Tasks:**
- Launch referral program (free month per converted referral)
- Ask every existing customer for 2-3 referrals
- Publish 2 more case studies
- LinkedIn posting at 3x/week cadence — mix of insights, case study snippets, and product updates
- Write 2-3 blog posts about AI fluency in hiring (SEO play, slow burn)
- Consider a "State of AI Fluency" report using anonymized data from assessments (if volume supports it)
- Explore partnerships with recruiting agencies that specialize in engineering roles

**Revenue target:** $5,000 MRR

### Month 7-8: Scaling Outreach

**Goals:** 40 paying customers, published case studies driving inbound.

**Tasks:**
- Outreach volume: 30-40 emails per week (may need to automate or hire a part-time SDR)
- Publish hiring case studies on LinkedIn, Hacker News, and relevant engineering blogs
- Guest post or be interviewed on engineering leadership podcasts
- Evaluate whether conference sponsorship or speaking makes sense (only if case studies are strong)
- Start tracking inbound vs. outbound pipeline — goal is 30%+ inbound by month 8

**Revenue target:** $8,000 MRR

### Month 9-10: Consolidation

**Goals:** $8,000-$10,000 MRR, evaluate pricing increase.

**Tasks:**
- Analyze customer data: which segments have lowest churn, highest NPS, fastest time-to-value?
- Consider raising price to $300/month for new customers (grandfather existing customers at $200)
- Build enterprise pricing page and start outbound to larger companies (500+ engineers)
- Hire or contract a dedicated salesperson if pipeline supports it
- Write a "Year One" retrospective — what worked, what didn't, where to invest next
- Set goals for months 11-18

**Revenue target:** $8,000-$10,000 MRR (40-50 customers)

---

## 7. Metrics to Track

**Outreach metrics:**
- Emails sent per week
- Open rate (target: 40-50%)
- Reply rate (target: 15-20%)
- Reply-to-demo rate (target: 30-40% of replies)
- Demo-to-subscribe rate (target: 25-30%)
- Overall outreach-to-subscribe rate (target: 10-15% of replies converting)
- Time from first email to subscription (target: under 14 days)

**Revenue metrics:**
- MRR (monthly recurring revenue)
- MRR growth rate (month over month)
- Annual vs. monthly subscription split
- Revenue per customer (should be $200 unless enterprise)

**Retention metrics:**
- Monthly churn rate (target: under 10%)
- Churn by customer segment (company size, industry, usage level)
- NPS score (survey quarterly, target: 40+)
- Time-to-first-assessment (target: under 48 hours from signup)
- Assessments run per customer per month (leading indicator of retention — more usage = lower churn)

**Product metrics:**
- Number of assessments created per customer
- Number of candidates assessed per customer
- Session replay views (are hiring managers actually watching the replays?)
- AI profile views (are they reading the behavioral insights?)
- Feature requests and support tickets per customer

**Track all of this in a spreadsheet until there's enough volume to justify a dashboard.**

---

## 8. Content Strategy

### LinkedIn: 3x per week

This is the primary channel. Engineering managers are on LinkedIn. They read posts about hiring, leadership, and tools.

**Post types (rotate):**

1. **Insight posts** — Short observations about AI and hiring. Examples:
   - "The best developer on your team might not be the one who knows the most. It might be the one who knows how to ask the right questions to AI."
   - "We tested 200 developers on the same challenge. The ones who spent the least on AI prompts were almost always the ones who solved it fastest."
   - "Take-home assignments test the right thing (real work) but punish candidates for having lives outside of work. There's a middle ground."

2. **Product posts** — What we built and why. Show screenshots, session replays, AI profiles. Don't be salesy — be specific. "Here's what we see when a strong candidate solves a challenge" with a screenshot of the AI profile.

3. **Case study snippets** — Short stories from real customers (anonymized if needed). "A fintech company was spending 6 weeks per hire. After switching their first-round assessment to Ruwt, they cut it to 3 weeks and started seeing candidates' AI fluency for the first time."

4. **Opinion posts** — Thoughtful takes on hiring, AI, and engineering culture. Stay hopeful. Don't trash competitors. Challenge assumptions without being cynical.

**Rules for LinkedIn posts:**
- No fake engagement bait ("Agree?", "Thoughts?", "Like if you...")
- No countdown timers, fake urgency, or limited-time offers
- Never use the character that creates blockquotes (per brand constitution)
- Keep it honest. If we don't have data to support a claim, don't make it
- It's fine to mention the product, but not every post should be a pitch. 2 out of 3 posts should be purely insight or opinion

### Blog: 2-3 posts per month (starting month 3)

**Topics:**
- "What is AI fluency and why it matters for hiring" (foundational SEO piece)
- "How to evaluate a developer's AI skills in an interview" (tactical, actionable)
- "The problem with HackerRank for modern engineering teams" (opinion, not a hit piece — focus on what's changed, not what's wrong with them)
- "Session replays: what hiring managers actually learn from watching candidates code" (product-adjacent)
- Customer case studies (with permission)

**Distribution:** Every blog post gets repurposed into 2-3 LinkedIn posts. Write the blog first, then extract the best insights for short-form.

### What not to post:
- Anything that uses fear or outrage to drive attention
- Anything that trashes a competitor by name
- Anything with exaggerated claims ("10x your hiring" or "the future of technical assessment")
- Anything that sounds corporate or hollow

---

## 9. What Not To Do

**No free pilots.** Not "just one assessment to try it out." Not a "proof of concept for your team." The 30-day money-back guarantee handles the risk objection. If someone can't commit $200 to evaluate a tool, they're not a serious buyer.

**No discounting below $200/month.** Not for early customers, not for startups, not for "we'll give you a case study." $200 is already cheap. If we discount now, we set the expectation that the price is negotiable. It's not.

**No monthly seat pricing.** We're not charging per hiring manager or per recruiter. Flat rate, unlimited users, unlimited assessments. The simplicity is the feature.

**No multi-month sales cycles.** If a deal takes more than 2-3 weeks to close, move on. Our price point doesn't justify lengthy procurement processes. If they need legal review or security questionnaires, that's enterprise — quote accordingly. For the $200/month product, it's a credit card purchase, not a contract negotiation.

**No conference sponsorships in year one.** Not until we have strong case studies and know which events our customers actually attend. Save the money.

**No paid ads in year one.** The volume we need (50 customers) is achievable through direct outreach and content. Paid ads at this stage are a distraction and will eat budget without clear ROI.

**No product-led growth gimmicks.** No "invite 3 friends to unlock features." No gamified onboarding. No viral loops. We're selling to hiring managers, not consumers. Keep it professional and straightforward.

**No promises we can't keep.** If a customer asks for a feature we don't have, say "we don't have that yet" — not "that's on our roadmap for Q2." Only commit to what we can ship in the next 2 weeks.

---

*This is a living document. Update it as we learn what works and what doesn't.*
