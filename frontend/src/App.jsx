import { useRef, useState } from 'react';
import { createLink } from './api.js';
import CuttingScene from './CuttingScene.jsx';
import SnipInput from './SnipInput.jsx';
import Icon from './Icons.jsx';

export default function App() {
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copyState, setCopyState] = useState('idle');
  const [snipCount, setSnipCount] = useState(0);
  const inputRef = useRef(null);
  const submitting = useRef(false);
  const resultVersion = useRef(0);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setResult(null);
    setCopyState('idle');
    resultVersion.current += 1;
    setError(null);
    setPending(true);
    setSnipCount((count) => count + 1);
    submitting.current = true;
    // The illustration runs independently: never delay the API or its result.
    try {
      setResult(await createLink(input));
    } catch (failure) {
      setError({ message: failure.message });
      inputRef.current.focus();
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  async function handleCopy() {
    const version = resultVersion.current;
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      if (version === resultVersion.current) setCopyState('copied');
    } catch {
      if (version === resultVersion.current) setCopyState('failed');
    }
  }

  function updateInput(value) {
    setInput(value);
    setError(null);
    setResult(null);
    setCopyState('idle');
    resultVersion.current += 1;
  }

  function clearInput() {
    updateInput('');
    inputRef.current.focus();
  }

  return (
    <div className="sniply-page">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header page-width">
        <a className="wordmark" href="#" aria-label="Sniply home">
          <span className="brand-mark"><Icon name="scissors" /></span>
          sniply<span className="wordmark-dot">.</span>
        </a>
        <span className="header-note"><Icon name="sparkles" /> a little internet magic</span>
      </header>

      <main id="main" className="studio">
        <div className="hero-heading">
          <span className="heading-doodle heading-doodle--left" aria-hidden="true"><Icon name="sparkles" /></span>
          <h1>Long link? <span>Snip, snip.<svg viewBox="0 0 290 14" aria-hidden="true"><path d="M5 9Q145-2 285 7M38 12Q160 4 251 10" /></svg></span></h1>
          <span className="heading-doodle heading-doodle--right" aria-hidden="true"><Icon name="flower" /></span>
        </div>

        <div className="sticker sticker--link" aria-hidden="true"><Icon name="link" /></div>
        <div className="sticker sticker--heart" aria-hidden="true"><Icon name="heart" /><span>with love</span></div>

        <section className="paper-window" aria-label="Link shortener">
          <div className="window-bar">
            <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="window-star" aria-hidden="true"><Icon name="sparkles" /></span>
          </div>

          <div className="window-body">
            <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
              <div className="scene-frame">
                <CuttingScene key={snipCount} active={snipCount > 0} />
                <SnipInput
                  inputRef={inputRef}
                  value={input}
                  pending={pending}
                  error={error}
                  run={snipCount}
                  onChange={updateInput}
                  onClear={clearInput}
                />
                <span className="scene-caption" aria-hidden="true">{pending ? 'snip in progress…' : 'a small snip of happiness'}</span>
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={pending}>
                  <Icon name="scissors" />
                  {pending ? 'Snipping…' : 'Snip my link'}
                  <Icon name="sparkles" />
                </button>
              </div>
              <p id="url-hint" className="sr-only">Your destination is saved exactly as entered.</p>
              {error && <p id="form-error" className="form-error" role="alert"><Icon name="cloud" />{error.message}</p>}
              <p className="sr-only" role="status">{pending ? 'Creating your short link.' : ''}</p>
            </form>

            {result && (
              <section className="result-card" aria-labelledby="result-title">
                <div className="result-heading">
                  <p id="result-title" className="result-title" role="status"><span><Icon name="check" /></span>Freshly snipped!</p>
                  <Icon name="sparkles" />
                </div>
                <div className="result-link-row">
                  <a className="short-url" href={result.shortUrl} target="_blank" rel="noopener noreferrer">{result.shortUrl}</a>
                  <button type="button" className="copy-button" onClick={handleCopy} disabled={copyState === 'copying'}>
                    <Icon name={copyState === 'copied' ? 'check' : 'copy'} />
                    {copyState === 'copied' ? 'Copied!' : copyState === 'copying' ? 'Copying…' : 'Copy link'}
                  </button>
                </div>
                <div className="result-bottom">
                  <details className="destination-details">
                    <summary>Original link <Icon name="chevron" /></summary>
                    <p className="original-url">{result.originalUrl}</p>
                  </details>
                  <a className="open-link" href={result.shortUrl} target="_blank" rel="noopener noreferrer">Open link <Icon name="external" /></a>
                </div>
                <p className={copyState === 'failed' ? 'copy-message copy-error' : 'copy-message sr-only'} role="status">
                  {copyState === 'failed' ? 'Couldn’t copy automatically. Select the short URL above and copy it manually.' : copyState === 'copied' ? 'Short link copied to clipboard.' : ''}
                </p>
              </section>
            )}

            <div className="studio-note"><Icon name="smile" /><span>No account. Just a little snip.</span><Icon name="heart" /></div>
          </div>
        </section>
        <p className="below-window"><Icon name="paper-plane" /> A little link, ready for its next adventure.</p>
      </main>

      <footer className="site-footer page-width">
        <span>less link, more <Icon name="heart" /><span className="sr-only">love</span></span>
        <span className="footer-doodle" aria-hidden="true"><span /><Icon name="scissors" /><span /></span>
        <span>made to be shared.</span>
      </footer>
    </div>
  );
}
