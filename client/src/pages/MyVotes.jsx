import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { format } from "date-fns";
import issuesList from "../../../shared/issues.json";

export default function MyVotes() {
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessages, setStatusMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState(""); // New state for search term

  useEffect(() => {
    console.log("MyVotes component mounted");
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from("votes")
        .select("issue_id, vote, passion_weight, last_updated");
      if (fetchErr) throw fetchErr;
      setVotes(data || []);
      setError("");
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch your voting data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVoteChange = (issueId, newVote) => {
    setVotes(prevVotes => 
      prevVotes.map(vote => 
        vote.issue_id === issueId ? { ...vote, vote: newVote } : vote
      )
    );
  };

  const handlePassionChange = (issueId, newPassion) => {
    setVotes(prevVotes => 
      prevVotes.map(vote => 
        vote.issue_id === issueId ? { ...vote, passion_weight: parseInt(newPassion) } : vote
      )
    );
  };

  const handleSubmit = async (issueId) => {
    try {
      const voteToUpdate = votes.find(vote => vote.issue_id === issueId);
      
      if (!voteToUpdate) {
        // Set error message for this specific issue
        setStatusMessages(prev => ({
          ...prev,
          [issueId]: { type: 'error', text: 'Vote not found' }
        }));
        return;
      }

      // Show "Updating..." message
      setStatusMessages(prev => ({
        ...prev,
        [issueId]: { type: 'info', text: 'Updating...' }
      }));

      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error("Not signed in.");

      const nowIso = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("votes")
        .update({
          vote: voteToUpdate.vote,
          passion_weight: voteToUpdate.passion_weight,
          last_updated: nowIso,
        })
        .eq("user_id", userId)
        .eq("issue_id", issueId);
      if (updErr) throw updErr;

      // Reflect the new timestamp locally.
      setVotes(prevVotes =>
        prevVotes.map(vote =>
          vote.issue_id === issueId ? { ...vote, last_updated: nowIso } : vote
        )
      );

      // Alignment score recalculation happens server-side in Phase 3 when the
      // blue-check inference pipeline lands. For now just confirm the vote.
      setStatusMessages(prev => ({
        ...prev,
        [issueId]: { type: 'success', text: 'Vote updated!' }
      }));
      
      // Clear the message after a delay
      setTimeout(() => {
        setStatusMessages(prev => {
          const newMessages = { ...prev };
          delete newMessages[issueId];
          return newMessages;
        });
      }, 3000);
    } catch (err) {
      // Show error message for this specific issue
      setStatusMessages(prev => ({
        ...prev,
        [issueId]: { 
          type: 'error', 
          text: 'Failed to update: ' + (err.response?.data?.message || err.message)
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
      default: return "Unknown";
    }
  };

  // Find issue text by ID using the hardcoded list
  const getIssueText = (issueId) => {
    const issue = issuesList.find(issue => issue.id === parseInt(issueId));
    return issue ? issue.text : `Issue #${issueId}`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "Never updated";
    try {
      return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
    } catch (e) {
      return "Invalid date";
    }
  };

  // Filter votes based on search term
  const filteredVotes = votes.filter(vote => 
    getIssueText(vote.issue_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="w-full pt-16 flex justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-400">Loading your voting history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pt-16 px-4 md:px-8 pb-8">
      <h1 className="text-4xl font-bold text-white text-center mb-8">My Voting History</h1>
      
      {error && (
        <div className="bg-red-900 text-white p-4 rounded-md mb-6 max-w-4xl mx-auto">
          <p>{error}</p>
        </div>
      )}

      {/* Search bar */}
      <div className="max-w-3xl mx-auto mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search issues..."
            className="block w-full pl-4 pr-10 py-3 border border-gray-700 rounded-md bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-white"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            >
              <span className="text-xl">×</span>
            </button>
          )}
        </div>
      </div>

      {votes.length === 0 ? (
        <div className="text-center">
          <p className="text-lg text-gray-400">No voting history found. This is unusual - please contact support.</p>
        </div>
      ) : filteredVotes.length === 0 ? (
        <div className="text-center">
          <p className="text-lg text-gray-400">No issues match your search. Try different keywords.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-3xl mx-auto">
          {filteredVotes.map((vote) => (
            <div key={vote.issue_id} className="bg-black border border-gray-700 rounded-lg p-6 hover:bg-gray-900 transition-colors">
              <h2 className="text-xl font-semibold text-white mb-6 text-center">{getIssueText(vote.issue_id)}</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="text-center">
                  <label className="block text-gray-300 mb-3">Your Vote</label>
                  <div className="flex justify-center space-x-4">
                    <button
                      className={`px-6 py-2 rounded-md ${
                        vote.vote ? "bg-green-600 text-white" : "bg-gray-800 text-gray-300"
                      }`}
                      onClick={() => handleVoteChange(vote.issue_id, true)}
                    >
                      Yes
                    </button>
                    <button
                      className={`px-6 py-2 rounded-md ${
                        !vote.vote ? "bg-red-600 text-white" : "bg-gray-800 text-gray-300"
                      }`}
                      onClick={() => handleVoteChange(vote.issue_id, false)}
                    >
                      No
                    </button>
                  </div>
                </div>
                
                <div className="text-center">
                  <label className="block text-gray-300 mb-3">
                    How strong are your feelings?
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={vote.passion_weight}
                    onChange={(e) => handlePassionChange(vote.issue_id, e.target.value)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: "#d1d5db" }}
                  />
                  <p className="text-center mt-2 text-gray-400">
                    {getPassionLabel(vote.passion_weight)}
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-center">
                {/* Conditional rendering for button or status message */}
                {statusMessages[vote.issue_id] ? (
                  <div className={`px-8 py-3 rounded-md text-center text-white ${
                    statusMessages[vote.issue_id].type === 'success' 
                      ? 'bg-green-600' 
                      : statusMessages[vote.issue_id].type === 'error'
                        ? 'bg-red-600'
                        : 'bg-blue-600'
                  }`}>
                    {statusMessages[vote.issue_id].text}
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubmit(vote.issue_id)}
                    className="px-8 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition-colors font-bold"
                  >
                    Update Vote
                  </button>
                )}
              </div>
              
              {/* Last updated timestamp */}
              <p className="text-xs text-gray-500 text-center mt-3">
                Last updated: {formatDate(vote.last_updated)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 