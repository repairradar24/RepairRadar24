import React, { useState, useEffect } from "react";
import api from "../axiosConfig";
import { useNavigate } from "react-router-dom";
import "./jobcardconfig.css";

const generateKey = (name) => {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
};

const FieldConfig = ({ fields, setFields, level = 0 }) => {
  const addField = () => {
    setFields([
      ...fields,
      { name: "", key: "", type: "text", options: [], fields: [] }
    ]);
  };

  const updateField = (index, key, value) => {
    const updated = [...fields];
    updated[index][key] = value;

    if (key === "name") {
      updated[index].key = generateKey(value);
    }

    if (key === "type" && value !== "dropdown" && value !== "list") {
      updated[index].options = [];
    }
    if (key === "type" && value !== "list") {
      updated[index].fields = [];
    }

    setFields(updated);
  };

  const addOption = (index) => {
    const updated = [...fields];
    updated[index].options.push({ value: "", displayByDefault: false });
    setFields(updated);
  };

  const updateOption = (fieldIndex, optIndex, key, value) => {
    const updated = [...fields];
    updated[fieldIndex].options[optIndex][key] = value;
    setFields(updated);
  };

  const removeOption = (fieldIndex, optIndex) => {
    const updated = [...fields];
    updated[fieldIndex].options.splice(optIndex, 1);
    setFields(updated);
  };

  const removeField = (index) => {
    const field = fields[index];
    if (field.key === "job_no" || field.key === "jobcard_status") {
      alert(`The field "${field.name}" is mandatory and cannot be removed.`);
      return;
    }
    setFields(fields.filter((_, i) => i !== index));
  };

  return (
    <div className={`field-group level-${level}`}>
      {fields.map((field, index) => (
        <div key={index} className="field-item">
          <div className="field-row">
            <input
              type="text"
              className="field-input"
              placeholder="Field Name"
              value={field.name}
              onChange={(e) => updateField(index, "name", e.target.value)}
              disabled={field.key === "job_no" || field.key === "jobcard_status"} />

            <select
              className="field-select"
              value={field.type}
              onChange={(e) => updateField(index, "type", e.target.value)}
              disabled={field.key === "job_no" || field.key === "jobcard_status"}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="dropdown">Dropdown</option>
              <option value="date">Date</option>
              <option value="checkbox">True/False</option>
              <option value="list">List</option>
            </select>

            <span className="field-key">({field.key})</span>

            <button
              type="button"
              className="remove-btn"
              onClick={() => removeField(index)}
            >
              Remove
            </button>
          </div>

          
            {field.type === "dropdown" && (
              <div className="options-section">
                <button
                  type="button"
                  className="add-option-btn"
                  onClick={() => addOption(index)}
                >
                  + Add Option
                </button>

                {field.options.map((opt, optIndex) => (
                  <div key={optIndex} className="option-row">
                    <input
                      type="text"
                      className="option-input"
                      placeholder={`Option ${optIndex + 1}`}
                      value={opt.value}
                      onChange={(e) =>
                        updateOption(index, optIndex, "value", e.target.value)
                      }
                    />
                    {field.key === "jobcard_status" && (
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={opt.displayByDefault}
                          onChange={(e) =>
                            updateOption(
                              index,
                              optIndex,
                              "displayByDefault",
                              e.target.checked
                            )
                          }
                        />
                        Display by Default
                      </label>
                    )}
                    <button
                      type="button"
                      className="remove-option-btn"
                      onClick={() => removeOption(index, optIndex)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {field.type === "list" && (
              <div className="subfields-section">
                <h5 className="subfields-title">Subfields for "{field.name}"</h5>
                <FieldConfig
                  fields={field.fields}
                  setFields={(newSubfields) => {
                    const updated = [...fields];
                    updated[index].fields = newSubfields;
                    setFields(updated);
                  }}
                  level={level + 1}
                />
              </div>
            )}

            {field.key === "jobcard_status" && (
              <p className="status-hint">
                ⚠️ This field decides which jobcards are shown on the dashboard.
                Jobs with statuses marked as <b>Display by Default</b> will appear.
              </p>
            )}
          </div>
        
      ))}

          <button type="button" className="add-field-btn" onClick={addField}>
            + Add Field
          </button>
        </div>
      );
};

      export default function JobCardConfig() {
  const [fields, setFields] = useState([]);
      const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("token");
      if (!token) {
        alert("You need to be logged in to access this page.");
      navigate("/");
    } else {
        api
          .get("/user/get-config", {
            headers: { authorization: `Bearer ${token}` },
          })
          .then((resp) => {
            if (resp.status === 200) {
              let schema = resp.data.schema || [];

              console.log("Fetched configuration:", schema);

              // ensure mandatory fields exist
              if (!schema.some((f) => f.key === "job_no")) {
                schema.unshift({
                  name: "Job Number",
                  key: "job_no",
                  type: "number",
                  options: [],
                  fields: [],
                });
              }

              if (!schema.some((f) => f.key === "jobcard_status")) {
                schema.push({
                  name: "Jobcard Status",
                  key: "jobcard_status",
                  type: "dropdown",
                  options: [
                    { value: "Pending", displayByDefault: true },
                    { value: "In Progress", displayByDefault: false },
                    { value: "Completed", displayByDefault: false },
                  ],
                  fields: [],
                });
              }

              setFields(schema);
            } else if (resp.status === 204) {
              console.log("No configuration found, starting with defaults.");
              setFields([
                {
                  name: "Job Number",
                  key: "job_no",
                  type: "number",
                  options: [],
                  fields: [],
                },
                {
                  name: "Jobcard Status",
                  key: "jobcard_status",
                  type: "dropdown",
                  options: [
                    { value: "Pending", displayByDefault: true },
                    { value: "In Progress", displayByDefault: false },
                    { value: "Completed", displayByDefault: false },
                  ],
                  fields: [],
                },
              ]);
            }
          })
          .catch((err) => {
            if (err.response && err.response.status === 401) {
              alert("Unauthorized. Please log in again.");
              navigate("/");
            } else {
              console.error("Error fetching configuration:", err);
              alert("Failed to load configuration. Please try again.");
            }
          });
    }
  }, []);

  const saveConfig = async () => {
    const token = sessionStorage.getItem("token");
      console.log("Saving configuration:", fields);
      await api
      .post(
      "/user/save-config",
      {schema: fields },
      {headers: {authorization: `Bearer ${token}` } }
      )
      .then((resp) => {
        if (resp.status === 200) {
        alert(resp.data.message);
      navigate("/dashboard");
        }
      })
      .catch((err) => {
        if (err.status === 401) {
        alert("Unauthorized. Please log in again.");
      navigate("/");
      return;
        } else {
        console.error("Error saving configuration:", err);
      alert("Failed to save configuration. Please try again.");
        }
      });
  };

      return (
      <div className="jobcard-container">
        <h2 className="title">Configure Job Card</h2>
        <FieldConfig fields={fields} setFields={setFields} />
        <br />
        <button onClick={saveConfig} className="save-btn">
          Save Configuration
        </button>
      </div>
      );
}
