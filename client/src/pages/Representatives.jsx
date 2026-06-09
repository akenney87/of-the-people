import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLocalStorage } from '../hooks/useLocalStorage';

export default function Representatives() {
  const navigate = useNavigate();
  const [representatives, setRepresentatives] = useLocalStorage('representatives', []);
  const [alignmentScores, setAlignmentScores] = useLocalStorage('alignmentScores', {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dataFetchedRef = useRef(false);

  const fetchAlignmentScores = useCallback(async (reps) => {
    const scores = {};
    for (const rep of reps) {
      const { data, error: rpcErr } = await supabase.rpc("get_my_alignment", { p_rep_id: rep.id });
      if (rpcErr) {
        console.error("alignment rpc error", rep.id, rpcErr);
        scores[rep.id] = "N/A";
      } else {
        scores[rep.id] = data == null ? "N/A" : `${data}%`;
      }
    }
    setAlignmentScores(scores);
  }, [setAlignmentScores]);

  useEffect(() => {
    const fetchData = async () => {
      if (dataFetchedRef.current) { setLoading(false); return; }
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_my_representatives");
        if (rpcErr) throw rpcErr;
        setRepresentatives(data || []);
        fetchAlignmentScores(data || []);
        dataFetchedRef.current = true;
      } catch (err) {
        setError("Failed to fetch representatives: " + err.message);
      } finally {
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
    
    // City positions — render as "City, State"
    if (rep.city && (rep.position === "Mayor" || rep.position.startsWith("City Council"))) {
      return `${rep.city}, ${stateName}`;
    }

    // Statewide positions
    const statewidePositions = [
      "U.S. Senator",
      "Governor",
      "Lieutenant Governor",
      "Attorney General",
      "Secretary of State",
      "State Auditor",
      "Comptroller",
      "Chief of Elections",
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

    if ((rep.position === "State Representative" || rep.position === "Assembly Member")
        && rep.state_assembly_district) {
      const label = rep.position === "State Representative" ? "House" : "Assembly";
      return `${stateName} ${label} District ${rep.state_assembly_district}`;
    }

    // Fallback if no district information is available
    return stateName;
  };

  const sortedRepresentatives = [...representatives].sort((a, b) => {
    const order = {
      // Federal
      "U.S. Senator": 1,
      "U.S. Representative": 2,
      // State executive
      "Governor": 10,
      "Lieutenant Governor": 11,
      "Attorney General": 12,
      "Secretary of State": 13,
      "State Auditor": 14,
      "Chief of Elections": 14,
      "Comptroller": 14,
      // State legislative
      "State Senator": 20,
      "State Representative": 21,
      "Assembly Member": 21,
      // County (positions starting with "County" or matching legacy names also
      // fall here via the .startsWith bucket below)
      "County Commission Chair": 30,
      "County Executive": 30,
      "Borough President": 30,
      "County Administrator": 30,
      "County Manager": 30,
      "County Clerk": 31,
      "District Attorney": 32,
      "County Sheriff": 33,
      "County Tax Commissioner": 34,
      "County Treasurer": 34,
      "Commissioner of Finance": 34,
      "County Comptroller": 35,
      "Probate Judge": 36,
      "County Legislator": 37,
      // City
      "Mayor": 40,
    };

    const bucket = (pos) => {
      if (pos in order) return order[pos];
      if (pos.startsWith("City Council")) return 41;
      if (pos.startsWith("County Commissioner")) return 30.5;
      if (pos.startsWith("County")) return 38;
      if (pos.startsWith("City")) return 42;
      return 999;
    };

    return bucket(a.position) - bucket(b.position);
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