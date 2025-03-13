import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api"; // Import the custom API utility

export default function RepresentativeDetails() {
  const { id } = useParams();
  const [representative, setRepresentative] = useState(null);
  const [alignmentScore, setAlignmentScore] = useState(null);
  const [loading, setLoading] = useState(true); // Added loading state
  const [error, setError] = useState(""); // Added error state

  useEffect(() => {
    const fetchRepresentative = async () => {
      try {
        const response = await api.get(`/representatives/${id}`); // Use api.js, no manual headers
        console.log("Representative Data:", response.data); // Debug log
        setRepresentative(response.data);
      } catch (error) {
        console.error("Failed to fetch representative details:", error.response?.data || error);
        setError("Failed to fetch representative details.");
      }
    };

    const fetchAlignment = async () => {
      try {
        const response = await api.get(`/representatives/${id}/alignment`); // Use api.js
        console.log("Alignment Data:", response.data); // Debug log
        setAlignmentScore(response.data.alignment_score || "No Data");
      } catch (error) {
        console.error("Failed to fetch alignment score:", error.response?.data || error);
        setAlignmentScore("Error");
      }
    };

    const fetchData = async () => {
      setLoading(true);
      setError("");
      await Promise.all([fetchRepresentative(), fetchAlignment()]);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  if (loading) return <p className="text-center p-4">Loading...</p>;
  if (error) return <p className="text-center p-4 text-red-500">{error}</p>;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-6 bg-white rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold">{representative.name}</h2>
        <p><strong>Position:</strong> {representative.position}</p>
        <p><strong>Email:</strong> {representative.email || "Not available"}</p>
        <p><strong>Alignment Score:</strong> {alignmentScore}</p>
      </div>
    </div>
  );
}