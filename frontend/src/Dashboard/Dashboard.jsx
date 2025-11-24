import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../axiosConfig";
import {
  Button,
  TextField,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  FormGroup,
  CircularProgress
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import Navbar from "../Navbar/Navbar";
import "./dashboard.css";

// Helper function to recursively search for a word in an object
const deepSearch = (obj, word) => {
  for (const key in obj) {
    const value = obj[key];
    if (value === null || value === undefined) continue;

    if (typeof value === "object") {
      if (deepSearch(value, word)) return true;
    } else {
      if (String(value).toLowerCase().includes(word)) {
        return true;
      }
    }
  }
  return false;
};

// ✅ Generic retry helper: retry on 401 until success or timeout
const retryWithTimeout = async (fn, timeoutMs = 5000, intervalMs = 300) => {
  const start = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Try the actual call
      const result = await fn();
      return result; // success → exit
    } catch (err) {
      const status = err?.response?.status;

      // If it's NOT 401 or we've crossed timeout, rethrow and stop retrying
      const elapsed = Date.now() - start;
      if (status !== 401 || elapsed >= timeoutMs) {
        throw err;
      }

      // Otherwise, wait a bit and retry
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
};

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0); // Still needed for pagination logic
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isPlanExpired, setIsPlanExpired] = useState(false);

  // State for dynamic configuration
  const [statusOptions, setStatusOptions] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Token as state (so effects can wait for it)
  const [token, setToken] = useState(null);

  const navigate = useNavigate();

  // 0. Read token & plan info from sessionStorage once on mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem("token");
    const hasPlanExpired = sessionStorage.getItem("isPlanExpired") === "true";

    if (!storedToken) {
      alert("You are not logged in. Please sign in.");
      navigate("/");
      return;
    }

    setToken(storedToken);
    setIsPlanExpired(hasPlanExpired);
  }, [navigate]);

  // 1. Fetch User Configuration (Schema)
  useEffect(() => {
    if (!token) return; // wait until token is available

    const fetchConfig = async () => {
      try {
        const res = await retryWithTimeout(
          () =>
            api.get("/user/get-config", {
              headers: { authorization: `Bearer ${token}` },
            }),
          5000 // 5 seconds timeout window
        );

        if (res.status === 200 && res.data && res.data.schema) {
          // Find the 'jobcard_status' field in the schema
          const statusField = res.data.schema.find(
            (field) => field.key === "jobcard_status"
          );

          if (statusField && statusField.options) {
            setStatusOptions(statusField.options);

            // Set default selected checkboxes based on schema
            const defaults = statusField.options
              .filter((opt) => opt.displayByDefault)
              .map((opt) => opt.value);

            setSelectedStatuses(defaults);
          }
        }
      } catch (err) {
        console.error("Error fetching config (even after retry):", err);
      } finally {
        setIsConfigLoaded(true);
      }
    };

    fetchConfig();
  }, [token]);

  // 2. Fetch Jobs (Data)
  useEffect(() => {
    if (!token) return; // don't call APIs until token is set

    const fetchInitialData = async () => {
      try {
        const countRes = await retryWithTimeout(
          () =>
            api.get("/user/jobs/count", {
              headers: { authorization: `Bearer ${token}` },
            }),
          5000 // 5s retry window
        );

        if (countRes.data?.total !== undefined) {
          setTotalJobs(countRes.data.total);
          if (countRes.data.total > 0) {
            await fetchJobs(0, token);
          }
        }
      } catch (err) {
        console.error("Error fetching initial data (even after retry):", err);
        // If after retries it's still failing, you can choose to navigate out:
        // navigate("/");
      }
    };

    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchJobs = async (pageNum, currentToken = token) => {
    if (!currentToken) return;

    setLoading(true);
    try {
      const res = await retryWithTimeout(
        () =>
          api.get(
            `/user/jobs/getjobcards?offset=${pageNum * 20}&limit=20`,
            { headers: { authorization: `Bearer ${currentToken}` } }
          ),
        5000 // retry for this request as well
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
      console.error("Error fetching jobs (even after retry):", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle checkbox toggle
  const handleStatusChange = (value) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const filteredJobs = useMemo(() => {
    if (!isConfigLoaded) return [];

    // 1. First filter by Job Status (Checkboxes)
    let result = jobs.filter((job) =>
      selectedStatuses.includes(job.jobcard_status)
    );

    // 2. Then filter by Search Term (if exists)
    if (searchTerm) {
      const searchWords = searchTerm
        .toLowerCase()
        .split(" ")
        .filter((word) => word.length > 0);

      result = result.filter((job) => {
        return searchWords.some((word) => deepSearch(job, word));
      });
    }

    return result;
  }, [searchTerm, jobs, selectedStatuses, isConfigLoaded]);

  return (
    <div className="dashboard-container">
      <Navbar />

      <div className="job-summary-section">
        {/* Showing filteredJobs.length instead of totalJobs */}
        <p className="job-summary">
          Displayed Jobs: <b>{filteredJobs.length}</b>
        </p>

        <TextField
          label="Search Job Cards"
          variant="outlined"
          size="small"
          className="dashboard-search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />

        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlineIcon />}
          className="create-job-btn"
          onClick={() => navigate("/create-job")}
          disabled={isPlanExpired}
        >
          Create Job Card
        </Button>
      </div>

      {/* --- Dynamic Status Filter Section --- */}
      <div
        className="status-filter-section"
        style={{ padding: "0 20px", marginBottom: "15px" }}
      >
        {!isConfigLoaded ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CircularProgress size={20} /> <small>Loading filters...</small>
          </div>
        ) : (
          <FormGroup row>
            {statusOptions.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={selectedStatuses.includes(option.value)}
                    onChange={() => handleStatusChange(option.value)}
                    sx={{
                      color: option.color || "#1976d2",
                      "&.Mui-checked": {
                        color: option.color || "#1976d2",
                      },
                    }}
                  />
                }
                label={option.value}
              />
            ))}
          </FormGroup>
        )}
      </div>

      <div className="job-cards">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => {
            const statusConfig = statusOptions.find(
              (o) => o.value === job.jobcard_status
            );
            const statusColor = statusConfig?.color || "#ccc";

            return (
              <div
                key={job._id}
                className="job-card"
                style={{ borderLeft: `5px solid ${statusColor}` }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3>Job #{job.job_no || "-"}</h3>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: statusColor,
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                    }}
                  >
                    {job.jobcard_status}
                  </span>
                </div>

                <p>
                  <b>Customer:</b> {job.customer_name || "-"}
                </p>
                <p>
                  <b>Phone:</b> {job.customer_phone || "-"}
                </p>

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
                  onClick={() => navigate(`/jobs/${job._id}`)}
                  className="view-btn"
                >
                  View Details
                </button>
              </div>
            );
          })
        ) : (
          <p className="no-jobs">
            {jobs.length === 0 && !loading
              ? "No jobs found."
              : "No jobs match your search or selected filters."}
          </p>
        )}
      </div>

      <div className="pagination">
        {/* Pagination button logic remains based on totalJobs vs loaded jobs */}
        {hasMore && !loading && !searchTerm && (
          <button onClick={() => fetchJobs(page + 1)} className="load-more-btn">
            Load More
          </button>
        )}
        {loading && <p>Loading...</p>}
      </div>
    </div>
  );
}
