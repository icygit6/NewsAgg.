"""Cheap pre-routing of undifferentiated feeds into the eight categories.

Some publishers expose one firehose (Al Jazeera's news sitemap, BBC's news
sitemap) rather than a feed per category. Sending every item to every category
would make each article be fetched and classified eight times. These patterns
decide which category queue an item is *offered to*; they never decide what the
article is. Admission is still the zero-shot classifier's call, so a loose
pattern costs a wasted fetch, never a wrongly filed story.
"""
from __future__ import annotations

import re
from typing import Optional

_FLAGS = re.IGNORECASE

# Order is irrelevant: every pattern is tried for its own category.
CATEGORY_HINTS: dict[str, re.Pattern] = {
    'Sport': re.compile(
        r"/sports?/|\b(football|soccer|premier league|champions league|cricket|tennis|olympic\w*|"
        r"world cup|nba|nfl|formula (?:one|1)|f1|rugby|golf|athletics|boxing|marathon|"
        r"grand slam|striker|goalkeeper|manager|league|tournament|medal)\b", _FLAGS),
    'Health': re.compile(
        r"\b(health\w*|hospital\w*|nhs|doctors?|nurses?|patients?|disease\w*|cancer|vaccin\w*|virus|"
        r"outbreak|epidemic|pandemic|measles|covid|flu|obesity|diabetes|dementia|alzheimer\w*|"
        r"surgery|surgeons?|drugs?|medicines?|medical|clinic\w*|mpox|ebola|malaria|cholera|"
        r"famine|malnutrition|nutrition|diet|ozempic|weight[- ]loss|mental|therapy|"
        r"pharma\w*|antibiotic\w*|infection\w*|stroke|heart attack)\b", _FLAGS),
    'Business': re.compile(
        r"/economy/|/business/|\b(econom\w*|markets?|stocks?|shares|trade|tariffs?|inflation|"
        r"interest rates?|bank\w*|business\w*|compan(?:y|ies)|profits?|earnings|investors?|oil|"
        r"jobs|unemployment|gdp|budget|financ\w*|currency|crypto\w*|bitcoin|merger|ceo|"
        r"retail\w*|supply chain|billion|recession|prices?|wages?)\b", _FLAGS),
    'World': re.compile(
        r"/news/|/world/|\b(war|conflict|ceasefire|troops|attack\w*|killed|refugees?|migrants?|"
        r"diplomat\w*|summit|united nations|embassy|border|hostages?|protest\w*|crisis|"
        r"airstrikes?|missiles?|invasion|peace talks)\b", _FLAGS),
    'Politics': re.compile(
        r"/politics/|\b(elections?|votes?|voters?|polls?|parliament\w*|congress\w*|senate|senators?|"
        r"president\w*|prime minister|ministers?|government|party|parties|labour|tor(?:y|ies)|"
        r"conservatives?|democrat\w*|republican\w*|trump|biden|starmer|policy|legislat\w*|"
        r"lawmakers?|mps?|campaign|coalition|referendum|sanctions|cabinet|governor)\b", _FLAGS),
    'Lifestyle': re.compile(
        r"\b(films?|movies?|cinema|oscars?|bafta|music\w*|albums?|concerts?|singers?|bands?|"
        r"festivals?|celebrit\w*|actors?|actress\w*|series|netflix|theatre|theater|museums?|"
        r"art|artists?|exhibitions?|culture|cultural|books?|novels?|authors?|fashion|food|"
        r"restaurants?|recipes?|travel\w*|tourism|tourists?|holidays?|hotels?|gaming|video games?|"
        r"royals?|wedding|lifestyle|wellbeing|streaming|box office)\b", _FLAGS),
    'Science': re.compile(
        r"\b(scien\w+|researchers?|astronom\w*|space|nasa|esa|spacex|rockets?|satellites?|moon|mars|"
        r"telescope|asteroids?|ai|artificial intelligence|chatbots?|openai|robot\w*|tech|"
        r"technolog\w*|cyber\w*|hack\w*|quantum|chips?|semiconductors?|software|internet|"
        r"computing|fossils?|dinosaur\w*|species|genome|physics|chemistry|biolog\w*|"
        r"archaeolog\w*|engineers?|invent\w*|startups?|algorithms?)\b", _FLAGS),
    'Climate': re.compile(
        r"\b(climate|global warming|emissions?|carbon|fossil fuels?|renewables?|solar|"
        r"wind (?:farms?|power|turbines?)|floods?|flooding|wildfires?|heat ?waves?|drought\w*|"
        r"cyclones?|hurricanes?|typhoons?|storms?|earthquakes?|tsunamis?|environment\w*|pollution|"
        r"biodiversity|wildlife|conservation|deforestation|glaciers?|sea levels?|cop\d+|"
        r"net zero|plastics?|extreme weather|nature|ocean\w*|coral)\b", _FLAGS),
}


def hint_for(category: str) -> Optional[re.Pattern]:
    """Pattern for a category, or None when it has no pre-routing rule."""
    return CATEGORY_HINTS.get(category)
