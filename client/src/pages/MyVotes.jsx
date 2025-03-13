import { useState, useEffect } from "react";
import api from "../api";
import { format } from "date-fns"; // Import date-fns for formatting dates

// Define the issues directly in the component for now - same list as in Dashboard.jsx
const issuesList = [
  // National issues
  { id: 101, text: "Should parents be allowed to use public funds (vouchers) to send their children to private schools?", target: "National" },
  { id: 102, text: "Should public colleges and universities be free for in-state residents?", target: "National" },
  { id: 103, text: "Should the government impose more regulations on large tech companies to prevent monopolies?", target: "National" },
  { id: 104, text: "Should the United States reduce foreign military interventions and focus on domestic issues?", target: "National" },
  { id: 105, text: "Should the government regulate the use of facial recognition technology by law enforcement?", target: "National" },
  { id: 106, text: "Should GMOs be more strictly regulated or banned in consumer food products?", target: "National" },
  { id: 107, text: "Should the U.S. enact stricter environmental rules, even if they slow some economic growth?", target: "National" },
  { id: 108, text: "Should health insurance companies be required to cover pre-existing conditions?", target: "National" },
  { id: 109, text: "Should the federal voting age be lowered to 16?", target: "National" },
  { id: 110, text: "Should children be required to show proof of vaccination to attend public schools?", target: "National" },
  { id: 111, text: "Should local or state governments be allowed to pass laws that differ significantly from federal policy on major issues?", target: "National" },
  { id: 112, text: "Should transgender athletes be allowed to join teams matching their gender identity at all levels?", target: "National" },
  { id: 113, text: "Should parents be allowed to refuse certain medical treatments for their children on religious grounds?", target: "National" },
  { id: 114, text: "Should hate speech be protected under free speech laws?", target: "National" },
  { id: 115, text: "Should local school boards be allowed to remove books from school libraries based on content?", target: "National" },
  { id: 116, text: "Should there be a federal ban on \"conversion therapy\" for minors?", target: "National" },
  { id: 117, text: "Should minors have access to gender-affirming healthcare without parental consent?", target: "National" },
  { id: 118, text: "Should universal childcare be provided by the federal government?", target: "National" },
  { id: 119, text: "Should public schools teach comprehensive sex education, including contraception and LGBTQ+ topics?", target: "National" },
  { id: 120, text: "Should the legal drinking age be lowered from 21 to 18?", target: "National" },
  { id: 121, text: "Should parents be allowed to homeschool their children without meeting state education standards?", target: "National" },
  { id: 122, text: "Should publicly funded adoption agencies be allowed to turn away prospective parents based on religious beliefs?", target: "National" },
  { id: 123, text: "Should businesses be allowed to refuse service to same-sex couples on religious grounds?", target: "National" },
  { id: 124, text: "Should the U.S. legalize physician-assisted suicide for terminally ill patients who consent?", target: "National" },
  { id: 125, text: "Should the government enforce stronger rules against \"offensive\" content on social media, beyond current laws?", target: "National" },
  { id: 126, text: "Should people be allowed to use certain psychedelics (like psilocybin) for therapy under medical supervision?", target: "National" },
  { id: 127, text: "Should police departments be required to reflect the demographics of the communities they serve?", target: "National" },
  { id: 128, text: "Should there be nationwide rent control to address housing affordability?", target: "National" },
  
  // New York issues
  { id: 201, text: "Should New York State keep its current bail reform laws?", target: "New York" },
  { id: 202, text: "Should undocumented immigrants in New York State be eligible for driver's licenses?", target: "New York" },
  { id: 203, text: "Should New York State adopt a single-payer healthcare system, independent of federal policy?", target: "New York" },
  { id: 204, text: "Should all New York State landlords follow the same rent stabilization rules as in New York City?", target: "New York" },
  { id: 205, text: "Should New York State fully ban fracking and new natural gas pipelines?", target: "New York" },
  { id: 206, text: "Should New York City eliminate its gifted and talented programs in public schools to promote equity?", target: "New York" },
  { id: 207, text: "Should New York State invest public funds to create safe injection sites for drug users?", target: "New York" },
  { id: 208, text: "Should New York State limit annual property tax increases for homeowners?", target: "New York" },
  { id: 209, text: "Should the MTA receive more New York State funding, even if that means higher taxes or fares?", target: "New York" },
  { id: 210, text: "Should New York State impose congestion pricing in Manhattan below 60th Street?", target: "New York" },
  { id: 211, text: "Should New York State require new housing projects to include affordable units?", target: "New York" },
  { id: 212, text: "Should New York State impose stricter rules on short-term rentals (like Airbnb) to help address the housing shortage?", target: "New York" },
  { id: 213, text: "Should local governments in New York State be able to opt out of legal cannabis?", target: "New York" },
  { id: 214, text: "Should New York State ban the sale of all flavored tobacco and vaping products?", target: "New York" },
  { id: 215, text: "Should New York State make all SUNY and CUNY schools tuition-free for in-state residents?", target: "New York" },
  { id: 216, text: "Should the New York State constitution explicitly protect abortion rights?", target: "New York" },
  { id: 217, text: "Should teacher salaries in New York State be funded mainly by the state to reduce disparities among districts?", target: "New York" },
  { id: 218, text: "Should New York State raise taxes on high earners to fund social programs like healthcare and housing?", target: "New York" },
  { id: 219, text: "Should New York State invest in a public broadband network to guarantee high-speed internet for all residents?", target: "New York" },
  { id: 220, text: "Should solitary confinement be completely banned in New York State prisons and jails?", target: "New York" },
  
  // Original issues (1-10)
  { id: 1, text: "Should the federal government set tighter limits on corporate campaign donations?" },
  { id: 2, text: "Should the government provide a universal basic income for all citizens?" },
  { id: 3, text: "Should there be universal background checks for all firearm purchases nationwide?" },
  { id: 4, text: "Should the death penalty be abolished?" },
  { id: 5, text: "Should there be a federally mandated paid family leave policy?" },
  { id: 6, text: "Should members of Congress have term limits?" },
  { id: 7, text: "Should the government prioritize renewable energy over fossil fuels?" },
  { id: 8, text: "Should same-sex marriage be protected by federal law?" },
  { id: 9, text: "Should there be a national ban on gerrymandering?" },
  { id: 10, text: "Should children of undocumented immigrants born and raised in the U.S. have a guaranteed path to citizenship?" },
];

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
      console.log("Fetching user votes...");
      
      // Fetch user votes
      const votesResponse = await api.get("/user/votes");
      console.log("Votes response:", votesResponse.data);
      setVotes(votesResponse.data);
      
      setError("");
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch your voting data: " + (err.response?.data?.message || err.message));
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

      await api.put(`/user/votes/${issueId}`, {
        vote: voteToUpdate.vote,
        passion_weight: voteToUpdate.passion_weight
      });
      
      // Update the last_updated timestamp in the local state
      setVotes(prevVotes => 
        prevVotes.map(vote => 
          vote.issue_id === issueId ? { 
            ...vote, 
            last_updated: new Date().toISOString() 
          } : vote
        )
      );
      
      // Show success message for this specific issue
      setStatusMessages(prev => ({
        ...prev,
        [issueId]: { type: 'success', text: 'Recalculating scores...' }
      }));
      
      // Trigger alignment score recalculation
      await api.post("/user/recalculate-alignment");
      
      // Update success message
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