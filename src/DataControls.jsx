import React, { useRef, useState } from "react";
import { Download, Upload, ShieldCheck } from "lucide-react";
import { exportSave, validateSave } from "./management.js";

export default function DataControls({ state, onImport, notify }) {
  const input = useRef(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([exportSave(state)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `aurelia-progress-${state.date}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Simulation progress exported.");
  };
  const read = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Choose a save file smaller than 20 MB.");
      const imported = validateSave(JSON.parse(await file.text()));
      setPending(imported);
      setError("");
    } catch (error) {
      setError(
        error instanceof SyntaxError
          ? "This file is not valid JSON."
          : error.message,
      );
    }
  };
  return (
    <section className="card mgmt-panel data-controls">
      <div className="mgmt-panel-title">
        <div>
          <h2>Your hotel, wherever you go</h2>
          <p>
            Export a portable JSON backup. Import it in another browser or a
            newer standalone file.
          </p>
        </div>
        <ShieldCheck size={21} />
      </div>
      <div className="mgmt-actions">
        <button className="button secondary" onClick={download}>
          <Download size={15} />
          Export simulation JSON
        </button>
        <button
          className="button secondary"
          onClick={() => input.current.click()}
        >
          <Upload size={15} />
          Import simulation JSON
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          aria-label="Import simulation file"
          hidden
          onChange={read}
        />
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {pending && (
        <div className="mgmt-confirm" role="alert">
          <h3>Replace your current simulation?</h3>
          <p>
            The imported hotel is on {pending.date}, with{" "}
            {pending.reservations.length} reservations and{" "}
            {pending.employees.length} colleagues. Export your current progress
            first if you want to keep it.
          </p>
          <div className="mgmt-actions">
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Keep current progress
            </button>
            <button
              className="button primary"
              onClick={() => {
                onImport(pending);
                setPending(null);
                notify("Simulation imported. Your hotel is ready.");
              }}
            >
              Replace current progress
            </button>
          </div>
        </div>
      )}
      <div className="mgmt-info">
        Legacy Aurelia saves are upgraded with management departments while
        preserving rooms, guests, bookings, and recognized sales. Data stays on
        your device.
      </div>
    </section>
  );
}
