import React, { useEffect, useState } from "react";
import "./App.css";
import axios from 'axios';

function App() {
    const SCOPES = [
        "playlist-read-private",
        "playlist-read-collaborative",
        "user-read-private",
        "playlist-modify-public",
        "playlist-modify-private"
    ];

    const CLIENT_ID = "3a08fc29a9c545baa9363c2eb073e789"; // Replace with your Spotify Client ID
    const REDIRECT_URI = "http://localhost:3000"; // Frontend redirect URI
    const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
    const RESPONSE_TYPE = "token"; // Or 'code' if you're using authorization code flow

    const AUTH_URL = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
        REDIRECT_URI
    )}&response_type=${RESPONSE_TYPE}&scope=${SCOPES.join("%20")}`;

    const [token, setToken] = useState("");
    const [searchKey, setSearchKey] = useState(""); // Search bar input


    useEffect(() => {
        // Extract token from URL hash if available
        const hash = window.location.hash;
        let token = window.localStorage.getItem("token");

        if (!token && hash) {
            token = hash
                .substring(1)
                .split("&")
                .find((elem) => elem.startsWith("access_token"))
                .split("=")[1];

            window.location.hash = ""; // Clear hash
            window.localStorage.setItem("token", token); // Save token locally
        }

        setToken(token);
    }, []);

    const logout = () => {
        setToken("");
        window.localStorage.removeItem("token");
    };

    const handleSearchSubmit = async (e) => {
      e.preventDefault()

      try {
        const response = await axios.get("http://localhost:5000/playlists", {
          headers: {
            Authorization: 'Bearer'
          }
        });
        
        console.log(response)
      }catch(err) {
        console.log("Failed to fetch playlists")
      }

    }

    return (
        <div className="App">
            <header className="App-header">
                <h1>Spotify Playlist Search</h1>
                {!token ? (
                    <button onClick={() => (window.location.href = AUTH_URL)}>Login to Spotify</button>
                ) : (
                    <button onClick={logout}>Logout</button>
                )}

                {token && (
                    <div>
                        <form onSubmit={handleSearchSubmit}>
                            <input
                                type="text"
                                placeholder="Search for a playlist"
                                value={searchKey}
                                onChange={(e) => setSearchKey(e.target.value)}
                            />
                            <button type="submit">Search</button>
                        </form>
                    </div>
                )}
            </header>
        </div>
    );
}

export default App;
