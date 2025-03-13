import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api"; // Import the custom API utility instead of axios
import { useLocalStorage } from '../hooks/useLocalStorage';

export default function Representatives() {
  const navigate = useNavigate();
  const [representatives, setRepresentatives] = useLocalStorage('representatives', []);
  const [alignmentScores, setAlignmentScores] = useLocalStorage('alignmentScores', {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Use a ref instead of state to track if we've fetched data
  const dataFetchedRef = useRef(false);

  // Use useCallback to memoize the function
  const fetchAlignmentScores = useCallback(async (reps) => {
    try {
      const scores = {};
      for (const rep of reps) {
        const response = await api.get(`/representatives/${rep.id}/alignment`);
        scores[rep.id] = response.data.alignment_score || "N/A";
      }
      setAlignmentScores(scores);
    } catch (err) {
      console.error("Error fetching alignment scores:", err.response?.data || err);
    }
  }, [setAlignmentScores]);

  useEffect(() => {
    const fetchData = async () => {
      // Only fetch if we haven't fetched before
      if (!dataFetchedRef.current) {
        try {
          const response = await api.get("/representatives");
          console.log("Representatives data:", response.data); // Debug log
          setRepresentatives(response.data);
          fetchAlignmentScores(response.data);
          dataFetchedRef.current = true;
        } catch (err) {
          setError("Failed to fetch representatives: " + (err.response?.data?.message || err.message));
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchData();
  }, [fetchAlignmentScores, setRepresentatives]);

  const formatName = (name) => {
    if (!name) return "";
    const [surname, firstname] = name.split(", ").map(part => part.trim());
    return firstname ? `${firstname} ${surname}` : name;
  };

  // Function to determine jurisdiction text
  const getJurisdiction = (rep) => {
    // State name mapping
    const stateNames = {
      "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
      "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
      "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
      "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
      "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
      "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
      "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
      "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
      "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
      "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
      "DC": "District of Columbia", "AS": "American Samoa", "GU": "Guam", "MP": "Northern Mariana Islands",
      "PR": "Puerto Rico", "VI": "U.S. Virgin Islands"
    };
    
    // Get full state name
    const stateName = stateNames[rep.state] || rep.state;
    
    // County officials
    if (rep.county) {
      return `${rep.county} County, ${stateName}`;
    }
    
    // Statewide positions
    const statewidePositions = [
      "U.S. Senator", 
      "Governor", 
      "Attorney General", 
      "Comptroller", 
      "Chief of Elections"
    ];
    
    if (statewidePositions.includes(rep.position)) {
      return stateName;
    }
    
    // District-specific positions
    if (rep.position === "U.S. Representative" && rep.cong_district) {
      return `${stateName} Congressional District ${rep.cong_district}`;
    }
    
    if (rep.position === "State Senator" && rep.state_senate_district) {
      return `${stateName} Senate District ${rep.state_senate_district}`;
    }
    
    if (rep.position === "Assembly Member" && rep.state_assembly_district) {
      return `${stateName} Assembly District ${rep.state_assembly_district}`;
    }
    
    // Fallback if no district information is available
    return stateName;
  };

  const sortedRepresentatives = [...representatives].sort((a, b) => {
    const order = {
      "U.S. Senator": 1,
      "U.S. Representative": 2,
      "Governor": 3,
      "Attorney General": 4,
      "Comptroller": 5,
      "Chief of Elections": 6,
      "State Senator": 7,
      "Assembly Member": 8,
      // County positions
      "County Executive": 9,
      "Borough President": 9, // Same level as County Executive
      "County Administrator": 9, // Same level as County Executive
      "County Manager": 9, // Same level as County Executive
      "County Clerk": 10,
      "District Attorney": 11,
      "County Sheriff": 12,
      "County Treasurer": 13,
      "Commissioner of Finance": 13, // Same level as Treasurer
      "County Comptroller": 14,
      "County Legislator": 15
    };
    
    // If position isn't in our order object, place it at the end
    // County positions not explicitly listed will be sorted after the ones that are
    const orderA = a.position.startsWith("County") ? (order[a.position] || 900) : (order[a.position] || 999);
    const orderB = b.position.startsWith("County") ? (order[b.position] || 900) : (order[b.position] || 999);
    
    return orderA - orderB;
  });

  return (
    <div className="w-full space-y-8 pt-16">
      <h1 className="text-4xl font-bold text-white text-center">My Representatives</h1>

      {loading ? (
        <div className="text-center">
          <p className="text-lg text-gray-400">Loading...</p>
        </div>
      ) : error ? (
        <div className="text-center">
          <p className="text-red-400 text-lg">{error}</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {sortedRepresentatives.length === 0 ? (
            <p className="text-gray-400 text-lg text-center">
              No representatives found for your location.
            </p>
          ) : (
            <ul className="space-y-6">
              {sortedRepresentatives.map((rep) => (
                <li
                  key={rep.id}
                  className="bg-black border border-gray-700 rounded-lg p-6 hover:bg-hover-dark transition-colors duration-200 cursor-pointer"
                  onClick={() => navigate(`/representatives/${rep.id}`)}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="space-y-3">
                      <h2 className="text-xl font-semibold text-white">
                        {formatName(rep.name)}
                      </h2>
                      <p className="text-gray-300">{rep.position}</p>
                      <p className="text-gray-400">
                        {getJurisdiction(rep)}
                      </p>
                    </div>
                    <div className="flex flex-col justify-between items-end gap-4">
                      <span className="text-blue-400 hover:text-blue-300 text-sm underline">
                        View Details
                      </span>
                      {alignmentScores[rep.id] && (
                        <p className="text-lg font-medium text-white">
                          Alignment Score: {alignmentScores[rep.id]}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}