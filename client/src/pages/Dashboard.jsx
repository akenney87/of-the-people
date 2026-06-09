import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import issuesList from "../../../shared/issues.json";

// Human-readable label for each issue's scope, shown on the card footer.
const SCOPE_LABEL = {
  national: "National",
  state: "Georgia",
  county: "Hall County",
  city: "Gainesville",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [votes, setVotes] = useState({});
  const [passionWeights, setPassionWeights] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessages, setStatusMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'national' | 'state' | 'local'
  const [hiddenIssues, setHiddenIssues] = useState({}); // Track hidden issues
  const [reportMessage, setReportMessage] = useState(null);
  const [activeOverlays, setActiveOverlays] = useState({});

  useEffect(() => {
    // No client-side session check here — RLS limits the votes query to the
    // authed user, and ProtectedRoute already gated this whole page.

    const fetchExistingVotes = async () => {
      try {
        // RLS limits the result to the authed user's own rows.
        const { data, error } = await supabase
          .from("votes")
          .select("issue_id, vote, passion_weight");
        if (error) throw error;

        const votesObj = {};
        const passionObj = {};
        (data || []).forEach((v) => {
          votesObj[v.issue_id] = v.vote;
          passionObj[v.issue_id] = v.passion_weight;
        });
        setVotes(votesObj);
        setPassionWeights(passionObj);
      } catch (err) {
        console.error("Error fetching existing votes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchExistingVotes();
  }, [navigate]);

  const handleVoteChange = (issueId, newVote) => {
    setVotes(prevVotes => ({
      ...prevVotes,
      [issueId]: newVote
    }));
  };

  const handlePassionChange = (issueId, newPassion) => {
    setPassionWeights(prevPassion => ({
      ...prevPassion,
      [issueId]: parseInt(newPassion)
    }));
  };

  const handleSubmit = async (issueId) => {
    try {
      // Check if we have both a vote and passion weight
      if (votes[issueId] === undefined) {
        setStatusMessages(prev => ({
          ...prev,
          [issueId]: { type: 'error', text: 'Please select Yes or No' }
        }));
        return;
      }

      if (!passionWeights[issueId]) {
        // Default to 3 (moderate) if not set
        setPassionWeights(prev => ({
          ...prev,
          [issueId]: 3
        }));
      }

      // Show "Submitting..." message
      setStatusMessages(prev => ({
        ...prev,
        [issueId]: { type: 'info', text: 'Submitting...' }
      }));

      // Upsert: insert if new, update if the user already voted on this issue.
      // RLS will reject any row where auth.uid() doesn't match user_id.
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error("Not signed in.");

      const { error: upsertErr } = await supabase
        .from("votes")
        .upsert(
          {
            user_id: userId,
            issue_id: issueId,
            vote: votes[issueId],
            passion_weight: passionWeights[issueId] || 3,
            last_updated: new Date().toISOString(),
          },
          { onConflict: "user_id,issue_id" }
        );
      if (upsertErr) throw upsertErr;
      
      // Show success message briefly
      setStatusMessages(prev => ({
        ...prev,
        [issueId]: { type: 'success', text: 'Vote submitted!' }
      }));
      
      // After a short delay, show the overlay
      setTimeout(() => {
        setStatusMessages(prev => {
          const newMessages = { ...prev };
          delete newMessages[issueId];
          return newMessages;
        });
        
        // Activate the overlay for this card
        setActiveOverlays(prev => ({
          ...prev,
          [issueId]: true
        }));
      }, 1000);
      
    } catch (err) {
      console.error("Error submitting vote:", err);
      // Show error message
      setStatusMessages(prev => ({
        ...prev,
        [issueId]: { 
          type: 'error', 
          text: 'Failed to submit: ' + (err.response?.data?.message || err.message)
        }
      }));
      
      // Clear the error after a delay
      setTimeout(() => {
        setStatusMessages(prev => {
          const newMessages = { ...prev };
          delete newMessages[issueId];
          return newMessages;
        });
      }, 5000);
    }
  };

  const getPassionLabel = (weight) => {
    switch (weight) {
      case 1: return "Not strong";
      case 2: return "Slightly strong";
      case 3: return "Moderately strong";
      case 4: return "Quite strong";
      case 5: return "Very strong";
      default: return "Moderately strong";
    }
  };

  // Function to hide an issue
  const hideIssue = (issueId) => {
    setHiddenIssues(prev => ({
      ...prev,
      [issueId]: true
    }));
  };

  // Function to unhide an issue
  const unhideIssue = (issueId) => {
    setHiddenIssues(prev => {
      const newHidden = { ...prev };
      delete newHidden[issueId];
      return newHidden;
    });
  };

  // Function to handle report click
  const handleReport = (issueId) => {
    setReportMessage({
      issueId,
      message: "Report system not set up yet"
    });
    
    // Clear the message after 3 seconds
    setTimeout(() => {
      setReportMessage(null);
    }, 3000);
  };

  // Function to close the overlay
  const closeOverlay = (issueId) => {
    setActiveOverlays(prev => {
      const newOverlays = { ...prev };
      delete newOverlays[issueId];
      return newOverlays;
    });
  };

  // Filter issues based on search term, active tab, and hidden status
  const filteredIssues = issuesList.filter(issue => {
    // Skip hidden issues
    if (hiddenIssues[issue.id]) return false;
    
    const matchesSearch = issue.text.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") {
      return matchesSearch;
    } else if (activeTab === "national") {
      return matchesSearch && issue.scope === "national";
    } else if (activeTab === "state") {
      return matchesSearch && issue.scope === "state";
    } else if (activeTab === "local") {
      return matchesSearch && (issue.scope === "county" || issue.scope === "city");
    }

    return matchesSearch;
  });

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
  };

  if (loading) {
    return (
      <div className="w-full pt-24 flex justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-400">Loading issues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pt-24 px-4 md:px-8 pb-8">
      <h1 className="text-4xl font-bold text-white text-center mb-8">Issue Feed</h1>
      
      {error && (
        <div className="bg-red-900 text-white p-4 rounded-md mb-6 max-w-4xl mx-auto">
          <p>{error}</p>
        </div>
      )}

      {/* Search and filter controls */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="relative mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search issues..."
            className="block w-full pl-4 pr-10 py-3 border border-gray-700 rounded-md bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-white text-lg"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            >
              <span className="text-2xl">×</span>
            </button>
          )}
        </div>
        
        {/* Tab navigation */}
        <div className="flex border-b border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 font-medium ${
              activeTab === "all" 
                ? "text-white border-b-2 border-white" 
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            All Issues
          </button>
          <button
            onClick={() => setActiveTab("national")}
            className={`px-4 py-2 font-medium ${
              activeTab === "national" 
                ? "text-white border-b-2 border-white" 
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            National
          </button>
          <button
            onClick={() => setActiveTab("state")}
            className={`px-4 py-2 font-medium ${
              activeTab === "state"
                ? "text-white border-b-2 border-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Georgia
          </button>
          <button
            onClick={() => setActiveTab("local")}
            className={`px-4 py-2 font-medium ${
              activeTab === "local"
                ? "text-white border-b-2 border-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Local
          </button>
        </div>
      </div>

      {filteredIssues.length === 0 ? (
        <div className="text-center">
          <p className="text-lg text-gray-400">No issues match your search. Try different keywords.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8 max-w-3xl mx-auto">
          {/* Render hidden issue cards */}
          {Object.keys(hiddenIssues).map(hiddenId => {
            const issue = issuesList.find(i => i.id === parseInt(hiddenId));
            if (!issue) return null;

  return (
              <div key={`hidden-${issue.id}`} className="bg-gray-900 border border-gray-700 rounded-lg p-4 relative">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Issue Hidden</span>
                  <button
                    onClick={() => unhideIssue(issue.id)}
                    className="text-blue-400 hover:text-blue-300 underline text-sm"
                  >
                    Undo
                  </button>
                </div>
              </div>
            );
          })}
          
          {/* Render visible issue cards */}
          {filteredIssues.map((issue) => (
            <div key={issue.id} className="bg-black border border-gray-700 rounded-lg p-8 hover:bg-gray-900 transition-colors relative overflow-hidden">
              {/* Close button with tooltip - lower z-index so overlay covers it */}
              <div className="absolute top-4 right-4 group z-10">
                <button
                  onClick={() => hideIssue(issue.id)}
                  className="text-gray-500 hover:text-white transition-colors"
                  aria-label="Hide issue"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="absolute top-full right-0 mt-1 w-20 bg-gray-800 text-xs text-gray-300 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    Hide issue
                  </span>
                </button>
              </div>
              
              {/* Issue content */}
              <div className={`transition-opacity duration-300 ${activeOverlays[issue.id] ? 'opacity-0' : 'opacity-100'}`}>
                {/* Issue text with more space */}
                <h2 className="text-xl font-semibold text-white mb-8 pr-6">{issue.text}</h2>
                
                {/* Restructured layout - vertical instead of grid */}
                <div className="flex flex-col space-y-8">
                  {/* Yes/No buttons with more space */}
                  <div className="flex justify-center space-x-6">
                    <button
                      className={`px-8 py-3 rounded-md text-lg ${
                        votes[issue.id] === true ? "bg-green-600 text-white" : "bg-gray-800 text-gray-300"
                      }`}
                      onClick={() => handleVoteChange(issue.id, true)}
                    >
                      Yes
                    </button>
                    <button
                      className={`px-8 py-3 rounded-md text-lg ${
                        votes[issue.id] === false ? "bg-red-600 text-white" : "bg-gray-800 text-gray-300"
                      }`}
                      onClick={() => handleVoteChange(issue.id, false)}
                    >
                      No
                    </button>
                  </div>
                  
                  {/* Slider below the buttons */}
                  <div className="text-center px-4">
                    <label className="block text-gray-300 mb-4">
                      How strong are your feelings?
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={passionWeights[issue.id] || 3}
                      onChange={(e) => handlePassionChange(issue.id, e.target.value)}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      style={{ accentColor: "#d1d5db" }}
                    />
                    <p className="text-center mt-3 text-gray-400">
                      {getPassionLabel(passionWeights[issue.id])}
                    </p>
                  </div>
                </div>
                
                {/* Submit button with more space */}
                <div className="mt-8 flex justify-center">
                  {statusMessages[issue.id] ? (
                    <div className={`px-10 py-3 rounded-md text-center text-white text-lg ${
                      statusMessages[issue.id].type === 'success' 
                        ? 'bg-green-600' 
                        : statusMessages[issue.id].type === 'error'
                          ? 'bg-red-600'
                          : 'bg-blue-600'
                    }`}>
                      {statusMessages[issue.id].text}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubmit(issue.id)}
                      className="px-10 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition-colors font-bold text-lg"
                    >
                      Submit Vote
                    </button>
                  )}
                </div>
              </div>
              
              {/* Results Overlay - appears after voting */}
              <div 
                className={`absolute inset-0 bg-gradient-to-t from-blue-900 to-black p-8 flex flex-col 
                  transition-transform duration-500 ease-in-out z-20
                  ${activeOverlays[issue.id] ? 'translate-y-0' : 'translate-y-full'}`}
              >
                {/* Close button for overlay */}
                <button 
                  onClick={() => closeOverlay(issue.id)}
                  className="absolute top-4 right-4 text-gray-300 hover:text-white"
                  aria-label="Close overlay"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                
                {/* Vote Submitted Message */}
                <div className="bg-green-600 text-white px-4 py-2 rounded-md mb-4 inline-block self-start">
                  Vote Submitted
                </div>
                
                {/* Issue Header */}
                <h3 className="text-xl font-semibold text-white mb-6">{issue.text}</h3>
                
                <h4 className="text-2xl font-bold text-white mb-6">Vote Impact</h4>
                
                {/* Representatives section */}
                <div className="mb-6">
                  <h5 className="text-lg font-semibold text-blue-300 mb-2">Your Representatives</h5>
                  <div className="bg-black bg-opacity-30 rounded-lg p-4">
                    <p className="text-gray-300">
                      <span className="text-white font-medium">Coming Soon:</span> See how your representatives voted on this issue and how your vote affects your alignment with them.
                    </p>
                  </div>
                </div>
                
                {/* State voting section */}
                <div className="mb-6">
                  <h5 className="text-lg font-semibold text-blue-300 mb-2">Your State</h5>
                  <div className="bg-black bg-opacity-30 rounded-lg p-4">
                    <p className="text-gray-300">
                      <span className="text-white font-medium">Coming Soon:</span> See how other voters in your state feel about this issue.
                    </p>
                  </div>
                </div>
                
                {/* National voting section */}
                <div className="mb-6">
                  <h5 className="text-lg font-semibold text-blue-300 mb-2">National Opinion</h5>
                  <div className="bg-black bg-opacity-30 rounded-lg p-4">
                    <p className="text-gray-300">
                      <span className="text-white font-medium">Coming Soon:</span> See how voters across the country feel about this issue.
                    </p>
                  </div>
                </div>
                
                <div className="mt-auto">
                  <button
                    onClick={() => closeOverlay(issue.id)}
                    className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-bold"
                  >
                    Continue
      </button>
                </div>
              </div>
              
              {/* Bottom card footer with target label and report flag - lower z-index so overlay covers it */}
              <div className="absolute bottom-4 left-0 right-0 px-8 flex justify-between items-center z-10">
                {/* Scope label positioned at bottom left */}
                <span className="text-sm bg-gray-800 text-gray-300 px-3 py-1 rounded">
                  {SCOPE_LABEL[issue.scope] || issue.scope}
                </span>
                
                {/* Report flag at bottom right */}
                <div className="group relative">
                  <button
                    onClick={() => handleReport(issue.id)}
                    className="text-gray-500 hover:text-red-500 transition-colors"
                    aria-label="Report issue"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                    </svg>
                    <span className="absolute top-full right-0 mt-1 w-16 bg-gray-800 text-xs text-gray-300 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      Report
                    </span>
      </button>
                </div>
              </div>
              
              {/* Report message - highest z-index to always be visible */}
              {reportMessage && reportMessage.issueId === issue.id && (
                <div className="absolute bottom-12 right-4 bg-gray-800 text-white text-sm px-3 py-2 rounded shadow-lg z-30">
                  {reportMessage.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}