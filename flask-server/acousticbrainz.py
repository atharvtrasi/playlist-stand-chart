import requests
import json

def get_acousticbrainz_data(mbid):
    """
    Takes a single MBID and queries the AcousticBrainz low-level API.
    Returns a dictionary containing bpm, danceability, the Rosamerica genre,
    and the relaxed mood probability.
    Handles cases where sections or specific fields might be missing.
    """
    if not mbid:
        print(f"No MBID provided.")
        return None

    api_url = f"https://acousticbrainz.org/api/v1/{mbid}/low-level"
    hurl = f"https://acousticbrainz.org/api/v1/{mbid}/high-level"
    print(f"Querying AcousticBrainz: {hurl}")
    print(f"Querying AcousticBrainz: {api_url}")

    try:
        response = requests.get(api_url, timeout=15)
        hres = requests.get(hurl, timeout=15)
        response.raise_for_status()

        try:
            data = response.json()
        except json.JSONDecodeError:
            print(f"Error: Invalid lowlevel JSON received from AcousticBrainz for MBID {mbid}")
            return None
        try:
            hdata = hres.json()
        except json.JSONDecodeError:
            print(f"Error: Invalid highlevel JSON received from AcousticBrainz for MBID {mbid}")
            return None

        # --- Extract BPM ---
        bpm = data.get('rhythm', {}).get('bpm')
        bpm = bpm if isinstance(bpm, (int, float)) else None
        print(f"MBID {mbid} - Validated BPM: {bpm}")

        # --- Extract Danceability ---
        danceability = data.get('rhythm', {}).get('danceability')
        danceability = danceability if isinstance(danceability, (int, float)) else None
        print(f"MBID {mbid} - Validated Danceability: {danceability}")

        # --- Determine Genre (Rosamerica Only) ---
        genre = "Unknown"
        try:
            genre = hdata.get('highlevel', {}).get('genre_rosamerica', {}).get('value', {})
        except Exception as e:
             print(f"MBID {mbid} - Error extracting Rosamerica genre: {e}")
             genre = "Unknown"

        # --- Extract Relaxed Mood Probability ---
        relaxed_prob = None
        try:
            # Path: highlevel -> mood_relaxed -> all -> relaxed
            relaxed_prob = hdata.get('highlevel', {}).get('mood_relaxed', {}).get('all', {}).get('relaxed', None)
        except Exception as e:
             print(f"MBID {mbid} - Error extracting relaxed mood: {e}")
             relaxed_prob = None # Fallback

        # Return dictionary with the new probability
        res = {
            "bpm": bpm,
            "danceability": danceability,
            "genre": genre,
            "relaxedProbability": relaxed_prob, # Add the new field
        }
        print()
        return res

    except requests.exceptions.Timeout:
        print(f"Error: Timeout while fetching AcousticBrainz data for MBID {mbid}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error: Request failed for AcousticBrainz MBID {mbid}: {e}")
        return None
    except Exception as e:
        print(f"Error: Unexpected error processing AcousticBrainz data for MBID {mbid}: {e}")
        return None
