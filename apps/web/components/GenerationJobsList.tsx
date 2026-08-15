import { useEffect, useState } from "react";

export default function GenerationJobsList({ novelId }: { novelId: string }) {
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/architect/novels/${novelId}/architect/jobs`);
        if (res.ok) {
          const data = await res.json();
          setJobs(data);
        }
      } catch (err) {
        console.error("Failed to fetch jobs", err);
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 3000); // Polling for job updates
    return () => clearInterval(interval);
  }, [novelId]);

  if (jobs.length === 0) {
    return <p>No generation jobs found.</p>;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Generation Jobs</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th style={{ padding: 8 }}>ID</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Type / Stage</th>
            <th style={{ padding: 8 }}>Metrics</th>
            <th style={{ padding: 8 }}>Error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const payload = job.input || {};
            const typeStage = job.stage || job.plannerStage || payload.stage || "Unknown";
            const cost = job.estimatedCostUsd ? `$${job.estimatedCostUsd.toFixed(4)}` : "-";
            const tokens = job.totalTokens ? `${job.totalTokens} tk` : "-";
            const retry = job.retryCount > 0 ? `Retry: ${job.retryCount}` : "";

            return (
              <tr key={job.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{job.id.substring(0, 8)}...</td>
                <td style={{ padding: 8 }}>
                  <span style={{ 
                    padding: "4px 8px", 
                    borderRadius: 4, 
                    backgroundColor: job.status === 'FAILED' ? '#ffebee' : job.status === 'SUCCEEDED' ? '#e8f5e9' : '#e3f2fd',
                    fontWeight: "bold"
                  }}>
                    {job.status}
                  </span>
                </td>
                <td style={{ padding: 8 }}>
                  {typeStage} {job.parentJobId ? `(Parent: ${job.parentJobId.substring(0,6)})` : ""}
                </td>
                <td style={{ padding: 8 }}>
                  {cost} | {tokens} <br/>
                  <span style={{ fontSize: "0.8rem", color: "#666" }}>{retry}</span>
                </td>
                <td style={{ padding: 8, color: "red", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job.error ? job.error.message : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
