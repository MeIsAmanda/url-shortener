import { memo, useState } from 'react';
import Icon from './Icons.jsx';

function SavedSnip({ item, onRemove }) {
  const [copyState, setCopyState] = useState('idle');
  async function copy() {
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(item.shortUrl);
      setCopyState('copied');
    } catch { setCopyState('failed'); }
  }
  return (
    <li className="saved-snip">
      <div className="saved-snip-top">
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
        <button className="history-remove" type="button" aria-label={'Remove saved snip ' + item.shortUrl} onClick={() => onRemove(item.shortUrl)}><Icon name="close" /></button>
      </div>
      <a className="saved-short-url" href={item.shortUrl} aria-label={'Open saved snip ' + item.shortUrl} target="_blank" rel="noopener noreferrer">{item.shortUrl}<Icon name="external" /></a>
      <p className="saved-destination" title={item.originalUrl}>{item.originalUrl}</p>
      <button className="history-copy" type="button" onClick={copy} disabled={copyState === 'copying'} aria-label={'Copy saved snip ' + item.shortUrl}>
        <Icon name={copyState === 'copied' ? 'check' : 'copy'} />
        {copyState === 'copied' ? 'Copied!' : copyState === 'copying' ? 'Copying…' : 'Copy'}
      </button>
      <p className={copyState === 'failed' ? 'history-copy-error' : 'sr-only'} role="status">
        {copyState === 'failed' ? 'Couldn’t copy. Select the saved short URL and copy it manually.' : copyState === 'copied' ? 'Saved snip copied to clipboard.' : ''}
      </p>
    </li>
  );
}

function RecentSnips({ items, issue, onRemove, onClear }) {
  return (
    <aside className="recent-snips" aria-labelledby="recent-snips-title">
      <div className="history-heading">
        <span className="history-icon" aria-hidden="true"><Icon name="history" /></span>
        <h2 id="recent-snips-title">Recent snips</h2>
        <span className="history-count" aria-label={items.length + ' saved snips'}>{items.length}</span>
      </div>
      <div className="history-toolbar">
        <p>Saved in this browser</p>
        <button type="button" className="history-clear" onClick={onClear} disabled={!items.length && issue !== 'clear'}>Clear history</button>
      </div>
      {issue && <p className="history-storage-note" role="status">
        {issue === 'clear' ? 'Couldn’t clear browser storage. Old snips may return after a reload; try clearing again.' : 'Browser storage is unavailable. New snips stay on this page only.'}
      </p>}
      {items.length ? (
        <ol className="history-list">
          {items.map(item => <SavedSnip key={item.shortUrl} item={item} onRemove={onRemove} />)}
        </ol>
      ) : (
        <div className="history-empty"><span aria-hidden="true"><Icon name="scissors" /><Icon name="heart" /></span><p>A little collection of links.</p><span>Your next snip will land here.</span></div>
      )}
      <p className="history-footnote">Your latest 20. Clearing history keeps the links working.</p>
    </aside>
  );
}

// The collection does not need to redraw on every keystroke in the URL field.
export default memo(RecentSnips);
