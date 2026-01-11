import React, { useEffect, useState, useMemo, useCallback } from "react";
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

// --- CONSTANTS ---
const CACHE_KEY_JOBS = "dashboard_jobs_cache";
const CACHE_KEY_CONFIG = "dashboard_config_cache";

// Helper function for search
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

// Generic retry helper
const retryWithTimeout = async (fn, timeoutMs = 5000, intervalMs = 300) => {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await fn();
      return result; 
    } catch (err) {
      const status = err?.response?.status;
      const elapsed = Date.now() - start;
      if (status !== 401 || elapsed >= timeoutMs) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
};

const formatDate = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // Loading States
  const [loading, setLoading] = useState(false); 
  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
  const [isPlanExpired, setIsPlanExpired] = useState(false);

  // Configuration State
  const [statusOptions, setStatusOptions] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [itemStatusOptions, setItemStatusOptions] = useState([]);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const [token, setToken] = useState(null);
  const navigate = useNavigate();

  // --- HELPER: Parse Schema ---
  const processConfigSchema = useCallback((schema) => {
    let parsedStatusOptions = [];
    let parsedDefaultStatuses = [];
    let parsedItemStatusOptions = [];

    // 1. Job Card Status
    const statusField = schema.find((field) => field.key === "jobcard_status");
    if (statusField && statusField.options) {
      parsedStatusOptions = statusField.options;
      parsedDefaultStatuses = statusField.options
        .filter((opt) => opt.displayByDefault)
        .map((opt) => opt.value);
    }

    // 2. Item Status
    const itemSchema = schema.find((field) => field.key === "items");
    if (itemSchema?.fields) {
      const itemStatusField = itemSchema.fields.find((field) => field.key === "item_status");
      if (itemStatusField?.options) {
        parsedItemStatusOptions = itemStatusField.options;
      }
    }

    return { parsedStatusOptions, parsedDefaultStatuses, parsedItemStatusOptions };
  }, []);

  // 1. Initial Mount: Token Check & Cache Validation
  useEffect(() => {
    const currentSessionToken = sessionStorage.getItem("token");
    const hasPlanExpired = sessionStorage.getItem("isPlanExpired") === "true";

    if (!currentSessionToken) {
      // No token in session? Clear any lingering cache to be safe
      localStorage.removeItem(CACHE_KEY_JOBS);
      localStorage.removeItem(CACHE_KEY_CONFIG);
      localStorage.clear();
      alert("You are not logged in. Please sign in.");
      navigate("/");
      return;
    }

    setToken(currentSessionToken);
    setIsPlanExpired(hasPlanExpired);

    // --- CACHE VALIDATION LOGIC ---
    let validCacheFound = false;

    // A. Validate Jobs Cache
    const cachedJobsStr = localStorage.getItem(CACHE_KEY_JOBS);
    if (cachedJobsStr) {
      try {
        const cachedWrapper = JSON.parse(cachedJobsStr);
        
        // CHECK: Does the token inside the cache match the current session token?
        if (cachedWrapper.token === currentSessionToken && Array.isArray(cachedWrapper.data)) {
          console.log("Cache Hit: Token matches. Loading data.");
          setJobs(cachedWrapper.data);
          setTotalJobs(cachedWrapper.data.length); // Temporary total until sync
          validCacheFound = true;
        } else {
          // console.log("Cache Miss: Token mismatch. Clearing jobs cache.");
          localStorage.removeItem(CACHE_KEY_JOBS);
        }
      } catch (e) {
        console.error("Error parsing jobs cache", e);
        localStorage.removeItem(CACHE_KEY_JOBS);
      }
    }

    // B. Validate Config Cache
    const cachedConfigStr = localStorage.getItem(CACHE_KEY_CONFIG);
    if (cachedConfigStr) {
      try {
        const cachedWrapper = JSON.parse(cachedConfigStr);

        // CHECK: Does the token match?
        if (cachedWrapper.token === currentSessionToken && cachedWrapper.data) {
          const { parsedStatusOptions, parsedDefaultStatuses, parsedItemStatusOptions } = processConfigSchema(cachedWrapper.data);
          setStatusOptions(parsedStatusOptions);
          setSelectedStatuses(parsedDefaultStatuses);
          setItemStatusOptions(parsedItemStatusOptions);
          setIsConfigLoaded(true);
        } else {
          // console.log("Config Cache Miss: Token mismatch. Clearing config cache.");
          localStorage.removeItem(CACHE_KEY_CONFIG);
        }
      } catch (e) {
        console.error("Error parsing config cache", e);
        localStorage.removeItem(CACHE_KEY_CONFIG);
      }
    }
    // -----------------------------

  }, [navigate, processConfigSchema]);

  // 2. Network Sync (Config & Data)
  useEffect(() => {
    if (!token) return;

    const syncData = async () => {
      // Determine if we are loading from scratch or syncing in background
      // We check actual state (jobs.length) because the previous effect handles the cache loading
      const isHydrated = jobs.length > 0 && isConfigLoaded;
      
      if (isHydrated) {
        setIsBackgroundUpdating(true);
      } else {
        setLoading(true);
      }

      try {
        // A. Fetch Config
        await fetchConfig(token);
        
        // B. Fetch Job Count & Initial Jobs
        const countRes = await retryWithTimeout(
          () => api.get("/user/jobs/count", { headers: { authorization: `Bearer ${token}` } }),
          5000
        );

        if (countRes.data?.total !== undefined) {
          setTotalJobs(countRes.data.total);
          if (countRes.data.total > 0) {
            await fetchJobs(0, token);
          }
        }
      } catch (err) {
        console.error("Error during sync:", err);
        if (!isHydrated) alert("Error loading data. Please check connection.");
      } finally {
        setLoading(false);
        setIsBackgroundUpdating(false);
      }
    };

    syncData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchConfig = async (currentToken) => {
    try {
      const res = await retryWithTimeout(
        () => api.get("/user/get-config", { headers: { authorization: `Bearer ${currentToken}` } }),
        5000
      );

      if (res.status === 200 && res.data && res.data.schema) {
        const schema = res.data.schema;
        
        // Update State
        const { parsedStatusOptions, parsedDefaultStatuses, parsedItemStatusOptions } = processConfigSchema(schema);
        setStatusOptions(parsedStatusOptions);
        setItemStatusOptions(parsedItemStatusOptions);
        
        if (selectedStatuses.length === 0) {
            setSelectedStatuses(parsedDefaultStatuses);
        }
        setIsConfigLoaded(true);

        // --- UPDATE CACHE (With Token) ---
        localStorage.setItem(CACHE_KEY_CONFIG, JSON.stringify({
          token: currentToken, // Save token with data
          data: schema
        }));
      }
    } catch (err) {
      console.error("Config fetch error:", err);
    }
  };

  const fetchJobs = async (pageNum, currentToken = token) => {
    if (!currentToken) return;

    if (pageNum > 0) setLoading(true);

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
          const fetchedJobs = res.data.jobs;
          setJobs(fetchedJobs);
          
          // --- UPDATE CACHE (With Token) ---
          localStorage.setItem(CACHE_KEY_JOBS, JSON.stringify({
            token: currentToken, // Save token with data
            data: fetchedJobs.slice(0, 100)
          }));
          // --------------------------------
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

    let result = jobs.filter((job) =>
      selectedStatuses.includes(job.jobcard_status)
    );

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <p className="job-summary" style={{ marginBottom: 0 }}>
            Displayed Jobs: <b>{filteredJobs.length}</b>
            </p>
            {/* Background Update Indicator */}
            {isBackgroundUpdating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#666' }}>
                    <CircularProgress size={14} thickness={5} />
                    <span style={{ fontSize: '0.8rem' }}>Syncing...</span>
                </div>
            )}
        </div>

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
                    border: "1px solid #ddd"
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
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <h5 style={{ margin: 0 }}>Job #{job.job_no || "-"}</h5>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#888",
                        fontWeight: "400"
                      }}
                    >
                      • {formatDate(job.createdAt)}
                    </span>
                  </div>
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
                        const rowBackgroundColor = itemStatusColor !== 'transparent' ? itemStatusColor + 'FF' : 'transparent';
                        const rowTextColor = 'black';

                        return (
                          <tr key={idx} style={{ backgroundColor: rowBackgroundColor, color: rowTextColor }}>
                            <td>
                              <span>
                                {item.item_qty > 1
                                  ? `${item.item_name} (${item.item_qty})`
                                  : item.item_name}
                              </span><br />
                              {item.item_unique_id.length > 0 ? <>({item.item_unique_id})</> : null}
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
            {jobs.length === 0 && !loading && !isBackgroundUpdating
              ? "No jobs found."
              : jobs.length === 0 && (loading || isBackgroundUpdating) 
                ? "Loading jobs..." 
                : "No jobs match your search or selected filters."}
          </p>
        )}
      </div>

      <div className="pagination">
        {hasMore && !loading && !isBackgroundUpdating && !searchTerm && (
          <button onClick={() => fetchJobs(page + 1)} className="load-more-btn">
            Load More
          </button>
        )}
        {loading && <div style={{marginTop: '10px'}}><CircularProgress size={24} /></div>}
      </div>
    </div>
  );
}