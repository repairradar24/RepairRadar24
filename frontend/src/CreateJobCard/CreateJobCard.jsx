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
} from "@mui/material";
import { AddCircle, Delete } from "@mui/icons-material";
import api from "../axiosConfig";
import "./createjobcard.css";

export default function CreateJobCard() {
  const navigate = useNavigate();
  const [schema, setSchema] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  // ✅ On load, check token + fetch schema
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      alert("Please log in first.");
      navigate("/");
      return;
    }

    api.get("/user/get-config", {
      headers: { authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.data && res.data.schema) {
          setSchema(res.data.schema);
        }
      })
      .catch((err) => {
        console.error("Schema fetch failed", err);
        alert("Could not load schema.");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  // ✅ Handle input changes
  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // ✅ Handle list-type fields (as a table)
  const handleListChange = (listKey, rowIndex, colKey, value) => {
    const currentList = formData[listKey] || [];
    const updatedList = [...currentList];
    updatedList[rowIndex] = { ...updatedList[rowIndex], [colKey]: value };
    setFormData((prev) => ({ ...prev, [listKey]: updatedList }));
  };

  const addListRow = (listKey, fields) => {
    const currentList = formData[listKey] || [];
    const newRow = {};
    fields.forEach((f) => {
      newRow[f.key] = "";
    });
    setFormData((prev) => ({ ...prev, [listKey]: [...currentList, newRow] }));
  };

  const removeListRow = (listKey, rowIndex) => {
    const currentList = formData[listKey] || [];
    const updated = currentList.filter((_, i) => i !== rowIndex);
    setFormData((prev) => ({ ...prev, [listKey]: updated }));
  };

  // ✅ Submit form → create job
  const handleSave = async () => {
    const token = sessionStorage.getItem("token");
    try {
      // get max job number
      const res = await api.get("/user/jobs/maxJobNo", {
        headers: { authorization: `Bearer ${token}` },
      });

      const newJobNo = (res.data.maxJobNo || 0) + 1;

      const payload = { ...formData, jobNo: newJobNo };

      await api.post("/user/jobs", payload, {
        headers: { authorization: `Bearer ${token}` },
      });

      alert("Job created successfully!");
      navigate("/jobs");
    } catch (err) {
      console.error("Job save failed:", err);
      alert("Could not save job.");
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="create-job-container">
      <h2 className="title">Create New Job</h2>

      <div className="fields-grid">
        {schema.map((field) => {
          if (field.type === "list") {
            // Lists span full width
            return (
              <div key={field.key} className="list-wrapper">
                {/* List rendering logic (unchanged) */}
                <div className="list-section">
                  <h4>{field.name}</h4>
                  <Paper className="list-table">
                    <Table>
                      <TableHead>
                        <TableRow>
                          {field.fields.map((sub) => (
                            <TableCell key={sub.key}>{sub.name}</TableCell>
                          ))}
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(formData[field.key] || []).map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {field.fields.map((sub) => (
                              <TableCell key={sub.key}>
                                <TextField
                                  value={row[sub.key] || ""}
                                  onChange={(e) =>
                                    handleListChange(field.key, rowIndex, sub.key, e.target.value)
                                  }
                                  size="small"
                                />
                              </TableCell>
                            ))}
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
              </div>
            );
          }

          // Non-list fields go into grid
          return (
            <div key={field.key} className="field-item">
              {/* Text / Number / Date */}
              {(field.type === "text" || field.type === "number" || field.type === "date") && (
                <TextField
                  label={field.name}
                  type={field.type === "number" ? "number" : field.type}
                  value={formData[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  fullWidth
                  margin="normal"
                />
              )}

              {/* Dropdown */}
              {field.type === "dropdown" && (
                <Autocomplete
                  options={field.options || []}
                  value={
                    field.options.find((opt) => opt.value === formData[field.key]) || null
                  }
                  getOptionLabel={(option) => option.value || ""}
                  isOptionEqualToValue={(option, value) => option.value === value.value}
                  onChange={(_, newValue) =>
                    handleChange(field.key, newValue ? newValue.value : "")
                  }
                  renderInput={(params) => (
                    <TextField {...params} label={field.name} margin="normal" fullWidth />
                  )}
                />
              )}

              {/* Checkbox */}
              {field.type === "checkbox" && (
                <div className="switch-row">
                  <span>{field.name}</span>
                  <Switch
                    checked={!!formData[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.checked)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button variant="contained" color="primary" onClick={handleSave} className="save-btn">
        Save Job
      </Button>
    </div>
  );
}
