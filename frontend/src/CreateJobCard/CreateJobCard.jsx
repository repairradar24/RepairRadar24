import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Switch,
  Button,
  Autocomplete,
  IconButton,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Modal,
  Box,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { AddCircle, Delete } from "@mui/icons-material";
import api from "../axiosConfig.js";
import Navbar from "../Navbar/Navbar.jsx";
import "./createjobcard.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

/**
 * ConfirmDialog component + askConfirm helper
 */
const ConfirmDialog = ({ open, message, onClose }) => {
  return (
    <Dialog open={open} onClose={() => onClose(false)}>
      <DialogTitle>Confirm</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancel</Button>
        <Button onClick={() => onClose(true)} color="error" variant="contained">
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default function CreateJobCard() {
  const navigate = useNavigate();
  const [schema, setSchema] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeParts, setActiveParts] = useState(null);
  const [errors, setErrors] = useState({});
  const [partsErrors, setPartsErrors] = useState("");

  const [customerDetails, setCustomerDetails] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [savedParts, setSavedParts] = useState([]);
  const [isPlanExpired, setIsPlanExpired] = useState(false);

  // Confirm dialog state & resolver
  const [confirmState, setConfirmState] = useState({
    open: false,
    message: "",
    resolver: null,
  });

  // askConfirm returns a Promise<boolean>
  const askConfirm = (message) =>
    new Promise((resolve) => {
      setConfirmState({ open: true, message, resolver: resolve });
    });

  const handleCloseConfirm = (result) => {
    if (confirmState.resolver) confirmState.resolver(result);
    setConfirmState({ open: false, message: "", resolver: null });
  };

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      toast.error("Please log in first.");
      navigate("/");
      return;
    }
    const hasPlanExpired = sessionStorage.getItem("isPlanExpired") === "true";
    setIsPlanExpired(hasPlanExpired);

    api
      .get("/user/get-config", {
        headers: { authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data && res.data.schema) {
          setSchema(res.data.schema);

          const defaults = {};
          res.data.schema.forEach((f) => {
            if (f.type === "dropdown" && f.options?.length) {
              defaults[f.key] = f.options[0].value;
            } else if (f.type === "checkbox") {
              defaults[f.key] = false;
            } else if (f.type === "list") {
              // --- CHANGED LOGIC START ---
              // Automatically add one empty row for list types (like Items)
              const firstRow = {};
              if (f.fields && f.fields.length > 0) {
                f.fields.forEach((subF) => {
                  if (subF.key.toLowerCase().includes("qty")) {
                    firstRow[subF.key] = 1;
                  } else if (subF.key.toLowerCase().includes("price")) {
                    firstRow[subF.key] = 0;
                  } else if (subF.type === "dropdown" && subF.options?.length) {
                    firstRow[subF.key] = subF.options[0].value;
                  } else if (subF.type === "checkbox") {
                    firstRow[subF.key] = false;
                  } else if (subF.type === "list") {
                    // Nested lists (like Parts) should remain empty initially
                    firstRow[subF.key] = [];
                  } else {
                    firstRow[subF.key] = "";
                  }
                });
                // Initialize the list with this single empty row
                defaults[f.key] = [firstRow];
              } else {
                defaults[f.key] = [];
              }
              // --- CHANGED LOGIC END ---
            } else {
              defaults[f.key] = "";
            }
          });
          setFormData(defaults);
        }
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          toast.error("Session expired. Please log in again.");
          navigate("/");
          return;
        }
        console.error("Could not load schema:", err);
        toast.error("Could not load schema.");
      })
      .finally(() => setLoading(false));

    api
      .get("/user/customerdetails", {
        headers: { authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.success) setCustomerDetails(res.data.customers);
      })
      .catch((err) => {
        console.error("Failed to load customers:", err);
        toast.error("Failed to load customers.");
      });

    api
      .get("/user/items", { headers: { authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data.success) {
          console.log("Fetched items:", res.data.items);
          setSavedItems(res.data.items);
        }
      })
      .catch((err) => {
        console.error("Failed to load items:", err);
        toast.error("Failed to load items.");
      });

    api
      .get("/user/parts", { headers: { authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data.success) {
          setSavedParts(res.data.parts);
        }
      })
      .catch((err) => {
        console.error("Failed to load parts:", err);
        toast.error("Failed to load parts.");
      });
  }, [navigate]);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleListChange = (listKey, rowIndex, colKey, value) => {
    const updatedList = [...(formData[listKey] || [])];
    updatedList[rowIndex] = { ...updatedList[rowIndex], [colKey]: value };
    setFormData((prev) => ({ ...prev, [listKey]: updatedList }));
  };

  const addListRow = (listKey, fields) => {
    const newRow = {};
    fields.forEach((f) => {
      if (f.key.toLowerCase().includes("qty")) {
        newRow[f.key] = 1;
      } else if (f.key.toLowerCase().includes("price")) {
        newRow[f.key] = 0;
      } else if (f.type === "dropdown" && f.options?.length) {
        newRow[f.key] = f.options[0].value;
      } else if (f.type === "checkbox") {
        newRow[f.key] = false;
      } else if (f.type === "list") {
        newRow[f.key] = [];
      } else {
        newRow[f.key] = "";
      }
    });
    setFormData((prev) => ({
      ...prev,
      [listKey]: [...(prev[listKey] || []), newRow],
    }));
  };

  const removeListRow = (listKey, rowIndex) => {
    const updated = (formData[listKey] || []).filter((_, i) => i !== rowIndex);
    setFormData((prev) => ({ ...prev, [listKey]: updated }));
  };

  const calculateRepairCost = (parts = []) => {
    return parts.reduce((sum, p) => {
      const qty = parseFloat(p.qty) || 0;
      const price = parseFloat(p.price) || 0;
      return sum + qty * price;
    }, 0);
  };

  const renderSimpleField = (field, value, onChange) => {
    switch (field.type) {
      case "text":
      case "number":
      case "date":
        return (
          <TextField
            label={field.name}
            type={field.type === "number" ? "number" : field.type}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            fullWidth
            margin="normal"
            size="small"
            InputLabelProps={field.type === "date" ? { shrink: true } : {}}
            disabled={isPlanExpired}
          />
        );

      case "dropdown":
        return (
          <Autocomplete
            options={field.options || []}
            value={
              value
                ? field.options.find((opt) => opt.value === value) || null
                : field.options[0] || null
            }
            getOptionLabel={(opt) => opt.value || ""}
            isOptionEqualToValue={(opt, val) => opt.value === val.value}
            onChange={(_, newVal) =>
              onChange(newVal ? newVal.value : field.options[0]?.value || "")
            }
            disabled={isPlanExpired}
            renderInput={(params) => (
              <TextField
                {...params}
                label={field.name}
                margin="normal"
                fullWidth
                size="small"
              />
            )}
          />
        );

      case "checkbox":
        return (
          <div className="switch-row">
            <span>{field.name}</span>
            <Switch
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={isPlanExpired}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const handleCustomerNameChange = (event, value) => {
    const found = customerDetails.find(
      (c) => c.customer_name.toLowerCase() === (value || "").toLowerCase()
    );

    setFormData((prev) => {
      let updated = { ...prev, customer_name: value || "" };

      if (found && !prev.customer_phone) {
        updated.customer_phone = found.customer_phone;
      }

      return updated;
    });
  };

  const handleCustomerPhoneChange = (e) => {
    const phone = e.target.value.replace(/\D/g, ""); // keep only digits

    setFormData((prev) => {
      let updated = { ...prev, customer_phone: phone };

      if (phone.length === 10 && !prev.customer_name) {
        const found = customerDetails.find((c) => c.customer_phone === phone);
        if (found) {
          updated.customer_name = found.customer_name;
        }
      }

      return updated;
    });
  };

  const handleSave = async () => {
    setErrors({});
    const newErrors = {};
    const alertMessages = [];

    if (!formData.customer_name || formData.customer_name.trim() === "") {
      newErrors.customer_name = "Customer name is required";
      alertMessages.push("Customer name is required");
    }

    if (!formData.customer_phone || formData.customer_phone.trim() === "") {
      newErrors.customer_phone = "Customer phone is required";
      alertMessages.push("Customer phone is required");
    } else if (!/^\d{10}$/.test(formData.customer_phone)) {
      newErrors.customer_phone = "Phone number must be exactly 10 digits";
      alertMessages.push("Phone number must be exactly 10 digits");
    }

    const items = formData.items || [];
    if (items.length === 0) {
      newErrors.items = "At least 1 item is required";
      alertMessages.push("At least 1 item is required");
    } else {
      items.forEach((item, idx) => {
        if (!item.item_name || item.item_name.trim() === "") {
          newErrors[`item-${idx}`] = "Item name is required";
          alertMessages.push(`Item name is required in row ${idx + 1}`);
        }
        if (!item.item_qty || item.item_qty <= 0) {
          newErrors[`qty-${idx}`] = "Quantity must be greater than 0";
          alertMessages.push(
            `Quantity must be greater than 0 in row ${idx + 1}`
          );
        }
      });
    }

    if (alertMessages.length > 0) {
      setErrors(newErrors);
      // show multi-line errors as a single toast
      toast.error(alertMessages.join("\n"), { autoClose: 7000 });
      return;
    }

    console.log("Saving job with data:", formData);

    try {
      const token = sessionStorage.getItem("token");
      await api.post("/user/jobs/savejobcard", formData, {
        headers: { authorization: `Bearer ${token}` },
      });
      toast.success("Job created successfully!");
      navigate("/dashboard");
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Session expired. Please log in again.");
        navigate("/");
        return;
      } else if (err.response?.status === 403) {
        toast.error(
          "Cannot create new Jobcard. Your subscription may have expired."
        );
        navigate("/settings");
        return;
      }
      console.error("Job save failed:", err);
      toast.error("Could not save job.");
    }
  };

  const handlePartsDone = () => {
    const { parentKey, rowIndex } = activeParts;
    const updated = [...formData[parentKey]];

    let hasError = false;
    updated[rowIndex].parts = (updated[rowIndex].parts || []).map((part) => {
      if (!part.name || part.name.trim() === "") {
        hasError = true;
      }
      return {
        ...part,
        name: part.name ? part.name.trim() : "",
        qty:
          part.qty === "" || part.qty === undefined || part.qty === null
            ? 1
            : Number(part.qty),
        price:
          part.price === "" || part.price === undefined || part.price === null
            ? 0
            : Number(part.price),
      };
    });

    if (hasError) {
      setPartsErrors("Part name cannot be empty");
      toast.warn("Part name cannot be empty");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [parentKey]: updated,
    }));

    setPartsErrors("");
    setActiveParts(null);
  };

  const statusField = schema.find((f) => f.key === "jobcard_status");

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <>
      <ToastContainer position="top-right" autoClose={5000} />
      <Navbar />
      <div className="create-job-container">
        <Typography variant="h5" component="h1" className="page-title">
          Create New Job Card
        </Typography>

        {isPlanExpired && (
          <div
            className="plan-status status-expired"
            style={{ marginBottom: "20px" }}
          >
            <span style={{ fontSize: "1.5rem", marginRight: "15px" }}>⚠️</span>
            <div>
              <strong>Your plan has expired.</strong> You cannot create new job
              cards.
              <br />
              Please go to <strong>Settings &gt; Subscription Plans</strong> to
              renew.
            </div>
          </div>
        )}

        {/* --- Key Details Section (Phone, Name, Status) --- */}
        <Paper component="form" className="form-section">
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Customer Phone"
                value={formData.customer_phone || ""}
                onChange={handleCustomerPhoneChange}
                fullWidth
                margin="normal"
                size="small"
                error={!!errors.customer_phone}
                helperText={errors.customer_phone}
                inputProps={{ maxLength: 10 }}
                disabled={isPlanExpired}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                freeSolo
                options={customerDetails.map((c) => c.customer_name)}
                value={formData.customer_name || ""}
                onInputChange={handleCustomerNameChange}
                disabled={isPlanExpired}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Customer Name"
                    margin="normal"
                    fullWidth
                    size="small"
                    error={!!errors.customer_name}
                    helperText={errors.customer_name}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              {statusField &&
                renderSimpleField(statusField, formData[statusField.key], (val) =>
                  handleChange(statusField.key, val)
                )}
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            {schema
              .filter(
                (field) =>
                  field.type !== "list" &&
                  field.key !== "customer_name" &&
                  field.key !== "customer_phone" &&
                  field.key !== "job_no" &&
                  field.key !== "jobcard_status"
              )
              .map((field) => (
                <Grid item xs={12} sm={6} md={4} key={field.key}>
                  {renderSimpleField(field, formData[field.key], (val) =>
                    handleChange(field.key, val)
                  )}
                  {errors[field.key] && (
                    <span className="error-text">{errors[field.key]}</span>
                  )}
                </Grid>
              ))}
          </Grid>
        </Paper>

        {/* --- Items List --- */}
        {schema
          .filter((field) => field.type === "list")
          .map((field) => (
            <Paper key={field.key} className="form-section">
              {errors.items && <span className="error-text">{errors.items}</span>}
              <div className="table-responsive">
                <Table>
                  <TableHead>
                    <TableRow>
                      {field.fields
                        .filter((f) => f.type !== "list")
                        .map((sub) => (
                          <TableCell key={sub.key}>{sub.name}</TableCell>
                        ))}
                      <TableCell>Repair Cost</TableCell>
                      <TableCell>Parts</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formData[field.key] || []).map((row, rowIndex) => {
                      const itemStatusField = field.fields.find(
                        (f) => f.key === "item_status"
                      );
                      let rowColor = "";
                      if (itemStatusField && row.item_status) {
                        const selectedOpt = itemStatusField.options.find(
                          (opt) => opt.value === row.item_status
                        );
                        if (selectedOpt?.color) {
                          rowColor = selectedOpt.color;
                        }
                      }

                      return (
                        <TableRow
                          key={rowIndex}
                          style={{
                            backgroundColor: rowColor
                              ? rowColor + "20"
                              : "transparent",
                          }}
                        >
                          {field.fields
                            .filter((f) => f.type !== "list")
                            .map((sub) => (
                              <TableCell key={sub.key} style={{ minWidth: 180 }}>
                                {sub.key === "item_name" ? (
                                  <Autocomplete
                                    freeSolo
                                    disabled={isPlanExpired}
                                    options={savedItems.map((i) => i.item_name)}
                                    value={row[sub.key] || ""}
                                    onInputChange={(_, newValue) => {
                                      handleListChange(
                                        field.key,
                                        rowIndex,
                                        sub.key,
                                        newValue || ""
                                      );
                                    }}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label={sub.name}
                                        margin="normal"
                                        fullWidth
                                        size="small"
                                        error={!!errors[`item-${rowIndex}`]}
                                        helperText={errors[`item-${rowIndex}`]}
                                      />
                                    )}
                                  />
                                ) : (
                                  renderSimpleField(
                                    sub,
                                    row[sub.key],
                                    (val) =>
                                      handleListChange(
                                        field.key,
                                        rowIndex,
                                        sub.key,
                                        val
                                      )
                                  )
                                )}
                                {sub.key === "item_qty" &&
                                  errors[`qty-${rowIndex}`] && (
                                    <span className="error-text">
                                      {errors[`qty-${rowIndex}`]}
                                    </span>
                                  )}
                              </TableCell>
                            ))}
                          <TableCell>
                            ₹{calculateRepairCost(row.parts || []).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() =>
                                setActiveParts({ parentKey: field.key, rowIndex })
                              }
                              disabled={isPlanExpired}
                            >
                              Parts
                            </Button>
                          </TableCell>
                          <TableCell>
                            <IconButton
                              color="error"
                              onClick={() => removeListRow(field.key, rowIndex)}
                              disabled={isPlanExpired}
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Button
                startIcon={<AddCircle />}
                onClick={() => addListRow(field.key, field.fields)}
                className="add-row-btn"
                disabled={isPlanExpired}
              >
                Add {field.name}
              </Button>
            </Paper>
          ))}

        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          className="save-job-btn"
          disabled={isPlanExpired}
        >
          Save Job
        </Button>

        <Modal open={!!activeParts} onClose={() => setActiveParts(null)}>
          <Box className="modal-box">
            <Typography variant="h6" className="modal-title">
              Edit Parts
            </Typography>
            {activeParts && (
              <>
                <div className="table-responsive">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Part Name</TableCell>
                        <TableCell>Qty</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(
                        formData[activeParts.parentKey]?.[activeParts.rowIndex]
                          .parts || []
                      ).map((p, idx) => (
                        <TableRow key={idx}>
                          <TableCell style={{ minWidth: 200 }}>
                            <Autocomplete
                              freeSolo
                              disabled={isPlanExpired}
                              options={savedParts.map((part) => part.part_name)}
                              value={p.name || ""}
                              onInputChange={(_, newValue) => {
                                const newPartName = newValue || "";
                                const foundPart = savedParts.find(
                                  (sp) => sp.part_name === newPartName
                                );
                                const updated = [
                                  ...formData[activeParts.parentKey],
                                ];
                                const currentPart =
                                  updated[activeParts.rowIndex].parts[idx];
                                currentPart.name = newPartName;
                                if (foundPart) {
                                  currentPart.price = foundPart.part_price;
                                }
                                setFormData((prev) => ({
                                  ...prev,
                                  [activeParts.parentKey]: updated,
                                }));
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  size="small"
                                  label="Part Name"
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell style={{ minWidth: 80 }}>
                            <TextField
                              type="number"
                              value={p.qty ?? ""}
                              disabled={isPlanExpired}
                              onChange={(e) => {
                                const updated = [
                                  ...formData[activeParts.parentKey],
                                ];
                                updated[activeParts.rowIndex].parts[idx] = {
                                  ...p,
                                  qty: e.target.value,
                                };
                                setFormData((prev) => ({
                                  ...prev,
                                  [activeParts.parentKey]: updated,
                                }));
                              }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell style={{ minWidth: 100 }}>
                            <TextField
                              type="number"
                              value={p.price ?? ""}
                              disabled={isPlanExpired}
                              onChange={(e) => {
                                const updated = [
                                  ...formData[activeParts.parentKey],
                                ];
                                updated[activeParts.rowIndex].parts[idx] = {
                                  ...p,
                                  price: e.target.value,
                                };
                                setFormData((prev) => ({
                                  ...prev,
                                  [activeParts.parentKey]: updated,
                                }));
                              }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              color="error"
                              disabled={isPlanExpired}
                              onClick={() => {
                                const updated = [
                                  ...formData[activeParts.parentKey],
                                ];
                                updated[activeParts.rowIndex].parts = updated[
                                  activeParts.rowIndex
                                ].parts.filter((_, i) => i !== idx);
                                setFormData((prev) => ({
                                  ...prev,
                                  [activeParts.parentKey]: updated,
                                }));
                              }}
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {partsErrors && (
                  <span className="error-text">{partsErrors}</span>
                )}
                <Button
                  startIcon={<AddCircle />}
                  onClick={() => {
                    const updated = [...formData[activeParts.parentKey]];
                    const currentParts =
                      updated[activeParts.rowIndex].parts || [];
                    updated[activeParts.rowIndex].parts = [
                      ...currentParts,
                      { name: "", qty: 1, price: 0 },
                    ];
                    setFormData((prev) => ({
                      ...prev,
                      [activeParts.parentKey]: updated,
                    }));
                  }}
                  className="add-row-btn"
                  disabled={isPlanExpired}
                >
                  Add Part
                </Button>
                <div className="modal-actions">
                  <Button variant="contained" onClick={handlePartsDone}>
                    Done
                  </Button>
                </div>
              </>
            )}
          </Box>
        </Modal>

        {/* Confirm dialog (replaces window.confirm usage) */}
        <ConfirmDialog
          open={confirmState.open}
          message={confirmState.message}
          onClose={handleCloseConfirm}
        />
      </div>
    </>
  );
}