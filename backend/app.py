from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from flask_cors import CORS
from shapely.geometry import Point
import geopandas as gpd
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import osmnx as ox
import networkx as nx
from geopy.geocoders import Nominatim
import osmnx as ox
import networkx as nx
import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Point
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import MinMaxScaler
import os
from config import check_required_settings, get_jwt_expiration, get_mongo_uri, get_secret_key
from heatmap import heatmap_points
from mailer import send_email
from report_classifier import classify_incident, update_graph_with_report
from threading import Thread


import os
from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from flask_cors import CORS
from shapely.geometry import Point
import geopandas as gpd
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import osmnx as ox
import networkx as nx
from geopy.geocoders import Nominatim
from sklearn.cluster import DBSCAN
from shapely.geometry import LineString
import bcrypt
import jwt
from datetime import datetime, timedelta
from bson.objectid import ObjectId

# Stop right away when a required setting is missing, before the slow
# street graph download below.
check_required_settings()

# === Setup Graph and Edges ===
GRAPH_PLACE = "Oakland, California, USA"
G = ox.graph_from_place(GRAPH_PLACE, network_type='walk')
edges = ox.graph_to_gdfs(G, nodes=False).reset_index()
edges["edge_id"] = edges.apply(lambda row: f"{row['u']}_{row['v']}_{row['key']}", axis=1)
nodes = ox.graph_to_gdfs(G, edges=False)
emergency_contact = ''
# Load and preprocess crime data
#url = "/Users/spartan/Desktop/desktop/USA/hackathon/safe-stride-navigator/backend/crime_rate.csv"
#crime_df = pd.read_csv(url)
#crime_df['lon'] = crime_df['Location'].str.extract(r'POINT \((-?\d+\.\d+)')[0].astype(float)
#crime_df['lat'] = crime_df['Location'].str.extract(r'(-?\d+\.\d+)\)')[0].astype(float)
#crime_df.dropna(subset=['lat', 'lon'], inplace=True)

# === Flask Setup ===
app = Flask(__name__)
#CORS(app)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

app.config["MONGO_URI"] = get_mongo_uri()
mongo = PyMongo(app)

# Load from MongoDB
crime_docs = list(mongo.db.crimes.find())
crime_df = pd.DataFrame(crime_docs)

# Extract lat/lon from Location field (same as before)
crime_df['lon'] = crime_df['Location'].str.extract(r'POINT \((-?\d+\.\d+)')[0].astype(float)
crime_df['lat'] = crime_df['Location'].str.extract(r'(-?\d+\.\d+)\)')[0].astype(float)
crime_df.dropna(subset=['lat', 'lon'], inplace=True)

crime_gdf = gpd.GeoDataFrame(crime_df, geometry=gpd.points_from_xy(crime_df['lon'], crime_df['lat']), crs="EPSG:4326").to_crs(epsg=3857)
edges = edges.to_crs(epsg=3857)

# Cluster crimes
coords = np.array(list(zip(crime_gdf.geometry.x, crime_gdf.geometry.y)))
crime_gdf['cluster'] = DBSCAN(eps=100, min_samples=2).fit(coords).labels_

# Severity scores
severity_map = {
    'FELONY ASSAULT': 0.9, 'PETTY THEFT': 0.3, 'BURG - RESIDENTIAL': 0.7,
    'MISDEMEANOR ASSAULT': 0.5, 'ARSON': 0.8, 'ROBBERY': 0.85,
    'NARCOTICS': 0.4, 'KIDNAPPING': 0.95, 'FORCIBLE RAPE': 1.0, 'HOMICIDE': 1.0,
    'CHILD ABUSE': 0.85, 'OTHER': 0.4
}
crime_gdf['severity_score'] = crime_gdf['CRIMETYPE'].map(severity_map).fillna(0.4)

