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
    updated[index].options.push("");
    setFields(updated);
  };

  const updateOption = (fieldIndex, optIndex, value) => {
    const updated = [...fields];
    updated[fieldIndex].options[optIndex] = value;
    setFields(updated);
  };

  const removeField = (index) => {
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
            />
            <select
              className="field-select"
              value={field.type}
              onChange={(e) => updateField(index, "type", e.target.value)}
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
                <input
                  key={optIndex}
                  type="text"
                  className="option-input"
                  placeholder={`Option ${optIndex + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(index, optIndex, e.target.value)}
                />
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
        </div>
      ))}
      <button type="button" className="add-field-btn" onClick={addField}>
        + Add Field
      </button>
    </div>
  );
};

export default function JobCardConfigRecursive() {
  const [fields, setFields] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      alert("You need to be logged in to access this page.");
      navigate("/");
    }
  }, []);

  const saveConfig = async () => {
    const token = sessionStorage.getItem("token");
    await api
      .post(
        "/user/save-config",
        { schema: fields },
        { headers: { authorization: `Bearer ${token}` } }
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
