import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function RepresentativeDetails() {
  const { id } = useParams();
  const [representative, setRepresentative] = useState(null);
  const [alignmentScore, setAlignmentScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError("");

      const [repRes, alignRes] = await Promise.all([
        supabase.from("representatives").select("*").eq("id", id).maybeSingle(),
        supabase.rpc("get_my_alignment", { p_rep_id: Number(id) }),
      ]);

      if (cancelled) return;

      if (repRes.error || !repRes.data) {
        setError("Failed to fetch representative details.");
        setLoading(false);
        return;
      }
      setRepresentative(repRes.data);

      if (alignRes.error || alignRes.data == null) {
        setAlignmentScore("No Data");
      } else {
        setAlignmentScore(`${alignRes.data}%`);
      }
      setLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
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
