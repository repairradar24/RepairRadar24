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
  Checkbox, // 🟢 NEW
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { AddCircle, Delete, WhatsApp } from "@mui/icons-material"; // 🟢 NEW
import api from "../axiosConfig";
import "./jobcarddetails.css";

export default function JobCardDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [schema, setSchema] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeParts, setActiveParts] = useState(null);
  const [errors, setErrors] = useState({});
  const [partsErrors, setPartsErrors] = useState("");
  const [whatsappItems, setWhatsappItems] = useState([]);
  const [whatsappMessages, setWhatsappMessages] = useState([]);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [savedItems, setSavedItems] = useState([]);
  const [savedParts, setSavedParts] = useState([]);

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
      api.get("/user/items", { headers: { authorization: `Bearer ${token}` } }),
      api.get("/user/parts", { headers: { authorization: `Bearer ${token}` } })
    ])
      .then(([schemaRes, jobRes, itemRes, partsRes]) => {
        if (schemaRes.data?.schema) {
          console.log("Schema fetched:", schemaRes.data.schema);
          setSchema(schemaRes.data.schema);
        }
        if (jobRes.data?.job) setFormData(jobRes.data.job);
        if (itemRes?.data?.items) setSavedItems(itemRes.data.items);
        if (partsRes?.data?.parts) setSavedParts(partsRes.data.parts);
      })
      .catch((err) => {
        console.error("Error loading job details:", err);
        alert("Could not load job details.");
        navigate("/dashboard");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // 🟢 Fetch WhatsApp messages
  const fetchWhatsappMessages = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await api.get("user/whatsapp/get-messages", {
        headers: { authorization: `Bearer ${token}` },
      });
      setWhatsappMessages(res.data || []);
    } catch (err) {
      console.error("Error fetching WhatsApp messages:", err);
      alert("Could not load WhatsApp messages.");
    }
  };

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
    const isJobNo = field.key === "job_no";

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
            disabled={isJobNo}
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

  // ✅ Save job
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

    for (let p of rowParts) {
      if (!p.name?.trim()) {
        setPartsErrors("Part name cannot be empty.");
        return;
      }
    }

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

  // 🟢 Toggle item selection for WhatsApp
  const toggleWhatsappItem = (index) => {
    console.log("Toggling WhatsApp item:", index);
    setWhatsappItems((prev) => {
      const exists = prev.includes(index);
      if (exists) {
        // Remove index if already selected
        return prev.filter((i) => i !== index);
      }
      // Add index if not already selected
      return [...prev, index];
    });
  };

  // Helper to recursively search schema for a field
  const findFieldPath = (schema, fieldKey, currentPath = []) => {
    for (const field of schema) {
      if (field.key === fieldKey) return [...currentPath, field.key];
      if (field.type === "list" && Array.isArray(field.fields)) {
        const nested = findFieldPath(field.fields, fieldKey, [...currentPath, field.key]);
        if (nested) return nested;
      }
    }
    return null;
  };

  // Helper to safely extract value by following a path (handles arrays)
  const extractValueByPath = (data, path) => {
    let value = data;
    for (const key of path) {
      if (value == null) return "";
      value = value[key];
    }

    if (Array.isArray(value)) {
      // if array of objects with item_name etc.
      if (value.length && typeof value[0] === "object") {
        // pick all text-like values
        const textValues = value
          .map((obj) => Object.values(obj).find((v) => typeof v === "string"))
          .filter(Boolean);
        return textValues.join(", ");
      }
      return value.join(", ");
    }

    return value ?? "";
  };

  // ✅ Main message generator
  function generateWhatsappMessage(template, formData, selectedIndices = []) {
    if (!template || !formData) return "";

    // Helper to safely fetch nested formData values
    const getValueFromFormData = (key) => {
      if (!formData || !key) return "";
      const parts = key.split(".");
      let value = formData;
      for (const part of parts) {
        if (value && typeof value === "object" && part in value) {
          value = value[part];
        } else {
          return "";
        }
      }
      return value ?? "";
    };

    let message = template.replace(/\\n/g, "\n"); // convert stored "\n" to real newlines

    // ✅ Detect list-type fields (like items)
    if (Array.isArray(formData.items) && formData.items.length > 0) {
      const itemKeys = Object.keys(formData.items[0]);
      const lines = message.split(/\r?\n/);

      // Find the first and last line that reference item fields
      const firstItemLine = lines.findIndex((line) =>
        itemKeys.some((key) => line.includes(`{${key}}`))
      );
      const lastItemLine = lines
        .slice()
        .reverse()
        .findIndex((line) =>
          itemKeys.some((key) => line.includes(`{${key}}`))
        );
      const lastIndex = lastItemLine >= 0 ? lines.length - 1 - lastItemLine : firstItemLine;

      if (firstItemLine !== -1) {
        // The part that should be repeated (could be multiple lines)
        const itemTemplate = lines.slice(firstItemLine, lastIndex + 1).join("\n");

        const selectedItems =
          selectedIndices.length > 0
            ? formData.items.filter((_, idx) => selectedIndices.includes(idx))
            : formData.items;

        // Generate the repeated section
        const itemsSection = selectedItems
          .map((item) =>
            itemTemplate.replace(/\{(.*?)\}/g, (_, key) => {
              const val = item[key] ?? getValueFromFormData(key) ?? "";
              return val || "";
            })
          )
          .map((line) =>
            line
              .replace(/(\(|\[|\{|\<)\s*(\)|\]|\}|\>)/g, "")
              .replace(/\s+/g, " ")
              .trim()
          )
          .join("\n");

        // Replace the original item lines with the repeated section
        lines.splice(firstItemLine, lastIndex - firstItemLine + 1, itemsSection);
        message = lines.join("\n");
      }
    }

    // ✅ Replace remaining placeholders (outside item list)
    message = message.replace(/\{(.*?)\}/g, (_, key) => {
      const val = getValueFromFormData(key);
      return val || "";
    });

    // ✅ Cleanup & return
    return message
      .replace(/(\(|\[|\{|\<)\s*(\)|\]|\}|\>)/g, "")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n") // normalize excessive blank lines
      .trim();
  }




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
                    <TableCell>WhatsApp</TableCell> {/* 🟢 NEW */}
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
                              {sub.key === "item_name" ? (
                                <Autocomplete
                                  freeSolo
                                  options={savedItems.map((item) => item.item_name)}
                                  value={row[sub.key] || ""}
                                  onInputChange={(_, newValue) => {
                                    handleListChange(field.key, rowIndex, sub.key, newValue || "");
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label={sub.name}
                                      margin="normal"
                                      fullWidth
                                      size="small"
                                      error={!!errors[`item_${rowIndex}_name`]}
                                      helperText={errors[`item_${rowIndex}_name`]}
                                    />
                                  )}
                                />
                              ) : (
                                renderSimpleField(
                                  sub,
                                  row[sub.key],
                                  (val) => handleListChange(field.key, rowIndex, sub.key, val)
                                )
                              )}

                              {sub.key === "item_qty" && errors[`item_${rowIndex}_qty`] && (
                                <span className="error-text">
                                  {errors[`item_${rowIndex}_qty`]}
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
                        <TableCell align="center">
                          <Checkbox
                            checked={whatsappItems.includes(rowIndex)}
                            onChange={() => toggleWhatsappItem(rowIndex)}
                          />
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

      {/* Action Buttons */}
      <div className="action-buttons">
        <Button variant="contained" color="primary" onClick={handleSave} className="save-btn">
          Save Changes
        </Button>

        {/* 🟢 WhatsApp Button */}
        <Button
          disabled={whatsappItems.length === 0}
          variant="contained"
          color="success"
          startIcon={<WhatsApp />}
          onClick={() => {
            fetchWhatsappMessages();
            setWhatsappModalOpen(true);
          }}
        >
          WhatsApp
        </Button>

        <Button
          variant="contained"
          color="secondary"
          onClick={() => navigate("/dashboard")}
          className="save-btn"
        >
          Discard
        </Button>
      </div>

      {/* WhatsApp Modal 🟢 */}
      <Modal open={whatsappModalOpen} onClose={() => setWhatsappModalOpen(false)}>
        <Box className="modal-box">
          <Typography variant="h6" gutterBottom>
            Send WhatsApp Message
          </Typography>
          {whatsappMessages.length === 0 ? (
            <Typography>No messages available.</Typography>
          ) : (
            <List>
              {whatsappMessages.map((msg) => (
                <Button
                  key={msg._id}
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    const phone = formData.customer_phone;
                    if (!phone) {
                      alert("No customer phone found.");
                      return;
                    }

                    const rawTemplate = msg.text || msg.message || "";
                    const finalMessage = generateWhatsappMessage(rawTemplate, formData, whatsappItems);
                    try {
                      await navigator.clipboard.writeText(finalMessage);
                      console.log("WhatsApp message copied to clipboard!");
                    } catch (err) {
                      console.error("Failed to copy message:", err);
                    }

                    const encoded = encodeURIComponent(finalMessage.trim());
                    const whatsappUrl = `https://wa.me/91${phone}?text=${encoded}`;
                    window.open(whatsappUrl, "_blank");
                  }}
                  sx={{
                    textTransform: "none",
                    borderRadius: "12px",
                    m: 0.5,
                    px: 2,
                    py: 1,
                    minWidth: "120px",
                    boxShadow: 1,
                    backgroundColor: "#25D366",
                    "&:hover": {
                      backgroundColor: "#1EBE57",
                    },
                  }}
                >
                  {msg.name || "Message"}
                </Button>

              ))}
            </List>
          )}
          <div className="modal-actions">
            <Button variant="contained" onClick={() => setWhatsappModalOpen(false)}>
              Close
            </Button>
          </div>
        </Box>
      </Modal>

      {/* Parts Modal (unchanged) */}
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
                          {/* Part Name */}
                          <TableCell>
                            <Autocomplete
                              freeSolo
                              options={savedParts.map((part) => part.part_name)}
                              value={p.name || ""}
                              onInputChange={(_, newValue) => {
                                const newPartName = newValue || "";

                                const foundPart = savedParts.find(
                                  (sp) => sp.part_name === newPartName
                                );

                                const updated = [...formData[activeParts.parentKey]];
                                const currentPart = updated[activeParts.rowIndex].parts[idx];

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
                                  error={!!errors[`item_${activeParts.rowIndex}_part_${idx}_name`]}
                                  helperText={errors[`item_${activeParts.rowIndex}_part_${idx}_name`]}
                                />
                              )}
                            />
                          </TableCell>

                          {/* Qty */}
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

                          {/* Price */}
                          <TableCell>
                            <TextField
                              type="number"
                              value={p.price == null ? "" : p.price}
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

                          {/* Delete */}
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
