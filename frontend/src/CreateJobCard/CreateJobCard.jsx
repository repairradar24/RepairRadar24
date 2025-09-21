import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import { AddCircle, Delete } from "@mui/icons-material";
import api from "../axiosConfig";
import "./createjobcard.css";

export default function CreateJobCard() {
  const navigate = useNavigate();
  const [schema, setSchema] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeParts, setActiveParts] = useState(null);
  const [errors, setErrors] = useState({});
  const [partsErrors, setPartsErrors] = useState("");

  // ✅ Fetch schema
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      alert("Please log in first.");
      navigate("/");
      return;
    }

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
              defaults[f.key] = [];
            } else {
              defaults[f.key] = "";
            }
          });
          setFormData(defaults);
        }
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          alert("Session expired. Please log in again.");
          navigate("/");
          return;
        }
        console.error("Schema fetch failed", err);
        alert("Could not load schema.");
      })
      .finally(() => setLoading(false));
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
            renderInput={(params) => (
              <TextField {...params} label={field.name} margin="normal" fullWidth size="small" />
            )}
          />
        );

      case "checkbox":
        return (
          <div className="switch-row">
            <span>{field.name}</span>
            <Switch checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          </div>
        );

      default:
        return null;
    }
  };

  // ✅ Save job with validations
  const handleSave = async () => {
    setErrors({});
    const newErrors = {};
    const alertMessages = [];

    // 🔹 Customer name validation
    if (!formData.customer_name || formData.customer_name.trim() === "") {
      newErrors.customer_name = "Customer name is required";
      alertMessages.push("Customer name is required");
    }

    // 🔹 Customer phone validation
    if (!formData.customer_phone || formData.customer_phone.trim() === "") {
      newErrors.customer_phone = "Customer phone is required";
      alertMessages.push("Customer phone is required");
    } else if (!/^\d{10}$/.test(formData.customer_phone)) {
      newErrors.customer_phone = "Phone number must be exactly 10 digits";
      alertMessages.push("Phone number must be exactly 10 digits");
    }

    // 🔹 Items validation
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
          alertMessages.push(`Quantity must be greater than 0 in row ${idx + 1}`);
        }
      });
    }

    // 🔹 Stop if errors exist
    if (alertMessages.length > 0) {
      setErrors(newErrors);
      alert(alertMessages.join("\n"));
      return;
    }

    console.log("Saving job with data:", formData);

    try {
      const token = sessionStorage.getItem("token");
      await api.post("/user/jobs/savejobcard", formData, {
        headers: { authorization: `Bearer ${token}` },
      });
      alert("Job created successfully!");
      navigate("/dashboard");
    } catch (err) {
      if (err.response?.status === 401) {
        alert("Session expired. Please log in again.");
        navigate("/");
        return;
      }
      console.error("Job save failed:", err);
      alert("Could not save job.");
    }
  };


  // ✅ Parts Modal validation before closing
  const handlePartsDone = () => {
    const { parentKey, rowIndex } = activeParts;
    const row = formData[parentKey][rowIndex];

    for (let i = 0; i < (row.parts || []).length; i++) {
      const part = row.parts[i];
      if (!part.name || part.name.trim() === "") {
        alert("Part name is required");
        setPartsErrors("Part name is required");
        return;
      }
      if (part.price === "" || part.price === null || isNaN(part.price)) {
        alert("Price cannot be empty");
        setPartsErrors("Price cannot be empty");
        return;
      }
    }
    setPartsErrors("");
    setActiveParts(null);
  };


  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page-container">
      <h2 className="title">Create New Job</h2>

      {/* Job Details */}
      <div className="job-details-grid">
        {schema
          .filter((field) => field.type !== "list")
          .map((field) => (
            <div key={field.key} className="field-item">
              {renderSimpleField(field, formData[field.key], (val) =>
                handleChange(field.key, val)
              )}
              {errors[field.key] && <span className="error-text">{errors[field.key]}</span>}
            </div>
          ))}
      </div>

      {/* Items List */}
      {schema
        .filter((field) => field.type === "list")
        .map((field) => (
          <div key={field.key} className="list-wrapper">
            <h4>{field.name}</h4>
            {errors.items && <span className="error-text">{errors.items}</span>}
            <Paper className="list-table">
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
                  {(formData[field.key] || []).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {field.fields
                        .filter((f) => f.type !== "list")
                        .map((sub) => (
                          <TableCell key={sub.key}>
                            {renderSimpleField(
                              sub,
                              row[sub.key],
                              (val) => handleListChange(field.key, rowIndex, sub.key, val)
                            )}
                            {errors[`item-${rowIndex}`] &&
                              sub.key === "Item" && (
                                <span className="error-text">
                                  {errors[`item-${rowIndex}`]}
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
                          onClick={() => setActiveParts({ parentKey: field.key, rowIndex })}
                        >
                          Parts
                        </Button>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          color="error"
                          onClick={() => removeListRow(field.key, rowIndex)}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            <Button
              startIcon={<AddCircle />}
              onClick={() => addListRow(field.key, field.fields)}
              className="add-row-btn"
            >
              Add {field.name}
            </Button>
          </div>
        ))}

      <Button variant="contained" color="primary" onClick={handleSave} className="save-btn">
        Save Job
      </Button>

      {/* Parts Modal */}
      <Modal open={!!activeParts} onClose={() => setActiveParts(null)}>
        <Box className="modal-box">
          <Typography variant="h6">Parts</Typography>
          {activeParts && (
            <>
              <Paper className="list-table">
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
                    {(formData[activeParts.parentKey]?.[activeParts.rowIndex].parts || []).map(
                      (p, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <TextField
                              value={p.name || ""}
                              onChange={(e) => {
                                const updated = [...formData[activeParts.parentKey]];
                                updated[activeParts.rowIndex].parts[idx] = {
                                  ...p,
                                  name: e.target.value,
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
                            <TextField
                              type="number"
                              value={p.qty || 1}
                              onChange={(e) => {
                                const updated = [...formData[activeParts.parentKey]];
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
                          <TableCell>
                            <TextField
                              type="number"
                              value={p.price || 0}
                              onChange={(e) => {
                                const updated = [...formData[activeParts.parentKey]];
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
                              onClick={() => {
                                const updated = [...formData[activeParts.parentKey]];
                                updated[activeParts.rowIndex].parts =
                                  updated[activeParts.rowIndex].parts.filter((_, i) => i !== idx);
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
                      )
                    )}
                  </TableBody>
                </Table>
              </Paper>
              {partsErrors && <span className="error-text">{partsErrors}</span>}
              <Button
                startIcon={<AddCircle />}
                onClick={() => {
                  const updated = [...formData[activeParts.parentKey]];
                  const currentParts = updated[activeParts.rowIndex].parts || [];
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
    </div>
  );
}
