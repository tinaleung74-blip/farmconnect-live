"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CustomerRegisterPage() {
  const router = useRouter();

  const idFileRef = useRef<HTMLInputElement>(null);
  const idCameraRef = useRef<HTMLInputElement>(null);
  const selfieCameraRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontUrl, setIdFrontUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");

  const [agreeMembership, setAgreeMembership] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRegister() {
    setMessage("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();
    const cleanIdType = idType.trim();
    const cleanIdNumber = idNumber.trim();

    if (
      !cleanName ||
      !cleanEmail ||
      !cleanPhone ||
      !cleanPassword ||
      !cleanIdType ||
      !cleanIdNumber
    ) {
      setMessage("Please complete all required account and ID verification fields.");
      return;
    }

    if (!idFrontUrl) {
      setMessage("Please upload or capture your valid ID.");
      return;
    }

    if (!selfieUrl) {
      setMessage("Please capture your selfie verification.");
      return;
    }

    if (!agreeMembership) {
      setMessage("You must agree to the Annual Investor Membership Program.");
      return;
    }

    if (cleanPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id,email,phone")
        .or(`email.eq.${cleanEmail},phone.eq.${cleanPhone}`)
        .maybeSingle();

      if (existing) {
        setMessage("Email or phone number is already registered.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .insert([
          {
            full_name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            password: cleanPassword,
            wallet_balance: 0,

            id_type: cleanIdType,
            id_number: cleanIdNumber,
            id_front_url: idFrontUrl,
            selfie_url: selfieUrl,
            verification_status: "PENDING",

            membership_plan: "ANNUAL INVESTOR MEMBERSHIP",
            membership_fee: 999,
            membership_status: "UNPAID",
          },
        ])
        .select()
        .single();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      localStorage.setItem("farmconnect_user", JSON.stringify(data));
      router.push("/customer/dashboard");
    } catch {
      setMessage("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main style={page}>
      <section style={container}>
        <div style={header}>
          <div style={badge}>FARMCONNECT SECURE ONBOARDING</div>
          <h1 style={title}>Create Customer Account</h1>
          <p style={subtitle}>
            Complete your account registration, identity verification, and
            Annual Investor Membership agreement before joining FarmConnect.
          </p>
        </div>

        <div style={layout}>
          <div style={leftPanel}>
            <h2 style={panelTitle}>Verification Process</h2>

            <div style={stepCard}>
              <div style={stepNumber}>1</div>
              <div>
                <h3>Account Details</h3>
                <p>Name, email, phone number, and password.</p>
              </div>
            </div>

            <div style={stepCard}>
              <div style={stepNumber}>2</div>
              <div>
                <h3>ID Verification</h3>
                <p>Upload your valid ID or capture it using your camera.</p>
              </div>
            </div>

            <div style={stepCard}>
              <div style={stepNumber}>3</div>
              <div>
                <h3>Annual Membership</h3>
                <p>₱999 yearly investor platform access fee.</p>
              </div>
            </div>

            <div style={securityBox}>
              <h3>🛡️ Risk Management Status</h3>
              <p>
                Customer accounts are monitored by admin. No direct customer to
                caretaker communication is allowed.
              </p>
              <span>PENDING VERIFICATION • MEMBERSHIP UNPAID</span>
            </div>
          </div>

          <div style={formCard}>
            <h2 style={formTitle}>Customer Registration</h2>
            <p style={formSubtitle}>Step 1 — Account Information</p>

            <label style={label}>Full Name *</label>
            <input
              style={input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
            />

            <label style={label}>Email Address *</label>
            <input
              style={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@gmail.com"
            />

            <label style={label}>Phone Number *</label>
            <input
              style={input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09123456789"
            />

            <label style={label}>Password *</label>
            <input
              style={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />

            <div style={divider} />

            <p style={formSubtitle}>Step 2 — ID Verification</p>

            <label style={label}>Valid ID Type *</label>
            <select
              style={input}
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
            >
              <option value="">Select valid ID</option>
              <option value="National ID">National ID</option>
              <option value="Driver License">Driver License</option>
              <option value="Passport">Passport</option>
              <option value="UMID">UMID</option>
              <option value="Voter ID">Voter ID</option>
            </select>

            <label style={label}>ID Number *</label>
            <input
              style={input}
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="Enter ID number"
            />

            <label style={label}>Upload Valid ID *</label>
            <div style={uploadBox}>
              <b>📄 Valid ID Verification</b>
              <p>
                Upload a valid government-issued ID or capture it directly using
                your camera.
              </p>

              <input
                ref={idFileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={() => setIdFrontUrl("ID_PHOTO_SELECTED")}
              />

              <input
                ref={idCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={() => setIdFrontUrl("ID_CAMERA_CAPTURED")}
              />

              <div style={buttonRow}>
                <button
                  type="button"
                  style={uploadButton}
                  onClick={() => idFileRef.current?.click()}
                >
                  📁 Upload Photo
                </button>

                <button
                  type="button"
                  style={cameraButton}
                  onClick={() => idCameraRef.current?.click()}
                >
                  📷 Open Camera
                </button>
              </div>

              {idFrontUrl && <p style={successText}>✓ ID Captured</p>}
            </div>

            <label style={label}>Selfie Verification *</label>
            <div style={uploadBox}>
              <b>🤳 Selfie Verification</b>
              <p>Take a live selfie for identity matching and admin review.</p>

              <input
                ref={selfieCameraRef}
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: "none" }}
                onChange={() => setSelfieUrl("SELFIE_CAMERA_CAPTURED")}
              />

              <button
                type="button"
                style={cameraButtonFull}
                onClick={() => selfieCameraRef.current?.click()}
              >
                🤳 Open Camera
              </button>

              {selfieUrl && <p style={successText}>✓ Selfie Captured</p>}
            </div>

            <div style={divider} />

            <p style={formSubtitle}>Step 3 — Annual Investor Membership</p>

            <div style={membershipCard}>
              <div style={membershipTop}>
                <div>
                  <h3 style={membershipTitle}>🌾 Annual Investor Membership</h3>
                  <p style={membershipSub}>FarmConnect Investor Access</p>
                </div>

                <div style={priceBox}>
                  <b>₱999</b>
                  <span>/ Year</span>
                </div>
              </div>

              <div style={benefitGrid}>
                <span>✓ Investor Dashboard</span>
                <span>✓ Livestock Monitoring</span>
                <span>✓ Harvest & ROI Reports</span>
                <span>✓ Weight Growth Tracking</span>
                <span>✓ Farm Photo Updates</span>
                <span>✓ Wallet Monitoring</span>
                <span>✓ Risk Reports</span>
                <span>✓ Priority Support</span>
                <span>✓ Investor Certificate</span>
                <span>✓ Future Batch Access</span>
              </div>

              <label style={checkRow}>
                <input
                  type="checkbox"
                  checked={agreeMembership}
                  onChange={(e) => setAgreeMembership(e.target.checked)}
                />
                <span>
                  I agree to the Annual Investor Membership Fee of{" "}
                  <b>₱999 per year</b>.
                </span>
              </label>

              <div style={membershipStatus}>
                Membership Status: <b>UNPAID</b>
              </div>
            </div>

            <div style={pendingBox}>
              Verification Status: <b>PENDING ADMIN REVIEW</b>
            </div>

            {message && <p style={errorBox}>{message}</p>}

            <button style={button} onClick={handleRegister} disabled={loading}>
              {loading ? "Submitting Verification..." : "Submit Registration"}
            </button>

            <button
              style={secondaryButton}
              onClick={() => router.push("/customer/login")}
            >
              Already verified? Login
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 45%, #fef9c3 100%)",
  padding: 24,
  color: "#0f172a",
};

const container: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  paddingTop: 35,
};

const header: React.CSSProperties = {
  marginBottom: 28,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  background: "#dbeafe",
  color: "#1d4ed8",
  padding: "10px 16px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 1,
  marginBottom: 16,
};

const title: React.CSSProperties = {
  fontSize: 44,
  fontWeight: 950,
  margin: 0,
};

const subtitle: React.CSSProperties = {
  maxWidth: 780,
  color: "#475569",
  fontSize: 17,
  lineHeight: 1.7,
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.9fr 1.1fr",
  gap: 24,
};

const leftPanel: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  borderRadius: 30,
  padding: 28,
  border: "1px solid rgba(15,23,42,0.08)",
  boxShadow: "0 30px 70px rgba(15,23,42,0.1)",
};

const panelTitle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 950,
  marginBottom: 20,
};

const stepCard: React.CSSProperties = {
  display: "flex",
  gap: 16,
  background: "white",
  padding: 18,
  borderRadius: 22,
  border: "1px solid #e2e8f0",
  marginBottom: 14,
};

const stepNumber: React.CSSProperties = {
  width: 42,
  height: 42,
  minWidth: 42,
  borderRadius: 14,
  background: "linear-gradient(135deg, #2563eb, #16a34a)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 950,
};

const securityBox: React.CSSProperties = {
  marginTop: 24,
  background: "linear-gradient(135deg, #0f172a, #14532d)",
  color: "white",
  borderRadius: 26,
  padding: 24,
};

const formCard: React.CSSProperties = {
  background: "white",
  borderRadius: 30,
  padding: 30,
  boxShadow: "0 35px 90px rgba(15,23,42,0.16)",
  border: "1px solid #e2e8f0",
};

const formTitle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 950,
  margin: 0,
};

const formSubtitle: React.CSSProperties = {
  color: "#2563eb",
  fontWeight: 900,
  marginTop: 14,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 900,
  marginTop: 14,
  marginBottom: 8,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "15px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  fontSize: 15,
  outline: "none",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "#e2e8f0",
  margin: "24px 0",
};

const uploadBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "2px dashed #93c5fd",
  borderRadius: 20,
  padding: 18,
  color: "#334155",
};

const buttonRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 15,
};

const uploadButton: React.CSSProperties = {
  flex: 1,
  padding: 14,
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  background: "#2563eb",
  color: "white",
  fontWeight: 900,
};

const cameraButton: React.CSSProperties = {
  flex: 1,
  padding: 14,
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  background: "#16a34a",
  color: "white",
  fontWeight: 900,
};

const cameraButtonFull: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  background: "#16a34a",
  color: "white",
  fontWeight: 900,
  marginTop: 15,
};

