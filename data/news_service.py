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

API_KEY = os.getenv("NEWS_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("APP_PASSWORD")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "mistralai/Mistral-7B-Instruct:free")

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
# NEWS FOR UI PANEL
# -----------------------------------
def fetch_explosion_news():
    print("Using NEWS_API_KEY:", API_KEY)
    """Fetch explosion-related news from NewsAPI."""
    if not API_KEY:
        print("[NEWS] Missing NEWS_API_KEY, returning empty list.")
        return []

    query = "(explosion OR blast OR detonation OR bomb OR fireball OR \"cylinder blast\")"
    url = (
        "https://newsapi.org/v2/everything"
        f"?q={query}"
        "&language=en"
        "&sortBy=publishedAt"
        "&pageSize=20"
        f"&apiKey={API_KEY}"
    )

    try:
        r = requests.get(url, timeout=8)
        r.raise_for_status()
        data = r.json()
        return data.get("articles", [])
    except Exception as e:
        print("[NEWS ERROR]", e)
        return []


@app.get("/api/news")
def get_news():
    """Return cleaned explosion-related articles for frontend."""
    articles = fetch_explosion_news()
    cleaned = []

    for a in articles:
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


if __name__ == "__main__":
    print("Python News Service running on port 5000...")
    app.run(host="0.0.0.0", port=5000, debug=False)
