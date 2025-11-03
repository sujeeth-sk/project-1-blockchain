const { useState } = React;

function App() {
  const [score, setScore] = useState(null);
  const [kyber, setKyber] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [file, setFile] = useState(null);
  const [privateKey, setPrivateKey] = useState("");

  const fetchScore = async () => {
    const res = await axios.get("http://localhost:5000/api/node-score");
    setScore(res.data.score);
  };

  const fetchKyber = async () => {
    const res = await axios.get("http://localhost:5000/api/kyber");
    setKyber(res.data);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append("file", file);
    const res = await axios.post("http://localhost:5000/api/upload", form);
    setUploadInfo(res.data);
    setPrivateKey(res.data.publicKey.replace(/a/g, "b")); // mock private key for demo
  };

  const handleDownload = async () => {
    const res = await axios.post("http://localhost:5000/api/download", {
      filename: uploadInfo.filename,
      privateKey,
      iv: uploadInfo.iv
    }, { responseType: "blob" });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "decrypted.txt");
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="container">
      <h1>🔗 Local Blockchain + PQC Demo</h1>

      <button onClick={fetchScore}>Get Node Score</button>
      {score && <p>Node Score: <b>{score}</b></p>}

      <hr />

      <button onClick={fetchKyber}>Run PQC (Mock Kyber)</button>
      {kyber && (
        <div className="kyber">
          <p><b>Public Key:</b> {kyber.publicKey}</p>
          <p><b>Ciphertext:</b> {kyber.ciphertext}</p>
          <p><b>Decrypted:</b> {kyber.decrypted}</p>
        </div>
      )}

      <hr />

      <form onSubmit={handleUpload}>
        <h3>📤 Upload File (Encrypt)</h3>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button type="submit">Upload</button>
      </form>

      {uploadInfo && (
        <div>
          <p>Encrypted File: <b>{uploadInfo.filename}</b></p>
          <p>IV: <b>{uploadInfo.iv}</b></p>
          <p>Public Key: <b>{uploadInfo.publicKey}</b></p>
          <button onClick={handleDownload}>📥 Download Decrypted File</button>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
