import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * TEMP diagnostic page (remove after the buffering investigation).
 * Shows the hidden media-lifecycle record and copies it with one tap.
 */
const MediaLog = () => {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const live = (window as unknown as { __aelixMediaLog?: unknown[] }).__aelixMediaLog;
    const stored = localStorage.getItem('aelix-media-log');
    const data = live && live.length ? live : stored ? JSON.parse(stored) : [];
    setText(JSON.stringify(data, null, 1));
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-2 text-lg font-semibold">Media record</h1>
      <p className="mb-3 text-sm text-muted-foreground">
        Tap copy, then paste it in the chat.
      </p>
      <Button onClick={copy} className="mb-3 w-full">
        {copied ? 'Copied!' : 'Copy record'}
      </Button>
      <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">
        {text || '(empty — reproduce the problem first, then come back to this page without closing the app)'}
      </pre>
    </div>
  );
};

export default MediaLog;
