import Head from "next/head";
import { useState, useCallback, useRef } from "react";

export default function Home() {
  const [models, setModels] = useState([{ id: 1, name: "Model A", images: [] }]);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRefs = useRef({});

  const addModel = () => {
    const nextLetter = String.fromCharCode(65 + models.length); // A, B, C...
    setModels(prev => [...prev, { id: Date.now(), name: `Model ${nextLetter}`, images: [] }]);
  };

  const removeModel = (id) => {
    if (models.length <= 1) return;
    setModels(prev => prev.filter(m => m.id !== id));
  };

  const updateModelName = (id, name) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, name } : m));
  };

  const addImages = useCallback((modelId, files) => {
    Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setModels(prev => prev.map(m => {
            if (m.id !== modelId) return m;
            return { ...m, images: [...m.images.slice(-3), { id: Date.now() + Math.random(), data: e.target.result }] };
          }));
        };
        reader.readAsDataURL(file);
      });
  }, []);

  const removeImage = (modelId, imageId) => {
    setModels(prev => prev.map(m => {
      if (m.id !== modelId) return m;
      return { ...m, images: m.images.filter(img => img.id !== imageId) };
    }));
  };

  const totalImages = models.reduce((sum, m) => sum + m.images.length, 0);
  const canGenerate = totalImages > 0 && prompt.trim();

  const generate = async () => {
    if (!canGenerate) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Collect all images and build enhanced prompt with model references
      const allImages = models.flatMap(m => m.images.map(img => img.data));
      
      // Build prompt with model context
      let enhancedPrompt = prompt;
      models.forEach((m, i) => {
        if (m.images.length > 0) {
          // Add context about which images belong to which model
          enhancedPrompt = `[${m.name}: reference images ${i * 4 + 1}-${i * 4 + m.images.length}] ` + enhancedPrompt;
        }
      });

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImages: allImages,
          prompt: enhancedPrompt,
          models: models.map(m => ({ name: m.name, imageCount: m.images.length })),
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      
      setResult(data.image);
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
    a.download = `mash-${Date.now()}.png`;
    a.click();
  };

  const clearAll = () => {
    setResult(null);
    setModels([{ id: 1, name: "Model A", images: [] }]);
    setPrompt('');
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
          <p className="subtitle">Multi-Model AI Photoshoot</p>
        </header>

        <main className="content">
          {/* Models Section */}
          {models.map((model, index) => (
            <div key={model.id} className="card model-card">
              <div className="card-header">
                <input
                  type="text"
                  className="model-name-input"
                  value={model.name}
                  onChange={(e) => updateModelName(model.id, e.target.value)}
                  placeholder="Name..."
                />
                <div className="model-header-actions">
                  {model.images.length > 0 && (
                    <span className="card-count">{model.images.length}/4</span>
                  )}
                  {models.length > 1 && (
                    <button className="remove-model-btn" onClick={() => removeModel(model.id)}>×</button>
                  )}
                </div>
              </div>
              
              {model.images.length > 0 && (
                <div className="images">
                  {model.images.map(img => (
                    <div key={img.id} className="image-item">
                      <img src={img.data} alt="" />
                      <button className="image-remove" onClick={() => removeImage(model.id, img.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
              
              <div
                className="upload"
                onClick={() => inputRefs.current[model.id]?.click()}
              >
                <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 16V4m0 0l4 4m-4-4l-4 4M4 20h16" />
                </svg>
                <span className="upload-text">Add photos</span>
                <input
                  ref={el => inputRefs.current[model.id] = el}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => addImages(model.id, e.target.files)}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          ))}

          {/* Add Model Button */}
          {models.length < 4 && (
            <button className="add-model-btn" onClick={addModel}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Another Model
            </button>
          )}

          {/* Prompt */}
          <div className="card">
            <div className="prompt-area">
              <textarea
                className="prompt-input"
                placeholder={models.length > 1 
                  ? `Describe the scene using model names (e.g., "${models[0]?.name} looking at ${models[1]?.name}")...`
                  : "Describe the new image..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
              {models.length > 1 && (
                <div className="model-tags">
                  {models.filter(m => m.images.length > 0).map(m => (
                    <span key={m.id} className="model-tag" onClick={() => setPrompt(prev => prev + ` ${m.name}`)}>
                      {m.name}
                    </span>
                  ))}
                </div>
              )}
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
            disabled={loading || !canGenerate}
          >
            {loading ? (
              <span className="loading">
                <span className="spinner" />
                Generating...
              </span>
            ) : (
              'Generate'
            )}
          </button>

          {/* Output */}
          <div className="output">
            {result ? (
              <>
                <img className="output-image" src={result} alt="Generated" />
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
                  <button className="action-btn" onClick={clearAll}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <div className="output-empty">
                <svg className="output-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <p>Your image will appear here</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
