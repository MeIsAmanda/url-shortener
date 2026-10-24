import { useState } from 'react';
import Icon from './Icons.jsx';

const PLACEHOLDER = 'Pop your link in here…';

export default function SnipInput({ inputRef, value, pending, error, run, onChange, onClear }) {
  const [cancelledRun, setCancelledRun] = useState(0);
  const cutting = run > 0 && run !== cancelledRun && !error;

  function restoreInput() {
    setCancelledRun(run);
  }

  function changeInput(event) {
    restoreInput();
    onChange(event.target.value);
  }

  return (
    <div
      className={`scene-field${cutting ? ' is-cutting' : ''}`}
      style={{ '--input-reveal-animation': run % 2 ? 'input-reveal-a' : 'input-reveal-b' }}
      onPointerDown={restoreInput}
      onFocus={restoreInput}
    >
      <label htmlFor="original-url">
        <Icon name="link" /> Put your long URL here!
        <svg className="input-arrow" viewBox="0 0 44 34" fill="none" aria-hidden="true" focusable="false">
          <path d="M2 10C11 0 31 2 28 12C24 24 11 18 16 12C23 5 39 16 34 30m-6-5 6 5 5-6" />
        </svg>
      </label>
      <div className="input-wrap">
        <div className="live-input">
          <input
            ref={inputRef}
            id="original-url"
            name="originalUrl"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck="false"
            value={value}
            onChange={changeInput}
            readOnly={pending}
            placeholder={PLACEHOLDER}
            aria-describedby={error ? 'url-hint form-error' : 'url-hint'}
          />
          <button className="clear-button" type="button" aria-label="Clear URL" onClick={onClear} disabled={pending || !value}><Icon name="close" /></button>
        </div>
        <div key={run} className="input-cut-overlay" aria-hidden="true">
          {['left', 'right'].map((side) => (
            <div className={`input-slice input-slice--${side}`} key={side}>
              <div className="input-facade">
                <span className={value ? '' : 'facade-placeholder'}>{value || PLACEHOLDER}</span>
                <Icon name="close" />
              </div>
            </div>
          ))}
          <span className="input-cut-line" />
        </div>
      </div>
    </div>
  );
}
