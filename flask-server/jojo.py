import numpy as np
import pandas as pd

# Danceability (Power): 0-3
# BPM (Speed): 40-250
# Relaxed (Precision): 0-1
# Potential: Already normalized
# (Duration) Durability: 4-2880000
# Unique Genres (Range): 1-8 (rosamerica model only has 8 genres)

def norm(val, ma, mi):
    # Normalize values to range 16.677-100 to get chars
    return (500 / 6) * ((val - mi) / (ma - mi)) + (100 / 6)

def get_jojo_chart(data):
    # Create char map for JoJo chart
    df = pd.read_csv('jojo-stands.csv', encoding='ISO-8859-1')

    # Convert values   
    df = df.replace(to_replace=['None', 'E', 'D', 'C', 'B', 'A', 'Infi'], value=[i * 100 / 6 for i in range(7)])
    df.columns = ['STM' if x == 'PER' else x for x in df.columns]

    # Get values from data
    danceability = data['averageDanceability']
    bpm = data['averageBPM']
    relaxed = data['averageRelaxedProbability']
    potential = data['potential']
    durability = data['spotifyTotalDurationMs']
    genre_range = data['uniqueGenreCount']  # Renamed variable

    # Normalize values
    pwr = norm(danceability, 3, 0)
    spd = norm(bpm, 250, 40)
    prc = norm(relaxed, 1, 0)
    dev = norm(potential, 6, 1)
    stm = norm(durability, 1440000000, 4)
    rng = norm(genre_range, 8, 1)  # Updated variable name

    converted_stats = np.array([pwr, spd, prc, dev, stm, rng])

    def distance(a, b):
        return np.linalg.norm(a - b)

    df["distance"] = df.apply(lambda x: distance(x.to_numpy()[1:7], converted_stats), axis=1)  

    return converted_stats, df.loc[df['distance'].idxmin()]

# def main():
#     data = { 
#         "averageBPM": 98.44, 
#         "averageDanceability": 1.21, 
#         "uniqueGenreCount": 4, 
#         "spotifyTotalDurationMs": 3900701, 
#         "averageRelaxedProbability": 0.43, 
#         "potential": 3 
#     }

#     playlist, stand = get_jojo_chart(data)

#     print("\n",playlist)
#     print("\n",stand)

# if __name__ == "__main__":
#     main()