import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../axiosConfig";
import { Button } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import "./dashboard.css"; // ✅ import CSS file

export default function Dashboard() {
  const [name, setName] = useState("");
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const token = sessionStorage.getItem("token");
  const userName = sessionStorage.getItem("userName");

  // ✅ Fetch user + jobs
  useEffect(() => {
    if (!token) {
      alert("You are not logged in. Please sign in.");
      navigate("/");
      return;
    }
    if (userName) {
      setName(userName.toUpperCase());
    }

    // Fetch user profile
      api
        .get("user/jobs/count", {
          headers: { authorization: `Bearer ${token}` },
        })
        .then((res) => {
          if (res.data)
            alert(`You have ${res.data.total} jobs in total.`);
        })
        .catch(() => navigate("/"));

      // First page jobs
      fetchJobs(1);
    }, [navigate]);

  const fetchJobs = async (pageNum) => {
    // setLoading(true);
    // try {
    //   const res = await api.get(`/user/jobs?page=${pageNum}&limit=6`, {
    //     headers: { authorization: `Bearer ${token}` },
    //   });

    //   if (res.data && res.data.jobs) {
    //     if (pageNum === 1) {
    //       setJobs(res.data.jobs);
    //     } else {
    //       setJobs((prev) => [...prev, ...res.data.jobs]);
    //     }
    //     setHasMore(res.data.hasMore);
    //     setPage(pageNum);
    //   }
    // } catch (err) {
    //   console.error("Error fetching jobs:", err);
    // } finally {
    //   setLoading(false);
    // }
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
              <h3 className="job-title">{job.job_no || "Job #"}</h3>
              <p>
                <b>Status:</b> {job.jobcard_status}
              </p>
              <p>
                <b>Date:</b>{" "}
                {job.date ? new Date(job.date).toLocaleDateString() : "-"}
              </p>
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
          <button
            onClick={() => fetchJobs(page + 1)}
            className="load-more-btn"
          >
            Load More
          </button>
        )}
        {loading && <p>Loading...</p>}
      </div>
    </div>
  );
}
