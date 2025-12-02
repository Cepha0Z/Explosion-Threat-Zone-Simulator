"""
Quick test script for threat news filtering system
"""

# Simulate test articles
test_articles = [
    {
        "title": "Major explosion rocks Bengaluru chemical plant",
        "description": "A massive explosion at a chemical facility in Bengaluru has caused evacuations",
        "publishedAt": "2025-12-03T00:00:00Z"
    },
    {
        "title": "Wildfire spreads near California coast",
        "description": "Firefighters battle massive blaze threatening homes",
        "publishedAt": "2025-12-02T20:00:00Z"
    },
    {
        "title": "Local restaurant opens in Bengaluru",
        "description": "New dining spot attracts food lovers",
        "publishedAt": "2025-12-03T01:00:00Z"
    },
    {
        "title": "Global pandemic warning issued by WHO",
        "description": "International health organization warns of potential worldwide outbreak",
        "publishedAt": "2025-12-03T00:30:00Z"
    }
]

# Test threat relevance
print("=== THREAT RELEVANCE TEST ===")
for article in test_articles:
    text = f"{article['title']} {article['description']}".lower()
    is_threat = any(kw in text for kw in ["explosion", "wildfire", "pandemic", "chemical"])
    print(f"{'✓' if is_threat else '✗'} {article['title'][:50]}")

print("\n=== LOCATION FILTERING TEST (Bengaluru, scope=city) ===")
for article in test_articles:
    text = f"{article['title']} {article['description']}".lower()
    matches_location = "bengaluru" in text
    is_threat = any(kw in text for kw in ["explosion", "wildfire", "pandemic", "chemical"])
    if is_threat and matches_location:
        print(f"✓ MATCH: {article['title']}")

print("\n=== GLOBAL SCOPE TEST ===")
for article in test_articles:
    text = f"{article['title']} {article['description']}".lower()
    is_global = any(kw in text for kw in ["global", "international", "worldwide"])
    is_threat = any(kw in text for kw in ["explosion", "wildfire", "pandemic", "chemical"])
    if is_threat and is_global:
        print(f"✓ GLOBAL THREAT: {article['title']}")

print("\n=== PRIORITY SCORING SIMULATION ===")
scores = []
for article in test_articles:
    text = f"{article['title']} {article['description']}".lower()
    score = 0
    
    # Threat category (explosion = 100, pandemic = 40)
    if "explosion" in text:
        score += 100
    if "pandemic" in text:
        score += 40
    if "wildfire" in text:
        score += 80
    
    # Location bonus
    if "bengaluru" in text:
        score += 50
    
    # Global bonus
    if any(kw in text for kw in ["global", "international", "worldwide"]):
        score += 30
    
    scores.append((score, article['title']))

scores.sort(reverse=True)
for score, title in scores:
    if score > 0:
        print(f"{score:3d} pts: {title}")
