import { useRef, useState } from 'react';
import { createLink } from './api.js';
import Icon from './Icons.jsx';

export default function App() {
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copyState, setCopyState] = useState('idle');
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
    submitting.current = true;
    try {
      setResult(await createLink(input));
    } catch (failure) {
      setError({ message: failure.message, fieldError: failure.fieldError });
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

  function handleChange(event) {
    setInput(event.target.value);
    setError(null);
    setResult(null);
    setCopyState('idle');
    resultVersion.current += 1;
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header page-width">
        <a className="wordmark" href="#" aria-label="Shortly home"><span className="brand-mark"><Icon name="link" /></span>shortly<span className="wordmark-dot">.</span></a>
        <nav aria-label="Main navigation"><a href="#how-it-works">How it works <span aria-hidden="true">↗</span></a></nav>
      </header>

      <main id="main" className="page-width">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span /> LESS LINK. MORE POSSIBILITY.</p>
            <h1 id="hero-title">Good things.<br /><span>Short links.</span></h1>
            <p className="hero-description">Some links take the long way round.<br className="desktop-break" /> Give yours a shortcut.</p>
            <p className="hero-detail">Turn a long URL into a small, shareable link.<br />Ready for your next message, post, or big idea.</p>
            <div className="hero-note"><span className="note-line" /><span>No account. Just a link.</span></div>
          </div>

          <div className="shortener-wrap">
            <div className="card-caption"><span className="caption-star" aria-hidden="true">✳</span> A SMALLER LINK STARTS HERE</div>
            <section className="shortener-card" aria-labelledby="form-title">
              <div className="card-heading"><span className="card-icon"><Icon name="link" /></span><span className="step-label">MAKE ROOM FOR LESS</span></div>
              <h2 id="form-title">Let’s keep it short.</h2>
              <p className="card-description">Your destination stays the same. Get a new link to share.</p>

              <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
                <label htmlFor="original-url">Your long URL</label>
                <input ref={inputRef} id="original-url" name="originalUrl" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck="false" value={input} onChange={handleChange} readOnly={pending} placeholder="https://example.com/something-worth-sharing" aria-invalid={Boolean(error?.fieldError)} aria-describedby={`url-hint${error ? ' form-error' : ''}`} />
                <p id="url-hint" className="input-hint">Your destination is saved exactly as entered.</p>
                {error && <p id="form-error" className="form-error" role="alert">{error.message}</p>}
                <button className="primary-button" type="submit" disabled={pending}>{pending ? <><span className="spinner" aria-hidden="true" /> Shortening…</> : <>Shorten my link <Icon name="arrow" /></>}</button>
                <p className="pending-announcement sr-only" role="status">{pending ? 'Creating your short link.' : ''}</p>
              </form>

              {result && <section className="result-card" aria-labelledby="result-title">
                <p id="result-title" className="result-title" role="status"><Icon name="check" /> Your link, a little lighter.</p>
                <a className="short-url" href={result.shortUrl} target="_blank" rel="noopener noreferrer">{result.shortUrl}<Icon name="external" /></a>
                <p className="original-url">Goes to <span>{result.originalUrl}</span></p>
                <div className="result-actions">
                  <button type="button" className="copy-button" onClick={handleCopy} disabled={copyState === 'copying'}><Icon name={copyState === 'copied' ? 'check' : 'copy'} />{copyState === 'copied' ? 'Copied!' : copyState === 'copying' ? 'Copying…' : 'Copy link'}</button>
                  <a className="open-link" href={result.shortUrl} target="_blank" rel="noopener noreferrer">Open link <Icon name="external" /></a>
                </div>
                <p className={copyState === 'failed' ? 'copy-message copy-error' : 'copy-message sr-only'} role="status">{copyState === 'failed' ? 'Couldn’t copy automatically. Select the short URL above and copy it manually.' : copyState === 'copied' ? 'Short link copied to clipboard.' : ''}</p>
              </section>}

              <div className="card-footer"><Icon name="check" /><span>Your link. Your original destination.</span></div>
            </section>
            <p className="under-card">A little less to type. A little easier to share.</p>
          </div>
        </section>

        <section id="how-it-works" className="how-section" aria-labelledby="how-title">
          <div className="how-heading"><p className="eyebrow">THE SHORT VERSION</p><h2 id="how-title">Three steps. One small link.</h2></div>
          <ol className="steps">
            <li><span className="step-number">01</span><h3>Bring your link.</h3><p>A useful article, a favourite place, or anything worth passing on.</p></li>
            <li><span className="step-number">02</span><h3>Make it shorter.</h3><p>Paste your URL above. We’ll give it a shorter way to get there.</p></li>
            <li><span className="step-number">03</span><h3>Send it on.</h3><p>Copy your new link and share it. Same destination, less to carry.</p></li>
          </ol>
        </section>
      </main>

      <footer className="site-footer page-width"><span className="footer-brand">shortly.</span><span>Small links. Ready to go.</span><a href="#main">Back to the top ↑</a></footer>
    </>
  );
}
