from flask import Flask, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from spotipy import Spotify
from spotipy.oauth2 import SpotifyOAuth
from spotipy.cache_handler import FlaskSessionCacheHandler
import os
import sys
import requests
# Remove direct import of musicbrainz, use the function within the route
import uuid
import acousticbrainz  # Import the updated acousticbrainz module

app = Flask(__name__)
app.secret_key = "spotify_playlist_app_secret_key"
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

# --- Spotify API Details and OAuth Setup (Keep as is) ---
CLIENT_ID = "3a08fc29a9c545baa9363c2eb073e789"
CLIENT_SECRET = "6e4c33b8e49b40578dd95bcbd0a34129"
REDIRECT_URI = "http://localhost:5000/callback"
SCOPES = [
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-read-private",
    "playlist-modify-public",
    "playlist-modify-private"
]

@app.before_request
def before_request():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())

cache_handler = FlaskSessionCacheHandler(session)
sp_oauth = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=" ".join(SCOPES),
    cache_handler=cache_handler,
    show_dialog=True
)

# --- Login, Callback, Get Playlists, Search Playlist Routes (Keep mostly as is) ---

@app.route('/')
def login():
    auth_url = sp_oauth.get_authorize_url()
    return jsonify({'auth_url': auth_url})

@app.route("/callback")
def callback():
    code = request.args.get("code")
    # Ensure cache handler uses the correct session before getting token
    sp_oauth.cache_handler = FlaskSessionCacheHandler(session)
    try:
        token_info = sp_oauth.get_access_token(code, check_cache=False) # Force fetch, don't rely on potentially wrong cache
        session["token_info"] = token_info
        access_token = token_info["access_token"]
        # Redirect to frontend with token
        return redirect(f"http://localhost:3000/?token={access_token}")
    except Exception as e:
        print(f"Error getting token: {e}", file=sys.stderr)
        # Redirect to frontend with error indicator
        return redirect("http://localhost:3000/?error=auth_failed")


def get_valid_token():
    """Helper to get valid token info, refreshing if necessary."""
    token_info = session.get('token_info')

    if not token_info:
        # Check Authorization header as a fallback (e.g., after page refresh)
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            access_token = auth_header.split(' ')[1]
            # Basic token structure, missing refresh token etc.
            # This might need re-auth if the token expires and no refresh token is in session
            token_info = {'access_token': access_token}
            session['token_info'] = token_info # Store it back for potential future use in the same request cycle
        else:
            return None # No token found

    # Ensure cache handler uses the correct session before checking expiry/refreshing
    sp_oauth.cache_handler = FlaskSessionCacheHandler(session)

    # Check if token needs refreshing (requires refresh_token in token_info)
    if 'refresh_token' in token_info and sp_oauth.is_token_expired(token_info):
        try:
            token_info = sp_oauth.refresh_access_token(token_info['refresh_token'])
            session['token_info'] = token_info # Update session with new token
        except Exception as e:
            print(f"Error refreshing token: {e}", file=sys.stderr)
            # Clear potentially invalid token info and force re-login
            session.pop('token_info', None)
            return None

    return token_info


@app.route('/get_playlists')
def get_playlists():
    token_info = get_valid_token()
    if not token_info:
        return jsonify({'error': 'User not authenticated or token expired'}), 401

    try:
        sp = Spotify(auth=token_info['access_token'])
        playlists = sp.current_user_playlists()
        playlists_info = [
            {
                'name': pl['name'],
                'url': pl['external_urls']['spotify'],
                'images': pl['images'],
                'id': pl['id']
            }
            for pl in playlists['items']
        ]
        return jsonify(playlists_info)
    except Exception as e:
        print(f"Error in get_playlists: {str(e)}", file=sys.stderr)
        # Check for specific auth errors if possible
        if "token expired" in str(e).lower():
             session.pop('token_info', None) # Clear expired token
             return jsonify({'error': 'Spotify token expired, please login again'}), 401
        return jsonify({'error': f'Failed to fetch playlists: {str(e)}'}), 500

@app.route("/search_playlist", methods=["GET"])
def search_playlist():
    playlist_name = request.args.get('q')
    if not playlist_name:
        return jsonify({"error": "Please provide a playlist name."}), 400

    token_info = get_valid_token()
    if not token_info:
        return jsonify({'error': 'User not authenticated or token expired'}), 401

    try:
        sp = Spotify(auth=token_info['access_token'])

        # Get user's playlists (same logic as before)
        user_playlists = []
        offset = 0
        limit = 50
        while True:
            results = sp.current_user_playlists(limit=limit, offset=offset)
            user_playlists.extend(results['items'])
            if results['next'] is None:
                break
            offset += limit

        # Find the matching playlist by name (same logic as before)
        found_playlist = None
        for pl in user_playlists:
            if playlist_name.lower() == pl['name'].lower():
                 found_playlist = pl
                 break
        if not found_playlist:
             for pl in user_playlists:
                 if playlist_name.lower() in pl['name'].lower():
                     found_playlist = pl
                     print(f"Partial match found: {pl['name']}", file=sys.stdout)
                     break

        if not found_playlist:
            return jsonify({"error": f"No playlist found matching '{playlist_name}'."}), 404

        playlist_id = found_playlist['id']
        actual_playlist_name = found_playlist['name']

        # Fetch tracks and calculate total duration
        playlist_tracks_items = []
        total_duration_ms = 0 # Initialize total duration
        offset = 0
        limit = 100
        # Specify fields to ensure duration_ms is included
        fields_to_get = 'items(track(name, artists(name), album(name), duration_ms)),next'
        while True:
            # Fetch items with specified fields
            results = sp.playlist_items(playlist_id, limit=limit, offset=offset, fields=fields_to_get)
            playlist_tracks_items.extend(results['items'])

            # Add duration of fetched tracks to total
            for item in results['items']:
                track = item.get('track')
                if track and isinstance(track.get('duration_ms'), int):
                    total_duration_ms += track['duration_ms']

            if results['next'] is None:
                break
            offset += limit

        # Extract song names, artist names, and album names (still needed for MBID lookup)
        tracks_info = []
        for item in playlist_tracks_items:
            track = item.get('track')
            # Check essential fields needed for MBID lookup
            if track and track.get('name') and track.get('artists') and track['artists'][0].get('name') and track.get('album') and track['album'].get('name'):
                 tracks_info.append({
                     "name": track['name'],
                     "artist": track['artists'][0]['name'],
                     "album": track['album']['name']
                 })
            else:
                 # Log if essential info for MBID lookup is missing
                 print(f"Skipping track due to missing name/artist/album data: {item.get('track', {}).get('name', 'N/A')}", file=sys.stderr)

        # Return playlist name, tracks, AND total duration
        return jsonify({
            "playlist_name": actual_playlist_name,
            "tracks": tracks_info,
            "total_duration_ms": total_duration_ms # Add total duration here
        })

    except Exception as e:
        print(f"Error in search_playlist: {str(e)}", file=sys.stderr)
        if "token expired" in str(e).lower():
             session.pop('token_info', None)
             return jsonify({'error': 'Spotify token expired, please login again'}), 401
        return jsonify({'error': f'Failed to process playlist: {str(e)}'}), 500


