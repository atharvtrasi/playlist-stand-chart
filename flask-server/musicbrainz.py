import requests

def get_mbid(song_name, artist_name):
    base_url = "https://musicbrainz.org/ws/2/recording"
    query = f"{song_name} {artist_name}"
    params = {
        "query": query,
        "fmt": "json"
    }
    response = requests.get(base_url, params=params)

    print(response)

    if response.status_code == 200:
        data = response.json()
        if data['recordings']:
            return data['recordings'][0]['id']  # Return first result's MBID
    return None