# Join crime to edges
edges['geometry_buffered'] = edges.buffer(25)
edges = edges.set_geometry('geometry_buffered')
join = gpd.sjoin(crime_gdf, edges[['edge_id', 'geometry_buffered']], how='inner', predicate='within')
avg_crime = join.groupby('edge_id')['severity_score'].mean()
edges['crime_score'] = edges['edge_id'].map(avg_crime).fillna(0)
scaler = MinMaxScaler()
edges['crime_score'] = scaler.fit_transform(edges[['crime_score']])
edges = edges.set_geometry('geometry')
edges.drop(columns='geometry_buffered', inplace=True)

# Mock extra features + compute safety score
np.random.seed(42)
edges['foot_traffic'] = np.random.uniform(0.2, 1.0, len(edges))
edges['lighting'] = np.random.uniform(0.3, 1.0, len(edges))
edges['institution_score'] = np.random.uniform(0.4, 1.0, len(edges))

def compute_safety_score(row):
    return 0.4 * (1 - row['crime_score']) + 0.2 * row['foot_traffic'] + 0.2 * row['lighting'] + 0.2 * row['institution_score']

edges['safety_score'] = edges.apply(compute_safety_score, axis=1)

# Apply weights to graph
for u, v, k, data in G.edges(keys=True, data=True):
    try:
        row = edges.loc[(edges['u'] == u) & (edges['v'] == v)].iloc[0]
        data['weight'] = 1 - row['safety_score']
    except:
        data['weight'] = 1


SECRET_KEY = get_secret_key()
JWT_EXPIRATION = get_jwt_expiration()

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed)

def generate_token(user_id):
    payload = {
        'user_id': str(user_id),
        'exp': datetime.utcnow() + timedelta(seconds=JWT_EXPIRATION)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None

@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    name = data.get("name") # accept 'name'
    emergency_contact = data.get("emergency_contact")

    if not emergency_contact or not emergency_contact.get("name") or not emergency_contact.get("email"):
        return jsonify({"error": "Emergency contact info required"}), 400

    if mongo.db.users.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 409

    hashed_pw = hash_password(password)
    user_doc = {
        "email": email,
        "password_hash": hashed_pw,
        "created_at": datetime.utcnow(),
        "name": name if name else "",
        "emergency_contact": emergency_contact
    }
    result = mongo.db.users.insert_one(user_doc)
    token = generate_token(result.inserted_id)

    # --- Send welcome/notification email to emergency contact ---
    contact = emergency_contact or {}
    body = (
        f"Hello {contact.get('name', '')},\n\n"
        f"You have been listed as an emergency contact for a new Safe Stride user ({name or email}).\n"
        "You will be notified if your contact submits an emergency report from our app.\n\n"
        "Regards,\n"
        "Safe Stride Safety Team"
    )
    if send_email(contact.get("email"), "You are an emergency contact for a new Safe Stride user", body):
        print("Signup emergency contact email sent successfully!")

    return jsonify({"token": token})

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    user = mongo.db.users.find_one({"email": email})
    emergency_contact=user['emergency_contact']['email']
    if not user or not check_password(password, user['password_hash']):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_token(user['_id'])
    return jsonify({"token": token})

@app.route("/me", methods=["GET"])
def me():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Authorization header missing or invalid"}), 401

    token = auth_header.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        return jsonify({"error": "Invalid or expired token"}), 401

    user = mongo.db.users.find_one({"_id": ObjectId(payload["user_id"])})
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"id": str(user['_id']), "email": user["email"]})


@app.route("/home", methods=['GET'])
def home():
    return jsonify({"message": "Sai Pranav"})



