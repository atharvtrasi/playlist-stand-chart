import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./App.css"; // Make sure to import the CSS file

// Helper function to format duration (takes milliseconds)
const formatDuration = (milliseconds) => {
    if (isNaN(milliseconds) || milliseconds === null || milliseconds < 0) {
        return "N/A";
    }
    const msNumber = Number(milliseconds);
    if (isNaN(msNumber)) {
        return "N/A";
    }
    const totalSeconds = Math.round(msNumber / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(secs).padStart(2, '0');
    if (hours > 0) {
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    } else {
        return `${paddedMinutes}:${paddedSeconds}`;
    }
};


function App() {
    const [token, setToken] = useState("");
    const [playlists, setPlaylists] = useState([]);
    const [searchKey, setSearchKey] = useState("");
    const [filteredPlaylists, setFilteredPlaylists] = useState([]);
    const [trackDetails, setTrackDetails] = useState([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState(null);
    const [view, setView] = useState('playlists');
    const [sliderValue, setSliderValue] = useState(3);
    const [playlistMetrics, setPlaylistMetrics] = useState({
        averageBPM: null,
        averageDanceability: null,
        uniqueGenreCount: null,
        spotifyTotalDurationMs: null,
        averageRelaxedProbability: null,
        potential: null,
    });

    // --- CONSOLE LOG TO SEE STATE ON RENDER ---
    // console.log("--- App Component Render ---");
    // console.log("Token:", token ? `${token.substring(0, 5)}...` : "None");
    // console.log("View:", view);
    // console.log("Loading Data:", loadingData);
    // console.log("Selected Playlist:", selectedPlaylist?.name || "None");
    // console.log("Playlist Metrics:", playlistMetrics);
    // console.log("Track Details Count:", trackDetails.length);
    // console.log("Error State:", error);
    // console.log("----------------------------");


    // Effect to handle token
    useEffect(() => {
        console.log("Token Effect: Running");
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get("token");
        const urlError = urlParams.get("error");
        const storedToken = localStorage.getItem("token");

        if (urlError) {
            console.error("Token Effect: Auth error from URL", urlError);
            setError(`Authentication failed: ${urlError}. Please try logging in again.`);
            window.history.replaceState({}, document.title, "/");
        } else if (urlToken) {
            console.log("Token Effect: Token found in URL");
            setToken(urlToken);
            localStorage.setItem("token", urlToken);
            window.history.replaceState({}, document.title, "/"); // Clean URL
        } else if (storedToken) {
            console.log("Token Effect: Token found in localStorage");
            setToken(storedToken);
        } else {
            console.log("Token Effect: No token found");
        }
    }, []); // Runs only once on mount

    // handleLogout function
    const handleLogout = useCallback(() => {
        console.log("Logout Handler: Logging out...");
        localStorage.removeItem("token");
        setToken("");
        setPlaylists([]);
        setFilteredPlaylists([]);
        setSelectedPlaylist(null);
        setTrackDetails([]);
        setPlaylistMetrics({ averageBPM: null, averageDanceability: null, uniqueGenreCount: null, spotifyTotalDurationMs: null, averageRelaxedProbability: null, potential: null });
        setError(null);
        setView('playlists');
        setSliderValue(3);
        setLoadingData(false); // Ensure loading stops
        window.history.replaceState({}, document.title, "/"); // Clean URL
        console.log("Logout Handler: State reset complete.");
    }, []); // No dependencies needed

    // Effect to fetch playlists when token changes
    const fetchPlaylists = useCallback(async () => {
        if (!token) {
            console.log("Fetch Playlists: No token, skipping fetch.");
            return;
        }
        console.log("Fetch Playlists: Starting fetch...");
        // setError(null); // Clear previous errors when starting a new fetch
        try {
            const response = await axios.get("http://localhost:5000/get_playlists", {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`Fetch Playlists: Success, received ${response.data.length} playlists.`);
            setPlaylists(response.data);
            setFilteredPlaylists(response.data);
            setError(null); // Clear error on success
        } catch (err) {
            console.error("Fetch Playlists: Error fetching playlists:", err.response?.data || err.message);
            if (err.response && err.response.status === 401) {
                setError("Your session expired. Please log in again.");
                handleLogout(); // Logout on auth error
            } else {
                setError(`Failed to fetch playlists: ${err.response?.data?.error || err.message}. Please try again later.`);
            }
            setPlaylists([]);
            setFilteredPlaylists([]);
        }
    }, [token, handleLogout]); // Depends on token and handleLogout

    useEffect(() => {
        fetchPlaylists();
    }, [fetchPlaylists]); // Run fetchPlaylists when it changes (i.e., when token changes)

    // Effect to filter playlists based on searchKey
    useEffect(() => {
        if (playlists.length > 0) {
            console.log(`Filter Effect: Filtering ${playlists.length} playlists with key "${searchKey}"`);
            const filtered = playlists.filter(p => p.name.toLowerCase().includes(searchKey.toLowerCase()));
            setFilteredPlaylists(filtered);
        }
    }, [searchKey, playlists]); // Depends on searchKey and playlists

    // --- API Call Functions ---
    const handleLogin = () => {
        console.log("Login Handler: Redirecting to backend for Spotify login...");
        window.location.href = "http://localhost:5000/"; // Redirect to backend login route
    };

    // Fetch MBID from backend
    const fetchMbids = async (songname, artist, album) => {
        console.log(`Fetch MBID: Requesting for Song='${songname}', Artist='${artist}', Album='${album}'`);
        if (!songname || !artist) {
            console.warn("Fetch MBID: Missing song name or artist.");
            return null;
        }
        try {
            const response = await axios.get(`http://localhost:5000/get_mbid`, {
                params: { song_name: songname, artist_name: artist, album: album }
            });
            console.log(`Fetch MBID: Success for '${songname}'. MBID: ${response.data.mbid}`);
            return response.data.mbid; // Should return just the mbid string
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            // Don't treat 404 as a critical error, just log it
            if (error.response?.status === 404) {
                console.log(`Fetch MBID: Not Found (404) for '${songname}'. Message: ${errorMsg}`);
            } else {
                console.error(`Fetch MBID: Error for '${songname}'. Status: ${error.response?.status}, Message: ${errorMsg}`);
            }
            return null; // Return null if not found or error
        }
    };

    // Fetch Acoustic Data from backend
    const fetchAcousticData = async (mbid) => {
        if (!mbid) {
            console.warn("Fetch Acoustic Data: No MBID provided.");
            return null;
        }
        console.log(`Fetch Acoustic Data: Requesting for MBID ${mbid}`);
        try {
            const response = await axios.get(`http://localhost:5000/get_acoustic_data`, {
                params: { mbid: mbid }
            });
            const data = response.data;
            console.log(`Fetch Acoustic Data: Success for MBID ${mbid}. Data:`, data);
            // Validate received data structure
            return {
                bpm: typeof data.bpm === 'number' ? data.bpm : null,
                danceability: typeof data.danceability === 'number' ? data.danceability : null,
                genre: data.genre || "Unknown", // Default to Unknown if missing
                relaxedProbability: typeof data.relaxedProbability === 'number' ? data.relaxedProbability : null,
            };
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            // Don't treat 404 as a critical error, just log it
            if (error.response?.status === 404) {
                console.log(`Fetch Acoustic Data: Not Found (404) for MBID ${mbid}. Message: ${errorMsg}`);
            } else {
                console.error(`Fetch Acoustic Data: Error for MBID ${mbid}. Status: ${error.response?.status}, Message: ${errorMsg}`);
            }
            return null; // Return null on error
        }
    };

    // Calculate aggregate metrics from track details
    const calculatePlaylistMetrics = useCallback((details) => {
        console.log("Calculate Metrics: Starting calculation with details:", details);
        if (!details || details.length === 0) {
            console.warn("Calculate Metrics: No details provided to calculate metrics.");
            // Reset relevant metrics if details are empty
            setPlaylistMetrics(prevMetrics => ({
                ...prevMetrics,
                averageBPM: null,
                averageDanceability: null,
                uniqueGenreCount: null,
                averageRelaxedProbability: null,
            }));
            return;
        }

        const validBPMs = details.map(item => item?.bpm).filter(bpm => typeof bpm === 'number');
        const validDanceabilities = details.map(item => item?.danceability).filter(d => typeof d === 'number');
        const validGenres = details.map(item => item?.genre).filter(g => g && g !== "Unknown" && g !== "N/A");
        const validRelaxedProbs = details.map(item => item?.relaxedProbability).filter(p => typeof p === 'number');

        console.log("Calculate Metrics - Valid Data Points:", {
            BPMs: validBPMs.length,
            Danceabilities: validDanceabilities.length,
            Genres: validGenres.length,
            RelaxedProbs: validRelaxedProbs.length
        });

        const rawAverageBPM = validBPMs.length > 0 ? validBPMs.reduce((a, b) => a + b, 0) / validBPMs.length : null;
        const rawAverageDanceability = validDanceabilities.length > 0 ? validDanceabilities.reduce((a, b) => a + b, 0) / validDanceabilities.length : null;
        const rawAverageRelaxedProb = validRelaxedProbs.length > 0 ? validRelaxedProbs.reduce((a, b) => a + b, 0) / validRelaxedProbs.length : null;
        const uniqueGenreCount = new Set(validGenres).size;

        const finalAverageBPM = rawAverageBPM !== null ? parseFloat(rawAverageBPM.toFixed(2)) : null;
        const finalAverageDanceability = rawAverageDanceability !== null ? parseFloat(rawAverageDanceability.toFixed(2)) : null;
        const finalAverageRelaxedProb = rawAverageRelaxedProb !== null ? parseFloat(rawAverageRelaxedProb.toFixed(2)) : null;

        const calculatedMetrics = {
            averageBPM: finalAverageBPM,
            averageDanceability: finalAverageDanceability,
            uniqueGenreCount: uniqueGenreCount > 0 ? uniqueGenreCount : null,
            averageRelaxedProbability: finalAverageRelaxedProb,
        };
        console.log("Calculate Metrics: Calculated values:", calculatedMetrics);

        // Update state using functional update to merge with existing metrics (like duration, potential)
        setPlaylistMetrics(prevMetrics => {
            const newState = {
                ...prevMetrics, // Keep existing spotify duration and potential
                ...calculatedMetrics // Add/overwrite the newly calculated ones
            };
            console.log("Calculate Metrics: Updated playlistMetrics state:", newState);
            return newState;
        });
    }, []); // No dependencies needed

    // Fetch MBIDs and AcousticBrainz data for tracks
    const fetchAndProcessTrackData = useCallback(async (tracks) => {
        console.log(`Process Track Data: Starting for ${tracks.length} tracks.`);
        let allTrackDetails = [];

        // Use Promise.allSettled to handle individual fetch failures gracefully
        const detailPromises = tracks.map(async (track, index) => {
            console.log(`Process Track Data: [${index + 1}/${tracks.length}] Fetching MBID for "${track.name}" by ${track.artist}`);
            const mbid = await fetchMbids(track.name, track.artist, track.album);
            let acousticData = null;
            let detail = {
                name: track.name, artist: track.artist, mbid: mbid || "Not found",
                bpm: null, danceability: null, genre: "N/A", relaxedProbability: null,
            };
            if (mbid) {
                console.log(`Process Track Data: [${index + 1}/${tracks.length}] Fetching Acoustic Data for MBID ${mbid}`);
                acousticData = await fetchAcousticData(mbid);
                if (acousticData) { // Check if data was successfully returned
                    detail.bpm = acousticData.bpm;
                    detail.danceability = acousticData.danceability;
                    detail.genre = acousticData.genre;
                    detail.relaxedProbability = acousticData.relaxedProbability;
                    console.log(`Process Track Data: [${index + 1}/${tracks.length}] Acoustic data processed for MBID ${mbid}`);
                } else {
                    console.log(`Process Track Data: [${index + 1}/${tracks.length}] No acoustic data found/returned for MBID ${mbid}`);
                }
            } else {
                console.log(`Process Track Data: [${index + 1}/${tracks.length}] Skipping Acoustic Data fetch (no MBID) for "${track.name}"`);
            }
            return detail; // Return the detail object regardless of success/failure
        });

        try {
            // Wait for all promises to settle (either resolve or reject)
            const results = await Promise.allSettled(detailPromises);
            console.log("Process Track Data: Promise.allSettled finished. Results:", results);

            // Filter out rejected promises and extract values from fulfilled ones
            allTrackDetails = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);

            console.log("Process Track Data: Successfully processed track details:", allTrackDetails);
            setTrackDetails(allTrackDetails); // Update state with successfully processed details
            calculatePlaylistMetrics(allTrackDetails); // Calculate metrics based on the processed details

        } catch (err) {
            // This catch block might not be strictly necessary with allSettled,
            // but good for catching unexpected errors in the overall process.
            console.error("Process Track Data: Unexpected error during Promise processing:", err);
            setError("An error occurred while processing song details.");
            setTrackDetails([]); // Clear details on major error
            calculatePlaylistMetrics([]); // Recalculate metrics with empty data
        } finally {
            console.log("Process Track Data: Setting loadingData to false.");
            setLoadingData(false); // Stop loading indicator *after* all processing is done or failed
        }
    }, [calculatePlaylistMetrics]); // Depends on calculatePlaylistMetrics

    // --- Control Flow Functions ---

    // When a playlist card is clicked
    const handlePlaylistClick = useCallback((playlist) => {
        console.log(`Playlist Click: Selected "${playlist.name}" (ID: ${playlist.id})`);
        setSelectedPlaylist(playlist);
        setTrackDetails([]); // Reset previous track details
        // Reset all metrics before moving to slider
        setPlaylistMetrics({ averageBPM: null, averageDanceability: null, uniqueGenreCount: null, spotifyTotalDurationMs: null, averageRelaxedProbability: null, potential: null });
        setError(null); // Clear previous errors
        setSliderValue(3); // Reset slider
        setLoadingData(false); // Ensure loading is off
        setView('slider'); // Move to slider view
        console.log("Playlist Click: State reset and view changed to 'slider'.");
    }, []); // No dependencies needed

    // When the "Next" button on the slider screen is clicked
    const handleSliderNext = useCallback(async () => {
        if (!selectedPlaylist || !token) {
            console.error("Slider Next: Cannot proceed. Missing selected playlist or token.");
            setError("Cannot proceed without a selected playlist and authentication.");
            return;
        }
        console.log(`Slider Next: Clicked for playlist "${selectedPlaylist.name}". Potential set to: ${sliderValue}`);

        // Store potential and move view *before* async calls
        setPlaylistMetrics(prev => ({ ...prev, potential: sliderValue }));
        setView('metrics');
        setLoadingData(true); // Start loading indicator
        setError(null); // Clear previous errors

        try {
            console.log("Slider Next: Fetching Spotify playlist details...");
            const response = await axios.get(`http://localhost:5000/search_playlist`, {
                params: { q: selectedPlaylist.name }, // Pass name as query param
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Slider Next: Spotify data received:", response.data);

            const tracks = response.data?.tracks;
            const spotifyTotalDurationMs = response.data?.total_duration_ms;

            // Update duration metric immediately
            if (typeof spotifyTotalDurationMs === 'number') {
                setPlaylistMetrics(prev => {
                    const newState = { ...prev, spotifyTotalDurationMs: spotifyTotalDurationMs };
                    console.log("Slider Next: Updated playlistMetrics with Spotify duration:", newState);
                    return newState;
                });
            } else {
                console.warn("Slider Next: Spotify total duration not received or not a number:", spotifyTotalDurationMs);
                setPlaylistMetrics(prev => ({ ...prev, spotifyTotalDurationMs: null })); // Set to null if invalid
            }

            // Process tracks if they exist
            if (tracks && tracks.length > 0) {
                console.log(`Slider Next: Found ${tracks.length} tracks. Starting fetchAndProcessTrackData...`);
                // This function will fetch MBIDs/AcousticData and eventually set loadingData to false
                await fetchAndProcessTrackData(tracks); // Wait for processing
            } else {
                console.log("Slider Next: Playlist has no tracks or tracks array is missing/empty. No AcousticBrainz data to fetch.");
                setTrackDetails([]); // Ensure track details are empty
                calculatePlaylistMetrics([]); // Calculate metrics with empty data (resets AB metrics)
                setLoadingData(false); // Stop loading as there's nothing more to do
            }

        } catch (error) {
            console.error("Slider Next: Error fetching or processing playlist details:", error.response?.data || error.message, error);
            if (error.response && error.response.status === 401) {
                setError("Your session expired. Please log in again.");
                handleLogout(); // Logout on auth error
            } else {
                setError(`Error loading playlist details: ${error.response?.data?.error || error.message}`);
            }
            setLoadingData(false); // Ensure loading stops on error
            setTrackDetails([]); // Clear potentially partial data
            // Reset metrics that might not have been fetched
            setPlaylistMetrics(prev => ({
                ...prev,
                averageBPM: null,
                averageDanceability: null,
                uniqueGenreCount: null,
                spotifyTotalDurationMs: null, // Also reset duration if fetch failed
                averageRelaxedProbability: null,
            }));
        }
    }, [selectedPlaylist, token, sliderValue, fetchAndProcessTrackData, handleLogout, calculatePlaylistMetrics]); // Added calculatePlaylistMetrics dependency

    // Function to go back to the playlist list view
    const goBackToPlaylists = () => {
        console.log("Go Back: Returning to playlists view.");
        setSelectedPlaylist(null);
        setTrackDetails([]);
        setPlaylistMetrics({ averageBPM: null, averageDanceability: null, uniqueGenreCount: null, spotifyTotalDurationMs: null, averageRelaxedProbability: null, potential: null });
        setError(null);
        setView('playlists');
        setSliderValue(3);
        setLoadingData(false); // Ensure loading is off
    };

    // --- Render Logic ---
    return (
        <div className="App">
            <header className="App-header">
                <h1>Spotify Playlist Analyzer</h1>
                {/* Error display moved below header buttons for visibility */}

                {!token ? ( /* ----- Login View ----- */
                    <div>
                        <h2>Welcome!</h2>
                        <p>Connect with your Spotify account to analyze your playlists.</p>
                        <button onClick={handleLogin}>Login to Spotify</button>
                        {/* Display error prominently if login failed */}
                        {error && <p className="error-message">Login Error: {error}</p>}
                    </div>
                ) : ( /* ----- Logged In Views ----- */
                    <div>
                        {/* --- Navigation Buttons --- */}
                        <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
                            {view !== 'playlists' ? (
                                <button onClick={goBackToPlaylists}>
                                    &larr; Back to Playlists
                                </button>
                            ) : (
                                <span>{/* Placeholder to keep logout button right */}</span>
                            )}
                            <button onClick={handleLogout}>Logout</button>
                        </div>

                        {/* --- Error Display Area (below nav) --- */}
                        {error && (
                            <div style={{ marginTop: '70px' }}> {/* Add margin to clear buttons */}
                                <p className="error-message">Error: {error}</p>
                            </div>
                        )}

                        {/* ----- Playlist Selection View ----- */}
                        {view === 'playlists' && (
                            <div style={{ marginTop: '80px' }}> {/* Add margin to avoid overlap with buttons/error */}
                                <h2>Your Playlists</h2>
                                <input
                                    type="text"
                                    placeholder="Search for a playlist..."
                                    value={searchKey}
                                    onChange={(e) => setSearchKey(e.target.value)}
                                    disabled={playlists.length === 0 && !error} // Disable if loading or error prevents list
                                />
                                {/* Playlist Loading/Empty/Grid */}
                                {playlists.length === 0 && !error && <p>Loading your playlists...</p>}
                                {playlists.length > 0 && (
                                    <div className="playlist-grid">
                                        {filteredPlaylists.length === 0 ? (
                                            <p>No playlists found matching "{searchKey}"</p>
                                        ) : (
                                            filteredPlaylists.map((playlist) => (
                                                <div key={playlist.id} className="playlist-card" onClick={() => handlePlaylistClick(playlist)}>
                                                    {playlist.images && playlist.images.length > 0 ? (
                                                        <img src={playlist.images[0].url} alt={playlist.name} className="playlist-image" />
                                                    ) : (
                                                        <div className="playlist-image-placeholder">No Image</div>
                                                    )}
                                                    <h3>{playlist.name}</h3>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ----- Slider Input View ----- */}
                        {view === 'slider' && selectedPlaylist && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', backgroundColor: '#282828', borderRadius: '10px', marginTop: '80px', width: '90%', maxWidth: '600px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)' }}>
                                <h2>{selectedPlaylist.name}</h2>
                                <label htmlFor="potential-slider" style={{ fontSize: '1.1em', marginBottom: '20px', color: '#eee', textAlign: 'center', lineHeight: '1.5' }}>
                                    How likely are you to update this playlist in the near future? (1=Low, 6=High)
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', width: '80%', marginBottom: '30px', gap: '20px' }}>
                                    <input
                                        type="range"
                                        id="potential-slider"
                                        min="1"
                                        max="6"
                                        step="1"
                                        value={sliderValue}
                                        onChange={(e) => setSliderValue(Number(e.target.value))}
                                        style={{ flexGrow: 1, cursor: 'pointer' }} // Basic slider style
                                    />
                                    <span style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#1DB954', minWidth: '30px', textAlign: 'center' }}>{sliderValue}</span>
                                </div>
                                <button onClick={handleSliderNext} style={{ padding: '12px 40px', fontSize: '1.1em' }}>
                                    Next: Analyze Playlist
                                </button>
                            </div>
                        )}

                        {/* ----- Metrics Display View ----- */}
                        {view === 'metrics' && selectedPlaylist && (
                            <div style={{ marginTop: '80px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <h2>{selectedPlaylist.name}</h2>

                                {/* Playlist Metrics Section */}
                                <div className="playlist-metrics">
                                    <h3>Playlist Metrics</h3>
                                    <div className="metrics-grid">
                                        {/* Average BPM */}
                                        <div className="metric-card">
                                            <h4>Average BPM</h4>
                                            <div className="metric-value">
                                                {loadingData && playlistMetrics.averageBPM === null ? (<span className="loading">...</span>) :
                                                    playlistMetrics.averageBPM !== null ? (playlistMetrics.averageBPM) :
                                                        (<span className="no-data">N/A</span>)}
                                            </div>
                                        </div>
                                        {/* Average Danceability */}
                                        <div className="metric-card">
                                            <h4>Avg Danceability</h4>
                                            <div className="metric-value">
                                                {loadingData && playlistMetrics.averageDanceability === null ? (<span className="loading">...</span>) :
                                                    playlistMetrics.averageDanceability !== null ? (playlistMetrics.averageDanceability) :
                                                        (<span className="no-data">N/A</span>)}
                                            </div>
                                        </div>
                                        {/* Unique Genres */}
                                        <div className="metric-card">
                                            <h4>Unique Genres</h4>
                                            <div className="metric-value">
                                                {loadingData && playlistMetrics.uniqueGenreCount === null ? (<span className="loading">...</span>) :
                                                    playlistMetrics.uniqueGenreCount !== null ? (playlistMetrics.uniqueGenreCount) :
                                                        (<span className="no-data">N/A</span>)}
                                            </div>
                                        </div>
                                        {/* Total Runtime */}
                                        <div className="metric-card">
                                            <h4>Total Runtime</h4>
                                            <div className="metric-value">
                                                {/* Show loading only if duration is null AND we are loading */}
                                                {loadingData && playlistMetrics.spotifyTotalDurationMs === null ? (<span className="loading">...</span>) :
                                                    playlistMetrics.spotifyTotalDurationMs !== null ? (
                                                        formatDuration(playlistMetrics.spotifyTotalDurationMs)
                                                    ) : (
                                                        <span className="no-data">N/A</span>
                                                    )}
                                            </div>
                                        </div>
                                        {/* Precision (Avg Relaxed Probability) */}
                                        <div className="metric-card">
                                            <h4>Precision</h4>
                                            <div className="metric-value">
                                                {loadingData && playlistMetrics.averageRelaxedProbability === null ? (<span className="loading">...</span>) :
                                                    playlistMetrics.averageRelaxedProbability !== null ? (playlistMetrics.averageRelaxedProbability) :
                                                        (<span className="no-data">N/A</span>)}
                                            </div>
                                        </div>
                                        {/* Potential (Slider Value) */}
                                        <div className="metric-card">
                                            <h4>Potential</h4>
                                            <div className="metric-value">
                                                {/* Potential is set before loading starts, so no loading state needed */}
                                                {playlistMetrics.potential !== null ? (
                                                    playlistMetrics.potential
                                                ) : (
                                                    <span className="no-data">N/A</span> /* Should always have a value here */
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Track Details List */}
                                <div className="track-detail-list">
                                    <h3>Song Analysis ({trackDetails.length} Tracks Processed):</h3>
                                    {/* Show loading message only if loading AND track details haven't arrived yet */}
                                    {loadingData && trackDetails.length === 0 ? (<p>Loading and analyzing song data...</p>) :
                                        !loadingData && trackDetails.length === 0 && selectedPlaylist ? (<p>No track data could be analyzed for this playlist (check console for details).</p>) :
                                            (
                                                <ul>
                                                    {trackDetails.map((item, index) => (
                                                        <li key={index} className="song-item">
                                                            <div className="song-info">
                                                                <strong>{item.name}</strong> by {item.artist} {item.mbid === 'Not found' ? <span style={{ fontSize: '0.8em', color: '#aaa' }}>(MBID not found)</span> : ''}
                                                            </div>
                                                            <div className="song-data">
                                                                <span>BPM: {item.bpm !== null ? item.bpm.toFixed(0) : 'N/A'}</span>
                                                                <span>Dance: {item.danceability !== null ? item.danceability.toFixed(2) : 'N/A'}</span>
                                                                <span>Genre: {item.genre || 'N/A'}</span>
                                                                {/* Optionally display relaxed probability if needed */}
                                                                {/* <span>Relaxed: {item.relaxedProbability !== null ? item.relaxedProbability.toFixed(2) : 'N/A'}</span> */}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                </div>
                            </div>
                        )}

                    </div> /* End Logged In Views */
                )}
            </header>
        </div>
    );
}

export default App;