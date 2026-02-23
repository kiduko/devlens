import { useEffect, useState, useCallback } from 'react';

interface ToastMessage {
  id: number;
  text: string;
}

let addToastFn: ((msg: string) => void) | null = null;
let toastId = 0;

export function toast(msg: string): void {
  addToastFn?.(msg);
}

export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string) => {
    const id = ++toastId;
    setMessages(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== id));
    }, 1600);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (messages.length === 0) return null;

  return (
    <div className="dl-toast-container">
      {messages.map(m => (
        <div key={m.id} className="dl-toast">{m.text}</div>
      ))}
    </div>
  );
}
