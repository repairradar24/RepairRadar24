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
  const [totalJobs, setTotalJobs] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isPlanExpired, setIsPlanExpired] = useState(false);

  // State for dynamic configuration
  const [statusOptions, setStatusOptions] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  
  // STATE FOR ITEM STATUS COLORS
  const [itemStatusOptions, setItemStatusOptions] = useState([]); 

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
    if (!token) return;

    const fetchConfig = async () => {
      try {
        const res = await retryWithTimeout(
          () =>
            api.get("/user/get-config", {
              headers: { authorization: `Bearer ${token}` },
            }),
          5000 
        );

        if (res.status === 200 && res.data && res.data.schema) {
          const schema = res.data.schema;
          
          // --- Extract Job Card Status (Top Level) ---
          const statusField = schema.find((field) => field.key === "jobcard_status");

          if (statusField && statusField.options) {
            setStatusOptions(statusField.options);
            const defaults = statusField.options
              .filter((opt) => opt.displayByDefault)
              .map((opt) => opt.value);

            setSelectedStatuses(defaults);
          }
          
          // --- Extract Item Status Options (Nested) ---
          const itemSchema = schema.find((field) => field.key === "items");
          if (itemSchema?.fields) {
            const itemStatusField = itemSchema.fields.find((field) => field.key === "item_status");
            if (itemStatusField?.options) {
                setItemStatusOptions(itemStatusField.options);
            }
          }
          // -----------------------------------------------------------

        }
      } catch (err) {
        console.error("Error fetching config (even after retry):", err);
        alert("Timeout loading configuration data. Please check your connection or try again.");
      } finally {
        setIsConfigLoaded(true);
      }
    };

    fetchConfig();
  }, [token]);

  // 2. Fetch Jobs (Data)
  useEffect(() => {
    if (!token) return; 

    const fetchInitialData = async () => {
      try {
        const countRes = await retryWithTimeout(
          () =>
            api.get("/user/jobs/count", {
              headers: { authorization: `Bearer ${token}` },
            }),
          5000 
        );

        if (countRes.data?.total !== undefined) {
          setTotalJobs(countRes.data.total);
          if (countRes.data.total > 0) {
            await fetchJobs(0, token);
          }
        }
      } catch (err) {
        console.error("Error fetching initial data (even after retry):", err);
        alert("Timeout loading job data. The server might be busy. Please refresh the page.");
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
            `/user/jobs/getjobcards?offset=${pageNum * 2000000000}&limit=2000000000`, 
            { headers: { authorization: `Bearer ${currentToken}` } }
          ),
        5000 
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

      {/* --- Filter & Legend Section --- */}
      <div
        className="status-filter-section"
        // Flex container to separate Job Filters (Left) and Item Legend (Right)
        style={{ 
            padding: "0 20px", 
            marginBottom: "15px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px"
        }}
      >
        {/* LEFT: Job Card Status Checkboxes */}
        <div className="job-filters">
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

        {/* RIGHT: Item Status Legend */}
        {itemStatusOptions.length > 0 && (
            <div className="item-status-legend" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <span style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#555" }}>
                    Item Status:
                </span>
                {itemStatusOptions.map((opt) => (
                    <div key={opt.value} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span 
                            style={{
                                display: "block",
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                backgroundColor: opt.color || "#ccc",
                                border: "1px solid #ddd" // Slight border for visibility
                            }}
                        ></span>
                        <span style={{ fontSize: "0.85rem", color: "#333" }}>
                            {opt.value}
                        </span>
                    </div>
                ))}
            </div>
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
                      job.items.map((item, idx) => {
                          const itemStatusConfig = itemStatusOptions.find(
                              (opt) => opt.value === item.item_status
                          );
                          const itemStatusColor = itemStatusConfig?.color || 'transparent'; 
                          
                          // Use FF opacity for solid row background
                          const rowBackgroundColor = itemStatusColor !== 'transparent' ? itemStatusColor + 'FF' : 'transparent'; 
                          
                          // Contrast text logic - User requested black text always
                          const rowTextColor = 'black';

                          return (
                            <tr key={idx} style={{ backgroundColor: rowBackgroundColor, color: rowTextColor }}>
                              <td>
                                  <span>
                                      {item.item_qty > 1
                                          ? `${item.item_name} (${item.item_qty})`
                                          : item.item_name}
                                  </span>
                              </td>
                            </tr>
                          );
                      })
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