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

  const [customerDetails, setCustomerDetails] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [savedParts, setSavedParts] = useState([]);
  const [isPlanExpired, setIsPlanExpired] = useState(false);

  // ✅ Fetch schema
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      alert("Please log in first.");
      navigate("/");
      return;
    }
    const hasPlanExpired = sessionStorage.getItem("isPlanExpired") === "true";
    setIsPlanExpired(hasPlanExpired);

    api.get("/user/get-config", {
      headers: { authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.data && res.data.schema) {
          // console.log("Fetched schema:", res.data.schema);
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
        // console.error("Schema fetch failed", err);
        alert("Could not load schema.");
      })
      .finally(() => setLoading(false));

    api.get("/user/customerdetails", { headers: { authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data.success) setCustomerDetails(res.data.customers);
      })
      .catch((err) => console.error("Failed to load customers:", err));

    api.get("/user/items", { headers: { authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data.success) {
          console.log("Fetched items:", res.data.items);
          setSavedItems(res.data.items);
        }
      })
      .catch((err) => console.error("Failed to load items:", err));

    api.get("/user/parts", { headers: { authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data.success) {
          setSavedParts(res.data.parts);
        }
      })
      .catch((err) => console.error("Failed to load parts:", err));

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

  const handleCustomerNameChange = (event, value) => {
    const found = customerDetails.find(
      (c) => c.customer_name.toLowerCase() === (value || "").toLowerCase()
    );

    setFormData((prev) => {
      let updated = { ...prev, customer_name: value || "" };

      // Only update phone if found and current phone is empty
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

      // If phone length is 10 and name is currently empty, try to autofill name
      if (phone.length === 10 && !prev.customer_name) {
        const found = customerDetails.find((c) => c.customer_phone === phone);
        if (found) {
          updated.customer_name = found.customer_name;
        }
      }

      return updated;
    });
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
      else if(err.response?.status === 403) {
        alert("Cannot create new Jobcard. Your subscription may have expired.");
        navigate("/settings");
        return;
      }
      console.error("Job save failed:", err);
      alert("Could not save job.");
    }
  };

  // ✅ Parts Modal validation before closing
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
        qty: part.qty === "" || part.qty === undefined || part.qty === null ? 1 : Number(part.qty),
        price:
          part.price === "" || part.price === undefined || part.price === null
            ? 0
            : Number(part.price),
      };
    });

    if (hasError) {
      setPartsErrors("Part name cannot be empty");
      return; // don’t close modal if invalid
    }

    setFormData((prev) => ({
      ...prev,
      [parentKey]: updated,
    }));

    setPartsErrors("");
    setActiveParts(null);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page-container">
      <h2 className="title">Create New Job</h2>

      {/* Job Details */}
      <div className="job-details-grid">

        <div key="customer_phone" className="field-item">
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
          />
        </div>

        <div key="customer_name" className="field-item">
          <Autocomplete
            freeSolo
            options={customerDetails.map((c) => c.customer_name)}
            value={formData.customer_name || ""}
            onInputChange={handleCustomerNameChange}
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
        </div>

        {schema
          .filter(
            (field) =>
              field.type !== "list" &&
              field.key !== "customer_name" &&
              field.key !== "customer_phone" &&
              field.key !== "job_no"
          )
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
                  {(formData[field.key] || []).map((row, rowIndex) => {
                    const statusField = field.fields.find((f) => f.key === "item_status");
                    let rowColor = "";
                    if (statusField && row.item_status) {
                      const selectedOpt = statusField.options.find(
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
                          backgroundColor: rowColor ? rowColor + "20" : "transparent",
                        }}
                      >
                        {field.fields
                          .filter((f) => f.type !== "list")
                          .map((sub) => (
                            <TableCell key={sub.key}>
                              {sub.key === "item_name" ? (
                                <Autocomplete
                                  freeSolo // Allows typing new values
                                  options={savedItems.map((i) => i.item_name)} // Use the item list from state
                                  value={row[sub.key] || ""}
                                  onInputChange={(_, newValue) => {
                                    // Update state when user types or selects
                                    handleListChange(field.key, rowIndex, sub.key, newValue || "");
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label={sub.name}
                                      margin="normal"
                                      fullWidth
                                      size="small"
                                      // Display the item-specific error
                                      error={!!errors[`item-${rowIndex}`]}
                                      helperText={errors[`item-${rowIndex}`]}
                                    />
                                  )}
                                />
                              ) : (
                                // This is the original logic for all other fields
                                renderSimpleField(
                                  sub,
                                  row[sub.key],
                                  (val) => handleListChange(field.key, rowIndex, sub.key, val)
                                )
                              )}
                              {sub.key === "item_qty" && errors[`qty-${rowIndex}`] && (
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

      <Button variant="contained" color="primary" onClick={handleSave} className="save-btn" disabled={isPlanExpired}>
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
                                <TextField {...params} size="small" label="Part Name" />
                              )}
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              type="number"
                              value={p.qty ?? ""}
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
                              value={p.price ?? ""}
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
