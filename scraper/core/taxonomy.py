"""One reporting-focus taxonomy shared by local and hosted classification."""
import re

VERSION = 'reporting-focus-v2'
# NLI labels must be short concepts, not conjunctions of every subtopic. Long
# enumerations incorrectly ask the model whether ALL listed subjects are true.
LOCAL_LABELS = {
    'Sport': 'sports',
    'Health': 'health and medicine',
    'Business': 'business and finance',
    'World': 'international affairs and society',
    'Politics': 'politics and government',
    'Lifestyle': 'entertainment and lifestyle',
    'Science': 'science and technology',
    'Climate': 'climate and environment',
}
DESCRIPTIONS = {
    'Sport': 'sports competitions, match results, athletes and professional esports tournaments',
    'Health': 'medicine, disease, treatment, public health and clinical research',
    'Business': 'business, finance, the economy, company earnings, investment and trade',
    'World': 'international affairs, armed conflict, diplomacy, society, crime and public safety',
    'Politics': 'elections, political parties, government policy, legislation and governance',
    'Lifestyle': 'entertainment, celebrities, music, arts, video games, leisure, fashion and travel',
    'Science': 'scientific discoveries, research, engineering, computing technology and cybersecurity',
    'Climate': 'climate change, the environment, conservation, pollution and extreme weather',
}

def classification_context(text, limit=1800):
    """Sample opening, middle and end instead of classifying the lead alone."""
    if len(text) <= limit:
        return text
    width = (limit - 6) // 3
    middle = max(width, len(text)//2 - width//2)
    return text[:width] + '\n\n' + text[middle:middle+width] + '\n\n' + text[-width:]

def needs_focus_review(title, topic):
    # A review flag, NOT an auto-label. Tech section placement or a game/company
    # name does not establish a scientific reporting focus. Ambiguous cases
    # require an independent opinion, including confident local predictions.
    return topic == 'Science' and bool(re.search(
        r'\b(?:games?|gaming|gamers?|esports|celebrit\w*|singing)\b|遊戲|電競|玩家|唱歌|G胖', title, re.I))

def prompt_taxonomy():
    return '; '.join(f'{topic}: {description}' for topic, description in DESCRIPTIONS.items())
