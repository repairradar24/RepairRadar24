import React, { useState, useEffect } from "react";
import api from "../axiosConfig";
import { useNavigate } from "react-router-dom";
import "./jobcardconfig.css";

const generateKey = (name) => {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
};

// Recursive field configuration component
const FieldConfig = ({ fields, setFields, level = 0 }) => {
  const addField = () => {
    const newField = {
      name: "",
      key: "",
      type: "text", // always text by default
      options: [],
      fields: [],
      mandatory: false,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index, key, value) => {
    const updated = [...fields];
    updated[index][key] = value;

    if (key === "name") {
      updated[index].key = generateKey(value);
    }

    setFields(updated);
  };

  const addOption = (index) => {
    const updated = [...fields];
    updated[index].options.push({ value: "", color: "#ffffff" }); // default color
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
    if (field.mandatory) {
      alert(`The field "${field.name}" is mandatory and cannot be removed.`);
      return;
    }
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index, direction) => {
    const updated = [...fields];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFields(updated);
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
              disabled={field.mandatory}
            />

            <span className="field-key">({field.key})</span>

            {/* Reorder buttons */}
            <button
              type="button"
              className="move-btn"
              onClick={() => moveField(index, -1)}
              disabled={index === 0}
            >
              ↑
            </button>
            <button
              type="button"
              className="move-btn"
              onClick={() => moveField(index, 1)}
              disabled={index === fields.length - 1}
            >
              ↓
            </button>

            {/* Remove only for non-mandatory */}
            {!field.mandatory && (
              <button
                type="button"
                className="remove-btn"
                onClick={() => removeField(index)}
              >
                Remove
              </button>
            )}
          </div>

          {/* Dropdown Options */}
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

                  {/* Color Picker with Label + Tooltip */}
                  <label className="color-picker-label">
                    🎨 Color:
                    <input
                      type="color"
                      className="color-input"
                      value={opt.color || "#cccccc"}
                      onChange={(e) =>
                        updateOption(index, optIndex, "color", e.target.value)
                      }
                      title="Click to select a color for this status"
                    />
                  </label>

                  {field.key === "jobcard_status" && (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={opt.displayByDefault || false}
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

          {/* Nested lists */}
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

  const defaultConfig = [
    { name: "Job Number", key: "job_no", type: "number", mandatory: true, options: [], fields: [] },
    { name: "Customer Phone", key: "customer_phone", type: "text", mandatory: true, options: [], fields: [] },
    { name: "Customer Name", key: "customer_name", type: "text", mandatory: true, options: [], fields: [] },
    {
      name: "Jobcard Status",
      key: "jobcard_status",
      type: "dropdown",
      mandatory: true,
      options: [
        { value: "Pending", displayByDefault: true, color: "#ffcc00" },
        { value: "In Progress", displayByDefault: false, color: "#00bfff" },
        { value: "Completed", displayByDefault: false, color: "#4caf50" },
      ],
      fields: [],
    },
    {
      name: "Items",
      key: "items",
      type: "list",
      mandatory: true,
      options: [],
      fields: [
        { name: "Item Name", key: "item_name", type: "text", mandatory: true, options: [], fields: [] },
        { name: "Item Qty", key: "item_qty", type: "number", mandatory: true, options: [], fields: [] },
        {
          name: "Item Status",
          key: "item_status",
          type: "dropdown",
          mandatory: true,
          options: [
            { value: "Pending", color: "#ffcc00" },
            { value: "In Progress", color: "#00bfff" },
            { value: "Completed", color: "#4caf50" },
          ],
          fields: [],
        },
        {
          name: "Parts",
          key: "parts",
          type: "list",
          mandatory: true,
          options: [],
          fields: [
            { name: "Part Name", key: "part_name", type: "text", mandatory: true, options: [], fields: [] },
            { name: "Part Price", key: "part_price", type: "number", mandatory: true, options: [], fields: [] },
            { name: "Part Qty", key: "part_qty", type: "number", mandatory: true, options: [], fields: [] },
          ],
        },
      ],
    },
  ];

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      alert("You need to be logged in to access this page.");
      navigate("/");
    } else {
      api
        .get("/user/get-config", { headers: { authorization: `Bearer ${token}` } })
        .then((resp) => {
          if (resp.status === 200) {
            let schema = resp.data.schema || [];
            setFields(schema.length ? schema : defaultConfig);
          } else if (resp.status === 204) {
            setFields(defaultConfig);
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
    await api
      .post("/user/save-config", { schema: fields }, { headers: { authorization: `Bearer ${token}` } })
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
