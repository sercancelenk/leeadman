import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IcCheck, IcPencil } from '../icons';

type Props = {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  rows?: number;
  /** Show edit/preview tabs. Default: true. When false the editor is always in edit mode. */
  tabs?: boolean;
  /** Initial mode when tabs are enabled. */
  initialMode?: 'edit' | 'preview';
};

/**
 * MarkdownEditor renders a plain textarea in edit mode and a sanitized
 * react-markdown preview in preview mode. GitHub-flavored extensions
 * (checklists, tables, autolinks, strikethrough) are enabled via remark-gfm.
 */
export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  rows = 8,
  tabs = true,
  initialMode = 'edit',
}: Props) {
  const [mode, setMode] = useState<'edit' | 'preview'>(initialMode);
  const isEmpty = !value.trim();

  return (
    <div className="md-editor" data-mode={mode}>
      {tabs ? (
        <div className="md-editor__tabs" role="tablist" aria-label="Editor mode">
          <button
            type="button"
            className={`md-editor__tab${mode === 'edit' ? ' md-editor__tab--active' : ''}`}
            role="tab"
            aria-selected={mode === 'edit'}
            onClick={() => setMode('edit')}
          >
            <IcPencil size={14} />
            <span>Write</span>
          </button>
          <button
            type="button"
            className={`md-editor__tab${mode === 'preview' ? ' md-editor__tab--active' : ''}`}
            role="tab"
            aria-selected={mode === 'preview'}
            onClick={() => setMode('preview')}
          >
            <IcCheck size={14} />
            <span>Preview</span>
          </button>
          <span className="md-editor__hint muted small">
            Supports markdown — checklists (`- [ ]`), tables, links
          </span>
        </div>
      ) : null}

      {mode === 'edit' || !tabs ? (
        <textarea
          className="textarea md-editor__textarea"
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          spellCheck
        />
      ) : (
        <MarkdownPreview value={value} empty={isEmpty} placeholder={placeholder} />
      )}
    </div>
  );
}

function MarkdownPreview({
  value,
  empty,
  placeholder,
}: {
  value: string;
  empty: boolean;
  placeholder?: string;
}): ReactNode {
  if (empty) {
    return <p className="muted small md-editor__empty">{placeholder ?? 'Nothing to preview yet.'}</p>;
  }
  return (
    <div className="md-editor__preview md-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Read-only markdown renderer used wherever we previously dropped a `<pre>` block.
 */
export function MarkdownView({ value }: { value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="md-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
