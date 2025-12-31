import Head from "next/head";
import { useState, useCallback, useRef } from "react";

export default function Home() {
  const [images, setImages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("image"); // 'image' or 'video'
  const [result, setResult] = useState(null);
  const [resultType, setResultType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const addImages = useCallback((files) => {
    Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImages(prev => [...prev.slice(-3), { id: Date.now() + Math.random(), data: e.target.result }]);
        };
        reader.readAsDataURL(file);
      });
  }, []);

  const removeImage = (id) => setImages(prev => prev.filter(img => img.id !== id));

  const generate = async () => {
    if (!images.length || !prompt.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImages: images.map(i => i.data),
          prompt: prompt.trim(),
          mode: mode,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      
      setResult(data.output);
      setResultType(data.type);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result;
    a.download = `mash-${Date.now()}.${resultType === 'video' ? 'mp4' : 'png'}`;
    a.click();
  };

  return (
    <>
      <Head>
        <title>MASH</title>
        <meta name="description" content="AI photoshoot extender" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#050505" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="app">
        <header className="header">
          <h1 className="logo">MASH</h1>
          <p className="subtitle">AI Photoshoot Extender</p>
        </header>

        <main className="content">
          {/* Mode Toggle */}
          <div className="mode-toggle">
            <button 
              className={`mode-btn ${mode === 'image' ? 'active' : ''}`}
              onClick={() => setMode('image')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              Image
            </button>
            <button 
              className={`mode-btn ${mode === 'video' ? 'active' : ''}`}
              onClick={() => setMode('video')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Video
            </button>
          </div>

          {/* Upload Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Reference Photos</span>
              {images.length > 0 && <span className="card-count">{images.length}/4</span>}
            </div>
            
            {images.length > 0 && (
              <div className="images">
                {images.map(img => (
                  <div key={img.id} className="image-item">
                    <img src={img.data} alt="" />
                    <button className="image-remove" onClick={() => removeImage(img.id)}>×</button>
                  </div>
                ))}
              </div>
            )}
            
            <div
              className={`upload ${dragActive ? 'active' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); addImages(e.dataTransfer.files); }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
            >
              <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 16V4m0 0l4 4m-4-4l-4 4M4 20h16" />
              </svg>
              <span className="upload-text">Tap to add photos</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => addImages(e.target.files)}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Prompt */}
          <div className="card">
            <div className="prompt-area">
              <textarea
                className="prompt-input"
                placeholder={mode === 'video' 
                  ? "Describe the motion or action..." 
                  : "Describe the new image..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {error && (
            <div className="error">
              {error}
              {error.includes('Rate limited') && (
                <div className="error-hint">
                  Add $5+ credit at <a href="https://replicate.com/account/billing" target="_blank" rel="noopener">replicate.com/billing</a>
                </div>
              )}
            </div>
          )}

          {/* Generate Button */}
          <button
            className="generate-btn"
            onClick={generate}
            disabled={loading || !images.length || !prompt.trim()}
          >
            {loading ? (
              <span className="loading">
                <span className="spinner" />
                {mode === 'video' ? 'Creating video...' : 'Generating...'}
              </span>
            ) : (
              mode === 'video' ? 'Create Video' : 'Generate'
            )}
          </button>

          {/* Output */}
          <div className="output">
            {result ? (
              <>
                {resultType === 'video' ? (
                  <video 
                    className="output-video" 
                    src={result} 
                    controls 
                    autoPlay 
                    loop 
                    muted
                    playsInline
                  />
                ) : (
                  <img className="output-image" src={result} alt="Generated" />
                )}
                <div className="output-actions">
                  <button className="action-btn" onClick={download}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                    </svg>
                    Save
                  </button>
                  <button className="action-btn" onClick={generate} disabled={loading}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12a8 8 0 0116 0M20 12a8 8 0 01-16 0" />
                    </svg>
                    Again
                  </button>
                  <button className="action-btn" onClick={() => { setResult(null); setResultType(null); setImages([]); setPrompt(''); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <div className="output-empty">
                {mode === 'video' ? (
                  <svg className="output-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                ) : (
                  <svg className="output-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                )}
                <p>Your {mode} will appear here</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
