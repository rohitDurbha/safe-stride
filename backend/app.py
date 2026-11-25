from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
from geopy.geocoders import Nominatim

from accounts import TokenSigner, create_accounts_blueprint
from config import check_required_settings, get_cors_origins, get_jwt_expiration, get_mongo_uri, get_secret_key
from geocoding import EndpointError, resolve_endpoints
from heatmap import heatmap_points
from mailer import send_email
from report_classifier import classify_incident
from reports import create_reports_blueprint
from routing import SafetyRouter, crimes_from_records, is_night, local_now
from street_graph import load_street_graph

# Stop right away when a required setting is missing, before the slow
# street graph load below.
check_required_settings()

# === Street graph and safety scores ===
# Read the walking graph from the file baked into the image (or built on the
# first local start) instead of downloading it from OpenStreetMap every time.
streets, _graph_source = load_street_graph()
G = streets.graph
router = SafetyRouter.from_pack(streets)

# === Flask Setup ===
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": get_cors_origins()}}, supports_credentials=True)

app.config["MONGO_URI"] = get_mongo_uri()
mongo = PyMongo(app)

# Score every street from the crime dataset plus the reports people have
# already sent, so reported incidents still count after a restart.
crime_docs = mongo.db.crimes.find({}, {"_id": 0, "CRIMETYPE": 1, "Location": 1, "DATETIME": 1})
report_docs = mongo.db.incident_reports.find({}, {"_id": 0, "incident_type": 1, "location": 1, "timestamp": 1})
scored = router.add_records(*crimes_from_records(crime_docs, report_docs))
print(f"Scored {scored} street segments from crime data")


signer = TokenSigner(get_secret_key(), get_jwt_expiration())
app.register_blueprint(create_accounts_blueprint(mongo.db.users, signer, send_email))


def rescore_report(lon, lat, incident_type):
    updated = router.add_records([float(lon)], [float(lat)], [incident_type], [local_now()])
    print(f"Graph updated, {updated} street segments rescored.")


app.register_blueprint(create_reports_blueprint(mongo.db, signer, classify_incident, rescore_report, send_email))


@app.route("/home", methods=['GET'])
def home():
    return jsonify({"message": "Sai Pranav"})



@app.route("/safe_path", methods=["GET"])
def get_route():
    try:
        geolocator = Nominatim(user_agent="safestride", timeout=10)
        (start_lat, start_lon), (end_lat, end_lon) = resolve_endpoints(request.args, geolocator)
    except EndpointError as e:
        return jsonify({"error": str(e)}), e.status
    except Exception as e:
        return jsonify({"error": f"Geocoding error: {str(e)}"}), 502

    try:
        orig = streets.nearest_node(start_lon, start_lat)
        dest = streets.nearest_node(end_lon, end_lat)

        # Night routes weigh night-time crimes more and avoid unlit
        # streets. The client can force a period with ?period=day|night.
        period = (request.args.get("period") or "").strip().lower()
        night = is_night(local_now().hour) if period not in ("day", "night") else period == "night"

        result = router.route(orig, dest, night=night)
        return jsonify({
            "route": result.coords,
            "start": [start_lat, start_lon],
            "end": [end_lat, end_lon],
            "summary": result.summary(),
        })
    except Exception as e:
        return jsonify({"error": f"Error finding path: {str(e)}"}), 500


@app.route("/crimes", methods=["GET"])
def get_crimes():
    crimes = list(mongo.db.crimes.find({}, {"_id": 0}))
    return jsonify(crimes)

@app.route("/heatmap_data", methods=["GET"])
def heatmap_data():
    # Records with a missing location are skipped, so ask only for ones that have one.
    crimes = mongo.db.crimes.find(
        {"Location": {"$type": "string"}},
        {"_id": 0, "CRIMETYPE": 1, "Location": 1},
    ).limit(150)
    reports = mongo.db.incident_reports.find(
        {}, {"_id": 0, "incident_type": 1, "location": 1}
    ).limit(100)
    return jsonify(heatmap_points(crimes, reports))

if __name__ == "__main__":
    app.run(debug=True)