@app.route("/get_mbid", methods=["GET"])
def get_mbid_route(): # Renamed function to avoid conflict
    song_name = request.args.get("song_name")
    artist_name = request.args.get("artist_name")
    album = request.args.get("album") # Keep album for better matching

    if not song_name or not artist_name: # Album is helpful but not strictly required for the query
        return jsonify({"error": "Please provide song_name and artist_name"}), 400

    # Construct the query, prioritizing matches with all three fields
    query_parts = [f'recording:"{song_name}"', f'artist:"{artist_name}"']
    if album:
        query_parts.append(f'release:"{album}"') # Use release for album matching in recordings

    query = " AND ".join(query_parts)

    url = "https://musicbrainz.org/ws/2/recording/"
    params = {
        "query": query,
        "fmt": "json",
        "limit": 10 # Get a few results to potentially check score later if needed
    }
    headers = {
        "User-Agent": "SpotifyPlaylistAnalyzer/1.0 ( your-email@example.com )" # Be a good citizen
    }

    print(f"Querying MusicBrainz: {url} with params {params}") # Debugging

    try:
        response = requests.get(url, params=params, headers=headers, timeout=10) # Add timeout
        response.raise_for_status() # Raise HTTP errors

        data = response.json()
        recordings = data.get("recordings", [])

        if recordings:
            # Simple approach: take the first result's ID.
            # More robust: check scores if available, or filter further if needed.
            mbid = recordings[0].get("id")
            if mbid:
                 print(f"MBID found: {mbid} for {song_name} / {artist_name}")
                 return jsonify({"mbid": mbid})
            else:
                 print(f"No MBID in first recording for {song_name} / {artist_name}")
                 return jsonify({"error": "No MBID found in recording data"}), 404
        else:
            print(f"No recordings found for query: {query}")
             # Try a broader query without the album as a fallback
            if album:
                print("Retrying MBID search without album...")
                query_simple = f'recording:"{song_name}" AND artist:"{artist_name}"'
                params_simple = {"query": query_simple, "fmt": "json", "limit": 1}
                response_simple = requests.get(url, params=params_simple, headers=headers, timeout=10)
                response_simple.raise_for_status()
                data_simple = response_simple.json()
                recordings_simple = data_simple.get("recordings", [])
                if recordings_simple and recordings_simple[0].get("id"):
                    mbid_simple = recordings_simple[0].get("id")
                    print(f"MBID found (without album): {mbid_simple} for {song_name} / {artist_name}")
                    return jsonify({"mbid": mbid_simple})
                else:
                     print(f"No recordings found even without album for: {song_name} / {artist_name}")

            return jsonify({"error": "No recordings found matching the criteria"}), 404

    except requests.exceptions.Timeout:
        print(f"MusicBrainz request timed out for query: {query}")
        return jsonify({"error": "MusicBrainz request timed out"}), 504 # Gateway Timeout
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from MusicBrainz: {e}")
        return jsonify({"error": f"Failed to fetch data from MusicBrainz: {e}"}), 502 # Bad Gateway
    except Exception as e:
        print(f"Unexpected error in get_mbid_route: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


# --- ADD NEW ACOUSTIC DATA ROUTE ---
@app.route("/get_acoustic_data", methods=["GET"])
def get_acoustic_data():
    mbid = request.args.get("mbid")

    if not mbid:
        return jsonify({"error": "Please provide an MBID"}), 400

    try:
        acoustic_data = acousticbrainz.get_acousticbrainz_data(mbid)
        if acoustic_data is not None:
            return jsonify(acoustic_data)
        else:
            # Provide specific reasons if possible, otherwise generic
            return jsonify({"error": "No acoustic data available or error fetching data"}), 404
    except Exception as e:
        print(f"Error fetching acoustic data for MBID {mbid}: {str(e)}", file=sys.stderr)
        return jsonify({"error": f"Server error fetching acoustic data: {str(e)}"}), 500


if __name__ == '__main__':
    # Use 0.0.0.0 to be accessible from other devices on the network if needed
    # Use a specific port if 5000 is taken
    app.run(host='0.0.0.0', port=5000, debug=True)