from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import requests

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

# Spotify API Details
CLIENT_ID = "3a08fc29a9c545baa9363c2eb073e789"
CLIENT_SECRET = "6e4c33b8e49b40578dd95bcbd0a34129"
REDIRECT_URI = "http://localhost:3000"
SCOPES = [
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-read-private",
    "playlist-modify-public",
    "playlist-modify-private"
]

sp_oauth = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=" ".join(SCOPES)
)

# Store tokens (use a database in production)
tokens = {}

@app.route('/')
def login():
    """Redirect user to Spotify login page."""
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)


@app.route('/callback')
def callback():
    """Handle Spotify callback and exchange code for token."""
    code = request.args.get('code')
    token_info = sp_oauth.get_access_token(code)
    tokens['spotify'] = token_info
    return jsonify(token_info)


@app.route('/playlists', methods=['GET'])
def get_playlists():
    """Fetch user playlists from Spotify."""
    token_info = tokens.get('spotify')
    if not token_info:
        print("user not authenticated")
        return jsonify({"error": "User not authenticated"}), 401

    sp = spotipy.Spotify(auth=token_info['access_token'])
    playlists = []
    results = sp.current_user_playlists()

    while results:
        playlists.extend(results['items'])
        results = sp.next(results) if results['next'] else None

    return jsonify(playlists)


@app.route('/playlists/<playlist_id>/tracks', methods=['GET'])
def get_playlist_tracks(playlist_id):
    """Fetch tracks for a specific playlist."""
    token_info = tokens.get('spotify')
    if not token_info:
        return jsonify({"error": "User not authenticated"}), 401

    sp = spotipy.Spotify(auth=token_info['access_token'])
    tracks = []
    results = sp.playlist_tracks(playlist_id)

    while results:
        tracks.extend(results['items'])
        results = sp.next(results) if results['next'] else None

    return jsonify(tracks)


@app.route('/metrics', methods=['POST'])
def calculate_metrics():
    """Calculate average metrics for tracks using MBIDs."""
    data = request.json
    mbids = data.get('mbids', [])

    features_sum = {
        'danceability': 0,
        'bpm': 0,
    }
    track_count = 0

    for mbid in mbids:
        response = requests.get(f"https://acousticbrainz.org/{mbid}/low-level")
        if response.status_code != 200:
            continue

        acoustic_data = response.json()
        features = {
            'danceability': acoustic_data.get('highlevel', {}).get('danceability', {}).get('value', 0),
            'bpm': acoustic_data.get('rhythm', {}).get('bpm', 0)
        }

        for key in features_sum:
            features_sum[key] += features.get(key, 0)

        track_count += 1

    if track_count == 0:
        return jsonify({"error": "No valid tracks found"}), 400

    averages = {key: round(value / track_count, 2) for key, value in features_sum.items()}
    return jsonify(averages)


if __name__ == '__main__':
    app.run(debug=True)
