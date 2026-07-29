# SendKPI Meta Campaign Playbook

Goal: sell local service businesses a ~$300/mo done-for-you plan with fulfillment that is mostly automated by the product. This document covers the offer, the funnel, the campaign structure, the test creatives and copy, the follow-up system, and the launch checklist.

---

## 1 · The offer

### The ladder (what the ads feed)

| Rung | Price | What they get | Why it exists |
|---|---|---|---|
| Free build | $0 | Call Now page + 4 matching ads, built from their listing in 30 seconds. They keep the files. | The ad's promise. Reciprocity + proof the machine works. Captures name, email, business phone. |
| Launch call | $100 one-time | 20 minutes on a call: page live on their subdomain, ads loaded into their Meta account, tracking on. | Filters tire kickers, creates the sales moment for the plan, pays for the ad spend that acquired them. |
| **Call Engine plan** | **$297/mo** | Everything below. | The business. One roof repair or water heater job covers 3+ months. |

### What $297/mo includes (and how it's automated)

| Deliverable | Fulfillment | Automation status |
|---|---|---|
| Hosted Call Now page on their subdomain | You host the HTML | Automate: one-click deploy per client (Vercel/Cloudflare Pages, ~zero cost each) |
| 4 fresh ad creatives every month | The angle generator + Regenerate | Already built. A monthly cron per client can regenerate and email them |
| Campaign running in their Meta account | Duplicate a saved campaign template, swap creatives | Manual ~20 min/mo per client at first. Template it |
| Call tracking number + lead capture | CallRail or Twilio number forwarding to their line | Semi-automated: one-time setup per client |
| Weekly KPI email: calls, leads, spend | This is the SendKPI brand promise | Automate: call-tracking API + cron email. Build once, runs for every client |
| Monthly angle review | 15-min check: is the angle still converting | Manual, and it's your churn defense |

Client pays their own ad spend (recommend they start at $10 to $20/day). You never touch their money beyond the $297.

### Positioning line

"We turn your Google listing into a call engine: a landing page, fresh ads every month, and a weekly email that tells you exactly how many calls your money bought."

### Risk reversal (pick one, it's your call)

- "Cancel anytime, keep the page and every creative we ever made you."
- "If the phone doesn't ring in your first 30 days of ads, month two is free."

The first is cheaper and still strong. The second closes harder; only offer it once the funnel numbers support it.

### Why $297 and not more

At $297 with mostly-automated fulfillment, 25 clients is ~$7,400/mo of mostly-margin revenue and a manageable ~10 hours/mo of manual work. Raise to $397 or $497 once you have 5+ testimonial clients and the weekly KPI email is automated. Grandfather early clients; they become your case studies.

---

## 2 · The funnel

```
Meta ad (niche page or lead form)
   → sendkpi.com/for-{trade}  (or straight to the tool)
   → free build: page + 4 ads   [lead captured via Google sign-in]
   → thank-you page: launch guide + $100 launch call booking
   → email/SMS follow-up sequence (below)
   → launch call: set up live, pitch the $297 Call Engine
   → client onboarded (subdomain, tracking number, campaign template)
```

Two entries to test against each other:

- **Route A, tool-first:** ad → /for-{trade} page → free build. Higher intent leads, they experience the product, best story. More friction.
- **Route B, lead-form:** Meta instant form ("Want us to build it for you? Business name + phone"). You run their listing through the tool yourself and send the result. Cheaper leads, more manual, great for testing offer language fast.

Run A as the main engine. Run B as a $5/day probe; if B's cost per booked call beats A's, scale it.

---

## 3 · Campaign structure

### Phase 1: niche demand test (week 1, ~$150 total)

You already have the assets: marketing/meta-test/ creatives + /for-* pages.

- Campaign: Traffic or Leads, ABO, one ad set per niche at $5/day: roofers, plumbers, HVAC, electricians (add pest/tree/garage/auto if budget allows).
- Identical creative template per niche so CTR differences = demand differences.
- Decision after 7 days: kill everything below the median on CTR and cost per landing-page view. Winner(s) advance.

### Phase 2: creative test on the winning niche (weeks 2 to 3, $20 to 30/day)

- One campaign, one ad set (broad targeting inside a 50-mile-radius metro or statewide, Advantage+ off if you want clean reads), 3 to 4 ads: the three concepts below with the winning niche's language.
- The creative self-selects the audience ("If you own a roofing company..."), which beats interest targeting for local B2B.
- Decision metric: cost per free build (the OAuth signup), then cost per booked $100 call.

