import React, { useState } from "react";
import api from "../axiosConfig";
import { useNavigate } from 'react-router-dom';
import { useEffect } from "react";

const FieldConfig = ({ fields, setFields }) => {
  const addField = () => {
    setFields([...fields, { name: "", type: "text", options: [], fields: [] }]);
  };

  const updateField = (index, key, value) => {
    const updated = [...fields];
    updated[index][key] = value;
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
    <div style={{ marginLeft: "20px", borderLeft: "2px solid #ddd", paddingLeft: "10px" }}>
      {fields.map((field, index) => (
        <div key={index} style={{ marginBottom: "15px" }}>
          <input
            type="text"
            placeholder="Field Name"
            value={field.name}
            onChange={(e) => updateField(index, "name", e.target.value)}
          />
          <select
            value={field.type}
            onChange={(e) => updateField(index, "type", e.target.value)}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="dropdown">Dropdown</option>
            <option value="date">Date</option>
            <option value="checkbox">Checkbox</option>
            <option value="list">List</option>
          </select>

          {field.type === "dropdown" && (
            <div>
              <button type="button" onClick={() => addOption(index)}>Add Option</button>
              {field.options.map((opt, optIndex) => (
                <input
                  key={optIndex}
                  type="text"
                  placeholder={`Option ${optIndex + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(index, optIndex, e.target.value)}
                />
              ))}
            </div>
          )}

          {field.type === "list" && (
            <div>
              <h5>Subfields for "{field.name}"</h5>
              <FieldConfig
                fields={field.fields}
                setFields={(newSubfields) => {
                  const updated = [...fields];
                  updated[index].fields = newSubfields;
                  setFields(updated);
                }}
              />
            </div>
          )}

          <button type="button" onClick={() => removeField(index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={addField}>Add Field</button>
    </div>
  );
};

export default function JobCardConfigRecursive() {
  const [fields, setFields] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      alert("You need to be logged in to access this page.");
      navigate("/");
    }
  }, []);

  const saveConfig = async () => {
    console.log("Saving configuration:", fields);
    const token = sessionStorage.getItem('token');
    console.log("Token:", token);
    await api.post("/user/save-config",
      { schema: fields },
      { headers: { 'authorization': `Bearer ${token}` } },
    ).then((resp) => {
      if (resp.status === 200) {
        alert(resp.data.message);
        navigate("/dashboard");
      }
    }).catch((err) => {
      if (err.status === 401) {
        alert("Unauthorized. Please log in again.");
        navigate("/");
        return;
      }
      else{
        console.error("Error saving configuration:", err);
        alert("Failed to save configuration. Please try again.");
      }
    })

  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Configure Job Card</h2>
      <FieldConfig fields={fields} setFields={setFields} />
      <br />
      <button onClick={saveConfig}>Save Configuration</button>
    </div>
  );
}
