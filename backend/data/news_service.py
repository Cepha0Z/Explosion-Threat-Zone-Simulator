import os
import json
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
import traceback  


load_dotenv()

# -----------------------------------
# CONFIG
# -----------------------------------
BASE_DIR = os.path.dirname(__file__)
THREATS_FILE = os.path.join(BASE_DIR, "threats.json")

# **NEWS FILTERING MODE: Set to True for strict filtering, False for relaxed (demo-friendly)**
STRICT_MODE = True  # Change to True for precise threat filtering

API_KEY = os.getenv("NEWS_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("APP_PASSWORD")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "mistralai/Mistral-7B-Instruct:free")

# OLLAMA CONFIG
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")


llm_client = (
    OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )
    if OPENROUTER_API_KEY
    else None
)

print("Has OPENROUTER_API_KEY:", bool(OPENROUTER_API_KEY))
print("Using OpenRouter model:", OPENROUTER_MODEL)
print(f"NEWS FILTERING MODE: {'STRICT' if STRICT_MODE else 'RELAXED (Demo-Friendly)'}")


#ai model ig
def generate_ai_email_body(threat: dict, user_location: str | None = None) -> str:
    """
    Use an LLM to generate a contextual, human-readable alert email body.
    Falls back to a simple template if AI is not configured or fails.
    """
    # Basic safe fallback if AI not configured
    if llm_client is None:
        print("[AI] llm_client is None – using fallback template.")
        return f"""
New Threat Detected:

Name: {threat.get('name', 'N/A')}
Location: {threat.get('locationName', 'Unknown')}
Details: {threat.get('details', 'No details')}
Yield: {threat.get('yield', 'N/A')} kg TNT
Time: {threat.get('timestamp', 'N/A')}

Stay alert and follow safety instructions.
"""

    try:
        # Build a compact context summary for the model
        threat_summary = f"""
Threat Name: {threat.get('name', 'N/A')}
Threat Location: {threat.get('locationName', 'Unknown')}
Approx Yield: {threat.get('yield', 'N/A')} kg TNT
Time Detected: {threat.get('timestamp', 'N/A')}
Raw Details: {threat.get('details', 'No details')}
"""

        if user_location:
            threat_summary += f"\nUser Region: {user_location}\n"

        prompt = (
            "You are an emergency operations assistant. "
            "Write a clear, calm, concise email alert for a civilian user about the following threat. "
            "Avoid technical jargon, avoid panic, but clearly explain that this is serious.\n\n"
            "Constraints:\n"
            "- Use plain text (no markdown, no HTML)\n"
            "- 2–4 short paragraphs max\n"
            "- At the end, add a short bullet list of 3–5 practical safety steps.\n\n"
            f"THREAT CONTEXT:\n{threat_summary}\n"
        )

        print("[AI] Calling OpenAI to generate email body...")
        completion = llm_client.chat.completions.create(
            model=OPENROUTER_MODEL,  # or any deployed model you have
            messages=[
                {"role": "system", "content": "You write emergency alerts for civilians."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=400,
        )

        content = (completion.choices[0].message.content or "").strip()
        print("[AI] Got response from OpenAI.")
        return content or "Alert: A new threat has been detected. Please stay alert and follow local guidance."

    except Exception as e:
        print("[AI EMAIL ERROR]", e)
        traceback.print_exc()   # 🔥 shows full stack trace

        # Fall back to simple template if anything breaks
        return f"""\
⚠️ URGENT INCIDENT NOTIFICATION

An incident has been detected and classified as a potential threat in your region.

Threat: {threat.get('name', 'N/A')}
Location: {threat.get('locationName', 'Unknown')}
Time Detected: {threat.get('timestamp', 'N/A')}

Summary:
{threat.get('details', 'No details available.')}

Estimated Energy: {threat.get('yield', 'N/A')} kg TNT equivalent

Recommended Actions:
- Stay away from the reported location.
- Follow guidance from local authorities and emergency services.
- Avoid sharing unverified information on social media.
- Monitor official channels for updates.
- Assist vulnerable people (children, elderly, disabled) if it is safe to do so.
"""






app = Flask(__name__)
CORS(app)

# -----------------------------------
# THREAT CATEGORIES & KEYWORDS
# -----------------------------------
THREAT_KEYWORDS = {
    "explosion": {
        "keywords": ["explosion", "blast", "detonation", "bomb", "ied", "fireball", "cylinder blast", "explode", "blew up"],
        "weight": 1.0,
        "priority": "high"
    },
    "terror": {
        "keywords": ["terror attack", "terrorist", "bombing", "active shooter", "hostage", "gunman", "armed attack"],
        "weight": 1.0,
        "priority": "high"
    },
    "chemical": {
        "keywords": ["chemical leak", "toxic spill", "hazmat", "gas leak", "ammonia", "chlorine", "radiation", "toxic fumes"],
        "weight": 0.8,
        "priority": "high"
    },
    "fire": {
        "keywords": ["wildfire", "forest fire", "brush fire", "blaze", "inferno", "fire spreading"],
        "weight": 0.8,
        "priority": "medium"
    },
    "natural": {
        "keywords": ["earthquake", "flood", "tsunami", "hurricane", "cyclone", "tornado", "landslide", "avalanche"],
        "weight": 0.7,
        "priority": "medium"
    },
    "infrastructure": {
        "keywords": ["power outage", "blackout", "grid failure", "dam breach", "bridge collapse"],
        "weight": 0.5,
        "priority": "medium"
    },
    "structural": {
        "keywords": ["building collapse", "structural failure", "construction accident", "collapse"],
        "weight": 0.6,
        "priority": "medium"
    },
    "pandemic": {
        "keywords": ["pandemic", "outbreak", "epidemic", "virus spread", "disease cluster", "contagion"],
        "weight": 0.4,
        "priority": "low"
    }
}

# -----------------------------------
# NEWS FILTERING FUNCTIONS
# -----------------------------------
def build_threat_query():
    """Build comprehensive threat-focused query for NewsAPI."""
    all_keywords = []
    for category, data in THREAT_KEYWORDS.items():
        all_keywords.extend(data["keywords"][:3])  # Top 3 keywords per category
    
    # Build query with OR operators
    query = " OR ".join([f'"{kw}"' if " " in kw else kw for kw in all_keywords])
    return f"({query})"


def calculate_threat_score(article, location=None, scope="city", strict=False):
    """
    Calculate priority score for an article based on:
    - Threat category match
    - Location relevance
    - Recency
    - Keyword density
    
    Args:
        article: Article object
        location: User's city name
        scope: Filtering scope
        strict: If True, use strict scoring with penalties
    """
    score = 0
    text = f"{article.get('title', '')} {article.get('description', '')}".lower()
    
    # Threat category scoring
    matched_categories = []
    for category, data in THREAT_KEYWORDS.items():
        for keyword in data["keywords"]:
            if keyword.lower() in text:
                score += data["weight"] * 100
                matched_categories.append(category)
                break  # Count category once
    
    # Location relevance scoring
    if location and scope != "global":
        location_lower = location.lower()
        if location_lower in text:
            score += 50  # Exact city match
        elif scope == "near_me":
            # Check for nearby area indicators
            nearby_keywords = ["near", "vicinity", "area", "region"]
            if any(kw in text for kw in nearby_keywords):
                score += 25
    
    # Global scope - no location bonuses or penalties
    # Just show top threat news from anywhere
    if scope == "global":
        # Small bonus for truly global events
        global_keywords = ["global", "international", "worldwide"]
        if any(kw in text for kw in global_keywords):
            score += 20
    
    # Recency scoring (based on publishedAt)
    try:
        from datetime import datetime, timezone
        published = article.get("publishedAt")
        if published:
            pub_time = datetime.fromisoformat(published.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            hours_old = (now - pub_time).total_seconds() / 3600
            
            if hours_old < 1:
                score += 30
            elif hours_old < 6:
                score += 20
            elif hours_old < 24:
                score += 10
    except:
        pass
    
    # Keyword density bonus
    keyword_count = sum(1 for cat_data in THREAT_KEYWORDS.values() 
                       for kw in cat_data["keywords"] if kw.lower() in text)
    score += min(keyword_count * 5, 20)  # Max 20 points
    
    return score
    
    # Recency scoring (based on publishedAt)
    try:
        from datetime import datetime, timezone
        published = article.get("publishedAt")
        if published:
            pub_time = datetime.fromisoformat(published.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            hours_old = (now - pub_time).total_seconds() / 3600
            
            if hours_old < 1:
                score += 30
            elif hours_old < 6:
                score += 20
            elif hours_old < 24:
                score += 10
    except:
        pass
    
    # Keyword density bonus
    keyword_count = sum(1 for cat_data in THREAT_KEYWORDS.values() 
                       for kw in cat_data["keywords"] if kw.lower() in text)
    score += min(keyword_count * 5, 20)  # Max 20 points
    
    return score


def is_threat_relevant(article, strict=False):
    """
    Check if article contains any threat keywords.
    
    Args:
        article: Article object
        strict: If True, only match exact threat keywords. If False, also match emergency keywords.
    """
    text = f"{article.get('title', '')} {article.get('description', '')}".lower()
    
    # Check for threat keywords
    for category, data in THREAT_KEYWORDS.items():
        for keyword in data["keywords"]:
            if keyword.lower() in text:
                return True
    
    # RELAXED MODE: Also accept articles with general emergency/incident keywords
    if not strict:
        emergency_keywords = ["emergency", "incident", "accident", "disaster", "crisis", 
                             "alert", "warning", "danger", "hazard", "evacuate", "rescue"]
        if any(kw in text for kw in emergency_keywords):
            return True
    
    return False


def filter_by_location(articles, location, scope, strict=False):
    """
    Filter articles by location scope:
    - near_me: Only articles from user's location (e.g., Bengaluru)
    - city: Articles from user's city (same as near_me for now)
    - global: Top worldwide news (any location)
    
    Args:
        articles: List of articles
        location: User's city name
        scope: Filtering scope (near_me, city, global)
        strict: If True, use strict filtering. If False, more lenient.
    """
    if scope == "global":
        # GLOBAL: Return all threat-related news (top worldwide news)
        # No location filtering - show news from anywhere
        return articles
    
    # For "near_me" and "city": Filter by user's location
    if not location:
        return articles
    
    filtered = []
    location_lower = location.lower()
    
    for article in articles:
        text = f"{article.get('title', '')} {article.get('description', '')}".lower()
        
        # Check if article mentions user's location
        if location_lower in text:
            filtered.append(article)
        elif not strict:
            # RELAXED: Also include if no specific location mentioned
            # (could be general threat news relevant to the area)
            common_cities = ["new york", "london", "paris", "tokyo", "delhi", "mumbai", "beijing", 
                           "los angeles", "chicago", "houston", "sydney", "toronto"]
            has_other_city = any(city in text for city in common_cities if city != location_lower)
            if not has_other_city:
                # No other city mentioned - might be local or general news
                filtered.append(article)
    
    # Return filtered results, or all articles if no matches (in relaxed mode)
    return filtered if (filtered or strict) else articles



def fetch_threat_news(location=None, scope="city", strict=False):
    """
    Fetch threat-related news with location filtering.
    
    Args:
        location: User's city name (e.g., "Bengaluru")
        scope: "near_me", "city", or "global"
        strict: If True, use strict filtering. If False, more lenient (default for demo).
    """
    print(f"[NEWS] Fetching threat news for location={location}, scope={scope}, strict={strict}")
    
    if not API_KEY:
        print("[NEWS] Missing NEWS_API_KEY, returning empty list.")
        return []

    query = build_threat_query()
    url = (
        "https://newsapi.org/v2/everything"
        f"?q={query}"
        "&language=en"
        "&sortBy=publishedAt"
        "&pageSize=50"  # Fetch more to filter
        f"&apiKey={API_KEY}"
    )

    try:
        r = requests.get(url, timeout=8)
        r.raise_for_status()
        data = r.json()
        articles = data.get("articles", [])
        
        # Filter for threat relevance
        threat_articles = [a for a in articles if is_threat_relevant(a, strict)]
        print(f"[NEWS] Found {len(threat_articles)} threat-relevant articles out of {len(articles)} (strict={strict})")
        
        # Filter by location
        location_filtered = filter_by_location(threat_articles, location, scope, strict)
        print(f"[NEWS] {len(location_filtered)} articles match location filter (strict={strict})")
        
        # Calculate scores and sort
        scored_articles = []
        for article in location_filtered:
            score = calculate_threat_score(article, location, scope, strict)
            scored_articles.append((score, article))
        
        # Sort by score (highest first)
        scored_articles.sort(key=lambda x: x[0], reverse=True)
        
        # Return top articles
        return [article for score, article in scored_articles]
        
    except Exception as e:
        print("[NEWS ERROR]", e)
        return []


@app.get("/api/news")
def get_news():
    """
    Return filtered and prioritized threat-related articles for frontend.
    
    Filtering mode is controlled by STRICT_MODE variable at top of file.
    
    Query Parameters:
        location: City name (default: "Bengaluru")
        scope: "near_me", "city", or "global" (default: "city")
    """
    location = request.args.get("location", "Bengaluru")
    scope = request.args.get("scope", "city")  # near_me, city, global
    
    # Use global STRICT_MODE setting
    articles = fetch_threat_news(location, scope, STRICT_MODE)
    cleaned = []

    # Return top 20 by priority
    for a in articles[:20]:
        cleaned.append(
            {
                "title": a.get("title"),
                "url": a.get("url"),
                "source": a.get("source", {}).get("name"),
                "publishedAt": a.get("publishedAt"),
                "description": a.get("description"),
                "image": a.get("urlToImage"),
            }
        )

    return jsonify(cleaned)


# -----------------------------------
# EMAIL LOGIC
# -----------------------------------
def send_email_alert(threat: dict, user_email: str):
    """Send an AI-generated email alert for a single threat."""
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        print("[EMAIL ERROR] SENDER_EMAIL or APP_PASSWORD not configured.")
        return

    if not user_email:
        print("[EMAIL ERROR] No user_email provided.")
        return

    msg = MIMEMultipart()
    msg["From"] = SENDER_EMAIL
    msg["To"] = user_email
    msg["Subject"] = f"⚠️ NEW THREAT DETECTED: {threat.get('name', 'Unknown Threat')}"

    # ✅ AI-generated body
    body = generate_ai_email_body(threat)
    msg.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"[EMAIL] Sent alert for {threat.get('name', 'Unknown')} to {user_email}")
    except Exception as e:
        print("[EMAIL SEND ERROR]", e)



@app.post("/api/alert")
def manual_email():
    """
    Triggered by:
      - Frontend 'Send Report' button
      - Node server (auto-email on new threat)

    Body expected: { "email": "user@example.com", ... }
    Extra fields (like `location`) are ignored here, since body is built from threats.json.
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email")

    if not email:
        return jsonify({"error": "email required"}), 400

    if not os.path.exists(THREATS_FILE):
        return jsonify({"error": "No threats found"}), 404

    try:
        with open(THREATS_FILE, "r", encoding="utf-8") as f:
            threats = json.load(f)
    except Exception as e:
        print("[THREATS READ ERROR]", e)
        return jsonify({"error": "Could not read threats file"}), 500

    if not threats:
        return jsonify({"error": "No threats found"}), 404

    latest = threats[-1]
    send_email_alert(latest, email)

    return jsonify({"status": "ok"})


# -----------------------------------
# HEALTH / ROOT
# -----------------------------------
@app.get("/")
def home():
    return "Python Email + News Service Running", 200


# -----------------------------------
# AI FACILITY EVALUATION
# -----------------------------------
@app.post("/evaluate_facilities")
def evaluate_facilities():
    """
    Receives a list of medical facilities with name, types, and distance.
    Uses LLM to pick the best one based on tier (Hospital > Clinic) and distance.
    """
    data = request.get_json(silent=True) or {}
    facilities = data.get("facilities", [])

    if not facilities:
        return jsonify({"error": "No facilities provided"}), 400

    if not llm_client:
        print("[AI] No LLM client, returning first facility.")
        return jsonify({"selected_index": 0, "reason": "AI not configured, defaulting to nearest."})

    try:
        # Construct prompt
        candidates_text = ""
        for i, f in enumerate(facilities):
            candidates_text += f"{i}. Name: {f.get('name')}, Types: {f.get('types')}, Distance: {f.get('distance')}m\n"

        prompt = (
            "You are an emergency medical logistics AI. "
            "Evaluate the following list of medical facilities found near an evacuation zone. "
            "Your goal is to select the BEST destination for a potential mass casualty or emergency situation.\n\n"
            "CRITICAL RULES:\n"
            "- ONLY select facilities that are ACTUAL MEDICAL FACILITIES (hospitals, clinics, urgent care)\n"
            "- IMMEDIATELY REJECT: Churches, temples, mosques, religious buildings, shops, restaurants, dentists, veterinarians\n"
            "- If a facility name or type suggests it is NOT a medical facility, DO NOT select it\n\n"
            "Priorities:\n"
            "1. TIER 1: Major Hospitals, Trauma Centers, Medical Centers, General Hospitals (Highest Priority)\n"
            "2. TIER 2: Urgent Care Centers, Emergency Clinics, Multi-Specialty Clinics\n"
            "3. TIER 3: Small Clinics, Doctor's Offices, Health Centers\n"
            "4. TIER 4: Pharmacies, Medical Stores (Avoid unless only option)\n\n"
            "Selection Rules:\n"
            "- Prefer a Tier 1 facility even if it is up to 3km further than a Tier 3 facility\n"
            "- Within the same Tier, choose the closest one\n"
            "- If you see ANY non-medical facility in the list, skip it entirely\n"
            "- Look for keywords: 'Hospital', 'Medical Center', 'Clinic', 'Health', 'Emergency', 'Urgent Care'\n\n"
            f"CANDIDATES:\n{candidates_text}\n\n"
            "Respond with a JSON object ONLY: { \"selected_index\": <int>, \"reason\": \"<short explanation mentioning facility type and why it was chosen>\" }"
        )

        print("[AI] Evaluating facilities...")
        completion = llm_client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=200,
            response_format={"type": "json_object"} 
        )

        content = completion.choices[0].message.content
        print(f"[AI] Evaluation result: {content}")
        
        try:
            result = json.loads(content)
            return jsonify(result)
        except json.JSONDecodeError:
            # Fallback if model didn't output valid JSON
            print("[AI ERROR] Model did not return JSON. Parsing manually.")
            # Simple heuristic fallback or regex could go here, but for now default to 0
            return jsonify({"selected_index": 0, "reason": "Model output parsing failed."})

    except Exception as e:
        print("[AI EVAL ERROR]", e)
        traceback.print_exc()
        return jsonify({"selected_index": 0, "reason": "AI evaluation failed."})



# -----------------------------------
# THREAT EXTRACTION & GEOCODING
# -----------------------------------

@app.post("/api/extract-threat-info")
def extract_threat_info():
    """
    Takes raw text (e.g. from news dummy server) and extracts structured threat info.
    """
    data = request.get_json(silent=True) or {}
    text = data.get("text")

    if not text:
        return jsonify({"error": "No text provided"}), 400

    if not llm_client:
        print("[AI] No LLM client configured.")
        return jsonify({"error": "AI service unavailable"}), 503

    try:
        prompt = (
            "You are a strict emergency threat extractor. "
            "Output only valid JSON with the exact fields specified. "
            "If some information is not explicitly in the text, infer a reasonable value based on the scenario.\n\n"
            "Required Output Fields:\n"
            "- name (Short title, e.g., 'Industrial Chemical Leak')\n"
            "- locationName (Area/city, e.g., 'Lingarajapuram, Bengaluru')\n"
            "- details (One or two sentences summary)\n"
            "- yield (Numeric severity approximation 0.5-50. Infer from words like 'massive', 'minor')\n"
            "- durationMinutes (Estimated active threat duration. Small=30-60, Large=120+)\n"
            "- incidentType (e.g., 'chemical_leak', 'explosion', 'fire')\n"
            "- hazardCategory (e.g., 'chemical', 'thermal', 'structural')\n\n"
            f"INPUT TEXT:\n{text}\n\n"
            "Respond with JSON only."
        )

        print(f"[AI] Extracting threat info from: {text[:50]}...")
        completion = llm_client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=300,
            response_format={"type": "json_object"}
        )

        content = completion.choices[0].message.content
        print(f"[AI] Extraction result: {content}")
        
        try:
            result = json.loads(content)
            return jsonify(result)
        except json.JSONDecodeError:
            print("[AI ERROR] Failed to parse JSON from extraction.")
            return jsonify({"error": "Invalid JSON from AI"}), 500

    except Exception as e:
        print("[AI EXTRACTION ERROR]", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.post("/api/geocode")
def geocode_location():
    """
    Takes a location name and returns approximate lat/lng using AI knowledge.
    """
    data = request.get_json(silent=True) or {}
    location_name = data.get("locationName")

    if not location_name:
        return jsonify({"error": "No locationName provided"}), 400

    if not llm_client:
        return jsonify({"error": "AI service unavailable"}), 503

    try:
        prompt = (
            "You are a geocoding assistant. "
            "Given a locationName string, look up its approximate latitude and longitude using your knowledge. "
            "Output only JSON with 'lat' and 'lng' as decimal degrees.\n\n"
            f"Location: {location_name}\n\n"
            "Respond with JSON only: { \"lat\": 12.34, \"lng\": 56.78 }"
        )

        print(f"[AI] Geocoding: {location_name}")
        completion = llm_client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=100,
            response_format={"type": "json_object"}
        )

        content = completion.choices[0].message.content
        print(f"[AI] Geocode result: {content}")

        try:
            result = json.loads(content)
            # Basic validation
            if "lat" in result and "lng" in result:
                return jsonify(result)
            else:
                return jsonify({"error": "AI returned invalid format"}), 500
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid JSON from AI"}), 500

    except Exception as e:
        print("[AI GEOCODE ERROR]", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("Python News Service running on port 5000...")
    app.run(host="0.0.0.0", port=5000, debug=False)
