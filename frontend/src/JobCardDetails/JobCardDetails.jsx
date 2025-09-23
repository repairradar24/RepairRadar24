import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import "./jobcarddetails.css"; // ✅ reuse same css

export default function JobCardDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [schema, setSchema] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeParts, setActiveParts] = useState(null);
  const [errors, setErrors] = useState({});
  const [partsErrors, setPartsErrors] = useState("");

  // ✅ Fetch schema + job data
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      alert("Please log in first.");
      navigate("/");
      return;
    }

    Promise.all([
      api.get("/user/get-config", { headers: { authorization: `Bearer ${token}` } }),
      api.get(`/user/jobs/getjobcard/${id}`, { headers: { authorization: `Bearer ${token}` } }),
    ])
      .then(([schemaRes, jobRes]) => {
        if (schemaRes.data?.schema) setSchema(schemaRes.data.schema);
        if (jobRes.data?.job) setFormData(jobRes.data.job);
      })
      .catch((err) => {
        console.error("Error loading job details:", err);
        alert("Could not load job details.");
        navigate("/dashboard");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

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
      if (f.key.toLowerCase().includes("qty")) newRow[f.key] = 1;
      else if (f.key.toLowerCase().includes("price")) newRow[f.key] = 0;
      else if (f.type === "dropdown" && f.options?.length) newRow[f.key] = f.options[0].value;
      else if (f.type === "checkbox") newRow[f.key] = false;
      else if (f.type === "list") newRow[f.key] = [];
      else newRow[f.key] = "";
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

  const calculateRepairCost = (parts = []) =>
    parts.reduce((sum, p) => sum + (parseFloat(p.qty) || 0) * (parseFloat(p.price) || 0), 0);

  const renderSimpleField = (field, value, onChange) => {
    const isJobNo = field.key === "job_no"; // Job number read-only

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
            error={!!errors[field.key]}
            helperText={errors[field.key]}
            disabled={isJobNo} // job number is not editable
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
              <TextField
                {...params}
                label={field.name}
                margin="normal"
                fullWidth
                size="small"
              />
            )}
            disabled={isJobNo}
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

  // ✅ Validation before save
  const validateForm = () => {
    const newErrors = {};

    if (!formData.customer_name?.trim()) {
      newErrors.customer_name = "Customer name is required";
    }

    if (!formData.customer_phone?.trim()) {
      newErrors.customer_phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(formData.customer_phone)) {
      newErrors.customer_phone = "Phone number must be 10 digits";
    }

    // Items & Parts validation
    const itemsField = schema.find((f) => f.type === "list");
    if (itemsField && (formData[itemsField.key] || []).length) {
      formData[itemsField.key].forEach((item, idx) => {
        if (!item.item_name?.trim()) {
          newErrors[`item_${idx}_name`] = "Item name is required";
        }
        (item.parts || []).forEach((part, pIdx) => {
          if (!part.name?.trim()) {
            newErrors[`item_${idx}_part_${pIdx}_name`] = "Part name is required";
          }
        });
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ Save job (update)
  const handleSave = async () => {
    if (!validateForm()) {
      alert("Please fix validation errors before saving.");
      return;
    }

    try {
      const token = sessionStorage.getItem("token");
      await api.put(`/user/jobs/updatejobcard/${id}`, formData, {
        headers: { authorization: `Bearer ${token}` },
      });
      alert("Job updated successfully!");
      navigate("/dashboard");
    } catch (err) {
      console.error("Job update failed:", err);
      alert("Could not update job.");
    }
  };

  // ✅ Parts Modal validation before closing
  const handlePartsDone = () => {
    const updated = [...formData[activeParts.parentKey]];
    const rowParts = updated[activeParts.rowIndex].parts || [];

    // Check for empty part names
    for (let p of rowParts) {
      if (!p.name?.trim()) {
        setPartsErrors("Part name cannot be empty.");
        return;
      }
    }

    // Reset empty price values to 0
    updated[activeParts.rowIndex].parts = rowParts.map((p) => ({
      ...p,
      price: p.price === "" || p.price == null ? 0 : p.price,
    }));

    setFormData((prev) => ({
      ...prev,
      [activeParts.parentKey]: updated,
    }));

    setPartsErrors("");
    setActiveParts(null);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page-container">
      <h2 className="title">Job Card Details</h2>

      {/* Job Details */}
      <div className="job-details-grid">
        {schema
          .filter((field) => field.type !== "list")
          .map((field) => (
            <div key={field.key} className="field-item">
              {renderSimpleField(field, formData[field.key], (val) =>
                handleChange(field.key, val)
              )}
            </div>
          ))}
      </div>

      {/* Items List */}
      {schema
        .filter((field) => field.type === "list")
        .map((field) => (
          <div key={field.key} className="list-wrapper">
            <h4>{field.name}</h4>
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
                  {(formData[field.key] || []).map((row, rowIndex) => {
                    const statusField = field.fields.find((f) => f.key === "item_status");
                    let rowColor = "";
                    if (statusField && row.item_status) {
                      const selectedOpt = statusField.options.find(
                        (opt) => opt.value === row.item_status
                      );
                      if (selectedOpt?.color) rowColor = selectedOpt.color;
                    }

                    return (
                      <TableRow
                        key={rowIndex}
                        style={{
                          backgroundColor: rowColor ? rowColor + "20" : "transparent",
                        }}
                      >
                        {field.fields
                          .filter((f) => f.type !== "list")
                          .map((sub) => (
                            <TableCell key={sub.key}>
                              {renderSimpleField(
                                sub,
                                row[sub.key],
                                (val) => handleListChange(field.key, rowIndex, sub.key, val)
                              )}
                              {errors[`item_${rowIndex}_name`] && sub.key === "item_name" && (
                                <span className="error-text">
                                  {errors[`item_${rowIndex}_name`]}
                                </span>
                              )}
                            </TableCell>
                          ))}
                        <TableCell>₹{calculateRepairCost(row.parts || []).toFixed(2)}</TableCell>
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
                    );
                  })}
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

      <div className="action-buttons">
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          className="save-btn"
        >
          Save Changes
        </Button>

        <Button
          variant="contained"
          color="secondary" // different color
          onClick={() => navigate("/dashboard")} // discard = go back without saving
          className="save-btn"
        >
          Discard
        </Button>
      </div>

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
                              error={!!errors[`item_${activeParts.rowIndex}_part_${idx}_name`]}
                              helperText={errors[`item_${activeParts.rowIndex}_part_${idx}_name`]}
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
                              value={p.price}
                              onChange={(e) => {
                                const updated = [...formData[activeParts.parentKey]];
                                updated[activeParts.rowIndex].parts[idx] = {
                                  ...p,
                                  price: e.target.value, // can be empty temporarily
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
