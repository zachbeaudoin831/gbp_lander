"""GHL contact custom fields + tags for the sendkpi.com/ai-quiz assessment.

QUIZ_FIELDS maps the quiz's answer label (as the browser sends it) to the GHL
custom field name and its dropdown options, copied verbatim from the quiz in
frontend/public/ai-quiz.html. Keep the two in sync: a value that isn't one of
the options would be rejected by GHL.
"""
from typing import Optional

QUIZ_FIELDS: dict[str, tuple[str, Optional[list[str]]]] = {
    "Biggest problem": ("Quiz: Biggest problem", [
        "Burned by an agency: paid for months, never saw clear results",
        "Lots of leads, but low quality: they never answer or never buy",
        "Leads cost too much, and I'm not sure why",
        "I don't know my real numbers, like what a customer costs me",
        "Not enough leads: the phone is too quiet",
        "No time: marketing always falls to the bottom of the list"]),
    "Needs more": ("Quiz: Needs more", ["Booked calls or appointments", "Phone calls", "Form submissions", "Online sales"]),
    "Preferred AI": ("Quiz: Preferred AI", ["ChatGPT", "Claude", "Both", "Not using AI yet"]),
    "Monthly ad spend": ("Quiz: Monthly ad spend", ["Not running ads yet", "Under $1,000", "$1,000 to $5,000", "$5,000 to $20,000", "$20,000+"]),
    "Advertises on": ("Quiz: Advertises on", ["Google", "Facebook and Instagram", "Both Google and Meta", "Somewhere else", "Nowhere yet"]),
    "CRM": ("Quiz: CRM", ["HighLevel", "HubSpot", "Jobber or ServiceTitan", "A spreadsheet or my inbox", "Another CRM"]),
    "Wants": ("Quiz: Wants", ["Do it for me", "Set it up and teach my team", "Just send me a weekly report"]),
    "Timing": ("Quiz: Timing", ["As soon as possible", "In the next 30 days", "Just exploring"]),
    "Website": ("Quiz: Website", None),  # free text
}


def quiz_tags(answers: dict[str, str]) -> list[str]:
    """Action tags derived from the answers (see the SOP doc for what each drives)."""
    a = answers.get
    tags = ["ai-offer-quiz"]
    if a("Monthly ad spend") in ("$5,000 to $20,000", "$20,000+") and a("Timing") in ("As soon as possible", "In the next 30 days"):
        tags.append("quiz-hot")
    tags += {"Do it for me": ["quiz-fit-dfy"], "Set it up and teach my team": ["quiz-fit-sprint"],
             "Just send me a weekly report": ["quiz-fit-report"]}.get(a("Wants") or "", [])
    if a("Monthly ad spend") == "Not running ads yet" or a("Advertises on") == "Nowhere yet":
        tags.append("quiz-no-ads")
    if (a("Biggest problem") or "").startswith("Burned by an agency"):
        tags.append("quiz-burned-by-agency")
    return tags
