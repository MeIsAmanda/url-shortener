import { useEffect, useRef, useState } from 'react';
import { fetchAccountLinks } from './accountApi.js';
import Icon from './Icons.jsx';

function AccountLink({ item }) {
  const [copied, setCopied] = useState('idle');
  async function copy() {
    setCopied('copying');
    try { await navigator.clipboard.writeText(item.shortUrl); setCopied('done'); }
    catch { setCopied('failed'); }
  }
  return <li className="saved-snip">
    <div className="saved-snip-top account-created">
      <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>Created {new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
    </div>
    <a className="saved-short-url" href={item.shortUrl} target="_blank" rel="noopener noreferrer" aria-label={'Open account link ' + item.shortUrl}>{item.shortUrl}<Icon name="external" /></a>
    <p className="saved-destination" title={item.originalUrl}>{item.originalUrl}</p>
    <div className="account-link-actions">
      <span className="click-total"><Icon name="click" />{item.clickCount.toLocaleString()} {item.clickCount === 1 ? 'click' : 'clicks'}</span>
      <button className="history-copy" type="button" disabled={copied === 'copying'} aria-label={'Copy account link ' + item.shortUrl} onClick={copy}><Icon name={copied === 'done' ? 'check' : 'copy'} />{copied === 'done' ? 'Copied!' : 'Copy'}</button>
    </div>
    <p className={copied === 'failed' ? 'history-copy-error' : 'sr-only'} role="status">{copied === 'failed' ? 'Couldn’t copy. Select the short URL and copy it manually.' : copied === 'done' ? 'Account link copied.' : ''}</p>
  </li>;
}

export default function AccountLinks({ refreshKey, onSessionExpired }) {
  const [state, setState] = useState({ items: [], nextCursor: null, loading: true, error: null });
  const version = useRef(0);
  const activeRequest = useRef(null);
  async function load(before = null) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const current = ++version.current;
    setState(previous => ({ ...previous, loading: true, error: null }));
    try {
      const page = await fetchAccountLinks(before, controller.signal);
      if (current !== version.current) return;
      setState(previous => ({
        items: before == null ? page.items : [...previous.items, ...page.items.filter(item => !previous.items.some(saved => saved.code === item.code))],
        nextCursor: page.nextCursor, loading: false, error: null,
      }));
    } catch (error) {
      if (current !== version.current || controller.signal.aborted) return;
      setState(previous => ({ ...previous, loading: false, error: error.message }));
      if (error.sessionExpired) onSessionExpired();
    }
  }
  useEffect(() => {
    load();
    return () => {
      version.current++;
      activeRequest.current?.abort();
    };
  }, [refreshKey]);

  return <aside className="recent-snips account-links" aria-labelledby="account-links-title">
    <div className="history-heading"><span className="history-icon" aria-hidden="true"><Icon name="link" /></span><h2 id="account-links-title">My links</h2><span className="history-count" aria-label={state.items.length + ' loaded links'}>{state.items.length}{state.nextCursor ? '+' : ''}</span></div>
    <div className="history-toolbar"><p>Saved to your account</p><button className="history-clear" type="button" disabled={state.loading} onClick={() => load()}>Refresh</button></div>
    {state.error && <p className="history-storage-note" role="alert">{state.error}</p>}
    {state.items.length ? <ol className="history-list">{state.items.map(item => <AccountLink key={item.code} item={item} />)}</ol> : <div className="history-empty"><Icon name="scissors" /><p>{state.loading ? 'Loading your links…' : 'Your collection starts here.'}</p><span>Create a snip while signed in.</span></div>}
    {state.nextCursor && <button className="account-more" type="button" disabled={state.loading} onClick={() => load(state.nextCursor)}>{state.loading ? 'Loading…' : 'Load older links'}<Icon name="chevron" /></button>}
    <p className="history-footnote">Clicks count redirect visits, including repeats. Refresh for the latest.</p>
  </aside>;
}