const successText: React.CSSProperties = {
  marginTop: 12,
  color: "#16a34a",
  fontWeight: 900,
};

const membershipCard: React.CSSProperties = {
  background: "linear-gradient(135deg, #f0fdf4, #eff6ff)",
  border: "1px solid #bfdbfe",
  borderRadius: 24,
  padding: 22,
};

const membershipTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const membershipTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 950,
};

const membershipSub: React.CSSProperties = {
  marginTop: 6,
  color: "#475569",
};

const priceBox: React.CSSProperties = {
  minWidth: 105,
  background: "#0f172a",
  color: "white",
  padding: 14,
  borderRadius: 18,
  textAlign: "center",
};

const benefitGrid: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  fontSize: 13,
  fontWeight: 800,
  color: "#14532d",
};

const checkRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  marginTop: 20,
  background: "white",
  borderRadius: 16,
  padding: 14,
  fontSize: 14,
  cursor: "pointer",
};

const membershipStatus: React.CSSProperties = {
  marginTop: 14,
  background: "#fef3c7",
  color: "#92400e",
  padding: 12,
  borderRadius: 14,
  fontSize: 13,
  fontWeight: 800,
};

const pendingBox: React.CSSProperties = {
  marginTop: 18,
  background: "#fef3c7",
  color: "#92400e",
  padding: 14,
  borderRadius: 16,
  fontSize: 13,
  fontWeight: 800,
};

const errorBox: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 14,
  marginTop: 16,
  fontWeight: 800,
};

const button: React.CSSProperties = {
  width: "100%",
  marginTop: 22,
  padding: 16,
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(135deg, #2563eb, #16a34a)",
  color: "white",
  fontWeight: 950,
  fontSize: 16,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: 14,
  borderRadius: 18,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
};