@app.route("/safe_path", methods=["GET"])
def get_route(): 
    start_lat = float(request.args.get("start_lat"))
    start_lon = float(request.args.get("start_lon"))
    destination = request.args.get("destination")
    print(destination)

    if not (start_lat and start_lon and destination):
        return jsonify({"error": "Missing parameters"}), 400

    try:
        geolocator = Nominatim(user_agent="nav_app", timeout=10)  # Increased timeout to 10 seconds
        location = geolocator.geocode(destination)
        if not location:
            return jsonify({"error": "Destination not found"}), 404

        end_lat, end_lon = location.latitude, location.longitude

        try:
            orig = ox.nearest_nodes(G, X=start_lon, Y=start_lat)
            dest = ox.nearest_nodes(G, X=end_lon, Y=end_lat)

            path = nx.shortest_path(G, orig, dest, weight='weight')

            full_coords = []

            for u, v in zip(path[:-1], path[1:]):
                data = G.get_edge_data(u, v)
                if data:
                    # Get the first edge with geometry or fallback to straight line
                    edge_data = list(data.values())[0]
                    if 'geometry' in edge_data:
                        full_coords += list(edge_data['geometry'].coords)
                    else:
                        # Fallback to straight line
                        full_coords += [(G.nodes[u]['x'], G.nodes[u]['y']), (G.nodes[v]['x'], G.nodes[v]['y'])]

            # Flip (lon, lat) to (lat, lon)
            latlon_coords = [[y, x] for (x, y) in full_coords]

            return jsonify({"route": latlon_coords})
        except Exception as e:
            return jsonify({"error": f"Error finding path: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Geocoding error: {str(e)}"}), 500
    

@app.route("/add_user", methods=["POST"])
def add_user():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    try:
        result = mongo.db.users.insert_one(data)
        return jsonify({
            "message": "User added successfully",
            "inserted_id": str(result.inserted_id)
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/crimes", methods=["GET"])
def get_crimes():
    crimes = list(mongo.db.crimes.find({}, {"_id": 0}))
    return jsonify(crimes)

@app.route("/report_audio", methods=["POST"])
def report_audio():
    data = request.get_json()
    transcript = data.get("transcript")
    lat = data.get("lat")
    lon = data.get("lon")

    print("Received transcript:", transcript)
    print("Location:", lat, lon)

    if not transcript or lat is None or lon is None:
        return jsonify({"error": "Missing transcript or location"}), 400

    try:
        # Step 1: Classify immediately
        incident_type = classify_incident(transcript)
        print("Predicted incident type:", incident_type)

        # Step 2: Store report in DB immediately
        mongo.db.incident_reports.insert_one({
            "transcript": transcript,
            "incident_type": incident_type,
            "location": {"lat": lat, "lon": lon},
            "timestamp": datetime.utcnow()
        })

        # Step 3: Kick off background thread to update graph
        def run_update():
            try:
                update_graph_with_report(
                    incident_type, lat, lon, edges, G, severity_map, compute_safety_score
                )
                print("Graph updated successfully.")
            except Exception as e:
                print("Error updating graph in background:", e)

        Thread(target=run_update).start()

        body = (
            "Hello,\n\n"
            "This is an email to inform you about an emergency report submitted by someone who has you as an emergency contact. "
            "Please check your application for more information.\n\n"
            f'The transcript of the audio shared is: "{transcript}"\n\n'
            f"The location is: {lat}, {lon}\n\n"
            "Regards,\n"
            "Safe Stride Safety Team"
        )
        if send_email(emergency_contact, "Emergency Report", body):
            print("Email sent successfully!")

        # Step 4: Return fast response
        return jsonify({
            "incident_type": incident_type,
            "location": {"lat": lat, "lon": lon},
            "status": "Report received and processing in background"
        })

    except Exception as e:
        print("Unhandled error:", e)
        return jsonify({"error": str(e)}), 500

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

@app.route("/update_profile", methods=["PUT"])
def update_profile():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Authorization header missing or invalid"}), 401

    token = auth_header.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        return jsonify({"error": "Invalid or expired token"}), 401

    try:
        data = request.get_json()
        email = data.get("email")
        emergency_contact = data.get("emergency_contact")

        if not email or not emergency_contact:
            return jsonify({"error": "Missing required fields"}), 400

        user = mongo.db.users.find_one({"_id": ObjectId(payload["user_id"])})
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Update user document
        mongo.db.users.update_one(
            {"_id": ObjectId(payload["user_id"])},
            {
                "$set": {
                    "email": email,
                    "emergency_contact": emergency_contact
                }
            }
        )

        return jsonify({"message": "Profile updated successfully"})
    except Exception as e:
        print("Profile update error:", e)
        return jsonify({"error": "Failed to update profile"}), 500

if __name__ == "__main__":
    app.run(debug=True)