### Phase 3: always-on + retargeting (week 4 onward)

- Scale the winning concept/copy at $30 to 50/day.
- Retargeting stack ($5 to 10/day, one ad set):
  - Site visitors 30 days + video viewers 50%: show the "what you get" walkthrough, CTA to free build.
  - Tool users who built but didn't download (export from Supabase as a customer list, refresh weekly): "Your page for {business} is still waiting."
  - Downloaders who didn't book: the $100 launch call offer with the one-job ROI framing.

### Tracking

- Meta Pixel on sendkpi.com, /for-* pages, and the thank-you page (roadmap item; do it before Phase 2).
- Events: Lead (OAuth signup), Schedule (call booked). Optimize Phase 3 for Schedule.

---

## 4 · Creatives to test (built: see PNGs in this folder)

All three are 1080×1080 statics in the current brand (cream, ink, CTA blue, the # logo). Concept D is a video you record once.

### Concept A · "Stop sending ads to your homepage"
The pain, framed as a before/after split: generic homepage vs a Call Now page.
- On-image headline: "Your ads deserve better than your homepage"
- Support: "One page. One goal. The phone rings."

### Concept B · "Built in 30 seconds"
The machine. Product-style build log showing the page and ads assembling from a Google listing.
- On-image headline: "Your Google listing already is a landing page"
- Support: "Page + 4 matching ads, built in 30 seconds. Free."

### Concept C · "The phone rings"
The outcome. Incoming-call UI with the weekly KPI receipt underneath.
- On-image headline: "This is what your ad spend should sound like"
- Support: "Calls tracked, counted, and emailed to you weekly."

### Concept D · Founder video (record once, 45 to 60 seconds)
Script skeleton:
1. Hook (3 s): "If you own a roofing company, your Google listing is sitting on free money."
2. Problem (10 s): ads sent to homepages, visitors wander, nobody calls.
3. Demo (20 s): screen recording: search a listing, angle picker, page + 4 ads appear.
4. Offer (15 s): "We build it free. Keep everything. If you want it live and managed, that's what we do for $297 a month."
5. CTA (5 s): "Link below. Takes 30 seconds."
Video usually beats statics for cold B2B; ship the statics now, record this within two weeks.

---

## 5 · Ad copy (primary text)

House rules applied: no em dashes, no invented stats, short sentences.

### Concept A (pain/contrast)

**Variant 1**
> Most local service ads fail before anyone reads them. The click lands on a homepage, the visitor wanders, and nobody calls.
>
> SendKPI builds you a one-job landing page from your Google listing: your reviews above the fold, your number on every screen, one thing to do. Plus 4 matching ads. Free, in about 30 seconds.
>
> Find your listing and see your page.

**Variant 2**
> Sending paid traffic to your homepage is how ad budgets die.
>
> We build the page your ads deserve, from the Google listing you already have. Reviews up top, tap to call everywhere, and 4 ads that match the page. Keep everything, free.
>
> See yours in 30 seconds.

### Concept B (the machine)

**Variant 1**
> Your Google Business Profile already has everything a landing page needs: reviews, photos, hours, your phone number.
>
> SendKPI turns it into a Call Now page plus 4 matching ads in about 30 seconds. We research the ad angles that already win in your trade and write everything around the one service you want more calls for.
>
> Free to build. You keep the files.

**Variant 2**
> Type your business name. Pick the service you want calls for. Choose an angle.
>
> That's the whole job. SendKPI builds the landing page and 4 matching ads from your Google listing while you watch. Free.
>
> Try it with your listing.

### Concept C (outcome/KPI)

**Variant 1**
> You should know exactly how many phone calls your ad money bought last week. Not clicks. Calls.
>
> SendKPI builds a call-first landing page and matching ads from your Google listing, free. And if you want it run for you: hosted page, fresh ads monthly, call tracking, and a weekly email with the number that matters.
>
> Start with the free build.

**Variant 2**
> One landing page. Four ads. A weekly email that says how many times the phone rang.
>
> That's the whole product. It starts free: we build your page and ads from your Google listing in 30 seconds, and you keep them either way.
>
> Find your listing below.

### Headlines and descriptions (mix and match)

- Headline: "Free: your Call Now page + 4 ads" · Description: "Built from your Google listing in 30 seconds."
- Headline: "Turn your listing into inbound calls" · Description: "Free build. Keep everything."
- Headline: "Your ads deserve a better landing page" · Description: "One goal: the phone rings."
- CTA button: "Learn more" (cold) / "Sign up" (retargeting).

---

## 6 · Follow-up system

Speed matters most: the free build already happened, so every message should push to the next concrete step, the launch call.

### Instant (automate first, this is the highest-ROI build)

The moment someone signs in and downloads: email with their files, the 3-step launch guide, and the booking link. Wire Supabase → your ESP (Brevo/MailerLite are free at this volume) via webhook or a nightly export.

### Email sequence (5 sends over 10 days)

**Email 1 · instant · "Your page and ads for {Business}"**
> Everything you built is attached and saved to your account. Three steps to launch: put the page on a subdomain, load the ads into Meta, start at $10 to 20 a day. Want it all done on one call instead? We set up everything live with you for $100: {booking link}.

**Email 2 · day 1 · the why**
> Quick one: the reason we build a separate page instead of pointing ads at your website. A homepage gives a visitor twenty doors. A call page gives them one. Your reviews sit at the top because that's the moment a stranger decides you're safe to call. When you're ready to put it live: {booking link}.

**Email 3 · day 3 · the offer**
> If you'd rather never think about this again: we run it for you. Your page hosted on your subdomain, four fresh ads every month, a tracking number, and a weekly email that says exactly how many calls came in. $297 a month, cancel anytime, you keep everything we make. It starts with the same $100 launch call: {booking link}.

**Email 4 · day 6 · the math**
> What does one new job pay you? For most {trade} companies a single booked job covers months of this. $297 a month buys the page, fresh creatives, tracking, and the weekly call count. Your ad budget stays yours and starts at $10 a day. Reply with a question or grab a time: {booking link}.

**Email 5 · day 10 · the door**
> Last note from me. Your page and ads for {Business} are saved in your account whenever you want them. If you book a launch call this week I'll also load the campaign into Meta with you so you leave with everything running: {booking link}.

### Phone/SMS (their business line is B2B fair game)

- Day 1, one call, 3-minute script: "I'm the founder of the tool that built your {trade} page yesterday. Wanted to make sure the download worked. Most owners get stuck loading the ads into Meta, that's literally what the $100 call is for. Want me to grab you a slot?"
- No answer: one voicemail + one text with the booking link. Stop there. You're a marketer, not a collections agency, and the email sequence keeps working.

### The $100 launch call itself (20 minutes, sells the plan)

1. Share screen, their page is already live on a temp subdomain (5 min prep before the call).
2. Load the 4 ads into their Meta account together, set $10 to 20/day, launch paused or live, their choice.
3. The turn: "From here you can run this yourself, everything's yours. What most owners do instead is have us keep it running: fresh ads monthly, call tracking, the weekly call count email. That's $297 a month and I can flip it on right now."
4. Objection you'll hear most: "let me see if the ads work first." Answer honestly: "Do that. The plan exists so that next month someone is still watching it when you've gone back to running jobs."

---

## 7 · Numbers to watch (planning assumptions, not promises)

These are targets to judge the funnel against, based on typical local B2B lead costs. Replace with real data after Phase 1.

| Metric | Kill / worry | Target | Great |
|---|---|---|---|
| CTR (cold statics) | < 0.6% | 1%+ | 2%+ |
| Cost per free build | > $25 | $8 to 15 | < $8 |
| Free build → booked call | < 3% | 8 to 12% | 20% |
| Booked call → $297 plan | < 25% | 40% | 60% |
| Implied CAC for a $297/mo client | > $500 | $150 to 300 | < $150 |

At the target column: a client pays back CAC in month one and everything after is margin against ~30 to 60 min/mo of your time. 10 clients ≈ $3k MRR. 25 ≈ $7.4k MRR.

Churn is the real business risk. The weekly KPI email and the monthly angle refresh exist to make cancelling feel like turning off the phone.

---

## 8 · Launch checklist

- [ ] Meta Pixel on sendkpi.com + /for-* + thank-you (Lead + Schedule events)
- [ ] BOOKING_URL filled in App.jsx (the thank-you page hides the $100 block until it exists)
- [ ] VSL or written guide on thank-you page (written guide already ships)
- [ ] Supabase → ESP hookup + the 5-email sequence loaded
- [ ] CallRail/Twilio account ready for client tracking numbers
- [ ] Saved Meta campaign template for client fulfillment
- [ ] Phase 1 niche test live (assets: marketing/meta-test/)
- [ ] Record Concept D founder video
