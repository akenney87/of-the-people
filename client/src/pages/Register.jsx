// File: client/src/pages/Register.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api"; // Use centralized API utility


const initialIssues = [
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


export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    street_address: "",
    city: "",
    state: "NY",
    zip_code: "",
  });
  const [currentIssueIndex, setCurrentIssueIndex] = useState(0);
  const [votes, setVotes] = useState([]);
  const [passion, setPassion] = useState(3);
  const [selectedVote, setSelectedVote] = useState(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); // Add error state for better feedback

  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  const handleUserSubmit = () => {
    if (!userData.email || !userData.password || !userData.confirmPassword || !userData.street_address || !userData.city || !userData.zip_code) {
      setError("All fields are required.");
      return;
    }
    if (userData.password !== userData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(""); // Clear error on valid submission
    setStep(2);
  };

  const handleVote = async () => {
    if (selectedVote === null || loading) return;

    setLoading(true);
    setError(""); // Clear any previous errors
    const issue = initialIssues[currentIssueIndex];

    const newVote = { issue_id: issue.id, vote: selectedVote, passion_weight: passion };
    const updatedVotes = [...votes, newVote];

    setVotes(updatedVotes);
    setSelectedVote(null);
    setPassion(3);

    if (currentIssueIndex < initialIssues.length - 1) {
      setCurrentIssueIndex(currentIssueIndex + 1);
      setLoading(false);
    } else {
      console.log("Final Votes being sent:", updatedVotes);
      await submitRegistration(updatedVotes);
    }
  };

  const goBack = () => {
    if (currentIssueIndex > 0) {
      setCurrentIssueIndex(currentIssueIndex - 1);
      setVotes(votes.slice(0, -1));
      setSelectedVote(null);
    }
  };

  const submitRegistration = async (finalVotes) => {
    try {
      console.log("Submitting registration for:", { ...userData, votes: finalVotes }); // Debug log
      const response = await api.post("/register", { ...userData, votes: finalVotes });

      
      if (response.data.success) {
        console.log("User registered successfully. Verification email sent by backend...");
        setVerificationSent(true);
        setTimeout(() => navigate("/login"), 5000);
      } else {
        console.error("Registration failed:", response.data.message);
        setError("Registration failed: " + response.data.message);
      }
    } catch (error) {
      console.error("Registration failed", error.response?.data?.message || error.message);
      setError("Registration failed: " + (error.response?.data?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      {verificationSent ? (
        <div className="w-full max-w-md p-8 bg-black rounded-lg shadow-lg text-white text-center">
          <h2 className="text-3xl font-bold mb-6">Registration Complete!</h2>
          <p className="mb-6 text-lg">Check your email to verify your account before logging in.</p>
          <button onClick={() => navigate("/login")} className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-800" disabled={loading}>
            Go to Login
          </button>
        </div>
      ) : step === 1 ? (
        <div className="w-full max-w-md p-8 bg-black rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold mb-6 text-center text-white">Register</h2>
          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
          <input type="email" name="email" placeholder="Email" value={userData.email} onChange={handleChange} className="w-full py-2 px-3 mb-4 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          <input type="password" name="password" placeholder="Password" value={userData.password} onChange={handleChange} className="w-full py-2 px-3 mb-4 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          <input type="password" name="confirmPassword" placeholder="Confirm Password" value={userData.confirmPassword} onChange={handleChange} className="w-full py-2 px-3 mb-4 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          <input type="text" name="street_address" placeholder="Street Address" value={userData.street_address} onChange={handleChange} className="w-full py-2 px-3 mb-4 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          <input type="text" name="city" placeholder="City" value={userData.city} onChange={handleChange} className="w-full py-2 px-3 mb-4 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          <select name="state" value={userData.state} onChange={handleChange} className="w-full py-2 px-3 mb-4 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
            <option value="NY">New York</option>
          </select>
          <input type="text" name="zip_code" placeholder="ZIP Code" value={userData.zip_code} onChange={handleChange} className="w-full py-2 px-3 mb-4 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          <button onClick={handleUserSubmit} className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-800" disabled={loading}>
            Next
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md p-8 bg-black rounded-lg shadow-lg text-center text-white">
          <div className="w-full bg-gray-800 rounded-full h-6 mb-6"> {/* Larger progress bar, dark mode */}
            <div className="bg-green-500 h-6 rounded-full" style={{ width: `${((currentIssueIndex + 1) / 10) * 100}%` }}></div>
          </div>
          <h3 className="text-3xl font-bold mb-6">{initialIssues[currentIssueIndex].text}</h3> {/* Larger, bolder text */}
          <div className="mb-6 flex flex-col items-center space-y-4">
            <div className="flex space-x-4">
              <button
                onClick={() => setSelectedVote(true)}
                className={`px-6 py-3 rounded-md text-lg font-medium ${selectedVote === true ? "bg-green-500 text-white" : "bg-gray-800 text-white hover:bg-gray-700"}`}
              >
                Yes
              </button>
              <button
                onClick={() => setSelectedVote(false)}
                className={`px-6 py-3 rounded-md text-lg font-medium ${selectedVote === false ? "bg-red-500 text-white" : "bg-gray-800 text-white hover:bg-gray-700"}`}
              >
                No
              </button>
            </div>
          </div>
          <div className="mb-6">
            <label className="block mb-2 text-lg font-medium">
              How strong are your feelings on this?
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={passion}
              onChange={(e) => setPassion(Number(e.target.value))}
              className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: "#3b82f6" }}
            />
            <p className="text-lg text-center mt-2">
              {passion === 1 && "Not strong"}
              {passion === 2 && "Slightly strong"}
              {passion === 3 && "Moderately strong"}
              {passion === 4 && "Quite strong"}
              {passion === 5 && "Very strong"}
            </p>
          </div>
          {error && <p className="text-red-500 text-lg mb-6">{error}</p>}
          <div className="flex justify-between">
            <button className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-800 text-lg font-medium" onClick={goBack} disabled={loading}>
              Back
            </button>
            <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-800 text-lg font-medium" onClick={handleVote} disabled={loading}>
              {loading ? "Submitting..." : currentIssueIndex === initialIssues.length - 1 ? "Submit" : "Next"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}