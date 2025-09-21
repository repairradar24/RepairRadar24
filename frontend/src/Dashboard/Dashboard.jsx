import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../axiosConfig";
import { Button } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import "./dashboard.css";

export default function Dashboard() {
  const [name, setName] = useState("");
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");
  const userName = sessionStorage.getItem("userName");

  // 🟢 Initial Load
  useEffect(() => {
    if (!token) {
      alert("You are not logged in. Please sign in.");
      navigate("/");
      return;
    }
    if (userName) setName(userName.toUpperCase());

    const fetchInitialData = async () => {
      try {
        const countRes = await api.get("/user/jobs/count", {
          headers: { authorization: `Bearer ${token}` },
        });

        if (countRes.data?.total) {
          setTotalJobs(countRes.data.total);
          if (countRes.data.total > 0) {
            await fetchJobs(0); // fetch first batch
          }
        }
      } catch (err) {
        console.error("Error fetching initial data:", err);
        navigate("/");
      }
    };

    fetchInitialData();
  }, [navigate, token, userName]);

  // 🟢 Fetch jobs with pagination
  const fetchJobs = async (pageNum) => {
    setLoading(true);
    try {
      const res = await api.get(
        `/user/jobs/getjobcards?offset=${pageNum * 20}&limit=20`,
        { headers: { authorization: `Bearer ${token}` } }
      );

      if (res.data && res.data.jobs) {
        if (pageNum === 0) {
          setJobs(res.data.jobs);
        } else {
          setJobs((prev) => [...prev, ...res.data.jobs]);
        }

        setPage(pageNum);
        const totalFetched = (pageNum + 1) * 20;
        setHasMore(totalFetched < totalJobs);
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="dashboard-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="logo">RepairRadar Dashboard</div>
        <div className="nav-links">
          <button onClick={() => navigate("/dashboard")} className="nav-btn">
            Home
          </button>
          <button onClick={handleLogout} className="nav-btn">
            Logout
          </button>
        </div>
      </nav>

      {/* Welcome */}
      <div className="welcome">
        <h2>
          Welcome, <span className="highlight">{name || "User"}</span> 👋
        </h2>
        <p className="job-summary">
          Total Jobs: <b>{totalJobs}</b>
        </p>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlineIcon />}
          className="create-job-btn"
          onClick={() => navigate("/create-job")}
        >
          Create Job Card
        </Button>
      </div>

      {/* Job Cards */}
      <div className="job-cards">
        {jobs.length > 0 ? (
          jobs.map((job) => (
            <div key={job._id} className="job-card">
              <h3>Job #{job.job_no || "-"}</h3>
              <p>
                <b>Customer:</b> {job.customer_name || "-"}
              </p>
              <p>
                <b>Phone:</b> {job.customer_phone || "-"}
              </p>

              {/* Items table */}
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                  </tr>
                </thead>
                <tbody>
                  {job.items && job.items.length > 0 ? (
                    job.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          {item.item_qty > 1
                            ? `${item.item_name} (${item.item_qty})`
                            : item.item_name}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td>-</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <button
                onClick={() => navigate(`/job/${job._id}`)}
                className="view-btn"
              >
                View Details
              </button>
            </div>
          ))
        ) : (
          <p className="no-jobs">No jobs found.</p>
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        {hasMore && !loading && (
          <button onClick={() => fetchJobs(page + 1)} className="load-more-btn">
            Load More
          </button>
        )}
        {loading && <p>Loading...</p>}
      </div>
    </div>
  );
}
